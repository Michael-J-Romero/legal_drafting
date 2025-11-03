# Planner Agent for Web Research

## 0. Goals & Non-goals
- **Goals**
  - Deliver a chat experience where users can request complex research tasks.
  - Employ an agent that plans, searches the web, remotely browses pages, and produces source-cited answers.
  - Stream partial results and intermediate reasoning to the UI in real time.
  - Support long-running browsing sequences and integrate larger context through OpenAI File Search when configured.
  - Maintain a clean separation between client UI and server-side tooling/credentials.
- **Non-goals**
  - Attempting to bypass site ToS, robots.txt directives, paywalls, or safety guardrails from providers.
  - Running headless browsers within the serverless bundle or otherwise violating platform constraints.

## 1. High-level Architecture
- **Frontend (Next.js App Router)**
  - React 18 chat UI with streaming transcript, tool-step inspector, citation panel, screenshot gallery, and export actions.
- **API Layer (Next.js Route Handlers on Node runtime)**
  - `/app/api/agent/route.ts` orchestrates OpenAI Agents SDK calls.
  - Defines server-side tools: `search_web` (Tavily) and `browse` (remote Playwright).
  - Optional File Search integration for extended context over private documents.
- **Remote Browser Service**
  - Playwright client connecting to Browserless (or self-hosted) via WebSocket/CDP to avoid bundling Chromium.
- **Persistence (recommended)**
  - Postgres (Vercel Postgres) managed via Prisma for conversations, runs, tool steps, and snippets. Future pgvector support for semantic memory.
- **Observability**
  - Structured logging, Sentry instrumentation, and OpenAI SDK tracing hooks to monitor tool calls and token usage.

## 2. Tech Stack & Versions
- **Core**
  - Next.js 14+ App Router with Node runtime for API routes.
  - React 18 UI.
  - `openai` Node SDK plus `@openai/agents` for tool calling and streaming responses.
  - Tavily HTTP API (or `@tavily/core` SDK) for search.
  - `playwright-core` to connect to Browserless via WebSocket.
- **Data & Infra**
  - Postgres + Prisma schema (see §5) with migrations managed through `prisma migrate`.
  - Optional Redis (Upstash/Vercel KV) for rate limiting and caching search results.
  - Optional object storage (Vercel Blob/S3) for persisting screenshots.
- **Observability**
  - Sentry (browser + server) and OpenAI tracing hooks.

## 3. Feature Specification
- **Chat + Streaming**
  - Web stream from `/api/agent` to client, enabling incremental rendering within the chat transcript.
- **Agentic Tool Use**
  - `search_web(query, maxResults)` returns Tavily results `{answer, results[]}`.
  - `browse(action, url?, selector?, text?)` supports `goto`, `click`, `type`, `extract`, `screenshot` using a shared Playwright page within a run.
- **Planning Discipline**
  - System prompt enforces search-first, one browse action per call, risk-aware behavior, and summarized outputs with citations.
- **Citations**
  - Final agent response includes concise summary and bulleted source URLs; screenshot metadata indicates origin.
- **Screenshots & Extracted Text**
  - Base64 screenshots streamed; UI renders thumbnails lazily. Extracted text limited to 8–16k chars per call.
- **Large Context via Retrieval (optional)**
  - OpenAI File Search for ingesting PDFs/notes; integrated as additional tool with citations referencing local docs.
- **Run Inspector**
  - Developer panel surfaces each tool call with parameters and previewed outputs (first ~300 chars).

## 4. Detailed Integration Plan
### 4.1 Route Handler & Streaming
1. Create `app/api/agent/route.ts` and export `runtime = 'nodejs'` to ensure Node APIs.
2. Instantiate the OpenAI model via Agents SDK with `run(agent, prompt, { stream: true })`.
3. Return a `NextResponse` using `stream.toTextStream()` and `Content-Type: text/plain; charset=utf-8` for incremental client consumption.
4. Attach `stream.completed.finally` to close remote browser resources.

### 4.2 Model Settings
- Default to a reasoning-capable model (e.g., `gpt-5.1`) with temperature 0.2–0.5 and tool choice enabled.
- For structured deliverables, invoke Structured Outputs (JSON schema) and restrict tool usage per run.

### 4.3 Tools Implementation
- **`search_web`**
  - Validate parameters with Zod.
  - POST to `https://api.tavily.com/search` with `include_answer:true` and map to `{ title, url, snippet }`.
  - Cache responses for 15–60 minutes (Redis) to reduce cost.
- **`browse`**
  - On first use per run, establish `chromium.connectOverCDP(process.env.BROWSERLESS_WS)` and create a context/page stored in the run context.
  - Support actions:
    - `goto`: navigate with `waitUntil: 'domcontentloaded'`, 30s timeout.
    - `click`: click CSS selector with 15s timeout.
    - `type`: fill selector with provided text.
    - `extract`: return truncated `page.evaluate` innerText (max 8000 chars) and metadata.
    - `screenshot`: return `page.screenshot({ fullPage: true })` as base64.
  - Enforce allow/deny list checks before navigation.
  - Always close browser/page/context after run finishes.

## 5. Data Model (Prisma Sketch)
```prisma
model Conversation {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  title       String?
  messages    Message[]
  runs        AgentRun[]
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           String
  content        String
  createdAt      DateTime @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id])
}

model AgentRun {
  id             String   @id @default(cuid())
  conversationId String
  prompt         String
  startedAt      DateTime @default(now())
  finishedAt     DateTime?
  status         String
  tokensIn       Int?
  tokensOut      Int?
  costUsd        Decimal? @db.Decimal(10,4)
  steps          ToolStep[]
  snippets       Snippet[]
  conversation   Conversation @relation(fields: [conversationId], references: [id])
}

model ToolStep {
  id        String   @id @default(cuid())
  runId     String
  name      String
  inputJson String
  outputJson String?
  startedAt DateTime @default(now())
  finishedAt DateTime?
  run       AgentRun @relation(fields: [runId], references: [id])
}

model Snippet {
  id        String   @id @default(cuid())
  runId     String
  sourceUrl String
  text      String
  createdAt DateTime @default(now())
  run       AgentRun @relation(fields: [runId], references: [id])
}
```

## 6. Token & Context Strategy
- Limit extracted text to manageable chunks (2–4k chars) and summarize before injecting into prompt.
- Maintain memos per source and keep only condensed facts in context.
- Utilize File Search for large private corpora instead of raw prompt stuffing.
- Track token counts per run and surface usage to end-users.

## 7. UX Blueprint
- Chat composer with Run/Stop controls.
- Live transcript showing agent actions (searching, browsing) as system messages.
- Citation panel with clickable URLs; screenshot gallery with URL labels.
- Export actions: Copy Markdown and Download `.md` file.

## 8. Security & Compliance
- Keep API keys server-side only; load via environment variables.
- Validate all tool inputs with Zod and enforce allow/deny URL lists.
- Respect robots.txt and domain policies; forbid login forms and downloads.
- Rate-limit via Redis per IP/user; add CSRF protection if exposing public endpoints.
- Sanitize stored transcripts, avoid persisting cookies, and disable file downloads in Playwright context.
- Set tool timeouts (search retries, 30s browse cap) to stay within Vercel limits.

## 9. Operations & Deployment
- **Environment Variables**: `OPENAI_API_KEY`, `OPENAI_MODEL`, `TAVILY_API_KEY`, `BROWSERLESS_WS`, `ALLOWED_DOMAINS`.
- Deploy on Vercel with Node runtime for `/api/agent`, configured max duration per plan.
- Monitor bundle size; prefer `playwright-core` to avoid Chromium packaging.
- Remote browser via Browserless; optionally self-host Playwright service with autoscaling.
- CI/CD includes lint, type-check, unit/integration tests, and preview deployments.

## 10. Error Handling & Resilience
- Distinguish OpenAI, search, and browser errors; implement retries/backoff as appropriate.
- Preserve partial results when failures occur and surface errors in the UI with actionable guidance.
- Ensure remote browser resources close on completion/failure to prevent leaks.
- Emit structured logs and Sentry events with run IDs for diagnosis.

## 11. Testing Strategy
- **Unit**: Validate tool schemas, mock Tavily/browser outputs.
- **Integration**: Connect to staging Browserless endpoint; execute smoke tests (`goto`, `extract`, `screenshot`).
- **Streaming**: Assert incremental chunks from `/api/agent` using node fetch.
- **E2E (Playwright)**: Mock external services for deterministic results; snapshot structured outputs.
- **Load**: Exercise concurrent `/api/agent` runs ensuring resource cleanup.

## 12. Cost Controls
- Cap agent `maxTurns` (8–12) and apply search caching.
- Deduplicate URLs and summarize early to reduce token usage.
- Track per-run spend (tokens × pricing) and display to users.

## 13. Roadmap Enhancements
- Add human approval checkpoints via Agents SDK interruptions.
- Structured report writer tool for consistent deliverables.
- File Search ingestion pipeline with drag-and-drop uploads.
- Multi-agent pattern: planner delegates to browsing/writing sub-agents.

## 14. Key Implementation Snippets
```ts
// app/api/agent/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { Agent, run, tool } from '@openai/agents';
import { OpenAIResponsesModel, setDefaultOpenAIKey } from '@openai/agents-openai';
import { z } from 'zod';

setDefaultOpenAIKey(process.env.OPENAI_API_KEY!);
const model = new OpenAIResponsesModel({
  model: process.env.OPENAI_MODEL ?? 'gpt-5.1',
});

const search_web = tool({
  name: 'search_web',
  description: 'Search the web and return up-to-date results with citations.',
  parameters: z.object({
    query: z.string(),
    maxResults: z.number().int().min(1).max(10).default(5),
  }),
  async execute({ query, maxResults }) {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({ query, max_results: maxResults, include_answer: true }),
    }).then((r) => r.json());

    return {
      answer: res.answer,
      results: (res.results ?? []).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
      })),
    };
  },
});

const browse = tool({
  name: 'browse',
  description: 'Perform ONE remote browser action (goto, click, type, extract, screenshot).',
  parameters: z.object({
    action: z.enum(['goto', 'click', 'type', 'extract', 'screenshot']),
    url: z.string().url().optional(),
    selector: z.string().optional(),
    text: z.string().optional(),
  }),
  async execute(args, ctx) {
    if (!ctx.browser) {
      const { chromium } = await import('playwright');
      ctx.browser = await chromium.connectOverCDP(process.env.BROWSERLESS_WS!);
      ctx.context = await ctx.browser.newContext();
      ctx.page = await ctx.context.newPage();
    }

    const page = ctx.page;
    switch (args.action) {
      case 'goto': {
        if (!args.url) throw new Error('url required');
        await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        return { ok: true, title: await page.title(), url: page.url() };
      }
      case 'click': {
        if (!args.selector) throw new Error('selector required');
        await page.click(args.selector, { timeout: 15_000 });
        return { ok: true, clicked: args.selector, url: page.url() };
      }
      case 'type': {
        if (!args.selector) throw new Error('selector required');
        await page.fill(args.selector, args.text ?? '', { timeout: 15_000 });
        return { ok: true, filled: args.selector };
      }
      case 'extract': {
        const text = await page.evaluate(() => document.body?.innerText?.slice(0, 8000) ?? '');
        return { ok: true, url: page.url(), text };
      }
      case 'screenshot': {
        const buffer = await page.screenshot({ fullPage: true });
        return { ok: true, url: page.url(), screenshot_base64: buffer.toString('base64') };
      }
      default:
        throw new Error('Unsupported action');
    }
  },
});

const agent = new Agent({
  name: 'Web Researcher',
  model,
  tools: [search_web, browse],
  maxTurns: 12,
  instructions: `
You are a cautious web-research agent.
- Start with search_web to discover sources, then browse selectively.
- Use exactly one browse action per tool call.
- Respect terms of service and do not submit sensitive data.
- Summarize findings succinctly and include a bulleted list of source URLs.
`,
});

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const stream = await run(agent, prompt, { stream: true });

  stream.completed.finally(async () => {
    const ctx = stream.state?.context;
    await ctx?.page?.close().catch(() => {});
    await ctx?.context?.close().catch(() => {});
    await ctx?.browser?.close().catch(() => {});
  });

  return new NextResponse(stream.toTextStream(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
```

### Client Streaming Hook (Sketch)
```tsx
const runAgent = async (prompt: string, onChunk: (text: string) => void) => {
  const response = await fetch('/api/agent', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });

  if (!response.body) throw new Error('No response stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
};
```

## 15. Gotchas & Nuances
- Configure Vercel function timeout and memory to accommodate remote browsing, but keep each tool call <30s.
- Remote browsers may face CAPTCHAs/anti-bot; handle gracefully and suggest alternate sources.
- Always close browser resources—even on error—to avoid exhausting Browserless session quotas.
- Edge runtime is incompatible with Playwright; ensure Node runtime is specified explicitly.
- Streaming must begin promptly (<2s) to prevent proxy timeouts.
- Enforce one action per `browse` call for traceability.
- Cache Tavily responses and extracted snippets to control cost and latency.
- Maintain audit logs of tool inputs/outputs for debugging and cost analysis.

## 16. Acceptance Criteria
- `/api/agent` starts streaming within ~2s and remains active through completion.
- Agent executes `search_web` before browsing, produces 3–6 cited sources for diverse queries.
- Remote browser sessions close reliably; screenshot thumbnails render successfully.
- Errors surfaced to UI with partial results preserved.

## 17. Handoff Checklist
- Vercel project with env vars: `OPENAI_API_KEY`, `OPENAI_MODEL`, `TAVILY_API_KEY`, `BROWSERLESS_WS`, `ALLOWED_DOMAINS`.
- Node runtime route deployed; function duration tuned to workload.
- Browserless token provisioned; smoke test (goto → extract → screenshot) passes.
- Logging/tracing pipelines (Sentry + OpenAI traces) operational.
- Optional File Search indexing workflow documented if enabled.

## 18. Installation Checklist (Required vs Optional)
- **Required**
  - `next`, `react`, `react-dom`
  - `openai`, `@openai/agents`, `@openai/agents-openai`
  - `zod`
  - `@tavily/core` (or use fetch)
  - `playwright-core`
- **Optional Enhancements**
  - `@sentry/nextjs` for observability
  - `@upstash/redis` or `ioredis` for caching/rate limiting
  - `@prisma/client` + `prisma`
  - `pg` driver or Vercel Postgres SDK
  - `remark-gfm` / `react-markdown` for chat rendering (already present in repo)
  - File Search setup scripts and ingestion pipeline

This document should equip developers with the architecture, tooling, and operational guidance required to implement the planner agent on Next.js and Vercel.
