import { Agent, tool, run } from '@openai/agents';
import { z } from 'zod';

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
  selector: z.string().optional().describe('Optional CSS selector to extract specific content'),
});

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

// Browse tool implementation using Playwright via Browserless
async function browse(args: z.infer<typeof browseSchema>) {
  const browserlessWs = process.env.BROWSERLESS_WS;
  
  if (!browserlessWs) {
    throw new Error('BROWSERLESS_WS is not configured');
  }

  try {
    // Use dynamic import to avoid bundling playwright-core
    const { chromium } = await import('playwright-core');
    
    const browser = await chromium.connect(browserlessWs);
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(args.url, { waitUntil: 'networkidle' });
    
    let content;
    if (args.selector) {
      content = await page.locator(args.selector).textContent();
    } else {
      content = await page.content();
    }
    
    await browser.close();
    
    return JSON.stringify({
      url: args.url,
      content: content,
    });
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
  description: 'Browse a specific URL and extract its content using Playwright',
  parameters: browseSchema,
  execute: browse,
});

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

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

Be thorough but concise in your research.`,
      tools: [searchWebTool, browseTool],
    });

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Run the agent with streaming
          const result = await run(agent, message, {
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
