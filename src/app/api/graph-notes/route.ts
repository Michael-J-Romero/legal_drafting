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
    const graphPrompt = `You are an expert at organizing information into hierarchical graph structures. Analyze the following notes and create a logical, context-aware graph structure.

${existingGraph ? `EXISTING GRAPH (intelligently merge new notes into this structure):
${JSON.stringify(existingGraph, null, 2)}
` : ''}

NOTES TO ORGANIZE:
${notes.map((n: Note, idx: number) => `[${idx}] ${n.content}`).join('\n')}

INSTRUCTIONS:
1. Analyze the FULL CONTEXT of each note to understand what it represents
2. Look at ALL notes together to identify natural groupings and relationships
3. DO NOT force notes into predefined categories - let the content guide the structure
4. For each note, decide where it best fits in the graph based on its meaning and relationship to other notes:
   - If it relates to existing nodes, add it there
   - If it represents a new concept, create a new branch for it
   - Empty branches or singleton nodes are perfectly fine
5. Create a hierarchical structure that reflects the natural relationships in the data
6. Use arrays for collections of similar items
7. Use dot notation references for cross-references (e.g., "@parent.child.item")
8. Connect each note to the most relevant part of the tree, even if it means creating new top-level categories
9. Preserve all specific details from each note
${existingGraph ? '10. When merging with existing graph:\n   - Add new information to appropriate existing nodes\n   - Create new branches where needed\n   - Restructure if it improves organization\n   - Never remove existing information unless it\'s truly redundant' : ''}

APPROACH:
- First, identify what concepts/entities are mentioned across all notes
- Group related notes by their semantic meaning, not by predefined categories
- Build a hierarchy that makes sense for THIS specific set of notes
- The structure should emerge naturally from the content

RESPONSE FORMAT (JSON only):
Return ONLY the complete graph JSON structure, no other text. The structure should be a nested JSON object where keys represent concepts/entities and values contain the related information.`;


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
            content: 'You are an expert at analyzing information and creating logical hierarchical structures. Build graphs that emerge naturally from the content, not from predefined templates. Focus on semantic relationships and context. Return only valid JSON.'
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
