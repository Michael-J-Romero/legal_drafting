/**
 * Settings store for model configuration and preferences
 * Uses localStorage for persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MODEL, DEFAULT_QUICK_MODEL } from '@/config/models';

/**
 * Process types that can be routed to different models
 */
export type ProcessType = 
  | 'notes_parallel'
  | 'summarize_quick'
  | 'draft_outline'
  | 'classify_tags'
  | 'general_chat';

export const PROCESS_TYPES: { value: ProcessType; label: string }[] = [
  { value: 'notes_parallel', label: 'Parallel Note-Taking' },
  { value: 'summarize_quick', label: 'Quick Summarization' },
  { value: 'draft_outline', label: 'Draft Outline' },
  { value: 'classify_tags', label: 'Tag Classification' },
  { value: 'general_chat', label: 'General Chat' },
];

/**
 * Reasoning effort levels
 */
export type ReasoningEffort = 'low' | 'medium' | 'high';

/**
 * Text verbosity levels
 */
export type TextVerbosity = 'low' | 'medium' | 'high';

/**
 * Reasoning summary options
 */
export type ReasoningSummary = 'auto' | 'concise' | 'detailed';

/**
 * Model settings interface
 */
export interface ModelSettings {
  // Global default model
  defaultModel: string;
  
  // Reasoning configuration (only used with reasoning-capable models)
  reasoningEffort: ReasoningEffort;
  reasoningSummary: ReasoningSummary;
  
  // Text configuration
  textVerbosity: TextVerbosity;
  
  // Quick thinking model for lightweight tasks
  quickModel: string;
  
  // Process types that should use the quick model
  quickModelProcesses: ProcessType[];
}

/**
 * Settings store state
 */
interface SettingsStore {
  settings: ModelSettings;
  updateSettings: (updates: Partial<ModelSettings>) => void;
  resetSettings: () => void;
}

/**
 * Default settings
 */
const DEFAULT_SETTINGS: ModelSettings = {
  defaultModel: DEFAULT_MODEL,
  reasoningEffort: 'medium',
  reasoningSummary: 'auto',
  textVerbosity: 'medium',
  quickModel: DEFAULT_QUICK_MODEL,
  quickModelProcesses: ['notes_parallel', 'summarize_quick'],
};

/**
 * Settings store with persistence
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      
      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),
      
      resetSettings: () =>
        set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'llm-settings-storage',
    }
  )
);
