'use client';

const STORAGE_KEY = 'legalDraftingDocStateV2';

export function sanitizeDocState(docState) {
  if (!docState || typeof docState !== 'object') {
    return null;
  }

  const safeFragments = Array.isArray(docState.fragments)
    ? docState.fragments.map((fragment) => {
        if (!fragment || typeof fragment !== 'object') return null;
        if (fragment.type === 'pdf') {
          return {
            id: fragment.id,
            type: 'pdf',
            name: fragment.name || 'PDF',
          };
        }
        return {
          id: fragment.id,
          type: 'markdown',
          title: fragment.title || '',
          content: fragment.content || '',
        };
      }).filter(Boolean)
    : [];

  return {
    docDate: docState.docDate || '',
    leftHeadingFields: Array.isArray(docState.leftHeadingFields)
      ? [...docState.leftHeadingFields]
      : [],
    rightHeadingFields: Array.isArray(docState.rightHeadingFields)
      ? [...docState.rightHeadingFields]
      : [],
    plaintiffName: docState.plaintiffName || '',
    defendantName: docState.defendantName || '',
    courtTitle: docState.courtTitle || '',
    fragments: safeFragments,
  };
}

export function saveDocState(docState) {
  try {
    if (typeof window === 'undefined') return;
    const payload = sanitizeDocState(docState);
    if (!payload) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // ignore persistence errors
  }
}

export function loadDocState() {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}
