'use client';

import React from 'react';

export default function DashboardMenu({ onCreateNew }) {
  return (
    <div className="dashboard-menu">
      <div className="dashboard-menu__content">
        <h1>Document Workspace</h1>
        <p>
          Manage your legal documents in one place. Select an existing project or
          start a new document to begin drafting.
        </p>
        <div className="dashboard-menu__actions">
          <button type="button" className="primary-action" onClick={onCreateNew}>
            Create New Document
          </button>
        </div>
      </div>
    </div>
  );
}
