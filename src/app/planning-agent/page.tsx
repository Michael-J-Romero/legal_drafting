'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
}

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO
  files?: StoredUploadedFile[];
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
  type: 'thinking' | 'research' | 'synthesis' | 'answer' | 'plain';
  content: string;
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
    return [{ type: 'plain', content }];
  }
  
  // Sort positions by index
  positions.sort((a, b) => a.index - b.index);
  
  // Add content before first section if any
  if (positions[0].index > 0) {
    sections.push({
      type: 'plain',
      content: content.substring(0, positions[0].index).trim(),
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
      });
    }
  }
  
  return sections;
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
      <div style={{ fontWeight: 'bold', marginBottom: 8, color: style.color, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{style.icon}</span>
        <span>{style.title}</span>
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

    const conversationToSend = [...messages, { role: 'user' as const, content: messageContent, timestamp: new Date() }];

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
        body: JSON.stringify({ messages: conversationToSend }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                console.error('Stream error:', data.error);
                assistantMessage += `\n\nError: ${data.error}`;
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
              console.error('Error parsing chunk:', err);
            }
          }
        }
      }

      if (assistantMessage) {
        updateActiveChatMessages((prev) => {
          const newMessages = [...prev];
          const last = newMessages[newMessages.length - 1];
          if (!last || last.role !== 'assistant') {
            newMessages.push({ role: 'assistant', content: assistantMessage, timestamp: new Date() });
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
              <p style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 16 }}>🧠 Advanced Research Agent with Deep Reasoning</p>
              <p>This agent works like GitHub Copilot Agent or ChatGPT Deep Research.</p>
              <p style={{ marginTop: 10 }}>You'll see the agent's complete thought process:</p>
              <div style={{ marginTop: 20, display: 'inline-block', textAlign: 'left', backgroundColor: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ marginBottom: 8 }}>🤔 <strong>Thinking</strong> - Planning and reasoning</div>
                <div style={{ marginBottom: 8 }}>🔍 <strong>Research</strong> - Web search and browsing</div>
                <div style={{ marginBottom: 8 }}>💡 <strong>Synthesis</strong> - Analyzing findings</div>
                <div>✅ <strong>Answer</strong> - Final response with citations</div>
              </div>
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
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{message.timestamp.toLocaleTimeString()}</div>
                </div>
              ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', padding: 16 }}>
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
