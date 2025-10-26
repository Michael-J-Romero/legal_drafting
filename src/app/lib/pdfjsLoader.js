'use client';

// Centralized PDF.js loading and debug logging utilities

export function pushPdfjsLog(event, details) {
  try {
    // eslint-disable-next-line no-console
    console.log(`[pdfjs-debug] ${event}`, details || '');
  } catch (_) {}
  try {
    if (typeof window !== 'undefined') {
      window.__pdfjsLoadLog = window.__pdfjsLoadLog || [];
      window.__pdfjsLoadLog.push({
        ts: Date.now(),
        event,
        details: (() => {
          if (!details || typeof details !== 'object') return details;
          const out = {};
          for (const k of Object.keys(details)) {
            const v = details[k];
            if (v == null) out[k] = v;
            else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
            else if (k === 'error' && v) out[k] = { message: String(v.message), stack: String(v.stack || '') };
            else if (Array.isArray(v)) out[k] = v.slice(0, 10);
            else out[k] = typeof v;
          }
          return out;
        })(),
      });
      if (window.__pdfjsLoadLog.length > 200) window.__pdfjsLoadLog.shift();
    }
  } catch (_) {}
}

// Log basic environment info on first import
try {
  pushPdfjsLog('env.init', {
    hasWindow: typeof window !== 'undefined',
    hasDocument: typeof document !== 'undefined',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
  });
} catch (_) {}

function loadScriptOnce(src, id) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined') return reject(new Error('no window'));
      const existing = id ? document.getElementById(id) : null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e?.error || new Error('script error')));
        return;
      }
      const s = document.createElement('script');
      if (id) s.id = id;
      s.async = true;
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve();
      s.onerror = (e) => reject(e?.error || new Error('script error'));
      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });
}

async function loadPdfjsFromCdn(version = '3.10.111') {
  if (typeof window === 'undefined') throw new Error('no window');
  if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') {
    return window.pdfjsLib;
  }
  const base = `https://unpkg.com/pdfjs-dist@${version}/build`;
  const url = `${base}/pdf.min.js`;
  pushPdfjsLog('cdn.loadScript', { url });
  await loadScriptOnce(url, '__pdfjs_cdn_script');
  const pdfjs = window.pdfjsLib;
  if (pdfjs && pdfjs.GlobalWorkerOptions) {
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.js`;
    } catch (_) {}
  }
  return pdfjs;
}

export async function loadPdfjs() {
  const attempts = [
    { label: 'legacy/cjs', loader: async () => import('pdfjs-dist/legacy/build/pdf') },
    { label: 'build/cjs', loader: async () => import('pdfjs-dist/build/pdf') },
  ];
  const errors = [];
  pushPdfjsLog('loadPdfjs.start', { attempts: attempts.map((a) => a.label) });
  for (const attempt of attempts) {
    try {
      pushPdfjsLog('loadPdfjs.try', { attempt: attempt.label });
      const mod = await attempt.loader();
      const isEsModule = !!(mod && mod.__esModule);
      const modKeys = mod ? Object.keys(mod).slice(0, 20) : [];
      const hasDefault = !!(mod && mod.default);
      const defaultKeys = mod && mod.default ? Object.keys(mod.default).slice(0, 20) : [];
      const candidate = mod && (mod.getDocument ? mod : mod.default);
      pushPdfjsLog('loadPdfjs.loaded', { attempt: attempt.label, isEsModule, modKeys, hasDefault, defaultKeys, hasGetDoc: !!(candidate && candidate.getDocument) });
      if (candidate && typeof candidate.getDocument === 'function') {
        pushPdfjsLog('loadPdfjs.success', { attempt: attempt.label });
        return candidate;
      }
      const e = new Error('Loaded pdfjs module does not expose getDocument');
      errors.push(e);
      pushPdfjsLog('loadPdfjs.missingGetDocument', { attempt: attempt.label });
    } catch (err) {
      errors.push(err);
      pushPdfjsLog('loadPdfjs.error', { attempt: attempt.label, error: { message: String(err?.message || err), stack: String(err?.stack || '') } });
    }
  }
  if (errors.length) {
    try { console.error('Failed to load pdfjs-dist. Falling back to iframe preview.', errors); } catch (_) {}
    pushPdfjsLog('loadPdfjs.failAll', { errors: errors.map((e) => String(e && e.message ? e.message : e)) });
  }
  try {
    pushPdfjsLog('loadPdfjs.cdnTry', { version: '3.10.111' });
    const pdfjs = await loadPdfjsFromCdn('3.10.111');
    if (pdfjs && typeof pdfjs.getDocument === 'function') {
      pushPdfjsLog('loadPdfjs.cdnSuccess', { version: '3.10.111' });
      return pdfjs;
    }
    pushPdfjsLog('loadPdfjs.cdnMissingGetDocument', { version: '3.10.111' });
  } catch (cdnErr) {
    pushPdfjsLog('loadPdfjs.cdnError', { message: String(cdnErr?.message || cdnErr) });
  }
  return null;
}
