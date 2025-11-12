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
- **Reasoning Model Support**: Optimized for GPT-5 and o1 series models with native reasoning capabilities

### 📝 AI-Powered Note Management
Intelligent note organization and structuring features:
- **Auto-Extraction**: AI automatically extracts important information from conversations
- **Refine Notes**: AI-powered refinement that:
  - Removes duplicate notes
  - Filters out generic/redundant/irrelevant information
  - Flags contradictions between notes
- **Graph Notes**: Converts notes into hierarchical JSON structures
  - Intelligent merging with existing graphs
  - Cross-references using dot notation
  - Organized by case, parties, events, evidence, and documents
  - Perfect for legal case management

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
- **[Model Routing Guide](./docs/MODEL_ROUTING.md)** - OpenAI Responses API and GPT-5 model routing

## Usage Examples

### Research Agent
Try asking the research agent:
- "Research the latest developments in AI agents and explain the key trends"
- "Compare different approaches to state management in React"
- "Analyze current quantum computing applications"

The agent will show you its complete reasoning process:
- 🤔 **THINKING** - Planning and analysis
- 🔍 **RESEARCH** - Web search and browsing
- 💡 **SYNTHESIS** - Pattern recognition and analysis
- ✅ **ANSWER** - Comprehensive response with citations

### Notes Management
1. **Chat with the AI** - Notes are automatically extracted from your conversations
2. **Review Pending Notes** - Accept or reject AI-suggested notes
3. **Refine Notes** - Click "🧹 Refine Notes" to:
   - Remove duplicates
   - Filter out generic content
   - Identify contradictions
4. **Graph Notes** - Click "📊 Graph Notes" to:
   - Convert notes into structured JSON
   - Visualize relationships
   - Export for use in other tools

Example graph structure:
```json
{
  "case": {
    "jurisdiction": {
      "court": "Superior Court",
      "location": "Los Angeles"
    },
    "parties": {
      "plaintiff": { "name": "John Doe" }
    },
    "events": {
      "hearings": [
        {
          "title": "Motion to Compel",
          "date": "2024-03-15",
          "documents": ["@documents.motion_to_compel"]
        }
      ]
    }
  },
  "documents": {
    "motion_to_compel": {
      "title": "Motion to Compel Discovery",
      "date_filed": "2024-02-01"
    }
  }
}
```

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
