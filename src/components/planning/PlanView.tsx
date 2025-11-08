'use client';

import React, { useState } from 'react';
import PlanVisualization from './PlanVisualization';
import PlanChat from './PlanChat';
import type { Plan } from '../../types/plan';

/**
 * Main container component for the planning agent
 * Manages the state and layout of the plan visualization and chat interface
 */
export default function PlanView() {
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 24px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#fff'
      }}>
        <h1 style={{ 
          fontSize: 24, 
          fontWeight: 600, 
          color: '#111827',
          margin: 0
        }}>
          📋 Plan View
        </h1>
        <p style={{ 
          fontSize: 14, 
          color: '#6b7280',
          margin: '4px 0 0 0'
        }}>
          Define, modify, and visualize your overall plan
        </p>
      </div>

      {/* Main content area */}
      <div style={{ 
        flex: 1, 
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Plan visualization - left side */}
        <div style={{ 
          flex: 1, 
          borderRight: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          <PlanVisualization 
            plan={currentPlan}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
          />
        </div>

        {/* Chat interface - right side */}
        <div style={{ 
          width: '400px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <PlanChat 
            plan={currentPlan}
            selectedNodeId={selectedNodeId}
            onPlanUpdate={setCurrentPlan}
          />
        </div>
      </div>
    </div>
  );
}
