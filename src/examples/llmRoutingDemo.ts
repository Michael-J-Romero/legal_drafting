#!/usr/bin/env ts-node
/**
 * LLM Routing Demo
 * Demonstrates model routing between GPT-5 (deep reasoning) and quick models
 * 
 * Usage:
 *   OPENAI_API_KEY=your_key ts-node src/examples/llmRoutingDemo.ts
 */

import { OpenAIResponsesClient } from '../lib/llm/openaiResponses';
import { ModelRouter } from '../lib/llm/modelRouter';
import type { ProcessType } from '../lib/settings';

// Mock settings for the demo since we're running outside the browser
const mockSettings = {
  defaultModel: 'gpt-4o-2024-11-20', // Use GPT-4o as default (GPT-5 not yet available)
  reasoningEffort: 'high' as const,
  reasoningSummary: 'auto' as const,
  textVerbosity: 'medium' as const,
  quickModel: 'gpt-4o-mini',
  quickModelProcesses: ['notes_parallel', 'summarize_quick'] as ProcessType[],
};

async function demonstrateDeepReasoning() {
  console.log('\n========================================');
  console.log('DEMO 1: Deep Reasoning with Default Model');
  console.log('========================================\n');
  
  const client = new OpenAIResponsesClient();
  
  // Select model for general chat (uses default model)
  const selection = ModelRouter.selectModel('general_chat', mockSettings);
  
  console.log(`Selected Model: ${selection.model}`);
  console.log(`Is Quick Model: ${selection.isQuickModel}`);
  console.log(`Reasoning Config:`, selection.reasoning);
  console.log('\nPrompt: "Explain quantum entanglement in simple terms"\n');
  
  try {
    const response = await client.createResponse({
      model: selection.model,
      input: [
        {
          role: 'user',
          content: 'Explain quantum entanglement in simple terms',
        },
      ],
      reasoning: selection.reasoning,
      text: selection.text,
    });
    
    console.log('Response:');
    console.log(response.output_text);
    console.log('\nUsage:');
    console.log(`- Input tokens: ${response.usage?.prompt_tokens || 0}`);
    console.log(`- Output tokens: ${response.usage?.completion_tokens || 0}`);
    console.log(`- Total tokens: ${response.usage?.total_tokens || 0}`);
    if (response.usage?.completion_tokens_details?.reasoning_tokens) {
      console.log(`- Reasoning tokens: ${response.usage.completion_tokens_details.reasoning_tokens}`);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

async function demonstrateQuickSummary() {
  console.log('\n========================================');
  console.log('DEMO 2: Quick Summary with Quick Model');
  console.log('========================================\n');
  
  const client = new OpenAIResponsesClient();
  
  // Select model for quick summarization (uses quick model)
  const selection = ModelRouter.selectModel('summarize_quick', mockSettings);
  
  console.log(`Selected Model: ${selection.model}`);
  console.log(`Is Quick Model: ${selection.isQuickModel}`);
  console.log(`Reasoning Config:`, selection.reasoning);
  console.log('\nPrompt: "Summarize: The quick brown fox jumps over the lazy dog multiple times..."\n');
  
  const longText = 'The quick brown fox jumps over the lazy dog. '.repeat(20);
  
  try {
    const response = await client.createResponse({
      model: selection.model,
      input: [
        {
          role: 'user',
          content: `Summarize this text in one sentence: ${longText}`,
        },
      ],
      reasoning: selection.reasoning,
      text: selection.text,
    });
    
    console.log('Response:');
    console.log(response.output_text);
    console.log('\nUsage:');
    console.log(`- Input tokens: ${response.usage?.prompt_tokens || 0}`);
    console.log(`- Output tokens: ${response.usage?.completion_tokens || 0}`);
    console.log(`- Total tokens: ${response.usage?.total_tokens || 0}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

async function demonstrateStreaming() {
  console.log('\n========================================');
  console.log('DEMO 3: Streaming Response');
  console.log('========================================\n');
  
  const client = new OpenAIResponsesClient();
  
  // Select model for general chat
  const selection = ModelRouter.selectModel('general_chat', mockSettings);
  
  console.log(`Selected Model: ${selection.model}`);
  console.log('\nPrompt: "List 3 interesting facts about space"\n');
  console.log('Streaming response:');
  console.log('---');
  
  try {
    let finalText = '';
    let finalUsage = null;
    
    for await (const chunk of client.createResponseStream({
      model: selection.model,
      input: [
        {
          role: 'user',
          content: 'List 3 interesting facts about space',
        },
      ],
      reasoning: selection.reasoning,
      text: selection.text,
    })) {
      if (chunk.type === 'output_text_delta' && chunk.delta) {
        process.stdout.write(chunk.delta);
      }
      if (chunk.type === 'usage' && chunk.usage) {
        finalUsage = chunk.usage;
      }
      if (chunk.type === 'complete') {
        finalText = chunk.output_text || '';
      }
    }
    
    console.log('\n---');
    if (finalUsage) {
      console.log('\nUsage:');
      console.log(`- Input tokens: ${finalUsage.prompt_tokens || 0}`);
      console.log(`- Output tokens: ${finalUsage.completion_tokens || 0}`);
      console.log(`- Total tokens: ${finalUsage.total_tokens || 0}`);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   LLM Model Routing Demo               ║');
  console.log('╚════════════════════════════════════════╝');
  
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('\n❌ Error: OPENAI_API_KEY environment variable not set');
    console.error('Usage: OPENAI_API_KEY=your_key ts-node src/examples/llmRoutingDemo.ts\n');
    process.exit(1);
  }
  
  console.log('\nCurrent Settings:');
  console.log(`- Default Model: ${mockSettings.defaultModel}`);
  console.log(`- Quick Model: ${mockSettings.quickModel}`);
  console.log(`- Quick Model Processes: ${mockSettings.quickModelProcesses.join(', ')}`);
  console.log(`- Reasoning Effort: ${mockSettings.reasoningEffort}`);
  
  // Run demos
  await demonstrateDeepReasoning();
  await demonstrateQuickSummary();
  await demonstrateStreaming();
  
  console.log('\n✅ Demo completed successfully!\n');
}

// Run the demo
if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  });
}
