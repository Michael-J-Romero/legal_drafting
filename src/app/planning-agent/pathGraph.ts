/**
 * Path Graph Management
 * Handles the persistent hierarchical path graph for notes
 */

export interface PathNode {
  path: string;
  segments: string[];
  descriptor: string; // Human-readable description of what this path segment represents
  noteIds: string[];
  children?: Record<string, PathNode>;
  contextSignature?: string; // Optional: Key entities for matching (e.g., "john_smith", "case_123")
}

export interface PathMigration {
  oldPath: string;
  newPath: string;
  noteIds: string[];
  reason: string;
  timestamp: string;
}

export interface PathGraph {
  nodes: Record<string, PathNode>;
  lastUpdated: string;
  migrations?: PathMigration[]; // Track path changes for reference integrity
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
 * Generate a fallback path for a note when AI processing fails
 */
function generateFallbackPath(note: any): { path: string; segments: string[]; references?: string[] } {
  const sanitize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  
  // Start with category
  const segments: string[] = [sanitize(note.category || 'other')];
  
  // Add context-based segments if available
  if (note.context?.who?.[0]) {
    segments.push(sanitize(note.context.who[0]));
  } else if (note.context?.what) {
    segments.push(sanitize(note.context.what));
  }
  
  // Add a segment from content if we don't have enough specificity
  if (segments.length < 2 && note.content) {
    const words = note.content.split(' ').filter((w: string) => w.length > 3);
    if (words[0]) {
      segments.push(sanitize(words[0]));
    }
  }
  
  return {
    path: segments.join('.'),
    segments,
    references: []
  };
}

/**
 * Add notes to the path graph using AI (with fallback)
 */
export async function addNotesToPathGraph(notes: any[], existingGraph?: PathGraph): Promise<{
  graph: PathGraph;
  updatedNotes: any[];
  restructured: boolean;
  migrations?: PathMigration[];
  success: boolean;
  error?: string;
}> {
  const graph = existingGraph || loadPathGraph();

  try {
    console.log('[PATH GRAPH] Processing', notes.length, 'notes');
    
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
      // Add migrations to graph if restructuring occurred
      if (result.restructured && result.migrations) {
        result.graph.migrations = [
          ...(result.graph.migrations || []),
          ...result.migrations
        ];
        console.log('[PATH GRAPH] Added', result.migrations.length, 'migrations to graph');
      }
      
      savePathGraph(result.graph);
      console.log('[PATH GRAPH] API call successful, all', notes.length, 'notes now have paths');
      return result;
    } else {
      throw new Error(result.error || 'Unknown API error');
    }
  } catch (error) {
    console.warn('[PATH GRAPH] API failed, using fallback paths:', error instanceof Error ? error.message : error);
    
    // Generate fallback paths for all notes
    const updatedNotes = notes.map(note => {
      const fallbackPath = generateFallbackPath(note);
      console.log('[PATH GRAPH] Generated fallback path for note:', fallbackPath.path);
      return {
        ...note,
        path: fallbackPath
      };
    });
    
    console.log('[PATH GRAPH] All', notes.length, 'notes assigned fallback paths');
    
    return {
      graph,
      updatedNotes,
      restructured: false,
      success: true, // Still success, just with fallback paths
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

/**
 * Apply path migrations to notes
 * Ensures all note references use current paths after restructuring
 */
export function applyMigrations(notes: any[], graph: PathGraph): any[] {
  if (!graph.migrations || graph.migrations.length === 0) {
    return notes;
  }

  console.log('[PATH GRAPH] Applying', graph.migrations.length, 'path migrations');

  const migratedNotes = notes.map(note => {
    if (!note.path || !note.path.path) return note;

    // Check if this note's path has been migrated
    const migration = graph.migrations?.find(m => 
      m.noteIds.includes(note.id) && m.oldPath === note.path.path
    );

    if (migration) {
      console.log('[PATH GRAPH] Migrating note', note.id, 'from', migration.oldPath, 'to', migration.newPath);
      const newSegments = migration.newPath.split('.');
      return {
        ...note,
        path: {
          path: migration.newPath,
          segments: newSegments,
          references: note.path.references || []
        }
      };
    }

    return note;
  });

  return migratedNotes;
}
