import { arrayBufferToBase64 } from '../utils/base64';

function sanitizeFragment(fragment) {
  if (!fragment || typeof fragment !== 'object') return fragment;
  if (fragment.type === 'exhibits') {
    const exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
    fragment.exhibits = exhibits.map((exhibit) => {
      if (!exhibit || typeof exhibit !== 'object') return exhibit;
      const copy = { ...exhibit };
      if (copy.data) delete copy.fileId;
      return copy;
    });
  } else if (fragment.type === 'pdf') {
    if (fragment.data) delete fragment.fileId;
  }
  return fragment;
}

export function sanitizeDocument(doc) {
  const safeDoc = {
    docTitle: typeof doc?.docTitle === 'string' ? doc.docTitle : '',
    docDate: doc?.docDate || '',
    leftHeadingFields: Array.isArray(doc?.leftHeadingFields) ? doc.leftHeadingFields : [],
    rightHeadingFields: Array.isArray(doc?.rightHeadingFields) ? doc.rightHeadingFields : [],
    plaintiffName: doc?.plaintiffName || '',
    defendantName: doc?.defendantName || '',
    courtTitle: doc?.courtTitle || '',
    showPageNumbers: typeof doc?.showPageNumbers === 'boolean' ? doc.showPageNumbers : true,
    fragments: Array.isArray(doc?.fragments) ? doc.fragments.map((f) => sanitizeFragment({ ...f })) : [],
  };

  safeDoc.fragments = safeDoc.fragments.map((fragment) => {
    if (!fragment || typeof fragment !== 'object') return fragment;
    if (fragment.type === 'exhibits') {
      fragment.exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
    }
    return fragment;
  });

  return safeDoc;
}

export function prepareRawDocument(docState) {
  const clone = JSON.parse(JSON.stringify(docState));
  for (const fragment of clone.fragments || []) {
    if (!fragment || typeof fragment !== 'object') continue;
    if (fragment.type === 'pdf') {
      if (fragment.data) delete fragment.data;
    } else if (fragment.type === 'exhibits') {
      const exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
      fragment.exhibits = exhibits.map((exhibit) => {
        if (exhibit && exhibit.data) {
          const copy = { ...exhibit };
          delete copy.data;
          return copy;
        }
        return exhibit;
      });
    }
  }
  return clone;
}

export async function embedExternalAssets(docState, fetchBytes) {
  const clone = JSON.parse(JSON.stringify(docState));
  for (const fragment of clone.fragments || []) {
    if (!fragment || typeof fragment !== 'object') continue;
    if (fragment.type === 'pdf') {
      if (!fragment.data && fragment.fileId) {
        const buffer = await fetchBytes(fragment.fileId);
        if (buffer) fragment.data = arrayBufferToBase64(buffer);
      }
      if (fragment.data) delete fragment.fileId;
    } else if (fragment.type === 'exhibits') {
      const exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
      for (const exhibit of exhibits) {
        if (!exhibit || typeof exhibit !== 'object') continue;
        if (!exhibit.data && exhibit.fileId) {
          const buffer = await fetchBytes(exhibit.fileId);
          if (buffer) exhibit.data = arrayBufferToBase64(buffer);
        }
        if (exhibit.data) delete exhibit.fileId;
      }
    }
  }
  return clone;
}

export function createBundle(doc) {
  return {
    kind: 'legal-drafting-bundle',
    version: 1,
    createdAt: new Date().toISOString(),
    doc,
  };
}

export function createBundleFileName(title) {
  const raw = (title || '').trim();
  const base = raw
    ? raw
        .replace(/[^\w\s-]+/g, '')
        .replace(/[\s]+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80)
    : 'legal-drafting-document';
  return `${base}.json`;
}
