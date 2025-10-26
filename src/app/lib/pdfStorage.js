'use client';

// IndexedDB utilities for storing and retrieving PDF ArrayBuffers

export function openPdfDb() {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) return resolve(null);
      const request = window.indexedDB.open('legalDraftingDB', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('pdfs')) {
          db.createObjectStore('pdfs');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB open error'));
    } catch (e) {
      resolve(null);
    }
  });
}

export async function idbSetPdf(id, data) {
  try {
    const db = await openPdfDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction('pdfs', 'readwrite');
      const store = tx.objectStore('pdfs');
      store.put(data, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('idb set error'));
    });
  } catch (_) {}
}

export async function idbGetPdf(id) {
  try {
    const db = await openPdfDb();
    if (!db) return null;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('pdfs', 'readonly');
      const store = tx.objectStore('pdfs');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('idb get error'));
    });
  } catch (_) {
    return null;
  }
}
