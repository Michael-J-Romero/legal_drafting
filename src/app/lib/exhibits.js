'use client';

// Group exhibits by group headers when present, otherwise by legacy parent+compound run.
export function groupExhibits(exhibits = []) {
  const list = Array.isArray(exhibits) ? exhibits : [];
  const groups = [];
  let idx = 0;
  while (idx < list.length) {
    const cur = list[idx] || {};
    const isHeader = Boolean(cur.isGroupHeader);
    const group = { parent: { index: idx, data: cur }, children: [] };
    idx += 1;
    if (isHeader) {
      while (idx < list.length && Boolean(list[idx]?.isCompound)) {
        group.children.push({ index: idx, data: list[idx] });
        idx += 1;
      }
    } else {
      while (idx < list.length && Boolean(list[idx]?.isCompound)) {
        group.children.push({ index: idx, data: list[idx] });
        idx += 1;
      }
    }
    groups.push(group);
  }
  // assign letters sequentially per group
  groups.forEach((g, gi) => { g.letter = String.fromCharCode(65 + gi); });

  // Build mapping index -> label (A for parent, A1, A2 for children)
  const indexToLabel = {};
  groups.forEach((g) => {
    indexToLabel[g.parent.index] = g.letter;
    g.children.forEach((child, idx) => {
      indexToLabel[child.index] = `${g.letter}${idx + 1}`;
    });
  });

  return { groups, indexToLabel };
}

export function buildIndexEntries(groups) {
  return groups.map((g) => ({
    label: `Exhibit ${g.letter.toUpperCase()} - ${g.parent.data.title || g.parent.data.name || ''}`,
    desc: (g.parent.data.description || '').trim(),
    children: g.children.map((c, idx) => ({
      label: `Exhibit ${(g.letter + (idx + 1)).toUpperCase()} - ${c.data.title || c.data.name || ''}`,
      desc: (c.data.description || '').trim(),
    })),
  }));
}

export function flattenImageExhibitsWithLabels(groups) {
  const items = [];
  groups.forEach((g) => {
    // Only render parent image if no children exist; group headers have no files and will be skipped
    const parent = g.parent.data;
    if (!g.children.length) {
      if ((parent.type || '').toLowerCase() === 'image' || (parent.mimeType || '').startsWith('image/')) {
        items.push({ label: g.letter, exhibit: parent });
      }
    }
    g.children.forEach((c, idx) => {
      if ((c.data.type || '').toLowerCase() === 'image' || (c.data.mimeType || '').startsWith('image/')) {
        items.push({ label: `${g.letter}${idx + 1}`, exhibit: c.data });
      }
    });
  });
  return items;
}

// Flatten PDF exhibits in display order with their computed labels (A, A1, ...)
// Rules mirror image flattening: include parent only when there are no children.
export function flattenPdfExhibitsWithLabels(groups) {
  const items = [];
  groups.forEach((g) => {
    const parent = g.parent.data;
    if (!g.children.length) {
      if ((parent.type || '').toLowerCase() === 'pdf' || (parent.mimeType || '').startsWith('application/pdf')) {
        items.push({ label: g.letter, exhibit: parent });
      }
    }
    g.children.forEach((c, idx) => {
      if ((c.data.type || '').toLowerCase() === 'pdf' || (c.data.mimeType || '').startsWith('application/pdf')) {
        items.push({ label: `${g.letter}${idx + 1}`, exhibit: c.data });
      }
    });
  });
  return items;
}
