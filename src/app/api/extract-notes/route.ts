import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * API route for intelligent note extraction from AI responses
 * Uses a separate AI call to analyze content and extract noteworthy information
 */
export async function POST(request: Request) {
  try {
    const { content, existingNotes } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Build the prompt for note extraction
    const extractionPrompt = `You are an expert note-taker. Analyze the following AI assistant response and extract ALL noteworthy information as structured notes.

EXISTING NOTES (do not duplicate these):
${existingNotes || 'None'}

AI RESPONSE TO ANALYZE:
${content}

INSTRUCTIONS:
- Extract ANY and ALL specific factual information (be VERY generous)
- Look for: dates, times, deadlines, locations, addresses, building names, document types/names, file requirements, people's names, contact information, organizations, companies, goals, milestones, requirements, specifications, prices, amounts, quantities, URLs, legal terms, processes, steps, procedures
- Group similar items together when appropriate (e.g., multiple documents in one note)
- Avoid exact duplicates of existing notes, but capture new information even if related
- Even seemingly minor details are important - capture them
- Each note should be concise but complete

CATEGORIES (choose the most specific):
- dates: Specific dates, time periods, scheduled events
- deadlines: Time-sensitive tasks, due dates, cutoff dates
- documents: Required documents, files, paperwork, forms
- people: Names, contacts, stakeholders, organizations
- places: Locations, addresses, buildings, venues
- goals: Objectives, targets, milestones, desired outcomes
- requirements: Specifications, criteria, prerequisites, conditions
- other: Any other noteworthy information

RESPONSE FORMAT (JSON only):
{
  "notes": [
    {"category": "dates", "content": "Meeting on March 15, 2024 at 2pm"},
    {"category": "documents", "content": "Need passport copy, driver's license, and proof of residence"},
    {"category": "goals", "content": "Complete project proposal by end of month"}
  ]
}

Return ONLY the JSON, no other text.`;

    // Call OpenAI API for intelligent extraction
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
            content: 'You are an expert note extraction assistant. Extract ALL noteworthy factual information from text. Be generous and thorough. Return only valid JSON.'
          },
          {
            role: 'user',
            content: extractionPrompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent extraction
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return NextResponse.json({ error: 'Failed to extract notes' }, { status: 500 });
    }

    const data = await response.json();
    const extractedContent = data.choices[0]?.message?.content;

    if (!extractedContent) {
      return NextResponse.json({ notes: [] });
    }

    // Parse the JSON response
    try {
      // Remove markdown code blocks if present
      let jsonContent = extractedContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedNotes = JSON.parse(jsonContent);
      
      // Validate the structure
      if (parsedNotes.notes && Array.isArray(parsedNotes.notes)) {
        // Filter out any invalid notes
        const validNotes = parsedNotes.notes.filter((note: any) => 
          note.content && typeof note.content === 'string' && note.content.trim().length > 0
        );

        console.log(`[NOTE EXTRACTION] Extracted ${validNotes.length} notes from AI response`);
        return NextResponse.json({ notes: validNotes });
      }

      return NextResponse.json({ notes: [] });
    } catch (parseError) {
      console.error('Error parsing extracted notes:', parseError);
      console.error('Content received:', extractedContent);
      return NextResponse.json({ notes: [] });
    }

  } catch (error) {
    console.error('Error in note extraction API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
