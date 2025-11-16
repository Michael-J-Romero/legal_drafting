# Integration Guide: Model Routing

This guide shows how to integrate the model routing system into existing and new LLM API endpoints.

## For New API Endpoints

### Step 1: Import the Required Modules

```typescript
import { getResponsesClient } from '@/lib/llm/openaiResponses';
import { ModelRouter } from '@/lib/llm/modelRouter';
import type { ProcessType } from '@/lib/settings';
```

### Step 2: Determine the Process Type

Based on your endpoint's purpose, select the appropriate process type:

```typescript
const processType: ProcessType = 'general_chat'; // or other types
```

Available process types:
- `general_chat` - General conversation (default model)
- `notes_parallel` - Parallel note-taking (quick model)
- `summarize_quick` - Quick summarization (quick model)
- `draft_outline` - Draft outline generation (default model)
- `classify_tags` - Tag classification (default model)

### Step 3: Use the Model Router

```typescript
// Get model selection based on process type
const selection = ModelRouter.selectModel(processType);

// Or with a forced model override
const selection = ModelRouter.selectModel(processType, undefined, 'gpt-4o-mini');
```

### Step 4: Make the API Call

```typescript
const client = getResponsesClient();

const response = await client.createResponse({
  model: selection.model,
  input: [
    { role: 'user', content: userMessage }
  ],
  reasoning: selection.reasoning,
  text: selection.text,
});
```

## Complete Example

See `src/app/api/llm-example/route.ts` for a complete working example.

## For Existing Endpoints

### Option 1: Add Process Type Parameter (Recommended)

Add an optional `processType` parameter to your existing API:

```typescript
interface ExistingRequest {
  message: string;
  // ... existing fields
  processType?: ProcessType; // Add this
}

export async function POST(request: Request) {
  const { message, processType = 'general_chat' } = await request.json();
  
  // Use router to get model
  const selection = ModelRouter.selectModel(processType);
  
  // Use selection.model instead of hardcoded model
  const response = await client.createResponse({
    model: selection.model,
    // ...
  });
}
```

### Option 2: Keep Existing Behavior, Add Opt-In

Allow callers to opt-in to routing:

```typescript
interface ExistingRequest {
  message: string;
  model?: string; // Existing explicit model
  useRouting?: boolean; // New opt-in flag
  processType?: ProcessType;
}

export async function POST(request: Request) {
  const { message, model, useRouting, processType } = await request.json();
  
  let selectedModel = model || 'gpt-4o-2024-11-20'; // Default
  
  if (useRouting) {
    const selection = ModelRouter.selectModel(processType || 'general_chat');
    selectedModel = selection.model;
  }
  
  // Continue with selectedModel...
}
```

### Option 3: Special Endpoints (Like Research Agent)

For specialized endpoints like the research agent (`/api/agent`), keep the existing implementation as-is. These endpoints have specific requirements and their own settings management.

## Client-Side Integration

### React Components

```typescript
'use client';

import { useSettingsStore } from '@/lib/settings';

function MyComponent() {
  const { settings } = useSettingsStore();
  
  const handleSubmit = async (message: string) => {
    const response = await fetch('/api/llm-example', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        processType: 'summarize_quick', // or dynamically determined
      }),
    });
    
    const data = await response.json();
    console.log('Model used:', data.metadata.model);
    console.log('Response:', data.response);
  };
  
  // ...
}
```

### Direct Client Usage (Server Components)

```typescript
import { getResponsesClient } from '@/lib/llm/openaiResponses';
import { selectModel } from '@/lib/llm/modelRouter';

export default async function ServerComponent() {
  const client = getResponsesClient();
  const selection = selectModel('general_chat');
  
  const response = await client.createResponse({
    model: selection.model,
    input: [{ role: 'user', content: 'Hello' }],
    reasoning: selection.reasoning,
    text: selection.text,
  });
  
  return <div>{response.output_text}</div>;
}
```

## Testing Your Integration

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Test the example endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/llm-example \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello, world!", "processType": "general_chat"}'
   ```

3. Test with quick model routing:
   ```bash
   curl -X POST http://localhost:3000/api/llm-example \
     -H "Content-Type: application/json" \
     -d '{"message": "Summarize this text", "processType": "summarize_quick"}'
   ```

4. Check the response metadata to verify correct model selection:
   ```json
   {
     "response": "...",
     "metadata": {
       "model": "gpt-4o-mini",
       "isQuickModel": true,
       "processType": "summarize_quick"
     }
   }
   ```

## Best Practices

1. **Use Appropriate Process Types**: Choose the process type that best matches your use case
2. **Check Metadata**: Log or return the metadata to verify correct routing
3. **Handle Errors**: The router is designed to be fault-tolerant, but always handle errors
4. **Respect User Settings**: The router automatically respects user preferences from Settings
5. **Document Process Types**: When adding new endpoints, document which process type they use

## Adding New Process Types

If you need a new process type:

1. Add it to `src/lib/settings.ts`:
   ```typescript
   export type ProcessType = 
     | 'notes_parallel'
     | 'summarize_quick'
     | 'your_new_type'; // Add here
   
   export const PROCESS_TYPES = [
     // ...
     { value: 'your_new_type', label: 'Your New Type' },
   ];
   ```

2. The new type will automatically appear in Settings UI
3. Configure default routing in Settings (quick model vs default model)

## Troubleshooting

### Model not routing as expected
- Check Settings at `/settings`
- Verify process type is correctly configured for quick model
- Check console logs for routing decisions

### Reasoning parameters not working
- Verify the selected model supports reasoning (check `src/config/models.ts`)
- The router automatically excludes reasoning params for non-reasoning models

### Usage data missing
- Check that you're using the Responses API client methods
- For streaming, iterate through all chunks to get final usage data
