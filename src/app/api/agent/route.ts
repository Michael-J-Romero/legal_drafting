export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type {
  ResponseCreateParams,
  ResponseInput,
  ResponseFunctionToolCallItem,
  ResponseFunctionToolCall,
} from 'openai/resources/responses/responses';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const MAX_TURNS = 8;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface PlannerRequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PlannerRequestBody {
  messages?: PlannerRequestMessage[];
}

interface PlannerStreamEvent {
  type:
    | 'assistant-delta'
    | 'assistant-message'
    | 'tool-call'
    | 'tool-result'
    | 'tool-error'
    | 'source'
    | 'screenshot'
    | 'final-sources'
    | 'status'
    | 'done'
    | 'error';
  [key: string]: any;
}

interface PlannerSource {
  id: string;
  url: string;
  title?: string;
  snippet?: string;
  origin?: string;
  toolCallId?: string;
  runStep?: number;
}

interface RunContext {
  browser?: any;
  context?: any;
  page?: any;
}

const tools: ResponseCreateParams['tools'] = [
  {
    type: 'function',
    name: 'search_web',
    description:
      'Search the public web for up-to-date information. Always call this before browsing individual pages. Returns answer and list of sources.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to send to the Tavily API.',
        },
        maxResults: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          default: 5,
          description: 'Maximum number of results to return.',
        },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'browse',
    description:
      'Perform exactly one remote browser action. Actions: goto (navigate to url), click (css selector), type (fill selector with text), extract (read visible text), screenshot (capture page). Always respect site ToS and robots. Never submit sensitive data.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['goto', 'click', 'type', 'extract', 'screenshot'],
        },
        url: { type: 'string', description: 'Required for goto. Full URL.' },
        selector: {
          type: 'string',
          description: 'CSS selector for click/type actions.',
        },
        text: {
          type: 'string',
          description: 'Text to type into the selector when action is type.',
        },
      },
      required: ['action'],
    },
  },
];

const systemPrompt = `You are a cautious and detail-oriented web research planner.
- Always begin with search_web to gather candidate sources before browsing.
- Use browse with one atomic action per call. Prefer extract for collecting text snippets, screenshot for key visuals.
- Respect website terms, robots.txt, and avoid submitting forms or personal data.
- Summarize findings concisely and cite relevant URLs.
- Maintain a running memo of gathered facts; use them to craft the final answer.
- Ask for explicit approval before any action that might be risky (e.g., login, forms).
`;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
  }

  let payload: PlannerRequestBody;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (!messages.every((m) => m && typeof m.role === 'string' && typeof m.content === 'string')) {
    return NextResponse.json({ error: 'Malformed messages array' }, { status: 400 });
  }

  const conversation: ResponseInput = buildConversation(messages);

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = async (event: PlannerStreamEvent) => {
    await writer.write(encoder.encode(`${JSON.stringify(event)}\n`));
  };

  const runContext: RunContext = {};
  const knownSources = new Map<string, PlannerSource>();
  const abortSignal = request.signal;

  (async () => {
    try {
      await runAgentLoop({
        conversation,
        send,
        runContext,
        knownSources,
        abortSignal,
      });
      await send({ type: 'final-sources', sources: Array.from(knownSources.values()) });
      await send({ type: 'done' });
    } catch (error: any) {
      await send({
        type: 'error',
        message: error?.message || 'Unexpected planner agent error',
      });
    } finally {
      await cleanupBrowser(runContext);
      await writer.close();
    }
  })();

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
      'Transfer-Encoding': 'chunked',
    },
  });
}

async function runAgentLoop({
  conversation,
  send,
  runContext,
  knownSources,
  abortSignal,
}: {
  conversation: ResponseInput;
  send: (event: PlannerStreamEvent) => Promise<void>;
  runContext: RunContext;
  knownSources: Map<string, PlannerSource>;
  abortSignal?: AbortSignal;
}) {
  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    if (abortSignal?.aborted) {
      throw new Error('Request aborted');
    }

    const stream = await client.responses.stream(
      {
        model: MODEL,
        input: conversation,
        tools,
        temperature: 0.35,
        max_output_tokens: 1800,
      },
      abortSignal ? { signal: abortSignal } : undefined,
    );

    const toolCalls = new Map<string, ResponseFunctionToolCallItem & { arguments_text?: string }>();
    let assistantText = '';

    stream.on('response.output_text.delta', (event) => {
      assistantText += event.delta;
      send({ type: 'assistant-delta', delta: event.delta }).catch(() => {});
    });

    stream.on('response.output_item.added', (event) => {
      if (event.item.type === 'function_call') {
        const item = event.item as ResponseFunctionToolCallItem;
        toolCalls.set(item.id, { ...item, arguments_text: '' });
        send({
          type: 'tool-call',
          callId: item.call_id,
          name: item.name,
          status: 'pending',
        }).catch(() => {});
      }
    });

    stream.on('response.function_call_arguments.delta', (event) => {
      const call = toolCalls.get(event.item_id);
      if (call) {
        call.arguments_text = (call.arguments_text || '') + event.delta;
      }
    });

    stream.on('response.function_call_arguments.done', (event) => {
      const call = toolCalls.get(event.item_id);
      if (call) {
        call.arguments_text = event.arguments;
        send({
          type: 'tool-call',
          callId: call.call_id,
          name: call.name,
          status: 'ready',
          args: safeParseJSON(event.arguments),
        }).catch(() => {});
      }
    });

    stream.on('response.error', (event) => {
      send({ type: 'status', level: 'error', message: event.error.message }).catch(() => {});
    });

    const finalResponse = await stream.finalResponse();

    if (assistantText.trim().length > 0) {
      conversation.push({ role: 'assistant', content: assistantText });
      await send({ type: 'assistant-message', content: assistantText });
    }

    const functionCalls = finalResponse.output.filter(
      (item): item is ResponseFunctionToolCallItem => item.type === 'function_call',
    );

    if (!functionCalls.length) {
      return;
    }

    for (const call of functionCalls) {
      const tracked = toolCalls.get(call.id) || call;
      const argsText = tracked.arguments_text || call.arguments || '{}';
      let parsedArgs: Record<string, any> = {};
      try {
        parsedArgs = safeParseJSON(argsText);
      } catch (error) {
        await send({
          type: 'tool-error',
          callId: call.call_id,
          name: call.name,
          error: 'Failed to parse tool arguments',
        });
        parsedArgs = {};
      }

      conversation.push({
        type: 'function_call',
        id: call.id,
        call_id: call.call_id,
        name: call.name,
        arguments: argsText,
      } as ResponseFunctionToolCall);

      try {
        const toolResult = await executeTool({
          call,
          args: parsedArgs,
          send,
          runContext,
          knownSources,
        });

        conversation.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(toolResult ?? {}),
        });
      } catch (error: any) {
        const failurePayload = {
          ok: false,
          error: error?.message || 'Tool execution failed',
        };

        await send({
          type: 'tool-error',
          callId: call.call_id,
          name: call.name,
          error: failurePayload.error,
        });

        conversation.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(failurePayload),
        });
      }
    }
  }

  await send({
    type: 'status',
    level: 'warning',
    message: 'Reached maximum number of planner turns before completion.',
  });
}

async function executeTool({
  call,
  args,
  send,
  runContext,
  knownSources,
}: {
  call: ResponseFunctionToolCallItem;
  args: Record<string, any>;
  send: (event: PlannerStreamEvent) => Promise<void>;
  runContext: RunContext;
  knownSources: Map<string, PlannerSource>;
}) {
  if (call.name === 'search_web') {
    const maxResults = clampNumber(args.maxResults, 1, 10, 5);
    const query = typeof args.query === 'string' ? args.query.slice(0, 512) : '';
    if (!query) {
      throw new Error('Missing search query');
    }

    const result = await callTavilySearch({ query, maxResults });
    for (const entry of result.results) {
      registerSource(
        {
          id: entry.url,
          url: entry.url,
          title: entry.title,
          snippet: entry.snippet,
          origin: 'search_web',
          toolCallId: call.call_id,
        },
        knownSources,
        send,
      );
    }

    await send({
      type: 'tool-result',
      callId: call.call_id,
      name: call.name,
      output: result,
      preview: buildPreview(result),
    });

    return result;
  }

  if (call.name === 'browse') {
    const action = String(args.action || '');
    if (!['goto', 'click', 'type', 'extract', 'screenshot'].includes(action)) {
      throw new Error('Unsupported browse action');
    }

    const browseResult = await runBrowseAction({ action, args, runContext, callId: call.call_id, send, knownSources });

    await send({
      type: 'tool-result',
      callId: call.call_id,
      name: call.name,
      output: browseResult,
      preview: buildPreview(browseResult),
    });

    return browseResult;
  }

  throw new Error(`Unknown tool: ${call.name}`);
}

async function callTavilySearch({
  query,
  maxResults,
}: {
  query: string;
  maxResults: number;
}): Promise<{ answer?: string; results: Array<{ title?: string; url: string; snippet?: string }> }> {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY is not configured');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({ query, max_results: maxResults, include_answer: true }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  const data = await response.json();
  const normalizedResults = Array.isArray(data?.results)
    ? data.results.map((item: any) => ({
        title: typeof item?.title === 'string' ? item.title : undefined,
        url: typeof item?.url === 'string' ? item.url : '',
        snippet: typeof item?.snippet === 'string' ? item.snippet : undefined,
      }))
    : [];

  return {
    answer: typeof data?.answer === 'string' ? data.answer : undefined,
    results: normalizedResults.filter((item) => item.url),
  };
}

async function runBrowseAction({
  action,
  args,
  runContext,
  callId,
  send,
  knownSources,
}: {
  action: string;
  args: Record<string, any>;
  runContext: RunContext;
  callId: string;
  send: (event: PlannerStreamEvent) => Promise<void>;
  knownSources: Map<string, PlannerSource>;
}) {
  const wsEndpoint = process.env.BROWSERLESS_WS;
  if (!wsEndpoint) {
    throw new Error('BROWSERLESS_WS is not configured for remote browsing');
  }

  if (!runContext.browser) {
    let playwright;
    try {
      playwright = await import('playwright-core');
    } catch (error) {
      throw new Error('playwright-core is not installed. Add it as a dependency to enable browsing.');
    }

    const { chromium } = playwright as typeof import('playwright-core');
    runContext.browser = await chromium.connectOverCDP(wsEndpoint);
    runContext.context = await runContext.browser.newContext();
    runContext.page = await runContext.context.newPage();
  }

  const page = runContext.page;
  if (!page) {
    throw new Error('Remote browser page is not available');
  }

  if (action === 'goto') {
    const rawUrl = String(args.url || '').trim();
    if (!rawUrl) {
      throw new Error('browse.goto requires a URL');
    }

    await page.goto(rawUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const finalUrl = page.url();
    const title = await page.title();

    registerSource(
      {
        id: finalUrl,
        url: finalUrl,
        title,
        origin: 'browse.goto',
        toolCallId: callId,
      },
      knownSources,
      send,
    );

    return { ok: true, action, url: finalUrl, title };
  }

  if (action === 'click') {
    const selector = String(args.selector || '').trim();
    if (!selector) {
      throw new Error('browse.click requires a selector');
    }

    await page.click(selector, { timeout: 20000 });
    return { ok: true, action, selector, url: page.url() };
  }

  if (action === 'type') {
    const selector = String(args.selector || '').trim();
    if (!selector) {
      throw new Error('browse.type requires a selector');
    }
    const text = typeof args.text === 'string' ? args.text : '';
    await page.fill(selector, text, { timeout: 20000 });
    return { ok: true, action, selector, textLength: text.length, url: page.url() };
  }

  if (action === 'extract') {
    const text = await page.evaluate(() => {
      const bodyText = document?.body?.innerText || '';
      return bodyText.slice(0, 12000);
    });

    const cleaned = text.replace(/\s+/g, ' ').trim();
    registerSource(
      {
        id: `${page.url()}#extract`,
        url: page.url(),
        title: await page.title(),
        snippet: cleaned.slice(0, 5000),
        origin: 'browse.extract',
        toolCallId: callId,
      },
      knownSources,
      send,
    );

    return { ok: true, action, url: page.url(), text: cleaned };
  }

  if (action === 'screenshot') {
    const buffer = await page.screenshot({ fullPage: true });
    const base64 = buffer.toString('base64');
    await send({
      type: 'screenshot',
      callId,
      url: page.url(),
      data: base64,
    });

    registerSource(
      {
        id: `${page.url()}#screenshot`,
        url: page.url(),
        title: await page.title(),
        origin: 'browse.screenshot',
        toolCallId: callId,
      },
      knownSources,
      send,
    );

    return { ok: true, action, url: page.url(), screenshot: true };
  }

  throw new Error(`Unsupported browse action: ${action}`);
}

async function cleanupBrowser(context: RunContext) {
  try {
    await context.page?.close();
  } catch (error) {
    // noop
  }
  try {
    await context.context?.close();
  } catch (error) {
    // noop
  }
  try {
    await context.browser?.close();
  } catch (error) {
    // noop
  }
}

function buildConversation(messages: PlannerRequestMessage[]): ResponseInput {
  const input: ResponseInput = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ];

  for (const message of messages) {
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    input.push({ role, content: message.content });
  }

  return input;
}

function safeParseJSON(text: string) {
  try {
    return JSON.parse(text || '{}');
  } catch (error) {
    return {};
  }
}

function clampNumber(value: any, min: number, max: number, fallback: number) {
  const num = Number(value);
  if (Number.isFinite(num)) {
    return Math.min(Math.max(Math.floor(num), min), max);
  }
  return fallback;
}

function registerSource(source: PlannerSource, store: Map<string, PlannerSource>, send: (event: PlannerStreamEvent) => Promise<void>) {
  if (!source.url) {
    return;
  }
  if (!store.has(source.url)) {
    store.set(source.url, source);
  }
  send({ type: 'source', source }).catch(() => {});
}

function buildPreview(value: unknown): string {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > 400 ? `${text.slice(0, 397)}...` : text;
  } catch (error) {
    return '[unavailable]';
  }
}
