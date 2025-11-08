import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface PathNode {
  path: string;
  segments: string[];
  descriptor: string; // Human-readable description of what this path segment represents
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

YOUR CRITICAL TASK:
Create HIGHLY GRANULAR and SPECIFIC hierarchical paths where the path ALONE (with descriptors) provides complete unambiguous context.

GRANULARITY REQUIREMENTS:
1. Each path must be detailed enough to be self-explanatory
2. Avoid generic segments like "deadlines" - instead be specific like "motion_to_compel.deadlines.payment_due"
3. Include intermediate organizational layers (e.g., proceedings, motions, evidence_types)
4. Each segment must have a clear, specific descriptor that explains what it represents
5. The full path with descriptors should answer: what case/document/item, what proceeding/event, what specific aspect

PATH STRUCTURE PRINCIPLES:
- Flow from most general → most specific
- Use underscores for multi-word segments (motion_to_compel, bank_statements)
- Include case identifiers, document types, proceeding names in descriptors
- Be specific enough to avoid ambiguity

GOOD vs BAD PATH EXAMPLES:

BAD (too generic):
- case.deadlines.payment_due
  Descriptors: ["civil case csrv01874", "sanctions deadline for motion to compel deposition", "amount due in sanctions"]
  Problem: "deadlines" is ambiguous - which proceeding?

GOOD (granular and specific):
- case.proceedings.motion_to_compel.deadlines.payment_due
  Descriptors: ["civil case csrv01874", "hearings, motions and other court proceedings for this case", "motion to compel deposition of defendant", "deadlines for this motion", "amount due in sanctions"]
  Better: Clear hierarchy from case → proceedings → specific motion → deadlines → specific payment

BAD:
- case.parties.name
  Descriptors: ["civil case csrv01874", "parties involved", "plaintiff name"]

GOOD:
- case.parties.plaintiff.name
  Descriptors: ["civil case csrv01874", "parties involved in the case", "plaintiff party", "full legal name of plaintiff"]

BAD:
- document.dates.filed
  
GOOD:
- document.motion_to_compel.filing_details.date_filed
  Descriptors: ["legal documents related to case", "motion to compel deposition of defendant", "filing and submission details", "date document was filed with court"]

DESCRIPTOR REQUIREMENTS:
Each node must have a "descriptor" field that:
1. Provides specific, contextual information about that segment
2. Includes identifiers (case numbers, document names, party names)
3. Explains the organizational purpose of that level
4. Makes the segment understandable in isolation

RESPONSE FORMAT (JSON only):
{
  "graph": {
    "nodes": {
      "case": {
        "path": "case",
        "segments": ["case"],
        "descriptor": "civil case csrv01874",
        "noteIds": [],
        "children": {
          "proceedings": {
            "path": "case.proceedings",
            "segments": ["case", "proceedings"],
            "descriptor": "hearings, motions and other court proceedings for this case",
            "noteIds": [],
            "children": {
              "motion_to_compel": {
                "path": "case.proceedings.motion_to_compel",
                "segments": ["case", "proceedings", "motion_to_compel"],
                "descriptor": "motion to compel deposition of defendant",
                "noteIds": [],
                "children": {
                  "deadlines": {
                    "path": "case.proceedings.motion_to_compel.deadlines",
                    "segments": ["case", "proceedings", "motion_to_compel", "deadlines"],
                    "descriptor": "deadlines and time requirements for this motion",
                    "noteIds": [],
                    "children": {
                      "payment_due": {
                        "path": "case.proceedings.motion_to_compel.deadlines.payment_due",
                        "segments": ["case", "proceedings", "motion_to_compel", "deadlines", "payment_due"],
                        "descriptor": "amount due in sanctions for this motion",
                        "noteIds": ["note-123"]
                      }
                    }
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
        "path": "case.proceedings.motion_to_compel.deadlines.payment_due",
        "segments": ["case", "proceedings", "motion_to_compel", "deadlines", "payment_due"],
        "references": []
      }
    }
  ],
  "restructured": false
}

REMEMBER: Be VERY specific and granular. Each path should have enough intermediate segments to be completely unambiguous.

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
