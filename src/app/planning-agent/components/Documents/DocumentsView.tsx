'use client';

import { useState, useRef, useEffect } from 'react';
import { Document, StoredDocument, Note } from '../../types';
import { generateId, formatFileSize } from '../../utils/helpers';
import { createNote, createDocumentSource, deserializeNote, serializeNote, validateCategory } from '../../notes';
import { addNotesToPathGraph, loadPathGraph } from '../../pathGraph';

const DOCUMENTS_STORAGE_KEY = 'planningAgentDocuments';

interface ExtractedNote {
  content: string;
  category: string;
  path?: {
    path: string;
    segments: string[];
    references?: string[];
  };
  context?: {
    who?: string[];
    what?: string;
    when?: string;
    where?: string;
    relatedTo?: string[];
  };
  confidence?: number;
  source?: {
    type: string;
    url?: string;
    documentName?: string;
    originatingMessage?: string;
    aiModel?: string;
    sourceTimestamp: string;
    metadata?: Record<string, any>;
  };
}

function hydrateDocuments(stored: StoredDocument[]): Document[] {
  return stored.map((doc) => ({
    ...doc,
    uploadedAt: new Date(doc.uploadedAt),
    analyzedAt: doc.analyzedAt ? new Date(doc.analyzedAt) : undefined,
    notes: doc.notes.map((n) => deserializeNote(n)),
  }));
}

function dehydrateDocuments(documents: Document[]): StoredDocument[] {
  return documents.map((doc) => ({
    ...doc,
    uploadedAt: doc.uploadedAt.toISOString(),
    analyzedAt: doc.analyzedAt?.toISOString(),
    notes: doc.notes.map((n) => serializeNote(n)),
  }));
}

type CreateMode = 'upload' | 'paste' | 'generate';

export default function DocumentsView() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New document creation states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('upload');
  const [pastedText, setPastedText] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // AI chat panel states
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string, timestamp: Date}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const [pendingDocumentEdit, setPendingDocumentEdit] = useState<{content: string, title?: string} | null>(null);
  const [showViewEditsModal, setShowViewEditsModal] = useState(false);
  const [documentHasUnappliedEdits, setDocumentHasUnappliedEdits] = useState<{[docId: string]: boolean}>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Helper function to process notes through path graph
  const processNotesWithPathGraph = async (notes: Note[]): Promise<Note[]> => {
    console.log('[DocumentsView] Sending', notes.length, 'notes to path graph API');
    const pathGraphResult = await addNotesToPathGraph(notes);
    
    if (pathGraphResult.success && pathGraphResult.updatedNotes) {
      console.log('[DocumentsView] Path graph assigned paths to', pathGraphResult.updatedNotes.length, 'notes');
      
      // Update notes with paths from graph
      return notes.map(note => {
        const updatedNote = pathGraphResult.updatedNotes.find(n => n.id === note.id);
        if (updatedNote && updatedNote.path) {
          return { ...note, path: updatedNote.path };
        }
        return note;
      });
    } else {
      console.warn('[DocumentsView] Path graph assignment failed:', pathGraphResult.error);
      return notes;
    }
  };

  // Load documents from localStorage on mount
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(DOCUMENTS_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as StoredDocument[];
        const hydrated = hydrateDocuments(parsed);
        setDocuments(hydrated);
        
        // Check if there's a selected document ID from navigation
        const preSelectedId = typeof window !== 'undefined' ? localStorage.getItem('selectedDocumentId') : null;
        if (preSelectedId && hydrated.some(d => d.id === preSelectedId)) {
          setSelectedDocumentId(preSelectedId);
          // Clear the stored ID after using it
          localStorage.removeItem('selectedDocumentId');
        } else if (hydrated.length > 0) {
          setSelectedDocumentId(hydrated[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load documents from storage', e);
      // Reset storage if corrupted
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DOCUMENTS_STORAGE_KEY);
      }
      setDocuments([]);
    }
  }, []);

  // Listen for document selection events from notes
  useEffect(() => {
    const handleSelectDocument = (event: CustomEvent) => {
      const { documentId } = event.detail;
      if (documentId && documents.some(d => d.id === documentId)) {
        setSelectedDocumentId(documentId);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('selectDocument', handleSelectDocument as EventListener);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('selectDocument', handleSelectDocument as EventListener);
      }
    };
  }, [documents]);

  // Persist documents to localStorage when they change
  useEffect(() => {
    try {
      const dehydrated = dehydrateDocuments(documents);
      localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(dehydrated));
      
      // Dispatch event to notify other components
      if (typeof window !== 'undefined') {
        console.log('[DocumentsView] Dispatching documentsUpdated event, documents:', documents.length);
        window.dispatchEvent(new CustomEvent('documentsUpdated'));
      }
    } catch (e) {
      console.error('Failed to save documents to storage', e);
    }
  }, [documents]);

  const selectedDocument = documents.find((doc) => doc.id === selectedDocumentId);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');

    try {
      // Step 1: Upload and extract text
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadData.success || !uploadData.text) {
        throw new Error(uploadData.error || 'Failed to upload file');
      }

      // Create document with extracted text
      const newDocument: Document = {
        id: generateId(),
        fileName: uploadData.fileName,
        fileType: uploadData.fileType,
        size: uploadData.size,
        text: uploadData.text,
        notes: [],
        uploadedAt: new Date(),
      };

      // Add document to list
      setDocuments((prev) => [newDocument, ...prev]);
      setSelectedDocumentId(newDocument.id);

      // Step 2: Analyze document (generate summary and notes)
      setIsAnalyzing(true);
      
      const analyzeResponse = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: uploadData.text,
          fileName: uploadData.fileName,
          fileType: uploadData.fileType,
        }),
      });

      const analyzeData = await analyzeResponse.json();

      if (analyzeResponse.ok && analyzeData.summary) {
        // Create initial notes from API response
        let analyzedNotes: Note[] = (analyzeData.notes || [])
          .filter((note: ExtractedNote) => note.content && typeof note.content === 'string')
          .map((note: ExtractedNote) => {
            // Use centralized note creation with full context
            const baseSource = note.source ? {
              type: note.source.type as any, // Type comes from API, needs runtime validation
              url: note.source.url,
              documentName: note.source.documentName || uploadData.fileName,
              originatingMessage: note.source.originatingMessage || `Analyzed document: ${uploadData.fileName}`,
              aiModel: note.source.aiModel || 'gpt-4o-mini',
              sourceTimestamp: note.source.sourceTimestamp ? new Date(note.source.sourceTimestamp) : new Date(),
              metadata: { documentId: newDocument.id },
            } : createDocumentSource({
              documentName: uploadData.fileName,
              originatingMessage: `Analyzed document: ${uploadData.fileName}`,
            });
            
            // Ensure metadata is added
            baseSource.metadata = { ...baseSource.metadata, documentId: newDocument.id };
            
            return createNote({
              path: note.path,
              content: note.content,
              category: validateCategory(note.category),
              source: baseSource,
              context: note.context || {},
              confidence: note.confidence,
            });
          });

        // Process notes through path graph to get hierarchical paths
        analyzedNotes = await processNotesWithPathGraph(analyzedNotes);

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === newDocument.id
              ? {
                  ...doc,
                  summary: analyzeData.summary,
                  notes: analyzedNotes,
                  analyzedAt: new Date(),
                }
              : doc
          )
        );
      } else {
        console.warn('Document analysis failed:', analyzeData.error);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during upload');
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCreateFromText = async () => {
    if (!pastedText.trim() || !documentName.trim()) {
      setError('Please provide both document name and text content');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      // Create document with pasted text
      const newDocument: Document = {
        id: generateId(),
        fileName: documentName.trim() + '.txt',
        fileType: '.txt',
        size: pastedText.length,
        text: pastedText.trim(),
        notes: [],
        uploadedAt: new Date(),
      };

      // Add document to list
      setDocuments((prev) => [newDocument, ...prev]);
      setSelectedDocumentId(newDocument.id);

      // Analyze the pasted text
      const analyzeResponse = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: pastedText.trim(),
          fileName: newDocument.fileName,
          fileType: '.txt',
        }),
      });

      const analyzeData = await analyzeResponse.json();

      if (analyzeResponse.ok && analyzeData.summary) {
        let analyzedNotes: Note[] = (analyzeData.notes || [])
          .filter((note: ExtractedNote) => note.content && typeof note.content === 'string')
          .map((note: ExtractedNote) => {
            // Use centralized note creation with full context
            const baseSource = note.source ? {
              type: note.source.type as any, // Type comes from API, needs runtime validation
              url: note.source.url,
              documentName: note.source.documentName || newDocument.fileName,
              originatingMessage: note.source.originatingMessage || `Analyzed pasted document: ${newDocument.fileName}`,
              aiModel: note.source.aiModel || 'gpt-4o-mini',
              sourceTimestamp: note.source.sourceTimestamp ? new Date(note.source.sourceTimestamp) : new Date(),
              metadata: { documentId: newDocument.id },
            } : createDocumentSource({
              documentName: newDocument.fileName,
              originatingMessage: `Analyzed pasted document: ${newDocument.fileName}`,
            });
            
            // Ensure metadata is added
            baseSource.metadata = { ...baseSource.metadata, documentId: newDocument.id };
            
            return createNote({
              path: note.path,
              content: note.content,
              category: validateCategory(note.category),
              source: baseSource,
              context: note.context || {},
              confidence: note.confidence,
            });
          });

        // Process notes through path graph to get hierarchical paths
        analyzedNotes = await processNotesWithPathGraph(analyzedNotes);

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === newDocument.id
              ? {
                  ...doc,
                  summary: analyzeData.summary,
                  notes: analyzedNotes,
                  analyzedAt: new Date(),
                }
              : doc
          )
        );
      }

      // Close dialog and reset
      setShowCreateDialog(false);
      setPastedText('');
      setDocumentName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while creating document');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateDocument = async () => {
    if (!aiPrompt.trim() || !documentName.trim()) {
      setError('Please provide both document name and description');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      // Call AI to generate document content
      const generateResponse = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Generate a comprehensive document based on this description: ${aiPrompt.trim()}. Provide the full document content in a professional format.`,
          messages: [],
          settings: {
            model: 'gpt-4o-mini',
            maxIterations: 1,
            confidenceThreshold: 85,
            maxResponseLength: 10000,
            contextWindowSize: 4000,
            summaryMode: 'balanced',
            reasoningEffort: 'medium',
          },
        }),
      });

      if (!generateResponse.ok) {
        throw new Error('Failed to generate document');
      }

      // Read the streaming response
      const reader = generateResponse.body?.getReader();
      const decoder = new TextDecoder();
      let generatedContent = '';
      let buffer = ''; // Buffer for incomplete lines

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
                
                // Handle different event types
                if (data.type === 'output_text_delta' && data.data?.delta) {
                  generatedContent += data.data.delta;
                } else if (data.type === 'raw_model_stream_event' && data.data) {
                  // Handle nested text deltas
                  const eventData = data.data;
                  if (eventData.type === 'output_text_delta' && eventData.delta) {
                    generatedContent += eventData.delta;
                  }
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }
      }

      if (!generatedContent.trim()) {
        throw new Error('No content generated');
      }

      // Create document with generated content
      const newDocument: Document = {
        id: generateId(),
        fileName: documentName.trim() + '.txt',
        fileType: '.txt',
        size: generatedContent.length,
        text: generatedContent.trim(),
        notes: [],
        uploadedAt: new Date(),
      };

      setDocuments((prev) => [newDocument, ...prev]);
      setSelectedDocumentId(newDocument.id);

      // Analyze the generated document
      setIsAnalyzing(true);
      const analyzeResponse = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: generatedContent.trim(),
          fileName: newDocument.fileName,
          fileType: '.txt',
        }),
      });

      const analyzeData = await analyzeResponse.json();

      if (analyzeResponse.ok && analyzeData.summary) {
        let analyzedNotes: Note[] = (analyzeData.notes || [])
          .filter((note: ExtractedNote) => note.content && typeof note.content === 'string')
          .map((note: ExtractedNote) => {
            // Use centralized note creation with full context
            const baseSource = note.source ? {
              type: note.source.type as any, // Type comes from API, needs runtime validation
              url: note.source.url,
              documentName: note.source.documentName || newDocument.fileName,
              originatingMessage: note.source.originatingMessage || `Analyzed AI-generated document: ${newDocument.fileName}`,
              aiModel: note.source.aiModel || 'gpt-4o-mini',
              sourceTimestamp: note.source.sourceTimestamp ? new Date(note.source.sourceTimestamp) : new Date(),
              metadata: { documentId: newDocument.id, aiGenerated: true },
            } : createDocumentSource({
              documentName: newDocument.fileName,
              originatingMessage: `Analyzed AI-generated document: ${newDocument.fileName}`,
            });
            
            // Ensure metadata is added
            baseSource.metadata = { ...baseSource.metadata, documentId: newDocument.id, aiGenerated: true };
            
            return createNote({
              path: note.path,
              content: note.content,
              category: validateCategory(note.category),
              source: baseSource,
              context: note.context || {},
              confidence: note.confidence,
            });
          });

        // Process notes through path graph to get hierarchical paths
        analyzedNotes = await processNotesWithPathGraph(analyzedNotes);

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === newDocument.id
              ? {
                  ...doc,
                  summary: analyzeData.summary,
                  notes: analyzedNotes,
                  analyzedAt: new Date(),
                }
              : doc
          )
        );
      }

      // Close dialog and reset
      setShowCreateDialog(false);
      setAiPrompt('');
      setDocumentName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while generating document');
    } finally {
      setIsGenerating(false);
      setIsAnalyzing(false);
    }
  };

  const handleDeleteDocument = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    const ok = window.confirm(`Delete "${doc.fileName}"? This cannot be undone.`);
    if (!ok) return;

    setDocuments((prev) => {
      const next = prev.filter((d) => d.id !== docId);
      if (docId === selectedDocumentId) {
        setSelectedDocumentId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  const handleDeleteNote = (noteId: string) => {
    if (!selectedDocument) return;

    const ok = window.confirm('Delete this note? This cannot be undone.');
    if (!ok) return;

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === selectedDocument.id
          ? { ...doc, notes: doc.notes.filter((n) => n.id !== noteId) }
          : doc
      )
    );
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !selectedDocument || isChatProcessing) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    
    // Add user message to chat
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsChatProcessing(true);

    try {
      // Build conversation history for context
      const conversationHistory = chatMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
      
      // Call AI agent to process the document editing request
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are a document editing assistant. Your job is to help edit documents through conversation.

CURRENT DOCUMENT:
Title: ${selectedDocument.fileName}
Content:
---
${selectedDocument.text}
---

CONVERSATION HISTORY:
${conversationHistory}

NEW USER REQUEST: ${userMessage}

INSTRUCTIONS:
1. Analyze the user's editing request carefully
2. If you need MORE INFORMATION to make the edit properly, ask specific clarifying questions
3. If you have ENOUGH INFORMATION, provide the edited document using the EXACT format below

RESPONSE FORMAT:
You must respond with ONLY a JSON object in one of these two formats:

Format 1 - If you need more information:
{
  "type": "clarification",
  "questions": ["Question 1?", "Question 2?", "Question 3?"]
}

Format 2 - If you're ready to provide the edited document:
{
  "type": "edit",
  "title": "optional new title if changed",
  "content": "THE COMPLETE EDITED DOCUMENT TEXT HERE"
}

IMPORTANT:
- Respond with ONLY the JSON object, no additional commentary
- For "edit" type, include ONLY the document content in the "content" field
- Do NOT include explanations, meta-commentary, or chat text in the "content" field
- The "content" should be the raw document text that will replace the current document
- Ask questions iteratively - don't try to edit until you have all needed information`,
          messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
          settings: {
            model: 'gpt-4o-mini',
            maxIterations: 1,
            confidenceThreshold: 85,
            maxResponseLength: 10000,
            contextWindowSize: 4000,
            summaryMode: 'balanced',
            reasoningEffort: 'medium',
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process chat request');
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const messages = buffer.split('\n\n');
          buffer = messages.pop() || '';

          for (const message of messages) {
            const lines = message.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const data = JSON.parse(jsonStr);
                
                if (data.type === 'output_text_delta' && data.data?.delta) {
                  assistantContent += data.data.delta;
                } else if (data.type === 'raw_model_stream_event' && data.data) {
                  const eventData = data.data;
                  if (eventData.type === 'output_text_delta' && eventData.delta) {
                    assistantContent += eventData.delta;
                  }
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }
      }

      if (!assistantContent.trim()) {
        throw new Error('No response from AI');
      }

      // Parse the AI response
      let parsedResponse;
      try {
        // Clean up the response - remove markdown code blocks if present
        let cleanedContent = assistantContent.trim();
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        parsedResponse = JSON.parse(cleanedContent);
      } catch (parseError) {
        // If parsing fails, treat as a regular message
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: assistantContent.trim(), 
          timestamp: new Date() 
        }]);
        setIsChatProcessing(false);
        return;
      }

      // Handle the parsed response
      if (parsedResponse.type === 'clarification' && Array.isArray(parsedResponse.questions)) {
        // AI is asking clarifying questions
        const questionText = parsedResponse.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `I need some clarification to make the best edits:\n\n${questionText}`, 
          timestamp: new Date() 
        }]);
      } else if (parsedResponse.type === 'edit' && parsedResponse.content) {
        // AI provided an edited document
        const editMessage = parsedResponse.title 
          ? `I've prepared an edited version with the new title "${parsedResponse.title}". Click "Apply Edits" below to update the document.`
          : `I've prepared an edited version of the document. Click "Apply Edits" below to update the document.`;
        
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: editMessage, 
          timestamp: new Date() 
        }]);
        
        // Store the pending edit
        setPendingDocumentEdit({
          content: parsedResponse.content,
          title: parsedResponse.title
        });
      } else {
        // Unexpected format, show as regular message
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: assistantContent.trim(), 
          timestamp: new Date() 
        }]);
      }

    } catch (err) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${err instanceof Error ? err.message : 'An error occurred'}`, 
        timestamp: new Date() 
      }]);
    } finally {
      setIsChatProcessing(false);
    }
  };

  const handleApplyEdits = async () => {
    if (!pendingDocumentEdit || !selectedDocument) return;

    try {
      const updatedText = pendingDocumentEdit.content.trim();
      const updatedFileName = pendingDocumentEdit.title 
        ? pendingDocumentEdit.title + (selectedDocument.fileType || '.txt')
        : selectedDocument.fileName;

      // Update the document without re-analyzing
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === selectedDocument.id
            ? { 
                ...doc, 
                text: updatedText, 
                size: updatedText.length,
                fileName: updatedFileName
              }
            : doc
        )
      );

      // Mark this document as having unapplied edits (needs re-analysis)
      setDocumentHasUnappliedEdits(prev => ({
        ...prev,
        [selectedDocument.id]: true
      }));

      // Clear pending edit and add confirmation message
      setPendingDocumentEdit(null);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '✅ Document updated successfully! Click the "Analyze" button to regenerate the summary and notes.', 
        timestamp: new Date() 
      }]);

    } catch (err) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error applying edits: ${err instanceof Error ? err.message : 'An error occurred'}`, 
        timestamp: new Date() 
      }]);
    }
  };

  const handleReanalyzeDocument = async () => {
    if (!selectedDocument) return;

    setIsAnalyzing(true);

    try {
      // Re-analyze the updated document
      const analyzeResponse = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: selectedDocument.text,
          fileName: selectedDocument.fileName,
          fileType: selectedDocument.fileType,
        }),
      });

      const analyzeData = await analyzeResponse.json();

      if (analyzeResponse.ok && analyzeData.summary) {
        let analyzedNotes: Note[] = (analyzeData.notes || [])
          .filter((note: ExtractedNote) => note.content && typeof note.content === 'string')
          .map((note: ExtractedNote) => {
            // Use centralized note creation with full context
            const baseSource = note.source ? {
              type: note.source.type as any, // Type comes from API, needs runtime validation
              url: note.source.url,
              documentName: note.source.documentName || selectedDocument.fileName,
              originatingMessage: note.source.originatingMessage || `Re-analyzed document: ${selectedDocument.fileName}`,
              aiModel: note.source.aiModel || 'gpt-4o-mini',
              sourceTimestamp: note.source.sourceTimestamp ? new Date(note.source.sourceTimestamp) : new Date(),
              metadata: { documentId: selectedDocument.id, reanalyzed: true },
            } : createDocumentSource({
              documentName: selectedDocument.fileName,
              originatingMessage: `Re-analyzed document: ${selectedDocument.fileName}`,
            });
            
            // Ensure metadata is added
            baseSource.metadata = { ...baseSource.metadata, documentId: selectedDocument.id, reanalyzed: true };
            
            return createNote({
              path: note.path,
              content: note.content,
              category: validateCategory(note.category),
              source: baseSource,
              context: note.context || {},
              confidence: note.confidence,
            });
          });

        // Process notes through path graph to get hierarchical paths
        analyzedNotes = await processNotesWithPathGraph(analyzedNotes);

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === selectedDocument.id
              ? {
                  ...doc,
                  summary: analyzeData.summary,
                  notes: analyzedNotes,
                  analyzedAt: new Date(),
                }
              : doc
          )
        );

        // Clear the unapplied edits marker
        setDocumentHasUnappliedEdits(prev => ({
          ...prev,
          [selectedDocument.id]: false
        }));
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during re-analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 8 }}>📄 Documents</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
          Upload and manage documents with AI-powered summaries and notes
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Documents Sidebar */}
        <aside style={{ width: 300, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
          <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.txt,.js,.json"
              style={{ display: 'none' }}
            />
            
            {/* Primary Create Button */}
            <button
              onClick={() => setShowCreateDialog(true)}
              disabled={isUploading || isAnalyzing || isGenerating}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: isUploading || isAnalyzing || isGenerating ? '#d1d5db' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: isUploading || isAnalyzing || isGenerating ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              {isUploading ? '⏳ Uploading...' : isAnalyzing ? '🔍 Analyzing...' : isGenerating ? '✨ Generating...' : '+ Create Document'}
            </button>
            
            {/* Quick upload shortcut */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isAnalyzing || isGenerating}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: isUploading || isAnalyzing || isGenerating ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              📎 Quick Upload File
            </button>
          </div>

          {error && (
            <div
              style={{
                margin: 12,
                padding: 12,
                backgroundColor: '#fee',
                color: '#c00',
                border: '1px solid #fcc',
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {documents.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                <p>No documents yet</p>
                <p style={{ marginTop: 10, fontSize: 12 }}>
                  Upload a PDF or text file to get started
                </p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocumentId(doc.id)}
                  style={{
                    padding: 12,
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    backgroundColor: doc.id === selectedDocumentId ? '#e0e7ff' : 'transparent',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: '#111827',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {doc.fileName}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {formatFileSize(doc.size)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </div>
                      {doc.summary && (
                        <div style={{ fontSize: 11, color: '#059669', marginTop: 4, fontWeight: 600 }}>
                          ✓ Analyzed
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(doc.id);
                      }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        color: '#ef4444',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 16,
                      }}
                      title="Delete document"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          {!selectedDocument ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              <div style={{ textAlign: 'center', maxWidth: 400, padding: 20 }}>
                <p style={{ fontSize: 18, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
                  No document selected
                </p>
                <p style={{ fontSize: 14 }}>
                  Upload a document or select one from the sidebar to view its summary and notes
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Document Content Column */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #e5e7eb' }}>
              {/* Document Header */}
              <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 8, color: '#111827' }}>
                  {selectedDocument.fileName}
                </h3>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  <span>{formatFileSize(selectedDocument.size)}</span>
                  <span style={{ margin: '0 8px' }}>•</span>
                  <span>Uploaded {new Date(selectedDocument.uploadedAt).toLocaleString()}</span>
                  {selectedDocument.analyzedAt && (
                    <>
                      <span style={{ margin: '0 8px' }}>•</span>
                      <span style={{ color: '#059669', fontWeight: 600 }}>
                        Analyzed {new Date(selectedDocument.analyzedAt).toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Content Area with Document Text, Summary and Notes */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, backgroundColor: '#f9fafb' }}>
                {/* Full Document Text Section - Now at top */}
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
                    📄 Full Document Text
                  </h4>
                  <div
                    style={{
                      padding: 16,
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      maxHeight: 400,
                      overflowY: 'auto',
                    }}
                  >
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: '#374151',
                        margin: 0,
                      }}
                    >
                      {selectedDocument.text}
                    </pre>
                  </div>
                  
                  {/* Edited marker with Analyze button */}
                  {documentHasUnappliedEdits[selectedDocument.id] && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', backgroundColor: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 6 }}>
                      <span style={{ flex: 1, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                        ✏️ Edited - Summary and notes need updating
                      </span>
                      <button
                        onClick={handleReanalyzeDocument}
                        disabled={isAnalyzing}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: isAnalyzing ? '#d1d5db' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        {isAnalyzing ? 'Analyzing...' : '🔍 Analyze'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Summary Section */}
                {selectedDocument.summary ? (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
                      📝 Summary
                    </h4>
                    <div
                      style={{
                        padding: 16,
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        lineHeight: 1.6,
                        color: '#374151',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedDocument.summary}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        padding: 16,
                        backgroundColor: '#fef3c7',
                        border: '1px solid #fbbf24',
                        borderRadius: 8,
                        color: '#92400e',
                        fontSize: 14,
                      }}
                    >
                      ⏳ Document is being analyzed... Summary will appear shortly.
                    </div>
                  </div>
                )}

                {/* Notes Section */}
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
                    🗒️ Extracted Notes ({selectedDocument.notes.length})
                  </h4>
                  
                  {selectedDocument.notes.length === 0 ? (
                    <div
                      style={{
                        padding: 20,
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        textAlign: 'center',
                        color: '#9ca3af',
                        fontSize: 14,
                      }}
                    >
                      No notes extracted from this document yet
                    </div>
                  ) : (
                    <>
                      {/* Group notes by category */}
                      {['dates', 'deadlines', 'documents', 'people', 'places', 'goals', 'requirements', 'other'].map((category) => {
                        const categoryNotes = selectedDocument.notes.filter((n) => n.category === category);
                        if (categoryNotes.length === 0) return null;

                        return (
                          <div key={category} style={{ marginBottom: 20 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#374151',
                                marginBottom: 8,
                                textTransform: 'uppercase',
                              }}
                            >
                              {category === 'dates' && '📅 '}
                              {category === 'deadlines' && '⏰ '}
                              {category === 'documents' && '📄 '}
                              {category === 'people' && '👤 '}
                              {category === 'places' && '📍 '}
                              {category === 'goals' && '🎯 '}
                              {category === 'requirements' && '✓ '}
                              {category === 'other' && '📌 '}
                              {category}
                            </div>
                            {categoryNotes.map((note) => (
                              <div
                                key={note.id}
                                style={{
                                  marginBottom: 8,
                                  padding: 12,
                                  backgroundColor: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 6,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, marginBottom: 6 }}>
                                  <div style={{ flex: 1, fontSize: 14, color: '#111827', lineHeight: 1.5 }}>
                                    {note.content}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    style={{
                                      padding: '2px 8px',
                                      backgroundColor: 'transparent',
                                      color: '#ef4444',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: 16,
                                    }}
                                    title="Delete note"
                                  >
                                    🗑️
                                  </button>
                                </div>
                                
                                {/* Context Information */}
                                {(note.context?.who || note.context?.what || note.context?.when || note.context?.where) && (
                                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, padding: 6, backgroundColor: '#f9fafb', borderRadius: 4 }}>
                                    {note.context.who && note.context.who.length > 0 && (
                                      <div><strong>Who:</strong> {note.context.who.join(', ')}</div>
                                    )}
                                    {note.context.what && (
                                      <div><strong>What:</strong> {note.context.what}</div>
                                    )}
                                    {note.context.when && (
                                      <div><strong>When:</strong> {note.context.when}</div>
                                    )}
                                    {note.context.where && (
                                      <div><strong>Where:</strong> {note.context.where}</div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Source Information */}
                                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                                  Source: {note.source.documentName || 'Document'} • 
                                  {note.source.aiModel && ` AI: ${note.source.aiModel} • `}
                                  {new Date(note.updatedAt).toLocaleDateString()}
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
            </div>

            {/* AI Chat Panel Column */}
            <div style={{ width: 400, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
              {/* Chat Header */}
              <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 4 }}>
                  💬 AI Document Editor
                </h4>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                  Ask AI to edit or modify the document
                </p>
              </div>

              {/* Chat Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, backgroundColor: '#f9fafb' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                    <p style={{ fontSize: 14, marginBottom: 8 }}>Start a conversation</p>
                    <p style={{ fontSize: 12 }}>
                      Ask AI to edit, improve, or modify the document. AI will ask clarifying questions if needed.
                    </p>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        style={{
                          marginBottom: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '85%',
                            padding: '10px 14px',
                            borderRadius: 12,
                            backgroundColor: msg.role === 'user' ? '#3b82f6' : '#fff',
                            color: msg.role === 'user' ? '#fff' : '#111827',
                            border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                            fontSize: 14,
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                          }}
                        >
                          {msg.content}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#9ca3af',
                            marginTop: 4,
                            paddingLeft: msg.role === 'user' ? 0 : 14,
                            paddingRight: msg.role === 'user' ? 14 : 0,
                          }}
                        >
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* Chat Input */}
              <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
                {isChatProcessing && (
                  <div style={{ marginBottom: 12, padding: 8, backgroundColor: '#f3f4f6', borderRadius: 6, fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
                    ✨ AI is thinking...
                  </div>
                )}
                {isAnalyzing && (
                  <div style={{ marginBottom: 12, padding: 8, backgroundColor: '#fef3c7', borderRadius: 6, fontSize: 13, color: '#92400e', textAlign: 'center' }}>
                    🔍 Analyzing updated document...
                  </div>
                )}
                {pendingDocumentEdit && (
                  <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setShowViewEditsModal(true)}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 14,
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      👁️ View Edits
                    </button>
                    <button
                      onClick={handleApplyEdits}
                      disabled={isAnalyzing}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        backgroundColor: isAnalyzing ? '#d1d5db' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: 14,
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      ✅ Apply Edits
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                    placeholder="Ask AI to edit the document..."
                    disabled={isChatProcessing}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleChatSubmit}
                    disabled={!chatInput.trim() || isChatProcessing}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: !chatInput.trim() || isChatProcessing ? '#d1d5db' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: !chatInput.trim() || isChatProcessing ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Send
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0 0' }}>
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </div>
          </>
          )}
        </main>
      </div>

      {/* Create Document Dialog */}
      {showCreateDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowCreateDialog(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 600,
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 16, color: '#111827' }}>
              Create New Document
            </h3>

            {/* Mode Selection */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  onClick={() => setCreateMode('upload')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: createMode === 'upload' ? '#3b82f6' : '#f3f4f6',
                    color: createMode === 'upload' ? 'white' : '#6b7280',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  📎 Upload File
                </button>
                <button
                  onClick={() => setCreateMode('paste')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: createMode === 'paste' ? '#3b82f6' : '#f3f4f6',
                    color: createMode === 'paste' ? 'white' : '#6b7280',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  📝 Paste Text
                </button>
                <button
                  onClick={() => setCreateMode('generate')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: createMode === 'generate' ? '#3b82f6' : '#f3f4f6',
                    color: createMode === 'generate' ? 'white' : '#6b7280',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  ✨ AI Generate
                </button>
              </div>
            </div>

            {/* Upload Mode */}
            {createMode === 'upload' && (
              <div>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                  Upload a PDF or text file to create a new document
                </p>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowCreateDialog(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Choose File
                </button>
              </div>
            )}

            {/* Paste Text Mode */}
            {createMode === 'paste' && (
              <div>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                  Paste or type your document content below
                </p>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                    Document Name
                  </label>
                  <input
                    type="text"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder="e.g., Contract Agreement"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                    Document Content
                  </label>
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste or type your document content here..."
                    style={{
                      width: '100%',
                      minHeight: 200,
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowCreateDialog(false)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateFromText}
                    disabled={!pastedText.trim() || !documentName.trim() || isAnalyzing}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: !pastedText.trim() || !documentName.trim() || isAnalyzing ? '#d1d5db' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: !pastedText.trim() || !documentName.trim() || isAnalyzing ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Create Document'}
                  </button>
                </div>
              </div>
            )}

            {/* AI Generate Mode */}
            {createMode === 'generate' && (
              <div>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                  Describe the document you want AI to generate
                </p>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                    Document Name
                  </label>
                  <input
                    type="text"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder="e.g., Employee Handbook"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                    Description
                  </label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe what the document should contain. E.g., 'Create a comprehensive employee handbook for a tech startup with 50 employees, including policies on remote work, benefits, and code of conduct.'"
                    style={{
                      width: '100%',
                      minHeight: 150,
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowCreateDialog(false)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateDocument}
                    disabled={!aiPrompt.trim() || !documentName.trim() || isGenerating || isAnalyzing}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: !aiPrompt.trim() || !documentName.trim() || isGenerating || isAnalyzing ? '#d1d5db' : '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: !aiPrompt.trim() || !documentName.trim() || isGenerating || isAnalyzing ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {isGenerating ? 'Generating...' : isAnalyzing ? 'Analyzing...' : 'Generate Document'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Edits Modal */}
      {showViewEditsModal && pendingDocumentEdit && selectedDocument && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowViewEditsModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 800,
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 16, color: '#111827' }}>
              View Edited Document
            </h3>

            {pendingDocumentEdit.title && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', margin: 0, marginBottom: 4 }}>
                  New Title:
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                  {pendingDocumentEdit.title}
                </p>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', margin: 0, marginBottom: 8 }}>
                Edited Content:
              </p>
              <div
                style={{
                  padding: 16,
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  maxHeight: 500,
                  overflowY: 'auto',
                }}
              >
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: '#374151',
                    margin: 0,
                  }}
                >
                  {pendingDocumentEdit.content}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowViewEditsModal(false)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewEditsModal(false);
                  handleApplyEdits();
                }}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                ✅ Apply These Edits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
