'use client';

import React from 'react';
import { FiArrowLeft } from 'react-icons/fi';

export default function PlannerAgentView({ onBack }) {
  return (
    <div className="planner-screen">
      <header className="planner-header" role="banner">
        <button
          type="button"
          className="icon-btn back-button"
          onClick={onBack}
          aria-label="Go back to main menu"
        >
          <FiArrowLeft />
        </button>
        <div className="planner-title">Planner Agent</div>
      </header>
      <div className="planner-main">
        <section className="planner-panel planner-chat" aria-label="Planner chat">
          <div className="planner-chat-placeholder">Chat experience coming soon…</div>
        </section>
        <section className="planner-panel planner-preview" aria-label="Planner preview">
          <div className="planner-preview-placeholder">Preview area</div>
        </section>
      </div>
    </div>
  );
}

