'use client';

/**
 * Model Settings UI Component
 * Allows users to configure default model, reasoning effort, quick model, and process routing
 */

import React from 'react';
import { useSettingsStore, PROCESS_TYPES, type ProcessType } from '@/lib/settings';
import { AVAILABLE_MODELS, getModelConfig, isQuickThinkingModel } from '@/config/models';
import styles from './ModelSettings.module.css';

export function ModelSettings() {
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const [showToast, setShowToast] = React.useState<string | null>(null);
  
  const selectedModelConfig = getModelConfig(settings.defaultModel);
  const isReasoningModel = selectedModelConfig?.reasoningCapable ?? false;

  const showMessage = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(null), 2000);
  };

  const handleDefaultModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ defaultModel: e.target.value });
    showMessage('Default model updated');
  };

  const handleQuickModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ quickModel: e.target.value });
    showMessage('Quick model updated');
  };

  const handleReasoningEffortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ reasoningEffort: e.target.value as 'low' | 'medium' | 'high' });
  };

  const handleReasoningSummaryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ reasoningSummary: e.target.value as 'auto' | 'concise' | 'detailed' });
  };

  const handleTextVerbosityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ textVerbosity: e.target.value as 'low' | 'medium' | 'high' });
  };

  const handleProcessToggle = (processType: ProcessType, checked: boolean) => {
    const currentProcesses = settings.quickModelProcesses;
    const updatedProcesses = checked
      ? [...currentProcesses, processType]
      : currentProcesses.filter((p) => p !== processType);
    
    updateSettings({ quickModelProcesses: updatedProcesses });
  };

  const handleReset = () => {
    resetSettings();
    showMessage('Settings reset to defaults');
  };

  return (
    <div className={styles.container}>
      {showToast && (
        <div className={styles.toast}>
          {showToast}
        </div>
      )}

      <div className={styles.header}>
        <h2 className={styles.title}>Model Settings</h2>
        <p className={styles.subtitle}>
          Configure LLM models and routing for different tasks
        </p>
      </div>

      <div className={styles.divider} />

      {/* Default Model */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Default Model</label>
        <select 
          className={styles.select}
          value={settings.defaultModel} 
          onChange={handleDefaultModelChange}
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} {model.description ? `- ${model.description}` : ''}
            </option>
          ))}
        </select>
        <p className={styles.hint}>
          The primary model used for most tasks
        </p>
      </div>

      {/* Reasoning Effort */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Reasoning Effort
          {!isReasoningModel && (
            <span className={styles.warning}>
              (Not available for selected model)
            </span>
          )}
        </label>
        <div className={styles.radioGroup}>
          <label className={`${styles.radioLabel} ${!isReasoningModel ? styles.disabled : ''}`}>
            <input
              type="radio"
              value="low"
              checked={settings.reasoningEffort === 'low'}
              onChange={handleReasoningEffortChange}
              disabled={!isReasoningModel}
            />
            Low
          </label>
          <label className={`${styles.radioLabel} ${!isReasoningModel ? styles.disabled : ''}`}>
            <input
              type="radio"
              value="medium"
              checked={settings.reasoningEffort === 'medium'}
              onChange={handleReasoningEffortChange}
              disabled={!isReasoningModel}
            />
            Medium
          </label>
          <label className={`${styles.radioLabel} ${!isReasoningModel ? styles.disabled : ''}`}>
            <input
              type="radio"
              value="high"
              checked={settings.reasoningEffort === 'high'}
              onChange={handleReasoningEffortChange}
              disabled={!isReasoningModel}
            />
            High
          </label>
        </div>
        <p className={styles.hint}>
          {isReasoningModel
            ? 'Control the depth of reasoning for GPT-5 and other reasoning-capable models'
            : 'Only available for reasoning-capable models (e.g., GPT-5 family)'}
        </p>
      </div>

      {/* Reasoning Summary */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Reasoning Summary</label>
        <select
          className={styles.select}
          value={settings.reasoningSummary}
          onChange={handleReasoningSummaryChange}
          disabled={!isReasoningModel}
        >
          <option value="auto">Auto</option>
          <option value="concise">Concise</option>
          <option value="detailed">Detailed</option>
        </select>
        <p className={styles.hint}>
          How reasoning steps should be summarized
        </p>
      </div>

      {/* Text Verbosity */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Text Verbosity</label>
        <select 
          className={styles.select}
          value={settings.textVerbosity} 
          onChange={handleTextVerbosityChange}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <p className={styles.hint}>
          Control the length and detail of responses
        </p>
      </div>

      <div className={styles.divider} />

      {/* Quick Thinking Model */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Quick Thinking Model</label>
        <select 
          className={styles.select}
          value={settings.quickModel} 
          onChange={handleQuickModelChange}
        >
          {AVAILABLE_MODELS.filter((m) => isQuickThinkingModel(m.id)).map(
            (model) => (
              <option key={model.id} value={model.id}>
                {model.name} {model.description ? `- ${model.description}` : ''}
              </option>
            )
          )}
        </select>
        <p className={styles.hint}>
          Faster, cheaper model for lightweight tasks
        </p>
      </div>

      {/* Quick Model Process Types */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Use Quick Model For</label>
        <div className={styles.checkboxGroup}>
          {PROCESS_TYPES.map((processType) => (
            <label key={processType.value} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.quickModelProcesses.includes(processType.value)}
                onChange={(e) => handleProcessToggle(processType.value, e.target.checked)}
              />
              {processType.label}
            </label>
          ))}
        </div>
        <p className={styles.hint}>
          Select which tasks should use the quick model instead of the default model
        </p>
      </div>

      <div className={styles.divider} />

      {/* Reset Button */}
      <div className={styles.buttonGroup}>
        <button className={styles.resetButton} onClick={handleReset}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
