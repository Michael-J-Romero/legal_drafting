/**
 * Example API route demonstrating OpenAI Responses API and model routing
 * This shows how to integrate the routing layer into existing LLM calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { getResponsesClient } from '@/lib/llm/openaiResponses';
import { ModelRouter } from '@/lib/llm/modelRouter';
import type { ProcessType } from '@/lib/settings';

export const runtime = 'nodejs';

interface RequestBody {
  message: string;
  processType?: ProcessType;
  forceModel?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { message, processType = 'general_chat', forceModel } = body;

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Use the model router to select the appropriate model
    const selection = ModelRouter.selectModel(
      processType,
      undefined,
      forceModel
    );

    console.log(`[LLM Example] Selected model: ${selection.model}`);
    console.log(`[LLM Example] Is quick model: ${selection.isQuickModel}`);
    console.log(`[LLM Example] Process type: ${processType}`);

    // Get the Responses API client
    const client = getResponsesClient();

    // Make the request
    const response = await client.createResponse({
      model: selection.model,
      input: [
        {
          role: 'user',
          content: message,
        },
      ],
      reasoning: selection.reasoning,
      text: selection.text,
    });

    // Return the response with metadata
    return NextResponse.json({
      response: response.output_text,
      metadata: {
        model: selection.model,
        isQuickModel: selection.isQuickModel,
        processType,
        usage: response.usage,
      },
    });
  } catch (error) {
    console.error('[LLM Example] Error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
