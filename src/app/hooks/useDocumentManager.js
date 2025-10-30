import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentHistory } from 'persistent-history';
import { useReactToPrint } from 'react-to-print';

import { createInitialDocState } from '../lib/document/initialState';
import { createFragmentId, syncFragmentCounterFromList } from '../lib/document/fragments';
import { idbSetPdf, idbGetPdf } from '../lib/pdfStorage';
import { formatDisplayDate } from '../lib/date';
import { LS_HISTORY_KEY, historyToStorage, historyFromStorage } from '../lib/history';
import { clearAllLocalData } from '../lib/clearData';
import {
  DEFAULT_PDF_FILE,
  DEFAULT_PDF_PATH,
  PRINT_DOCUMENT_TITLE,
  COMPILED_PDF_DOWNLOAD_NAME,
  CONFIRM_DELETE_MESSAGE,
  UNDO_THROTTLE_MS,
} from '../lib/defaults';
import {
  sanitizeDocument,
  prepareRawDocument,
  embedExternalAssets,
  createBundle,
  createBundleFileName,
} from '../lib/document/bundle';
import { base64ToUint8Array } from '../lib/utils/base64';
import { compileDocumentPdf } from '../lib/pdf/compileDocument';

export function useDocumentManager() {
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

  const previewRef = useRef(null);
  const defaultPdfLoadedRef = useRef(false);

  const headingSettings = useMemo(
    () => ({
      leftFields: docState.leftHeadingFields,
      rightFields: docState.rightHeadingFields,
      plaintiffName: docState.plaintiffName,
      defendantName: docState.defendantName,
      courtTitle: docState.courtTitle,
    }),
    [
      docState.leftHeadingFields,
      docState.rightHeadingFields,
      docState.plaintiffName,
      docState.defendantName,
      docState.courtTitle,
    ],
  );

  const setDocTitle = useCallback(
    (valueOrUpdater) => {
      mark();
      updatePresent((current) => {
        const nextValue =
          typeof valueOrUpdater === 'function' ? valueOrUpdater(current.docTitle) : valueOrUpdater;
        return { ...current, docTitle: nextValue };
      });
    },
    [mark, updatePresent],
  );

  const setDocDate = useCallback(
    (valueOrUpdater) => {
      mark();
      updatePresent((current) => {
        const nextValue =
          typeof valueOrUpdater === 'function' ? valueOrUpdater(current.docDate) : valueOrUpdater;
        return { ...current, docDate: nextValue };
      });
    },
    [mark, updatePresent],
  );

  const setPlaintiffName = useCallback(
    (valueOrUpdater) => {
      maybeMark();
      updatePresent((current) => {
        const nextValue =
          typeof valueOrUpdater === 'function' ? valueOrUpdater(current.plaintiffName) : valueOrUpdater;
        return { ...current, plaintiffName: nextValue };
      });
    },
    [maybeMark, updatePresent],
  );

  const setDefendantName = useCallback(
    (valueOrUpdater) => {
      maybeMark();
      updatePresent((current) => {
        const nextValue =
          typeof valueOrUpdater === 'function' ? valueOrUpdater(current.defendantName) : valueOrUpdater;
        return { ...current, defendantName: nextValue };
      });
    },
    [maybeMark, updatePresent],
  );

  const setCourtTitle = useCallback(
    (valueOrUpdater) => {
      maybeMark();
      updatePresent((current) => {
        const nextValue =
          typeof valueOrUpdater === 'function' ? valueOrUpdater(current.courtTitle) : valueOrUpdater;
        return { ...current, courtTitle: nextValue };
      });
    },
    [maybeMark, updatePresent],
  );

  const setShowPageNumbers = useCallback(
    (valueOrUpdater) => {
      maybeMark();
      updatePresent((current) => {
        const nextValue =
          typeof valueOrUpdater === 'function' ? valueOrUpdater(!!current.showPageNumbers) : valueOrUpdater;
        return { ...current, showPageNumbers: !!nextValue };
      });
    },
    [maybeMark, updatePresent],
  );

  const handleAddLeftField = useCallback(() => {
    mark();
    updatePresent((current) => ({
      ...current,
      leftHeadingFields: [...current.leftHeadingFields, ''],
    }));
  }, [mark, updatePresent]);

  const handleLeftFieldChange = useCallback(
    (index, value) => {
      maybeMark();
      updatePresent((current) => {
        const next = current.leftHeadingFields.map((item, itemIndex) => (itemIndex === index ? value : item));
        return { ...current, leftHeadingFields: next };
      });
    },
    [maybeMark, updatePresent],
  );

  const handleRemoveLeftField = useCallback(
    (index) => {
      mark();
      updatePresent((current) => ({
        ...current,
        leftHeadingFields: current.leftHeadingFields.filter((_, itemIndex) => itemIndex !== index),
      }));
    },
    [mark, updatePresent],
  );

  const handleAddRightField = useCallback(() => {
    mark();
    updatePresent((current) => ({
      ...current,
      rightHeadingFields: [...current.rightHeadingFields, ''],
    }));
  }, [mark, updatePresent]);

  const handleRightFieldChange = useCallback(
    (index, value) => {
      maybeMark();
      updatePresent((current) => {
        const next = current.rightHeadingFields.map((item, itemIndex) => (itemIndex === index ? value : item));
        return { ...current, rightHeadingFields: next };
      });
    },
    [maybeMark, updatePresent],
  );

  const handleRemoveRightField = useCallback(
    (index) => {
      mark();
      updatePresent((current) => ({
        ...current,
        rightHeadingFields: current.rightHeadingFields.filter((_, itemIndex) => itemIndex !== index),
      }));
    },
    [mark, updatePresent],
  );

  const handlePdfReplace = useCallback(
    (fragmentId, file) => {
      if (!file || !fragmentId) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = event.target.result;
        const fileId = `${fragmentId}-file-${Date.now()}`;
        await idbSetPdf(fileId, buffer);
        mark();
        updatePresent((current) => ({
          ...current,
          fragments: current.fragments.map((fragment) =>
            fragment.id === fragmentId
              ? { ...fragment, type: 'pdf', fileId, name: file.name, data: undefined }
              : fragment,
          ),
        }));
      };
      reader.readAsArrayBuffer(file);
    },
    [mark, updatePresent],
  );

  const handleReorderFragments = useCallback(
    (fromIndex, toIndex) => {
      if (fromIndex === toIndex) return;
      mark();
      updatePresent((current) => {
        const next = [...current.fragments];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return { ...current, fragments: next };
      });
    },
    [mark, updatePresent],
  );

  const handleRemoveFragmentConfirmed = useCallback(
    (id) => {
      if (!docState.fragments.some((fragment) => fragment.id === id)) return;
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
    },
    [docState.fragments, editingFragmentId, mark, updatePresent, setEditingFragmentId],
  );

  const insertFragmentAt = useCallback(
    (id, position) => {
      const index = docState.fragments.findIndex((fragment) => fragment.id === id);
      if (index < 0) return;
      const newFragment = {
        id: createFragmentId(),
        type: 'markdown',
        title: 'Untitled',
        content: '',
      };
      let inserted = false;
      mark();
      updatePresent((current) => {
        const idx = current.fragments.findIndex((fragment) => fragment.id === id);
        if (idx < 0) return current;
        const next = [...current.fragments];
        next.splice(position === 'after' ? idx + 1 : idx, 0, newFragment);
        inserted = true;
        return { ...current, fragments: next };
      });
      if (inserted) {
        setEditingFragmentId(newFragment.id);
      }
    },
    [docState.fragments, mark, updatePresent, setEditingFragmentId],
  );

  const handleInsertBefore = useCallback((id) => insertFragmentAt(id, 'before'), [insertFragmentAt]);
  const handleInsertAfter = useCallback((id) => insertFragmentAt(id, 'after'), [insertFragmentAt]);

  const handleAddSectionEnd = useCallback(() => {
    const newFragment = {
      id: createFragmentId(),
      type: 'markdown',
      title: 'Untitled',
      content: '',
    };
    mark();
    updatePresent((current) => ({
      ...current,
      fragments: [...current.fragments, newFragment],
    }));
  }, [mark, updatePresent]);

  const handleAddExhibitsSection = useCallback(() => {
    const newId = createFragmentId();
    const newFragment = {
      id: newId,
      type: 'exhibits',
      exhibits: [],
    };
    mark();
    updatePresent((current) => ({
      ...current,
      fragments: [...current.fragments, newFragment],
    }));
    setEditingFragmentId(newId);
  }, [mark, updatePresent, setEditingFragmentId]);

  const handleAddPdfSection = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = event.target.result;
        const newId = createFragmentId();
        const fileId = `${newId}-file-${Date.now()}`;
        await idbSetPdf(fileId, buffer);
        const newFragment = {
          id: newId,
          type: 'pdf',
          name: file.name,
          fileId,
        };
        mark();
        updatePresent((current) => ({
          ...current,
          fragments: [...current.fragments, newFragment],
        }));
      };
      reader.readAsArrayBuffer(file);
    },
    [mark, updatePresent],
  );

  const handleEditFragmentFields = useCallback(
    (id, updates) => {
      maybeMark();
      updatePresent((current) => ({
        ...current,
        fragments: current.fragments.map((fragment) =>
          fragment.id === id ? { ...fragment, ...updates } : fragment,
        ),
      }));
    },
    [maybeMark, updatePresent],
  );

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
      // ignore
    }
    try {
      replaceHistory({ past: [], present: initialDocState, future: [] });
    } catch (error) {
      // ignore
    }
    await clearAllLocalData({ reload: true });
  }, [replaceHistory, initialDocState]);

  const handlePrint = useReactToPrint({
    contentRef: previewRef,
    documentTitle: (docState.docTitle && docState.docTitle.trim()) || PRINT_DOCUMENT_TITLE,
  });

  const handleCompilePdf = useCallback(async () => {
    await compileDocumentPdf({
      fragments: docState.fragments,
      headingSettings,
      docDate: docState.docDate,
      formatDisplayDate,
      showPageNumbers: docState.showPageNumbers !== false,
      compiledFileName: COMPILED_PDF_DOWNLOAD_NAME,
    });
  }, [docState.fragments, headingSettings, docState.docDate, docState.showPageNumbers]);

  const getRawJson = useCallback(() => {
    const rawDoc = prepareRawDocument(docState);
    return JSON.stringify(rawDoc, null, 2);
  }, [docState]);

  const handleApplyRawJson = useCallback(
    async (text) => {
      const parsed = JSON.parse(text);
      const doc = parsed?.doc ?? parsed;
      if (!doc || typeof doc !== 'object' || !Array.isArray(doc.fragments)) {
        throw new Error('Invalid format: missing fragments');
      }
      const safeDoc = sanitizeDocument(doc);
      mark();
      replaceHistory({ past: [], present: safeDoc, future: [] });
    },
    [mark, replaceHistory],
  );

  const handleExportBundle = useCallback(async () => {
    try {
      const docWithAssets = await embedExternalAssets(docState, async (fileId) => {
        const buffer = await idbGetPdf(fileId);
        return buffer ? new Uint8Array(buffer) : null;
      });
      const bundle = createBundle(docWithAssets);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = createBundleFileName(docState.docTitle);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      // ignore
    }
  }, [docState]);

  const handleImportBundle = useCallback(
    async (file) => {
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const doc = parsed?.doc ?? parsed;
        if (!doc || typeof doc !== 'object' || !Array.isArray(doc.fragments)) return;
        const safeDoc = sanitizeDocument(doc);
        mark();
        replaceHistory({ past: [], present: safeDoc, future: [] });
      } catch (error) {
        // ignore invalid file
      }
    },
    [mark, replaceHistory],
  );

  useEffect(() => {
    if (!hydrated || defaultPdfLoadedRef.current) return;
    if (docState.fragments.length > 0) {
      defaultPdfLoadedRef.current = true;
      return;
    }
    defaultPdfLoadedRef.current = true;
    fetch(DEFAULT_PDF_PATH)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch default PDF: ${res.status}`);
        return res.arrayBuffer();
      })
      .then(async (buffer) => {
        const newId = createFragmentId();
        const fileId = `${newId}-file-${Date.now()}`;
        await idbSetPdf(fileId, buffer);
        updatePresent(
          (current) => ({
            ...current,
            fragments: [
              { id: newId, type: 'pdf', fileId, name: DEFAULT_PDF_FILE },
              ...current.fragments,
            ],
          }),
          { preserveFuture: true },
        );
      })
      .catch(() => {
        // ignore default load failure
      });
  }, [hydrated, docState.fragments.length, updatePresent]);

  const migrationSignature = useMemo(
    () =>
      JSON.stringify(
        docState.fragments.map((fragment) => ({
          id: fragment.id,
          type: fragment.type,
          hasData: !!fragment?.data,
          fileId: fragment?.fileId,
          exhibits: (fragment.exhibits || []).map((exhibit) => ({
            hasData: !!exhibit?.data,
            fileId: exhibit?.fileId,
          })),
        })),
      ),
    [docState.fragments],
  );

  useEffect(() => {
    let cancelled = false;
    const toMigrate = [];
    docState.fragments.forEach((fragment) => {
      if (fragment.type === 'pdf' && fragment.data && !fragment.fileId) {
        toMigrate.push({ kind: 'pdf', id: fragment.id, name: fragment.name, data: fragment.data });
      } else if (fragment.type === 'exhibits') {
        (fragment.exhibits || []).forEach((exhibit, index) => {
          if (exhibit?.data && !exhibit.fileId) {
            toMigrate.push({
              kind: 'ex',
              fragId: fragment.id,
              index,
              name: exhibit.name,
              mimeType: exhibit.mimeType,
              type: exhibit.type,
              data: exhibit.data,
            });
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
          // ignore migration failures
        }
      }
      if (!changes.length || cancelled) return;
      updatePresent(
        (current) => ({
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
                const change = changes.find(
                  (c) => c.type === 'ex' && c.fragId === fragment.id && c.index === index,
                );
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
        }),
        { preserveFuture: true },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [migrationSignature, docState.fragments, updatePresent]);

  useEffect(() => {
    syncFragmentCounterFromList(docState.fragments);
  }, [docState.fragments]);

  useEffect(() => {
    const onKey = (event) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (!mod) return;
      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  return {
    docState,
    headingSettings,
    headingExpanded,
    setHeadingExpanded,
    fullscreenFragmentId,
    setFullscreenFragmentId,
    editingFragmentId,
    setEditingFragmentId,
    previewRef,
    hydrated,
    fieldUpdaters: {
      setDocTitle,
      setDocDate,
      setPlaintiffName,
      setDefendantName,
      setCourtTitle,
      setShowPageNumbers,
    },
    actions: {
      handleAddLeftField,
      handleLeftFieldChange,
      handleRemoveLeftField,
      handleAddRightField,
      handleRightFieldChange,
      handleRemoveRightField,
      handlePdfReplace,
      handleReorderFragments,
      handleRemoveFragmentConfirmed,
      handleInsertBefore,
      handleInsertAfter,
      handleAddSectionEnd,
      handleAddExhibitsSection,
      handleAddPdfSection,
      handleEditFragmentFields,
      handleUndo,
      handleRedo,
      handleClearAll,
      handlePrint,
      handleCompilePdf,
      handleExportBundle,
      handleImportBundle,
      getRawJson,
      handleApplyRawJson,
    },
  };
}
