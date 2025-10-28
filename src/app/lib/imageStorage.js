'use client';

// IndexedDB utilities for storing and retrieving Image ArrayBuffers

export function openImageDb() {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) return resolve(null);
      try { console.log('images__idb_open_start'); } catch (_) {}
      // Bump version to 3 to ensure both stores exist even if v2 was created without 'images'
      const request = window.indexedDB.open('legalDraftingDB', 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        // Ensure both stores exist regardless of which module triggers the upgrade
        if (!db.objectStoreNames.contains('pdfs')) db.createObjectStore('pdfs');
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
      };
      request.onblocked = () => { try { console.warn('images__idb_open_blocked'); } catch (_) {} };
      request.onsuccess = () => { try { console.log('images__idb_open_success'); } catch (_) {} resolve(request.result); };
      request.onerror = () => { try { console.warn('images__idb_open_error', request?.error); } catch (_) {} reject(request.error || new Error('IndexedDB open error')); };
    } catch (e) {
      try { console.warn('images__idb_open_catch', e); } catch (_) {}
      resolve(null);
    }
  });
}

export async function idbSetImage(id, data) {
  try {
    try { console.log('images__idb_set_start', { id, size: data?.byteLength }); } catch (_) {}
    const db = await openImageDb();
    if (!db) return;
    if (!db.objectStoreNames || !db.objectStoreNames.contains('images')) {
      try { console.warn('images__idb_set_missing_store'); } catch (_) {}
      try { db.close?.(); } catch (_) {}
      return;
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite');
      const store = tx.objectStore('images');
      store.put(data, id);
      tx.oncomplete = () => { try { console.log('images__idb_set_ok', { id }); } catch (_) {} resolve(); };
      tx.onerror = () => { try { console.warn('images__idb_set_error', { id, err: tx?.error }); } catch (_) {} reject(tx.error || new Error('idb set error')); };
    });
  } catch (e) { try { console.warn('images__idb_set_catch', { id, e }); } catch (_) {} }
}

export async function idbGetImage(id) {
  try {
    try { console.log('images__idb_get_start', { id }); } catch (_) {}
    const db = await openImageDb();
    if (!db) return null;
    if (!db.objectStoreNames || !db.objectStoreNames.contains('images')) {
      try { console.warn('images__idb_get_missing_store'); } catch (_) {}
      try { db.close?.(); } catch (_) {}
      return null;
    }
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readonly');
      const store = tx.objectStore('images');
      const req = store.get(id);
      req.onsuccess = () => { try { console.log('images__idb_get_ok', { id, hit: !!req.result, size: req.result?.byteLength }); } catch (_) {} resolve(req.result || null); };
      req.onerror = () => { try { console.warn('images__idb_get_error', { id, err: req?.error }); } catch (_) {} reject(req.error || new Error('idb get error')); };
    });
  } catch (e) {
    try { console.warn('images__idb_get_catch', { id, e }); } catch (_) {}
    return null;
  }
}
