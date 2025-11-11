import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * API route for intelligent note extraction from AI responses
 * Uses a separate AI call to analyze content and extract noteworthy information
 */
export async function POST(request: Request) {
  try {
    const { content, existingNotes, existingGraph, model, originatingMessage, sourceUrl, documentName } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Build the prompt for note extraction with enhanced context and relevance analysis
    const graphContext = existingGraph ? `
EXISTING KNOWLEDGE GRAPH:
${JSON.stringify(existingGraph, null, 2)}

Use this graph to understand what information is already captured and how new information relates to it.` : '';

    const extractionPrompt = `You are an expert note-taker with deep analytical skills. Analyze the AI assistant response and extract ONLY genuinely relevant and useful information.

${graphContext}

EXISTING NOTES (do not duplicate):
${existingNotes || 'None'}

AI RESPONSE TO ANALYZE:
${content}

CRITICAL INSTRUCTIONS FOR RELEVANCE:
1. **Be SELECTIVE, not exhaustive** - Quality over quantity
2. **Avoid vague or generic statements** like "the user mentioned something" or "there was a discussion about X"
3. **Extract SPECIFIC, ACTIONABLE facts** - Names, numbers, dates, concrete requirements
4. **Require clear context** - Each note must clearly explain HOW it relates to the existing knowledge graph
5. **Reject low-value information** like:
   - Casual mentions without details
   - Redundant information already in the graph
   - Obvious or trivial facts
   - Vague references without specifics

RELEVANCE SCORING (0-100):
- **90-100 (HIGH)**: Critical facts with clear context (e.g., "Hearing scheduled for March 15, 2024 at 9am in Courtroom 3A for Case #12345")
- **60-89 (MEDIUM)**: Useful but may need confirmation (e.g., "Client mentioned a deadline around mid-March")
- **0-59 (LOW)**: Vague, trivial, or redundant information - REJECT these

FOR EACH NOTE YOU EXTRACT:
1. **Explain the relationship** to existing knowledge using the graph
2. **Be specific** about WHO, WHAT, WHEN, WHERE with actual names/numbers/dates
3. **Provide context** that makes it clear why this matters
4. **Assign confidence score** based on specificity and usefulness

CATEGORIES (choose most specific):
- dates: Specific dates, time periods, scheduled events  
- deadlines: Time-sensitive tasks, due dates, cutoff dates
- documents: Required documents, files, paperwork, forms with specific names
- people: Names with roles/relationships, contacts, stakeholders
- places: Specific locations, addresses, buildings, venues
- goals: Concrete objectives with measurable criteria
- requirements: Specific specifications, criteria, prerequisites
- legal: Case numbers, legal entities, jurisdictions, court details
- financial: Specific amounts, costs, prices, budgets
- other: Any other noteworthy SPECIFIC information

RESPONSE FORMAT (JSON only):
{
  "notes": [
    {
      "category": "dates",
      "content": "Hearing for Motion to Compel scheduled for March 15, 2024 at 9:00 AM in Courtroom 3A",
      "context": {
        "who": ["Judge Sarah Williams", "Attorney John Smith"],
        "what": "Motion to Compel Deposition hearing",
        "when": "March 15, 2024 at 9:00 AM",
        "where": "Courtroom 3A, Central District Court",
        "relationToGraph": "Part of civil case csrv01874 proceedings > motion_to_compel branch"
      },
      "confidence": 95,
      "rationale": "Specific hearing with exact date, time, location, and case reference"
    }
  ]
}

IMPORTANT: Only include notes with confidence >= 60. Return ONLY the JSON, no other text.`;

    // Call OpenAI API for intelligent extraction with relevance analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert note extraction assistant with strong analytical judgment. Extract ONLY specific, relevant facts with clear context. Reject vague or low-value information. Be selective and focus on quality. Return only valid JSON.'
          },
          {
            role: 'user',
            content: extractionPrompt
          }
        ],
        temperature: 0.2, // Even lower for more consistent, focused extraction
        max_tokens: 4000, // Increased for detailed context analysis
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
      
      // Validate the structure and add source information
      if (parsedNotes.notes && Array.isArray(parsedNotes.notes)) {
        // Filter out any invalid notes and add source metadata
        const validNotes = parsedNotes.notes
          .filter((note: any) => 
            note.content && typeof note.content === 'string' && note.content.trim().length > 0
          )
          .map((note: any) => ({
            ...note,
            source: {
              type: sourceUrl ? 'website' : documentName ? 'document' : 'agent_ai',
              url: sourceUrl,
              documentName: documentName,
              originatingMessage: originatingMessage,
              aiModel: model || 'gpt-4o-mini',
              sourceTimestamp: new Date().toISOString(),
            },
          }));

        console.log(`[NOTE EXTRACTION] Extracted ${validNotes.length} notes with context from AI response`);
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
