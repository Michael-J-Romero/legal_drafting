import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface PathNode {
  path: string;
  segments: string[];
  noteIds: string[];
  children?: Record<string, PathNode>;
}

interface PathGraph {
  nodes: Record<string, PathNode>;
  lastUpdated: string;
}

/**
 * API route for managing the hierarchical path graph
 * - Analyzes new notes and assigns appropriate paths
 * - Maintains a persistent graph structure
 * - Intelligently restructures when needed
 */
export async function POST(request: Request) {
  try {
    const { action, notes, existingGraph, deletedNoteIds } = await request.json();

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    let prompt = '';
    
    if (action === 'add_notes') {
      // Adding new notes to the graph
      if (!notes || !Array.isArray(notes)) {
        return NextResponse.json({ error: 'Notes array is required' }, { status: 400 });
      }

      prompt = buildAddNotesPrompt(notes, existingGraph);
    } else if (action === 'remove_notes') {
      // Removing notes from the graph
      if (!deletedNoteIds || !Array.isArray(deletedNoteIds)) {
        return NextResponse.json({ error: 'Deleted note IDs required' }, { status: 400 });
      }

      return NextResponse.json({
        graph: removeNotesFromGraph(existingGraph, deletedNoteIds),
        updatedNotes: [],
        success: true
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Call OpenAI for intelligent path assignment
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
            content: 'You are an expert at organizing information into hierarchical path structures. You analyze notes and assign precise, hierarchical paths that flow from broad categories to specific details. You maintain consistency with existing paths while being flexible enough to create new branches when needed.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return NextResponse.json({ error: 'Failed to process path graph' }, { status: 500 });
    }

    const data = await response.json();
    const responseContent = data.choices[0]?.message?.content;

    if (!responseContent) {
      return NextResponse.json({ 
        graph: existingGraph || { nodes: {}, lastUpdated: new Date().toISOString() },
        updatedNotes: notes || [],
        error: 'No response generated'
      });
    }

    // Parse the JSON response
    try {
      let jsonContent = responseContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const result = JSON.parse(jsonContent);

      console.log(`[PATH GRAPH] Processed ${notes?.length || 0} notes, graph has ${Object.keys(result.graph.nodes).length} top-level paths`);

      return NextResponse.json({
        graph: result.graph,
        updatedNotes: result.updatedNotes || notes,
        restructured: result.restructured || false,
        success: true
      });
    } catch (parseError) {
      console.error('Error parsing path graph response:', parseError);
      console.error('Content received:', responseContent);
      return NextResponse.json({ 
        graph: existingGraph || { nodes: {}, lastUpdated: new Date().toISOString() },
        updatedNotes: notes || [],
        error: 'Failed to parse response',
        rawContent: responseContent
      });
    }

  } catch (error) {
    console.error('Error in path graph management API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function buildAddNotesPrompt(notes: any[], existingGraph: any): string {
  const graphSection = existingGraph && Object.keys(existingGraph.nodes || {}).length > 0
    ? `EXISTING PATH GRAPH:
${JSON.stringify(existingGraph, null, 2)}

IMPORTANT: Analyze this existing graph to understand the established path structure. Maintain consistency with existing paths where appropriate, but don't hesitate to restructure if the new notes suggest a better organization.
`
    : 'No existing graph. You will create the initial path structure based on these notes.\n';

  return `${graphSection}
NEW NOTES TO ADD:
${notes.map((n, idx) => `[${idx}] ID: ${n.id}
Content: ${n.content}
Category: ${n.category}
Current Path: ${n.path ? n.path.path : 'none'}
Context: ${JSON.stringify(n.context || {})}`).join('\n\n')}

YOUR TASK:
1. Analyze each note's content, category, and context
2. Assign a hierarchical path to each note that flows from broad → specific
3. Paths should use dot notation: category.subcategory.item.detail
4. Use underscores for multi-word segments: motion_to_compel, bank_statements
5. Be consistent with existing paths when notes are related
6. Create new path branches when notes represent new concepts

PATH EXAMPLES:
- case.jurisdiction.court.location.address
- case.parties.plaintiff.name
- case.parties.defendant.attorney
- case.events.hearings.motion_to_compel.date
- case.events.hearings.motion_to_compel.summary
- case.evidence.bank_statements.date
- case.evidence.bank_statements.amount
- document.contract.title
- document.contract.date_signed
- document.motion_to_compel.date_filed
- evidence.emails.from
- evidence.emails.subject

RESTRUCTURING:
If adding these notes reveals that the existing graph should be reorganized:
- Set "restructured": true
- Update paths for affected notes in updatedNotes array
- Include ALL notes that have path changes (old notes + new notes)

RESPONSE FORMAT (JSON only):
{
  "graph": {
    "nodes": {
      "case": {
        "path": "case",
        "segments": ["case"],
        "noteIds": [],
        "children": {
          "parties": {
            "path": "case.parties",
            "segments": ["case", "parties"],
            "noteIds": [],
            "children": {
              "plaintiff": {
                "path": "case.parties.plaintiff",
                "segments": ["case", "parties", "plaintiff"],
                "noteIds": [],
                "children": {
                  "name": {
                    "path": "case.parties.plaintiff.name",
                    "segments": ["case", "parties", "plaintiff", "name"],
                    "noteIds": ["note-123"]
                  }
                }
              }
            }
          }
        }
      }
    },
    "lastUpdated": "${new Date().toISOString()}"
  },
  "updatedNotes": [
    {
      "id": "note-123",
      "path": {
        "path": "case.parties.plaintiff.name",
        "segments": ["case", "parties", "plaintiff", "name"],
        "references": []
      }
    }
  ],
  "restructured": false
}

Return ONLY the JSON, no other text.`;
}

function removeNotesFromGraph(graph: any, noteIds: string[]): any {
  if (!graph || !graph.nodes) {
    return { nodes: {}, lastUpdated: new Date().toISOString() };
  }

  const newGraph = JSON.parse(JSON.stringify(graph)); // Deep clone
  
  function removeFromNode(node: any) {
    if (!node) return;
    
    // Remove note IDs
    if (node.noteIds && Array.isArray(node.noteIds)) {
      node.noteIds = node.noteIds.filter((id: string) => !noteIds.includes(id));
    }
    
    // Recursively process children
    if (node.children) {
      Object.keys(node.children).forEach(key => {
        removeFromNode(node.children[key]);
        
        // Remove empty child nodes
        const child = node.children[key];
        if (child && (!child.noteIds || child.noteIds.length === 0) && 
            (!child.children || Object.keys(child.children).length === 0)) {
          delete node.children[key];
        }
      });
    }
  }

  // Process all top-level nodes
  Object.keys(newGraph.nodes).forEach(key => {
    removeFromNode(newGraph.nodes[key]);
    
    // Remove empty top-level nodes
    const node = newGraph.nodes[key];
    if (node && (!node.noteIds || node.noteIds.length === 0) && 
        (!node.children || Object.keys(node.children).length === 0)) {
      delete newGraph.nodes[key];
    }
  });

  newGraph.lastUpdated = new Date().toISOString();
  return newGraph;
}
