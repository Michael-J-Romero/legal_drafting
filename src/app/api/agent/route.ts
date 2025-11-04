import { Agent, tool, run } from '@openai/agents';
import { z } from 'zod';
import { load as loadHtml } from 'cheerio';
import { ContextManager } from './contextManager';

// Use Node.js runtime for this route
export const runtime = 'nodejs';

// Context manager instance (in-memory, per-request)
// In production, you might want to use Redis or similar for persistence
let contextManager: ContextManager | null = null;

// Type definitions for usage data
interface TokenUsageBreakdown {
  userPromptTokens: number;
  conversationContextTokens: number;
  researchContextTokens: number;
  systemInstructionsTokens: number;
  storedDocumentsCount: number;
  storedDocumentsTokens: number;
}

interface UsageData {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputTokensDetails?: Record<string, number>;
  outputTokensDetails?: Record<string, number>;
}

// Helper function to estimate tokens from text
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

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
    
    // Track token breakdown for detailed usage stats
    let contextBreakdown = {
      userPromptTokens: 0,
      conversationContextTokens: 0,
      researchContextTokens: 0,
      systemInstructionsTokens: 0,
      storedDocumentsCount: 0,
      storedDocumentsTokens: 0,
    };
    
    console.log('\n========== AGENT REQUEST DEBUG ==========');
    console.log(`[REQUEST] User query length: ${userQuery.length} chars`);
    console.log(`[REQUEST] Conversation history: ${conversationHistory.length} messages`);
    
    // Calculate user prompt tokens
    contextBreakdown.userPromptTokens = estimateTokens(userQuery);
    
    // For first message, skip context optimization to avoid overhead
    if (conversationHistory.length === 0) {
      inputText = userQuery;
      console.log(`[REQUEST] First message - no context optimization`);
      console.log(`[REQUEST] Input text length: ${inputText.length} chars (~${estimateTokens(inputText)} tokens)`);
    } else {
      try {
        // Get optimized context with semantic retrieval
        const { relevantResearch, conversationSummary, totalTokens } = await ctxManager.getOptimizedContext(
          userQuery,
          conversationHistory
        );
        
        // Update context breakdown
        contextBreakdown.conversationContextTokens = estimateTokens(conversationSummary);
        contextBreakdown.researchContextTokens = relevantResearch ? estimateTokens(relevantResearch) : 0;
        
        // Get stored documents stats
        const stats = ctxManager.getStats();
        contextBreakdown.storedDocumentsCount = stats.documentCount;
        contextBreakdown.storedDocumentsTokens = stats.totalTokensEstimate;
        
        console.log(`[CONTEXT] Summary tokens: ${totalTokens}`);
        console.log(`[CONTEXT] Summary length: ${conversationSummary.length} chars`);
        console.log(`[CONTEXT] Research context: ${relevantResearch ? relevantResearch.length : 0} chars`);
        
        // Build input with optimized context
        inputText = `Continuing conversation.

[Context - ${conversationHistory.length} messages, ~${totalTokens} tokens]
${conversationSummary}

${relevantResearch ? `[Research Context]\n${relevantResearch}\n\n` : ''}Query: ${userQuery}`;
        
        console.log(`[REQUEST] Input text length: ${inputText.length} chars (~${estimateTokens(inputText)} tokens)`);
        
        // Log context stats for debugging
        console.log(`[Context Manager] Documents: ${stats.documentCount}, Total tokens estimate: ${stats.totalTokensEstimate}, Request tokens: ${totalTokens}`);
        
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
        console.log(`[FALLBACK] Input text length: ${inputText.length} chars (~${estimateTokens(inputText)} tokens)`);
      }
    }

    // The OpenAI API key is automatically picked up from the OPENAI_API_KEY environment variable
    // Create the agent with tools
    const agentInstructions = `You are a research assistant that shows transparent reasoning. Structure responses with these phases:

🤔 **THINKING:** Analyze the question, plan your approach (be concise, 2-3 sentences)
🔍 **RESEARCH:** Use tools, explain what you're searching for (summarize findings briefly)
🧐 **REFLECTION:** After research, state confidence (0-100%), identify gaps (keep brief)
💡 **SYNTHESIS:** Organize findings, identify patterns (concise summary)
✅ **ANSWER:** Clear response with citations

**Iterative Process:**
- After EACH research step, add REFLECTION
- Limit to 2-3 research iterations maximum to stay concise
- If confidence < 85% or critical gaps exist, do ONE more research iteration
- Be transparent but concise - avoid overly verbose explanations

**Research Phase:**
- Use search_web for queries
- Use browse for specific URLs (state: "BROWSING_URL: <url>")
- Summarize ONLY the most relevant findings (not everything)

**Answer Phase:**
- Use headings and bullet points
- Include key URLs only (not every single source)
- State final confidence level
- Keep total response under 10,000 characters

Always use the emoji markers to help users follow your thinking.`;

    // Calculate system instructions tokens
    contextBreakdown.systemInstructionsTokens = estimateTokens(agentInstructions);

    console.log(`[AGENT] Instructions length: ${agentInstructions.length} chars (~${estimateTokens(agentInstructions)} tokens)`);
    console.log(`[AGENT] Estimated total input tokens: ~${estimateTokens(agentInstructions + inputText)}`);
    console.log(`[AGENT] Model: gpt-4o-2024-11-20`);
    console.log('=========================================\n');

    const agent = new Agent({
      name: 'Research Assistant',
      model: 'gpt-4o-2024-11-20', // Latest GPT-4o with enhanced reasoning
      instructions: agentInstructions,
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
          let responseTooLarge = false;
          const MAX_RESPONSE_LENGTH = 200000; // 200k chars max (~50k tokens)
          let usageData: UsageData | null = null;

          // Stream the response chunks
          for await (const chunk of result) {
            try {
              const data = JSON.stringify(chunk);
              controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
              
              // Debug: Log chunk type
              if ('type' in chunk) {
                console.log(`[BACKEND] Chunk type: ${chunk.type}`);
              }
              
              // Capture usage data from response.completed event within raw_model_stream_event
              if ('type' in chunk && chunk.type === 'raw_model_stream_event' && 'data' in chunk) {
                const eventData = chunk.data as any;
                
                // Log the event type within raw_model_stream_event
                if (eventData.type) {
                  console.log(`[BACKEND] raw_model_stream_event contains: ${eventData.type}`);
                }
                
                // Check if this is a response.completed event with usage data
                if (eventData.type === 'response.completed' && eventData.response && eventData.response.usage) {
                  const rawUsage = eventData.response.usage;
                  usageData = {
                    inputTokens: rawUsage.input_tokens || 0,
                    outputTokens: rawUsage.output_tokens || 0,
                    totalTokens: rawUsage.total_tokens || 0,
                    inputTokensDetails: rawUsage.input_tokens_details,
                    outputTokensDetails: rawUsage.output_tokens_details,
                  };
                  console.log('[BACKEND] ✅ Usage data captured from response.completed:', JSON.stringify(usageData, null, 2));
                }
                
                // Accumulate text chunks for later processing
                if (eventData.type === 'output_text_delta' && eventData.delta) {
                  fullResponse += String(eventData.delta || '');
                }
              }
              
              // Also check for text deltas at the top level (older format)
              if ('data' in chunk && chunk.data && typeof chunk.data === 'object') {
                const chunkData = chunk.data as any;
                if (chunkData.type === 'output_text_delta' && 'delta' in chunkData) {
                  fullResponse += String(chunkData.delta || '');
                }
              }
              
              // Check if response is getting too large
              if (fullResponse.length > MAX_RESPONSE_LENGTH && !responseTooLarge) {
                console.warn(`[RESPONSE] Response exceeding max length (${fullResponse.length} chars), stopping accumulation`);
                responseTooLarge = true;
                // Continue streaming but stop accumulating
                fullResponse = fullResponse.substring(0, MAX_RESPONSE_LENGTH);
              }
            } catch (chunkError) {
              console.error('Error processing chunk:', chunkError);
              // Continue processing other chunks
            }
          }
          
          // Send usage summary at the end if available
          if (usageData) {
            console.log('[BACKEND] ✅ Sending usage summary:', JSON.stringify(usageData, null, 2));
            console.log('[BACKEND] ✅ Context breakdown:', JSON.stringify(contextBreakdown, null, 2));
            const usageSummary = JSON.stringify({
              type: 'usage_summary',
              data: {
                ...usageData,
                breakdown: contextBreakdown
              }
            });
            controller.enqueue(new TextEncoder().encode(`data: ${usageSummary}\n\n`));
            console.log('[BACKEND] ✅ Usage summary sent to client');
          } else {
            console.log('[BACKEND] ⚠️ No usage data captured - usage summary not sent');
          }

          // Extract and store research findings for future context retrieval
          // Only store if response isn't too large to avoid memory issues
          console.log(`\n[RESPONSE] Full response length: ${fullResponse.length} chars (~${estimateTokens(fullResponse)} tokens)`);
          
          if (fullResponse && fullResponse.length < 50000) { // Limit to 50k chars
            try {
              ctxManager.extractResearchFindings(fullResponse);
              console.log(`[RESPONSE] Research findings extracted and stored`);
            } catch (error) {
              console.error('[RESPONSE] Error extracting research findings:', error);
            }
          } else if (fullResponse.length >= 50000) {
            console.warn(`[RESPONSE] Response too large to extract findings: ${fullResponse.length} chars`);
          }

          console.log('=========================================\n');
          controller.close();
        } catch (error) {
          console.error('\n========== AGENT ERROR ==========');
          console.error('[ERROR] Error during agent run:', error);
          console.error('[ERROR] Error type:', error?.constructor?.name);
          if (error instanceof Error) {
            console.error('[ERROR] Error message:', error.message);
            console.error('[ERROR] Error stack:', error.stack);
          }
          console.error('=================================\n');
          
          // Handle context window exceeded error specifically
          let errorMsg = error instanceof Error ? error.message : 'Unknown error';
          if (errorMsg.includes('context window') || errorMsg.includes('exceeds') || errorMsg.includes('too large')) {
            console.log(`[ERROR] Context window error detected. Original message: ${errorMsg}`);
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
