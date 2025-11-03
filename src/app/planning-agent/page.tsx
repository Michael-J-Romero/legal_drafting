'use client';

import { useState, useRef, useEffect, ChangeEvent } from 'react';

interface UploadedFile {
  name: string;
  size: number;
  base64: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function PlanningAgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Live browser UI removed

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;

    if (!fileList || fileList.length === 0) {
      return;
    }

    setUploadError(null);

    const filesArray = Array.from(fileList);

    try {
      const processedFiles = await Promise.all(
        filesArray.map(async (file) => {
          if (file.type !== 'application/pdf') {
            throw new Error('Only PDF files are supported');
          }

          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result !== 'string') {
                reject(new Error('Failed to read file'));
                return;
              }

              const [, encoded] = reader.result.split(',');
              if (!encoded) {
                reject(new Error('Could not extract base64 content'));
                return;
              }

              resolve(encoded);
            };
            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsDataURL(file);
          });

          return {
            name: file.name,
            size: file.size,
            base64,
          } satisfies UploadedFile;
        })
      );

      setUploadedFiles((prev) => [...prev, ...processedFiles]);
    } catch (error) {
      console.error('Error processing uploaded files:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to process uploaded file');
    } finally {
      event.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

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
          files:
            uploadedFiles.length > 0
              ? uploadedFiles.map(({ name, base64 }) => ({
                  name,
                  content: base64,
                }))
              : undefined,
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent to research something..."
          disabled={isLoading}
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
          disabled={isLoading || !input.trim()}
          style={{
            padding: '12px 24px',
            backgroundColor: isLoading || !input.trim() ? '#d1d5db' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            fontWeight: '500',
          }}
        >
          {isLoading ? 'Researching...' : 'Send'}
        </button>
      </form>

      <div style={{
        marginTop: '16px',
        padding: '16px',
        border: '1px dashed #9ca3af',
        borderRadius: '8px',
        backgroundColor: '#f3f4f6',
      }}>
        <label
          htmlFor="context-upload"
          style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}
        >
          Add contextual documents (PDF only)
        </label>
        <input
          id="context-upload"
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileChange}
          disabled={isLoading}
        />
        {uploadError ? (
          <p style={{ color: '#dc2626', marginTop: '8px' }}>{uploadError}</p>
        ) : (
          <p style={{ color: '#6b7280', marginTop: '8px', fontSize: '14px' }}>
            Uploaded documents will be shared with the agent as additional context.
          </p>
        )}
        {uploadedFiles.length > 0 && (
          <ul style={{ marginTop: '12px', paddingLeft: '20px', color: '#1f2937' }}>
            {uploadedFiles.map((file, index) => (
              <li key={`${file.name}-${index}`} style={{ marginBottom: '6px' }}>
                <span>
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  style={{
                    marginLeft: '8px',
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    cursor: 'pointer',
                  }}
                  disabled={isLoading}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
