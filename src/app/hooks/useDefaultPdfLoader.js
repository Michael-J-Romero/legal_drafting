import { useEffect, useRef } from 'react';

import { idbSetPdf } from '../lib/pdfStorage';
import { createFragmentId } from '../lib/fragments';

export default function useDefaultPdfLoader({
  hydrated,
  fragments,
  updatePresent,
  defaultPdfName,
  defaultPdfPath,
}) {
  const defaultPdfLoadedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || defaultPdfLoadedRef.current) return;

    if (fragments.length > 0) {
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
        updatePresent((current) => ({
          ...current,
          fragments: [
            { id: newId, type: 'pdf', fileId, name: defaultPdfName },
            ...current.fragments,
          ],
        }), { preserveFuture: true });
      })
      .catch(() => {
        // Silently ignore if the file isn't present; UI will still work
      });
  }, [hydrated, fragments.length, defaultPdfPath, defaultPdfName, updatePresent]);
}
