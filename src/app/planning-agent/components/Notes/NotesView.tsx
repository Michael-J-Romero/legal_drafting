'use client';

import { useState } from 'react';
import { Note } from '../../types';

interface NotesViewProps {
  notes: Note[];
  pendingNotes: Note[];
  acceptPendingNote: (noteId: string) => void;
  rejectPendingNote: (noteId: string) => void;
  deleteNote: (noteId: string) => void;
  setNotes?: (notes: Note[]) => void;
  notesGraph?: any;
  setNotesGraph?: (graph: any) => void;
}

interface Contradiction {
  note1: string;
  note2: string;
  reason: string;
}

interface RefinementResult {
  removedDuplicates: number;
  removedGeneric: number;
  contradictions: Contradiction[];
}

interface NotesGraph {
  case?: {
    jurisdiction?: Record<string, any>;
    parties?: Record<string, any>;
    events?: Record<string, any>;
    evidence?: any[];
  };
  documents?: Record<string, any>;
  [key: string]: any;
}

// Helper to format source type for display
function formatSourceType(sourceType: string): string {
  const map: Record<string, string> = {
    'website': '🌐 Website',
    'document': '📄 Document',
    'user_prompt': '👤 User Input',
    'agent_ai': '🤖 AI Agent',
    'research': '🔍 Research',
    'conversation': '💬 Conversation',
  };
  return map[sourceType] || sourceType;
}

export default function NotesView({
  notes,
  pendingNotes,
  acceptPendingNote,
  rejectPendingNote,
  deleteNote,
  setNotes,
  notesGraph,
  setNotesGraph,
}: NotesViewProps) {
  const [isRefining, setIsRefining] = useState(false);
  const [isGraphing, setIsGraphing] = useState(false);
  const [refinementResult, setRefinementResult] = useState<RefinementResult | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRefineNotes = async () => {
    if (notes.length === 0) {
      return; // Button is already disabled when no notes
    }

    setIsRefining(true);
    setRefinementResult(null);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/refine-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to refine notes');
      }

      const data = await response.json();
      
      if (data.refinedNotes && setNotes) {
        setNotes(data.refinedNotes);
        setRefinementResult({
          removedDuplicates: data.removedDuplicates || 0,
          removedGeneric: data.removedGeneric || 0,
          contradictions: data.contradictions || [],
        });
      }
    } catch (error) {
      console.error('Error refining notes:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to refine notes');
    } finally {
      setIsRefining(false);
    }
  };

  const handleGraphNotes = async () => {
    if (notes.length === 0) {
      return; // Button is already disabled when no notes
    }

    setIsGraphing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/graph-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          notes,
          existingGraph: notesGraph 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create graph');
      }

      const data = await response.json();
      
      if (data.graph && setNotesGraph) {
        setNotesGraph(data.graph);
        setShowGraph(true);
      }
    } catch (error) {
      console.error('Error graphing notes:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create graph');
    } finally {
      setIsGraphing(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📝 Notes & Goals</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleRefineNotes}
              disabled={isRefining || notes.length === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: isRefining || notes.length === 0 ? '#d1d5db' : '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: isRefining || notes.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
              title="Remove duplicates, generic info, and flag contradictions"
            >
              {isRefining ? '⏳ Refining...' : '🧹 Refine Notes'}
            </button>
            <button
              onClick={handleGraphNotes}
              disabled={isGraphing || notes.length === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: isGraphing || notes.length === 0 ? '#d1d5db' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: isGraphing || notes.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
              title="Convert notes into hierarchical graph structure"
            >
              {isGraphing ? '⏳ Graphing...' : '📊 Graph Notes'}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
          AI-extracted notes with full context from your conversations
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div style={{ padding: 16, backgroundColor: '#fee2e2', borderBottom: '1px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#991b1b' }}>
              ❌ Error: {errorMessage}
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              style={{
                padding: '4px 12px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Refinement Results */}
      {refinementResult && (
        <div style={{ padding: 16, backgroundColor: '#dbeafe', borderBottom: '1px solid #3b82f6' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>
            ✨ Refinement Complete
          </div>
          <div style={{ fontSize: 13, color: '#1e3a8a' }}>
            <div>✓ Removed {refinementResult.removedDuplicates} duplicate(s)</div>
            <div>✓ Removed {refinementResult.removedGeneric} generic/irrelevant note(s)</div>
            {refinementResult.contradictions.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, color: '#dc2626' }}>⚠️ Found {refinementResult.contradictions.length} contradiction(s):</div>
                {refinementResult.contradictions.map((c, idx) => (
                  <div key={idx} style={{ marginLeft: 16, marginTop: 4, fontSize: 12 }}>
                    <div>• "{c.note1}" vs "{c.note2}"</div>
                    <div style={{ marginLeft: 12, color: '#6b7280' }}>{c.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setRefinementResult(null)}
            style={{
              marginTop: 8,
              padding: '4px 12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Graph View Modal */}
      {showGraph && notesGraph && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000 
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: 8, 
            padding: 24, 
            maxWidth: '80%', 
            maxHeight: '80%', 
            overflow: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>📊 Notes Graph</h3>
              <button
                onClick={() => setShowGraph(false)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Close
              </button>
            </div>
            <pre style={{ 
              fontSize: 12, 
              backgroundColor: '#f3f4f6', 
              padding: 16, 
              borderRadius: 6, 
              overflow: 'auto',
              maxHeight: '60vh'
            }}>
              {JSON.stringify(notesGraph, null, 2)}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(notesGraph, null, 2));
              }}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              📋 Copy to Clipboard
            </button>
          </div>
        </div>
      )}

      {/* Pending Notes (waiting for approval) */}
      {pendingNotes.length > 0 && (
        <div style={{ borderBottom: '2px solid #fbbf24', backgroundColor: '#fef3c7' }}>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#92400e', marginBottom: 12 }}>
              ⚠️ New Notes (Review & Accept)
            </div>
            {pendingNotes.map((note) => (
              <div
                key={note.id}
                style={{
                  marginBottom: 12,
                  padding: 12,
                  backgroundColor: '#fff',
                  border: '2px solid #fbbf24',
                  borderRadius: 6,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 6, textTransform: 'uppercase' }}>
                  {note.category}
                </div>
                <div style={{ fontSize: 14, color: '#111827', marginBottom: 10, lineHeight: 1.5 }}>
                  {note.content}
                </div>
                
                {/* Source Information */}
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, padding: 8, backgroundColor: '#f9fafb', borderRadius: 4 }}>
                  <div style={{ marginBottom: 4 }}>
                    <strong>Source:</strong> {formatSourceType(note.source.type)}
                    {note.source.url && <> • <a href={note.source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>Link</a></>}
                    {note.source.documentName && <> • {note.source.documentName}</>}
                  </div>
                  {(note.context.who || note.context.what || note.context.when || note.context.where) && (
                    <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                      {note.context.who && <div><strong>Who:</strong> {note.context.who.join(', ')}</div>}
                      {note.context.what && <div><strong>What:</strong> {note.context.what}</div>}
                      {note.context.when && <div><strong>When:</strong> {note.context.when}</div>}
                      {note.context.where && <div><strong>Where:</strong> {note.context.where}</div>}
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => acceptPendingNote(note.id)}
                    style={{
                      padding: '6px 16px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    ✓ Accept
                  </button>
                  <button
                    onClick={() => rejectPendingNote(note.id)}
                    style={{
                      padding: '6px 16px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    × Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {notes.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40, fontSize: 14 }}>
            <p style={{ fontSize: 16, marginBottom: 10 }}>No notes yet</p>
            <p>The AI will create notes as you chat about dates, documents, goals, etc.</p>
          </div>
        ) : (
          <>
            {/* Group notes by category */}
            {['goals', 'dates', 'deadlines', 'documents', 'requirements', 'places', 'people', 'other'].map((category) => {
              const categoryNotes = notes.filter((n) => n.category === category);
              if (categoryNotes.length === 0) return null;

              return (
                <div key={category} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase' }}>
                    {category === 'goals' && '🎯 '}
                    {category === 'dates' && '📅 '}
                    {category === 'deadlines' && '⏰ '}
                    {category === 'documents' && '📄 '}
                    {category === 'requirements' && '✓ '}
                    {category === 'places' && '📍 '}
                    {category === 'people' && '👤 '}
                    {category}
                  </div>
                  {categoryNotes.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        marginBottom: 10,
                        padding: 12,
                        backgroundColor: note.isNew ? '#d1fae5' : '#fff',
                        border: note.isNew ? '2px solid #10b981' : '1px solid #e5e7eb',
                        borderRadius: 6,
                        position: 'relative',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <div style={{ fontSize: 14, color: '#111827', marginBottom: 6, lineHeight: 1.5 }}>
                        {note.content}
                      </div>
                      
                      {/* Context Information */}
                      {(note.context.who || note.context.what || note.context.when || note.context.where) && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, padding: 6, backgroundColor: '#f9fafb', borderRadius: 4 }}>
                          {note.context.who && <div><strong>Who:</strong> {note.context.who.join(', ')}</div>}
                          {note.context.what && <div><strong>What:</strong> {note.context.what}</div>}
                          {note.context.when && <div><strong>When:</strong> {note.context.when}</div>}
                          {note.context.where && <div><strong>Where:</strong> {note.context.where}</div>}
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>
                          {formatSourceType(note.source.type)} • {new Date(note.updatedAt).toLocaleDateString()}
                        </div>
                        <button
                          onClick={() => deleteNote(note.id)}
                          style={{
                            padding: '2px 8px',
                            backgroundColor: 'transparent',
                            color: '#ef4444',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 13,
                          }}
                          title="Delete note"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
