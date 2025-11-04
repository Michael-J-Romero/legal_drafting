'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface ModelConfig {
  name: string;
  displayName: string;
  maxContextTokens: number;
  supportedContextSizes: number[];
  description: string;
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gpt-4o-2024-11-20': {
    name: 'gpt-4o-2024-11-20',
    displayName: 'GPT-4o (latest)',
    maxContextTokens: 128000,
    supportedContextSizes: [2000, 4000, 8000, 16000, 32000, 64000, 128000],
    description: 'Latest GPT-4o with 128K context'
  },
  'gpt-4o': {
    name: 'gpt-4o',
    displayName: 'GPT-4o',
    maxContextTokens: 128000,
    supportedContextSizes: [2000, 4000, 8000, 16000, 32000, 64000, 128000],
    description: 'GPT-4o with 128K context'
  },
  'gpt-4-turbo': {
    name: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    maxContextTokens: 128000,
    supportedContextSizes: [2000, 4000, 8000, 16000, 32000, 64000, 128000],
    description: 'GPT-4 Turbo with 128K context'
  },
  'gpt-3.5-turbo': {
    name: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    maxContextTokens: 16385,
    supportedContextSizes: [2000, 4000, 8000, 16000],
    description: 'GPT-3.5 Turbo with 16K context'
  },
  'o1-preview': {
    name: 'o1-preview',
    displayName: 'o1 (preview)',
    maxContextTokens: 128000,
    supportedContextSizes: [2000, 4000, 8000, 16000, 32000, 64000, 128000],
    description: 'o1 reasoning model preview with 128K context'
  },
  'o1-mini': {
    name: 'o1-mini',
    displayName: 'o1-mini',
    maxContextTokens: 128000,
    supportedContextSizes: [2000, 4000, 8000, 16000, 32000, 64000, 128000],
    description: 'o1-mini reasoning model with 128K context'
  }
};

interface AgentSettings {
  maxIterations: number;
  confidenceThreshold: number;
  maxResponseLength: number;
  contextWindowSize: number;
  summaryMode: 'brief' | 'balanced' | 'detailed';
  model: string;
}

interface UploadedFile {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  text: string;
  uploadedAt: Date;
}

interface StoredUploadedFile {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  text: string;
  uploadedAt: string; // ISO
}

interface TokenUsageBreakdown {
  userPromptTokens: number;
  conversationContextTokens: number;
  researchContextTokens: number;
  systemInstructionsTokens: number;
  toolDefinitionsTokens: number;
  formattingOverheadTokens: number;
  storedDocumentsCount: number;
  storedDocumentsTokens: number;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputTokensDetails?: Record<string, number>;
  outputTokensDetails?: Record<string, number>;
  breakdown?: TokenUsageBreakdown;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
  usage?: TokenUsage;
}

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO
  files?: StoredUploadedFile[];
  usage?: TokenUsage;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  messages: Message[];
}

interface StoredChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

const STORAGE_KEY = 'planningAgentChats';

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface MessageSection {
  type: 'thinking' | 'research' | 'reflection' | 'synthesis' | 'answer' | 'plain';
  content: string;
  estimatedTokens?: number;
}

// Section styles extracted to avoid creating new objects on each render
const SECTION_STYLES: Record<MessageSection['type'], { bg: string; border: string; icon: string; title: string; color: string }> = {
  thinking: {
    bg: '#fef3c7',
    border: '#fbbf24',
    icon: '🤔',
    title: 'Thinking',
    color: '#92400e',
  },
  research: {
    bg: '#dbeafe',
    border: '#3b82f6',
    icon: '🔍',
    title: 'Research',
    color: '#1e3a8a',
  },
  reflection: {
    bg: '#fce7f3',
    border: '#ec4899',
    icon: '🧐',
    title: 'Reflection',
    color: '#831843',
  },
  synthesis: {
    bg: '#e0e7ff',
    border: '#8b5cf6',
    icon: '💡',
    title: 'Synthesis',
    color: '#4c1d95',
  },
  answer: {
    bg: '#d1fae5',
    border: '#10b981',
    icon: '✅',
    title: 'Answer',
    color: '#064e3b',
  },
  plain: {
    bg: 'transparent',
    border: 'transparent',
    icon: '',
    title: '',
    color: '#111827',
  },
};

// Marker patterns with their corresponding types and removal regexes
const PHASE_MARKERS = [
  { 
    type: 'thinking' as const, 
    pattern: /🤔\s*\*\*THINKING:\*\*/gi,
    removePattern: /^🤔\s*\*\*THINKING:\*\*\n?/i
  },
  { 
    type: 'research' as const, 
    pattern: /🔍\s*\*\*RESEARCH:\*\*/gi,
    removePattern: /^🔍\s*\*\*RESEARCH:\*\*\n?/i
  },
  { 
    type: 'reflection' as const, 
    pattern: /🧐\s*\*\*REFLECTION:\*\*/gi,
    removePattern: /^🧐\s*\*\*REFLECTION:\*\*\n?/i
  },
  { 
    type: 'synthesis' as const, 
    pattern: /💡\s*\*\*SYNTHESIS:\*\*/gi,
    removePattern: /^💡\s*\*\*SYNTHESIS:\*\*\n?/i
  },
  { 
    type: 'answer' as const, 
    pattern: /✅\s*\*\*ANSWER:\*\*/gi,
    removePattern: /^✅\s*\*\*ANSWER:\*\*\n?/i
  },
];

function parseMessageSections(content: string): MessageSection[] {
  const sections: MessageSection[] = [];
  let positions: Array<{ index: number; type: MessageSection['type'] }> = [];
  
  // Helper function to estimate tokens (roughly 4 characters per token)
  const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
  
  // Find all occurrences of each marker
  PHASE_MARKERS.forEach(({ pattern, type }) => {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      positions.push({ index: match.index, type });
      // Prevent infinite loop on zero-width matches
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
  });
  
  // If no sections found, return plain content
  if (positions.length === 0) {
    return [{ type: 'plain', content, estimatedTokens: estimateTokens(content) }];
  }
  
  // Sort positions by index
  positions.sort((a, b) => a.index - b.index);
  
  // Add content before first section if any
  if (positions[0].index > 0) {
    const plainContent = content.substring(0, positions[0].index).trim();
    sections.push({
      type: 'plain',
      content: plainContent,
      estimatedTokens: estimateTokens(plainContent),
    });
  }
  
  // Extract each section
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i < positions.length - 1 ? positions[i + 1].index : content.length;
    const sectionContent = content.substring(start, end);
    
    // Find the appropriate removal pattern for this type
    const marker = PHASE_MARKERS.find(m => m.type === positions[i].type);
    const contentWithoutMarker = marker 
      ? sectionContent.replace(marker.removePattern, '').trim()
      : sectionContent.trim();
    
    if (contentWithoutMarker) {
      sections.push({
        type: positions[i].type,
        content: contentWithoutMarker,
        estimatedTokens: estimateTokens(contentWithoutMarker),
      });
    }
  }
  
  return sections;
}

/**
 * Cleans the conversation history by extracting only the ANSWER sections from assistant messages.
 * This dramatically reduces token usage by removing verbose reasoning steps (THINKING, RESEARCH, etc.)
 * while preserving the actual conversation context.
 */
function getCleanedHistory(messages: Message[]): Pick<Message, 'role' | 'content' | 'timestamp'>[] {
  return messages.map(msg => {
    // Keep user messages unchanged - return a minimal object to avoid unnecessary copying
    if (msg.role === 'user') {
      return { role: msg.role, content: msg.content, timestamp: msg.timestamp };
    }
    
    // For assistant messages, extract only the ANSWER section
    // Quick check: if the message doesn't contain the ANSWER marker, return as-is
    if (!msg.content.includes('✅') && !msg.content.includes('ANSWER:')) {
      return { role: msg.role, content: msg.content, timestamp: msg.timestamp };
    }
    
    // Parse sections only if we detected the marker
    const sections = parseMessageSections(msg.content);
    const answerSection = sections.find(section => section.type === 'answer');
    
    // If there's an ANSWER section, use only that; otherwise keep the full content
    // (to handle edge cases where the response doesn't have the expected structure)
    const cleanedContent = answerSection 
      ? answerSection.content 
      : msg.content;
    
    return { role: msg.role, content: cleanedContent, timestamp: msg.timestamp };
  });
}

function renderMessageSection(section: MessageSection, key: number) {
  const style = SECTION_STYLES[section.type];
  
  if (section.type === 'plain') {
    return (
      <div key={key} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: style.color }}>
        {section.content}
      </div>
    );
  }
  
  return (
    <div
      key={key}
      style={{
        marginTop: key > 0 ? 12 : 0,
        padding: 12,
        backgroundColor: style.bg,
        border: `2px solid ${style.border}`,
        borderRadius: 8,
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 8, color: style.color, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{style.icon}</span>
          <span>{style.title}</span>
        </div>
        {section.estimatedTokens !== undefined && (
          <details style={{ cursor: 'pointer', fontSize: 11 }}>
            <summary style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', color: '#6b7280' }}>
              <span>▸</span>
              <span>{section.estimatedTokens.toLocaleString()} tokens</span>
            </summary>
            <div style={{ marginTop: 4, padding: 6, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 4, fontSize: 10 }}>
              <div>Estimated output tokens for this section</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>~{section.estimatedTokens.toLocaleString()} tokens</div>
            </div>
          </details>
        )}
      </div>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: style.color }}>
        {section.content}
      </div>
    </div>
  );
}

// Memoized component for rendering message content
function MessageContent({ content, role }: { content: string; role: 'user' | 'assistant' }) {
  const sections = useMemo(() => {
    return role === 'assistant' 
      ? parseMessageSections(content) 
      : [{ type: 'plain' as const, content }];
  }, [content, role]);

  return <>{sections.map((section, idx) => renderMessageSection(section, idx))}</>;
}

function hydrateChats(stored: StoredChatSession[]): ChatSession[] {
  return stored.map((c) => ({
    ...c,
    messages: (c.messages || []).map((m) => ({ 
      ...m, 
      timestamp: new Date(m.timestamp),
      files: m.files?.map(f => ({ ...f, uploadedAt: new Date(f.uploadedAt) }))
    })),
  }));
}

function dehydrateChats(chats: ChatSession[]): StoredChatSession[] {
  return chats.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messages: c.messages.map((m) => ({ 
      ...m, 
      timestamp: m.timestamp.toISOString(),
      files: m.files?.map(f => ({ ...f, uploadedAt: f.uploadedAt.toISOString() }))
    })),
  }));
}

export default function PlanningAgentPage() {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Agent settings with defaults
  const [settings, setSettings] = useState<AgentSettings>({
    maxIterations: 3,
    confidenceThreshold: 85,
    maxResponseLength: 10000,
    contextWindowSize: 4000,
    summaryMode: 'balanced',
    model: 'gpt-4o-2024-11-20'
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as StoredChatSession[];
        const hydrated = hydrateChats(parsed);
        setChats(hydrated);
        setActiveChatId(hydrated[0]?.id ?? null);
      } else {
        const id = generateId();
        const now = new Date().toISOString();
        const initial: ChatSession = { id, title: 'New chat', createdAt: now, updatedAt: now, messages: [] };
        setChats([initial]);
        setActiveChatId(id);
      }
    } catch (e) {
      console.error('Failed to load chats from storage', e);
    }
  }, []);

  // Persist to localStorage when chats change
  useEffect(() => {
    try {
      const dehydrated = dehydrateChats(chats);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dehydrated));
    } catch (e) {
      console.error('Failed to save chats to storage', e);
    }
  }, [chats]);

  // Close any open chat menu on window click
  useEffect(() => {
    const handleWindowClick = () => setOpenMenuId(null);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) || null, [chats, activeChatId]);
  const messages = activeChat?.messages ?? [];

  const totalUsage = useMemo(() => {
    const messagesWithUsage = messages.filter(m => m.usage);
    
    if (messagesWithUsage.length === 0) {
      return null;
    }
    
    const total = messagesWithUsage.reduce(
      (acc, m) => ({
        inputTokens: acc.inputTokens + (m.usage?.inputTokens || 0),
        outputTokens: acc.outputTokens + (m.usage?.outputTokens || 0),
        totalTokens: acc.totalTokens + (m.usage?.totalTokens || 0),
      }),
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    );
    
    return {
      ...total,
      messageCount: messagesWithUsage.length,
    };
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function updateActiveChatMessages(updater: (prev: Message[]) => Message[]) {
    if (!activeChat) return;
    setChats((prev) =>
      prev.map((c) => (c.id === activeChat.id ? { ...c, messages: updater(c.messages), updatedAt: new Date().toISOString() } : c))
    );
  }

  function setActiveChatTitle(title: string) {
    if (!activeChat) return;
    setChats((prev) => prev.map((c) => (c.id === activeChat.id ? { ...c, title, updatedAt: new Date().toISOString() } : c)));
  }

  function createNewChat() {
    const id = generateId();
    const now = new Date().toISOString();
    const newChat: ChatSession = { id, title: 'New chat', createdAt: now, updatedAt: now, messages: [] };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(id);
    setInput('');
  }

  function selectChat(id: string) {
    setActiveChatId(id);
    setInput('');
  }

  function renameChat(id: string) {
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;
    const proposed = window.prompt('Rename chat', chat.title || 'Untitled');
    if (proposed == null) return; // canceled
    const title = proposed.trim();
    if (!title) return;
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title, updatedAt: new Date().toISOString() } : c)));
  }

  function deleteChat(id: string) {
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;
    const ok = window.confirm('Delete this chat? This cannot be undone.');
    if (!ok) return;

    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      // Choose next active chat
      if (id === activeChatId) {
        if (next.length > 0) {
          setActiveChatId(next[0].id);
        } else {
          // If none remain, create a fresh chat
          const newId = generateId();
          const now = new Date().toISOString();
          const fresh: ChatSession = { id: newId, title: 'New chat', createdAt: now, updatedAt: now, messages: [] };
          setActiveChatId(newId);
          return [fresh];
        }
      }
      return next;
    });
    setInput('');
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success && data.text) {
        const uploadedFile: UploadedFile = {
          id: generateId(),
          fileName: data.fileName,
          fileType: data.fileType,
          size: data.size,
          text: data.text,
          uploadedAt: new Date(),
        };
        setUploadedFiles((prev) => [...prev, uploadedFile]);
      } else {
        alert(data.error || 'Failed to upload file');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred during upload');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteFile = (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file) return;
    
    const ok = window.confirm(`Delete ${file.fileName}? This cannot be undone.`);
    if (!ok) return;
    
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const openFilePreview = (file: UploadedFile) => {
    const blob = new Blob([file.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up the URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !activeChat) return;

    const userMessage: Message = { 
      role: 'user', 
      content: input.trim(), 
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };

    // Include file content in the message sent to the API
    let messageContent = input.trim();
    if (uploadedFiles.length > 0) {
      messageContent += '\n\n[Attached Files]:\n';
      uploadedFiles.forEach(file => {
        messageContent += `\n--- ${file.fileName} (${file.fileType}) ---\n${file.text}\n`;
      });
    }

    // Clean the conversation history to remove verbose reasoning steps
    // This keeps only the ANSWER sections from assistant messages, dramatically reducing token usage
    // Note: We send only the HISTORY (previous messages), not the current user message
    // The backend expects 'message' for the current query and 'messages' for history
    const cleanedHistory = getCleanedHistory(messages);

    updateActiveChatMessages((prev) => [...prev, userMessage]);
    if (messages.length === 0) {
      const title = userMessage.content.split(/\s+/).slice(0, 8).join(' ');
      setActiveChatTitle(title || 'New chat');
    }

    setInput('');
    setUploadedFiles([]); // Clear uploaded files after sending
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: messageContent,  // Current user message
          messages: cleanedHistory,  // Conversation history (excluding current message)
          settings: settings
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let buffer = ''; // Buffer for incomplete lines
      let currentUsage: TokenUsage | undefined = undefined;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Split by double newline (SSE message separator) to get complete messages
          const messages = buffer.split('\n\n');
          
          // Keep the last incomplete message in the buffer
          buffer = messages.pop() || '';
          
          for (const message of messages) {
            const lines = message.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              
              try {
                const data = JSON.parse(jsonStr);
                
                // Debug: Log all event types to understand what we're receiving
                if (data.type) {
                  console.log('[FRONTEND] Received event type:', data.type);
                  if (data.type === 'usage_summary') {
                    console.log('[FRONTEND] USAGE SUMMARY EVENT:', JSON.stringify(data, null, 2));
                  }
                }
                
                if (data.error) {
                  console.error('Stream error:', data.error);
                  assistantMessage += `\n\nError: ${data.error}`;
                } else if (data.type === 'usage_summary' && data.data) {
                  // Capture usage data
                  currentUsage = data.data;
                  console.log('[FRONTEND] ✅ Usage data captured:', currentUsage);
                  
                  // Immediately update the last message with usage data
                  updateActiveChatMessages((prev) => {
                    const newMessages = [...prev];
                    const last = newMessages[newMessages.length - 1];
                    if (last && last.role === 'assistant') {
                      console.log('[FRONTEND] ✅ Updating assistant message with usage data');
                      newMessages[newMessages.length - 1] = { ...last, usage: currentUsage };
                    } else {
                      console.log('[FRONTEND] ⚠️ No assistant message found to attach usage to');
                    }
                    return newMessages;
                  });
                } else if (data.type === 'output_text_delta' && data.data?.delta) {
                  const content = data.data.delta;
                  assistantMessage += content;
                  updateActiveChatMessages((prev) => {
                    const newMessages = [...prev];
                    const last = newMessages[newMessages.length - 1];
                    if (last && last.role === 'assistant') {
                      newMessages[newMessages.length - 1] = { ...last, content: assistantMessage };
                    } else {
                      newMessages.push({ role: 'assistant', content: assistantMessage, timestamp: new Date() });
                    }
                    return newMessages;
                  });
                } else if (data.type === 'raw_model_stream_event' && data.data?.type === 'output_text_delta') {
                  const content = data.data.delta;
                  assistantMessage += content;
                  updateActiveChatMessages((prev) => {
                    const newMessages = [...prev];
                    const last = newMessages[newMessages.length - 1];
                    if (last && last.role === 'assistant') {
                      newMessages[newMessages.length - 1] = { ...last, content: assistantMessage };
                    } else {
                      newMessages.push({ role: 'assistant', content: assistantMessage, timestamp: new Date() });
                    }
                    return newMessages;
                  });
                }
              } catch (err) {
                // Silently skip malformed JSON - likely an incomplete chunk
                // Only log if it's a significant error
                if (jsonStr.length > 10) {
                  console.warn('Skipping malformed JSON chunk:', jsonStr.substring(0, 100));
                }
              }
            }
          }
        }
      }

      if (assistantMessage) {
        updateActiveChatMessages((prev) => {
          const newMessages = [...prev];
          const last = newMessages[newMessages.length - 1];
          if (!last || last.role !== 'assistant') {
            newMessages.push({ role: 'assistant', content: assistantMessage, timestamp: new Date(), usage: currentUsage });
          } else if (currentUsage && !last.usage) {
            // Update the last message with usage data if not already set
            newMessages[newMessages.length - 1] = { ...last, usage: currentUsage };
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Error communicating with agent:', error);
      updateActiveChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Failed to communicate with the agent'}`, timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{ width: 280, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
          <button
            onClick={createNewChat}
            style={{ padding: '8px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            + New Chat
          </button>
        </div>
        
        {/* Settings Panel */}
        <div style={{ borderBottom: '1px solid #e5e7eb' }}>
          <details open={showSettings} onToggle={(e) => setShowSettings((e.target as HTMLDetailsElement).open)}>
            <summary style={{ padding: '10px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#374151', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10 }}>{showSettings ? '▾' : '▸'}</span>
              <span>⚙️ Agent Settings</span>
            </summary>
            <div style={{ padding: '8px 12px', fontSize: 12, backgroundColor: '#f9fafb' }}>
              {/* Max Iterations */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: '#374151' }}>
                  Max Research Iterations
                </label>
                <input 
                  type="range" 
                  min="1" 
                  max="5" 
                  value={settings.maxIterations}
                  onChange={(e) => setSettings({...settings, maxIterations: parseInt(e.target.value)})}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                  <span>1 (quick)</span>
                  <span style={{ fontWeight: 600, color: '#1e40af' }}>{settings.maxIterations}</span>
                  <span>5 (thorough)</span>
                </div>
              </div>
              
              {/* Confidence Threshold */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: '#374151' }}>
                  Confidence Threshold (%)
                </label>
                <input 
                  type="range" 
                  min="50" 
                  max="95" 
                  step="5"
                  value={settings.confidenceThreshold}
                  onChange={(e) => setSettings({...settings, confidenceThreshold: parseInt(e.target.value)})}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                  <span>50% (lenient)</span>
                  <span style={{ fontWeight: 600, color: '#1e40af' }}>{settings.confidenceThreshold}%</span>
                  <span>95% (strict)</span>
                </div>
              </div>
              
              {/* Summary Mode */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: '#374151' }}>
                  Summary Mode
                </label>
                <select 
                  value={settings.summaryMode}
                  onChange={(e) => setSettings({...settings, summaryMode: e.target.value as 'brief' | 'balanced' | 'detailed'})}
                  style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 11 }}
                >
                  <option value="brief">Brief (concise)</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed (verbose)</option>
                </select>
              </div>
              
              {/* Max Response Length */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: '#374151' }}>
                  Max Response Length
                </label>
                <select 
                  value={settings.maxResponseLength}
                  onChange={(e) => setSettings({...settings, maxResponseLength: parseInt(e.target.value)})}
                  style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 11 }}
                >
                  <option value="5000">5K chars (short)</option>
                  <option value="10000">10K chars (standard)</option>
                  <option value="20000">20K chars (long)</option>
                  <option value="50000">50K chars (very long)</option>
                </select>
              </div>
              
              {/* Model Selection */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: '#374151' }}>
                  Model
                </label>
                <select 
                  value={settings.model}
                  onChange={(e) => {
                    const newModel = e.target.value;
                    const modelConfig = MODEL_CONFIGS[newModel];
                    // Adjust context window if current value exceeds new model's max
                    const newContextSize = settings.contextWindowSize > modelConfig.maxContextTokens 
                      ? modelConfig.supportedContextSizes[modelConfig.supportedContextSizes.length - 1]
                      : settings.contextWindowSize;
                    setSettings({...settings, model: newModel, contextWindowSize: newContextSize});
                  }}
                  style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 11 }}
                >
                  <option value="gpt-4o-2024-11-20">GPT-4o (latest) - 128K</option>
                  <option value="gpt-4o">GPT-4o - 128K</option>
                  <option value="o1-preview">o1 (preview) - 128K</option>
                  <option value="o1-mini">o1-mini - 128K</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo - 128K</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo - 16K</option>
                </select>
                <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>
                  {MODEL_CONFIGS[settings.model]?.description || 'Select a model'}
                </div>
              </div>
              
              {/* Context Window Size */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: '#374151' }}>
                  Context Window (tokens)
                </label>
                <select 
                  value={settings.contextWindowSize}
                  onChange={(e) => setSettings({...settings, contextWindowSize: parseInt(e.target.value)})}
                  style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 11 }}
                >
                  {MODEL_CONFIGS[settings.model]?.supportedContextSizes.map((size) => (
                    <option key={size} value={size}>
                      {size >= 1000 ? `${size / 1000}K` : size} tokens
                      {size === 2000 && ' (minimal)'}
                      {size === 4000 && ' (standard)'}
                      {size === 8000 && ' (extended)'}
                      {size === MODEL_CONFIGS[settings.model]?.maxContextTokens && ' (maximum)'}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>
                  Max for {MODEL_CONFIGS[settings.model]?.displayName}: {(MODEL_CONFIGS[settings.model]?.maxContextTokens / 1000).toFixed(0)}K tokens
                </div>
              </div>
              
              <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 8, padding: 6, backgroundColor: '#fef3c7', borderRadius: 4 }}>
                💡 Settings apply to new messages in the current chat
              </div>
            </div>
          </details>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {chats.length === 0 ? (
            <div style={{ padding: 12, color: '#6b7280' }}>No chats yet</div>
          ) : (
            chats.map((c) => (
              <div key={c.id} style={{ borderBottom: '1px solid #f3f4f6', position: 'relative' }}>
                <div
                  role="button"
                  onClick={() => selectChat(c.id)}
                  style={{ padding: '10px 12px', cursor: 'pointer', backgroundColor: c.id === activeChatId ? '#eef2ff' : 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.title || 'Untitled'}
                    </div>
                    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label="Chat actions"
                        title="More"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId((cur) => (cur === c.id ? null : c.id));
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          lineHeight: '28px',
                          textAlign: 'center',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: 16,
                        }}
                      >
                        ⋯
                      </button>
                      {openMenuId === c.id && (
                        <div
                          role="menu"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 32,
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                            borderRadius: 8,
                            minWidth: 140,
                            zIndex: 10,
                          }}
                        >
                          <button
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              renameChat(c.id);
                              setOpenMenuId(null);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 10px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                            }}
                          >
                            Rename
                          </button>
                          <div style={{ height: 1, background: '#f3f4f6' }} />
                          <button
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              deleteChat(c.id);
                              setOpenMenuId(null);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 10px',
                              border: 'none',
                              background: 'transparent',
                              color: '#ef4444',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{new Date(c.updatedAt).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(c.messages[c.messages.length - 1]?.content || '').slice(0, 60)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Web Research Planning Agent</h1>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{activeChat ? activeChat.title : ''}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, backgroundColor: '#f9fafb' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6b7280', marginTop: 40 }}>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 16 }}>🧠 Advanced Research Agent with Iterative Deep Reasoning</p>
              <p>This agent uses iterative reasoning - it goes back and forth, checking confidence and logic holes until it has a solid answer.</p>
              <p style={{ marginTop: 10 }}>You'll see the agent's complete iterative thought process:</p>
              <div style={{ marginTop: 20, display: 'inline-block', textAlign: 'left', backgroundColor: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ marginBottom: 8 }}>🤔 <strong>Thinking</strong> - Planning and reasoning</div>
                <div style={{ marginBottom: 8 }}>🔍 <strong>Research</strong> - Web search and browsing</div>
                <div style={{ marginBottom: 8 }}>🧐 <strong>Reflection</strong> - Confidence check & gap analysis</div>
                <div style={{ marginBottom: 8 }}>💡 <strong>Synthesis</strong> - Analyzing findings</div>
                <div>✅ <strong>Answer</strong> - Final response with citations</div>
              </div>
              <p style={{ marginTop: 20, fontSize: 14, fontWeight: 500 }}>The agent will iterate through Research → Reflection until confidence ≥ 85%</p>
              <p style={{ marginTop: 20, fontSize: 14 }}>Try asking: "Research the latest developments in AI agents and explain the key trends"</p>
              <p style={{ marginTop: 10, fontSize: 14 }}>You can also upload files (PDF, .txt, .js, .json) to include in your messages.</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                style={{ marginBottom: 16, padding: 12, borderRadius: 8, backgroundColor: message.role === 'user' ? '#dbeafe' : '#fff', border: message.role === 'assistant' ? '1px solid #e5e7eb' : 'none' }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 4, color: message.role === 'user' ? '#1e40af' : '#059669' }}>{message.role === 'user' ? 'You' : 'Assistant'}</div>
                <MessageContent content={message.content} role={message.role} />
                  {message.files && message.files.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {message.files.map((file) => (
                        <div
                          key={file.id}
                          onClick={() => openFilePreview(file)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#fff',
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          title={`Click to preview ${file.fileName}`}
                        >
                          <span>📎</span>
                          <span>{file.fileName}</span>
                          <span style={{ color: '#6b7280', fontSize: 11 }}>({formatFileSize(file.size)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {message.usage && (
                    <div style={{ marginTop: 8, padding: 8, backgroundColor: '#f3f4f6', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#374151' }}>📊 Token Usage</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', color: '#6b7280' }}>
                        <span>Input:</span>
                        <span style={{ fontWeight: 600, color: '#374151' }}>{message.usage.inputTokens.toLocaleString()} tokens</span>
                        <span>Output:</span>
                        <span style={{ fontWeight: 600, color: '#374151' }}>{message.usage.outputTokens.toLocaleString()} tokens</span>
                        <span style={{ fontSize: 10, gridColumn: '1 / -1', color: '#9ca3af', marginTop: 2 }}>
                          (Includes all sections: Thinking, Research, Reflection, Synthesis, Answer)
                        </span>
                        <span>Total:</span>
                        <span style={{ fontWeight: 600, color: '#059669' }}>{message.usage.totalTokens.toLocaleString()} tokens</span>
                      </div>
                      {message.usage.breakdown && (
                        <details style={{ marginTop: 8, cursor: 'pointer' }}>
                          <summary style={{ fontWeight: 600, color: '#374151', fontSize: 11 }}>📋 Input Breakdown</summary>
                          <div style={{ marginTop: 6, paddingLeft: 12, fontSize: 11 }}>
                            {/* Calculate sum of our estimates */}
                            {(() => {
                              const estimatedSum = 
                                message.usage.breakdown.userPromptTokens +
                                message.usage.breakdown.systemInstructionsTokens +
                                message.usage.breakdown.conversationContextTokens +
                                message.usage.breakdown.researchContextTokens +
                                message.usage.breakdown.toolDefinitionsTokens +
                                message.usage.breakdown.formattingOverheadTokens;
                              const actualInput = message.usage.inputTokens;
                              const difference = actualInput - estimatedSum;
                              
                              return (
                                <>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', marginBottom: 8 }}>
                                    <span>User Prompt:</span>
                                    <span style={{ fontWeight: 600 }}>{message.usage.breakdown.userPromptTokens.toLocaleString()} tokens</span>
                                    <span>System Instructions:</span>
                                    <span style={{ fontWeight: 600 }}>{message.usage.breakdown.systemInstructionsTokens.toLocaleString()} tokens</span>
                                    <span>Tool Definitions:</span>
                                    <span style={{ fontWeight: 600 }}>{message.usage.breakdown.toolDefinitionsTokens.toLocaleString()} tokens</span>
                                    <span>Conversation Context:</span>
                                    <span style={{ fontWeight: 600 }}>{message.usage.breakdown.conversationContextTokens.toLocaleString()} tokens</span>
                                    <span>Stored Research (from context):</span>
                                    <span style={{ fontWeight: 600 }}>{message.usage.breakdown.researchContextTokens.toLocaleString()} tokens</span>
                                    <span>Formatting Overhead:</span>
                                    <span style={{ fontWeight: 600 }}>{message.usage.breakdown.formattingOverheadTokens.toLocaleString()} tokens</span>
                                  </div>
                                  
                                  <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 6, marginTop: 6 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 10 }}>
                                      <span>Estimated Total:</span>
                                      <span style={{ fontWeight: 600, color: '#6b7280' }}>{estimatedSum.toLocaleString()} tokens</span>
                                      <span>Actual API Input:</span>
                                      <span style={{ fontWeight: 600, color: '#1e40af' }}>{actualInput.toLocaleString()} tokens</span>
                                      {difference !== 0 && (
                                        <>
                                          <span>{difference > 0 ? 'Unaccounted (API overhead):' : 'Over-estimated:'}</span>
                                          <span style={{ fontWeight: 600, color: difference > 0 ? '#dc2626' : '#059669' }}>
                                            {difference > 0 ? '+' : ''}{difference.toLocaleString()} tokens
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {difference > 0 && (
                                      <div style={{ marginTop: 4, padding: 4, backgroundColor: '#fef3c7', borderRadius: 4, fontSize: 9, color: '#92400e' }}>
                                        ⓘ Additional tokens used by OpenAI API for model-specific formatting, token encoding overhead, or other internal processing.
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 6, marginTop: 6, fontSize: 10, color: '#6b7280' }}>
                                    <div>Stored Documents: {message.usage.breakdown.storedDocumentsCount} docs 
                                      ({message.usage.breakdown.storedDocumentsTokens.toLocaleString()} tokens available for future retrieval)
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{message.timestamp.toLocaleTimeString()}</div>
                </div>
              ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', padding: 16 }}>
          {totalUsage && (
            <div style={{ marginBottom: 12, padding: 12, backgroundColor: '#f0f9ff', border: '2px solid #3b82f6', borderRadius: 8 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#1e40af', fontSize: 14 }}>
                📊 Total Token Usage (This Conversation)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, fontSize: 13 }}>
                <div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>Total Input</div>
                  <div style={{ fontWeight: 700, color: '#374151', fontSize: 16 }}>
                    {totalUsage.inputTokens.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>Total Output</div>
                  <div style={{ fontWeight: 700, color: '#374151', fontSize: 16 }}>
                    {totalUsage.outputTokens.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>Total Tokens</div>
                  <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 16 }}>
                    {totalUsage.totalTokens.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>Responses</div>
                  <div style={{ fontWeight: 700, color: '#374151', fontSize: 16 }}>
                    {totalUsage.messageCount}
                  </div>
                </div>
              </div>
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  onMouseEnter={() => setHoveredFileId(file.id)}
                  onMouseLeave={() => setHoveredFileId(null)}
                  style={{
                    position: 'relative',
                    padding: '6px 12px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>📎</span>
                  <span 
                    onClick={() => openFilePreview(file)}
                    style={{ cursor: 'pointer' }}
                    title={`Click to preview ${file.fileName}`}
                  >
                    {file.fileName}
                  </span>
                  <span style={{ color: '#6b7280', fontSize: 11 }}>({formatFileSize(file.size)})</span>
                  {hoveredFileId === file.id && (
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                      }}
                      title="Delete file"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10 }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.txt,.js,.json"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isLoading || !activeChat}
              style={{
                padding: '12px 16px',
                backgroundColor: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 16,
                cursor: isUploading || isLoading || !activeChat ? 'not-allowed' : 'pointer',
                color: '#374151',
              }}
              title="Upload file"
            >
              {isUploading ? '⏳' : '📎'}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the agent to research something..."
              disabled={isLoading || !activeChat}
              style={{ flex: 1, padding: 12, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 16, outline: 'none' }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !activeChat}
              style={{ padding: '12px 24px', backgroundColor: isLoading || !input.trim() || !activeChat ? '#d1d5db' : '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: isLoading || !input.trim() || !activeChat ? 'not-allowed' : 'pointer', fontWeight: 500 }}
            >
              {isLoading ? 'Researching...' : 'Send'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
