import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePersistentHistory } from 'persistent-history';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { createInitialDocState } from '../lib/documentState';
import { createEmptyMarkdownFragment, createExhibitsFragment, createFragmentId, syncFragmentCounterFromList } from '../lib/fragments';
import { idbSetPdf, idbGetPdf } from '../lib/pdfStorage';
import { formatDisplayDate } from '../lib/date';
import { appendMarkdownFragment as appendMarkdownFragmentPdf, appendPdfFragment as appendPdfFragmentPdf, LETTER_WIDTH, appendExhibitIndex, appendExhibitCover } from '../lib/pdf/generate';
import { LS_HISTORY_KEY, historyToStorage, historyFromStorage } from '../lib/history';
import { clearAllLocalData } from '../lib/clearData';
import {
  DEFAULT_PDF_FILE,
  DEFAULT_PDF_PATH,
  COMPILED_PDF_DOWNLOAD_NAME,
  CONFIRM_DELETE_MESSAGE,
  UNDO_THROTTLE_MS,
} from '../lib/defaults';
import { groupExhibits, buildIndexEntries } from '../lib/exhibits';
import { base64ToUint8Array, arrayBufferToBase64 } from '../lib/base64';

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
          typeof valueOrUpdater === 'function' ? valueOrUpdater(!!current.showPageNumbers) : !!valueOrUpdater;
        return { ...current, showPageNumbers: nextValue };
      });
    },
    [maybeMark, updatePresent],
  );

  const addLeftHeadingField = useCallback(() => {
    mark();
    updatePresent((current) => ({
      ...current,
      leftHeadingFields: [...current.leftHeadingFields, ''],
    }));
  }, [mark, updatePresent]);

  const updateLeftHeadingField = useCallback(
    (index, value) => {
      maybeMark();
      updatePresent((current) => {
        const next = current.leftHeadingFields.map((item, itemIndex) =>
          itemIndex === index ? value : item,
        );
        return { ...current, leftHeadingFields: next };
      });
    },
    [maybeMark, updatePresent],
  );

  const removeLeftHeadingField = useCallback(
    (index) => {
      mark();
      updatePresent((current) => ({
        ...current,
        leftHeadingFields: current.leftHeadingFields.filter((_, itemIndex) => itemIndex !== index),
      }));
    },
    [mark, updatePresent],
  );

  const addRightHeadingField = useCallback(() => {
    mark();
    updatePresent((current) => ({
      ...current,
      rightHeadingFields: [...current.rightHeadingFields, ''],
    }));
  }, [mark, updatePresent]);

  const updateRightHeadingField = useCallback(
    (index, value) => {
      maybeMark();
      updatePresent((current) => {
        const next = current.rightHeadingFields.map((item, itemIndex) =>
          itemIndex === index ? value : item,
        );
        return { ...current, rightHeadingFields: next };
      });
    },
    [maybeMark, updatePresent],
  );

  const removeRightHeadingField = useCallback(
    (index) => {
      mark();
      updatePresent((current) => ({
        ...current,
        rightHeadingFields: current.rightHeadingFields.filter((_, itemIndex) => itemIndex !== index),
      }));
    },
    [mark, updatePresent],
  );

  const replacePdfFragment = useCallback(
    (fragmentId, file) => {
      if (!file || !fragmentId) return Promise.resolve(null);

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const buffer = event.target.result;
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
            resolve(fragmentId);
          } catch (error) {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(file);
      });
    },
    [mark, updatePresent],
  );

  const reorderFragments = useCallback(
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

  const removeFragment = useCallback(
    (id) => {
      if (!docState.fragments.some((fragment) => fragment.id === id)) return false;
      if (typeof window !== 'undefined') {
        const ok = window.confirm(CONFIRM_DELETE_MESSAGE);
        if (!ok) return false;
      }
      mark();
      updatePresent((current) => ({
        ...current,
        fragments: current.fragments.filter((fragment) => fragment.id !== id),
      }));
      return true;
    },
    [docState.fragments, mark, updatePresent],
  );

  const insertFragmentBefore = useCallback(
    (referenceId) => {
      const newFragment = createEmptyMarkdownFragment();
      let inserted = false;
      mark();
      updatePresent((current) => {
        const index = current.fragments.findIndex((fragment) => fragment.id === referenceId);
        if (index < 0) return current;
        const next = [...current.fragments];
        next.splice(index, 0, newFragment);
        inserted = true;
        return { ...current, fragments: next };
      });
      return inserted ? newFragment.id : null;
    },
    [mark, updatePresent],
  );

  const insertFragmentAfter = useCallback(
    (referenceId) => {
      const newFragment = createEmptyMarkdownFragment();
      let inserted = false;
      mark();
      updatePresent((current) => {
        const index = current.fragments.findIndex((fragment) => fragment.id === referenceId);
        if (index < 0) return current;
        const next = [...current.fragments];
        next.splice(index + 1, 0, newFragment);
        inserted = true;
        return { ...current, fragments: next };
      });
      return inserted ? newFragment.id : null;
    },
    [mark, updatePresent],
  );

  const addMarkdownSection = useCallback(() => {
    const newFragment = createEmptyMarkdownFragment();
    mark();
    updatePresent((current) => ({
      ...current,
      fragments: [...current.fragments, newFragment],
    }));
    return newFragment.id;
  }, [mark, updatePresent]);

  const addExhibitsSection = useCallback(() => {
    const newFragment = createExhibitsFragment();
    mark();
    updatePresent((current) => ({
      ...current,
      fragments: [...current.fragments, newFragment],
    }));
    return newFragment.id;
  }, [mark, updatePresent]);

  const addPdfSection = useCallback(
    (file) => {
      if (!file) return Promise.resolve(null);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
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
            resolve(newId);
          } catch (error) {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(file);
      });
    },
    [mark, updatePresent],
  );

  const editFragmentFields = useCallback(
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

  useEffect(() => {
    syncFragmentCounterFromList(docState.fragments);
  }, [docState.fragments]);

  const defaultPdfLoadedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || defaultPdfLoadedRef.current) return;

    const defaultPdfName = DEFAULT_PDF_FILE;
    const defaultPdfPath = DEFAULT_PDF_PATH;

    if (docState.fragments.length > 0) {
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
        updatePresent(
          (current) => ({
            ...current,
            fragments: [{ id: newId, type: 'pdf', fileId, name: defaultPdfName }, ...current.fragments],
          }),
          { preserveFuture: true },
        );
      })
      .catch(() => {
        // ignore missing default PDF
      });
  }, [hydrated, docState.fragments.length, updatePresent]);

  useEffect(() => {
    let cancelled = false;
    const toMigrate = [];
    docState.fragments.forEach((fragment) => {
      if (fragment.type === 'pdf' && fragment.data && !fragment.fileId) {
        toMigrate.push({ kind: 'pdf', id: fragment.id, name: fragment.name, data: fragment.data });
      } else if (fragment.type === 'exhibits') {
        (fragment.exhibits || []).forEach((ex, idx) => {
          if (ex && ex.data && !ex.fileId) {
            toMigrate.push({
              kind: 'ex',
              fragId: fragment.id,
              index: idx,
              name: ex.name,
              mimeType: ex.mimeType,
              type: ex.type,
              data: ex.data,
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
          // ignore migration errors
        }
      }
      if (!changes.length || cancelled) return;
      updatePresent(
        (current) => ({
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
        }),
        { preserveFuture: true },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [docState.fragments, updatePresent]);

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

  const applyRawJson = useCallback(
    async (text) => {
      const parsed = JSON.parse(text);
      const doc = parsed && parsed.doc ? parsed.doc : parsed;
      if (!doc || typeof doc !== 'object' || !Array.isArray(doc.fragments)) {
        throw new Error('Invalid format: missing fragments');
      }
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
    },
    [mark, replaceHistory],
  );

  const exportBundle = useCallback(async () => {
    try {
      const clone = JSON.parse(JSON.stringify(docState));
      for (const frag of clone.fragments || []) {
        if (frag.type === 'pdf') {
          if (!frag.data && frag.fileId) {
            const buf = await idbGetPdf(frag.fileId);
            if (buf) {
              frag.data = arrayBufferToBase64(buf);
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
        ? raw
            .replace(/[^\w\s-]+/g, '')
            .replace(/[\s]+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 80)
        : 'legal-drafting-document';
      a.download = `${base}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      // ignore export errors
    }
  }, [docState]);

  const importBundle = useCallback(
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
          fragments: Array.isArray(doc.fragments) ? doc.fragments : [],
        };

        safeDoc.fragments = safeDoc.fragments.map((fragment) => {
          if (!fragment || typeof fragment !== 'object') return fragment;
          if (fragment.type === 'pdf') {
            if (fragment.data) delete fragment.fileId;
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
        // ignore import errors
      }
    },
    [mark, replaceHistory],
  );

  const compilePdf = useCallback(async () => {
    const { fragments, docDate, showPageNumbers } = docState;
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
        for (const group of groups) {
          const parent = group.parent.data;
          const hasChildren = group.children.length > 0;
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
              const titleLine = `Exhibit ${group.letter.toUpperCase()} - ${parent.title || parent.name || ''}`;
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
                } catch (error) {
                  // ignore image embed errors
                }
              }
            }
          }
          for (let cIdx = 0; cIdx < group.children.length; cIdx += 1) {
            const child = group.children[cIdx].data;
            if ((child.type || '').toLowerCase() === 'pdf' || (child.mimeType || '').startsWith('application/pdf')) {
              let exBytes = null;
              if (child.data) exBytes = base64ToUint8Array(child.data);
              if (!exBytes && child.fileId) {
                const fromIdb = await idbGetPdf(child.fileId);
                exBytes = fromIdb ? new Uint8Array(fromIdb) : null;
              }
              if (exBytes) await appendPdfFragmentPdf(pdfDoc, exBytes);
            } else if ((child.type || '').toLowerCase() === 'image' || (child.mimeType || '').startsWith('image/')) {
              const label = `${group.letter}${cIdx + 1}`;
              const titleLine = `Exhibit ${label.toUpperCase()} - ${child.title || child.name || ''}`;
              const captionsForCover = [...captions];
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
                  const MARGIN = 72;
                  const maxWidth = LETTER_WIDTH - 2 * MARGIN;
                  const maxHeight = 792 - 2 * MARGIN;
                  const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                  const w = img.width * scale;
                  const h = img.height * scale;
                  const x = (LETTER_WIDTH - w) / 2;
                  const y = (792 - h) / 2;
                  page.drawImage(img, { x, y, width: w, height: h });
                } catch (error) {
                  // ignore image embed errors
                }
              }
            }
          }
        }
      }
    }

    const totalPages = pdfDoc.getPageCount();
    if (showPageNumbers !== false && totalPages > 0) {
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
  }, [docState, headingSettings]);

  const clearAll = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'This will remove all locally saved data (history, uploaded PDFs) and reload the app. Continue?',
      );
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
      // ignore history errors
    }
    await clearAllLocalData({ reload: true });
  }, [initialDocState, replaceHistory]);

  return {
    docState,
    headingSettings,
    hydrated,
    setDocDate,
    setDocTitle,
    setPlaintiffName,
    setDefendantName,
    setCourtTitle,
    setShowPageNumbers,
    addLeftHeadingField,
    updateLeftHeadingField,
    removeLeftHeadingField,
    addRightHeadingField,
    updateRightHeadingField,
    removeRightHeadingField,
    replacePdfFragment,
    reorderFragments,
    removeFragment,
    insertFragmentBefore,
    insertFragmentAfter,
    addMarkdownSection,
    addExhibitsSection,
    addPdfSection,
    editFragmentFields,
    getRawJson,
    applyRawJson,
    exportBundle,
    importBundle,
    compilePdf,
    clearAll,
    undo,
    redo,
  };
}
