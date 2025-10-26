'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import '/src/App.css';
import { useUndo } from '@legal-drafting/use-undo';
import { idbSetPdf, idbGetPdf } from './lib/pdfStorage';
import { saveDocState, loadDocState } from './lib/documentStorage';
import { formatDisplayDate } from './lib/date';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import {
  appendMarkdownFragment as appendMarkdownFragmentPdf,
  appendPdfFragment as appendPdfFragmentPdf,
  LETTER_WIDTH,
} from './lib/pdf/generate';
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
} from './lib/defaults';

let fragmentCounter = 0;

function createFragmentId() {
  fragmentCounter += 1;
  return `fragment-${fragmentCounter}`;
}

function syncFragmentCounterFromFragments(fragments) {
  let max = fragmentCounter;
  for (const fragment of fragments || []) {
    if (!fragment || typeof fragment.id !== 'string') continue;
    const match = fragment.id.match(/fragment-(\d+)/);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (Number.isNaN(value)) continue;
    if (value > max) max = value;
  }
  fragmentCounter = max;
}

function createInitialDocState() {
  let today = '';
  try {
    today = new Date().toISOString().slice(0, 10);
  } catch (_) {
    today = '';
  }
  return {
    docDate: today,
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

async function hydrateStoredDocState(raw) {
  const hydrated = {
    docDate: raw?.docDate || '',
    leftHeadingFields: Array.isArray(raw?.leftHeadingFields) ? [...raw.leftHeadingFields] : [],
    rightHeadingFields: Array.isArray(raw?.rightHeadingFields) ? [...raw.rightHeadingFields] : [],
    plaintiffName: raw?.plaintiffName || '',
    defendantName: raw?.defendantName || '',
    courtTitle: raw?.courtTitle || '',
    fragments: [],
  };

  if (Array.isArray(raw?.fragments)) {
    for (const fragment of raw.fragments) {
      if (!fragment || typeof fragment !== 'object') continue;
      if (fragment.type === 'pdf') {
        const data = await idbGetPdf(fragment.id);
        hydrated.fragments.push({
          id: fragment.id,
          type: 'pdf',
          name: fragment.name || 'PDF',
          data: data || null,
        });
      } else {
        hydrated.fragments.push({
          id: fragment.id,
          type: 'markdown',
          title: fragment.title || '',
          content: fragment.content || '',
        });
      }
    }
  }

  if (!hydrated.fragments.length) {
    hydrated.fragments.push({
      id: createFragmentId(),
      type: 'markdown',
      title: DEFAULT_WELCOME_TITLE,
      content: DEFAULT_WELCOME_CONTENT,
    });
  }

  return hydrated;
}

export default function App() {
  const previewRef = useRef(null);
  const defaultPdfLoadedRef = useRef(false);
  const [headingExpanded, setHeadingExpanded] = useState(false);
  const [fullscreenFragmentId, setFullscreenFragmentId] = useState(null);
  const [editingFragmentId, setEditingFragmentId] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const initialDocState = useMemo(() => createInitialDocState(), []);
  const [docHistory, docControls] = useUndo(initialDocState);

  const { present: docState } = docHistory;
  const { set: setDocState, undo, redo, reset } = docControls;

  const updateDocState = useCallback(
    (updater, options) => {
      setDocState((current) => {
        const base = typeof updater === 'function' ? updater(current) : updater;
        const normalized = {
          docDate: base?.docDate || '',
          leftHeadingFields: Array.isArray(base?.leftHeadingFields) ? [...base.leftHeadingFields] : [],
          rightHeadingFields: Array.isArray(base?.rightHeadingFields) ? [...base.rightHeadingFields] : [],
          plaintiffName: base?.plaintiffName || '',
          defendantName: base?.defendantName || '',
          courtTitle: base?.courtTitle || '',
          fragments: Array.isArray(base?.fragments)
            ? base.fragments
                .map((fragment) => (fragment ? { ...fragment } : null))
                .filter(Boolean)
            : [],
        };
        return normalized;
      }, options);
    },
    [setDocState],
  );

  const docDate = docState?.docDate || '';
  const leftHeadingFields = docState?.leftHeadingFields || [];
  const rightHeadingFields = docState?.rightHeadingFields || [];
  const plaintiffName = docState?.plaintiffName || '';
  const defendantName = docState?.defendantName || '';
  const courtTitle = docState?.courtTitle || '';
  const fragments = docState?.fragments || [];

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

  const setDocDateValue = useCallback(
    (value) => {
      updateDocState((current) => ({ ...current, docDate: value }));
    },
    [updateDocState],
  );

  const setPlaintiffNameValue = useCallback(
    (value) => {
      updateDocState((current) => ({ ...current, plaintiffName: value }));
    },
    [updateDocState],
  );

  const setDefendantNameValue = useCallback(
    (value) => {
      updateDocState((current) => ({ ...current, defendantName: value }));
    },
    [updateDocState],
  );

  const setCourtTitleValue = useCallback(
    (value) => {
      updateDocState((current) => ({ ...current, courtTitle: value }));
    },
    [updateDocState],
  );

  const handleAddLeftField = useCallback(() => {
    updateDocState((current) => ({
      ...current,
      leftHeadingFields: [...(current.leftHeadingFields || []), ''],
    }));
  }, [updateDocState]);

  const handleLeftFieldChange = useCallback(
    (index, value) => {
      updateDocState((current) => {
        const next = [...(current.leftHeadingFields || [])];
        if (index < 0 || index >= next.length) return current;
        next[index] = value;
        return { ...current, leftHeadingFields: next };
      });
    },
    [updateDocState],
  );

  const handleRemoveLeftField = useCallback(
    (index) => {
      updateDocState((current) => ({
        ...current,
        leftHeadingFields: (current.leftHeadingFields || []).filter((_, itemIndex) => itemIndex !== index),
      }));
    },
    [updateDocState],
  );

  const handleAddRightField = useCallback(() => {
    updateDocState((current) => ({
      ...current,
      rightHeadingFields: [...(current.rightHeadingFields || []), ''],
    }));
  }, [updateDocState]);

  const handleRightFieldChange = useCallback(
    (index, value) => {
      updateDocState((current) => {
        const next = [...(current.rightHeadingFields || [])];
        if (index < 0 || index >= next.length) return current;
        next[index] = value;
        return { ...current, rightHeadingFields: next };
      });
    },
    [updateDocState],
  );

  const handleRemoveRightField = useCallback(
    (index) => {
      updateDocState((current) => ({
        ...current,
        rightHeadingFields: (current.rightHeadingFields || []).filter((_, itemIndex) => itemIndex !== index),
      }));
    },
    [updateDocState],
  );

  const handleReorderFragments = useCallback(
    (fromIndex, toIndex) => {
      if (fromIndex === toIndex) return;
      updateDocState((current) => {
        const list = [...(current.fragments || [])];
        if (
          fromIndex < 0
          || fromIndex >= list.length
          || toIndex < 0
          || toIndex >= list.length
        ) {
          return current;
        }
        const [moved] = list.splice(fromIndex, 1);
        list.splice(toIndex, 0, moved);
        return { ...current, fragments: list };
      });
    },
    [updateDocState],
  );

  const handleRemoveFragmentConfirmed = useCallback(
    (id) => {
      if (typeof window !== 'undefined') {
        const ok = window.confirm(CONFIRM_DELETE_MESSAGE);
        if (!ok) return;
      }
      updateDocState((current) => ({
        ...current,
        fragments: (current.fragments || []).filter((fragment) => fragment.id !== id),
      }));
      if (editingFragmentId === id) setEditingFragmentId(null);
      if (fullscreenFragmentId === id) setFullscreenFragmentId(null);
    },
    [updateDocState, editingFragmentId, fullscreenFragmentId],
  );

  const handleInsertBefore = useCallback(
    (id) => {
      const newFragment = {
        id: createFragmentId(),
        type: 'markdown',
        title: 'Untitled',
        content: '',
      };
      let inserted = false;
      updateDocState((current) => {
        const list = [...(current.fragments || [])];
        const idx = list.findIndex((fragment) => fragment.id === id);
        if (idx < 0) return current;
        list.splice(idx, 0, newFragment);
        inserted = true;
        return { ...current, fragments: list };
      });
      if (inserted) setEditingFragmentId(newFragment.id);
    },
    [updateDocState],
  );

  const handleInsertAfter = useCallback(
    (id) => {
      const newFragment = {
        id: createFragmentId(),
        type: 'markdown',
        title: 'Untitled',
        content: '',
      };
      let inserted = false;
      updateDocState((current) => {
        const list = [...(current.fragments || [])];
        const idx = list.findIndex((fragment) => fragment.id === id);
        if (idx < 0) return current;
        list.splice(idx + 1, 0, newFragment);
        inserted = true;
        return { ...current, fragments: list };
      });
      if (inserted) setEditingFragmentId(newFragment.id);
    },
    [updateDocState],
  );

  const handleAddSectionEnd = useCallback(() => {
    updateDocState((current) => ({
      ...current,
      fragments: [
        ...(current.fragments || []),
        { id: createFragmentId(), type: 'markdown', title: 'Untitled', content: '' },
      ],
    }));
  }, [updateDocState]);

  const handleEditFragmentFields = useCallback(
    (id, updates) => {
      if (!updates || typeof updates !== 'object') return;
      if (updates.data instanceof ArrayBuffer) {
        idbSetPdf(id, updates.data);
      }
      updateDocState((current) => ({
        ...current,
        fragments: (current.fragments || []).map((fragment) => {
          if (fragment.id !== id) return fragment;
          return { ...fragment, ...updates };
        }),
      }));
    },
    [updateDocState],
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
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        const page = pdfDoc.getPage(pageIndex);
        const label = `Page ${pageIndex + 1} of ${totalPages}`;
        const size = 10;
        const textWidth = footerFont.widthOfTextAtSize(label, size);
        const x = (LETTER_WIDTH - textWidth) / 2;
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
  }, [fragments, headingSettings, docDate]);

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

  useEffect(() => {
    if (!editingFragmentId) return;
    if (fragments.some((fragment) => fragment.id === editingFragmentId)) return;
    setEditingFragmentId(null);
  }, [editingFragmentId, fragments]);

  useEffect(() => {
    if (!fullscreenFragmentId) return;
    if (fragments.some((fragment) => fragment.id === fullscreenFragmentId)) return;
    setFullscreenFragmentId(null);
  }, [fragments, fullscreenFragmentId]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (typeof window === 'undefined') return;
      try {
        const stored = loadDocState();
        if (!stored) return;
        const hydrated = await hydrateStoredDocState(stored);
        if (cancelled) return;
        syncFragmentCounterFromFragments(hydrated.fragments);
        defaultPdfLoadedRef.current = true;
        reset(hydrated);
      } catch (_) {
        // ignore hydration errors
      }
    };

    bootstrap()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBootstrapped(true);
      });

    return () => {
      cancelled = true;
    };
  }, [reset]);

  useEffect(() => {
    if (!bootstrapped) return;
    if (defaultPdfLoadedRef.current) return;

    const defaultPdfName = DEFAULT_PDF_FILE;
    if (fragments.some((fragment) => fragment.type === 'pdf' && fragment.name === defaultPdfName)) {
      defaultPdfLoadedRef.current = true;
      return;
    }

    let cancelled = false;
    fetch(DEFAULT_PDF_PATH)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch default PDF: ${res.status}`);
        return res.arrayBuffer();
      })
      .then(async (buffer) => {
        if (cancelled) return;
        const newId = createFragmentId();
        await idbSetPdf(newId, buffer);
        updateDocState((current) => ({
          ...current,
          fragments: [
            { id: newId, type: 'pdf', name: defaultPdfName, data: buffer },
            ...(current.fragments || []),
          ],
        }));
        defaultPdfLoadedRef.current = true;
      })
      .catch(() => {
        // ignore default PDF loading errors
      });

    return () => {
      cancelled = true;
    };
  }, [bootstrapped, fragments, updateDocState]);

  useEffect(() => {
    if (!bootstrapped) return;
    saveDocState(docState);
  }, [docState, bootstrapped]);

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
        setDocDate={setDocDateValue}
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
        setPlaintiffName={setPlaintiffNameValue}
        setDefendantName={setDefendantNameValue}
        setCourtTitle={setCourtTitleValue}
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

