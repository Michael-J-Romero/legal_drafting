'use client';

import React from 'react';

export default function DocumentMenu({ onCreate }) {
  return (
    <div className="documents-menu">
      <div className="documents-menu__card">
        <h1 className="documents-menu__title">Your Documents</h1>
        <p className="documents-menu__description">
          Get started by creating a new legal document.
        </p>
        <button type="button" className="documents-menu__action" onClick={onCreate}>
          Create new document
        </button>
      </div>
    </div>
  );
}
