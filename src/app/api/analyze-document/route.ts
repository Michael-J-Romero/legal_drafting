import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Sanitize filename for use in paths
 * Converts to lowercase and replaces non-alphanumeric characters with underscores
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * API route for analyzing documents - generates summary and extracts notes
 */
export async function POST(request: Request) {
  try {
    const { text, fileName, fileType } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Document text is required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const sanitizedFileName = sanitizeFilename(fileName || 'unknown');

    // Build the prompt for document analysis
    const analysisPrompt = `You are an expert document analyzer. Analyze the following document and provide:
1. A comprehensive summary (2-4 paragraphs)
2. Detailed notes extracted from the document with hierarchical paths

DOCUMENT INFORMATION:
File Name: ${fileName || 'Unknown'}
File Type: ${fileType || 'Unknown'}

DOCUMENT CONTENT:
${text}

INSTRUCTIONS:
1. SUMMARY: Create a comprehensive summary that captures the main points, purpose, and key information from the document. Make it 2-4 paragraphs.

2. NOTES: Extract ALL noteworthy information as structured notes with HIERARCHICAL PATHS:
   - Look for: dates, times, deadlines, locations, addresses, document references, people's names, contact information, organizations, amounts, prices, requirements, specifications, legal terms, processes, procedures
   - Each note should be concise but complete
   - Be thorough and capture all important details
   
3. HIERARCHICAL PATH STRUCTURE:
   Each note must have a specific hierarchical path that shows EXACTLY where it belongs in the information structure.
   
   Examples of paths:
   - case.jurisdiction.court.location.address
   - case.parties.plaintiff.name
   - case.parties.defendant.name
   - case.events.hearings.motion_to_compel.title
   - case.events.hearings.motion_to_compel.date
   - case.events.hearings.motion_to_compel.summary
   - case.evidence.bank_statements.date
   - case.evidence.bank_statements.amount
   - case.evidence.contracts.parties
   - document.motion_to_compel.title
   - document.motion_to_compel.date_filed
   - document.motion_to_compel.summary
   - document.${sanitizedFileName}.title
   - document.${sanitizedFileName}.date
   - evidence.bank_statements.belongs_to (references: ["case.parties.plaintiff"])
   
   Path segments should use underscores instead of spaces and be lowercase.
   If a note references other notes, include the "references" array with paths to related notes.

CATEGORIES for notes (choose the most specific):
- dates: Specific dates, time periods, scheduled events
- deadlines: Time-sensitive tasks, due dates, cutoff dates
- documents: Referenced documents, files, paperwork, forms
- people: Names, contacts, stakeholders, organizations
- places: Locations, addresses, buildings, venues
- goals: Objectives, targets, milestones
- requirements: Specifications, criteria, prerequisites, conditions
- other: Any other noteworthy information

RESPONSE FORMAT (JSON only):
{
  "summary": "Your comprehensive summary here...",
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
      "confidence": 95
    },
    {
      "category": "people",
      "content": "Plaintiff: John Smith",
      "path": {
        "path": "case.parties.plaintiff.name",
        "segments": ["case", "parties", "plaintiff", "name"]
      },
      "context": {
        "who": ["John Smith"],
        "what": "Plaintiff in the case"
      },
      "confidence": 100
    },
    {
      "category": "documents",
      "content": "Motion to Compel Discovery",
      "path": {
        "path": "document.motion_to_compel.title",
        "segments": ["document", "motion_to_compel", "title"]
      },
      "context": {
        "what": "Legal motion document"
      },
      "confidence": 100
    }
  ]
}

Return ONLY the JSON, no other text.`;

    // Calculate appropriate max_tokens based on text length
    // Rough estimate: summary needs ~500-800 tokens, notes can vary
    // Use more tokens for larger documents to avoid truncation
    const textLength = text.length;
    const estimatedMaxTokens = Math.min(
      4000, // Cap at 4000 tokens
      Math.max(
        2000, // Minimum 2000 tokens for smaller docs
        Math.ceil(textLength / 3) // ~1 token per 3 chars + room for summary/notes
      )
    );

    // Call OpenAI API for document analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use mini model for cost efficiency
        messages: [
          {
            role: 'system',
            content: 'You are an expert document analysis assistant. Provide thorough summaries and extract all noteworthy information. Return only valid JSON.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
        max_tokens: estimatedMaxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return NextResponse.json({ error: 'Failed to analyze document' }, { status: 500 });
    }

    const data = await response.json();
    const analysisContent = data.choices[0]?.message?.content;

    if (!analysisContent) {
      return NextResponse.json({ error: 'No analysis generated' }, { status: 500 });
    }

    // Parse the JSON response
    try {
      // Remove markdown code blocks if present
      let jsonContent = analysisContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedAnalysis = JSON.parse(jsonContent);
      
      // Validate the structure
      if (!parsedAnalysis.summary || typeof parsedAnalysis.summary !== 'string') {
        return NextResponse.json({ error: 'Invalid analysis format - missing summary' }, { status: 500 });
      }

      // Validate and filter notes
      const validCategories = ['dates', 'deadlines', 'documents', 'people', 'places', 'goals', 'requirements', 'other'];
      const validNotes = Array.isArray(parsedAnalysis.notes)
        ? parsedAnalysis.notes
            .filter((note: { content?: string; category?: string }) => 
              note.content && 
              typeof note.content === 'string' && 
              note.content.trim().length > 0 &&
              note.category &&
              validCategories.includes(note.category)
            )
            .map((note: any) => ({
              content: note.content,
              category: note.category,
              context: note.context || {},
              confidence: note.confidence || 80,
              source: {
                type: 'document',
                documentName: fileName,
                originatingMessage: `Analyzed document: ${fileName}`,
                aiModel: 'gpt-4o-mini',
                sourceTimestamp: new Date().toISOString(),
              }
            }))
        : [];

      console.log(`[DOCUMENT ANALYSIS] Generated summary and ${validNotes.length} notes with context for ${fileName}`);
      
      return NextResponse.json({
        summary: parsedAnalysis.summary,
        notes: validNotes,
      });

    } catch (parseError) {
      console.error('Error parsing document analysis:', parseError);
      console.error('Content received:', analysisContent);
      return NextResponse.json({ error: 'Failed to parse analysis results' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in document analysis API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
