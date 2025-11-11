# Chunked Note Extraction with AI Clarification

## Overview

The chunked extraction system provides comprehensive note-taking from documents with AI-powered clarification questions to ensure maximum detail capture and accuracy.

## Key Features

### 1. Exhaustive Extraction
The AI extracts **every** important detail including:
- Dates, times, deadlines, time periods
- Locations, addresses, venues
- People's names, titles, roles
- Organizations, companies, entities
- Document references
- Amounts, prices, costs, fees
- Requirements, conditions, specifications
- Processes, procedures, steps
- Legal terms, definitions, clauses
- Contact information
- Identifiers, numbers, codes
- Any other potentially important information

### 2. Chunked Processing
- Documents split into ~2500 character chunks at sentence boundaries
- Processes chunks sequentially to avoid token limits
- Works with documents of any size
- Continues until ALL chunks are processed
- No truncation or missed content

### 3. Progressive UI Updates
- Notes appear in real-time as each chunk is processed
- Live progress indicator shows:
  - Current chunk number / total chunks
  - Progress bar
  - Running count of extracted notes
- Users see notes immediately, don't wait for completion

### 4. AI Clarification Dialog
- After extraction, AI asks clarifying questions
- Questions help resolve:
  - Ambiguous references
  - Missing context
  - Unclear relationships
  - Case/document associations
- User can:
  - Provide answers to improve accuracy
  - Skip questions if desired
  - Review context for each question

### 5. Guaranteed Completion
- Extraction continues until ALL chunks processed
- No early termination
- Progress tracking prevents confusion
- Ensures no content is missed

## API Endpoint

### `/api/extract-notes-chunked`

**Request:**
```typescript
{
  text: string,           // Document text
  fileName: string,       // Document name
  fileType: string,       // File type
  chunkIndex?: number,    // Current chunk (default: 0)
  mode: 'extract' | 'clarify'  // Operation mode
}
```

**Response (extract mode):**
```typescript
{
  notes: Note[],         // Extracted notes with full metadata
  clarificationQuestions: [{
    question: string,
    context: string,
    relatedNotes: number[]
  }],
  chunkIndex: number,    // Current chunk number
  totalChunks: number,   // Total number of chunks
  hasMoreChunks: boolean // More chunks remaining
}
```

## User Flow

1. **Upload Document**
   - File uploaded and text extracted
   - Document created immediately in UI

2. **Chunked Extraction Starts**
   - Progress indicator appears at bottom-right
   - Shows "Processing chunk 1 of 5..."

3. **Notes Stream In**
   - UI updates as each chunk completes
   - Notes accumulate in real-time
   - Users can see and interact with notes immediately

4. **All Chunks Processed**
   - Progress reaches 100%
   - Progress indicator shows total notes extracted

5. **Clarification Dialog**
   - Modal appears with AI questions
   - Example: "Is this Motion to Compel related to case #12345?"
   - Context provided for each question

6. **User Responds**
   - Provide answers in text fields
   - Or click "Skip Questions"

7. **Extraction Complete**
   - All notes saved with hierarchical paths
   - Path graph updated
   - Notes visible in Notes view

## UI Components

### Progress Indicator
Located at bottom-right corner:
```
┌─────────────────────────────────┐
│ 📝 Extracting Notes...          │
│ Processing chunk 3 of 5         │
│ [████████░░░░░░] 60%            │
│ 12 notes extracted so far       │
└─────────────────────────────────┘
```

### Clarification Dialog
Modal centered on screen:
```
┌──────────────────────────────────────┐
│ ❓ Clarification Questions           │
│                                      │
│ The AI has some questions to better │
│ understand the document.             │
│                                      │
│ ┌─Question 1:────────────────────┐  │
│ │ Is this Motion to Compel       │  │
│ │ related to case #12345?        │  │
│ │                                │  │
│ │ Context: Found reference to    │  │
│ │ 'Motion to Compel' but no case │  │
│ │ number identified              │  │
│ │                                │  │
│ │ [Your answer...              ] │  │
│ └────────────────────────────────┘  │
│                                      │
│ [Skip Questions] [Submit Answers]    │
└──────────────────────────────────────┘
```

## Example Comparison

### Before (Single-Pass Extraction):
- 1 API call
- Token limits might truncate long documents
- Maybe 10-20 notes extracted
- Some details missed
- No clarification opportunity

### After (Chunked Extraction):
- 5 chunks × 1 API call each = 5 calls
- No token limits
- 50+ comprehensive notes extracted
- Every detail captured
- AI asks 3 clarification questions
- User provides answers
- Notes enriched with additional context

## Code Integration

### DocumentsView
```typescript
// When uploading a document
await extractNotesChunked(
  documentId,
  documentText,
  fileName,
  fileType
);

// Notes accumulate progressively
// UI updates in real-time
// Clarification dialog shows when done
```

### State Management
```typescript
const [isExtractingChunked, setIsExtractingChunked] = useState(false);
const [extractionProgress, setExtractionProgress] = useState<{current: number, total: number} | null>(null);
const [accumulatedNotes, setAccumulatedNotes] = useState<Note[]>([]);
const [clarificationQuestions, setClarificationQuestions] = useState<Question[]>([]);
const [showClarificationDialog, setShowClarificationDialog] = useState(false);
```

## Benefits

1. **Complete Coverage**: No detail is too small or too large to miss
2. **Scalability**: Works with documents of any size
3. **User Engagement**: Progressive updates keep users informed
4. **Accuracy**: Clarification questions resolve ambiguities
5. **Transparency**: Users see exactly what's being extracted
6. **Flexibility**: Can skip clarifications if time-sensitive

## Future Enhancements

1. **Smart Chunking**: Use semantic boundaries instead of fixed size
2. **Parallel Processing**: Process multiple chunks simultaneously
3. **Clarification Integration**: Feed answers back to AI to update notes
4. **Caching**: Save chunk results to resume interrupted extractions
5. **Quality Scores**: Show confidence for each chunk's notes
6. **User Feedback**: Allow editing notes during extraction

## Testing

To test the chunked extraction:
1. Upload a document (PDF or text file)
2. Watch progress indicator at bottom-right
3. See notes accumulate in real-time
4. Answer clarification questions (or skip)
5. Verify all notes in Notes view
6. Check hierarchical paths in Raw Data viewer

## Troubleshooting

**Issue**: Extraction seems stuck
- Check browser console for errors
- Verify API endpoint is responding
- Check OpenAI API key is configured

**Issue**: No clarification questions
- This is normal if text is unambiguous
- Questions only appear when needed

**Issue**: Notes not showing in Notes view
- Check DocumentsView console logs
- Verify documentsUpdated event is firing
- Check localStorage for documents

## Performance

- Each chunk: ~1-2 seconds processing
- 10-page document: ~5-10 chunks = ~10-20 seconds total
- 100-page document: ~50-100 chunks = ~2-3 minutes total
- Notes appear progressively, so perceived wait time is lower
