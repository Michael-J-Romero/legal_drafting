'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// ...existing code...
import { useReactToPrint } from 'react-to-print';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import '/src/App.css';
// pdfjs utilities used by PdfPreview only
import { idbSetPdf, idbGetPdf } from './lib/pdfStorage';
import { formatDisplayDate } from './lib/date';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import { appendMarkdownFragment as appendMarkdownFragmentPdf, appendPdfFragment as appendPdfFragmentPdf, LETTER_WIDTH } from './lib/pdf/generate';
import { writeHistory, readHistory } from './lib/history';
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
export default function App() {
  // --- History state ---
  const [historyPast, setHistoryPast] = useState([]); // array of snapshots
  const [historyFuture, setHistoryFuture] = useState([]); // array of snapshots
  const lastEditTsRef = useRef(0);
  const [docDate, setDocDate] = useState(() => {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch (_) {
      return '';
    }
  });
  const [leftHeadingFields, setLeftHeadingFields] = useState(DEFAULT_LEFT_HEADING_FIELDS);
  const [rightHeadingFields, setRightHeadingFields] = useState(DEFAULT_RIGHT_HEADING_FIELDS);
  // return 8
  const [plaintiffName, setPlaintiffName] = useState(DEFAULT_PLAINTIFF_NAME);
  const [defendantName, setDefendantName] = useState(DEFAULT_DEFENDANT_NAME);
  const [courtTitle, setCourtTitle] = useState(DEFAULT_COURT_TITLE);
  const [headingExpanded, setHeadingExpanded] = useState(false);
  const [fragments, setFragments] = useState(() => [
    { id: createFragmentId(), type: 'markdown', content: DEFAULT_WELCOME_CONTENT, title: DEFAULT_WELCOME_TITLE },
  ]);
  const [fullscreenFragmentId, setFullscreenFragmentId] = useState(null);
  const [editingFragmentId, setEditingFragmentId] = useState(null);

  // Load a default PDF from the public folder on first load
  const defaultPdfLoadedRef = useRef(false);
  useEffect(() => {
    if (defaultPdfLoadedRef.current) return;
    defaultPdfLoadedRef.current = true;

  const defaultPdfName = DEFAULT_PDF_FILE;
  const defaultPdfPath = DEFAULT_PDF_PATH;

    // If a fragment with this name already exists (e.g., after HMR), skip
    const hasDefault = fragments.some(
      (f) => f.type === 'pdf' && (f.name === defaultPdfName)
    );
    if (hasDefault) return;

    fetch(defaultPdfPath)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch default PDF: ${res.status}`);
        return res.arrayBuffer();
      })
      .then(async (buffer) => {
        const newId = createFragmentId();
        await idbSetPdf(newId, buffer);
        setFragments((current) => [
          { id: newId, type: 'pdf', data: buffer, name: defaultPdfName },
          ...current,
        ]);
        schedulePersist();
      })
      .catch(() => {
        // Silently ignore if the file isn't present; UI will still work
      });
  }, []);

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

  const handleAddLeftField = useCallback(() => {
    pushHistorySnapshot();
    setLeftHeadingFields((current) => {
      const next = [...current, ''];
      schedulePersist();
      return next;
    });
  }, []);

  const handleLeftFieldChange = useCallback((index, value) => {
    setLeftHeadingFields((current) => {
      const next = current.map((item, itemIndex) => (itemIndex === index ? value : item));
      scheduleThrottledHistoryPush();
      schedulePersist();
      return next;
    });
  }, []);

  const handleRemoveLeftField = useCallback((index) => {
    pushHistorySnapshot();
    setLeftHeadingFields((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      schedulePersist();
      return next;
    });
  }, []);

  const handleAddRightField = useCallback(() => {
    pushHistorySnapshot();
    setRightHeadingFields((current) => {
      const next = [...current, ''];
      schedulePersist();
      return next;
    });
  }, []);

  const handleRightFieldChange = useCallback((index, value) => {
    setRightHeadingFields((current) => {
      const next = current.map((item, itemIndex) => (itemIndex === index ? value : item));
      scheduleThrottledHistoryPush();
      schedulePersist();
      return next;
    });
  }, []);

  const handleRemoveRightField = useCallback((index) => {
    pushHistorySnapshot();
    setRightHeadingFields((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      schedulePersist();
      return next;
    });
  }, []);

  // react-to-print v3: use `contentRef` instead of the deprecated `content` callback
  const handlePrint = useReactToPrint({ contentRef: previewRef, documentTitle: PRINT_DOCUMENT_TITLE });
 
  const handleReorderFragments = useCallback((fromIndex, toIndex) => {
    pushHistorySnapshot();
    setFragments((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      schedulePersist();
      return next;
    });
  }, []);
 

  const handleRemoveFragmentConfirmed = useCallback((id) => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(CONFIRM_DELETE_MESSAGE);
      if (!ok) return;
    }
    setFragments((current) => current.filter((fragment) => fragment.id !== id));
    if (editingFragmentId === id) setEditingFragmentId(null);
  }, [editingFragmentId]);

  const handleInsertBefore = useCallback((id) => {
    pushHistorySnapshot();
    setFragments((current) => {
      const idx = current.findIndex((f) => f.id === id);
      if (idx < 0) return current;
      const newFrag = {
        id: createFragmentId(),
        type: 'markdown',
        title: 'Untitled',
        content: '',
      };
      const next = [...current];
      next.splice(idx, 0, newFrag);
      // Open for editing
      setEditingFragmentId(newFrag.id);
      schedulePersist();
      return next;
    });
  }, []);

  const handleInsertAfter = useCallback((id) => {
    pushHistorySnapshot();
    setFragments((current) => {
      const idx = current.findIndex((f) => f.id === id);
      if (idx < 0) return current;
      const newFrag = {
        id: createFragmentId(),
        type: 'markdown',
        title: 'Untitled',
        content: '',
      };
      const next = [...current];
      next.splice(idx + 1, 0, newFrag);
      setEditingFragmentId(newFrag.id);
      schedulePersist();
      return next;
    });
  }, []);

  const handleAddSectionEnd = useCallback(() => {
    pushHistorySnapshot();
    setFragments((current) => {
      const next = ([
        ...current,
        { id: createFragmentId(), type: 'markdown', title: 'Untitled', content: '' },
      ]);
      schedulePersist();
      return next;
    });
  }, []);

  const handleEditFragmentFields = useCallback((id, updates) => {
    setFragments((current) => {
      const next = current.map((f) => (f.id === id ? { ...f, ...updates } : f));
      scheduleThrottledHistoryPush();
      schedulePersist();
      return next;
    });
  }, []);

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

  // --- History: snapshot helpers ---
  const makeSnapshot = useCallback(() => ({
    docDate,
    leftHeadingFields,
    rightHeadingFields,
    plaintiffName,
    defendantName,
    courtTitle,
    fragments: fragments.map((f) => (
      f.type === 'pdf' ? { id: f.id, type: 'pdf', name: f.name } : { id: f.id, type: 'markdown', title: f.title || '', content: f.content || '' }
    )),
  }), [docDate, leftHeadingFields, rightHeadingFields, plaintiffName, defendantName, courtTitle, fragments]);

  const applySnapshot = useCallback(async (snap) => {
    try {
      setDocDate(snap.docDate || '');
      setLeftHeadingFields(Array.isArray(snap.leftHeadingFields) ? snap.leftHeadingFields : []);
      setRightHeadingFields(Array.isArray(snap.rightHeadingFields) ? snap.rightHeadingFields : []);
      setPlaintiffName(snap.plaintiffName || '');
      setDefendantName(snap.defendantName || '');
      setCourtTitle(snap.courtTitle || '');
      // Load PDFs' binary from IDB
      const out = [];
      for (const f of snap.fragments || []) {
        if (f.type === 'pdf') {
          const data = await idbGetPdf(f.id);
          out.push({ id: f.id, type: 'pdf', name: f.name || 'PDF', data: data || null });
        } else {
          out.push({ id: f.id, type: 'markdown', title: f.title || '', content: f.content || '' });
        }
      }
      setFragments(out);

      const maxId = out.reduce((max, fragment) => {
        if (!fragment || typeof fragment.id !== 'string') return max;
        const match = fragment.id.match(/fragment-(\d+)/);
        if (!match) return max;
        const numeric = Number.parseInt(match[1], 10);
        return Number.isNaN(numeric) ? max : Math.max(max, numeric);
      }, 0);
      if (maxId > fragmentCounter) {
        fragmentCounter = maxId;
      }
    } catch (_) {}
  }, []);

  const persistHistory = useCallback((pastArr = historyPast, futureArr = historyFuture) => {
    try {
      writeHistory(pastArr, makeSnapshot(), futureArr);
    } catch (_) {}
  }, [historyPast, historyFuture, makeSnapshot]);

  const pushHistorySnapshot = useCallback(() => {
    setHistoryPast((cur) => {
      const next = [...cur, makeSnapshot()];
      // clear future when new action
      setHistoryFuture([]);
      // persist after the state mutation tick
      setTimeout(() => persistHistory(next, []), 0);
      return next;
    });
  }, [makeSnapshot, persistHistory]);

  const schedulePersist = useCallback(() => {
    // persist in next tick to include latest state
    setTimeout(() => persistHistory(), 0);
  }, [persistHistory]);

  const scheduleThrottledHistoryPush = useCallback(() => {
    const now = Date.now();
    if (now - lastEditTsRef.current > UNDO_THROTTLE_MS) {
      lastEditTsRef.current = now;
      pushHistorySnapshot();
    }
  }, [pushHistorySnapshot]);

  const handleUndo = useCallback(async () => {
    if (!historyPast.length) return;
    const prev = historyPast[historyPast.length - 1];
    const restPast = historyPast.slice(0, -1);
    const currentSnapshot = makeSnapshot();

    await applySnapshot(prev);

    setHistoryPast(restPast);
    const nextFuture = [...historyFuture, currentSnapshot];
    setHistoryFuture(nextFuture);
    setTimeout(() => persistHistory(restPast, nextFuture), 0);
  }, [applySnapshot, historyFuture, historyPast, makeSnapshot, persistHistory]);

  const handleRedo = useCallback(async () => {
    if (!historyFuture.length) return;
    const nextSnap = historyFuture[historyFuture.length - 1];
    const restFuture = historyFuture.slice(0, -1);
    const currentSnapshot = makeSnapshot();

    await applySnapshot(nextSnap);

    const nextPast = [...historyPast, currentSnapshot];
    setHistoryPast(nextPast);
    setHistoryFuture(restFuture);
    setTimeout(() => persistHistory(nextPast, restFuture), 0);
  }, [applySnapshot, historyFuture, historyPast, makeSnapshot, persistHistory]);

  // Load history on mount
  useEffect(() => {
    try {
  if (typeof window === 'undefined') return;
  const parsed = readHistory();
  if (!parsed) return;
  const present = parsed.present || null;
  const pastArr = Array.isArray(parsed.past) ? parsed.past : [];
  const futureArr = Array.isArray(parsed.future) ? parsed.future : [];
      if (present) {
        // prevent default PDF injection when restoring history
        defaultPdfLoadedRef.current = true;
        // Apply snapshot and set stacks
        (async () => {
          await applySnapshot(present);
          setHistoryPast(pastArr);
          setHistoryFuture(futureArr);
        })();
      }
    } catch (_) {}
  }, [applySnapshot]);

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