'use client';

import React, { useCallback, useState } from 'react';
import '/src/App.css';

import DashboardMenu from './components/DashboardMenu';
import LegalDocumentBuilder from './components/LegalDocumentBuilder';

export default function App() {
  const [isBuildingDocument, setIsBuildingDocument] = useState(false);

  const handleCreateNewDocument = useCallback(() => {
    setIsBuildingDocument(true);
  }, []);

  const handleReturnToMenu = useCallback(() => {
    setIsBuildingDocument(false);
  }, []);

  if (isBuildingDocument) {
    return <LegalDocumentBuilder onExit={handleReturnToMenu} />;
  }

  return (
    <main className="menu-shell">
      <DashboardMenu onCreateNew={handleCreateNewDocument} />
    </main>
  );
}
