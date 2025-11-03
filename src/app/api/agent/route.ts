import { Agent, tool, run } from '@openai/agents';
import { z } from 'zod';
import { load as loadHtml } from 'cheerio';

// Use Node.js runtime for this route
export const runtime = 'nodejs';

// Define the search_web tool schema
const searchWebSchema = z.object({
  query: z.string().describe('The search query to execute'),
  maxResults: z.number().optional().default(5).describe('Maximum number of results to return'),
});

// Define the browse tool schema
const browseSchema = z.object({
  url: z.string().describe('The URL to browse'),
  selector: z.string().default('').describe('CSS selector to extract specific content. Leave empty to get full page content.'),
});

// (Removed Browserless/Playwright helpers)

// Search web tool implementation using Tavily API
async function searchWeb(args: z.infer<typeof searchWebSchema>) {
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  
  if (!tavilyApiKey) {
    throw new Error('TAVILY_API_KEY is not configured');
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: args.query,
        max_results: args.maxResults,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json();
    return JSON.stringify(data.results || []);
  } catch (error) {
    console.error('Error in searchWeb:', error);
    throw error;
  }
}

// Browse tool using simple HTTP fetch + Cheerio (no Browserless/Playwright)
async function browse(args: z.infer<typeof browseSchema>) {
  try {
    const res = await fetch(args.url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL (${res.status} ${res.statusText})`);
    }

    const contentType = res.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    const html = await res.text();

    let content: string | null = html;
    if (isHtml) {
      const $ = loadHtml(html);
      if (args.selector && args.selector.trim() !== '') {
        const sel = $(args.selector);
        content = sel.length ? sel.text().trim() : '';
      } else {
        content = $('body').text().replace(/\s+/g, ' ').trim();
      }
    }

    return JSON.stringify({ url: args.url, content });
  } catch (error) {
    console.error('Error in browse:', error);
    throw error;
  }
}

// Create tools using the tool helper
const searchWebTool = tool({
  name: 'search_web',
  description: 'Search the web using Tavily API to find relevant information',
  parameters: searchWebSchema,
  execute: searchWeb,
});

const browseTool = tool({
  name: 'browse',
  description: 'Fetch a URL and extract content with an optional CSS selector (no JS rendering)',
  parameters: browseSchema,
  execute: browse,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, messages } = body as {
      message?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string | number | Date }>;
    };

    // Build a single input string that contains 100% of the conversation context
    // This avoids relying on any server-side session state.
    let inputText: string;
    if (Array.isArray(messages) && messages.length > 0) {
      const transcript = messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      inputText = `You are continuing a multi-turn conversation. Here is the full transcript so far:\n\n${transcript}\n\nPlease continue the conversation as the Assistant, responding to the most recent user message. Use tools when helpful and follow your browsing/citation instructions.`;
    } else if (typeof message === 'string' && message.trim().length > 0) {
      inputText = message.trim();
    } else {
      return new Response('Message or messages array is required', { status: 400 });
    }

    // The OpenAI API key is automatically picked up from the OPENAI_API_KEY environment variable
    // Create the agent with tools
    const agent = new Agent({
      name: 'Research Assistant',
      model: 'gpt-4o',
  instructions: `You are an advanced research assistant with deep reasoning capabilities. You work like GitHub Copilot Agent or ChatGPT Deep Research - showing your thinking process transparently.

**CRITICAL: Structure ALL your responses using these exact markers:**

🤔 **THINKING:**
[Your internal reasoning, planning, and analysis. Break down the problem, identify what you need to research, plan your approach]

🔍 **RESEARCH:**
[Use tools here. Explain what you're searching for and why]

💡 **SYNTHESIS:**
[Organize and analyze the findings. Draw connections, identify patterns]

✅ **ANSWER:**
[Your final, well-structured response with citations]

**Process for every user query:**

1. **THINKING Phase**: 
   - Analyze the user's question
   - Break it into sub-questions or research areas
   - Plan which tools to use and in what order
   - Identify potential challenges or considerations
   - Show your reasoning process transparently

2. **RESEARCH Phase**:
   - Execute searches using search_web tool
   - Browse promising URLs using browse tool
   - Document each step: "Searching for X because Y"
   - Before browsing, state: "BROWSING_URL: <url>"
   - Summarize key findings from each source

3. **SYNTHESIS Phase**:
   - Organize all gathered information
   - Identify themes, patterns, and connections
   - Evaluate source credibility and relevance
   - Reconcile conflicting information
   - Prepare structured insights

4. **ANSWER Phase**:
   - Present a clear, comprehensive answer
   - Use headings and bullet points for clarity
   - Include all relevant citations with URLs
   - Acknowledge limitations or areas needing more research

**Inner Dialogue Guidelines:**
- Think out loud in THINKING sections
- Question your assumptions
- Consider alternative approaches
- Show decision-making process
- Be transparent about uncertainty

**Example Structure:**

🤔 **THINKING:**
The user is asking about X. To answer this well, I need to:
1. Understand the context of X
2. Find recent developments in X
3. Compare different perspectives on X

My approach will be to first search for general information, then dive deeper into specific aspects.

🔍 **RESEARCH:**
Searching for "X recent developments" to get current information...
[tool call happens]
Found 5 sources. The most promising are URLs A and B.
BROWSING_URL: <url-A>
[browse happens]
Key finding from source A: ...

💡 **SYNTHESIS:**
Based on my research:
- Theme 1: ...
- Theme 2: ...
Connecting these findings: ...

✅ **ANSWER:**
Based on comprehensive research, here's what I found about X:
[structured response with citations]

Remember: ALWAYS use all four phases with the emoji markers. This transparency helps users follow your reasoning.`,
      tools: [searchWebTool, browseTool],
    });

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Run the agent with streaming
          const result = await run(agent, inputText, {
            stream: true,
          });

          // Stream the response chunks
          for await (const chunk of result) {
            const data = JSON.stringify(chunk);
            controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
          }

          controller.close();
        } catch (error) {
          console.error('Error during agent run:', error);
          const errorMessage = JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          controller.enqueue(new TextEncoder().encode(`data: ${errorMessage}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in POST handler:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
