import { useEffect } from 'react';

import { idbSetPdf } from '../lib/pdfStorage';
import { base64ToUint8Array } from '../lib/fileEncoding';

export default function useFragmentDataMigration(fragments, updatePresent) {
  useEffect(() => {
    let cancelled = false;
    const toMigrate = [];
    fragments.forEach((fragment) => {
      if (fragment.type === 'pdf' && fragment.data && !fragment.fileId) {
        toMigrate.push({ kind: 'pdf', id: fragment.id, name: fragment.name, data: fragment.data });
      } else if (fragment.type === 'exhibits') {
        (fragment.exhibits || []).forEach((ex, idx) => {
          if (ex && ex.data && !ex.fileId) {
            toMigrate.push({ kind: 'ex', fragId: fragment.id, index: idx, name: ex.name, mimeType: ex.mimeType, type: ex.type, data: ex.data });
          }
        });
      }
    });
    if (!toMigrate.length) return () => { cancelled = true; };

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
        } catch (_) {
          // ignore
        }
      }
      if (!changes.length || cancelled) return;
      updatePresent((current) => ({
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
      }), { preserveFuture: true });
    })();

    return () => { cancelled = true; };
  }, [JSON.stringify(fragments.map((f) => ({
    id: f.id,
    type: f.type,
    hasData: !!f.data,
    fileId: f.fileId,
    ex: (f.exhibits || []).map((ex) => ({ hasData: !!ex?.data, fileId: ex?.fileId }))
  }))), updatePresent]);
}
