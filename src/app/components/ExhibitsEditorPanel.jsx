'use client';

import React, { useRef } from 'react';
import { idbSetPdf } from '../lib/pdfStorage';

export default function ExhibitsEditorPanel({ fragment, onCancel, onChange, onDelete }) {
  if (!fragment || fragment.type !== 'exhibits') return null;
  const fileInputRef = useRef(null);
  const pendingIndexRef = useRef(null);

  const exhibits = Array.isArray(fragment.exhibits) ? fragment.exhibits : [];

  const handleAddClick = () => {
    pendingIndexRef.current = 'add';
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleReplaceClick = (index) => {
    pendingIndexRef.current = index;
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const buffer = reader.result;
      const fileId = `${fragment.id}-ex-${Date.now()}`;
      await idbSetPdf(fileId, buffer);
      const ex = {
        id: fileId,
        title: file.name.replace(/\.[^.]+$/, ''),
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        type: (file.type || '').startsWith('image/') ? 'image' : 'pdf',
        fileId,
        isCompound: false,
        isGroupHeader: false,
      };
      const list = Array.isArray(fragment.exhibits) ? [...fragment.exhibits] : [];
      if (pendingIndexRef.current === 'add') {
        list.push(ex);
      } else if (typeof pendingIndexRef.current === 'number') {
        list[pendingIndexRef.current] = { ...ex, title: list[pendingIndexRef.current]?.title || ex.title, isCompound: Boolean(list[pendingIndexRef.current]?.isCompound), isGroupHeader: Boolean(list[pendingIndexRef.current]?.isGroupHeader) };
      }
      pendingIndexRef.current = null;
      onChange && onChange(fragment.id, { exhibits: list });
    };
    reader.readAsArrayBuffer(file);
  };

  const updateTitle = (index, title) => {
    const list = Array.isArray(fragment.exhibits) ? [...fragment.exhibits] : [];
    list[index] = { ...list[index], title };
    onChange && onChange(fragment.id, { exhibits: list });
  };

  const updateDescription = (index, description) => {
    const list = Array.isArray(fragment.exhibits) ? [...fragment.exhibits] : [];
    list[index] = { ...list[index], description };
    onChange && onChange(fragment.id, { exhibits: list });
  };

  const updateCompound = (index, makeCompound) => {
    const list = Array.isArray(fragment.exhibits) ? [...fragment.exhibits] : [];
    if (makeCompound) {
      // If there is no explicit header above, insert one above the previous exhibit.
      const prevIdx = index - 1;
      const hasHeaderAbove = prevIdx >= 0 && Boolean(list[prevIdx]?.isGroupHeader);
      if (!hasHeaderAbove) {
        const header = {
          id: `${fragment.id}-group-${Date.now()}`,
          title: '',
          description: '',
          name: '',
          mimeType: '',
          type: 'group',
          fileId: '',
          isGroupHeader: true,
          isCompound: false,
        };
        const insertAt = Math.max(prevIdx, 0);
        list.splice(insertAt, 0, header);
        // After insertion, the current item index shifts by +1
        const newCurrentIndex = index + 1;
        // Mark previous exhibit (now just after header) as compound too if it exists and isn't a header
        if (prevIdx >= 0) {
          list[newCurrentIndex - 1] = { ...list[newCurrentIndex - 1], isCompound: true };
        }
        list[newCurrentIndex] = { ...list[newCurrentIndex], isCompound: true };
      } else {
        list[index] = { ...list[index], isCompound: true };
      }
    } else {
      list[index] = { ...list[index], isCompound: false };
    }
    onChange && onChange(fragment.id, { exhibits: list });
  };

  const removeExhibit = (index) => {
    const list = (fragment.exhibits || []).filter((_, i) => i !== index);
    onChange && onChange(fragment.id, { exhibits: list });
  };

  const addCaptionLine = () => {
    const captions = Array.isArray(fragment.captions) ? [...fragment.captions] : [];
    captions.push('');
    onChange && onChange(fragment.id, { captions });
  };

  const updateCaptionLine = (index, value) => {
    const captions = Array.isArray(fragment.captions) ? [...fragment.captions] : [];
    captions[index] = value;
    onChange && onChange(fragment.id, { captions });
  };

  const removeCaptionLine = (index) => {
    const captions = (fragment.captions || []).filter((_, i) => i !== index);
    onChange && onChange(fragment.id, { captions });
  };

  // Compute grouping and letters: prefer explicit group headers; fallback to legacy grouping
  const computeGroups = (list) => {
    const groups = [];
    const indexToLabel = {};
    let idx = 0;
    while (idx < list.length) {
      const cur = list[idx] || {};
      const isHeader = Boolean(cur.isGroupHeader);
      const group = { parentIndex: idx, children: [] };
      if (isHeader) {
        idx += 1;
        while (idx < list.length && Boolean(list[idx]?.isCompound)) {
          group.children.push(idx);
          idx += 1;
        }
      } else {
        // legacy: parent with following compounds
        idx += 1;
        while (idx < list.length && Boolean(list[idx]?.isCompound)) {
          group.children.push(idx);
          idx += 1;
        }
      }
      groups.push(group);
    }
    // assign letters sequentially by group order
    groups.forEach((g, gi) => {
      const letter = String.fromCharCode(65 + gi);
      indexToLabel[g.parentIndex] = letter;
      g.children.forEach((idx, cIdx) => {
        indexToLabel[idx] = `${letter}${cIdx + 1}`;
      });
    });
    const parentHasChildren = {};
    groups.forEach((g) => { parentHasChildren[g.parentIndex] = g.children.length > 0; });
    return { groups, indexToLabel, parentHasChildren };
  };

  const { indexToLabel, parentHasChildren } = computeGroups(exhibits);

  return (
    <div className="card editor-inline">
      <div className="editor-fullscreen-header">
        <h3>Edit Exhibits</h3>
        <div className="editor-fullscreen-actions">
          <button type="button" className="danger" onClick={onDelete}>Delete</button>
          <button type="button" className="secondary" onClick={onCancel}>Back</button>
        </div>
      </div>
      <div className="editor-fullscreen-form">
        <div className="card" style={{ marginBottom: 12 }}>
          <h4 style={{ marginTop: 0 }}>Exhibit captions (top of page)</h4>
          <div>
            {(fragment.captions || []).map((line, idx) => (
              <div key={`cap-${idx}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input
                  type="text"
                  className="heading-input"
                  placeholder={`Caption line ${idx + 1}`}
                  value={line || ''}
                  onChange={(e) => updateCaptionLine(idx, e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="button" className="danger" onClick={() => removeCaptionLine(idx)}>Remove</button>
              </div>
            ))}
            <button type="button" className="ghost" onClick={addCaptionLine}>+ Add caption line</button>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <button type="button" className="ghost" onClick={handleAddClick}>+ Add Exhibit</button>
          <input ref={fileInputRef} type="file" accept="application/pdf,image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
        <div>
          {exhibits.map((ex, index) => {
            const isHeader = Boolean(ex.isGroupHeader);
            const label = indexToLabel[index] || String.fromCharCode(65 + index);
            const hasChildren = Boolean(parentHasChildren[index]);
            const isChild = Boolean(ex.isCompound);

            if (isHeader) {
              return (
                <div key={ex.id || index} className="card" style={{ padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 36, fontWeight: 'bold' }}>{label})</span>
                    <input
                      type="text"
                      className="heading-input"
                      placeholder="Group title (Exhibit)"
                      value={ex.title || ''}
                      onChange={(e) => updateTitle(index, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="danger" onClick={() => removeExhibit(index)}>Remove</button>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>Description (for index/cover)</label>
                    <textarea
                      className="heading-input"
                      placeholder="Optional description"
                      value={ex.description || ''}
                      onChange={(e) => updateDescription(index, e.target.value)}
                      rows={3}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              );
            }

            if (hasChildren && !isChild) {
              // legacy fallback parent-as-header
              return (
                <div key={ex.id || index} className="card" style={{ padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 36, fontWeight: 'bold' }}>{label})</span>
                    <input
                      type="text"
                      className="heading-input"
                      placeholder="Group title (Exhibit)"
                      value={ex.title || ''}
                      onChange={(e) => updateTitle(index, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="danger" onClick={() => removeExhibit(index)}>Remove</button>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>Description (for index/cover)</label>
                    <textarea
                      className="heading-input"
                      placeholder="Optional description"
                      value={ex.description || ''}
                      onChange={(e) => updateDescription(index, e.target.value)}
                      rows={3}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              );
            }

            // regular or child card
            return (
              <div key={ex.id || index} className="card" style={{ padding: 12, marginBottom: 8, marginLeft: isChild ? 24 : 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ width: 36, fontWeight: 'bold' }}>{label})</span>
                  <input
                    type="text"
                    className="heading-input"
                    placeholder={isChild ? 'Compound exhibit title' : 'Exhibit title'}
                    value={ex.title || ''}
                    onChange={(e) => updateTitle(index, e.target.value)}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(ex.isCompound)}
                      onChange={(e) => updateCompound(index, e.target.checked)}
                    />
                    Compound
                  </label>
                  <button type="button" className="secondary" onClick={() => handleReplaceClick(index)} disabled={false}>Replace file</button>
                  <button type="button" className="danger" onClick={() => removeExhibit(index)}>Remove</button>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{ex.name || ex.mimeType || ''}</div>
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>Description {isChild ? '(shown on cover only)' : '(shown on index/cover)'}</label>
                  <textarea
                    className="heading-input"
                    placeholder={isChild ? 'Optional description for this compound exhibit' : 'Optional description'}
                    value={ex.description || ''}
                    onChange={(e) => updateDescription(index, e.target.value)}
                    rows={3}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            );
          })}
          {!exhibits.length && (
            <div style={{ color: '#666' }}>No exhibits yet. Click "+ Add Exhibit" to attach files.</div>
          )}
        </div>
      </div>
    </div>
  );
}
