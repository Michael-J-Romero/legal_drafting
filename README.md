# Legal Drafting Application

A Next.js application with an advanced AI research agent featuring deep reasoning capabilities.

## Features

### 🧠 Advanced Research Agent
An AI-powered research assistant that works like GitHub Copilot Agent or ChatGPT Deep Research, featuring:
- **Transparent Reasoning**: See the agent's complete thought process
- **Structured Thinking**: Four-phase approach (Thinking, Research, Synthesis, Answer)
- **Inner Dialogue**: Visible planning, decision-making, and self-questioning
- **Web Research**: Search and browse capabilities with source citations
- **Visual Indicators**: Color-coded sections for each reasoning phase

### 📄 Document Creator
Tools for legal document drafting and management.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Copy `.env.local.example` to `.env.local` and add your API keys:
   ```bash
   OPENAI_API_KEY=sk-...
   TAVILY_API_KEY=tvly-...
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000/planning-agent`

## Documentation

- **[Planning Agent Setup Guide](./PLANNING_AGENT_SETUP.md)** - Installation and configuration
- **[Agent Reasoning Guide](./AGENT_REASONING_GUIDE.md)** - How to use the deep reasoning features
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Technical details for developers

## Usage Examples

Try asking the research agent:
- "Research the latest developments in AI agents and explain the key trends"
- "Compare different approaches to state management in React"
- "Analyze current quantum computing applications"

The agent will show you its complete reasoning process:
- 🤔 **THINKING** - Planning and analysis
- 🔍 **RESEARCH** - Web search and browsing
- 💡 **SYNTHESIS** - Pattern recognition and analysis
- ✅ **ANSWER** - Comprehensive response with citations

## Requirements

- Node.js 18 or later
- OpenAI API key (required)
- Tavily API key (required for research features)
- PostgreSQL database (optional)

## Tech Stack

- **Framework**: Next.js 13
- **AI**: OpenAI Agents SDK
- **Search**: Tavily API
- **Web Scraping**: Cheerio
- **Database**: PostgreSQL with Prisma (optional)
- **UI**: React with Chakra UI

## License

This project is private and proprietary.
