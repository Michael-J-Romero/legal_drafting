'use client';

const STORAGE_KEY = 'legalDraftingDocumentHistoryV2';
const STORAGE_VERSION = 1;

function serializeFragment(fragment) {
  if (!fragment || typeof fragment !== 'object') {
    return null;
  }
  if (fragment.type === 'pdf') {
    return {
      id: fragment.id,
      type: 'pdf',
      name: fragment.name || '',
    };
  }
  return {
    id: fragment.id,
    type: 'markdown',
    title: fragment.title || '',
    content: fragment.content || '',
  };
}

function serializeDocument(doc) {
  if (!doc || typeof doc !== 'object') {
    return null;
  }
  return {
    docDate: doc.docDate || '',
    leftHeadingFields: Array.isArray(doc.leftHeadingFields) ? doc.leftHeadingFields : [],
    rightHeadingFields: Array.isArray(doc.rightHeadingFields) ? doc.rightHeadingFields : [],
    plaintiffName: doc.plaintiffName || '',
    defendantName: doc.defendantName || '',
    courtTitle: doc.courtTitle || '',
    fragments: Array.isArray(doc.fragments) ? doc.fragments.map(serializeFragment).filter(Boolean) : [],
  };
}

function deserializeFragment(fragment) {
  if (!fragment || typeof fragment !== 'object') return null;
  if (fragment.type === 'pdf') {
    return {
      id: fragment.id,
      type: 'pdf',
      name: fragment.name || '',
      data: fragment.data ?? null,
    };
  }
  return {
    id: fragment.id,
    type: 'markdown',
    title: fragment.title || '',
    content: fragment.content || '',
  };
}

function deserializeDocument(doc) {
  if (!doc || typeof doc !== 'object') return null;
  return {
    docDate: doc.docDate || '',
    leftHeadingFields: Array.isArray(doc.leftHeadingFields) ? doc.leftHeadingFields.slice() : [],
    rightHeadingFields: Array.isArray(doc.rightHeadingFields) ? doc.rightHeadingFields.slice() : [],
    plaintiffName: doc.plaintiffName || '',
    defendantName: doc.defendantName || '',
    courtTitle: doc.courtTitle || '',
    fragments: Array.isArray(doc.fragments)
      ? doc.fragments.map(deserializeFragment).filter(Boolean)
      : [],
  };
}

export function saveDocumentHistory(history) {
  try {
    if (typeof window === 'undefined') return;
    if (!history || typeof history !== 'object') return;
    const payload = {
      version: STORAGE_VERSION,
      past: Array.isArray(history.past) ? history.past.map(serializeDocument).filter(Boolean) : [],
      present: serializeDocument(history.present),
      future: Array.isArray(history.future) ? history.future.map(serializeDocument).filter(Boolean) : [],
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // ignore persistence failures
  }
}

export function loadDocumentHistory() {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== STORAGE_VERSION) {
      return null;
    }
    const past = Array.isArray(parsed.past) ? parsed.past.map(deserializeDocument).filter(Boolean) : [];
    const present = deserializeDocument(parsed.present);
    const future = Array.isArray(parsed.future) ? parsed.future.map(deserializeDocument).filter(Boolean) : [];
    if (!present) return null;
    return { past, present, future };
  } catch (_) {
    return null;
  }
}

export function clearDocumentHistory() {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    // ignore
  }
}

export function serializeDocumentForHistory(doc) {
  return serializeDocument(doc);
}

export function deserializeDocumentFromHistory(doc) {
  return deserializeDocument(doc);
}
