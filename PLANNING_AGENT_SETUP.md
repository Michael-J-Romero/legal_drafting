# Web Research Planning Agent - Setup Guide

This document provides instructions for setting up and using the Web Research Planning Agent feature.

## Overview

The Web Research Planning Agent is an advanced AI-powered assistant with deep reasoning capabilities that works like GitHub Copilot Agent or ChatGPT Deep Research. It can:
- Search the web using the Tavily API
- Browse specific URLs and extract content using Cheerio
- **Show its complete thought process with structured thinking phases**
- **Demonstrate inner dialogue and reasoning**
- Synthesize research findings into clear, well-organized responses with source citations

### Agent Reasoning Process

The agent uses a structured four-phase approach to tackle every query:

1. **🤔 THINKING Phase**: The agent analyzes your question, breaks it down into sub-problems, plans its approach, and shows its internal reasoning process.

2. **🔍 RESEARCH Phase**: The agent executes web searches and browses URLs, explaining what it's looking for and why at each step.

3. **💡 SYNTHESIS Phase**: The agent organizes all gathered information, identifies patterns and themes, and reconciles different perspectives.

4. **✅ ANSWER Phase**: The agent presents a comprehensive, well-structured response with proper citations.

Each phase is visually distinguished in the UI with colored backgrounds and emoji indicators, making it easy to follow the agent's reasoning process.

## Architecture

### Components

1. **API Route** (`src/app/api/agent/route.ts`)
   - Next.js Route Handler with Node.js runtime
   - Integrates OpenAI Agents SDK with advanced prompting
   - Uses Chain-of-Thought reasoning with structured phases
   - **Context Manager** for optimized token usage (LangChain integration)
   - Implements two primary tools:
     - `search_web`: Web search via Tavily API
     - `browse`: Web page interaction via Cheerio (HTTP fetch + HTML parsing)
   - Streams responses back to the client in real-time

2. **Context Manager** (`src/app/api/agent/contextManager.ts`) **NEW**
   - Hybrid LangChain integration for efficient context management
   - Semantic search using OpenAI embeddings
   - Document chunking with RecursiveCharacterTextSplitter
   - Token counting with tiktoken (max 8000 tokens per request)
   - Automatic extraction and storage of research findings
   - Cosine similarity scoring for relevance ranking
   - Conversation summarization (keeps last 3 messages)

3. **UI** (`src/app/planning-agent/page.tsx`)
   - React chat interface with real-time streaming
   - Parses and visualizes agent's reasoning phases
   - Color-coded sections for different thinking stages
   - Clean, accessible design with visual feedback

4. **Database Schema** (`prisma/schema.prisma`)
   - PostgreSQL schema for persistence
   - Models: Conversation, AgentRun, ToolStep, Snippet

## Prerequisites

- Node.js 18 or later
- PostgreSQL database (optional - for persistence features)
- API keys for:
  - OpenAI (for the agent - required)
  - Tavily (for web search - required for research features)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- `@openai/agents` - OpenAI Agents SDK
- `@openai/agents-openai` - OpenAI provider for Agents SDK
- `zod` - Schema validation
- `langchain` - LangChain framework for context management
- `@langchain/openai` - OpenAI integrations for LangChain
- `@langchain/core` - Core LangChain functionality
- `@langchain/textsplitters` - Document chunking utilities
- `tiktoken` - Token counting for efficient context management
- `cheerio` - HTML parsing for web browsing
- `@prisma/client` - Prisma database client
- `prisma` (dev) - Prisma CLI

### 2. Set Up Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Tavily API Key (get from https://tavily.com)
TAVILY_API_KEY=tvly-...

# PostgreSQL Database URL (optional - for persistence)
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

3. Enter a research query. The agent will show you its complete thought process across four phases:

   **Example queries:**
   - "Research the latest developments in AI agents and explain the key trends"
   - "What are the current best practices for Next.js 14?"
   - "Compare different approaches to web scraping in JavaScript"

4. Watch as the agent:
   - 🤔 **Thinks** through the problem and plans its approach
   - 🔍 **Researches** by searching the web and browsing relevant sources
   - 💡 **Synthesizes** the findings and identifies patterns
   - ✅ **Answers** with a comprehensive response and citations

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

3. **Database connection errors**
   - Verify your PostgreSQL database is running
   - Check the `DATABASE_URL` in `.env.local`
   - Ensure the database exists: `createdb legal_drafting`
   - Note: Database is optional; the agent works without it

4. **Agent not showing structured phases**
   - The agent uses specific markers (🤔, 🔍, 💡, ✅) to structure responses
   - If phases aren't appearing, the agent may not be following the prompt correctly
   - This is expected for simple queries; complex research questions work best

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
4. **Database Access**: Use appropriate database credentials and access controls (if using database features)
5. **Content Filtering**: Consider implementing content filtering for sensitive queries or responses

## Future Enhancements

Potential improvements to consider:

- Implement database persistence for conversations and tool outputs
- Add authentication/authorization for the planning agent UI
- Implement conversation history and resume functionality
- Add support for file uploads and document analysis
- Integrate additional tools (calculator, code execution, etc.)
- Add cost tracking and usage analytics
- Implement human-in-the-loop approval for certain actions

## Key Features

### Optimized Context Management (NEW)

The agent now uses LangChain for efficient token usage and intelligent context retrieval:

- **Semantic Search**: Uses OpenAI embeddings to find the most relevant research findings for each query
- **Smart Chunking**: Breaks down large documents into manageable chunks (1000 tokens with 200-token overlap)
- **Token Optimization**: Automatically limits context to 8000 tokens, prioritizing the most relevant information
- **Research Accumulation**: Stores findings from RESEARCH, REFLECTION, and SYNTHESIS phases for future reference
- **Conversation Summarization**: Keeps only the last 3 messages to reduce context size
- **Automatic Extraction**: Extracts and indexes research findings as the agent works

**Benefits:**
- Reduced API costs through efficient token usage
- Better context relevance via semantic similarity
- Maintains conversation continuity across sessions
- Scales to longer research sessions without context overflow

### Transparent Reasoning Process

Unlike traditional chatbots that hide their reasoning, this agent shows you exactly how it thinks:

- **Inner Dialogue**: See the agent question its assumptions and consider alternative approaches
- **Decision Making**: Understand why the agent chooses specific search queries or sources
- **Uncertainty Acknowledgment**: The agent is transparent about limitations and areas needing more research
- **Progressive Disclosure**: Information is presented in logical phases, making complex research easy to follow

### Visual Indicators

The UI uses color-coded sections to help you quickly identify different phases:

- **Yellow**: Thinking/Planning phase
- **Blue**: Research/Data gathering phase  
- **Purple**: Synthesis/Analysis phase
- **Green**: Final answer/Conclusion phase

### Structured Responses

Every response follows a consistent structure that mirrors how expert researchers work:
1. Understand the problem
2. Gather information
3. Analyze and synthesize
4. Present findings

This makes the agent's work easy to review, verify, and build upon.

## License

This feature is part of the legal_drafting project and follows the same license terms.
