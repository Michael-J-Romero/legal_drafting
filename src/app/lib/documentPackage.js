'use client';

// Utilities to export/import a full project package including PDFs

import JSZip from 'jszip';
import { snapshotForStorage, ensureSnapshot } from './history';
import { idbGetPdf, idbSetPdf } from './pdfStorage';
import { idbGetImage, idbSetImage } from './imageStorage';

function sanitizeFilename(name) {
  try {
    return String(name || '')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (_) {
    return 'document.pdf';
  }
}

/**
 * Build a .ldpkg (zip) containing:
 * - manifest.json
 * - state.json (sanitized snapshot only, no PDF data)
 * - pdfs/{id}-{name}.pdf files
 * - images/{id}-{name} files (original image format)
 */
export async function exportProjectPackage(docState, filename = 'legal-document') {
  const zip = new JSZip();

  const manifest = {
    kind: 'legal-drafting-package',
    version: '1.0',
    createdAt: new Date().toISOString(),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Persist a safe state snapshot (no ArrayBuffers)
  const stateForExport = snapshotForStorage(docState);
  zip.file('state.json', JSON.stringify(stateForExport, null, 2));

  // Collect and write PDFs for each pdf fragment
  const pdfFragments = (docState?.fragments || []).filter((f) => f && f.type === 'pdf');
  for (const frag of pdfFragments) {
    // Prefer in-memory data; fallback to IndexedDB
    let buffer = frag.data;
    if (!buffer) {
      buffer = await idbGetPdf(frag.id);
    }
    if (!buffer) {
      // Skip if missing (should be rare). Still allow export.
      // eslint-disable-next-line no-console
      console.warn(`Skipping PDF ${frag.id} (${frag.name}) - no data available`);
      continue;
    }
    const safeName = sanitizeFilename(frag.name || `${frag.id}.pdf`);
    const path = `pdfs/${frag.id}-${safeName}`;
    const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : await buffer.arrayBuffer?.();
    if (!arrayBuffer) continue;
    zip.file(path, arrayBuffer, { binary: true });
  }

  // Collect and write Images for each image fragment
  const imageFragments = (docState?.fragments || []).filter((f) => f && f.type === 'image');
  for (const frag of imageFragments) {
    let buffer = frag.data;
    if (!buffer) {
      buffer = await idbGetImage(frag.id);
    }
    if (!buffer) {
      console.warn(`Skipping Image ${frag.id} (${frag.name}) - no data available`);
      continue;
    }
    const safeName = sanitizeFilename(frag.name || `${frag.id}`);
    const path = `images/${frag.id}-${safeName}`;
    const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : await buffer.arrayBuffer?.();
    if (!arrayBuffer) continue;
    zip.file(path, arrayBuffer, { binary: true });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.ldpkg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Read a .ldpkg/.zip, store PDFs and images into IndexedDB, and return the imported state.
 * Returns an ensured snapshot matching the app's expected shape.
 */
export async function importProjectPackage(file) {
  const zip = await JSZip.loadAsync(file);

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('Invalid package: missing manifest.json');
  // We parse but don't strictly enforce version
  // const manifest = JSON.parse(await manifestFile.async('string'));

  const stateFile = zip.file('state.json');
  if (!stateFile) throw new Error('Invalid package: missing state.json');
  const stateRaw = JSON.parse(await stateFile.async('string'));
  const documentState = ensureSnapshot(stateRaw);

  // Write PDFs back into IndexedDB keyed by fragment id
  const pdfFragments = (documentState.fragments || []).filter((f) => f && f.type === 'pdf');
  for (const frag of pdfFragments) {
    const safeName = sanitizeFilename(frag.name || `${frag.id}.pdf`);
    const candidates = [
      `pdfs/${frag.id}-${safeName}`,
      `pdfs/${frag.id}.pdf`,
    ];
    let entry = null;
    for (const candidate of candidates) {
      const f = zip.file(candidate);
      if (f) { entry = f; break; }
    }
    if (!entry) {
      // eslint-disable-next-line no-console
      console.warn(`PDF missing in package for id=${frag.id}, name=${safeName}`);
      continue;
    }
    const blob = await entry.async('blob');
    const buffer = await blob.arrayBuffer();
    await idbSetPdf(frag.id, buffer);
  }

  // Write Images back into IndexedDB keyed by fragment id
  const imageFragments = (documentState.fragments || []).filter((f) => f && f.type === 'image');
  for (const frag of imageFragments) {
    const safeName = sanitizeFilename(frag.name || `${frag.id}`);
    const candidates = [
      `images/${frag.id}-${safeName}`,
      `images/${frag.id}`,
    ];
    let entry = null;
    for (const candidate of candidates) {
      const f = zip.file(candidate);
      if (f) { entry = f; break; }
    }
    if (!entry) {
      console.warn(`Image missing in package for id=${frag.id}, name=${safeName}`);
      continue;
    }
    const blob = await entry.async('blob');
    const buffer = await blob.arrayBuffer();
    await idbSetImage(frag.id, buffer);
  }

  return documentState;
}
