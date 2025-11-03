export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

type ConversationMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  score?: number;
};

type ExtractedSource = {
  url: string;
  title: string;
  text: string;
  screenshotBase64?: string;
};

type SourceMemo = {
  url: string;
  title: string;
  summary: string;
  bullet_points: string[];
};

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

const SEARCH_CACHE = new Map<string, { timestamp: number; results: SearchResult[] }>();
const SEARCH_CACHE_MS = 15 * 60 * 1000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const encoder = new TextEncoder();

class RemoteBrowserSession {
  private browser?: any;
  private context?: any;
  private page?: any;

  async ensurePage(signal?: AbortSignal) {
    if (this.page) return this.page;
    const wsEndpoint = process.env.BROWSERLESS_WS;
    if (!wsEndpoint) {
      throw new Error('BROWSERLESS_WS is not configured.');
    }
    const { chromium } = await import('playwright-core');
    if (signal?.aborted) {
      throw new Error('Request aborted');
    }
    this.browser = await chromium.connectOverCDP(wsEndpoint);
    this.context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
    });
    this.page = await this.context.newPage();
    await this.page.setDefaultNavigationTimeout(30000);
    await this.page.setDefaultTimeout(20000);
    return this.page;
  }

  async goto(url: string, signal?: AbortSignal) {
    const page = await this.ensurePage(signal);
    if (signal?.aborted) throw new Error('Request aborted');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return { title: await page.title(), url: page.url() };
  }

  async extractText(maxChars = 8000) {
    const page = await this.ensurePage();
    const text: string = await page.evaluate((limit) => {
      const raw = document.body?.innerText || '';
      return raw.slice(0, limit);
    }, maxChars);
    return text;
  }

  async screenshot() {
    const page = await this.ensurePage();
    const buffer: Buffer = await page.screenshot({ fullPage: true });
    return buffer.toString('base64');
  }

  async dispose() {
    await this.page?.close().catch(() => undefined);
    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
  }
}

function sendEvent(writer: WritableStreamDefaultWriter<Uint8Array>, event: unknown) {
  return writer.write(encoder.encode(`${JSON.stringify(event)}\n`));
}

function assertConfigured() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }
  if (!process.env.TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY is not configured.');
  }
  if (!process.env.BROWSERLESS_WS) {
    throw new Error('BROWSERLESS_WS is not configured.');
  }
}

async function planSearches(query: string, signal?: AbortSignal) {
  const planSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['queries', 'focus_areas'],
    properties: {
      queries: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        items: { type: 'string', minLength: 3 },
      },
      focus_areas: {
        type: 'array',
        minItems: 1,
        items: { type: 'string', minLength: 3 },
      },
      cautions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  } as const;

  const response = await openai.responses.parse(
    {
      model: MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'You are a meticulous research planner for a legal intelligence assistant. Given a user request, produce high-quality web search queries and focus areas. Keep queries concise and specific.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Plan the research for the following task. Return JSON.\n\nUser request:\n${query}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'ResearchPlan',
          schema: planSchema,
        },
      },
    },
    { signal },
  );

  const parsed = response.output_parsed as
    | { queries: string[]; focus_areas: string[]; cautions?: string[] }
    | null;
  if (!parsed) {
    throw new Error('Failed to produce research plan.');
  }
  return parsed;
}

async function performSearch(query: string, maxResults = 6, signal?: AbortSignal) {
  const cacheKey = `${query}::${maxResults}`;
  const now = Date.now();
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && now - cached.timestamp < SEARCH_CACHE_MS) {
    return cached.results;
  }

  const payload = {
    query,
    max_results: Math.max(1, Math.min(maxResults, 10)),
    include_answer: false,
  };

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  const json = await response.json();
  const results: SearchResult[] = Array.isArray(json.results)
    ? json.results
        .filter((r: any) => r?.url && r?.title)
        .map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet || '',
          score: typeof r.score === 'number' ? r.score : undefined,
        }))
    : [];

  SEARCH_CACHE.set(cacheKey, { timestamp: now, results });
  return results;
}

async function selectSources(
  userQuery: string,
  plan: { queries: string[]; focus_areas: string[]; cautions?: string[] },
  searchBundles: Array<{ query: string; results: SearchResult[] }>,
  signal?: AbortSignal,
) {
  const selectionSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['selections'],
    properties: {
      selections: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['url', 'reason'],
          properties: {
            url: { type: 'string', format: 'uri' },
            reason: { type: 'string', minLength: 5 },
            originating_query: { type: 'string' },
          },
        },
      },
    },
  } as const;

  const digest = searchBundles
    .map((bundle, index) => {
      const lines = bundle.results.slice(0, 6).map((r, idx) => {
        return `${idx + 1}. ${r.title}\n${r.url}\n${r.snippet}`;
      });
      return `Search ${index + 1}: ${bundle.query}\n${lines.join('\n\n')}`;
    })
    .join('\n\n---\n\n');

  const response = await openai.responses.parse(
    {
      model: MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'Choose the most useful sources to investigate for the user. Prefer primary sources, authoritative news, and up-to-date analyses. Avoid duplicates or low-quality content.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `User request: ${userQuery}\nFocus areas: ${plan.focus_areas.join(', ')}\nCautions: ${(plan.cautions || []).join(', ') || 'None'}\n\nSearch packets:\n${digest}\n\nReturn selected URLs with reasons.`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'SourceSelection',
          schema: selectionSchema,
        },
      },
    },
    { signal },
  );

  const parsed = response.output_parsed as
    | {
        selections: Array<{ url: string; reason: string; originating_query?: string }>;
      }
    | null;
  if (!parsed || !parsed.selections?.length) {
    throw new Error('Model did not select any sources.');
  }
  return parsed.selections;
}

function isPrivateHost(hostname: string) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const parts = hostname.split('.').map((p) => Number.parseInt(p, 10));
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return ['localhost', '0.0.0.0'].includes(hostname.toLowerCase());
}

function isUrlAllowed(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (isPrivateHost(url.hostname)) return false;
    const allowList = (process.env.ALLOWED_DOMAINS || '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (allowList.length > 0) {
      return allowList.some((domain) => url.hostname.toLowerCase().endsWith(domain));
    }
    return true;
  } catch {
    return false;
  }
}

async function extractSources(
  selections: Array<{ url: string; reason: string; originating_query?: string }>,
  options: {
    signal?: AbortSignal;
    captureScreenshots?: boolean;
  },
) {
  const results: ExtractedSource[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  const browser = new RemoteBrowserSession();

  try {
    for (const selection of selections.slice(0, 4)) {
      if (options.signal?.aborted) {
        throw new Error('Request aborted');
      }
      if (!isUrlAllowed(selection.url)) {
        continue;
      }
      let info: { title: string; url: string } | null = null;
      try {
        info = await browser.goto(selection.url, options.signal);
      } catch (err) {
        errors.push({ url: selection.url, error: (err as Error).message || 'Navigation failed' });
        continue;
      }
      let text = '';
      try {
        text = await browser.extractText(16000);
      } catch (err) {
        errors.push({ url: selection.url, error: (err as Error).message || 'Extraction failed' });
        continue;
      }
      const source: ExtractedSource = {
        url: info?.url || selection.url,
        title: info?.title || selection.url,
        text,
      };
      if (options.captureScreenshots) {
        try {
          source.screenshotBase64 = await browser.screenshot();
        } catch (err) {
          // Ignore screenshot failures
        }
      }
      results.push(source);
    }
  } finally {
    await browser.dispose();
  }

  return { sources: results, errors };
}

async function memoizeSources(
  userQuery: string,
  sources: ExtractedSource[],
  signal?: AbortSignal,
) {
  if (!sources.length) return [] as SourceMemo[];
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['memos'],
    properties: {
      memos: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['url', 'title', 'summary', 'bullet_points'],
          properties: {
            url: { type: 'string', format: 'uri' },
            title: { type: 'string' },
            summary: { type: 'string' },
            bullet_points: {
              type: 'array',
              minItems: 1,
              maxItems: 6,
              items: { type: 'string' },
            },
          },
        },
      },
    },
  } as const;

  const digest = sources
    .map((source, idx) => {
      const excerpt = source.text.replace(/\s+/g, ' ').slice(0, 3000);
      return `Source ${idx + 1}: ${source.title}\nURL: ${source.url}\nContent:\n${excerpt}`;
    })
    .join('\n\n---\n\n');

  const response = await openai.responses.parse(
    {
      model: MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'Summarize each source into concise memos capturing the key facts relevant to the user request. Use bullet points for factual takeaways and prefer quoting numbers or dates when present.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `User request: ${userQuery}\n\nSources:\n${digest}\n\nReturn structured memos.`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'SourceMemos',
          schema,
        },
      },
    },
    { signal },
  );

  const parsed = response.output_parsed as { memos: SourceMemo[] } | null;
  if (!parsed?.memos?.length) {
    throw new Error('Model did not generate memos for sources.');
  }
  return parsed.memos;
}

async function streamFinalAnswer(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  userQuery: string,
  conversation: ConversationMessage[],
  memos: SourceMemo[],
  signal?: AbortSignal,
) {
  const memoText = memos
    .map((memo, idx) => {
      const bullets = memo.bullet_points.map((b) => `- ${b}`).join('\n');
      return `Source ${idx + 1}: ${memo.title}\nURL: ${memo.url}\nSummary: ${memo.summary}\nKey points:\n${bullets}`;
    })
    .join('\n\n');

  const historyDigest = conversation
    .slice(0, -1)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const finalStream = await openai.responses.stream(
    {
      model: MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'You are a legal research analyst. Write a clear, cited answer synthesizing the memos. Begin with a short summary, then provide key findings. Finish with a bullet list of sources (URL + title).',
            },
          ],
        },
        ...(historyDigest
          ? [
              {
                role: 'user' as const,
                content: [
                  {
                    type: 'text',
                    text: `Previous context:\n${historyDigest}`,
                  },
                ],
              },
            ]
          : []),
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Primary question: ${userQuery}`,
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `Research memos:\n${memoText}`,
            },
          ],
        },
      ],
    },
    { signal },
  );

  let fullText = '';

  try {
    for await (const event of finalStream) {
      if (signal?.aborted) {
        finalStream.abort();
        throw new Error('Request aborted');
      }
      if (event.type === 'response.output_text.delta') {
        fullText += event.delta;
        await sendEvent(writer, { type: 'final-delta', delta: event.delta });
      } else if (event.type === 'response.completed') {
        break;
      } else if (event.type === 'response.error') {
        throw new Error(event.error?.message || 'Model streaming error');
      }
    }
  } finally {
    await finalStream.done().catch(() => undefined);
  }

  await sendEvent(writer, {
    type: 'final-summary',
    message: fullText,
    sources: memos.map((memo) => ({ url: memo.url, title: memo.title })),
  });
}

export async function POST(req: Request) {
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();

  const closeWithError = async (message: string) => {
    try {
      await sendEvent(writer, { type: 'error', error: message });
    } finally {
      await writer.close();
    }
  };

  try {
    assertConfigured();
  } catch (err) {
    await closeWithError((err as Error).message || 'Server configuration error');
    return new NextResponse(readable, {
      status: 500,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    });
  }

  let parsedBody: { messages: ConversationMessage[] };
  try {
    const json = await req.json();
    parsedBody = requestSchema.parse(json);
  } catch (err) {
    await closeWithError('Invalid request body. Expecting { messages: [...] }');
    return new NextResponse(readable, {
      status: 400,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    });
  }

  const controller = new AbortController();

  const abortAll = (reason?: any) => {
    controller.abort(reason);
  };

  req.signal.addEventListener('abort', () => abortAll(new Error('Client aborted')));

  (async () => {
    try {
      const conversation = parsedBody.messages;
      const lastUserMessage = [...conversation].reverse().find((msg) => msg.role === 'user');
      if (!lastUserMessage) {
        throw new Error('A user message is required.');
      }
      const userQuery = lastUserMessage.content;

      await sendEvent(writer, { type: 'status', message: 'Planning search queries' });
      const plan = await planSearches(userQuery, controller.signal);
      await sendEvent(writer, { type: 'plan', plan });

      const searchBundles: Array<{ query: string; results: SearchResult[] }> = [];
      for (const [index, query] of plan.queries.entries()) {
        if (controller.signal.aborted) throw new Error('Aborted');
        await sendEvent(writer, { type: 'search-start', query, index });
        try {
          const results = await performSearch(query, 6, controller.signal);
          searchBundles.push({ query, results });
          await sendEvent(writer, { type: 'search-results', query, index, results });
        } catch (err) {
          await sendEvent(writer, {
            type: 'search-error',
            query,
            index,
            error: (err as Error).message,
          });
        }
      }

      if (!searchBundles.length) {
        throw new Error('No search results were retrieved.');
      }

      await sendEvent(writer, { type: 'status', message: 'Selecting sources to open' });
      const selections = await selectSources(userQuery, plan, searchBundles, controller.signal);
      await sendEvent(writer, { type: 'selection', selections });

      await sendEvent(writer, { type: 'status', message: 'Browsing selected sources' });
      const extractionOutcome = await extractSources(selections, {
        signal: controller.signal,
        captureScreenshots: process.env.AGENT_ENABLE_SCREENSHOTS === '1',
      });
      const extracted = extractionOutcome.sources;
      for (const issue of extractionOutcome.errors) {
        await sendEvent(writer, {
          type: 'browse-error',
          error: issue.error,
          url: issue.url,
        });
      }

      if (extracted.length === 0) {
        throw new Error('Could not extract content from selected sources.');
      }

      await sendEvent(writer, {
        type: 'extractions',
        sources: extracted.map((s) => ({
          url: s.url,
          title: s.title,
          preview: s.text.slice(0, 500),
        })),
      });

      await sendEvent(writer, { type: 'status', message: 'Summarizing research memos' });
      const memos = await memoizeSources(userQuery, extracted, controller.signal);
      await sendEvent(writer, { type: 'memos', memos });

      await sendEvent(writer, { type: 'status', message: 'Writing final answer' });
      await streamFinalAnswer(writer, userQuery, conversation, memos, controller.signal);
      await sendEvent(writer, { type: 'done' });
    } catch (err) {
      if ((err as Error).name === 'AbortError' || controller.signal.aborted) {
        await sendEvent(writer, { type: 'aborted' });
      } else {
        await sendEvent(writer, {
          type: 'error',
          error: (err as Error).message || 'Agent run failed',
        });
      }
    } finally {
      await writer.close();
    }
  })();

  return new NextResponse(readable, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  });
}
