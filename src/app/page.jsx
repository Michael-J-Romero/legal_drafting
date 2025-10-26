'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUndoStack } from '@legal/undo-stack';
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
import { saveDocumentHistory, loadDocumentHistory } from './lib/documentPersistence';

let fragmentCounter = 0;

const HISTORY_MAX_SIZE = 200;

function createFragmentId() {
  fragmentCounter += 1;
  return `fragment-${fragmentCounter}`;
}

function getDefaultDocDate() {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch (_) {
    return '';
  }
}

function createInitialDocument() {
  return {
    docDate: getDefaultDocDate(),
    leftHeadingFields: DEFAULT_LEFT_HEADING_FIELDS.slice(),
    rightHeadingFields: DEFAULT_RIGHT_HEADING_FIELDS.slice(),
    plaintiffName: DEFAULT_PLAINTIFF_NAME,
    defendantName: DEFAULT_DEFENDANT_NAME,
    courtTitle: DEFAULT_COURT_TITLE,
    fragments: [
      { id: createFragmentId(), type: 'markdown', content: DEFAULT_WELCOME_CONTENT, title: DEFAULT_WELCOME_TITLE },
    ],
  };
}

function normalizeDocument(doc) {
  if (!doc || typeof doc !== 'object') {
    return createInitialDocument();
  }
  return {
    docDate: doc.docDate || '',
    leftHeadingFields: Array.isArray(doc.leftHeadingFields) ? doc.leftHeadingFields.slice() : [],
    rightHeadingFields: Array.isArray(doc.rightHeadingFields) ? doc.rightHeadingFields.slice() : [],
    plaintiffName: doc.plaintiffName || '',
    defendantName: doc.defendantName || '',
    courtTitle: doc.courtTitle || '',
    fragments: Array.isArray(doc.fragments)
      ? doc.fragments
          .map((fragment) => {
            if (!fragment || typeof fragment !== 'object') return null;
            const baseId = typeof fragment.id === 'string' ? fragment.id : createFragmentId();
            if (fragment.type === 'pdf') {
              return {
                id: baseId,
                type: 'pdf',
                name: fragment.name || '',
                data: fragment.data ?? null,
              };
            }
            return {
              id: baseId,
              type: 'markdown',
              title: fragment.title || '',
              content: fragment.content || '',
            };
          })
          .filter(Boolean)
      : [],
  };
}

function updateFragmentCounterFromDocs(docs) {
  let maxId = fragmentCounter;
  docs.forEach((doc) => {
    if (!doc || !Array.isArray(doc.fragments)) return;
    doc.fragments.forEach((fragment) => {
      if (!fragment || typeof fragment.id !== 'string') return;
      const match = fragment.id.match(/fragment-(\d+)/);
      if (!match) return;
      const num = Number.parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxId) {
        maxId = num;
      }
    });
  });
  fragmentCounter = maxId;
}

export default function App() {
  const initialDocumentRef = useRef(null);
  if (!initialDocumentRef.current) {
    initialDocumentRef.current = createInitialDocument();
  }

  const [history, controls] = useUndoStack(initialDocumentRef.current, { maxSize: HISTORY_MAX_SIZE });
  const { set: setDocumentInternal, undo, redo, commit, load } = controls;
  const document = history.present || initialDocumentRef.current;

  const [headingExpanded, setHeadingExpanded] = useState(false);
  const [fullscreenFragmentId, setFullscreenFragmentId] = useState(null);
  const [editingFragmentId, setEditingFragmentId] = useState(null);
  const [restoreComplete, setRestoreComplete] = useState(false);
  const previewRef = useRef(null);
  const defaultPdfLoadedRef = useRef(false);
  const lastThrottledCommitRef = useRef(0);

  const applyDocumentChange = useCallback((mutator, options = {}) => {
    setDocumentInternal((current) => {
      const base = current ?? createInitialDocument();
      const working = {
        docDate: base.docDate,
        leftHeadingFields: base.leftHeadingFields.slice(),
        rightHeadingFields: base.rightHeadingFields.slice(),
        plaintiffName: base.plaintiffName,
        defendantName: base.defendantName,
        courtTitle: base.courtTitle,
        fragments: base.fragments.map((fragment) => ({ ...fragment })),
      };
      if (typeof mutator === 'function') {
        mutator(working);
      } else if (mutator && typeof mutator === 'object') {
        return normalizeDocument(mutator);
      }
      return normalizeDocument(working);
    }, options);
  }, [setDocumentInternal]);

  const throttledCommit = useCallback(() => {
    const now = Date.now();
    if (now - lastThrottledCommitRef.current > UNDO_THROTTLE_MS) {
      lastThrottledCommitRef.current = now;
      commit();
    }
  }, [commit]);

  const docDate = document.docDate || '';
  const leftHeadingFields = document.leftHeadingFields || [];
  const rightHeadingFields = document.rightHeadingFields || [];
  const plaintiffName = document.plaintiffName || '';
  const defendantName = document.defendantName || '';
  const courtTitle = document.courtTitle || '';
  const fragments = document.fragments || [];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = loadDocumentHistory();
    if (stored && stored.present) {
      defaultPdfLoadedRef.current = true;
      updateFragmentCounterFromDocs([...stored.past, stored.present, ...stored.future]);
      load(stored);
    }
    setRestoreComplete(true);
  }, [load]);

  useEffect(() => {
    if (!restoreComplete) return;
    if (!history.present) return;
    saveDocumentHistory(history);
  }, [history, restoreComplete]);

  useEffect(() => {
    updateFragmentCounterFromDocs([document]);
  }, [document]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const fragment of fragments) {
        if (fragment.type === 'pdf' && !fragment.data) {
          const data = await idbGetPdf(fragment.id);
          if (!data || cancelled) continue;
          applyDocumentChange((draft) => {
            const target = draft.fragments.find((item) => item.id === fragment.id);
            if (target && !target.data) {
              target.data = data;
            }
          }, { record: false, clearFuture: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fragments, applyDocumentChange]);

  useEffect(() => {
    if (!restoreComplete) return;
    if (defaultPdfLoadedRef.current) return;

    const defaultPdfName = DEFAULT_PDF_FILE;
    const defaultPdfPath = DEFAULT_PDF_PATH;

    defaultPdfLoadedRef.current = true;

    const hasDefault = fragments.some(
      (fragment) => fragment.type === 'pdf' && fragment.name === defaultPdfName,
    );
    if (hasDefault) return;

    let cancelled = false;

    fetch(defaultPdfPath)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch default PDF: ${res.status}`);
        return res.arrayBuffer();
      })
      .then(async (buffer) => {
        if (cancelled) return;
        const newId = createFragmentId();
        await idbSetPdf(newId, buffer);
        applyDocumentChange((draft) => {
          draft.fragments.unshift({
            id: newId,
            type: 'pdf',
            data: buffer,
            name: defaultPdfName,
          });
        }, { record: false });
      })
      .catch(() => {
        // ignore missing default PDF
      });

    return () => {
      cancelled = true;
    };
  }, [restoreComplete, fragments, applyDocumentChange]);

  const handleDocDateChange = useCallback((value) => {
    throttledCommit();
    applyDocumentChange((draft) => {
      draft.docDate = value || '';
    }, { record: false });
  }, [applyDocumentChange, throttledCommit]);

  const handleAddLeftField = useCallback(() => {
    applyDocumentChange((draft) => {
      draft.leftHeadingFields.push('');
    });
  }, [applyDocumentChange]);

  const handleLeftFieldChange = useCallback((index, value) => {
    throttledCommit();
    applyDocumentChange((draft) => {
      if (index < 0 || index >= draft.leftHeadingFields.length) return;
      draft.leftHeadingFields[index] = value;
    }, { record: false });
  }, [applyDocumentChange, throttledCommit]);

  const handleRemoveLeftField = useCallback((index) => {
    applyDocumentChange((draft) => {
      if (index < 0 || index >= draft.leftHeadingFields.length) return;
      draft.leftHeadingFields.splice(index, 1);
    });
  }, [applyDocumentChange]);

  const handleAddRightField = useCallback(() => {
    applyDocumentChange((draft) => {
      draft.rightHeadingFields.push('');
    });
  }, [applyDocumentChange]);

  const handleRightFieldChange = useCallback((index, value) => {
    throttledCommit();
    applyDocumentChange((draft) => {
      if (index < 0 || index >= draft.rightHeadingFields.length) return;
      draft.rightHeadingFields[index] = value;
    }, { record: false });
  }, [applyDocumentChange, throttledCommit]);

  const handleRemoveRightField = useCallback((index) => {
    applyDocumentChange((draft) => {
      if (index < 0 || index >= draft.rightHeadingFields.length) return;
      draft.rightHeadingFields.splice(index, 1);
    });
  }, [applyDocumentChange]);

  const handlePlaintiffNameChange = useCallback((value) => {
    throttledCommit();
    applyDocumentChange((draft) => {
      draft.plaintiffName = value || '';
    }, { record: false });
  }, [applyDocumentChange, throttledCommit]);

  const handleDefendantNameChange = useCallback((value) => {
    throttledCommit();
    applyDocumentChange((draft) => {
      draft.defendantName = value || '';
    }, { record: false });
  }, [applyDocumentChange, throttledCommit]);

  const handleCourtTitleChange = useCallback((value) => {
    throttledCommit();
    applyDocumentChange((draft) => {
      draft.courtTitle = value || '';
    }, { record: false });
  }, [applyDocumentChange, throttledCommit]);

  const handleReorderFragments = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    applyDocumentChange((draft) => {
      if (fromIndex < 0 || fromIndex >= draft.fragments.length) return;
      const [moved] = draft.fragments.splice(fromIndex, 1);
      if (!moved) return;
      const targetIndex = Math.min(Math.max(toIndex, 0), draft.fragments.length);
      draft.fragments.splice(targetIndex, 0, moved);
    });
  }, [applyDocumentChange]);

  const handleRemoveFragmentConfirmed = useCallback((id) => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(CONFIRM_DELETE_MESSAGE);
      if (!ok) return;
    }
    applyDocumentChange((draft) => {
      const index = draft.fragments.findIndex((fragment) => fragment.id === id);
      if (index >= 0) {
        draft.fragments.splice(index, 1);
      }
    });
    if (editingFragmentId === id) {
      setEditingFragmentId(null);
    }
  }, [applyDocumentChange, editingFragmentId]);

  const handleInsertBefore = useCallback((id) => {
    const newId = createFragmentId();
    applyDocumentChange((draft) => {
      const index = draft.fragments.findIndex((fragment) => fragment.id === id);
      if (index < 0) return;
      draft.fragments.splice(index, 0, {
        id: newId,
        type: 'markdown',
        title: 'Untitled',
        content: '',
      });
    });
    setEditingFragmentId(newId);
  }, [applyDocumentChange]);

  const handleInsertAfter = useCallback((id) => {
    const newId = createFragmentId();
    applyDocumentChange((draft) => {
      const index = draft.fragments.findIndex((fragment) => fragment.id === id);
      if (index < 0) return;
      draft.fragments.splice(index + 1, 0, {
        id: newId,
        type: 'markdown',
        title: 'Untitled',
        content: '',
      });
    });
    setEditingFragmentId(newId);
  }, [applyDocumentChange]);

  const handleAddSectionEnd = useCallback(() => {
    const newId = createFragmentId();
    applyDocumentChange((draft) => {
      draft.fragments.push({
        id: newId,
        type: 'markdown',
        title: 'Untitled',
        content: '',
      });
    });
  }, [applyDocumentChange]);

  const handleEditFragmentFields = useCallback((id, updates) => {
    throttledCommit();
    applyDocumentChange((draft) => {
      const target = draft.fragments.find((fragment) => fragment.id === id);
      if (!target || target.type !== 'markdown') return;
      if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
        target.title = updates.title ?? '';
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'content')) {
        target.content = updates.content ?? '';
      }
    }, { record: false });
  }, [applyDocumentChange, throttledCommit]);

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

  const handlePrint = useReactToPrint({ contentRef: previewRef, documentTitle: PRINT_DOCUMENT_TITLE });

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
      } else if (fragment.type === 'pdf') {
        const data = fragment.data || (await idbGetPdf(fragment.id));
        if (data) {
          await appendPdfFragmentPdf(pdfDoc, data);
        }
      }
    }

    const totalPages = pdfDoc.getPageCount();
    if (totalPages > 0) {
      const footerFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      for (let i = 0; i < totalPages; i += 1) {
        const page = pdfDoc.getPage(i);
        const label = `Page ${i + 1} of ${totalPages}`;
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
    const onKey = (e) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
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
        setDocDate={handleDocDateChange}
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
        setPlaintiffName={handlePlaintiffNameChange}
        setDefendantName={handleDefendantNameChange}
        setCourtTitle={handleCourtTitleChange}
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
