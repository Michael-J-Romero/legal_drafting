'use client';

import React from 'react';

export default function HeadingFieldList({
  label,
  fields,
  onAdd,
  onRemove,
  onChange,
  addLabel = 'Add line',
}) {
  return (
    <div className="heading-field-section">
      <div className="heading-section-header">
        <span>{label}</span>
        <button type="button" className="ghost small" onClick={onAdd}>
          {addLabel}
        </button>
      </div>
      {fields.length ? (
        fields.map((value, index) => (
          <div className="heading-field-row" key={`${label}-${index}`}>
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(index, event.target.value)}
              className="heading-input"
            />
            <button
              type="button"
              className="ghost small danger"
              onClick={() => onRemove(index)}
              aria-label={`Remove ${label} line ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))
      ) : (
        <p className="help-text">No lines yet.</p>
      )}
    </div>
  );
}
