# OpenAI Responses API and Model Routing

This document describes the OpenAI Responses API integration and model routing features added to the Legal Drafting application.

## Overview

The application now supports:
- **OpenAI Responses API** with reasoning.effort controls for GPT-5 and other reasoning-capable models
- **Model routing** that automatically selects models based on task type
- **Quick thinking model** for lightweight tasks like note-taking and summarization
- **Settings UI** to configure model preferences

## Features

### 1. Model Configuration

All available models are defined in `src/config/models.ts`. This includes:
- GPT-5 family (reasoning-capable)
- GPT-4 family
- GPT-3.5 family

To add or modify models, edit the `AVAILABLE_MODELS` array in `src/config/models.ts`.

### 2. Model Settings

Users can configure the following in the Settings page (`/settings`):

#### Default Model
The primary model used for most tasks. Can be any model from GPT-3.5 to GPT-5.

#### Reasoning Effort
Controls the depth of reasoning for reasoning-capable models (e.g., GPT-5):
- **Low**: Fast, less thorough reasoning
- **Medium**: Balanced reasoning (default)
- **High**: Deep, comprehensive reasoning

This setting is only available when a reasoning-capable model is selected.

#### Reasoning Summary
How reasoning steps should be summarized:
- **Auto**: Automatic summarization
- **Concise**: Brief summaries
- **Detailed**: Comprehensive summaries

#### Text Verbosity
Controls the length and detail of responses:
- **Low**: Concise responses
- **Medium**: Balanced responses (default)
- **High**: Detailed responses

#### Quick Thinking Model
A faster, cheaper model for lightweight tasks. Defaults to `gpt-4o-mini`.

#### Quick Model Processes
Select which task types should use the quick model:
- **Parallel Note-Taking** (default)
- **Quick Summarization** (default)
- **Draft Outline**
- **Tag Classification**
- **General Chat**

## Usage

### Using the Model Router

The model router automatically selects the appropriate model based on the process type:

```typescript
import { selectModel } from '@/lib/llm/modelRouter';

// For general chat (uses default model)
const selection = selectModel('general_chat');

// For quick summarization (uses quick model if configured)
const selection = selectModel('summarize_quick');

// Force a specific model
const selection = selectModel('general_chat', 'gpt-4o-mini');
```

### Using the Responses API Client

```typescript
import { getResponsesClient } from '@/lib/llm/openaiResponses';
import { selectModel } from '@/lib/llm/modelRouter';

const client = getResponsesClient();
const selection = selectModel('general_chat');

// Non-streaming request
const response = await client.createResponse({
  model: selection.model,
  input: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
  reasoning: selection.reasoning,
  text: selection.text,
});

console.log(response.output_text);
console.log(response.usage);
```

### Streaming Requests

```typescript
// Streaming request
for await (const chunk of client.createResponseStream({
  model: selection.model,
  input: [
    { role: 'user', content: 'Tell me a story' }
  ],
  reasoning: selection.reasoning,
  text: selection.text,
})) {
  if (chunk.type === 'output_text_delta') {
    process.stdout.write(chunk.delta);
  }
  if (chunk.type === 'usage') {
    console.log('Usage:', chunk.usage);
  }
}
```

## Process Types

The following process types are available:

| Process Type | Description | Default Routing |
|-------------|-------------|----------------|
| `general_chat` | General conversation | Default model |
| `notes_parallel` | Parallel note-taking | Quick model |
| `summarize_quick` | Quick summarization | Quick model |
| `draft_outline` | Draft outline generation | Default model |
| `classify_tags` | Tag classification | Default model |

## API Details

### Reasoning Configuration

For reasoning-capable models (GPT-5 family), the API includes:

```typescript
reasoning: {
  effort: 'low' | 'medium' | 'high',
  summary?: 'auto' | 'concise' | 'detailed'
}
```

**Important**: Temperature is automatically excluded for reasoning models to prevent API errors.

### Text Configuration

```typescript
text: {
  format: { type: 'text' },
  verbosity?: 'low' | 'medium' | 'high'
}
```

### Usage Information

Responses include detailed usage information:

```typescript
{
  prompt_tokens: number,
  completion_tokens: number,
  total_tokens: number,
  prompt_tokens_details?: {
    cached_tokens?: number
  },
  completion_tokens_details?: {
    reasoning_tokens?: number
  }
}
```

## Demo Script

Run the demo to see model routing in action:

```bash
OPENAI_API_KEY=your_key ts-node src/examples/llmRoutingDemo.ts
```

The demo shows:
1. Deep reasoning with the default model
2. Quick summarization with the quick model
3. Streaming responses

## Environment Variables

Set the following environment variable:

```bash
OPENAI_API_KEY=your_openai_api_key
```

## Settings Persistence

Settings are persisted to browser localStorage using Zustand with the key `llm-settings-storage`.

To reset settings, use the "Reset to Defaults" button in the Settings UI or clear localStorage.

## Adding New Models

To add a new model:

1. Open `src/config/models.ts`
2. Add to the `AVAILABLE_MODELS` array:

```typescript
{
  id: 'new-model-id',
  name: 'New Model Name',
  reasoningCapable: false, // or true if it supports reasoning
  description: 'Optional description',
}
```

3. The model will automatically appear in the Settings UI

## Technical Notes

- The OpenAI Responses API client is a thin wrapper around the standard OpenAI SDK
- Model selection happens at request time, not at initialization
- Settings changes are applied immediately and persist across sessions
- The router validates model capabilities and only includes reasoning parameters when supported
