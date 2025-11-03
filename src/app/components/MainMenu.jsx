'use client';

import React from 'react';

export default function MainMenu({ onOpenDocument, onOpenPlanner }) {
  return (
    <div className="menu-screen">
      <div className="menu-card">
        <div className="menu-title">Legal Drafting</div>
        <p className="menu-subtitle">Choose a workspace to get started.</p>
        <div className="menu-actions">
          <button type="button" className="primary" onClick={onOpenDocument}>
            Create document
          </button>
          <button type="button" className="secondary" onClick={onOpenPlanner}>
            Planner agent
          </button>
        </div>
      </div>
    </div>
  );
}

