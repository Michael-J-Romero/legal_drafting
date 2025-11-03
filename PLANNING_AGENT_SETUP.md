# Web Research Planning Agent - Setup Guide

This document provides instructions for setting up and using the Web Research Planning Agent feature.

## Overview

The Web Research Planning Agent is an AI-powered assistant that can:
- Search the web using the Tavily API
- Browse specific URLs and extract content using Playwright via Browserless
- Synthesize research findings into clear, well-organized responses with source citations

## Architecture

### Components

1. **API Route** (`src/app/api/agent/route.ts`)
   - Next.js Route Handler with Node.js runtime
   - Integrates OpenAI Agents SDK
   - Implements two primary tools:
     - `search_web`: Web search via Tavily API
     - `browse`: Web page interaction via Browserless/Playwright
   - Streams responses back to the client

2. **UI** (`src/app/planning-agent/page.tsx`)
   - React chat interface
   - Real-time streaming of agent responses
   - Clean, accessible design

3. **Database Schema** (`prisma/schema.prisma`)
   - PostgreSQL schema for persistence
   - Models: Conversation, AgentRun, ToolStep, Snippet

## Prerequisites

- Node.js 18 or later
- PostgreSQL database
- API keys for:
  - OpenAI (for the agent)
  - Tavily (for web search)
  - Browserless or similar Playwright service (for web browsing)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- `@openai/agents` - OpenAI Agents SDK
- `@openai/agents-openai` - OpenAI provider for Agents SDK
- `zod` - Schema validation
- `playwright-core` - Browser automation
- `@prisma/client` - Prisma database client
- `prisma` (dev) - Prisma CLI

### 2. Set Up Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Tavily API Key (get from https://tavily.com)
TAVILY_API_KEY=tvly-...

# Browserless WebSocket URL (e.g., from browserless.io or self-hosted)
BROWSERLESS_WS=wss://chrome.browserless.io?token=YOUR_TOKEN

# PostgreSQL Database URL
DATABASE_URL=postgresql://user:password@localhost:5432/legal_drafting
```

See `.env.local.example` for a template.

### 3. Initialize Prisma and Database

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database (creates tables)
npx prisma db push

# Optional: Open Prisma Studio to view/edit data
npx prisma studio
```

Alternatively, if you prefer migrations:

```bash
# Create initial migration
npx prisma migrate dev --name init
```

## Usage

### Development

1. Start the development server:

```bash
npm run dev
```

2. Navigate to `http://localhost:3000/planning-agent`

3. Enter a research query, such as:
   - "Research the latest developments in AI agents"
   - "Find information about Next.js 14 features"
   - "What are the current trends in web development?"

### Production

1. Build the application:

```bash
npm run build
```

2. Start the production server:

```bash
npm run start
```

## API Endpoints

### POST `/api/agent`

Submit a message to the planning agent and receive a streaming response.

**Request Body:**
```json
{
  "message": "Research the latest developments in AI agents"
}
```

**Response:**
Server-Sent Events (SSE) stream with JSON chunks:
```
data: {"type":"text","content":"Based on my research..."}

data: {"type":"tool_call","name":"search_web","input":{...}}

data: {"type":"tool_result","name":"search_web","output":{...}}
```

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY is not configured"**
   - Ensure `.env.local` exists with a valid OpenAI API key
   - Restart the development server after adding environment variables

2. **"TAVILY_API_KEY is not configured"**
   - Sign up for a Tavily API key at https://tavily.com
   - Add it to `.env.local`

3. **"BROWSERLESS_WS is not configured"**
   - Either sign up for Browserless.io or self-host a Playwright service
   - Add the WebSocket URL to `.env.local`

4. **Database connection errors**
   - Verify your PostgreSQL database is running
   - Check the `DATABASE_URL` in `.env.local`
   - Ensure the database exists: `createdb legal_drafting`

5. **Build warnings about optional dependencies**
   - Warnings about `bufferutil` and `utf-8-validate` are expected and can be ignored
   - These are optional performance enhancements for the WebSocket library

## Database Schema

The Prisma schema includes the following models:

- **Conversation**: Top-level conversation container
- **AgentRun**: Individual agent execution runs
- **ToolStep**: Records of tool executions (search_web, browse)
- **Snippet**: Extracted content snippets from research

You can extend these models as needed for your application.

## Security Considerations

1. **API Keys**: Never commit `.env.local` to version control
2. **Rate Limiting**: Consider implementing rate limiting for the `/api/agent` endpoint
3. **Input Validation**: The agent already validates inputs, but consider additional validation for production use
4. **Database Access**: Use appropriate database credentials and access controls
5. **Browserless**: Ensure your Browserless instance is secure and properly configured

## Future Enhancements

Potential improvements to consider:

- Implement database persistence for conversations and tool outputs
- Add authentication/authorization for the planning agent UI
- Implement conversation history and resume functionality
- Add support for file uploads and document analysis
- Integrate additional tools (calculator, code execution, etc.)
- Add cost tracking and usage analytics
- Implement human-in-the-loop approval for certain actions

## License

This feature is part of the legal_drafting project and follows the same license terms.
