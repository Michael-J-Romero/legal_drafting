'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentHistory } from 'persistent-history';
import { useReactToPrint } from 'react-to-print';

import { idbSetPdf, idbGetPdf } from '../lib/pdfStorage';
import { historyToStorage, historyFromStorage, LS_HISTORY_KEY } from '../lib/history';
import { clearAllLocalData } from '../lib/clearData';
import {
  DEFAULT_PDF_FILE,
  DEFAULT_PDF_PATH,
  PRINT_DOCUMENT_TITLE,
  COMPILED_PDF_DOWNLOAD_NAME,
  CONFIRM_DELETE_MESSAGE,
  UNDO_THROTTLE_MS,
} from '../lib/defaults';
import { createInitialDocState } from '../state/document';
import {
  createFragmentId,
  syncFragmentCounterFromList,
  createEmptyMarkdownFragment,
  createExhibitsFragment,
  createPdfFragment,
} from '../lib/fragments';
import { arrayBufferToBase64, base64ToUint8Array } from '../utils/base64';
import { compileDocumentPdf } from '../services/pdfCompiler';

export default function useDocumentManager() {
  const initialDocStateRef = useRef();
  if (!initialDocStateRef.current) {
    initialDocStateRef.current = createInitialDocState();
  }

  const initialDocState = initialDocStateRef.current;

  const deserializeHistory = useCallback((raw) => historyFromStorage(raw, initialDocState), [initialDocState]);

  const {
    present: docState,
    replaceHistory,
    updatePresent,
    mark,
    maybeMark,
    undo,
    redo,
    hydrated,
  } = usePersistentHistory(initialDocState, {
    storageKey: LS_HISTORY_KEY,
    throttleMs: UNDO_THROTTLE_MS,
    serialize: historyToStorage,
    deserialize: deserializeHistory,
  });

  const [headingExpanded, setHeadingExpanded] = useState(false);
  const [fullscreenFragmentId, setFullscreenFragmentId] = useState(null);
  const [editingFragmentId, setEditingFragmentId] = useState(null);

  const {
    docTitle,
    docDate,
    leftHeadingFields,
    rightHeadingFields,
    plaintiffName,
    defendantName,
    courtTitle,
    showPageNumbers,
    fragments,
  } = docState;

  const previewRef = useRef(null);

  const headingSettings = useMemo(
    () => ({
      leftFields: leftHeadingFields,
      rightFields: rightHeadingFields,
      plaintiffName,
      defendantName,
      courtTitle,
    }),
    [leftHeadingFields, rightHeadingFields, plaintiffName, defendantName, courtTitle],
  );

  const handlePrint = useReactToPrint({ contentRef: previewRef, documentTitle: (docTitle && docTitle.trim()) || PRINT_DOCUMENT_TITLE });

  useEffect(() => {
    if (!hydrated) return;
    syncFragmentCounterFromList(fragments);
  }, [hydrated, fragments]);

  useEffect(() => {
    if (!hydrated) return;
    if (fragments.length > 0) {
      return;
    }
    const defaultPdfName = DEFAULT_PDF_FILE;
    const defaultPdfPath = DEFAULT_PDF_PATH;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(defaultPdfPath);
        if (!response.ok) throw new Error(`Failed to fetch default PDF: ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        const newFragmentId = createFragmentId();
        const fileId = `${newFragmentId}-file-${Date.now()}`;
        await idbSetPdf(fileId, buffer);
        const fragment = createPdfFragment({ id: newFragmentId, fileId, name: defaultPdfName });
        updatePresent((current) => ({
          ...current,
          fragments: [fragment, ...current.fragments],
        }), { preserveFuture: true });
      } catch (error) {
        // Ignore missing default PDF files
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, fragments.length, updatePresent]);

  const setDocDate = useCallback((valueOrUpdater) => {
    mark();
    updatePresent((current) => {
      const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(current.docDate) : valueOrUpdater;
      return { ...current, docDate: nextValue };
    });
  }, [mark, updatePresent]);

  const setDocTitle = useCallback((valueOrUpdater) => {
    mark();
    updatePresent((current) => {
      const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(current.docTitle) : valueOrUpdater;
      return { ...current, docTitle: nextValue };
    });
  }, [mark, updatePresent]);

  const setPlaintiffName = useCallback((valueOrUpdater) => {
    maybeMark();
    updatePresent((current) => {
      const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(current.plaintiffName) : valueOrUpdater;
      return { ...current, plaintiffName: nextValue };
    });
  }, [maybeMark, updatePresent]);

  const setDefendantName = useCallback((valueOrUpdater) => {
    maybeMark();
    updatePresent((current) => {
      const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(current.defendantName) : valueOrUpdater;
      return { ...current, defendantName: nextValue };
    });
  }, [maybeMark, updatePresent]);

  const setCourtTitle = useCallback((valueOrUpdater) => {
    maybeMark();
    updatePresent((current) => {
      const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(current.courtTitle) : valueOrUpdater;
      return { ...current, courtTitle: nextValue };
    });
  }, [maybeMark, updatePresent]);

  const setShowPageNumbers = useCallback((valueOrUpdater) => {
    maybeMark();
    updatePresent((current) => {
      const currentValue = !!current.showPageNumbers;
      const nextValue = typeof valueOrUpdater === 'function' ? !!valueOrUpdater(currentValue) : !!valueOrUpdater;
      return { ...current, showPageNumbers: nextValue };
    });
  }, [maybeMark, updatePresent]);

  const updateArrayField = useCallback((field, updater, shouldCommit) => {
    const historyFn = shouldCommit ? mark : maybeMark;
    historyFn();
    updatePresent((current) => {
      const currentValue = Array.isArray(current[field]) ? current[field] : [];
      const nextValue = updater(currentValue);
      return { ...current, [field]: nextValue };
    });
  }, [mark, maybeMark, updatePresent]);

  const handleAddLeftField = useCallback(() => {
    updateArrayField('leftHeadingFields', (fields) => [...fields, ''], true);
  }, [updateArrayField]);

  const handleLeftFieldChange = useCallback((index, value) => {
    updateArrayField('leftHeadingFields', (fields) => fields.map((item, itemIndex) => (itemIndex === index ? value : item)), false);
  }, [updateArrayField]);

  const handleRemoveLeftField = useCallback((index) => {
    updateArrayField('leftHeadingFields', (fields) => fields.filter((_, itemIndex) => itemIndex !== index), true);
  }, [updateArrayField]);

  const handleAddRightField = useCallback(() => {
    updateArrayField('rightHeadingFields', (fields) => [...fields, ''], true);
  }, [updateArrayField]);

  const handleRightFieldChange = useCallback((index, value) => {
    updateArrayField('rightHeadingFields', (fields) => fields.map((item, itemIndex) => (itemIndex === index ? value : item)), false);
  }, [updateArrayField]);

  const handleRemoveRightField = useCallback((index) => {
    updateArrayField('rightHeadingFields', (fields) => fields.filter((_, itemIndex) => itemIndex !== index), true);
  }, [updateArrayField]);

  const handlePdfReplace = useCallback((fragmentId, file) => {
    if (!file || !fragmentId) return;
    const reader = new FileReader();
    reader.onload = async function onLoad(event) {
      const buffer = event.target.result;
      const fileId = `${fragmentId}-file-${Date.now()}`;
      await idbSetPdf(fileId, buffer);
      mark();
      updatePresent((current) => ({
        ...current,
        fragments: current.fragments.map((fragment) => (
          fragment.id === fragmentId
            ? { ...fragment, type: 'pdf', fileId, name: file.name, data: undefined }
            : fragment
        )),
      }));
    };
    reader.readAsArrayBuffer(file);
  }, [mark, updatePresent]);

  const handleReorderFragments = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    mark();
    updatePresent((current) => {
      const next = [...current.fragments];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...current, fragments: next };
    });
  }, [mark, updatePresent]);

  const handleRemoveFragmentConfirmed = useCallback((id) => {
    if (!fragments.some((fragment) => fragment.id === id)) return;
    if (typeof window !== 'undefined') {
      const ok = window.confirm(CONFIRM_DELETE_MESSAGE);
      if (!ok) return;
    }
    mark();
    updatePresent((current) => ({
      ...current,
      fragments: current.fragments.filter((fragment) => fragment.id !== id),
    }));
    if (editingFragmentId === id) {
      setEditingFragmentId(null);
    }
  }, [editingFragmentId, fragments, mark, updatePresent]);

  const insertFragmentRelative = useCallback((id, position) => {
    const index = fragments.findIndex((fragment) => fragment.id === id);
    if (index < 0) return null;
    const newFragment = createEmptyMarkdownFragment();
    let inserted = false;
    mark();
    updatePresent((current) => {
      const idx = current.fragments.findIndex((fragment) => fragment.id === id);
      if (idx < 0) return current;
      const next = [...current.fragments];
      const insertIndex = position === 'before' ? idx : idx + 1;
      next.splice(insertIndex, 0, newFragment);
      inserted = true;
      return { ...current, fragments: next };
    });
    if (inserted) {
      setEditingFragmentId(newFragment.id);
    }
    return newFragment.id;
  }, [fragments, mark, updatePresent]);

  const handleInsertBefore = useCallback((id) => {
    insertFragmentRelative(id, 'before');
  }, [insertFragmentRelative]);

  const handleInsertAfter = useCallback((id) => {
    insertFragmentRelative(id, 'after');
  }, [insertFragmentRelative]);

  const handleAddSectionEnd = useCallback(() => {
    const newFragment = createEmptyMarkdownFragment();
    mark();
    updatePresent((current) => ({
      ...current,
      fragments: [...current.fragments, newFragment],
    }));
  }, [mark, updatePresent]);

  const handleAddExhibitsSection = useCallback(() => {
    const newFragment = createExhibitsFragment();
    mark();
    updatePresent((current) => ({
      ...current,
      fragments: [...current.fragments, newFragment],
    }));
    setEditingFragmentId(newFragment.id);
  }, [mark, updatePresent]);

  const handleAddPdfSection = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function onLoad(event) {
      const buffer = event.target.result;
      const newId = createFragmentId();
      const fileId = `${newId}-file-${Date.now()}`;
      await idbSetPdf(fileId, buffer);
      const newFragment = createPdfFragment({ id: newId, fileId, name: file.name });
      mark();
      updatePresent((current) => ({
        ...current,
        fragments: [...current.fragments, newFragment],
      }));
    };
    reader.readAsArrayBuffer(file);
  }, [mark, updatePresent]);

  const handleEditFragmentFields = useCallback((id, updates) => {
    maybeMark();
    updatePresent((current) => ({
      ...current,
      fragments: current.fragments.map((fragment) => (
        fragment.id === id ? { ...fragment, ...updates } : fragment
      )),
    }));
  }, [maybeMark, updatePresent]);

  useEffect(() => {
    let cancelled = false;
    const toMigrate = [];
    fragments.forEach((fragment) => {
      if (fragment.type === 'pdf' && fragment.data && !fragment.fileId) {
        toMigrate.push({ kind: 'pdf', id: fragment.id, name: fragment.name, data: fragment.data });
      } else if (fragment.type === 'exhibits') {
        (fragment.exhibits || []).forEach((exhibit, index) => {
          if (exhibit && exhibit.data && !exhibit.fileId) {
            toMigrate.push({ kind: 'ex', fragId: fragment.id, index, name: exhibit.name, mimeType: exhibit.mimeType, type: exhibit.type, data: exhibit.data });
          }
        });
      }
    });
    if (!toMigrate.length) return undefined;
    (async () => {
      const changes = [];
      for (const item of toMigrate) {
        if (cancelled) break;
        try {
          const bytes = base64ToUint8Array(item.data);
          if (!bytes) continue;
          if (item.kind === 'pdf') {
            const fileId = `${item.id}-file-${Date.now()}`;
            await idbSetPdf(fileId, bytes);
            changes.push({ type: 'pdf', id: item.id, fileId });
          } else if (item.kind === 'ex') {
            const fileId = `${item.fragId}-ex-${Date.now()}-${item.index}`;
            await idbSetPdf(fileId, bytes);
            changes.push({ type: 'ex', fragId: item.fragId, index: item.index, fileId });
          }
        } catch (error) {
          // Ignore migration errors
        }
      }
      if (!changes.length || cancelled) return;
      updatePresent((current) => ({
        ...current,
        fragments: current.fragments.map((fragment) => {
          if (fragment.type === 'pdf') {
            const change = changes.find((c) => c.type === 'pdf' && c.id === fragment.id);
            if (change) {
              const next = { ...fragment, fileId: change.fileId };
              delete next.data;
              return next;
            }
            return fragment;
          }
          if (fragment.type === 'exhibits') {
            const exhibits = (fragment.exhibits || []).map((exhibit, index) => {
              const change = changes.find((c) => c.type === 'ex' && c.fragId === fragment.id && c.index === index);
              if (change) {
                const nextExhibit = { ...exhibit, fileId: change.fileId };
                delete nextExhibit.data;
                return nextExhibit;
              }
              return exhibit;
            });
            return { ...fragment, exhibits };
          }
          return fragment;
        }),
      }), { preserveFuture: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [fragments, updatePresent]);

  const getRawJson = useCallback(() => {
    const clone = JSON.parse(JSON.stringify(docState));
    for (const fragment of clone.fragments || []) {
      if (fragment && typeof fragment === 'object') {
        if (fragment.type === 'pdf') {
          if (fragment.data) delete fragment.data;
        } else if (fragment.type === 'exhibits') {
          const list = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
          fragment.exhibits = list.map((exhibit) => {
            if (exhibit && exhibit.data) {
              const copy = { ...exhibit };
              delete copy.data;
              return copy;
            }
            return exhibit;
          });
        }
      }
    }
    return JSON.stringify(clone, null, 2);
  }, [docState]);

  const handleApplyRawJson = useCallback(async (text) => {
    const parsed = JSON.parse(text);
    const doc = parsed && parsed.doc ? parsed.doc : parsed;
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.fragments)) throw new Error('Invalid format: missing fragments');
    const safeDoc = {
      docTitle: typeof doc.docTitle === 'string' ? doc.docTitle : '',
      docDate: doc.docDate || '',
      leftHeadingFields: Array.isArray(doc.leftHeadingFields) ? doc.leftHeadingFields : [],
      rightHeadingFields: Array.isArray(doc.rightHeadingFields) ? doc.rightHeadingFields : [],
      plaintiffName: doc.plaintiffName || '',
      defendantName: doc.defendantName || '',
      courtTitle: doc.courtTitle || '',
      showPageNumbers: typeof doc.showPageNumbers === 'boolean' ? doc.showPageNumbers : true,
      fragments: Array.isArray(doc.fragments) ? doc.fragments : [],
    };
    safeDoc.fragments = safeDoc.fragments.map((fragment) => {
      if (!fragment || typeof fragment !== 'object') return fragment;
      if (fragment.type === 'exhibits') {
        fragment.exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
      }
      return fragment;
    });
    mark();
    replaceHistory({ past: [], present: safeDoc, future: [] });
  }, [mark, replaceHistory]);

  const handleExportBundle = useCallback(async () => {
    try {
      const clone = JSON.parse(JSON.stringify(docState));
      for (const fragment of clone.fragments || []) {
        if (fragment.type === 'pdf') {
          if (!fragment.data && fragment.fileId) {
            const buf = await idbGetPdf(fragment.fileId);
            if (buf) {
              fragment.data = arrayBufferToBase64(buf);
            }
          }
          if (fragment.data) delete fragment.fileId;
        } else if (fragment.type === 'exhibits') {
          const exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
          for (const exhibit of exhibits) {
            if (!exhibit || typeof exhibit !== 'object') continue;
            if (!exhibit.data && exhibit.fileId) {
              const buf = await idbGetPdf(exhibit.fileId);
              if (buf) {
                exhibit.data = arrayBufferToBase64(buf);
              }
            }
            if (exhibit.data) delete exhibit.fileId;
          }
        }
      }
      const bundle = {
        kind: 'legal-drafting-bundle',
        version: 1,
        createdAt: new Date().toISOString(),
        doc: clone,
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const raw = (clone.docTitle || '').trim();
      const base = raw
        ? raw.replace(/[^\w\s-]+/g, '').replace(/[\s]+/g, '-').replace(/-+/g, '-').slice(0, 80)
        : 'legal-drafting-document';
      anchor.download = `${base}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      // Silent failure: export is best effort
    }
  }, [docState]);

  const handleImportBundle = useCallback(async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const doc = parsed && parsed.doc ? parsed.doc : parsed;
      if (!doc || typeof doc !== 'object' || !Array.isArray(doc.fragments)) return;
      const safeDoc = {
        docTitle: typeof doc.docTitle === 'string' ? doc.docTitle : '',
        docDate: doc.docDate || '',
        leftHeadingFields: Array.isArray(doc.leftHeadingFields) ? doc.leftHeadingFields : [],
        rightHeadingFields: Array.isArray(doc.rightHeadingFields) ? doc.rightHeadingFields : [],
        plaintiffName: doc.plaintiffName || '',
        defendantName: doc.defendantName || '',
        courtTitle: doc.courtTitle || '',
        showPageNumbers: typeof doc.showPageNumbers === 'boolean' ? doc.showPageNumbers : true,
        fragments: Array.isArray(doc.fragments) ? doc.fragments : [],
      };
      safeDoc.fragments = safeDoc.fragments.map((fragment) => {
        if (!fragment || typeof fragment !== 'object') return fragment;
        if (fragment.type === 'pdf' && fragment.data) {
          delete fragment.fileId;
        } else if (fragment.type === 'exhibits') {
          const list = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
          fragment.exhibits = list.map((exhibit) => {
            if (exhibit && exhibit.data) {
              const copy = { ...exhibit };
              delete copy.fileId;
              return copy;
            }
            return exhibit;
          });
        }
        return fragment;
      });
      mark();
      replaceHistory({ past: [], present: safeDoc, future: [] });
    } catch (error) {
      // Ignore invalid bundles
    }
  }, [mark, replaceHistory]);

  const handleCompilePdf = useCallback(async () => {
    const bytes = await compileDocumentPdf({
      fragments,
      headingSettings,
      docDate,
      showPageNumbers,
    });
    if (!bytes) return;
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = COMPILED_PDF_DOWNLOAD_NAME;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [fragments, headingSettings, docDate, showPageNumbers]);

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

  const handleClearAll = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('This will remove all locally saved data (history, uploaded PDFs) and reload the app. Continue?');
      if (!ok) return;
    }
    try {
      window.localStorage.removeItem(LS_HISTORY_KEY);
    } catch (error) {
      // ignore storage errors
    }
    try {
      replaceHistory({ past: [], present: initialDocState, future: [] });
    } catch (error) {
      // ignore history reset errors
    }
    await clearAllLocalData({ reload: true });
  }, [initialDocState, replaceHistory]);

  useEffect(() => {
    const onKey = (event) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  return {
    docTitle,
    setDocTitle,
    docDate,
    setDocDate,
    headingExpanded,
    setHeadingExpanded,
    leftHeadingFields,
    rightHeadingFields,
    plaintiffName,
    defendantName,
    courtTitle,
    showPageNumbers,
    setShowPageNumbers,
    handleAddLeftField,
    handleLeftFieldChange,
    handleRemoveLeftField,
    handleAddRightField,
    handleRightFieldChange,
    handleRemoveRightField,
    setPlaintiffName,
    setDefendantName,
    setCourtTitle,
    fragments,
    handleReorderFragments,
    handleRemoveFragmentConfirmed,
    handleInsertBefore,
    handleInsertAfter,
    handleAddSectionEnd,
    handleAddExhibitsSection,
    handleAddPdfSection,
    editingFragmentId,
    setEditingFragmentId,
    handleEditFragmentFields,
    handlePdfReplace,
    fullscreenFragmentId,
    setFullscreenFragmentId,
    headingSettings,
    handlePrint,
    handleCompilePdf,
    handleClearAll,
    handleExportBundle,
    handleImportBundle,
    getRawJson,
    handleApplyRawJson,
    previewRef,
  };
}
