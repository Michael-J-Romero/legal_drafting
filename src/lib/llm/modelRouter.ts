/**
 * Model routing layer
 * Routes requests to appropriate models based on process type and settings
 */

import { useSettingsStore, type ProcessType, type ModelSettings } from '@/lib/settings';
import { getModelConfig } from '@/config/models';

/**
 * Model selection result
 */
export interface ModelSelection {
  model: string;
  isQuickModel: boolean;
  reasoning?: {
    effort: 'low' | 'medium' | 'high';
    summary?: 'auto' | 'concise' | 'detailed';
  };
  text?: {
    format: { type: 'text' };
    verbosity?: 'low' | 'medium' | 'high';
  };
}

/**
 * Model router class
 */
export class ModelRouter {
  /**
   * Select model based on process type and settings
   */
  static selectModel(
    processType: ProcessType = 'general_chat',
    settings?: ModelSettings,
    forceModel?: string
  ): ModelSelection {
    // If a specific model is forced, use it
    if (forceModel) {
      const config = getModelConfig(forceModel);
      return {
        model: forceModel,
        isQuickModel: false,
        reasoning: config?.reasoningCapable ? {
          effort: settings?.reasoningEffort || 'medium',
          summary: settings?.reasoningSummary || 'auto',
        } : undefined,
        text: {
          format: { type: 'text' },
          verbosity: settings?.textVerbosity || 'medium',
        },
      };
    }

    // Get settings from store if not provided
    const activeSettings = settings || useSettingsStore.getState().settings;

    // Determine if this process type should use the quick model
    const useQuickModel = activeSettings.quickModelProcesses.includes(processType);
    const selectedModel = useQuickModel ? activeSettings.quickModel : activeSettings.defaultModel;

    // Get model configuration
    const modelConfig = getModelConfig(selectedModel);

    // Build response
    const selection: ModelSelection = {
      model: selectedModel,
      isQuickModel: useQuickModel,
      text: {
        format: { type: 'text' },
        verbosity: activeSettings.textVerbosity,
      },
    };

    // Add reasoning config only if model supports it
    if (modelConfig?.reasoningCapable) {
      selection.reasoning = {
        effort: activeSettings.reasoningEffort,
        summary: activeSettings.reasoningSummary,
      };
    }

    return selection;
  }

  /**
   * Get current settings
   */
  static getSettings(): ModelSettings {
    return useSettingsStore.getState().settings;
  }

  /**
   * Update settings
   */
  static updateSettings(updates: Partial<ModelSettings>): void {
    useSettingsStore.getState().updateSettings(updates);
  }
}

/**
 * Helper function for simple model selection
 */
export function selectModel(
  processType?: ProcessType,
  forceModel?: string
): ModelSelection {
  return ModelRouter.selectModel(processType, undefined, forceModel);
}
