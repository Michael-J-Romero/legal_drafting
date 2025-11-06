import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface Note {
  id: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * API route for converting notes into a hierarchical graph structure
 * - Creates JSON graph nodes from notes
 * - Intelligently merges with existing graph
 * - Uses dot notation for cross-references
 */
export async function POST(request: Request) {
  try {
    const { notes, existingGraph } = await request.json();

    if (!notes || !Array.isArray(notes)) {
      return NextResponse.json({ error: 'Notes array is required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Build the prompt for graph conversion
    const graphPrompt = `You are an expert at structuring legal case information into hierarchical JSON graphs. Convert the following notes into a well-organized graph structure.

${existingGraph ? `EXISTING GRAPH (merge intelligently with this):
${JSON.stringify(existingGraph, null, 2)}
` : ''}

NOTES TO CONVERT:
${notes.map((n: Note, idx: number) => `[${idx}] [${n.category}] ${n.content}`).join('\n')}

INSTRUCTIONS:
1. Create a hierarchical JSON structure organizing all information
2. Use dot notation for cross-references to avoid repetition (e.g., "belongs_to": "case.parties.plaintiff")
3. Group related information logically
4. Common top-level categories: case, parties, events, evidence, documents, drafts
5. Use arrays for lists of similar items
6. Preserve all specific details from the notes
${existingGraph ? '7. Intelligently merge with existing graph - add new data, update existing nodes, restructure if needed' : ''}

EXAMPLE STRUCTURE (adapt to the actual notes):
{
  "case": {
    "jurisdiction": {
      "court": "Superior Court",
      "location": "Los Angeles",
      "address": "123 Main St"
    },
    "parties": {
      "plaintiff": {
        "name": "John Doe",
        "type": "individual"
      },
      "defendant": {
        "name": "Acme Corp",
        "type": "corporation"
      }
    },
    "events": {
      "hearings": [
        {
          "id": "motion_to_compel",
          "title": "Motion to Compel",
          "date": "2024-03-15",
          "summary": "Discovery dispute regarding financial records",
          "documents": ["@documents.motion_to_compel", "@documents.opposition_motion_to_compel"]
        }
      ]
    },
    "evidence": [
      {
        "id": "bank_statements",
        "type": "financial",
        "date_range": "2023-01-01 to 2023-12-31",
        "belongs_to": "case.parties.plaintiff"
      }
    ]
  },
  "documents": {
    "motion_to_compel": {
      "title": "Motion to Compel Discovery",
      "date_filed": "2024-02-01",
      "summary": "Requesting court order for document production",
      "drafts": [
        {"version": "v1", "date": "2024-01-15"},
        {"version": "v2", "date": "2024-01-25"}
      ]
    },
    "opposition_motion_to_compel": {
      "title": "Opposition to Motion to Compel",
      "date_filed": "2024-02-10"
    }
  }
}

RESPONSE FORMAT (JSON only):
Return ONLY the complete graph JSON structure, no other text.`;

    // Call OpenAI API for graph conversion
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Use more capable model for complex structuring
        messages: [
          {
            role: 'system',
            content: 'You are an expert at structuring legal case information into hierarchical JSON graphs. Create well-organized, logical structures with cross-references using dot notation. Return only valid JSON.'
          },
          {
            role: 'user',
            content: graphPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return NextResponse.json({ error: 'Failed to create graph' }, { status: 500 });
    }

    const data = await response.json();
    const graphContent = data.choices[0]?.message?.content;

    if (!graphContent) {
      return NextResponse.json({ 
        graph: existingGraph || {},
        error: 'No graph generated'
      });
    }

    // Parse the JSON response
    try {
      let jsonContent = graphContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const graph = JSON.parse(jsonContent);

      console.log(`[NOTE GRAPHING] Created graph with ${Object.keys(graph).length} top-level nodes`);

      return NextResponse.json({
        graph,
        success: true
      });
    } catch (parseError) {
      console.error('Error parsing graph:', parseError);
      console.error('Content received:', graphContent);
      return NextResponse.json({ 
        graph: existingGraph || {},
        error: 'Failed to parse graph structure',
        rawContent: graphContent
      });
    }

  } catch (error) {
    console.error('Error in note graphing API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
