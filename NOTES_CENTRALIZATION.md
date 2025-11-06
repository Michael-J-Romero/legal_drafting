# Notes Centralization - Implementation Guide

## Overview
All note-taking functionality in the planning agent now uses a centralized system with AI-enhanced context tracking. This ensures every note across the application has consistent structure and complete metadata about its origin.

## Centralized Notes Module
Location: `/src/app/planning-agent/notes/`

### Core Files:
- **types.ts** - Enhanced Note interface with full context
- **noteManager.ts** - Centralized note creation and management functions
- **index.ts** - Exports all note functionality

## Enhanced Note Structure

Every note now includes:

```typescript
interface Note {
  id: string;
  content: string;
  category: NoteCategory;
  createdAt: Date;
  updatedAt: Date;
  
  // WHERE DID THIS NOTE COME FROM?
  source: {
    type: 'website' | 'document' | 'user_prompt' | 'agent_ai' | 'research' | 'conversation';
    url?: string;              // If from a website
    documentName?: string;     // If from a document
    originatingMessage?: string; // The message/query that led to this note
    aiModel?: string;          // AI model that generated it
    sourceTimestamp: Date;     // When the source was accessed
    metadata?: Record<string, any>; // Additional metadata (documentId, etc.)
  };
  
  // CONTEXTUAL INFORMATION (WHO/WHAT/WHEN/WHERE)
  context: {
    who?: string[];   // People, organizations involved
    what?: string;    // Specific subject/topic
    when?: string;    // Temporal context
    where?: string;   // Location, place, venue
    relatedTo?: string[]; // Related notes or topics
  };
  
  // Optional flags
  isNew?: boolean;
  isPending?: boolean;
  tags?: string[];
  confidence?: number;
}
```

## Usage Across Views

### 1. Main Chat (Notes View)
- Uses full enhanced Note type
- AI extracts context from conversation
- Source type: `agent_ai`, `user_prompt`, `website`, or `research`
- Displays context information (who/what/when/where)

### 2. Documents View
- **NOW USES** enhanced Note type (previously used simplified DocumentNote)
- AI extracts context when analyzing documents
- Source type: `document`
- Includes document ID in metadata
- Shows context and source information

### 3. Goals View
- Placeholder for future implementation
- Will use enhanced Note type when implemented

## Centralized Note Creation

### Creating a Note from a Document:
```typescript
import { createNote, createDocumentSource } from './notes';

const note = createNote({
  content: "Contract expires on March 15, 2024",
  category: "deadlines",
  source: createDocumentSource({
    documentName: "Employment_Contract.pdf",
    originatingMessage: "Analyzed document: Employment_Contract.pdf"
  }),
  context: {
    what: "Contract expiration",
    when: "March 15, 2024",
    who: ["Company XYZ", "John Doe"]
  },
  confidence: 95
});
```

### Creating a Note from User Input:
```typescript
import { createNote, createUserSource } from './notes';

const note = createNote({
  content: "Meeting with client on Tuesday",
  category: "dates",
  source: createUserSource({
    userMessage: "I have a meeting with the client on Tuesday"
  }),
  context: {
    what: "Client meeting",
    when: "Tuesday"
  }
});
```

### Creating a Note from Web Research:
```typescript
import { createNote, createWebSource } from './notes';

const note = createNote({
  content: "Current market rate is $150/hour",
  category: "requirements",
  source: createWebSource({
    url: "https://example.com/rates",
    originatingMessage: "Research: What are current consulting rates?"
  }),
  context: {
    what: "Consulting rate",
    where: "Market average"
  },
  confidence: 85
});
```

## API Integration

### analyze-document API
Location: `/src/app/api/analyze-document/route.ts`

**What it does:**
- Analyzes uploaded documents
- Extracts summary and notes with AI
- **NOW includes context extraction** (who/what/when/where)
- Returns notes with full source information

**Response format:**
```json
{
  "summary": "Document summary...",
  "notes": [
    {
      "content": "Contract deadline is March 15, 2024",
      "category": "deadlines",
      "context": {
        "what": "Contract deadline",
        "when": "March 15, 2024",
        "who": ["Company ABC"]
      },
      "confidence": 95,
      "source": {
        "type": "document",
        "documentName": "contract.pdf",
        "originatingMessage": "Analyzed document: contract.pdf",
        "aiModel": "gpt-4o-mini",
        "sourceTimestamp": "2024-01-15T10:30:00Z"
      }
    }
  ]
}
```

### extract-notes API
Location: `/src/app/api/extract-notes/route.ts`

**What it does:**
- Extracts notes from AI chat responses
- Uses AI to identify noteworthy information
- Includes full context and source tracking
- Filters out duplicates and low-quality notes

## Benefits of Centralization

### 1. Consistency
- All notes have the same structure regardless of where they're created
- Uniform display across all views
- Predictable serialization/deserialization

### 2. Traceability
- Every note knows exactly where it came from
- Can trace back to specific document, chat message, or web source
- AI model used is tracked for auditing

### 3. Context-Aware
- AI extracts who/what/when/where automatically
- Notes are self-contained and understandable in isolation
- Related information is linked together

### 4. Maintainability
- Single source of truth for note logic
- Changes to note structure only need to be made in one place
- Easier to add new features (e.g., note merging, deduplication)

### 5. Quality Control
- Confidence scores help filter low-quality notes
- Automatic duplicate detection
- Context validation ensures notes have meaningful information

## Migration from Old DocumentNote

**Before (Old DocumentNote):**
```typescript
interface DocumentNote {
  id: string;
  content: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  documentId?: string;
}
```

**After (Enhanced Note):**
- ✅ Includes full source tracking
- ✅ AI-extracted context (who/what/when/where)
- ✅ Confidence scores
- ✅ Metadata for document ID and more
- ✅ Consistent with chat notes

## Display Examples

### Documents View
Shows:
- Note content
- Context information (who/what/when/where) in a gray box
- Source information (document name, AI model, date)

### Notes View (Main Chat)
Shows:
- Note content
- Context information
- Source type icon (🌐 Website, 📄 Document, 👤 User, 🤖 AI, etc.)
- Timestamp

## Future Enhancements

### Possible improvements:
1. **Note Merging** - Combine related notes automatically
2. **Smart Deduplication** - Detect semantic duplicates, not just exact matches
3. **Cross-View Note Sharing** - Share notes between documents and chat
4. **Note Graphs** - Build knowledge graphs from note relationships
5. **Export/Import** - Export notes with full context for external use

## Testing Recommendations

### Manual Testing Steps:
1. Upload a PDF document with dates, names, and locations
2. Verify notes are extracted with context (who/what/when/where)
3. Check that source shows document name and AI model
4. Test paste text feature - notes should have context
5. Test AI-generated documents - notes should have aiGenerated flag
6. Edit a document and re-analyze - notes should have reanalyzed flag
7. Verify notes persist correctly in localStorage
8. Check notes display in both Documents view and Notes view

### Key Things to Verify:
- ✅ All notes have source information
- ✅ Context is extracted by AI
- ✅ Notes are self-contained and understandable
- ✅ Document ID is tracked in metadata
- ✅ No TypeScript compilation errors
- ✅ Notes serialize/deserialize correctly

## Code Quality

### Linting
The build passes with TypeScript validation. ESLint has configuration issues unrelated to these changes.

### Type Safety
All note operations are fully type-safe with TypeScript interfaces.

### Backward Compatibility
The deserializeNote function handles old notes without source/context, providing defaults for backward compatibility.

## Summary

This implementation centralizes all note-taking functionality to use:
- ✅ Single source of truth (`/notes` module)
- ✅ Enhanced Note type with AI context
- ✅ Full source tracking (document, chat, web, etc.)
- ✅ Contextual information (who/what/when/where)
- ✅ Consistent display across all views
- ✅ Type-safe operations
- ✅ Backward compatible migration

All notes in the planning agent now have complete metadata about their origin and context, making them truly self-contained and understandable in isolation.
