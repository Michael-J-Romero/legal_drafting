import { Agent, tool, run } from '@openai/agents';
import { z } from 'zod';
import { load as loadHtml } from 'cheerio';
import { ContextManager } from './contextManager';
import OpenAI from 'openai';

// Use Node.js runtime for this route
export const runtime = 'nodejs';

// OpenAI client instance (lazy-initialized to avoid build-time errors)
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Context manager instance (in-memory, per-request)
// In production, you might want to use Redis or similar for persistence
let contextManager: ContextManager | null = null;

// Type definitions for usage data
interface TokenUsageBreakdown {
  userPromptTokens: number;
  conversationContextTokens: number;
  researchContextTokens: number;
  systemInstructionsTokens: number;
  toolDefinitionsTokens: number;
  formattingOverheadTokens: number;
  storedDocumentsCount: number;
  storedDocumentsTokens: number;
}

interface UsageData {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputTokensDetails?: Array<Record<string, number>>;
  outputTokensDetails?: Array<Record<string, number>>;
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

// Browse tool using simple HTTP fetch + Cheerio + AI summarization
// This version fetches the webpage and uses a separate AI call to summarize it
// based on the user's query, preventing context overload
async function browse(args: z.infer<typeof browseSchema>, userQuery: string) {
  try {
    console.log(`[BROWSE] Fetching URL: ${args.url}`);
    
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

    // If content is too large, truncate before summarization
    // Using 50,000 chars which equals ~12,500 tokens (at 4 chars/token ratio)
    const MAX_CONTENT_LENGTH = 50000;
    if (content && content.length > MAX_CONTENT_LENGTH) {
      console.log(`[BROWSE] Content too large (${content.length} chars), truncating to ${MAX_CONTENT_LENGTH}`);
      content = content.substring(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated due to length]';
    }

    console.log(`[BROWSE] Content extracted: ${content?.length || 0} chars (~${estimateTokens(content || '')} tokens)`);

    // Use AI to summarize the webpage content based on the user's query
    // This prevents flooding the main agent's context with raw webpage text
    if (content && content.length > 1000) {
      const queryPreview = userQuery.length > 0 
        ? userQuery.substring(0, 100) + (userQuery.length > 100 ? '...' : '')
        : '(no query context)';
      console.log(`[BROWSE] Summarizing content with AI (user query: "${queryPreview}")`);
      
      try {
        const openaiClient = getOpenAIClient();
        const summaryResponse = await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini', // Use faster, cheaper model for summarization
          messages: [
            {
              role: 'system',
              content: 'You are a web content summarizer. Extract and summarize ONLY the information relevant to the user\'s query. Be concise but comprehensive. Focus on facts, data, and key points that would help answer the query.'
            },
            {
              role: 'user',
              content: `User Query: ${userQuery}
              
Webpage URL: ${args.url}

Webpage Content:
${content}

Task: Summarize this webpage, focusing ONLY on information relevant to answering the user's query. Include specific facts, data, quotes, and key points. Keep the summary under 1000 words.`
            }
          ],
          temperature: 0.3,
          max_tokens: 2000, // Limit summary to ~2k tokens
        });

        const summary = summaryResponse.choices[0]?.message?.content || content;
        console.log(`[BROWSE] AI summary generated: ${summary.length} chars (~${estimateTokens(summary)} tokens)`);
        
        return JSON.stringify({ 
          url: args.url, 
          summary: summary,
          note: 'Content summarized by AI to focus on query-relevant information'
        });
      } catch (summaryError) {
        console.error('[BROWSE] Error during summarization, falling back to truncated content:', summaryError);
        // Fallback: return truncated content if summarization fails
        const truncated = content.substring(0, 5000);
        return JSON.stringify({ 
          url: args.url, 
          content: truncated,
          note: 'Summarization failed, content truncated to 5000 chars'
        });
      }
    }

    // For short content, return as-is
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, messages, clearContext, settings } = body as {
      message?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string | number | Date }>;
      clearContext?: boolean;
      settings?: {
        maxIterations?: number;
        confidenceThreshold?: number;
        maxResponseLength?: number;
        contextWindowSize?: number;
        summaryMode?: 'brief' | 'balanced' | 'detailed';
        model?: string;
      };
    };
    
    // Apply settings with defaults
    const agentSettings = {
      maxIterations: settings?.maxIterations ?? 3,
      confidenceThreshold: settings?.confidenceThreshold ?? 85,
      maxResponseLength: settings?.maxResponseLength ?? 10000,
      contextWindowSize: settings?.contextWindowSize ?? 4000,
      summaryMode: settings?.summaryMode ?? 'balanced',
      model: settings?.model ?? 'gpt-4o-2024-11-20'
    };

    // Get context manager instance with configured context window
    const ctxManager = new ContextManager(agentSettings.contextWindowSize);
    
    // Clear context if requested (new conversation)
    if (clearContext) {
      ctxManager.clear();
    }

    // Get the user's query
    const userQuery = message?.trim() || (messages && messages.length > 0 ? messages[messages.length - 1].content : '');
    
    if (!userQuery) {
      return new Response('Message or messages array is required', { status: 400 });
    }

    // Create browse tool with userQuery captured in closure (avoids race conditions)
    const browseTool = tool({
      name: 'browse',
      description: 'Fetch a URL and get an AI-generated summary of content relevant to the current query. Content is automatically summarized to prevent context overload.',
      parameters: browseSchema,
      execute: (args: z.infer<typeof browseSchema>) => browse(args, userQuery),
    });

    // Build optimized context using LangChain
    let inputText: string;
    const conversationHistory = Array.isArray(messages) ? messages : [];
    
    // Track token breakdown for detailed usage stats
    let contextBreakdown = {
      userPromptTokens: 0,
      conversationContextTokens: 0,
      researchContextTokens: 0,
      systemInstructionsTokens: 0,
      toolDefinitionsTokens: 0,
      formattingOverheadTokens: 0,
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
        
        // Calculate formatting overhead (labels, prefixes, structure)
        const rawContentTokens = contextBreakdown.userPromptTokens + 
                                 contextBreakdown.conversationContextTokens + 
                                 contextBreakdown.researchContextTokens;
        const actualInputTextTokens = estimateTokens(inputText);
        contextBreakdown.formattingOverheadTokens = Math.max(0, actualInputTextTokens - rawContentTokens);
        
        console.log(`[REQUEST] Input text length: ${inputText.length} chars (~${estimateTokens(inputText)} tokens)`);
        console.log(`[REQUEST] Formatting overhead: ~${contextBreakdown.formattingOverheadTokens} tokens`);
        
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
    const verbosityGuidance = agentSettings.summaryMode === 'brief' 
      ? 'Be extremely concise - 1-2 sentences per phase maximum.'
      : agentSettings.summaryMode === 'detailed'
      ? 'Provide comprehensive explanations with detailed reasoning.'
      : 'Balance conciseness with clarity - 2-3 sentences per phase.';
    
    const agentInstructions = `You are a research assistant that shows transparent reasoning. Structure responses with these phases:

🤔 **THINKING:** Analyze the question, plan your approach (${verbosityGuidance})
🔍 **RESEARCH:** Use tools, explain what you're searching for (summarize findings ${agentSettings.summaryMode === 'brief' ? 'very briefly' : agentSettings.summaryMode === 'detailed' ? 'in detail' : 'concisely'})
🧐 **REFLECTION:** After research, state confidence (0-100%), identify gaps (${agentSettings.summaryMode === 'brief' ? 'keep minimal' : 'keep brief'})
💡 **SYNTHESIS:** Organize findings, identify patterns (${agentSettings.summaryMode === 'detailed' ? 'comprehensive summary' : 'concise summary'})
✅ **ANSWER:** Clear response with citations

**Iterative Process:**
- After EACH research step, add REFLECTION
- Limit to ${agentSettings.maxIterations} research iterations maximum
- If confidence < ${agentSettings.confidenceThreshold}% or critical gaps exist, do ONE more research iteration
- ${verbosityGuidance}

**Research Phase:**
- Use search_web for queries
- Use browse for specific URLs (state: "BROWSING_URL: <url>")
- Summarize ${agentSettings.summaryMode === 'brief' ? 'ONLY the most critical findings' : agentSettings.summaryMode === 'detailed' ? 'all relevant findings comprehensively' : 'the most relevant findings'}

**Answer Phase:**
- Use headings and bullet points
- Include ${agentSettings.summaryMode === 'brief' ? 'only essential URLs' : agentSettings.summaryMode === 'detailed' ? 'all relevant URLs with context' : 'key URLs'}
- State final confidence level
- Keep total response under ${agentSettings.maxResponseLength} characters

Always use the emoji markers to help users follow your thinking.`;

    // Calculate system instructions tokens
    contextBreakdown.systemInstructionsTokens = estimateTokens(agentInstructions);
    
    // Estimate tool definitions tokens (search_web and browse tools)
    // Tool definitions include schema, descriptions, parameters, etc.
    const toolDefinitionsEstimate = JSON.stringify({
      searchWebSchema: {
        name: 'search_web',
        description: 'Search the web for information',
        parameters: searchWebSchema.shape
      },
      browseSchema: {
        name: 'browse',
        description: 'Browse a specific URL',
        parameters: browseSchema.shape
      }
    });
    contextBreakdown.toolDefinitionsTokens = estimateTokens(toolDefinitionsEstimate);

    console.log(`[AGENT] Instructions length: ${agentInstructions.length} chars (~${estimateTokens(agentInstructions)} tokens)`);
    console.log(`[AGENT] Tool definitions estimate: ~${contextBreakdown.toolDefinitionsTokens} tokens`);
    console.log(`[AGENT] Estimated total input tokens: ~${estimateTokens(agentInstructions + inputText)}`);
    console.log(`[AGENT] Model: ${agentSettings.model}`);
    console.log(`[AGENT] Settings: max_iterations=${agentSettings.maxIterations}, confidence=${agentSettings.confidenceThreshold}%, mode=${agentSettings.summaryMode}, max_length=${agentSettings.maxResponseLength}`);
    console.log('=========================================\n');

    const agent = new Agent({
      name: 'Research Assistant',
      model: agentSettings.model,
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
          
          // After streaming completes, check if we can get usage from result.rawResponses
          if (!usageData && result.rawResponses && result.rawResponses.length > 0) {
            console.log('[BACKEND] Checking rawResponses for usage data');
            const lastResponse = result.rawResponses[result.rawResponses.length - 1];
            if (lastResponse && lastResponse.usage) {
              console.log('[BACKEND] Found usage in rawResponses:', JSON.stringify(lastResponse.usage, null, 2));
              usageData = {
                inputTokens: lastResponse.usage.inputTokens || 0,
                outputTokens: lastResponse.usage.outputTokens || 0,
                totalTokens: lastResponse.usage.totalTokens || 0,
                inputTokensDetails: lastResponse.usage.inputTokensDetails,
                outputTokensDetails: lastResponse.usage.outputTokensDetails,
              };
              console.log('[BACKEND] ✅ Usage data extracted from rawResponses:', JSON.stringify(usageData, null, 2));
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
