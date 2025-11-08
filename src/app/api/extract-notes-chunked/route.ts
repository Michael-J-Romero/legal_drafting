import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * API route for chunked note extraction with clarification questions
 * Extracts notes in chunks and asks clarifying questions before finalizing
 */
export async function POST(request: Request) {
  try {
    const { 
      text, 
      fileName, 
      fileType, 
      chunkIndex = 0,
      totalChunks = 1,
      clarifications = [],
      mode = 'extract' // 'extract' or 'clarify'
    } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Document text is required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Calculate chunk size - aim for ~2000-3000 chars per chunk to avoid token limits
    const CHUNK_SIZE = 2500;
    const chunks: string[] = [];
    
    // Split text into chunks at sentence boundaries
    let chunkBuffer = '';
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      if (chunkBuffer.length + sentence.length > CHUNK_SIZE && chunkBuffer.length > 0) {
        chunks.push(chunkBuffer.trim());
        chunkBuffer = sentence;
      } else {
        chunkBuffer += (chunkBuffer ? ' ' : '') + sentence;
      }
    }
    if (chunkBuffer.trim()) {
      chunks.push(chunkBuffer.trim());
    }

    const actualTotalChunks = chunks.length;
    const currentChunkText = chunks[chunkIndex] || text;

    if (mode === 'extract') {
      // EXTRACTION MODE: Extract notes from current chunk
      const extractionPrompt = `You are an expert document analyzer extracting EVERY important detail.

DOCUMENT: ${fileName || 'Unknown'}
FILE TYPE: ${fileType || 'Unknown'}
CHUNK: ${chunkIndex + 1} of ${actualTotalChunks}

CHUNK TEXT:
${currentChunkText}

INSTRUCTIONS:
Extract EVERY noteworthy detail as structured notes. Be EXHAUSTIVE and capture:
- All dates, times, deadlines, time periods
- All locations, addresses, venues
- All people's names, titles, roles
- All organizations, companies, entities
- All document references
- All amounts, prices, costs, fees
- All requirements, conditions, specifications
- All processes, procedures, steps
- All legal terms, definitions, clauses
- All contact information
- All identifiers, numbers, codes
- Any other potentially important information

Each note should have:
1. Specific, detailed content
2. Appropriate category
3. Hierarchical path showing where it belongs in the information structure
4. Context (who/what/when/where if applicable)
5. Confidence score (0-100)

PATH STRUCTURE - DATA-DRIVEN:
Create paths based on the ACTUAL CONTENT of the note. Examples:

If note mentions a court case:
- case.jurisdiction.court.location.address
- case.parties.plaintiff.name
- case.events.hearings.motion_to_compel.date

If note is about a general meeting:
- meetings.john_smith.march_15.details

If note is about a financial transaction:
- financial.payments.invoice_12345.amount

If note is about a document:
- documents.${fileName?.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.title
- documents.${fileName?.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.date_signed

If note is about general information:
- information.topic.subtopic.details

IMPORTANT: Use paths that reflect what's ACTUALLY in the note, not what you assume it might be

CATEGORIES:
- dates: Dates, times, time periods
- deadlines: Due dates, cutoff dates
- documents: Referenced documents
- people: Names, contacts, stakeholders
- places: Locations, addresses
- goals: Objectives, targets
- requirements: Specifications, conditions
- other: Any other information

After extracting notes, identify any ambiguities or missing context that would benefit from clarification.
Generate specific questions to ask the user about unclear references, relationships, or context.

RESPONSE FORMAT (JSON only):
{
  "notes": [
    {
      "category": "dates",
      "content": "Hearing scheduled for March 15, 2024 at 2:00 PM",
      "path": {
        "path": "case.events.hearings.motion_to_compel.date",
        "segments": ["case", "events", "hearings", "motion_to_compel", "date"]
      },
      "context": {
        "who": ["Court", "Parties"],
        "what": "Motion to Compel hearing",
        "when": "March 15, 2024 at 2:00 PM",
        "where": "Courtroom 5A"
      },
      "confidence": 95,
      "needsClarification": false
    }
  ],
  "clarificationQuestions": [
    {
      "question": "Is this Motion to Compel related to an existing case? If so, what is the case number?",
      "context": "Found reference to 'Motion to Compel' but no case number identified",
      "relatedNotes": [0]
    }
  ]
}

Return ONLY the JSON, no other text.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert document analyzer. Extract EVERY important detail as structured notes. Ask clarifying questions when needed. Return only valid JSON.'
            },
            {
              role: 'user',
              content: extractionPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        return NextResponse.json({ error: 'Failed to extract notes' }, { status: 500 });
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        return NextResponse.json({ error: 'No content generated' }, { status: 500 });
      }

      // Parse the JSON response
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedResult = JSON.parse(jsonContent);

      // Add source information to notes
      const validCategories = ['dates', 'deadlines', 'documents', 'people', 'places', 'goals', 'requirements', 'other'];
      const notesWithSource = (parsedResult.notes || [])
        .filter((note: any) => 
          note.content && 
          typeof note.content === 'string' && 
          note.content.trim().length > 0 &&
          note.category &&
          validCategories.includes(note.category)
        )
        .map((note: any) => ({
          ...note,
          source: {
            type: 'document',
            documentName: fileName,
            originatingMessage: `Extracted from document: ${fileName} (chunk ${chunkIndex + 1}/${actualTotalChunks})`,
            aiModel: 'gpt-4o-mini',
            sourceTimestamp: new Date().toISOString(),
          },
          chunkIndex,
        }));

      console.log(`[CHUNKED EXTRACTION] Chunk ${chunkIndex + 1}/${actualTotalChunks}: Extracted ${notesWithSource.length} notes, ${parsedResult.clarificationQuestions?.length || 0} questions`);

      return NextResponse.json({
        notes: notesWithSource,
        clarificationQuestions: parsedResult.clarificationQuestions || [],
        chunkIndex,
        totalChunks: actualTotalChunks,
        hasMoreChunks: chunkIndex + 1 < actualTotalChunks,
      });

    } else if (mode === 'clarify') {
      // CLARIFICATION MODE: Generate final notes with clarifications applied
      const clarificationPrompt = `You are reviewing and finalizing extracted notes with user-provided clarifications.

CLARIFICATIONS PROVIDED:
${JSON.stringify(clarifications, null, 2)}

INSTRUCTIONS:
Based on the clarifications, update the affected notes to include the additional context.
Return the updated notes with the new information incorporated.

RESPONSE FORMAT (JSON only):
{
  "updatedNotes": [
    {
      "noteIndex": 0,
      "updates": {
        "content": "Updated content with clarification",
        "context": { "additional": "context from clarification" },
        "path": { "updated": "path if needed" }
      }
    }
  ]
}

Return ONLY the JSON, no other text.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at incorporating clarifications into structured notes. Return only valid JSON.'
            },
            {
              role: 'user',
              content: clarificationPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to process clarifications' }, { status: 500 });
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }

      const parsedResult = JSON.parse(jsonContent);

      return NextResponse.json({
        updatedNotes: parsedResult.updatedNotes || [],
      });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });

  } catch (error) {
    console.error('Error in chunked extraction API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
