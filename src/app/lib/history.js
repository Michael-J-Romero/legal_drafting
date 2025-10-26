'use client';

export const LS_HISTORY_KEY = 'legalDraftingHistoryV2';

function ensureString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function ensureFragment(fragment) {
  if (!fragment || typeof fragment !== 'object') {
    return { id: '', type: 'markdown', title: '', content: '' };
  }
  if (fragment.type === 'pdf') {
    return {
      id: ensureString(fragment.id),
      type: 'pdf',
      name: ensureString(fragment.name, 'PDF'),
      data: fragment.data ?? null,
    };
  }
  return {
    id: ensureString(fragment.id),
    type: 'markdown',
    title: ensureString(fragment.title),
    content: ensureString(fragment.content),
  };
}

export function ensureSnapshot(snapshot, fallback = {}) {
  const base = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const fallbackFragments = ensureArray(fallback.fragments, []);
  return {
    docDate: ensureString(base.docDate, fallback.docDate),
    leftHeadingFields: ensureArray(base.leftHeadingFields, fallback.leftHeadingFields || []).map((line) => ensureString(line)),
    rightHeadingFields: ensureArray(base.rightHeadingFields, fallback.rightHeadingFields || []).map((line) => ensureString(line)),
    plaintiffName: ensureString(base.plaintiffName, fallback.plaintiffName),
    defendantName: ensureString(base.defendantName, fallback.defendantName),
    courtTitle: ensureString(base.courtTitle, fallback.courtTitle),
    fragments: ensureArray(base.fragments, fallbackFragments).map(ensureFragment),
  };
}

export function snapshotForStorage(snapshot) {
  const safe = ensureSnapshot(snapshot);
  return {
    ...safe,
    fragments: safe.fragments.map((fragment) => (
      fragment.type === 'pdf'
        ? { id: fragment.id, type: 'pdf', name: fragment.name }
        : { id: fragment.id, type: 'markdown', title: fragment.title, content: fragment.content }
    )),
  };
}

export function historyToStorage(history) {
  const safe = history && typeof history === 'object' ? history : {};
  const past = ensureArray(safe.past, []).map(snapshotForStorage);
  const future = ensureArray(safe.future, []).map(snapshotForStorage);
  const present = snapshotForStorage(safe.present);
  return { past, present, future };
}

export function historyFromStorage(raw, fallbackSnapshot) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') {
      return { past: [], present: ensureSnapshot(null, fallbackSnapshot), future: [] };
    }
    const past = ensureArray(parsed.past, []).map((snap) => ensureSnapshot(snap, fallbackSnapshot));
    const future = ensureArray(parsed.future, []).map((snap) => ensureSnapshot(snap, fallbackSnapshot));
    const present = ensureSnapshot(parsed.present, fallbackSnapshot);
    return { past, present, future };
  } catch (error) {
    return { past: [], present: ensureSnapshot(null, fallbackSnapshot), future: [] };
  }
}
