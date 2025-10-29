'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentHistory } from 'persistent-history';
import { useReactToPrint } from 'react-to-print';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import '/src/App.css';
// pdfjs utilities used by PdfPreview only
import { idbSetPdf, idbGetPdf } from './lib/pdfStorage';
import { formatDisplayDate } from './lib/date';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import { appendMarkdownFragment as appendMarkdownFragmentPdf, appendPdfFragment as appendPdfFragmentPdf, LETTER_WIDTH, appendExhibitIndex, appendExhibitCover } from './lib/pdf/generate';
import { LS_HISTORY_KEY, historyToStorage, historyFromStorage } from './lib/history';
import { clearAllLocalData } from './lib/clearData';
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
} from './lib/defaults';
import { groupExhibits, buildIndexEntries, flattenImageExhibitsWithLabels } from './lib/exhibits';
let fragmentCounter = 0;

function createFragmentId() {
  fragmentCounter += 1;
  return `fragment-${fragmentCounter}`;
}

function syncFragmentCounterFromList(fragments) {
  let maxSeen = fragmentCounter;
  for (const fragment of fragments || []) {
    if (!fragment || typeof fragment.id !== 'string') continue;
    const match = fragment.id.match(/fragment-(\d+)/);
    if (match) {
      const value = parseInt(match[1], 10);
      if (Number.isFinite(value)) {
        maxSeen = Math.max(maxSeen, value);
      }
    }
  }
  fragmentCounter = maxSeen;
}

function createInitialDocState() {
  return {
    docTitle: '',
    docDate: (() => {
      try {
        return new Date().toISOString().slice(0, 10);
      } catch (error) {
        return '';
      }
    })(),
    leftHeadingFields: [...DEFAULT_LEFT_HEADING_FIELDS],
    rightHeadingFields: [...DEFAULT_RIGHT_HEADING_FIELDS],
    plaintiffName: DEFAULT_PLAINTIFF_NAME,
    defendantName: DEFAULT_DEFENDANT_NAME,
    courtTitle: DEFAULT_COURT_TITLE,
    fragments: [
      {
        id: createFragmentId(),
        type: 'markdown',
        content: DEFAULT_WELCOME_CONTENT,
        title: DEFAULT_WELCOME_TITLE,
      },
    ],
  };
}
export default function App() {
  const initialDocStateRef = useRef();
  if (!initialDocStateRef.current) {
    initialDocStateRef.current = createInitialDocState();
  }

  const initialDocState = initialDocStateRef.current;

  const deserializeHistory = useCallback((raw) => {
    return historyFromStorage(raw, initialDocState);
  }, [initialDocState]);

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
    fragments,
  } = docState;

  // Load a default PDF from the public folder on first load
  const defaultPdfLoadedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || defaultPdfLoadedRef.current) return;

    const defaultPdfName = DEFAULT_PDF_FILE;
    const defaultPdfPath = DEFAULT_PDF_PATH;

    // Only add default PDF if fragments are empty (first load)
    if (fragments.length > 0) {
      defaultPdfLoadedRef.current = true;
      return;
    }

    defaultPdfLoadedRef.current = true;
    fetch(defaultPdfPath)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch default PDF: ${res.status}`);
        return res.arrayBuffer();
      })
      .then(async (buffer) => {
        const newId = createFragmentId();
        const fileId = `${newId}-file-${Date.now()}`;
        await idbSetPdf(fileId, buffer);
        updatePresent((current) => ({
          ...current,
          fragments: [
            { id: newId, type: 'pdf', fileId, name: defaultPdfName },
            ...current.fragments,
          ],
        }), { preserveFuture: true });
      })
      .catch(() => {
        // Silently ignore if the file isn't present; UI will still work
      });
  }, [ hydrated, updatePresent, fragments.length ]);

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

  const handleAddLeftField = useCallback(() => {
    mark();
    updatePresent((current) => ({
      ...current,
      leftHeadingFields: [...current.leftHeadingFields, ''],
    }));
  }, [mark, updatePresent]);

  const handleLeftFieldChange = useCallback((index, value) => {
    maybeMark();
    updatePresent((current) => {
      const next = current.leftHeadingFields.map((item, itemIndex) => (itemIndex === index ? value : item));
      return { ...current, leftHeadingFields: next };
    });
  }, [maybeMark, updatePresent]);

  const handleRemoveLeftField = useCallback((index) => {
    mark();
    updatePresent((current) => ({
      ...current,
      leftHeadingFields: current.leftHeadingFields.filter((_, itemIndex) => itemIndex !== index),
    }));
  }, [mark, updatePresent]);

  const handleAddRightField = useCallback(() => {
    mark();
    updatePresent((current) => ({
      ...current,
      rightHeadingFields: [...current.rightHeadingFields, ''],
    }));
  }, [mark, updatePresent]);

  const handleRightFieldChange = useCallback((index, value) => {
    maybeMark();
    updatePresent((current) => {
      const next = current.rightHeadingFields.map((item, itemIndex) => (itemIndex === index ? value : item));
      return { ...current, rightHeadingFields: next };
    });
  }, [maybeMark, updatePresent]);

  const handleRemoveRightField = useCallback((index) => {
    mark();
    updatePresent((current) => ({
      ...current,
      rightHeadingFields: current.rightHeadingFields.filter((_, itemIndex) => itemIndex !== index),
    }));
  }, [mark, updatePresent]);

  // PDF Replace Handler (stores bytes in IDB and references by fileId)
  const handlePdfReplace = useCallback((fragmentId, file) => {
    if (!file || !fragmentId) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
      const buffer = e.target.result;
      const fileId = `${fragmentId}-file-${Date.now()}`;
      await idbSetPdf(fileId, buffer);
      mark();
      updatePresent((current) => ({
        ...current,
        fragments: current.fragments.map((frag) =>
          frag.id === fragmentId
            ? { ...frag, type: 'pdf', fileId, name: file.name, data: undefined }
            : frag
        ),
      }));
    };
    reader.readAsArrayBuffer(file);
  }, [updatePresent, mark]);

  // react-to-print v3: use `contentRef` instead of the deprecated `content` callback
  const handlePrint = useReactToPrint({ contentRef: previewRef, documentTitle: (docTitle && docTitle.trim()) || PRINT_DOCUMENT_TITLE });
 
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

  const handleInsertBefore = useCallback((id) => {
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
  }, [fragments, mark, updatePresent]);

  const handleInsertAfter = useCallback((id) => {
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
  }, [fragments, mark, updatePresent]);

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

  // Add a new PDF section at the end (store in IDB, reference by fileId)
  const handleAddPdfSection = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
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

  const base64ToUint8Array = (base64) => {
    if (!base64 || typeof base64 !== 'string' || base64.length === 0) return null;
    try {
      const binary = window.atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    } catch (_) {
      return null;
    }
  };

  // Convert ArrayBuffer/Uint8Array to base64 string
  const arrayBufferToBase64 = (buffer) => {
    try {
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || []);
      let binary = '';
      const chunk = 0x8000; // process in chunks to avoid call stack limits
      for (let i = 0; i < bytes.length; i += chunk) {
        const sub = bytes.subarray(i, i + chunk);
        binary += String.fromCharCode.apply(null, sub);
      }
      return window.btoa(binary);
    } catch (_) {
      return '';
    }
  };

  // Migrate any inline base64 data to IndexedDB fileId references (one-time per item)
  useEffect(() => {
    let cancelled = false;
    const toMigrate = [];
    fragments.forEach((fragment) => {
      if (fragment.type === 'pdf' && fragment.data && !fragment.fileId) {
        toMigrate.push({ kind: 'pdf', id: fragment.id, name: fragment.name, data: fragment.data });
      } else if (fragment.type === 'exhibits') {
        (fragment.exhibits || []).forEach((ex, idx) => {
          if (ex && ex.data && !ex.fileId) {
            toMigrate.push({ kind: 'ex', fragId: fragment.id, index: idx, name: ex.name, mimeType: ex.mimeType, type: ex.type, data: ex.data });
          }
        });
      }
    });
    if (!toMigrate.length) return;
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
        } catch (_) {
          // ignore
        }
      }
      if (!changes.length || cancelled) return;
      updatePresent((current) => ({
        ...current,
        fragments: current.fragments.map((frag) => {
          if (frag.type === 'pdf') {
            const change = changes.find((c) => c.type === 'pdf' && c.id === frag.id);
            if (change) {
              const next = { ...frag, fileId: change.fileId };
              delete next.data;
              return next;
            }
            return frag;
          }
          if (frag.type === 'exhibits') {
            const exs = (frag.exhibits || []).map((ex, idx) => {
              const change = changes.find((c) => c.type === 'ex' && c.fragId === frag.id && c.index === idx);
              if (change) {
                const nextEx = { ...ex, fileId: change.fileId };
                delete nextEx.data;
                return nextEx;
              }
              return ex;
            });
            return { ...frag, exhibits: exs };
          }
          return frag;
        }),
      }), { preserveFuture: true });
    })();
    return () => { cancelled = true; };
  }, [JSON.stringify(fragments.map(f => ({ id: f.id, type: f.type, hasData: !!f.data, fileId: f.fileId, ex: (f.exhibits||[]).map(ex => ({ hasData: !!ex?.data, fileId: ex?.fileId })) }))), updatePresent]);

  // Build a JSON string for raw editing, stripping large base64 `data` fields
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

  // Apply JSON from raw editor
  const handleApplyRawJson = useCallback(async (text) => {
    const parsed = JSON.parse(text);
    const doc = parsed && parsed.doc ? parsed.doc : parsed; // allow raw doc or wrapped
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.fragments)) throw new Error('Invalid format: missing fragments');
    const safeDoc = {
      docTitle: typeof doc.docTitle === 'string' ? doc.docTitle : '',
      docDate: doc.docDate || '',
      leftHeadingFields: Array.isArray(doc.leftHeadingFields) ? doc.leftHeadingFields : [],
      rightHeadingFields: Array.isArray(doc.rightHeadingFields) ? doc.rightHeadingFields : [],
      plaintiffName: doc.plaintiffName || '',
      defendantName: doc.defendantName || '',
      courtTitle: doc.courtTitle || '',
      fragments: Array.isArray(doc.fragments) ? doc.fragments : [],
    };
    // normalize exhibits arrays
    safeDoc.fragments = safeDoc.fragments.map((f) => {
      if (!f || typeof f !== 'object') return f;
      if (f.type === 'exhibits') {
        f.exhibits = Array.isArray(f.exhibits) ? f.exhibits : [];
      }
      return f;
    });
    mark();
    replaceHistory({ past: [], present: safeDoc, future: [] });
  }, [mark, replaceHistory]);

  // Export a self-contained JSON bundle (embeds all PDFs/images as base64 in-place)
  const handleExportBundle = useCallback(async () => {
    try {
      // Deep clone of docState to avoid mutating current state
      const clone = JSON.parse(JSON.stringify(docState));

      // Walk fragments, fetch bytes from IDB for any fileId and embed as base64 `data`, remove fileId
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
          if (frag.data) delete frag.fileId; // ensure import will migrate to IDB
        } else if (frag.type === 'exhibits') {
          const exhibits = Array.isArray(frag.exhibits) ? frag.exhibits : [];
          for (const ex of exhibits) {
            if (!ex || typeof ex !== 'object') continue;
            // parent/child entries are flattened in our model as a single list with labels elsewhere
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
      const base = raw ? raw.replace(/[^\w\s-]+/g, '').replace(/[\s]+/g, '-').replace(/-+/g, '-').slice(0, 80) : 'legal-drafting-document';
      a.download = `${base}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore – best effort export
    }
  }, [docState]);

  // Import a JSON bundle and replace current document
  const handleImportBundle = useCallback(async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const doc = parsed && parsed.doc ? parsed.doc : parsed; // allow raw doc too
      if (!doc || typeof doc !== 'object' || !Array.isArray(doc.fragments)) return;

      // Minimal shape sanitization
      const safeDoc = {
        docTitle: typeof doc.docTitle === 'string' ? doc.docTitle : '',
        docDate: doc.docDate || '',
        leftHeadingFields: Array.isArray(doc.leftHeadingFields) ? doc.leftHeadingFields : [],
        rightHeadingFields: Array.isArray(doc.rightHeadingFields) ? doc.rightHeadingFields : [],
        plaintiffName: doc.plaintiffName || '',
        defendantName: doc.defendantName || '',
        courtTitle: doc.courtTitle || '',
        fragments: Array.isArray(doc.fragments) ? doc.fragments : [],
      };

      // Clear any fileId fields if corresponding base64 data is present to force migration into IDB
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

      // Replace current document
      mark();
      replaceHistory({ past: [], present: safeDoc, future: [] });
    } catch (_) {
      // ignore invalid file
    }
  }, [mark, replaceHistory]);

  const handleCompilePdf = useCallback(async () => {
    if (!fragments.length) return;
    const pdfDoc = await PDFDocument.create();

    for (const fragment of fragments) {
      if (fragment.type === 'markdown') {
        await appendMarkdownFragmentPdf(pdfDoc, fragment.content, headingSettings, fragment.title, docDate, formatDisplayDate, fragment.signatureType || 'default');
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
        // Cover and image pages for image exhibits only, in order
        for (const g of groups) {
          // parent
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
              const captionsForCover = [ ...captions ]; // don't duplicate title in captions
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
                  const MARGIN = 72; // 1 inch on all sides
                  const maxWidth = LETTER_WIDTH - 2 * MARGIN;
                  const maxHeight = 792 - 2 * MARGIN;
                  const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                  const w = img.width * scale;
                  const h = img.height * scale;
                  const x = (LETTER_WIDTH - w) / 2;
                  const y = (792 - h) / 2;
                  page.drawImage(img, { x, y, width: w, height: h });
                } catch (_) { /* ignore */ }
              }
            }
          }
          // children
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
              const label = `${g.letter}${cIdx + 1}`;
              const titleLine = `Exhibit ${label.toUpperCase()} - ${child.title || child.name || ''}`;

              // const titleLine = `exhibit ${label.toLowerCase()} - ${child.title || child.name || ''}`;
              const captionsForCover = [ ...captions ]; // don't duplicate title in captions
              await appendExhibitCover(pdfDoc, captionsForCover, child.description || '', titleLine);

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
                  const MARGIN = 72; // 1 inch on all sides
                  const maxWidth = LETTER_WIDTH - 2 * MARGIN;
                  const maxHeight = 792 - 2 * MARGIN;
                  const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                  const w = img.width * scale;
                  const h = img.height * scale;
                  const x = (LETTER_WIDTH - w) / 2;
                  const y = (792 - h) / 2;
                  page.drawImage(img, { x, y, width: w, height: h });
                } catch (_) { /* ignore */ }
              }
            }
          }
        }
      }
    }

    // Add page numbers at bottom center: "Page X of Y"
    const totalPages = pdfDoc.getPageCount();
    if (totalPages > 0) {
      const footerFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      for (let i = 0; i < totalPages; i += 1) {
        const page = pdfDoc.getPage(i);
        const label = `Page ${i + 1} of ${totalPages}`;
        const size = 10;
        const textWidth = footerFont.widthOfTextAtSize(label, size);
        const x = (LETTER_WIDTH - textWidth) / 2;
        const y = 18; // ~0.25in from bottom
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
  }, [fragments, headingSettings, docDate]);

  useEffect(() => {
    syncFragmentCounterFromList(fragments);
  }, [fragments]);

  // Removed legacy hydration effect: preview and compile now fetch bytes by fileId directly from IndexedDB when needed

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
    // Reset in-memory state immediately so empty fragments disappear even before reload
    try { replaceHistory({ past: [], present: initialDocState, future: [] }); } catch (_) {}
    await clearAllLocalData({ reload: true });
  }, [replaceHistory, initialDocState]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const onKey = (e) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.key.toLowerCase() === 'y') || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  return (
    <div className="app-shell">
      <EditorPanel
        docTitle={docTitle}
        setDocTitle={setDocTitle}
        docDate={docDate}
        setDocDate={setDocDate}
        headingExpanded={headingExpanded}
        setHeadingExpanded={setHeadingExpanded}
        leftHeadingFields={leftHeadingFields}
        rightHeadingFields={rightHeadingFields}
        plaintiffName={plaintiffName}
        defendantName={defendantName}
        courtTitle={courtTitle}
        onAddLeftField={handleAddLeftField}
        onLeftFieldChange={handleLeftFieldChange}
        onRemoveLeftField={handleRemoveLeftField}
        onAddRightField={handleAddRightField}
        onRightFieldChange={handleRightFieldChange}
        onRemoveRightField={handleRemoveRightField}
        setPlaintiffName={setPlaintiffName}
        setDefendantName={setDefendantName}
        setCourtTitle={setCourtTitle}
        fragments={fragments}
        onReorder={handleReorderFragments}
        onRemove={handleRemoveFragmentConfirmed}
        onInsertBefore={handleInsertBefore}
        onInsertAfter={handleInsertAfter}
        onAddSectionEnd={handleAddSectionEnd}
        onAddExhibitsSection={handleAddExhibitsSection}
  onAddPdfSection={handleAddPdfSection}
        editingFragmentId={editingFragmentId}
        setEditingFragmentId={setEditingFragmentId}
        onEditFragmentFields={handleEditFragmentFields}
        onDeleteEditingFragment={handleRemoveFragmentConfirmed}
        onPdfReplace={handlePdfReplace}
      />

      <PreviewPanel
        fragments={fragments}
        headingSettings={headingSettings}
        docDate={docDate}
        onPrint={handlePrint}
        onCompilePdf={handleCompilePdf}
        onClearAll={handleClearAll}
        onExportBundle={handleExportBundle}
        onImportBundle={handleImportBundle}
        getRawJson={getRawJson}
        onApplyRawJson={handleApplyRawJson}
        fullscreenFragmentId={fullscreenFragmentId}
        setFullscreenFragmentId={setFullscreenFragmentId}
        contentRef={previewRef}
      />
    </div>
  );
}