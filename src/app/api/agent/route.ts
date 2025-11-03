import { Agent, tool, run } from '@openai/agents';
import { z } from 'zod';
import { load as loadHtml } from 'cheerio';
import { ContextManager } from './contextManager';

// Use Node.js runtime for this route
export const runtime = 'nodejs';

// Context manager instance (in-memory, per-request)
// In production, you might want to use Redis or similar for persistence
let contextManager: ContextManager | null = null;

function getContextManager(): ContextManager {
  if (!contextManager) {
    contextManager = new ContextManager(4000); // Reduced from 8000 to 4000 tokens for safer context management
  }
  return contextManager;
}

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
    const { message, messages, clearContext } = body as {
      message?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string | number | Date }>;
      clearContext?: boolean;
    };

    // Get context manager instance
    const ctxManager = getContextManager();
    
    // Clear context if requested (new conversation)
    if (clearContext) {
      ctxManager.clear();
    }

    // Get the user's query
    const userQuery = message?.trim() || (messages && messages.length > 0 ? messages[messages.length - 1].content : '');
    
    if (!userQuery) {
      return new Response('Message or messages array is required', { status: 400 });
    }

    // Build optimized context using LangChain
    let inputText: string;
    const conversationHistory = Array.isArray(messages) ? messages : [];
    
    // For first message, skip context optimization to avoid overhead
    if (conversationHistory.length === 0) {
      inputText = userQuery;
    } else {
      try {
        // Get optimized context with semantic retrieval
        const { relevantResearch, conversationSummary, totalTokens } = await ctxManager.getOptimizedContext(
          userQuery,
          conversationHistory
        );
        
        // Build input with optimized context
        inputText = `Continuing conversation.

[Context - ${conversationHistory.length} messages, ~${totalTokens} tokens]
${conversationSummary}

${relevantResearch ? `[Research Context]\n${relevantResearch}\n\n` : ''}Query: ${userQuery}`;
        
        // Log context stats for debugging
        const stats = ctxManager.getStats();
        console.log(`[Context Manager] Documents: ${stats.documentCount}, Tokens: ${stats.totalTokensEstimate}, Request: ${totalTokens}`);
        
      } catch (error) {
        console.error('Error getting optimized context:', error);
        // Fallback to minimal context
        const transcript = conversationHistory.slice(-2) // Last 2 messages only
          .map((m) => {
            const content = m.content.substring(0, 500); // Truncate to 500 chars
            return `${m.role === 'user' ? 'User' : 'Assistant'}: ${content}${m.content.length > 500 ? '...' : ''}`;
          })
          .join('\n');
        inputText = `Recent context:\n\n${transcript}\n\nQuery: ${userQuery}`;
      }
    }

    // The OpenAI API key is automatically picked up from the OPENAI_API_KEY environment variable
    // Create the agent with tools
    const agent = new Agent({
      name: 'Research Assistant',
      model: 'gpt-4o-2024-11-20', // Latest GPT-4o with enhanced reasoning
  instructions: `You are a research assistant that shows transparent reasoning. Structure responses with these phases:

🤔 **THINKING:** Analyze the question, plan your approach
🔍 **RESEARCH:** Use tools, explain what you're searching for
🧐 **REFLECTION:** After research, state confidence (0-100%), identify gaps, decide if more research needed
💡 **SYNTHESIS:** Organize findings, identify patterns
✅ **ANSWER:** Clear response with citations

**Iterative Process:**
- After EACH research step, add REFLECTION
- If confidence < 85% or gaps exist, return to RESEARCH
- Continue until confidence >= 85% with no major gaps
- Be transparent about reasoning and uncertainty

**Research Phase:**
- Use search_web for queries
- Use browse for specific URLs (state: "BROWSING_URL: <url>")
- Summarize key findings

**Answer Phase:**
- Use headings and bullet points
- Include URLs for citations
- State final confidence level

Always use the emoji markers to help users follow your thinking.`,
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

          // Accumulate full response for context extraction
          let fullResponse = '';

          // Stream the response chunks
          for await (const chunk of result) {
            try {
              const data = JSON.stringify(chunk);
              controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
              
              // Accumulate text chunks for later processing
              if ('data' in chunk && chunk.data && typeof chunk.data === 'object') {
                if ('delta' in chunk.data && typeof chunk.data.delta === 'string') {
                  fullResponse += chunk.data.delta;
                } else if ('type' in chunk.data && chunk.data.type === 'output_text_delta' && 'delta' in chunk.data) {
                  fullResponse += (chunk.data as any).delta;
                }
              }
            } catch (chunkError) {
              console.error('Error processing chunk:', chunkError);
              // Continue processing other chunks
            }
          }

          // Extract and store research findings for future context retrieval
          // Only store if response isn't too large to avoid memory issues
          if (fullResponse && fullResponse.length < 50000) { // Limit to 50k chars
            try {
              ctxManager.extractResearchFindings(fullResponse);
            } catch (error) {
              console.error('Error extracting research findings:', error);
            }
          } else if (fullResponse.length >= 50000) {
            console.warn('Response too large to extract findings:', fullResponse.length);
          }

          controller.close();
        } catch (error) {
          console.error('Error during agent run:', error);
          
          // Handle context window exceeded error specifically
          let errorMsg = error instanceof Error ? error.message : 'Unknown error';
          if (errorMsg.includes('context window') || errorMsg.includes('exceeds')) {
            errorMsg = 'Context too large. Please start a new conversation or ask a simpler question.';
          }
          
          const errorMessage = JSON.stringify({ 
            error: errorMsg
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
