import { Agent, tool, run } from '@openai/agents';
import { z } from 'zod';
import { load as loadHtml } from 'cheerio';

// Use Node.js runtime for this route
export const runtime = 'nodejs';

// Schema definitions for request validation and tools
const conversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string().optional(),
});

const conversationRequestSchema = z.object({
  message: z.string(),
  messages: z.array(conversationMessageSchema).optional(),
});

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
    const parsed = conversationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { message, messages = [] } = parsed.data;

    if (!message) {
      return new Response('Message is required', { status: 400 });
    }

    // The OpenAI API key is automatically picked up from the OPENAI_API_KEY environment variable
    // Create the agent with tools
    const agent = new Agent({
      name: 'Research Assistant',
      model: 'gpt-4o',
  instructions: `You are a helpful research assistant that can search the web and browse websites to gather information. 
      
When the user asks you to research a topic:
1. Use the search_web tool to find relevant sources
2. Use the browse tool to extract detailed information from promising URLs
3. Synthesize the information into a clear, well-organized response
4. Always cite your sources with URLs

Be thorough but concise in your research.

Important: Each time you call the browse tool, first emit a line in your response in the exact format:
"BROWSING_URL: <the exact URL you are opening>"
This helps the UI follow along.`,
      tools: [searchWebTool, browseTool],
    });

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Build agent input that includes serialized conversation history
          let agentInput = message;

          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const previousMessages = messages.slice(0, -1);
            const historyText = previousMessages
              .map((msg) => `${msg.role === 'assistant' ? 'Assistant' : 'User'}: ${msg.content}`)
              .join('\n');

            const historyPrefix = historyText
              ? `Conversation so far:\n${historyText}\n\n`
              : '';

            if (lastMessage.role === 'user') {
              agentInput = `${historyPrefix}Respond to the latest user message while keeping the previous context in mind.\n\nLatest user message:\n${lastMessage.content}`;
            } else {
              agentInput = `${historyPrefix}Continue the conversation based on the latest message below.\n\n${
                lastMessage.role === 'assistant' ? 'Assistant' : 'User'
              } message:\n${lastMessage.content}`;
            }
          }

          // Run the agent with streaming
          const result = await run(agent, agentInput, {
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
