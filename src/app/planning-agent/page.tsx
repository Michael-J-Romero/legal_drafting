'use client';

import { useState, useRef, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { loadPdfjs, ensurePdfjsWorker } from '../lib/pdfjsLoader';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UploadedContext {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = ensurePdfjsWorker(await loadPdfjs(), 'component:extract');
  if (!pdfjs || typeof pdfjs.getDocument !== 'function') {
    throw new Error('Failed to load PDF parser');
  }

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const doc = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'str' in item) return item.str;
        return '';
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text) {
      pageTexts.push(`Page ${pageNumber}: ${text}`);
    }
  }

  if (typeof doc.cleanup === 'function') {
    await doc.cleanup();
  }

  return pageTexts.join('\n\n');
}

export default function PlanningAgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedContexts, setUploadedContexts] = useState<UploadedContext[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Live browser UI removed

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (!files || files.length === 0) {
      return;
    }

    setUploadError(null);
    setIsProcessingFiles(true);

    const newContexts: UploadedContext[] = [];
    for (const file of Array.from(files)) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        setUploadError('Only PDF files are supported at this time.');
        continue;
      }

      try {
        const textContent = await extractTextFromPdf(file);
        if (!textContent) {
          setUploadError(
            `We could not extract text from ${file.name}. Please ensure the PDF is not a scanned image.`
          );
          continue;
        }

        newContexts.push({
          id: generateId(),
          name: file.name,
          type: file.type || 'application/pdf',
          size: file.size,
          content: textContent,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error extracting PDF text';
        setUploadError(`Failed to process ${file.name}: ${message}`);
      }
    }

    if (newContexts.length > 0) {
      setUploadedContexts((prev) => [...prev, ...newContexts]);
    }

    setIsProcessingFiles(false);
    event.target.value = '';
  };

  const handleRemoveContext = (id: string) => {
    setUploadedContexts((prev) => prev.filter((ctx) => ctx.id !== id));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!input.trim() || isLoading || isProcessingFiles) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const serializedMessages = updatedMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : new Date(msg.timestamp).toISOString(),
      }));

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input.trim(),
          messages: serializedMessages,
          contexts: uploadedContexts.map(({ name, content, type }) => ({
            name,
            content,
            type,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.error) {
                  console.error('Stream error:', data.error);
                  assistantMessage += `\n\nError: ${data.error}`;
                } else if (data.type === 'output_text_delta' && data.data?.delta) {
                  // Handle OpenAI Agents SDK output_text_delta format
                  const content = data.data.delta;
                  assistantMessage += content;
                  
                  // Update the assistant message in real-time
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    
                    if (lastMessage && lastMessage.role === 'assistant') {
                      // Create a new message object instead of mutating
                      newMessages[newMessages.length - 1] = {
                        ...lastMessage,
                        content: assistantMessage,
                      };
                    } else {
                      newMessages.push({
                        role: 'assistant',
                        content: assistantMessage,
                        timestamp: new Date(),
                      });
                    }
                    
                    return newMessages;
                  });
                } else if (data.type === 'raw_model_stream_event' && data.data?.type === 'output_text_delta') {
                  // Handle raw model stream events with delta
                  const content = data.data.delta;
                  assistantMessage += content;
                  
                  // Update the assistant message in real-time
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    
                    if (lastMessage && lastMessage.role === 'assistant') {
                      // Create a new message object instead of mutating
                      newMessages[newMessages.length - 1] = {
                        ...lastMessage,
                        content: assistantMessage,
                      };
                    } else {
                      newMessages.push({
                        role: 'assistant',
                        content: assistantMessage,
                        timestamp: new Date(),
                      });
                    }
                    
                    return newMessages;
                  });
                }
              } catch (e) {
                console.error('Error parsing chunk:', e);
              }
            }
          }
        }
      }

      // Ensure we have a final assistant message
      if (assistantMessage) {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          
          if (!lastMessage || lastMessage.role !== 'assistant') {
            newMessages.push({
              role: 'assistant',
              content: assistantMessage,
              timestamp: new Date(),
            });
          }
          
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Error communicating with agent:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to communicate with the agent'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
    }}>
      <h1 style={{ marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>
        Web Research Planning Agent
      </h1>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        backgroundColor: '#f9fafb',
      }}>
        {messages.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: '#6b7280', 
            marginTop: '40px' 
          }}>
            <p>Start a conversation with the research agent.</p>
            <p style={{ marginTop: '10px', fontSize: '14px' }}>
              Try asking: &quot;Research the latest developments in AI agents&quot;
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              style={{
                marginBottom: '16px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: message.role === 'user' ? '#dbeafe' : '#fff',
                border: message.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
              }}
            >
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '4px',
                color: message.role === 'user' ? '#1e40af' : '#059669',
              }}>
                {message.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {message.content}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                marginTop: '4px' 
              }}>
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px',
            border: '1px dashed #cbd5f5',
            borderRadius: '8px',
            backgroundColor: '#eef2ff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#312e81' }}>Supporting documents</div>
              <div style={{ fontSize: '14px', color: '#4c51bf' }}>
                Upload PDFs to give the agent additional context for this conversation.
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFiles || isLoading}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #4338ca',
                backgroundColor: isProcessingFiles || isLoading ? '#c7d2fe' : '#4f46e5',
                color: 'white',
                fontSize: '14px',
                fontWeight: 500,
                cursor: isProcessingFiles || isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isProcessingFiles ? 'Processing…' : 'Upload PDF'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {uploadError ? (
            <div style={{ color: '#b91c1c', fontSize: '14px' }}>{uploadError}</div>
          ) : null}

          {uploadedContexts.length > 0 ? (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {uploadedContexts.map((context) => (
                <li
                  key={context.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    border: '1px solid #c7d2fe',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: '#1e3a8a' }}>{context.name}</div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      {(context.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveContext(context.id)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #b91c1c',
                      backgroundColor: 'white',
                      color: '#b91c1c',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ fontSize: '14px', color: '#4c51bf' }}>No documents uploaded yet.</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the agent to research something..."
            disabled={isLoading || isProcessingFiles}
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || isProcessingFiles || !input.trim()}
            style={{
              padding: '12px 24px',
              backgroundColor: isLoading || isProcessingFiles || !input.trim() ? '#d1d5db' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: isLoading || isProcessingFiles || !input.trim() ? 'not-allowed' : 'pointer',
              fontWeight: '500',
            }}
          >
            {isLoading ? 'Researching...' : 'Send'}
          </button>
        </div>
      </form>

    </div>
  );
}
