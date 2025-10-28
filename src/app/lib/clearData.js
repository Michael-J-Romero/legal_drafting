'use client';

// Clear all local data: localStorage and IndexedDB (for this origin)
// Attempts to delete all databases if supported; otherwise deletes the known app DB.
export async function clearAllLocalData(options = {}) {
  const { reload = false } = options;
  try {
    if (typeof window === 'undefined') return;

    // Clear Local Storage
    try { window.localStorage && window.localStorage.clear(); } catch (_) {}

    // Delete IndexedDB databases
    try {
      const { indexedDB } = window;
      if (indexedDB) {
        if (typeof indexedDB.databases === 'function') {
          // Best effort: delete every DB for this origin
          const dbs = await indexedDB.databases();
          await Promise.all((dbs || []).map((db) => new Promise((resolve) => {
            const name = db && db.name;
            if (!name) return resolve();
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          })));
        } else {
          // Fallback: delete the known app DB
          await new Promise((resolve) => {
            const req = indexedDB.deleteDatabase('legalDraftingDB');
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          });
        }
      }
    } catch (_) {}

    if (reload) {
      try { window.location.reload(); } catch (_) {}
    }
  } catch (_) {
    // ignore
  }
}
