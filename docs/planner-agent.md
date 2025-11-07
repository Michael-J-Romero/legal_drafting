# Planner Web-Research Agent Implementation Guide

## 0. Goals & Non-Goals

### Goals
- Deliver a streaming chat UI that orchestrates a planner-style agent capable of multi-step research conversations.
- Ensure the agent plans, performs web searches, remotely browses pages, extracts content, and returns cited answers with optional screenshots.
- Maintain clean separation between the client (React UI) and server (agent orchestration, tools, secret management).
- Support extended context via optional OpenAI File Search integration and persistent chat history.

### Non-Goals
- Circumventing websites' terms of service, robots.txt directives, or safety rails from upstream providers.
- Automating logins, form submissions, or any action requiring user credentials.

## 1. High-Level Architecture

### Frontend (Next.js App Router)
- Build the chat interface under `app/` using React 18 components and server actions where appropriate.
- Provide panes for live response streaming, step-by-step tool activity, citations, and screenshot thumbnails.
- Include controls for starting/stopping runs and exporting transcripts (copy Markdown / download `.md`).

### API Layer (Route Handlers)
- Host all agent routes under `app/api/*` with `export const runtime = 'nodejs'` to guarantee Node compatibility.
- `/api/agent` handles conversation turns by instantiating the planner agent via the OpenAI Agents SDK, invoking `run` with streaming enabled.
- Implement tool functions within the same module or dedicated service files to keep secrets server-side.
- Optionally expose routes for conversation persistence (e.g., `/api/conversations`, `/api/conversations/[id]/runs`).

### Remote Browser Service
- Use Playwright (via `playwright-core`) to connect to a remote browser host such as Browserless using WebSocket CDP endpoints.
- Maintain a single browser context per agent run; clean it up after completion to avoid leaked sessions or billing surprises.

### Persistence (Optional but Recommended)
- Adopt Postgres (Vercel Postgres or managed) with Prisma to store conversations, runs, tool steps, and snippets.
- Extend with `pgvector` for semantic search once needed.

### Observability
- Integrate Sentry for frontend/server logging and leverage OpenAI Agents SDK tracing hooks for per-run telemetry.

## 2. Tech Stack & Key Dependencies
- **Next.js** (App Router) with Node runtime for route handlers.
- **React 18** for UI components and streaming consumption.
- **OpenAI Node SDK** + **@openai/agents** and **@openai/agents-openai** for orchestration and streaming utilities.
- **Tavily API** (`@tavily/core` or direct fetch) to power search queries.
- **playwright-core** for remote browser control (avoid bundling Chromium in serverless functions).
- **Prisma** + **Postgres** for persistence; **Redis** optional for rate limits/caching; **Vercel Blob** or S3 for screenshot storage.
- **zod** to validate tool parameters and API inputs.
- **Sentry** (client + server) for monitoring.

## 3. Feature Specifications

### Chat & Streaming
- Client posts to `/api/agent`; server responds with `ReadableStream` of text chunks using the Agents SDK stream utilities.
- UI renders tokens incrementally with status badges (e.g., "Searching…", "Browsing…").

### Agentic Tool Use
- **search_web(query, maxResults)**: Tavily POST call returning concise `answer` + array of `{ title, url, snippet }`.
- **browse(action, url?, selector?, text?)**: supports single-step actions `goto`, `click`, `type`, `extract`, `screenshot` with remote Playwright session. Enforce one action per call.
- Maintain system instructions emphasizing "search first" discipline, citation requirements, and risk approvals before sensitive actions.

### Citations & Media
- Agent output includes a concise narrative plus bullet list of source URLs; UI links sources and associates screenshots with origins.
- Surface extracted text snippets and screenshot thumbnails in a side panel.

### Large Context via Retrieval (Optional)
- Integrate OpenAI File Search for ingesting PDFs/notes. Expose UI to upload files, index them, and allow agent to cite both local and web documents.

### Run Inspector
- Provide developer-facing inspector listing each tool call with inputs and preview of outputs (first ~300 chars) for debugging and auditing.

## 4. Detailed Integration Plan

### 4.1 Route Handler & Streaming
1. Create `app/api/agent/route.ts` exporting `runtime = 'nodejs'`.
2. Configure OpenAI key via `setDefaultOpenAIKey` and instantiate `OpenAIResponsesModel`.
3. Define `search_web` and `browse` tools with zod-validated parameters.
4. Instantiate the agent with instructions enforcing tool discipline and citation format.
5. Call `run(agent, prompt, { stream: true })` and return `NextResponse(stream.toTextStream(), {...})` with `text/plain` content type.
6. Hook into `stream.completed.finally` to dispose of Playwright `browser`, `context`, and `page` handles.

### 4.2 Model Selection & Settings
- Default to a reasoning-capable model (e.g., `gpt-5`) with temperature ~0.2–0.5 and enable tool use.
- For structured outputs (reports, memos), employ JSON schema-based structured mode from the Responses API.

### 4.3 Tool Implementations
- **search_web**: POST to Tavily with `include_answer: true`, map results to minimal payload. Cache responses 15–60 minutes using Redis or in-memory store when feasible.
- **browse**: lazily connect to Browserless via `chromium.connectOverCDP(process.env.BROWSERLESS_WS!)`. Limit extracts to ~8–16k characters and chunk longer pages. Provide screenshot base64 when requested.

### 4.4 Data Layer
- Implement Prisma schema outlined in Section 5 (Conversation, Message, AgentRun, ToolStep, Snippet). Generate migrations and configure Prisma Client on the server.
- Provide helper services for creating runs, appending messages, recording tool steps, and storing snippets.

### 4.5 Client Integration
- Build React hooks (`useAgentStream`) that consume the `ReadableStream` using `TextDecoderStream`.
- Maintain state for messages, tool steps, screenshots, and allow aborting via `AbortController`.
- Display citations with clickable URLs and optional screenshot modals.

## 5. Prisma Schema Sketch
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
  steps          ToolStep[]
  status         String
  tokensIn       Int?
  tokensOut      Int?
  costUsd        Decimal? @db.Decimal(10, 4)
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
- Prefer `search_web` to shortlist URLs, then `browse` with targeted extracts.
- After extraction, prompt the model to summarize each source into concise memos before incorporating into the working context.
- Truncate extracts to reduce token use; cache and reuse memos across runs when sources repeat.
- For large corpora, rely on File Search and cite retrieved chunks explicitly.

## 7. UX Guidelines
- Chat composer with "Run" and "Stop" (AbortController) actions.
- Inline system notices indicating tool activity.
- Citation panel listing sources with domain chips; clicking opens new tab.
- Screenshot gallery for thumbnail previews and full-resolution modal view.
- Export options: copy Markdown and download `.md` transcript.

## 8. Security & Compliance
- Keep API keys server-side; never expose them to the client.
- Validate tool inputs using zod to enforce allowed actions and argument shapes.
- Enforce domain allow/deny lists (environment-configurable), blocking private IP ranges and disallowed protocols.
- Respect robots.txt and site ToS; include instructions to avoid paywalled or login-required pages.
- Implement rate limiting per IP/user (Redis sliding window). Optionally throttle per-domain browse frequency.
- Do not persist cookies; disable downloads and file uploads in Playwright context.
- Cap browse call timeouts (~30s) and overall run duration under Vercel limits.

## 9. Operations & Deployment
- Configure environment variables on Vercel: `OPENAI_API_KEY`, `OPENAI_MODEL`, `TAVILY_API_KEY`, `BROWSERLESS_WS`, `ALLOWED_DOMAINS`.
- Ensure `/api/agent` uses Node runtime and adjust Vercel function timeout for long planning runs.
- Monitor bundle size; rely on `playwright-core` to avoid shipping Chromium.
- Provision Browserless (or self-hosted Playwright) token and perform smoke tests pre-deploy.
- Set up CI for linting, type checking, and integration tests; rely on Vercel preview deployments for PRs.

## 10. Error Handling & Resilience
- Categorize errors: OpenAI (retry/backoff), Tavily (retry once then degrade), Browser (timeout, selector miss, paywall) with clear user messaging.
- Surface partial results even when runs fail; provide actionable guidance.
- Always close Playwright resources in `finally` blocks or `stream.completed` handlers.
- Log sanitized tool inputs/outputs with run IDs for debugging.

## 11. Testing Strategy
- **Unit tests**: validate tool schemas and mock search/browse outputs.
- **Integration tests**: connect to Browserless dev token; verify `goto`, `extract`, `screenshot` flows; test streaming response shape.
- **E2E (Playwright)**: mock Tavily/Browserless for deterministic transcripts; snapshot final agent outputs.
- **Load tests**: ensure concurrent runs clean up remote browsers and stay within Vercel limits.

## 12. Cost Controls
- Limit agent `maxTurns` (e.g., 8–12) and enforce summarization after extraction.
- Cache Tavily results and deduplicate URLs per run.
- Track tokens per run, estimating USD cost to display post-run.

## 13. Roadmap Enhancements
- Human-in-the-loop approvals leveraging Agents SDK interruptions for risky tool calls.
- Structured report writer tool for consistent deliverables.
- File Search ingestion pipeline for private corpora.
- Multi-agent handoffs (Planner → Browser → Writer) as future extension.

## 14. Code Skeleton & Snippets
- Provide the example `app/api/agent/route.ts` skeleton (see Section 4.1) illustrating streaming setup, tool definitions, and cleanup.
- Outline client fetch hook structure for consuming streaming responses.

## 15. Gotchas & Best Practices
- Use Node runtime (Edge lacks required APIs).
- Start streaming quickly to avoid proxy timeouts.
- One browse action per call for traceability.
- Summarize extracted content before reusing to control context.
- Cache search/extract results when feasible.
- Observe legal restrictions and respect robots.txt.
- Monitor remote browser concurrency; close sessions promptly.

## 16. Acceptance Criteria
- `/api/agent` streams tokens within ~1–2 seconds and remains active through completion.
- Agent consistently performs search before browsing, yielding summaries with 3–6 cited sources for complex queries.
- Remote browser sessions close cleanly and screenshots render in the client when requested.
- UI reports errors gracefully while preserving partial data.

## 17. Handoff Checklist
- Vercel project configured with required environment variables.
- Browserless token provisioned; smoke test (goto → extract → screenshot) completed.
- Logging/tracing dashboards set up (Sentry + OpenAI traces).
- Prisma migrations applied; database accessible from Vercel.

## 18. Required Installation Checklist

### Required
- `next`, `react`, `react-dom`
- `openai`, `@openai/agents`, `@openai/agents-openai`
- `zod`
- `@tavily/core` (or equivalent search client)
- `playwright-core`
- `prisma`, `@prisma/client`

### Optional Enhancements
- `@vercel/postgres`, `pg`, `pgvector`
- `redis` client (e.g., `ioredis`)
- `@sentry/nextjs`
- File storage SDK (`@vercel/blob`, AWS SDK, etc.)
- File Search tooling (OpenAI File Search helpers)

This guide consolidates the architectural, operational, and security considerations required to implement the planner-style web research agent on Next.js and Vercel.
