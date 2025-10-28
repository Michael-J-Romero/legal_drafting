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
import { appendMarkdownFragment as appendMarkdownFragmentPdf, appendPdfFragment as appendPdfFragmentPdf, LETTER_WIDTH } from './lib/pdf/generate';
import { LS_HISTORY_KEY, historyToStorage, historyFromStorage } from './lib/history';
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
  // Clear all local data: localStorage and IndexedDB
  const handleClearLocalData = async () => {
    try {
      // Clear localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
      }
      // Clear IndexedDB
      if (typeof window !== 'undefined' && window.indexedDB) {
        const req = window.indexedDB.deleteDatabase('legalDraftingDB');
        req.onsuccess = req.onerror = req.onblocked = () => {
          // Optionally reload after DB cleared
          window.location.reload();
        };
      } else {
        window.location.reload();
      }
    } catch (err) {
      alert('Failed to clear local data: ' + (err?.message || err));
    }
  };
  const initialDocStateRef = useRef();
  if (!initialDocStateRef.current) {
    initialDocStateRef.current = createInitialDocState();
  }
  const initialDocState = initialDocStateRef.current;

  const {
    present: docState,
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
    deserialize: (raw) => historyFromStorage(raw, initialDocState),
  });

  const [headingExpanded, setHeadingExpanded] = useState(false);
  const [fullscreenFragmentId, setFullscreenFragmentId] = useState(null);
  const [editingFragmentId, setEditingFragmentId] = useState(null);

  const {
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
    const existing = fragments.find((fragment) => fragment.type === 'pdf' && fragment.name === defaultPdfName);
    if (existing && existing.data) {
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
        if (existing) {
          await idbSetPdf(existing.id, buffer);
          updatePresent((current) => ({
            ...current,
            fragments: current.fragments.map((f) => (
              f.id === existing.id ? { ...f, data: buffer } : f
            )),
          }), { preserveFuture: true });
        } else {
          const newId = createFragmentId();
          await idbSetPdf(newId, buffer);
          updatePresent((current) => ({
            ...current,
            fragments: [
              { id: newId, type: 'pdf', data: buffer, name: defaultPdfName },
              ...current.fragments,
            ],
          }), { preserveFuture: true });
        }
      })
      .catch(() => {
        // Silently ignore if the file isn't present; UI will still work
      });
  }, [fragments, hydrated, updatePresent]);

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

  // react-to-print v3: use `contentRef` instead of the deprecated `content` callback
  const handlePrint = useReactToPrint({ contentRef: previewRef, documentTitle: PRINT_DOCUMENT_TITLE });
 
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

  const handleEditFragmentFields = useCallback((id, updates) => {
    maybeMark();
    updatePresent((current) => ({
      ...current,
      fragments: current.fragments.map((fragment) => (
        fragment.id === id ? { ...fragment, ...updates } : fragment
      )),
    }));
  }, [maybeMark, updatePresent]);

  const handleCompilePdf = useCallback(async () => {
    if (!fragments.length) return;
    const pdfDoc = await PDFDocument.create();

    for (const fragment of fragments) {
      if (fragment.type === 'markdown') {
        await appendMarkdownFragmentPdf(pdfDoc, fragment.content, headingSettings, fragment.title, docDate, formatDisplayDate);
      } else if (fragment.type === 'pdf') {
        await appendPdfFragmentPdf(pdfDoc, fragment.data);
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

  useEffect(() => {
    let cancelled = false;
    const pending = fragments.filter((fragment) => fragment.type === 'pdf' && !fragment.data);
    if (!pending.length) return undefined;

    (async () => {
      const updates = [];
      for (const fragment of pending) {
        const data = await idbGetPdf(fragment.id);
        if (cancelled) return;
        if (data) {
          updates.push({ id: fragment.id, data });
        }
      }
      if (!updates.length) return;
      updatePresent((current) => {
        let changed = false;
        const nextFragments = current.fragments.map((fragment) => {
          const match = updates.find((item) => item.id === fragment.id);
          if (!match) return fragment;
          if (fragment.data === match.data) return fragment;
          changed = true;
          return { ...fragment, data: match.data };
        });
        if (!changed) return current;
        return { ...current, fragments: nextFragments };
      }, { preserveFuture: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [fragments, updatePresent]);

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

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
      <div style={{ padding: '12px 0', textAlign: 'center', background: '#f8f8f8', borderBottom: '1px solid #eee' }}>
        <button
          type="button"
          style={{ fontWeight: 'bold', color: '#b00', background: '#fff', border: '1px solid #b00', borderRadius: 4, padding: '6px 16px', cursor: 'pointer' }}
          onClick={handleClearLocalData}
          title="Clear all saved data and reload"
        >
          Clear All Local Data
        </button>
      </div>
      <EditorPanel
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
        editingFragmentId={editingFragmentId}
        setEditingFragmentId={setEditingFragmentId}
        onEditFragmentFields={handleEditFragmentFields}
        onDeleteEditingFragment={handleRemoveFragmentConfirmed}
      />

      <PreviewPanel
        fragments={fragments}
        headingSettings={headingSettings}
        docDate={docDate}
        onPrint={handlePrint}
        onCompilePdf={handleCompilePdf}
        fullscreenFragmentId={fullscreenFragmentId}
        setFullscreenFragmentId={setFullscreenFragmentId}
        contentRef={previewRef}
      />
    </div>
  );
} 