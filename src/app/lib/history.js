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
    const base = {
      id: ensureString(fragment.id),
      type: 'pdf',
      name: ensureString(fragment.name, 'PDF'),
      fileId: ensureString(fragment.fileId),
    };
    // Back-compat: allow reading inline data if present, but do not rely on it for storage
    if ('data' in fragment) base.data = fragment.data ?? undefined;
    return base;
  }
  if (fragment.type === 'exhibits') {
    const ensureExhibit = (ex) => {
      const obj = ex && typeof ex === 'object' ? ex : {};
      return {
        id: ensureString(obj.id),
        title: ensureString(obj.title),
        description: ensureString(obj.description),
        name: ensureString(obj.name),
        mimeType: ensureString(obj.mimeType),
        type: ensureString(obj.type), // 'pdf' | 'image' | 'group'
        fileId: ensureString(obj.fileId),
        isCompound: Boolean(obj.isCompound),
        isGroupHeader: Boolean(obj.isGroupHeader),
        pageNumberPlacement: ensureString(obj.pageNumberPlacement, ''),
        // Back-compat inline data if present
        data: 'data' in obj ? obj.data ?? undefined : undefined,
      };
    };
    return {
      id: ensureString(fragment.id),
      type: 'exhibits',
      captions: ensureArray(fragment.captions, []).map((s) => ensureString(s)),
      exhibits: ensureArray(fragment.exhibits, []).map(ensureExhibit),
    };
  }
  return {
    id: ensureString(fragment.id),
    type: 'markdown',
    title: ensureString(fragment.title),
    content: ensureString(fragment.content),
    signatureType: ensureString(fragment.signatureType),
  };
}

export function ensureSnapshot(snapshot, fallback = {}) {
  const base = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const fallbackFragments = ensureArray(fallback.fragments, []);
  return {
    docTitle: ensureString(base.docTitle, fallback.docTitle),
    docDate: ensureString(base.docDate, fallback.docDate),
    leftHeadingFields: ensureArray(base.leftHeadingFields, fallback.leftHeadingFields || []).map((line) => ensureString(line)),
    rightHeadingFields: ensureArray(base.rightHeadingFields, fallback.rightHeadingFields || []).map((line) => ensureString(line)),
    plaintiffName: ensureString(base.plaintiffName, fallback.plaintiffName),
    defendantName: ensureString(base.defendantName, fallback.defendantName),
    courtTitle: ensureString(base.courtTitle, fallback.courtTitle),
    showPageNumbers: typeof base.showPageNumbers === 'boolean' ? base.showPageNumbers : (typeof fallback.showPageNumbers === 'boolean' ? fallback.showPageNumbers : true),
    pageNumberPlacement: ensureString(base.pageNumberPlacement, fallback.pageNumberPlacement || 'right'),
    fragments: ensureArray(base.fragments, fallbackFragments).map(ensureFragment),
  };
}

export function snapshotForStorage(snapshot) {
  const safe = ensureSnapshot(snapshot);
  return {
    ...safe,
    showPageNumbers: safe.showPageNumbers,
    pageNumberPlacement: safe.pageNumberPlacement,
    fragments: safe.fragments.map((fragment) => (
      fragment.type === 'pdf'
        ? { id: fragment.id, type: 'pdf', name: fragment.name, fileId: ensureString(fragment.fileId) }
        : fragment.type === 'exhibits'
          ? {
              id: fragment.id,
              type: 'exhibits',
              captions: ensureArray(fragment.captions, []).map((s) => ensureString(s)),
              exhibits: ensureArray(fragment.exhibits, []).map((ex) => ({
                id: ensureString(ex.id),
                title: ensureString(ex.title),
                description: ensureString(ex.description),
                name: ensureString(ex.name),
                mimeType: ensureString(ex.mimeType),
                type: ensureString(ex.type),
                fileId: ensureString(ex.fileId),
                isCompound: Boolean(ex.isCompound),
                isGroupHeader: Boolean(ex.isGroupHeader),
                pageNumberPlacement: ensureString(ex.pageNumberPlacement, ''),
              })),
            }
          : { id: fragment.id, type: 'markdown', title: fragment.title, content: fragment.content, signatureType: ensureString(fragment.signatureType) }
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