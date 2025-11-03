'use client';

import React, { useEffect, useRef } from 'react';
import { loadPdfjs, pushPdfjsLog } from '../lib/pdfjsLoader';

export default function PdfPreview({ data, pageOffset = 0, totalPages, showPageNumbers = true }) {
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
          // Ensure exact height during print to avoid overflow/blank pages
          canvas.style.height = '11in';
          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'pdf-page';
          pageWrapper.style.position = 'relative';
          const content = document.createElement('div');
          content.className = 'pdf-content';
          content.style.width = '8.5in';
          content.style.height = '11in';
          content.style.position = 'relative';
          content.appendChild(canvas);
          pageWrapper.appendChild(content);
          container.appendChild(pageWrapper);
          pushPdfjsLog('renderPdf.pageStart', { pageNum, w: canvas.width, h: canvas.height });
          await page.render({ canvasContext: context, viewport }).promise;
          pushPdfjsLog('renderPdf.pageDone', { pageNum });

          // Add consistent footer overlay when totalPages is provided
          if (typeof totalPages === 'number' && Number.isFinite(totalPages)) {
            const footer = document.createElement('div');
            footer.className = 'page-footer';
            footer.setAttribute('aria-hidden', 'true');
            const number = pageOffset + pageNum;
            footer.innerHTML = showPageNumbers ? `<span>Page ${number} of ${totalPages}</span>` : '';
            content.appendChild(footer);
          }
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
          wrapper.style.position = 'relative';
          const content = document.createElement('div');
          content.className = 'pdf-content';
          content.style.width = '8.5in';
          content.style.height = '11in';
          content.style.position = 'relative';
          content.appendChild(iframe);
          if (typeof totalPages === 'number' && Number.isFinite(totalPages)) {
            const footer = document.createElement('div');
            footer.className = 'page-footer';
            footer.setAttribute('aria-hidden', 'true');
            const number = pageOffset + 1; // best-effort for fallback
            footer.innerHTML = showPageNumbers ? `<span>Page ${number} of ${totalPages}</span>` : '';
            content.appendChild(footer);
          }
          wrapper.appendChild(content);
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
  }, [data, pageOffset, totalPages, showPageNumbers]);

  return <div ref={containerRef} className="pdf-document" />;
}
