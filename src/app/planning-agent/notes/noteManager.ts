/**
 * Centralized note management utilities
 * All note-related operations are defined here
 */

import { Note, NoteCategory, NoteSource, NoteContext, NoteSourceType, NotePath } from './types';

/**
 * Generate a unique ID for a note
 */
export function generateNoteId(): string {
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a new note with full context
 */
export function createNote(params: {
  content: string;
  category: NoteCategory;
  source: NoteSource;
  context?: Partial<NoteContext>;
  path?: NotePath;
  tags?: string[];
  confidence?: number;
  isPending?: boolean;
}): Note {
  const now = new Date();
  
  return {
    id: generateNoteId(),
    content: params.content,
    category: params.category,
    createdAt: now,
    updatedAt: now,
    source: params.source,
    path: params.path,
    context: {
      who: params.context?.who,
      what: params.context?.what,
      when: params.context?.when,
      where: params.context?.where,
      relatedTo: params.context?.relatedTo,
    },
    tags: params.tags,
    confidence: params.confidence,
    isPending: params.isPending ?? false,
    isNew: false,
  };
}

/**
 * Extract context from content using simple heuristics
 * This is a fallback when AI extraction doesn't provide context
 */
export function extractContextFromContent(content: string): Partial<NoteContext> {
  const context: Partial<NoteContext> = {};
  
  // Extract potential "who" - look for names, organizations
  // Simple pattern: capitalized words that might be names
  const namePattern = /\b([A-Z][a-z]+ (?:[A-Z][a-z]+ )?[A-Z][a-z]+)\b/g;
  const potentialNames = content.match(namePattern);
  if (potentialNames && potentialNames.length > 0) {
    context.who = potentialNames.slice(0, 3); // Limit to 3 names
  }
  
  // Extract potential "when" - look for dates, times
  const datePattern = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/gi;
  const potentialDates = content.match(datePattern);
  if (potentialDates && potentialDates.length > 0) {
    context.when = potentialDates[0];
  }
  
  // Extract potential "where" - look for location indicators
  const locationPattern = /\b(?:at|in|near|located at)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|,|$)/g;
  const locationMatch = locationPattern.exec(content);
  if (locationMatch) {
    context.where = locationMatch[1].trim();
  }
  
  return context;
}

/**
 * Validate a note category
 */
export function validateCategory(category: string): NoteCategory {
  const validCategories: NoteCategory[] = [
    'dates', 'deadlines', 'documents', 'people', 'places', 'goals', 'requirements', 'other'
  ];
  
  const normalized = category.toLowerCase() as NoteCategory;
  return validCategories.includes(normalized) ? normalized : 'other';
}

/**
 * Create a source object for notes extracted from AI responses
 */
export function createAISource(params: {
  originatingMessage?: string;
  aiModel?: string;
  sourceType?: NoteSourceType;
  url?: string;
  documentName?: string;
}): NoteSource {
  return {
    type: params.sourceType || 'agent_ai',
    url: params.url,
    documentName: params.documentName,
    originatingMessage: params.originatingMessage,
    aiModel: params.aiModel || 'gpt-4o-2024-11-20',
    sourceTimestamp: new Date(),
    metadata: {},
  };
}

/**
 * Create a source object for notes from user prompts
 */
export function createUserSource(params: {
  userMessage: string;
  documentName?: string;
}): NoteSource {
  return {
    type: 'user_prompt',
    originatingMessage: params.userMessage,
    documentName: params.documentName,
    sourceTimestamp: new Date(),
    metadata: {},
  };
}

/**
 * Create a source object for notes from websites
 */
export function createWebSource(params: {
  url: string;
  originatingMessage?: string;
}): NoteSource {
  return {
    type: 'website',
    url: params.url,
    originatingMessage: params.originatingMessage,
    sourceTimestamp: new Date(),
    metadata: {},
  };
}

/**
 * Create a source object for notes from documents
 */
export function createDocumentSource(params: {
  documentName: string;
  originatingMessage?: string;
}): NoteSource {
  return {
    type: 'document',
    documentName: params.documentName,
    originatingMessage: params.originatingMessage,
    sourceTimestamp: new Date(),
    metadata: {},
  };
}

/**
 * Assign confidence to a note based on content quality
 */
export function assignNoteConfidence(note: Note, existingNotes: Note[]): 'auto-accept' | 'needs-review' | 'auto-reject' {
  // Defensive: handle malformed / legacy notes without content
  if (!note.content || typeof note.content !== 'string') {
    console.warn('[AssignNoteConfidence] Missing or invalid note.content for note id:', note.id);
    return 'auto-reject';
  }
  const content = note.content.toLowerCase();
  
  // Auto-reject criteria: vague, generic, or low-value notes
  const rejectPatterns = [
    /^(ok|okay|yes|no|sure|thanks|thank you)\.?$/i,
    /^(noted|understood|got it|i see)\.?$/i,
    /^.{1,10}$/,  // Too short (less than 10 chars)
  ];
  
  const vagueWords = ['something', 'things', 'stuff', 'maybe', 'perhaps', 'might', 'possibly'];
  const hasVagueWords = vagueWords.some(word => content.includes(word));
  
  // Check for duplicate or very similar content
  const isDuplicate = existingNotes.some(existing => {
    // Guard against undefined content in existing notes
    const existingContentRaw = (existing && typeof existing.content === 'string') ? existing.content : '';
    if (!existingContentRaw) return false;
    const existingContent = existingContentRaw.toLowerCase();
    return existingContent === content ||
      (existingContent.length > 10 && content.includes(existingContent)) ||
      (content.length > 10 && existingContent.includes(content));
  });
  
  // Auto-reject conditions
  if (rejectPatterns.some(pattern => pattern.test(content))) {
    return 'auto-reject';
  }
  
  if (isDuplicate) {
    return 'auto-reject';
  }
  
  if (note.content.length < 15 && hasVagueWords) {
    return 'auto-reject';
  }
  
  // Auto-accept criteria: specific, actionable notes with clear information
  const hasDate = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i.test(content);
  const hasSpecificInfo = note.content.length > 30;
  const isActionableCategory = ['dates', 'deadlines', 'documents', 'people', 'goals', 'requirements'].includes(note.category);
  
  // Strong indicators for auto-accept
  if (hasDate && note.category === 'dates') {
    return 'auto-accept';
  }
  
  if (isActionableCategory && hasSpecificInfo && !hasVagueWords) {
    return 'auto-accept';
  }
  
  // Consider source confidence
  if (note.confidence !== undefined) {
    if (note.confidence >= 90) return 'auto-accept';
    if (note.confidence < 50) return 'auto-reject';
  }
  
  // Default: needs review
  return 'needs-review';
}

/**
 * Extract notes from assistant's response using regex (fallback method)
 */
export function extractNotesFromResponse(
  content: string,
  source: NoteSource
): Note[] {
  const notePattern = /\[NOTE:\s*([^\|]+)\s*\|\s*([^\]]+)\]/gi;
  const notes: Note[] = [];
  let match;

  while ((match = notePattern.exec(content)) !== null) {
    const category = validateCategory(match[1].trim());
    const noteContent = match[2].trim();
    
    const context = extractContextFromContent(noteContent);
    
    notes.push(createNote({
      content: noteContent,
      category,
      source,
      context,
      isPending: true,
    }));
  }

  return notes;
}
