// Shared types for the planning agent

export interface ModelConfig {
  name: string;
  displayName: string;
  maxContextTokens: number;
  supportedContextSizes: number[];
  description: string;
}

export interface AgentSettings {
  maxIterations: number;
  confidenceThreshold: number;
  maxResponseLength: number;
  contextWindowSize: number;
  summaryMode: 'brief' | 'balanced' | 'detailed';
  model: string;
  reasoningEffort: 'low' | 'medium' | 'high';
  quickModel: string;
  quickAssignments: Record<string, boolean>;
}

export interface UploadedFile {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  text: string;
  uploadedAt: Date;
}

export interface StoredUploadedFile {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  text: string;
  uploadedAt: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  breakdown?: any;
  inputTokensDetails?: Record<string, number>;
  outputTokensDetails?: Record<string, number>;
  reasoningSummary?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
  usage?: TokenUsage;
}

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  files?: StoredUploadedFile[];
  usage?: TokenUsage;
}

export interface Note {
  id: string;
  content: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  isPending?: boolean;
  isNew?: boolean;
}

export interface StoredNote {
  id: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  notes: Note[];
}

export interface StoredChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
  notes: StoredNote[];
}

export type TabView = 'main-chat' | 'notes' | 'plan' | 'documents' | 'goals';
