'use client';

import { create } from 'zustand';
import {
  DEFAULT_LEFT_HEADING_FIELDS,
  DEFAULT_RIGHT_HEADING_FIELDS,
  DEFAULT_PLAINTIFF_NAME,
  DEFAULT_DEFENDANT_NAME,
  DEFAULT_COURT_TITLE,
  DEFAULT_WELCOME_TITLE,
  DEFAULT_WELCOME_CONTENT,
} from '../app/lib/defaults';
import { createFragmentId } from '../app/lib/fragments';

function safeToday() {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch (_) {
    return '';
  }
}

function cloneFragment(fragment) {
  if (!fragment) return fragment;
  if (fragment.type === 'pdf') {
    const data = fragment.data instanceof ArrayBuffer ? fragment.data.slice(0) : fragment.data || null;
    return {
      id: fragment.id,
      type: 'pdf',
      name: fragment.name || 'PDF',
      data,
    };
  }
  return {
    id: fragment.id,
    type: 'markdown',
    title: fragment.title || '',
    content: fragment.content || '',
  };
}

function cloneDocument(doc) {
  return {
    docDate: doc?.docDate || '',
    leftHeadingFields: Array.isArray(doc?.leftHeadingFields) ? [...doc.leftHeadingFields] : [],
    rightHeadingFields: Array.isArray(doc?.rightHeadingFields) ? [...doc.rightHeadingFields] : [],
    plaintiffName: doc?.plaintiffName || '',
    defendantName: doc?.defendantName || '',
    courtTitle: doc?.courtTitle || '',
    fragments: Array.isArray(doc?.fragments) ? doc.fragments.map((fragment) => cloneFragment(fragment)) : [],
  };
}

export function createInitialDocument() {
  return {
    docDate: safeToday(),
    leftHeadingFields: [...DEFAULT_LEFT_HEADING_FIELDS],
    rightHeadingFields: [...DEFAULT_RIGHT_HEADING_FIELDS],
    plaintiffName: DEFAULT_PLAINTIFF_NAME,
    defendantName: DEFAULT_DEFENDANT_NAME,
    courtTitle: DEFAULT_COURT_TITLE,
    fragments: [
      {
        id: createFragmentId(),
        type: 'markdown',
        title: DEFAULT_WELCOME_TITLE,
        content: DEFAULT_WELCOME_CONTENT,
      },
    ],
  };
}

const initialDocument = createInitialDocument();

const useDocumentStore = create((set, get) => ({
  document: cloneDocument(initialDocument),
  historyPast: [],
  historyFuture: [],
  commit(updater, options = {}) {
    const { recordHistory = true, clearFuture = true } = options;
    set((state) => {
      const prevDoc = state.document;
      const nextDoc = cloneDocument(typeof updater === 'function' ? updater(prevDoc) : updater);
      if (recordHistory) {
        const nextPast = [...state.historyPast, cloneDocument(prevDoc)];
        return {
          document: nextDoc,
          historyPast: nextPast,
          historyFuture: clearFuture ? [] : state.historyFuture,
        };
      }
      return {
        document: nextDoc,
      };
    });
  },
  overwrite(document, past = [], future = []) {
    set({
      document: cloneDocument(document),
      historyPast: past.map((snapshot) => cloneDocument(snapshot)),
      historyFuture: future.map((snapshot) => cloneDocument(snapshot)),
    });
  },
  resetHistory() {
    set({ historyPast: [], historyFuture: [] });
  },
  async undo() {
    const { historyPast, document, historyFuture } = get();
    if (!historyPast.length) return null;
    const previous = historyPast[historyPast.length - 1];
    const restPast = historyPast.slice(0, -1);
    const nextFuture = [...historyFuture, cloneDocument(document)];
    set({
      document: cloneDocument(previous),
      historyPast: restPast,
      historyFuture: nextFuture,
    });
    return previous;
  },
  async redo() {
    const { historyFuture, document, historyPast } = get();
    if (!historyFuture.length) return null;
    const nextSnapshot = historyFuture[historyFuture.length - 1];
    const restFuture = historyFuture.slice(0, -1);
    const nextPast = [...historyPast, cloneDocument(document)];
    set({
      document: cloneDocument(nextSnapshot),
      historyPast: nextPast,
      historyFuture: restFuture,
    });
    return nextSnapshot;
  },
}));

export function toStoredSnapshot(doc) {
  return {
    docDate: doc?.docDate || '',
    leftHeadingFields: Array.isArray(doc?.leftHeadingFields) ? [...doc.leftHeadingFields] : [],
    rightHeadingFields: Array.isArray(doc?.rightHeadingFields) ? [...doc.rightHeadingFields] : [],
    plaintiffName: doc?.plaintiffName || '',
    defendantName: doc?.defendantName || '',
    courtTitle: doc?.courtTitle || '',
    fragments: Array.isArray(doc?.fragments)
      ? doc.fragments.map((fragment) => {
          if (!fragment || typeof fragment !== 'object') {
            return null;
          }
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
      : [],
  };
}

export default useDocumentStore;
