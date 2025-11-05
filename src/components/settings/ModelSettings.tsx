'use client';

/**
 * Model Settings UI Component
 * Allows users to configure default model, reasoning effort, quick model, and process routing
 */

import React from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  Select,
  Radio,
  RadioGroup,
  Stack,
  Text,
  Checkbox,
  VStack,
  HStack,
  Button,
  useToast,
  Divider,
} from '@chakra-ui/react';
import { useSettingsStore, PROCESS_TYPES, type ProcessType } from '@/lib/settings';
import { AVAILABLE_MODELS, getModelConfig } from '@/config/models';

export function ModelSettings() {
  const toast = useToast();
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  
  const selectedModelConfig = getModelConfig(settings.defaultModel);
  const isReasoningModel = selectedModelConfig?.reasoningCapable ?? false;

  const handleDefaultModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ defaultModel: e.target.value });
    toast({
      title: 'Default model updated',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleQuickModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ quickModel: e.target.value });
    toast({
      title: 'Quick model updated',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleReasoningEffortChange = (value: string) => {
    updateSettings({ reasoningEffort: value as 'low' | 'medium' | 'high' });
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
    toast({
      title: 'Settings reset to defaults',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <Box p={6} bg="white" borderRadius="md" shadow="md">
      <VStack spacing={6} align="stretch">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={4}>
            Model Settings
          </Text>
          <Text fontSize="sm" color="gray.600">
            Configure LLM models and routing for different tasks
          </Text>
        </Box>

        <Divider />

        {/* Default Model */}
        <FormControl>
          <FormLabel>Default Model</FormLabel>
          <Select value={settings.defaultModel} onChange={handleDefaultModelChange}>
            {AVAILABLE_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} {model.description ? `- ${model.description}` : ''}
              </option>
            ))}
          </Select>
          <Text fontSize="xs" color="gray.500" mt={1}>
            The primary model used for most tasks
          </Text>
        </FormControl>

        {/* Reasoning Effort */}
        <FormControl isDisabled={!isReasoningModel}>
          <FormLabel>
            Reasoning Effort
            {!isReasoningModel && (
              <Text as="span" fontSize="xs" color="orange.500" ml={2}>
                (Not available for selected model)
              </Text>
            )}
          </FormLabel>
          <RadioGroup
            value={settings.reasoningEffort}
            onChange={handleReasoningEffortChange}
            isDisabled={!isReasoningModel}
          >
            <Stack direction="row" spacing={4}>
              <Radio value="low">Low</Radio>
              <Radio value="medium">Medium</Radio>
              <Radio value="high">High</Radio>
            </Stack>
          </RadioGroup>
          <Text fontSize="xs" color="gray.500" mt={1}>
            {isReasoningModel
              ? 'Control the depth of reasoning for GPT-5 and other reasoning-capable models'
              : 'Only available for reasoning-capable models (e.g., GPT-5 family)'}
          </Text>
        </FormControl>

        {/* Reasoning Summary */}
        <FormControl isDisabled={!isReasoningModel}>
          <FormLabel>Reasoning Summary</FormLabel>
          <Select
            value={settings.reasoningSummary}
            onChange={handleReasoningSummaryChange}
            isDisabled={!isReasoningModel}
          >
            <option value="auto">Auto</option>
            <option value="concise">Concise</option>
            <option value="detailed">Detailed</option>
          </Select>
          <Text fontSize="xs" color="gray.500" mt={1}>
            How reasoning steps should be summarized
          </Text>
        </FormControl>

        {/* Text Verbosity */}
        <FormControl>
          <FormLabel>Text Verbosity</FormLabel>
          <Select value={settings.textVerbosity} onChange={handleTextVerbosityChange}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Control the length and detail of responses
          </Text>
        </FormControl>

        <Divider />

        {/* Quick Thinking Model */}
        <FormControl>
          <FormLabel>Quick Thinking Model</FormLabel>
          <Select value={settings.quickModel} onChange={handleQuickModelChange}>
            {AVAILABLE_MODELS.filter((m) => !m.reasoningCapable || m.id.includes('mini')).map(
              (model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.description ? `- ${model.description}` : ''}
                </option>
              )
            )}
          </Select>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Faster, cheaper model for lightweight tasks
          </Text>
        </FormControl>

        {/* Quick Model Process Types */}
        <FormControl>
          <FormLabel>Use Quick Model For</FormLabel>
          <VStack align="start" spacing={2} pl={2}>
            {PROCESS_TYPES.map((processType) => (
              <Checkbox
                key={processType.value}
                isChecked={settings.quickModelProcesses.includes(processType.value)}
                onChange={(e) => handleProcessToggle(processType.value, e.target.checked)}
              >
                {processType.label}
              </Checkbox>
            ))}
          </VStack>
          <Text fontSize="xs" color="gray.500" mt={2}>
            Select which tasks should use the quick model instead of the default model
          </Text>
        </FormControl>

        <Divider />

        {/* Reset Button */}
        <HStack justify="flex-end">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}
