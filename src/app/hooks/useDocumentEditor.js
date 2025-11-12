import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentHistory } from 'persistent-history';
import { useReactToPrint } from 'react-to-print';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { formatDisplayDate } from '../lib/date';
import { idbSetPdf, idbGetPdf } from '../lib/pdfStorage';
import {
  appendMarkdownFragment as appendMarkdownFragmentPdf,
  appendPdfFragment as appendPdfFragmentPdf,
  appendExhibitIndex,
  appendExhibitCover,
  LETTER_WIDTH,
} from '../lib/pdf/generate';
import { LS_HISTORY_KEY, historyToStorage, historyFromStorage } from '../lib/history';
import { clearAllLocalData } from '../lib/clearData';
import {
  DEFAULT_LEFT_HEADING_FIELDS,
  DEFAULT_RIGHT_HEADING_FIELDS,
  DEFAULT_PLAINTIFF_NAME,
  DEFAULT_DEFENDANT_NAME,
  DEFAULT_COURT_TITLE,
  DEFAULT_WELCOME_TITLE,
  DEFAULT_WELCOME_CONTENT,
  DEFAULT_PDF_FILE,
  DEFAULT_PDF_PATH,
  PRINT_DOCUMENT_TITLE,
  COMPILED_PDF_DOWNLOAD_NAME,
  CONFIRM_DELETE_MESSAGE,
  UNDO_THROTTLE_MS,
} from '../lib/defaults';
import { groupExhibits, buildIndexEntries } from '../lib/exhibits';
import { createInitialDocState, createFragmentId, syncFragmentCounterFromList } from '../lib/fragments';
import { base64ToUint8Array, arrayBufferToBase64 } from '../lib/fileEncoding';
import useDefaultPdfLoader from './useDefaultPdfLoader';
import useFragmentDataMigration from './useFragmentDataMigration';
import useDocumentKeyboardShortcuts from './useDocumentKeyboardShortcuts';

export default function useDocumentEditor() {
  const initialDocStateRef = useRef();
  if (!initialDocStateRef.current) {
    initialDocStateRef.current = createInitialDocState({
      leftHeadingFields: DEFAULT_LEFT_HEADING_FIELDS,
      rightHeadingFields: DEFAULT_RIGHT_HEADING_FIELDS,
      plaintiffName: DEFAULT_PLAINTIFF_NAME,
      defendantName: DEFAULT_DEFENDANT_NAME,
      courtTitle: DEFAULT_COURT_TITLE,
      welcomeContent: DEFAULT_WELCOME_CONTENT,
      welcomeTitle: DEFAULT_WELCOME_TITLE,
    });
  }

  const initialDocState = initialDocStateRef.current;

  const deserializeHistory = useCallback(
    (raw) => historyFromStorage(raw, initialDocState),
    [initialDocState],
  );

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

  const {
    docTitle,
    docDate,
    leftHeadingFields,
    rightHeadingFields,
    plaintiffName,
    defendantName,
    courtTitle,
    showPageNumbers,
    pageNumberPlacement,
    fragments,
  } = docState;

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

  const setDocDate = useCallback(
    (valueOrUpdater) => {
      mark();
      updatePresent((current) => {
        const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(current.docDate) : valueOrUpdater;
        return { ...current, docDate: nextValue };
      });
    },
    [mark, updatePresent],
  );

  const setDocTitle = useCallback(
    (valueOrUpdater) => {
      mark();
      updatePresent((current) => {
        const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(current.docTitle) : valueOrUpdater;
        return { ...current, docTitle: nextValue };
      });
    },
    [mark, updatePresent],
  );

  const setPlaintiffName = useCallback(
    (valueOrUpdater) => {
      maybeMark();
      updatePresent((current) => {
        const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(current.plaintiffName) : valueOrUpdater;
        return { ...current, plaintiffName: nextValue };
      });
    },
    [maybeMark, updatePresent],
  );

  const setDefendantName = useCallback(
    (valueOrUpdater) => {
      maybeMark();
      updatePresent((current) => {
        const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(current.defendantName) : valueOrUpdater;
        return { ...current, defendantName: nextValue };
      });
    },
    [maybeMark, updatePresent],
  );

  const setCourtTitle = useCallback(
    (valueOrUpdater) => {
      maybeMark();
      updatePresent((current) => {
        const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(current.courtTitle) : valueOrUpdater;
        return { ...current, courtTitle: nextValue };
      });
    },
    [maybeMark, updatePresent],
  );

  const setShowPageNumbers = useCallback(
    (valueOrUpdater) => {
      maybeMark();
      updatePresent((current) => {
        const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(!!current.showPageNumbers) : !!valueOrUpdater;
        return { ...current, showPageNumbers: nextValue };
      });
    },
    [maybeMark, updatePresent],
  );

  const setPageNumberPlacement = useCallback(
    (valueOrUpdater) => {
      mark();
      updatePresent((current) => {
        const nextValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(current.pageNumberPlacement || 'right') : valueOrUpdater;
        return { ...current, pageNumberPlacement: nextValue };
      });
    },
    [mark, updatePresent],
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
      reader.onload = async function onLoad(e) {
        const buffer = e.target.result;
        const fileId = `${fragmentId}-file-${Date.now()}`;
        await idbSetPdf(fileId, buffer);
        mark();
        updatePresent((current) => ({
          ...current,
          fragments: current.fragments.map((frag) =>
            frag.id === fragmentId
              ? { ...frag, type: 'pdf', fileId, name: file.name, data: undefined }
              : frag,
          ),
        }));
      };
      reader.readAsArrayBuffer(file);
    },
    [updatePresent, mark],
  );

  const handlePrint = useReactToPrint({ contentRef: previewRef, documentTitle: (docTitle && docTitle.trim()) || PRINT_DOCUMENT_TITLE });

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
    },
    [editingFragmentId, fragments, mark, updatePresent],
  );

  const handleInsertBefore = useCallback(
    (id) => {
      const index = fragments.findIndex((fragment) => fragment.id === id);
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
        next.splice(idx, 0, newFragment);
        inserted = true;
        return { ...current, fragments: next };
      });
      if (inserted) {
        setEditingFragmentId(newFragment.id);
      }
    },
    [fragments, mark, updatePresent],
  );

  const handleInsertAfter = useCallback(
    (id) => {
      const index = fragments.findIndex((fragment) => fragment.id === id);
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
        next.splice(idx + 1, 0, newFragment);
        inserted = true;
        return { ...current, fragments: next };
      });
      if (inserted) {
        setEditingFragmentId(newFragment.id);
      }
    },
    [fragments, mark, updatePresent],
  );

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
  }, [mark, updatePresent]);

  const handleAddPdfSection = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function onLoad(e) {
        const buffer = e.target.result;
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

  const getRawJson = useCallback(() => {
    const clone = JSON.parse(JSON.stringify(docState));
    for (const frag of clone.fragments || []) {
      if (frag && typeof frag === 'object') {
        if (frag.type === 'pdf') {
          if (frag.data) delete frag.data;
        } else if (frag.type === 'exhibits') {
          const list = Array.isArray(frag.exhibits) ? frag.exhibits : [];
          frag.exhibits = list.map((ex) => {
            if (ex && ex.data) {
              const c = { ...ex };
              delete c.data;
              return c;
            }
            return ex;
          });
        }
      }
    }
    return JSON.stringify(clone, null, 2);
  }, [docState]);

  const handleApplyRawJson = useCallback(
    async (text) => {
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
        pageNumberPlacement: doc.pageNumberPlacement || 'right',
        fragments: Array.isArray(doc.fragments) ? doc.fragments : [],
      };
      safeDoc.fragments = safeDoc.fragments.map((f) => {
        if (!f || typeof f !== 'object') return f;
        if (f.type === 'exhibits') {
          f.exhibits = Array.isArray(f.exhibits) ? f.exhibits : [];
        }
        return f;
      });
      mark();
      replaceHistory({ past: [], present: safeDoc, future: [] });
    },
    [mark, replaceHistory],
  );

  const handleExportBundle = useCallback(async () => {
    try {
      const clone = JSON.parse(JSON.stringify(docState));
      for (const frag of clone.fragments || []) {
        if (frag.type === 'pdf') {
          if (!frag.data) {
            if (frag.fileId) {
              const buf = await idbGetPdf(frag.fileId);
              if (buf) {
                frag.data = arrayBufferToBase64(buf);
              }
            }
          }
          if (frag.data) delete frag.fileId;
        } else if (frag.type === 'exhibits') {
          const exhibits = Array.isArray(frag.exhibits) ? frag.exhibits : [];
          for (const ex of exhibits) {
            if (!ex || typeof ex !== 'object') continue;
            if (!ex.data && ex.fileId) {
              const buf = await idbGetPdf(ex.fileId);
              if (buf) {
                ex.data = arrayBufferToBase64(buf);
              }
            }
            if (ex.data) delete ex.fileId;
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
      const a = document.createElement('a');
      a.href = url;
      const raw = (clone.docTitle || '').trim();
      const base = raw
        ? raw.replace(/[^\w\s-]+/g, '').replace(/[\s]+/g, '-').replace(/-+/g, '-').slice(0, 80)
        : 'legal-drafting-document';
      a.download = `${base}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore – best effort export
    }
  }, [docState]);

  const handleImportBundle = useCallback(
    async (file) => {
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
          pageNumberPlacement: doc.pageNumberPlacement || 'right',
          fragments: Array.isArray(doc.fragments) ? doc.fragments : [],
        };

        safeDoc.fragments = safeDoc.fragments.map((f) => {
          if (!f || typeof f !== 'object') return f;
          if (f.type === 'pdf') {
            if (f.data) delete f.fileId;
          } else if (f.type === 'exhibits') {
            const list = Array.isArray(f.exhibits) ? f.exhibits : [];
            f.exhibits = list.map((ex) => {
              if (ex && ex.data) {
                const copy = { ...ex };
                delete copy.fileId;
                return copy;
              }
              return ex;
            });
          }
          return f;
        });

        mark();
        replaceHistory({ past: [], present: safeDoc, future: [] });
      } catch (_) {
        // ignore invalid file
      }
    },
    [mark, replaceHistory],
  );

  const handleCompilePdf = useCallback(async () => {
    if (!fragments.length) return;
    const pdfDoc = await PDFDocument.create();

    for (const fragment of fragments) {
      if (fragment.type === 'markdown') {
        await appendMarkdownFragmentPdf(
          pdfDoc,
          fragment.content,
          headingSettings,
          fragment.title,
          docDate,
          formatDisplayDate,
          fragment.signatureType || 'default',
        );
      } else if (fragment.type === 'pdf') {
        let bytes = null;
        if (fragment.data) {
          bytes = base64ToUint8Array(fragment.data);
        }
        if (!bytes && fragment.fileId) {
          const fromIdb = await idbGetPdf(fragment.fileId);
          bytes = fromIdb ? new Uint8Array(fromIdb) : null;
        }
        if (bytes) await appendPdfFragmentPdf(pdfDoc, bytes);
      } else if (fragment.type === 'exhibits') {
        const exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];
        const captions = Array.isArray(fragment.captions) ? fragment.captions : [];
        const { groups } = groupExhibits(exhibits);
        const entries = buildIndexEntries(groups);
        await appendExhibitIndex(pdfDoc, captions, entries, 'Exhibit Index');
        for (const g of groups) {
          const parent = g.parent.data;
          const hasChildren = g.children.length > 0;
          if (!hasChildren) {
            if ((parent.type || '').toLowerCase() === 'pdf' || (parent.mimeType || '').startsWith('application/pdf')) {
              let exBytes = null;
              if (parent.data) exBytes = base64ToUint8Array(parent.data);
              if (!exBytes && parent.fileId) {
                const fromIdb = await idbGetPdf(parent.fileId);
                exBytes = fromIdb ? new Uint8Array(fromIdb) : null;
              }
              if (exBytes) await appendPdfFragmentPdf(pdfDoc, exBytes);
            } else if ((parent.type || '').toLowerCase() === 'image' || (parent.mimeType || '').startsWith('image/')) {
              const titleLine = `Exhibit ${g.letter.toUpperCase()} - ${parent.title || parent.name || ''}`;
              const captionsForCover = [...captions];
              await appendExhibitCover(pdfDoc, captionsForCover, parent.description || '', titleLine);

              let bytes = null;
              if (parent.data) bytes = base64ToUint8Array(parent.data);
              if (!bytes && parent.fileId) {
                const fromIdb = await idbGetPdf(parent.fileId);
                bytes = fromIdb ? new Uint8Array(fromIdb) : null;
              }
              if (bytes) {
                try {
                  const img = (parent.mimeType || '').includes('png')
                    ? await pdfDoc.embedPng(bytes)
                    : await pdfDoc.embedJpg(bytes);
                  const page = pdfDoc.addPage([LETTER_WIDTH, 792]);
                  const MARGIN = 72;
                  const maxWidth = LETTER_WIDTH - 2 * MARGIN;
                  const maxHeight = 792 - 2 * MARGIN;
                  const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                  const w = img.width * scale;
                  const h = img.height * scale;
                  const x = (LETTER_WIDTH - w) / 2;
                  const y = (792 - h) / 2;
                  page.drawImage(img, { x, y, width: w, height: h });
                } catch (_) {
                  // ignore
                }
              }
            }
          }
          for (let cIdx = 0; cIdx < g.children.length; cIdx += 1) {
            const child = g.children[cIdx].data;
            if ((child.type || '').toLowerCase() === 'pdf' || (child.mimeType || '').startsWith('application/pdf')) {
              let exBytes = null;
              if (child.data) exBytes = base64ToUint8Array(child.data);
              if (!exBytes && child.fileId) {
                const fromIdb = await idbGetPdf(child.fileId);
                exBytes = fromIdb ? new Uint8Array(fromIdb) : null;
              }
              if (exBytes) await appendPdfFragmentPdf(pdfDoc, exBytes);
            } else if ((child.type || '').toLowerCase() === 'image' || (child.mimeType || '').startsWith('image/')) {
              let bytes = null;
              if (child.data) bytes = base64ToUint8Array(child.data);
              if (!bytes && child.fileId) {
                const fromIdb = await idbGetPdf(child.fileId);
                bytes = fromIdb ? new Uint8Array(fromIdb) : null;
              }
              if (bytes) {
                try {
                  const img = (child.mimeType || '').includes('png')
                    ? await pdfDoc.embedPng(bytes)
                    : await pdfDoc.embedJpg(bytes);
                  const page = pdfDoc.addPage([LETTER_WIDTH, 792]);
                  const MARGIN = 72;
                  const maxWidth = LETTER_WIDTH - 2 * MARGIN;
                  const maxHeight = 792 - 2 * MARGIN;
                  const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                  const w = img.width * scale;
                  const h = img.height * scale;
                  const x = (LETTER_WIDTH - w) / 2;
                  const y = (792 - h) / 2;
                  page.drawImage(img, { x, y, width: w, height: h });
                } catch (_) {
                  // ignore
                }
              }
            }
          }
        }
      }
    }

    if (showPageNumbers !== false) {
      const footerFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const totalPages = pdfDoc.getPageCount();
      const placement = pageNumberPlacement || 'right';
      for (let i = 0; i < totalPages; i += 1) {
        const page = pdfDoc.getPage(i);
        const label = `Page ${i + 1} of ${totalPages}`;
        const size = 10;
        const textWidth = footerFont.widthOfTextAtSize(label, size);
        
        // Calculate x position based on placement
        let x;
        if (placement === 'left') {
          x = 72; // 1 inch from left (align with left content margin)
        } else if (placement === 'center') {
          x = (LETTER_WIDTH - textWidth) / 2;
        } else { // 'right' is default
          x = LETTER_WIDTH - textWidth - 72; // 1 inch from right (align with right content margin)
        }
        
        const y = 18;
        page.drawText(label, { x, y, size, font: footerFont, color: rgb(0.28, 0.32, 0.37) });
      }
    }

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = COMPILED_PDF_DOWNLOAD_NAME;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [fragments, headingSettings, docDate, showPageNumbers, pageNumberPlacement]);

  useEffect(() => {
    syncFragmentCounterFromList(fragments);
  }, [fragments]);

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
    try { window.localStorage.removeItem(LS_HISTORY_KEY); } catch (_) {}
    try { replaceHistory({ past: [], present: initialDocState, future: [] }); } catch (_) {}
    await clearAllLocalData({ reload: true });
  }, [replaceHistory, initialDocState]);

  useDefaultPdfLoader({
    hydrated,
    fragments,
    updatePresent,
    defaultPdfName: DEFAULT_PDF_FILE,
    defaultPdfPath: DEFAULT_PDF_PATH,
  });

  useFragmentDataMigration(fragments, updatePresent);

  useDocumentKeyboardShortcuts({ onUndo: handleUndo, onRedo: handleRedo });

  return {
    editorProps: {
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
      showPageNumbers: showPageNumbers !== false,
      setShowPageNumbers,
      pageNumberPlacement: pageNumberPlacement || 'right',
      setPageNumberPlacement,
      onAddLeftField: handleAddLeftField,
      onLeftFieldChange: handleLeftFieldChange,
      onRemoveLeftField: handleRemoveLeftField,
      onAddRightField: handleAddRightField,
      onRightFieldChange: handleRightFieldChange,
      onRemoveRightField: handleRemoveRightField,
      setPlaintiffName,
      setDefendantName,
      setCourtTitle,
      fragments,
      onReorder: handleReorderFragments,
      onRemove: handleRemoveFragmentConfirmed,
      onInsertBefore: handleInsertBefore,
      onInsertAfter: handleInsertAfter,
      onAddSectionEnd: handleAddSectionEnd,
      onAddExhibitsSection: handleAddExhibitsSection,
      onAddPdfSection: handleAddPdfSection,
      editingFragmentId,
      setEditingFragmentId,
      onEditFragmentFields: handleEditFragmentFields,
      onDeleteEditingFragment: handleRemoveFragmentConfirmed,
      onPdfReplace: handlePdfReplace,
    },
    previewProps: {
      fragments,
      headingSettings,
      docDate,
      showPageNumbers: showPageNumbers !== false,
      pageNumberPlacement: pageNumberPlacement || 'right',
      onPrint: handlePrint,
      onCompilePdf: handleCompilePdf,
      onClearAll: handleClearAll,
      onExportBundle: handleExportBundle,
      onImportBundle: handleImportBundle,
      getRawJson,
      onApplyRawJson: handleApplyRawJson,
      fullscreenFragmentId,
      setFullscreenFragmentId,
      contentRef: previewRef,
    },
  };
}
