import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface Note {
  id: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface RefinedNotesResponse {
  refinedNotes: Note[];
  removedDuplicates: number;
  removedGeneric: number;
  contradictions: Array<{
    note1: string;
    note2: string;
    reason: string;
  }>;
}

/**
 * API route for refining notes using AI
 * - Removes duplicates
 * - Removes generic/redundant/irrelevant information
 * - Flags contradictions
 */
export async function POST(request: Request) {
  try {
    const { notes } = await request.json();

    if (!notes || !Array.isArray(notes)) {
      return NextResponse.json({ error: 'Notes array is required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Build the prompt for note refinement
    const refinementPrompt = `You are an expert note curator for legal case management. Analyze the following notes and refine them by:
1. Removing exact duplicates and near-duplicates
2. Removing generic, redundant, or irrelevant information
3. Identifying contradictions

NOTES TO ANALYZE:
${notes.map((n: Note, idx: number) => `[${idx}] [${n.category}] ${n.content}`).join('\n')}

INSTRUCTIONS:
- Keep all specific, valuable, and unique information
- Remove notes that are too generic (e.g., "noted", "ok", "understood")
- Remove duplicates (exact matches or very similar content)
- Remove redundant information already covered by other notes
- Flag any contradictions between notes (conflicting dates, facts, etc.)
- Preserve important details even if they seem minor
- Maintain original category assignments for kept notes

RESPONSE FORMAT (JSON only):
{
  "refinedNotes": [
    {"index": 0, "content": "original content", "category": "dates", "keep": true, "reason": "unique date information"},
    {"index": 1, "content": "generic note", "category": "other", "keep": false, "reason": "too generic"}
  ],
  "contradictions": [
    {"note1": "Meeting on March 15", "note2": "Meeting on March 20", "reason": "Conflicting meeting dates"}
  ]
}

Return ONLY the JSON, no other text.`;

    // Call OpenAI API for intelligent refinement
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
            content: 'You are an expert note refinement assistant for legal cases. Remove duplicates, generic content, and flag contradictions. Return only valid JSON.'
          },
          {
            role: 'user',
            content: refinementPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return NextResponse.json({ error: 'Failed to refine notes' }, { status: 500 });
    }

    const data = await response.json();
    const refinedContent = data.choices[0]?.message?.content;

    if (!refinedContent) {
      return NextResponse.json({ 
        refinedNotes: notes,
        removedDuplicates: 0,
        removedGeneric: 0,
        contradictions: []
      });
    }

    // Parse the JSON response
    try {
      let jsonContent = refinedContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(jsonContent);
      
      if (parsed.refinedNotes && Array.isArray(parsed.refinedNotes)) {
        // Filter to keep only notes marked as keep=true
        const keptNotes = parsed.refinedNotes
          .filter((n: any) => n.keep === true)
          .map((n: any) => notes[n.index]);

        const removedCount = notes.length - keptNotes.length;
        
        // Count duplicates vs generic removals (simplified heuristic)
        const duplicateReasons = parsed.refinedNotes.filter((n: any) => 
          !n.keep && (n.reason?.toLowerCase().includes('duplicate') || n.reason?.toLowerCase().includes('similar'))
        ).length;
        const genericReasons = removedCount - duplicateReasons;

        console.log(`[NOTE REFINEMENT] Kept ${keptNotes.length} of ${notes.length} notes`);
        console.log(`[NOTE REFINEMENT] Found ${parsed.contradictions?.length || 0} contradictions`);

        return NextResponse.json({
          refinedNotes: keptNotes,
          removedDuplicates: duplicateReasons,
          removedGeneric: genericReasons,
          contradictions: parsed.contradictions || []
        });
      }

      return NextResponse.json({ 
        refinedNotes: notes,
        removedDuplicates: 0,
        removedGeneric: 0,
        contradictions: []
      });
    } catch (parseError) {
      console.error('Error parsing refined notes:', parseError);
      console.error('Content received:', refinedContent);
      return NextResponse.json({ 
        refinedNotes: notes,
        removedDuplicates: 0,
        removedGeneric: 0,
        contradictions: [],
        error: 'Failed to parse refinement results'
      });
    }

  } catch (error) {
    console.error('Error in note refinement API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
