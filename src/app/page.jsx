'use client';

import React from 'react';
import '/src/App.css';

import DocumentBuilderView from './components/DocumentBuilderView';
import MainMenu from './components/MainMenu';
import PlannerAgentView from './components/PlannerAgentView';

const VIEWS = {
  MENU: 'menu',
  DOCUMENT: 'document',
  PLANNER: 'planner',
};

export default function App() {
  const [view, setView] = React.useState(VIEWS.MENU);

  return (
    <div className="app-root">
      {view === VIEWS.MENU && (
        <MainMenu
          onOpenDocument={() => setView(VIEWS.DOCUMENT)}
          onOpenPlanner={() => setView(VIEWS.PLANNER)}
        />
      )}
      {view === VIEWS.DOCUMENT && <DocumentBuilderView onBack={() => setView(VIEWS.MENU)} />}
      {view === VIEWS.PLANNER && <PlannerAgentView onBack={() => setView(VIEWS.MENU)} />}
    </div>
  );
}
