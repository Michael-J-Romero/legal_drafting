'use client';

import React, { useState } from 'react';
import '/src/App.css';

import DocumentBuilder from './components/DocumentBuilder';
import DocumentMenu from './components/DocumentMenu';

export default function App() {
  const [isBuilding, setIsBuilding] = useState(false);

  if (isBuilding) {
    return <DocumentBuilder onExit={() => setIsBuilding(false)} />;
  }

  return <DocumentMenu onCreate={() => setIsBuilding(true)} />;
}
