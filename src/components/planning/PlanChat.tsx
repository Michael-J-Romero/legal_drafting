'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Plan, ChatMessage } from '../../types/plan';

interface PlanChatProps {
  plan: Plan | null;
  selectedNodeId: string | null;
  onPlanUpdate: (plan: Plan) => void;
}

/**
 * Placeholder chat interface component for AI-guided plan creation
 * Users will interact with the AI to define and refine their plan
 */
export default function PlanChat({
  plan,
  selectedNodeId,
  onPlanUpdate,
}: PlanChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'system',
      content: 'Welcome to the Plan Chat! I\'ll help you define your plan by guiding you through the process. Let\'s start by defining your end goal and starting point.',
      timestamp: new Date(),
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue('');

    // Placeholder AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I received your message: "' + inputValue + '". The AI planning agent will be integrated soon to help you create and refine your plan.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 500);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#f9fafb'
    }}>
      {/* Chat header */}
      <div style={{ 
        padding: '12px 16px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#fff'
      }}>
        <h3 style={{ 
          fontSize: 16, 
          fontWeight: 600, 
          color: '#111827',
          margin: 0
        }}>
          AI Planning Assistant
        </h3>
        {selectedNodeId && (
          <p style={{ 
            fontSize: 12, 
            color: '#6b7280',
            margin: '4px 0 0 0'
          }}>
            Editing: {selectedNodeId}
          </p>
        )}
      </div>

      {/* Messages area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.map((message) => (
          <div 
            key={message.id}
            style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}
          >
            <div style={{
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: message.role === 'user' 
                ? '#3b82f6' 
                : message.role === 'system'
                ? '#f3f4f6'
                : '#fff',
              color: message.role === 'user' ? '#fff' : '#111827',
              border: message.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
              fontSize: 14,
              lineHeight: 1.5,
            }}>
              {message.content}
            </div>
            <div style={{
              fontSize: 11,
              color: '#9ca3af',
              marginTop: 4,
              textAlign: message.role === 'user' ? 'right' : 'left',
            }}>
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form 
        onSubmit={handleSendMessage}
        style={{ 
          padding: 16,
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#fff'
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message..."
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: inputValue.trim() ? '#3b82f6' : '#e5e7eb',
              color: inputValue.trim() ? '#fff' : '#9ca3af',
              fontSize: 14,
              fontWeight: 500,
              cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
