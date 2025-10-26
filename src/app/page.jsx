'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import '/src/App.css';
import { idbSetPdf, idbGetPdf } from './lib/pdfStorage';
import { formatDisplayDate } from './lib/date';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import {
  appendMarkdownFragment as appendMarkdownFragmentPdf,
  appendPdfFragment as appendPdfFragmentPdf,
  LETTER_WIDTH,
} from './lib/pdf/generate';
import { writeHistory, readHistory } from './lib/history';
import {
  DEFAULT_PDF_FILE,
  DEFAULT_PDF_PATH,
  PRINT_DOCUMENT_TITLE,
  COMPILED_PDF_DOWNLOAD_NAME,
  CONFIRM_DELETE_MESSAGE,
} from './lib/defaults';
import useDocumentStore, { toStoredSnapshot } from '../store/useDocumentStore';
import { createFragmentId } from './lib/fragments';

function normalizeStoredSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      docDate: '',
      leftHeadingFields: [],
      rightHeadingFields: [],
      plaintiffName: '',
      defendantName: '',
      courtTitle: '',
      fragments: [],
    };
  }
  const fragments = Array.isArray(snapshot.fragments)
    ? snapshot.fragments
        .map((fragment) => {
          if (!fragment || typeof fragment !== 'object') return null;
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
        })
        .filter(Boolean)
    : [];
  return {
    docDate: snapshot.docDate || '',
    leftHeadingFields: Array.isArray(snapshot.leftHeadingFields) ? [...snapshot.leftHeadingFields] : [],
    rightHeadingFields: Array.isArray(snapshot.rightHeadingFields) ? [...snapshot.rightHeadingFields] : [],
    plaintiffName: snapshot.plaintiffName || '',
    defendantName: snapshot.defendantName || '',
    courtTitle: snapshot.courtTitle || '',
    fragments,
  };
}

export default function App() {
  const previewRef = useRef(null);
  const defaultPdfLoadedRef = useRef(false);
  const lastPersistRef = useRef('');
  const hydrationReadyRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [headingExpanded, setHeadingExpanded] = useState(false);
  const [fullscreenFragmentId, setFullscreenFragmentId] = useState(null);
  const [editingFragmentId, setEditingFragmentId] = useState(null);

  const docState = useDocumentStore((state) => state.document);
  const commitDocument = useDocumentStore((state) => state.commit);
  const overwriteDocument = useDocumentStore((state) => state.overwrite);
  const undo = useDocumentStore((state) => state.undo);
  const redo = useDocumentStore((state) => state.redo);

  const docDate = docState.docDate;
  const leftHeadingFields = docState.leftHeadingFields;
  const rightHeadingFields = docState.rightHeadingFields;
  const plaintiffName = docState.plaintiffName;
  const defendantName = docState.defendantName;
  const courtTitle = docState.courtTitle;
  const fragments = docState.fragments;

  useEffect(() => {
    hydrationReadyRef.current = hydrated;
  }, [hydrated]);

  const inflateSnapshot = useCallback(async (snapshot) => {
    if (!snapshot) return null;
    const normalized = normalizeStoredSnapshot(snapshot);
    const hydratedFragments = [];
    for (const fragment of normalized.fragments) {
      if (fragment.type === 'pdf') {
        let data = null;
        try {
          data = await idbGetPdf(fragment.id);
        } catch (_) {
          data = null;
        }
        hydratedFragments.push({ id: fragment.id, type: 'pdf', name: fragment.name || 'PDF', data });
      } else {
        hydratedFragments.push({
          id: fragment.id,
          type: 'markdown',
          title: fragment.title || '',
          content: fragment.content || '',
        });
      }
    }
    return {
      docDate: normalized.docDate || '',
      leftHeadingFields: normalized.leftHeadingFields,
      rightHeadingFields: normalized.rightHeadingFields,
      plaintiffName: normalized.plaintiffName || '',
      defendantName: normalized.defendantName || '',
      courtTitle: normalized.courtTitle || '',
      fragments: hydratedFragments,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stored = readHistory();
    if (!stored || !stored.present) {
      setHydrated(true);
      return () => {
        cancelled = true;
      };
    }
    const normalized = {
      past: Array.isArray(stored.past) ? stored.past.map(normalizeStoredSnapshot) : [],
      present: normalizeStoredSnapshot(stored.present),
      future: Array.isArray(stored.future) ? stored.future.map(normalizeStoredSnapshot) : [],
    };
    lastPersistRef.current = JSON.stringify(normalized);
    (async () => {
      try {
        const pastDocs = [];
        for (const snap of normalized.past) {
          if (cancelled) return;
          const inflated = await inflateSnapshot(snap);
          if (inflated) pastDocs.push(inflated);
        }
        if (cancelled) return;
        const presentDoc = await inflateSnapshot(normalized.present);
        if (cancelled) return;
        const futureDocs = [];
        for (const snap of normalized.future) {
          if (cancelled) return;
          const inflated = await inflateSnapshot(snap);
          if (inflated) futureDocs.push(inflated);
        }
        if (cancelled) return;
        if (presentDoc) {
          overwriteDocument(presentDoc, pastDocs, futureDocs);
          if (presentDoc.fragments.some((fragment) => fragment.type === 'pdf')) {
            defaultPdfLoadedRef.current = true;
          }
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inflateSnapshot, overwriteDocument]);

  useEffect(() => {
    const unsubscribe = useDocumentStore.subscribe((state) => {
      if (!hydrationReadyRef.current) return;
      const payload = {
        past: state.historyPast.map((snapshot) => toStoredSnapshot(snapshot)),
        present: toStoredSnapshot(state.document),
        future: state.historyFuture.map((snapshot) => toStoredSnapshot(snapshot)),
      };
      const serialized = JSON.stringify(payload);
      if (serialized === lastPersistRef.current) return;
      lastPersistRef.current = serialized;
      writeHistory(payload.past, payload.present, payload.future);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const state = useDocumentStore.getState();
    const payload = {
      past: state.historyPast.map((snapshot) => toStoredSnapshot(snapshot)),
      present: toStoredSnapshot(state.document),
      future: state.historyFuture.map((snapshot) => toStoredSnapshot(snapshot)),
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastPersistRef.current) return;
    lastPersistRef.current = serialized;
    writeHistory(payload.past, payload.present, payload.future);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || defaultPdfLoadedRef.current) return;
    const defaultPdfName = DEFAULT_PDF_FILE;
    const defaultPdfPath = DEFAULT_PDF_PATH;
    const currentDoc = useDocumentStore.getState().document;
    if (currentDoc.fragments.some((fragment) => fragment.type === 'pdf' && fragment.name === defaultPdfName)) {
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
        await idbSetPdf(newId, buffer);
        commitDocument((doc) => ({
          ...doc,
          fragments: [
            { id: newId, type: 'pdf', data: buffer, name: defaultPdfName },
            ...doc.fragments,
          ],
        }), { recordHistory: false });
      })
      .catch(() => {
        // Ignore missing default PDF silently
      });
  }, [hydrated, commitDocument]);

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
    (value) => {
      commitDocument((doc) => ({ ...doc, docDate: value }));
    },
    [commitDocument],
  );

  const setPlaintiff = useCallback(
    (value) => {
      commitDocument((doc) => ({ ...doc, plaintiffName: value }));
    },
    [commitDocument],
  );

  const setDefendant = useCallback(
    (value) => {
      commitDocument((doc) => ({ ...doc, defendantName: value }));
    },
    [commitDocument],
  );

  const setCourt = useCallback(
    (value) => {
      commitDocument((doc) => ({ ...doc, courtTitle: value }));
    },
    [commitDocument],
  );

  const handleAddLeftField = useCallback(() => {
    commitDocument((doc) => ({
      ...doc,
      leftHeadingFields: [...doc.leftHeadingFields, ''],
    }));
  }, [commitDocument]);

  const handleLeftFieldChange = useCallback(
    (index, value) => {
      commitDocument((doc) => ({
        ...doc,
        leftHeadingFields: doc.leftHeadingFields.map((item, itemIndex) => (
          itemIndex === index ? value : item
        )),
      }));
    },
    [commitDocument],
  );

  const handleRemoveLeftField = useCallback(
    (index) => {
      commitDocument((doc) => ({
        ...doc,
        leftHeadingFields: doc.leftHeadingFields.filter((_, itemIndex) => itemIndex !== index),
      }));
    },
    [commitDocument],
  );

  const handleAddRightField = useCallback(() => {
    commitDocument((doc) => ({
      ...doc,
      rightHeadingFields: [...doc.rightHeadingFields, ''],
    }));
  }, [commitDocument]);

  const handleRightFieldChange = useCallback(
    (index, value) => {
      commitDocument((doc) => ({
        ...doc,
        rightHeadingFields: doc.rightHeadingFields.map((item, itemIndex) => (
          itemIndex === index ? value : item
        )),
      }));
    },
    [commitDocument],
  );

  const handleRemoveRightField = useCallback(
    (index) => {
      commitDocument((doc) => ({
        ...doc,
        rightHeadingFields: doc.rightHeadingFields.filter((_, itemIndex) => itemIndex !== index),
      }));
    },
    [commitDocument],
  );

  const handleReorderFragments = useCallback(
    (fromIndex, toIndex) => {
      if (fromIndex === toIndex) return;
      commitDocument((doc) => {
        const next = [...doc.fragments];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return { ...doc, fragments: next };
      });
    },
    [commitDocument],
  );

  const handleRemoveFragmentConfirmed = useCallback(
    (id) => {
      if (typeof window !== 'undefined') {
        const ok = window.confirm(CONFIRM_DELETE_MESSAGE);
        if (!ok) return;
      }
      commitDocument((doc) => ({
        ...doc,
        fragments: doc.fragments.filter((fragment) => fragment.id !== id),
      }));
      if (editingFragmentId === id) {
        setEditingFragmentId(null);
      }
    },
    [commitDocument, editingFragmentId],
  );

  const handleInsertBefore = useCallback(
    (id) => {
      const current = useDocumentStore.getState().document;
      const idx = current.fragments.findIndex((fragment) => fragment.id === id);
      if (idx < 0) return;
      const newId = createFragmentId();
      commitDocument((doc) => {
        const next = [...doc.fragments];
        next.splice(idx, 0, {
          id: newId,
          type: 'markdown',
          title: 'Untitled',
          content: '',
        });
        return { ...doc, fragments: next };
      });
      setEditingFragmentId(newId);
    },
    [commitDocument],
  );

  const handleInsertAfter = useCallback(
    (id) => {
      const current = useDocumentStore.getState().document;
      const idx = current.fragments.findIndex((fragment) => fragment.id === id);
      if (idx < 0) return;
      const newId = createFragmentId();
      commitDocument((doc) => {
        const next = [...doc.fragments];
        next.splice(idx + 1, 0, {
          id: newId,
          type: 'markdown',
          title: 'Untitled',
          content: '',
        });
        return { ...doc, fragments: next };
      });
      setEditingFragmentId(newId);
    },
    [commitDocument],
  );

  const handleAddSectionEnd = useCallback(() => {
    const newId = createFragmentId();
    commitDocument((doc) => ({
      ...doc,
      fragments: [
        ...doc.fragments,
        { id: newId, type: 'markdown', title: 'Untitled', content: '' },
      ],
    }));
    setEditingFragmentId(newId);
  }, [commitDocument]);

  const handleEditFragmentFields = useCallback(
    (id, updates) => {
      commitDocument((doc) => ({
        ...doc,
        fragments: doc.fragments.map((fragment) => (fragment.id === id ? { ...fragment, ...updates } : fragment)),
      }));
    },
    [commitDocument],
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
        );
      } else if (fragment.type === 'pdf' && fragment.data) {
        await appendPdfFragmentPdf(pdfDoc, fragment.data);
      }
    }

    const totalPages = pdfDoc.getPageCount();
    if (totalPages > 0) {
      const footerFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      for (let index = 0; index < totalPages; index += 1) {
        const page = pdfDoc.getPage(index);
        const label = `Page ${index + 1} of ${totalPages}`;
        const size = 10;
        const textWidth = footerFont.widthOfTextAtSize(label, size);
        const x = (LETTER_WIDTH - textWidth) / 2;
        const y = 18;
        page.drawText(label, {
          x,
          y,
          size,
          font: footerFont,
          color: rgb(0.28, 0.32, 0.37),
        });
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

  const handleUndo = useCallback(() => {
    void undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    void redo();
  }, [redo]);

  const handleDeleteEditingFragment = useCallback(
    (id) => {
      handleRemoveFragmentConfirmed(id);
    },
    [handleRemoveFragmentConfirmed],
  );

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

  const handlePrint = useReactToPrint({ contentRef: previewRef, documentTitle: PRINT_DOCUMENT_TITLE });

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
        setPlaintiffName={setPlaintiff}
        setDefendantName={setDefendant}
        setCourtTitle={setCourt}
        fragments={fragments}
        onReorder={handleReorderFragments}
        onRemove={handleRemoveFragmentConfirmed}
        onInsertBefore={handleInsertBefore}
        onInsertAfter={handleInsertAfter}
        onAddSectionEnd={handleAddSectionEnd}
        editingFragmentId={editingFragmentId}
        setEditingFragmentId={setEditingFragmentId}
        onEditFragmentFields={handleEditFragmentFields}
        onDeleteEditingFragment={handleDeleteEditingFragment}
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
