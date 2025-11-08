'use client';

import React, { useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Plan } from '../../types/plan';

interface PlanVisualizationProps {
  plan: Plan | null;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
}

/**
 * Placeholder component for plan visualization using React Flow
 * Will render the plan as a node-based graph
 */
export default function PlanVisualization({
  plan,
  selectedNodeId,
  onNodeSelect,
}: PlanVisualizationProps) {
  // Initial placeholder nodes and edges
  const initialNodes: Node[] = [
    {
      id: 'start',
      type: 'input',
      data: { label: 'Starting Point' },
      position: { x: 250, y: 0 },
      style: { 
        background: '#f3f4f6', 
        border: '2px solid #d1d5db',
        borderRadius: 8,
        padding: 10,
      },
    },
    {
      id: 'goal',
      type: 'output',
      data: { label: 'End Goal' },
      position: { x: 250, y: 200 },
      style: { 
        background: '#dbeafe', 
        border: '2px solid #3b82f6',
        borderRadius: 8,
        padding: 10,
      },
    },
  ];

  const initialEdges: Edge[] = [
    {
      id: 'start-goal',
      source: 'start',
      target: 'goal',
      animated: true,
      style: { stroke: '#9ca3af' },
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect]
  );

  return (
    <div style={{ 
      width: '100%', 
      height: '100%',
      position: 'relative'
    }}>
      {!plan ? (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#6b7280',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          <p style={{ fontSize: 16, marginBottom: 10 }}>No plan created yet</p>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>
            Use the chat to define your starting point and end goal
          </p>
        </div>
      ) : null}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-left"
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={12} 
          size={1}
          color="#e5e7eb"
        />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            if (node.id === selectedNodeId) return '#3b82f6';
            if (node.type === 'input') return '#f3f4f6';
            if (node.type === 'output') return '#dbeafe';
            return '#ffffff';
          }}
          style={{
            backgroundColor: '#f9fafb',
          }}
        />
      </ReactFlow>
    </div>
  );
}
