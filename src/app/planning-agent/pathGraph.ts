/**
 * Path Graph Management
 * Handles the persistent hierarchical path graph for notes
 */

export interface PathNode {
  path: string;
  segments: string[];
  noteIds: string[];
  children?: Record<string, PathNode>;
}

export interface PathGraph {
  nodes: Record<string, PathNode>;
  lastUpdated: string;
}

const PATH_GRAPH_STORAGE_KEY = 'planningAgentPathGraph';

/**
 * Load path graph from localStorage
 */
export function loadPathGraph(): PathGraph {
  if (typeof window === 'undefined') {
    return { nodes: {}, lastUpdated: new Date().toISOString() };
  }

  try {
    const stored = localStorage.getItem(PATH_GRAPH_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[PathGraph] Error loading from localStorage:', error);
  }

  return { nodes: {}, lastUpdated: new Date().toISOString() };
}

/**
 * Save path graph to localStorage
 */
export function savePathGraph(graph: PathGraph): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(PATH_GRAPH_STORAGE_KEY, JSON.stringify(graph));
    console.log('[PathGraph] Saved graph with', Object.keys(graph.nodes).length, 'top-level paths');
  } catch (error) {
    console.error('[PathGraph] Error saving to localStorage:', error);
  }
}

/**
 * Add notes to the path graph using AI
 */
export async function addNotesToPathGraph(notes: any[], existingGraph?: PathGraph): Promise<{
  graph: PathGraph;
  updatedNotes: any[];
  restructured: boolean;
  success: boolean;
  error?: string;
}> {
  const graph = existingGraph || loadPathGraph();

  try {
    const response = await fetch('/api/manage-path-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_notes',
        notes,
        existingGraph: graph,
      }),
    });

    if (!response.ok) {
      throw new Error(`Path graph API failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success && result.graph) {
      savePathGraph(result.graph);
    }

    return result;
  } catch (error) {
    console.error('[PathGraph] Error adding notes:', error);
    return {
      graph,
      updatedNotes: notes,
      restructured: false,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove notes from the path graph
 */
export async function removeNotesFromPathGraph(noteIds: string[], existingGraph?: PathGraph): Promise<{
  graph: PathGraph;
  success: boolean;
  error?: string;
}> {
  const graph = existingGraph || loadPathGraph();

  try {
    const response = await fetch('/api/manage-path-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'remove_notes',
        deletedNoteIds: noteIds,
        existingGraph: graph,
      }),
    });

    if (!response.ok) {
      throw new Error(`Path graph API failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success && result.graph) {
      savePathGraph(result.graph);
    }

    return result;
  } catch (error) {
    console.error('[PathGraph] Error removing notes:', error);
    return {
      graph,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Query the path graph for a specific path
 */
export function queryPathGraph(graph: PathGraph, pathString: string): PathNode | null {
  const segments = pathString.split('.');
  let current: any = graph.nodes;

  for (const segment of segments) {
    if (!current[segment]) {
      return null;
    }
    if (current[segment].path === pathString) {
      return current[segment];
    }
    current = current[segment].children || {};
  }

  return null;
}

/**
 * Get all notes in a path subtree
 */
export function getNotesInPath(graph: PathGraph, pathString: string): string[] {
  const node = queryPathGraph(graph, pathString);
  if (!node) return [];

  const noteIds: string[] = [...(node.noteIds || [])];

  function collectNoteIds(n: PathNode) {
    if (n.noteIds) {
      noteIds.push(...n.noteIds);
    }
    if (n.children) {
      Object.values(n.children).forEach(collectNoteIds);
    }
  }

  if (node.children) {
    Object.values(node.children).forEach(collectNoteIds);
  }

  return [...new Set(noteIds)]; // Remove duplicates
}
