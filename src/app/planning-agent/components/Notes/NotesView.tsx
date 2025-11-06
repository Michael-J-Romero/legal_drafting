'use client';

import { Note } from '../../notes';

interface NotesViewProps {
  notes: Note[];
  pendingNotes: Note[];
  acceptPendingNote: (noteId: string) => void;
  rejectPendingNote: (noteId: string) => void;
  deleteNote: (noteId: string) => void;
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
}: NotesViewProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📝 Notes & Goals</h2>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
          AI-extracted notes with full context from your conversations
        </p>
      </div>

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
