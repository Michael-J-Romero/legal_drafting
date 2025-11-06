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

// Helper function to truncate text intelligently
function truncateText(text: string, maxChars: number = 2000): string {
  if (text.length <= maxChars) return text;
  
  // Try to truncate at sentence boundary
  const truncated = text.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutoff = Math.max(lastPeriod, lastNewline);
  
  if (cutoff > maxChars * 0.8) {
    return truncated.substring(0, cutoff + 1) + '\n[...truncated for brevity]';
  }
  
  return truncated + '...[truncated]';
}

// Helper function to extract main content from HTML body text
function extractMainContent(bodyText: string): string {
  // Remove excessive whitespace
  let cleaned = bodyText.replace(/\s+/g, ' ').trim();
  
  // Remove common navigation/footer patterns
  cleaned = cleaned.replace(/\b(cookie|privacy policy|terms of service|all rights reserved|copyright|subscribe|newsletter|sign up|log in|menu|navigation)\b/gi, '');
  
  // If still too long, take first meaningful chunk
  if (cleaned.length > 3000) {
    // Try to find main content sections (paragraphs)
    const sentences = cleaned.split(/[.!?]+\s+/);
    let result = '';
    let tokenCount = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = estimateTokens(sentence);
      if (tokenCount + sentenceTokens > 750) break; // Max ~750 tokens
      result += sentence + '. ';
      tokenCount += sentenceTokens;
    }
    
    return result.trim() + '\n[...content truncated to save tokens]';
  }
  
  return cleaned;
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
        include_answer: true, // Get AI-generated answer summary
        include_raw_content: false, // Don't include full page content
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Format results in a concise, token-efficient way
    const results = (data.results || []).map((result: any, idx: number) => {
      // Truncate each result's content to avoid token bloat
      const content = result.content ? truncateText(result.content, 500) : '';
      return {
        position: idx + 1,
        title: result.title || 'No title',
        url: result.url || '',
        snippet: content,
        score: result.score || 0
      };
    });
    
    // Build optimized response
    const summary = {
      query: args.query,
      answer: data.answer || 'No summary available', // AI-generated answer from Tavily
      top_results: results.slice(0, 3), // Only top 3 results
      total_found: results.length
    };
    
    console.log(`[SEARCH] Query: "${args.query}" - Found ${results.length} results, returning top 3`);
    return JSON.stringify(summary, null, 2);
  } catch (error) {
    console.error('Error in searchWeb:', error);
    throw error;
  }
}

// Browse tool using simple HTTP fetch + Cheerio (no Browserless/Playwright)
// Optimized to return only relevant content summaries instead of full page source
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

    let extractedContent: string;
    let metadata: any = {
      url: args.url,
      contentType: contentType
    };

    if (isHtml) {
      const $ = loadHtml(html);
      
      // Extract metadata
      metadata.title = $('title').text().trim() || 'No title';
      metadata.description = $('meta[name="description"]').attr('content') || 
                            $('meta[property="og:description"]').attr('content') || '';
      
      // If selector provided, use it
      if (args.selector && args.selector.trim() !== '') {
        const sel = $(args.selector);
        extractedContent = sel.length ? sel.text().trim() : 'Selector matched no elements';
      } else {
        // Intelligent content extraction
        // Try to find main content areas
        const mainContent = $('main').text() || 
                          $('article').text() || 
                          $('#content').text() || 
                          $('.content').text() || 
                          $('body').text();
        
        // Remove script and style content
        $('script, style, nav, header, footer, aside').remove();
        
        extractedContent = extractMainContent(mainContent.replace(/\s+/g, ' ').trim());
      }
    } else {
      // Non-HTML content - just truncate
      extractedContent = truncateText(html, 1000);
    }

    // Build optimized response
    const optimizedResponse = {
      ...metadata,
      content: extractedContent,
      contentLength: extractedContent.length,
      estimatedTokens: estimateTokens(extractedContent),
      note: 'Content has been optimized to show only relevant information'
    };

    console.log(`[BROWSE] URL: ${args.url} - Extracted ${extractedContent.length} chars (~${estimateTokens(extractedContent)} tokens)`);
    return JSON.stringify(optimizedResponse, null, 2);
  } catch (error) {
    console.error('Error in browse:', error);
    throw error;
  }
}

// Create tools using the tool helper
const searchWebTool = tool({
  name: 'search_web',
  description: 'Search the web using Tavily API. Returns an AI-generated answer summary and top 3 most relevant results with snippets. Optimized to minimize token usage while providing key information.',
  parameters: searchWebSchema,
  execute: searchWeb,
});

const browseTool = tool({
  name: 'browse',
  description: 'Fetch and extract relevant content from a URL. Automatically extracts main content (articles, main sections) and returns optimized summaries instead of full page source. Use CSS selector parameter to target specific elements if needed.',
  parameters: browseSchema,
  execute: browse,
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

    // Detect if we're using a reasoning model (GPT-5, o1 series)
    // These models have their own internal reasoning capabilities:
    // - They do their own "thinking" and "reasoning" internally
    // - Each internal reasoning step counts as a "turn" in the OpenAI Agents SDK
    // - The default maxTurns of 10 is too low, causing "Max turns exceeded" errors
    // 
    // Solution:
    // - Increase maxTurns to 100 to accommodate their internal reasoning process
    // - Simplify agent instructions to avoid forcing multi-phase structure
    // - Let the model use its own reasoning to determine the best approach
    const isReasoningModel = agentSettings.model.includes('gpt-5') || 
                            agentSettings.model.includes('o1') ||
                            agentSettings.model.includes('o3');

    console.log(`[MODEL] Using model: ${agentSettings.model}`);
    console.log(`[MODEL] Is reasoning model: ${isReasoningModel}`);

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
    
    // Different instructions for reasoning models vs regular models
    // Reasoning models (GPT-5, o1) have their own internal reasoning, so we simplify the instructions
    // and do step-by-step orchestration on our end
    let agentInstructions: string;
    
    if (isReasoningModel) {
      // For reasoning models: simplified instructions for single-step tasks
      // The orchestration logic will call this multiple times for different phases
      agentInstructions = `You are a research assistant. Use your reasoning capabilities to help answer the user's question.

**Tools Available:**
- search_web: Search the web for information (returns AI-generated summary + top 3 results)
- browse: Fetch content from a specific URL (returns optimized, relevant content)

**Your Task:**
Respond to the user's query in a clear, well-structured way. If you need to research something, use the tools available. Include source citations when relevant.

**Important:** Focus on providing thorough, detailed responses with specific information - dates, names, locations, requirements, deadlines, etc. These details will be automatically captured as notes for the user.

Keep responses under ${agentSettings.maxResponseLength} characters.`;
    } else {
      // For regular models: detailed multi-phase instructions
      agentInstructions = `You are a research assistant that shows transparent reasoning. Structure responses with these phases:

🤔 **THINKING:** Analyze the question, plan your approach (${verbosityGuidance})
🔍 **RESEARCH:** Use tools, explain what you're searching for. Note: Tools return pre-optimized summaries to save tokens - you receive only relevant info, not full pages. (${agentSettings.summaryMode === 'brief' ? 'mention key findings very briefly' : agentSettings.summaryMode === 'detailed' ? 'describe findings in detail' : 'concisely mention key findings'})
🧐 **REFLECTION:** After research, state confidence (0-100%), identify gaps (${agentSettings.summaryMode === 'brief' ? 'keep minimal' : 'keep brief'})
💡 **SYNTHESIS:** Organize findings, identify patterns (${agentSettings.summaryMode === 'detailed' ? 'comprehensive summary' : 'concise summary'})
✅ **ANSWER:** Clear response with citations

**Important:** After you complete your response, an intelligent AI system will automatically analyze your entire response (including all research, thinking, and answers) to extract noteworthy facts for the user's reference. Focus on providing thorough, detailed responses with specific information - dates, names, locations, requirements, deadlines, etc. - as these will be automatically captured as notes for the user.

**Iterative Process:**
- After EACH research step, add REFLECTION
- Limit to ${agentSettings.maxIterations} research iterations maximum
- If confidence < ${agentSettings.confidenceThreshold}% or critical gaps exist, do ONE more research iteration
- ${verbosityGuidance}

**Research Phase:**
- Use search_web for queries - it returns an AI summary + top 3 results with snippets (already optimized)
- Use browse for specific URLs - it returns only relevant content, not full page source (already optimized)
- The tools handle optimization - you receive pre-processed, token-efficient summaries
- Focus on extracting insights from the optimized data you receive

**Answer Phase:**
- Use headings and bullet points
- Include ${agentSettings.summaryMode === 'brief' ? 'only essential URLs' : agentSettings.summaryMode === 'detailed' ? 'all relevant URLs with context' : 'key URLs'}
- State final confidence level
- Be specific with details - dates, names, locations, requirements, deadlines - as these are automatically captured for the user
- Keep total response under ${agentSettings.maxResponseLength} characters

Always use the emoji markers to help users follow your thinking.`;
    }

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
          // For reasoning models, increase maxTurns significantly or remove the limit
          // This allows the model to do its own internal reasoning without hitting the turn limit
          // For regular models, use a moderate maxTurns limit
          const maxTurns = isReasoningModel ? 100 : 25;
          
          console.log(`[AGENT] Using maxTurns: ${maxTurns} (reasoning model: ${isReasoningModel})`);
          
          // Run the agent with streaming
          const result = await run(agent, inputText, {
            stream: true,
            maxTurns: maxTurns,
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
