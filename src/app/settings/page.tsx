'use client';

/**
 * Settings page for model configuration
 */

import React from 'react';
import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';
import { ModelSettings } from '@/components/settings/ModelSettings';

export default function SettingsPage() {
  return (
    <div className="app-root">
      <header className="app-header" role="banner">
        <div className="app-header-inner">
          <div className="app-header-left">
            <Link
              href="/"
              className="app-back-button"
              aria-label="Back to main menu"
              title="Back to main menu"
            >
              <FiArrowLeft />
            </Link>
            <div className="app-title">Settings</div>
          </div>
        </div>
      </header>
      
      <div style={{ 
        padding: '2rem', 
        maxWidth: '800px', 
        margin: '0 auto',
        minHeight: 'calc(100vh - 60px)',
      }}>
        <ModelSettings />
      </div>
    </div>
  );
}
