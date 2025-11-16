/**
 * Model configuration for OpenAI models
 * Defines available models and their capabilities
 */

export interface ModelConfig {
  id: string;
  name: string;
  reasoningCapable: boolean;
  description?: string;
}

/**
 * List of available models with their capabilities
 * Add or modify models here without code changes
 */
export const AVAILABLE_MODELS: ModelConfig[] = [
  // GPT-5 family - reasoning capable
  {
    id: 'gpt-5',
    name: 'GPT-5',
    reasoningCapable: true,
    description: 'Most capable GPT-5 model with advanced reasoning',
  },
  {
    id: 'gpt-5-turbo',
    name: 'GPT-5 Turbo',
    reasoningCapable: true,
    description: 'Faster GPT-5 variant with reasoning',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    reasoningCapable: true,
    description: 'Lightweight GPT-5 with reasoning',
  },
  // GPT-4 family - some with reasoning
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    reasoningCapable: false,
    description: 'Optimized GPT-4 model',
  },
  {
    id: 'gpt-4o-2024-11-20',
    name: 'GPT-4o (2024-11-20)',
    reasoningCapable: false,
    description: 'Latest GPT-4o snapshot',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    reasoningCapable: false,
    description: 'Fast and affordable GPT-4 model',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    reasoningCapable: false,
    description: 'Powerful GPT-4 variant',
  },
  // GPT-3.5 family
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    reasoningCapable: false,
    description: 'Fast and cost-effective model',
  },
];

/**
 * Get model configuration by ID
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId);
}

/**
 * Check if a model supports reasoning
 */
export function isReasoningCapable(modelId: string): boolean {
  const config = getModelConfig(modelId);
  return config?.reasoningCapable ?? false;
}

/**
 * Get all models suitable for quick thinking (non-reasoning, cheaper)
 */
export function getQuickThinkingModels(): ModelConfig[] {
  return AVAILABLE_MODELS.filter(
    (m) => !m.reasoningCapable && (m.id.includes('mini') || m.id.includes('3.5'))
  );
}

/**
 * Check if a model is suitable for quick thinking tasks
 * (lightweight, fast, or economical models)
 */
export function isQuickThinkingModel(modelId: string): boolean {
  const config = getModelConfig(modelId);
  if (!config) return false;
  
  // Reasoning-capable models except mini variants are not quick-thinking
  if (config.reasoningCapable && !modelId.includes('mini')) {
    return false;
  }
  
  // Mini variants and 3.5 models are quick-thinking
  return modelId.includes('mini') || modelId.includes('3.5');
}

/**
 * Default model IDs
 */
export const DEFAULT_MODEL = 'gpt-4o-2024-11-20';
export const DEFAULT_QUICK_MODEL = 'gpt-4o-mini';
