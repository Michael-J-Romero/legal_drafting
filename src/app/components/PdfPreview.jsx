'use client';

import React, { useEffect, useRef } from 'react';
import { loadPdfjs, pushPdfjsLog } from '../lib/pdfjsLoader';

export default function PdfPreview({ data }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    async function renderPdf() {
      if (!data || !containerRef.current) return;
      const container = containerRef.current;
      container.innerHTML = '';
      try {
        pushPdfjsLog('renderPdf.start', { size: data?.byteLength, disableWorker: true });
        const pdfjs = await loadPdfjs();
        pushPdfjsLog('renderPdf.loaded', { hasPdfjs: !!pdfjs, hasGetDocument: !!pdfjs?.getDocument });
        if (!pdfjs || !pdfjs.getDocument) {
          throw new Error('pdfjs failed to load getDocument');
        }
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), disableWorker: true });
        pushPdfjsLog('renderPdf.getDocument', { hasPromise: !!loadingTask?.promise });
        const pdf = await loadingTask.promise;
        pushPdfjsLog('renderPdf.docReady', { numPages: pdf?.numPages });
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          if (cancelled) break;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '8.5in';
          canvas.style.height = 'auto';
          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'pdf-page';
          pageWrapper.appendChild(canvas);
          container.appendChild(pageWrapper);
          pushPdfjsLog('renderPdf.pageStart', { pageNum, w: canvas.width, h: canvas.height });
          await page.render({ canvasContext: context, viewport }).promise;
          pushPdfjsLog('renderPdf.pageDone', { pageNum });
        }
        pushPdfjsLog('renderPdf.done');
      } catch (err) {
        try { console.error('PDF preview error:', err); } catch (_) {}
        pushPdfjsLog('renderPdf.error', { message: String(err?.message || err), stack: String(err?.stack || '') });
        try {
          try { console.warn('PDF.js preview failed, falling back to iframe method.'); } catch (_) {}
          objectUrl = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
          const iframe = document.createElement('iframe');
          iframe.src = objectUrl;
          iframe.title = 'PDF preview';
          iframe.style.width = '8.5in';
          iframe.style.height = '11in';
          iframe.style.border = 'none';
          const wrapper = document.createElement('div');
          wrapper.className = 'pdf-page';
          wrapper.appendChild(iframe);
          container.appendChild(wrapper);
          pushPdfjsLog('renderPdf.fallbackIframe', { urlCreated: !!objectUrl });
        } catch (fallbackErr) {
          const fallback = document.createElement('div');
          fallback.className = 'page-surface pdf-placeholder';
          const msg = err && (err.message || String(err));
          fallback.textContent = `Failed to render PDF${msg ? `: ${msg}` : ''}`;
          container.appendChild(fallback);
          pushPdfjsLog('renderPdf.fallbackError', { message: String(fallbackErr?.message || fallbackErr) });
        }
      }
    }
    renderPdf();
    return () => {
      cancelled = true;
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      }
    };
  }, [data]);

  return <div ref={containerRef} className="pdf-document" />;
}
