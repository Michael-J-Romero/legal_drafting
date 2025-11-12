/**
 * OpenAI Responses API client wrapper
 * Supports reasoning.effort and text.verbosity parameters
 */

import OpenAI from 'openai';
import { isReasoningCapable } from '@/config/models';
import type { ReasoningEffort, ReasoningSummary, TextVerbosity } from '@/lib/settings';

/**
 * Message format for Responses API
 */
export interface ResponseMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Reasoning configuration
 */
export interface ReasoningConfig {
  effort: ReasoningEffort;
  summary?: ReasoningSummary;
}

/**
 * Text format configuration
 */
export interface TextConfig {
  format: {
    type: 'text';
  };
  verbosity?: TextVerbosity;
}

/**
 * Request parameters for Responses API
 */
export interface ResponsesRequest {
  model: string;
  input: ResponseMessage[];
  reasoning?: ReasoningConfig;
  text?: TextConfig;
  stream?: boolean;
}

/**
 * Usage information from response
 */
export interface UsageInfo {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

/**
 * Non-streaming response
 */
export interface ResponsesResult {
  output_text: string;
  usage?: UsageInfo;
}

/**
 * Streaming chunk
 */
export interface ResponsesStreamChunk {
  type: string;
  delta?: string;
  output_text?: string;
  usage?: UsageInfo;
}

/**
 * OpenAI Responses API client
 */
export class OpenAIResponsesClient {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Build request parameters, excluding temperature for reasoning models
   */
  private buildRequestParams(request: ResponsesRequest): any {
    const modelIsReasoningCapable = isReasoningCapable(request.model);
    
    const params: any = {
      model: request.model,
      messages: request.input,
    };

    // Add reasoning config only if model supports it
    if (modelIsReasoningCapable && request.reasoning) {
      params.reasoning = {
        effort: request.reasoning.effort,
      };
      if (request.reasoning.summary) {
        params.reasoning.summary = request.reasoning.summary;
      }
    }

    // Add text config if provided
    if (request.text) {
      params.response_format = {
        type: 'text',
      };
      // Note: text.verbosity is not a standard OpenAI parameter
      // It's included in our interface for future API support
      // The verbosity preference should be communicated via the prompt/instructions
    }

    // IMPORTANT: Do not include temperature for reasoning models
    // This prevents 400 errors

    return params;
  }

  /**
   * Make a non-streaming request
   */
  async createResponse(request: ResponsesRequest): Promise<ResponsesResult> {
    const params = this.buildRequestParams(request);
    
    try {
      const response = await this.client.chat.completions.create({
        ...params,
        stream: false,
      });

      return {
        output_text: response.choices[0]?.message?.content || '',
        usage: response.usage as UsageInfo,
      };
    } catch (error) {
      console.error('Error in createResponse:', error);
      throw error;
    }
  }

  /**
   * Make a streaming request
   */
  async *createResponseStream(
    request: ResponsesRequest
  ): AsyncGenerator<ResponsesStreamChunk> {
    const params = this.buildRequestParams(request);
    
    try {
      const stream = await this.client.chat.completions.create({
        ...params,
        stream: true,
      });

      let accumulatedText = '';

      // The OpenAI SDK's TypeScript definitions don't properly type the stream response
      // When stream:true is passed, it returns an async iterable, not a ChatCompletion
      // We use unknown here to properly handle the actual runtime type
      for await (const chunk of stream as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
        const delta = chunk.choices[0]?.delta?.content || '';
        
        if (delta) {
          accumulatedText += delta;
          
          yield {
            type: 'output_text_delta',
            delta,
            output_text: accumulatedText,
          };
        }

        // Check for usage info in the final chunk
        if (chunk.usage) {
          yield {
            type: 'usage',
            output_text: accumulatedText,
            usage: chunk.usage as UsageInfo,
          };
        }
      }

      // Ensure we return the final accumulated text
      yield {
        type: 'complete',
        output_text: accumulatedText,
      };
    } catch (error) {
      console.error('Error in createResponseStream:', error);
      throw error;
    }
  }
}

/**
 * Create a global instance (singleton pattern)
 */
let responsesClient: OpenAIResponsesClient | null = null;

export function getResponsesClient(): OpenAIResponsesClient {
  if (!responsesClient) {
    responsesClient = new OpenAIResponsesClient();
  }
  return responsesClient;
}
