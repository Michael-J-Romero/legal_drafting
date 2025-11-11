import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface PathNode {
  path: string;
  segments: string[];
  descriptor: string; // Human-readable description of what this path segment represents
  noteIds: string[];
  children?: Record<string, PathNode>;
  contextSignature?: string; // Optional: Key entities for matching
}

interface PathMigration {
  oldPath: string;
  newPath: string;
  noteIds: string[];
  reason: string;
  timestamp: string;
}

interface PathGraph {
  nodes: Record<string, PathNode>;
  lastUpdated: string;
  migrations?: PathMigration[];
}

/**
 * API route for managing the hierarchical path graph
 * - Analyzes new notes and assigns appropriate paths
 * - Maintains a persistent graph structure
 * - Intelligently restructures when needed
 */
/**
 * Helper function to find a note's path in the graph by searching all nodes
 */
function findNotePathInGraph(graph: any, noteId: string): any | null {
  function searchNode(node: any): any | null {
    // Check if this node contains the note
    if (node.noteIds && node.noteIds.includes(noteId)) {
      return {
        path: node.path,
        segments: node.segments || node.path.split('.'),
        references: [] // Can be populated later if needed
      };
    }
    
    // Search children
    if (node.children) {
      for (const childKey of Object.keys(node.children)) {
        const result = searchNode(node.children[childKey]);
        if (result) return result;
      }
    }
    
    return null;
  }
  
  // Search all top-level nodes
  if (graph && graph.nodes) {
    for (const nodeKey of Object.keys(graph.nodes)) {
      const result = searchNode(graph.nodes[nodeKey]);
      if (result) return result;
    }
  }
  
  return null;
}

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
      
      if (result.restructured) {
        console.log('[PATH GRAPH] Graph was restructured');
        if (result.migrations && result.migrations.length > 0) {
          console.log('[PATH GRAPH] Migrations:', result.migrations.length);
          result.migrations.forEach((m: any) => {
            console.log(`[PATH GRAPH] Migration: ${m.oldPath} → ${m.newPath} (${m.noteIds.length} notes)`);
          });
        }
      }

      // If AI didn't return updatedNotes, extract paths from graph
      let updatedNotes = result.updatedNotes;
      if (!updatedNotes || updatedNotes.length === 0) {
        console.log('[PATH GRAPH] AI did not return updatedNotes, extracting from graph...');
        updatedNotes = notes.map(note => {
          // Find this note's path in the graph
          const notePath = findNotePathInGraph(result.graph, note.id);
          if (notePath) {
            console.log(`[PATH GRAPH] Extracted path for note ${note.id}: ${notePath.path}`);
            return {
              ...note,
              path: notePath
            };
          }
          console.warn(`[PATH GRAPH] Could not find path for note ${note.id} in graph`);
          return note;
        });
      }

      return NextResponse.json({
        graph: result.graph,
        updatedNotes,
        restructured: result.restructured || false,
        migrations: result.migrations || [],
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
    ? `EXISTING PATH GRAPH (Your Single Source of Truth):
${JSON.stringify(existingGraph, null, 2)}

CRITICAL: This is the COMPLETE current state. Study it carefully:
- Examine ALL existing nodes and their descriptors
- Check context signatures to identify entities
- Understand what each path represents
- Maintain consistency where appropriate
- Identify ambiguities that need disambiguation
`
    : 'No existing graph. You will create the initial path structure based on these notes.\n';

  return `${graphSection}
NEW NOTES TO ADD:
${notes.map((n, idx) => `[${idx}] ID: ${n.id}
Content: ${n.content}
Category: ${n.category}
Current Path: ${n.path ? n.path.path : 'none'}
Context: ${JSON.stringify(n.context || {})}`).join('\n\n')}

YOUR CRITICAL TASK - CONTEXT-AWARE PATH ASSIGNMENT WITH DISAMBIGUATION:

═══════════════════════════════════════════════════════════════════════
PHASE 1: ANALYZE EXISTING GRAPH (if it exists)
═══════════════════════════════════════════════════════════════════════

1. READ ALL EXISTING NODE DESCRIPTORS:
   - Each descriptor contains specific entity information
   - Look for names, IDs, case numbers, dates, identifiers
   - These identify WHICH entity the node represents

2. EXTRACT CONTEXT SIGNATURES:
   - From "John's car color: blue" → entity: "John"
   - From "case CS-2024-0187" → entity: "CS-2024-0187"
   - From "Meeting with Mary on March 15" → entities: "Mary", "March 15"

3. IDENTIFY AMBIGUOUS NODES (need restructuring):
   - Descriptor lacks entity identifiers: "car color" (which car?)
   - Descriptor could apply to multiple entities
   - Mark these for potential restructuring

═══════════════════════════════════════════════════════════════════════
PHASE 2: PROCESS NEW NOTES - CONTEXT-AWARE PLACEMENT
═══════════════════════════════════════════════════════════════════════

For EACH new note:

STEP 1: EXTRACT ENTITIES from the note
  - Parse content and context for: names, IDs, case numbers, document titles, dates
  - Example: "John's car is blue" → entity: "John"
  - Example: "Case #CS-123 hearing" → entity: "CS-123"

STEP 2: CHECK IF MATCHING NODE EXISTS
  - Look for existing nodes with same path structure
  - Compare entities in node's descriptor vs note's entities
  - Check contextSignature if present
  
  Example:
  - Note: "Mary's car is red" → entity: "Mary"
  - Existing: properties.john.car.color (descriptor: "John's car color")
  - Entity check: "Mary" ≠ "John" → DO NOT use this node
  - Create new: properties.mary.car.color

STEP 3: DECISION - USE EXISTING NODE OR CREATE NEW?
  
  ✅ USE EXISTING if:
  - Entities EXACTLY match (John === John)
  - Context truly refers to same thing
  - Descriptor confirms it's the right entity
  
  ❌ CREATE NEW if:
  - Entities differ (John ≠ Mary)
  - Context refers to different entity
  - Would create ambiguity to combine

STEP 4: HANDLE AMBIGUOUS EXISTING NODES
  If existing node lacks entity identifier:
  - Example: "car.color" without owner
  - And new note has entity: "Mary's car"
  - RESTRUCTURE to disambiguate:
    * Old: properties.car.color → properties.default_car.color
    * New: properties.mary.car.color
  - Add to migrations array

═══════════════════════════════════════════════════════════════════════
DISAMBIGUATION EXAMPLES (CRITICAL - FOLLOW THESE)
═══════════════════════════════════════════════════════════════════════

EXAMPLE 1: Two Different People's Cars
─────────────────────────────────────
Note 1: "John's car is blue"
  Context: { who: ["John"], what: "car color" }
  
Note 2: "Mary's car is red"
  Context: { who: ["Mary"], what: "car color" }

✅ CORRECT - Separate paths:
  - properties.john.car.color
    Descriptor: "John's car color: blue"
  - properties.mary.car.color
    Descriptor: "Mary's car color: red"

❌ WRONG - Same path (creates confusion):
  - properties.car.color (Which car? John's or Mary's?)

EXAMPLE 2: Two Different Cases
─────────────────────────────────────
Note 1: "Hearing for case CS-2024-0187 on March 15"
  Content: mentions "case CS-2024-0187"
  
Note 2: "Hearing for case CS-2024-0190 on March 20"
  Content: mentions "case CS-2024-0190"

✅ CORRECT - Separate paths:
  - case_cs_2024_0187.hearings.march_15
    Descriptor: "hearing for case CS-2024-0187 on March 15"
  - case_cs_2024_0190.hearings.march_20
    Descriptor: "hearing for case CS-2024-0190 on March 20"

EXAMPLE 3: Restructuring Ambiguous Node
─────────────────────────────────────
Existing: properties.car.color
  Descriptor: "car color: blue" (NO entity identifier - ambiguous!)
  noteIds: ["note-1"]

New Note: "Mary's car is red"
  Context: { who: ["Mary"], what: "car color" }

✅ CORRECT - Restructure:
  1. Existing note unclear which car → rename to default_car
  2. New note is Mary's car → create mary.car
  
  New structure:
  - properties.default_car.color (note-1 migrated here)
    Descriptor: "default car color: blue"
  - properties.mary.car.color (note-2 here)
    Descriptor: "Mary's car color: red"
  
  Add migration:
  {
    "oldPath": "properties.car.color",
    "newPath": "properties.default_car.color",
    "noteIds": ["note-1"],
    "reason": "Disambiguated to differentiate from Mary's car",
    "timestamp": "2025-11-08T12:00:00Z"
  }

═══════════════════════════════════════════════════════════════════════
PATH STRUCTURE PRINCIPLES (Data-Driven)
═══════════════════════════════════════════════════════════════════════

1. USE ACTUAL DATA from notes:
   - Specific names: "john_smith", "mary_johnson"
   - Specific IDs: "case_cs_2024_0187", "invoice_12345"
   - Specific dates: "march_15_2024", "jan_10_2023"

2. ENTITY IDENTIFIERS in paths:
   - If note mentions person → include their name in path
   - If note mentions case → include case ID in path
   - If note mentions document → include document name in path

3. DESCRIPTORS reference actual data:
   - Quote specific values from note content
   - Include entity identifiers
   - Make it clear WHICH entity this refers to

4. FLOW: General → Specific
   - Start broad: category/domain
   - Add entity: specific person/case/document
   - Add detail: what about that entity
   - End specific: the actual data point

═══════════════════════════════════════════════════════════════════════
RESPONSE FORMAT (JSON only)
═══════════════════════════════════════════════════════════════════════

{
  "graph": {
    "nodes": { ...complete updated graph structure... },
    "lastUpdated": "${new Date().toISOString()}",
    "migrations": [ ...optional, if restructured... ]
  },
  "updatedNotes": [
    {
      "id": "note-123",
      "path": {
        "path": "properties.john.car.color",
        "segments": ["properties", "john", "car", "color"],
        "references": []
      }
    }
  ],
  "restructured": false (or true if graph was restructured),
  "migrations": [ ...if restructured, list all path changes... ]
}

MIGRATION OBJECT FORMAT (when restructured):
{
  "oldPath": "properties.car.color",
  "newPath": "properties.john.car.color",
  "noteIds": ["note-123"],
  "reason": "Added entity identifier to disambiguate from other cars",
  "timestamp": "${new Date().toISOString()}"
}

═══════════════════════════════════════════════════════════════════════
REMEMBER - CRITICAL SUCCESS CRITERIA:
═══════════════════════════════════════════════════════════════════════

✅ Check existing node descriptors before reusing paths
✅ Extract entities from notes (names, IDs, case numbers)
✅ Compare entities - only combine if EXACT match
✅ Different entities = different paths (John's car ≠ Mary's car)
✅ Include entity identifiers in paths and descriptors
✅ Restructure ambiguous existing nodes when needed
✅ Provide migrations when restructuring
✅ Make every path self-explanatory with its descriptor

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
