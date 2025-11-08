'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Plan data structures
interface PlanNode {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  parentId: string | null;
  children: PlanNode[];
  createdAt: Date;
  updatedAt: Date;
}

interface PlanContext {
  currentNodeId: string | null;
  endGoal: string;
  startingPoint: string;
  notes?: string;
  lastActivityAt: Date;
}

interface Plan {
  id: string;
  title: string;
  rootNodes: PlanNode[];
  context: PlanContext;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  nodeId?: string;
  timestamp: Date;
}

// Storage types
interface StoredPlan {
  id: string;
  title: string;
  rootNodes: any[];
  context: {
    currentNodeId: string | null;
    endGoal: string;
    startingPoint: string;
    notes?: string;
    lastActivityAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

const PLAN_STORAGE_KEY = 'planningAgentPlanData';

// Utility functions
function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function serializePlan(plan: Plan): StoredPlan {
  return {
    id: plan.id,
    title: plan.title,
    rootNodes: plan.rootNodes.map(serializeNode),
    context: {
      ...plan.context,
      lastActivityAt: plan.context.lastActivityAt.toISOString(),
    },
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function deserializePlan(stored: StoredPlan): Plan {
  return {
    id: stored.id,
    title: stored.title,
    rootNodes: stored.rootNodes.map(deserializeNode),
    context: {
      ...stored.context,
      lastActivityAt: new Date(stored.context.lastActivityAt),
    },
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}

function serializeNode(node: PlanNode): any {
  return {
    ...node,
    children: node.children.map(serializeNode),
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}

function deserializeNode(stored: any): PlanNode {
  return {
    ...stored,
    children: (stored.children || []).map(deserializeNode),
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}

// Convert plan tree to React Flow nodes and edges
function planToFlowElements(plan: Plan | null): { nodes: Node[]; edges: Edge[] } {
  if (!plan || plan.rootNodes.length === 0) {
    return {
      nodes: [
        {
          id: 'start-placeholder',
          type: 'input',
          data: { label: 'Define Starting Point' },
          position: { x: 250, y: 50 },
          style: {
            background: '#f3f4f6',
            border: '2px dashed #d1d5db',
            borderRadius: 8,
            padding: 10,
            color: '#6b7280',
          },
        },
        {
          id: 'goal-placeholder',
          type: 'output',
          data: { label: 'Define End Goal' },
          position: { x: 250, y: 250 },
          style: {
            background: '#dbeafe',
            border: '2px dashed #3b82f6',
            borderRadius: 8,
            padding: 10,
            color: '#1e40af',
          },
        },
      ],
      edges: [],
    };
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let yOffset = 50;

  // Add starting point node
  nodes.push({
    id: 'start',
    type: 'input',
    data: { label: plan.context.startingPoint || 'Starting Point' },
    position: { x: 250, y: yOffset },
    style: {
      background: '#d1fae5',
      border: '2px solid #10b981',
      borderRadius: 8,
      padding: 10,
      minWidth: 200,
    },
  });

  yOffset += 100;

  // Add plan nodes
  const addNodeToFlow = (planNode: PlanNode, depth: number, parentId: string) => {
    const xOffset = 100 + depth * 50;
    
    const statusColors = {
      'pending': { bg: '#f3f4f6', border: '#9ca3af' },
      'in-progress': { bg: '#fef3c7', border: '#f59e0b' },
      'completed': { bg: '#d1fae5', border: '#10b981' },
      'blocked': { bg: '#fee2e2', border: '#ef4444' },
    };

    const colors = statusColors[planNode.status] || statusColors.pending;

    nodes.push({
      id: planNode.id,
      data: { label: planNode.title },
      position: { x: xOffset, y: yOffset },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: 8,
        padding: 10,
        minWidth: 180,
      },
    });

    edges.push({
      id: `${parentId}-${planNode.id}`,
      source: parentId,
      target: planNode.id,
      animated: planNode.status === 'in-progress',
      style: { stroke: colors.border },
    });

    yOffset += 80;

    planNode.children.forEach((child) => {
      addNodeToFlow(child, depth + 1, planNode.id);
    });
  };

  plan.rootNodes.forEach((rootNode) => {
    addNodeToFlow(rootNode, 0, 'start');
  });

  // Add end goal node
  nodes.push({
    id: 'goal',
    type: 'output',
    data: { label: plan.context.endGoal || 'End Goal' },
    position: { x: 250, y: yOffset },
    style: {
      background: '#dbeafe',
      border: '2px solid #3b82f6',
      borderRadius: 8,
      padding: 10,
      minWidth: 200,
    },
  });

  // Connect last nodes to goal
  if (plan.rootNodes.length > 0) {
    const connectToGoal = (node: PlanNode) => {
      if (node.children.length === 0) {
        edges.push({
          id: `${node.id}-goal`,
          source: node.id,
          target: 'goal',
          animated: false,
          style: { stroke: '#3b82f6' },
        });
      } else {
        node.children.forEach(connectToGoal);
      }
    };

    plan.rootNodes.forEach(connectToGoal);
  }

  return { nodes, edges };
}

export default function PlanView() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load plan from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PLAN_STORAGE_KEY);
      if (stored) {
        const storedPlan = JSON.parse(stored) as StoredPlan;
        setPlan(deserializePlan(storedPlan));
      }
    } catch (e) {
      console.error('Failed to load plan from storage', e);
    }
  }, []);

  // Save plan to storage
  useEffect(() => {
    if (plan) {
      try {
        localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(serializePlan(plan)));
      } catch (e) {
        console.error('Failed to save plan to storage', e);
      }
    }
  }, [plan]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'system',
          content: !plan
            ? "Welcome to the Plan Builder! Let's start by defining your end goal and starting point. For example: 'My goal is to launch a mobile app. My starting point is having design mockups ready.'"
            : `Welcome back! You're working on: "${plan.title}". Ask me to add steps, modify the plan, or update the status of tasks.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [plan]);

  const { nodes, edges } = planToFlowElements(plan);
  const [flowNodes, setFlowNodes] = useNodesState(nodes);
  const [flowEdges, setFlowEdges] = useEdgesState(edges);

  // Update flow when plan changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = planToFlowElements(plan);
    setFlowNodes(newNodes);
    setFlowEdges(newEdges);
  }, [plan, setFlowNodes, setFlowEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setFlowNodes((nds) => applyNodeChanges(changes, nds)),
    [setFlowNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setFlowEdges((eds) => applyEdgeChanges(changes, eds)),
    [setFlowEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => setFlowEdges((eds) => addEdge(connection, eds)),
    [setFlowEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call AI to process the plan request
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are a planning assistant. The user is building a hierarchical plan. ${plan ? `Current plan: ${JSON.stringify(serializePlan(plan))}` : 'No plan exists yet.'}\n\nUser request: ${userMessage.content}\n\nRespond with plan modifications in JSON format: {"action": "create_plan" | "add_step" | "modify_step" | "update_status", "data": {...}}`,
          messages: messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp.toISOString() })),
          settings: {
            model: 'gpt-4o',
            maxIterations: 1,
            contextWindowSize: 4000,
          },
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.type === 'output_text_delta' && data.data?.delta) {
                assistantMessage += data.data.delta;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    newMessages[newMessages.length - 1] = { ...lastMsg, content: assistantMessage };
                  } else {
                    newMessages.push({ id: generateId(), role: 'assistant', content: assistantMessage, timestamp: new Date() });
                  }
                  return newMessages;
                });
              }
            } catch (err) {
              // Skip malformed JSON
            }
          }
        }
      }

      // Parse AI response and update plan
      if (assistantMessage) {
        // Try to extract JSON from the response
        const jsonMatch = assistantMessage.match(/\{[\s\S]*"action"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const planUpdate = JSON.parse(jsonMatch[0]);
            updatePlan(planUpdate);
          } catch (e) {
            console.error('Failed to parse plan update', e);
          }
        }

        // Finalize assistant message
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (!lastMsg || lastMsg.role !== 'assistant') {
            newMessages.push({ id: generateId(), role: 'assistant', content: assistantMessage, timestamp: new Date() });
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Failed to process request'}`, timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePlan = (planUpdate: any) => {
    const now = new Date();

    if (planUpdate.action === 'create_plan' && planUpdate.data) {
      const newPlan: Plan = {
        id: generateId(),
        title: planUpdate.data.title || 'New Plan',
        rootNodes: [],
        context: {
          currentNodeId: null,
          endGoal: planUpdate.data.endGoal || '',
          startingPoint: planUpdate.data.startingPoint || '',
          notes: planUpdate.data.notes,
          lastActivityAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };
      setPlan(newPlan);
    } else if (planUpdate.action === 'add_step' && planUpdate.data && plan) {
      const newNode: PlanNode = {
        id: generateId(),
        title: planUpdate.data.title || 'New Step',
        description: planUpdate.data.description,
        status: 'pending',
        parentId: planUpdate.data.parentId || null,
        children: [],
        createdAt: now,
        updatedAt: now,
      };

      if (!newNode.parentId) {
        // Add as root node
        setPlan({ ...plan, rootNodes: [...plan.rootNodes, newNode], updatedAt: now });
      } else {
        // Add as child to existing node
        const addToNode = (nodes: PlanNode[]): PlanNode[] => {
          return nodes.map((node) => {
            if (node.id === newNode.parentId) {
              return { ...node, children: [...node.children, newNode], updatedAt: now };
            }
            return { ...node, children: addToNode(node.children) };
          });
        };
        setPlan({ ...plan, rootNodes: addToNode(plan.rootNodes), updatedAt: now });
      }
    } else if (planUpdate.action === 'update_status' && planUpdate.data && plan) {
      const updateNodeStatus = (nodes: PlanNode[]): PlanNode[] => {
        return nodes.map((node) => {
          if (node.id === planUpdate.data.nodeId) {
            return { ...node, status: planUpdate.data.status, updatedAt: now };
          }
          return { ...node, children: updateNodeStatus(node.children) };
        });
      };
      setPlan({ ...plan, rootNodes: updateNodeStatus(plan.rootNodes), updatedAt: now });
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#111827', margin: 0 }}>
          📋 {plan?.title || 'Plan Builder'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0 0' }}>
          {plan ? 'Manage your plan with AI assistance' : 'Define your end goal and starting point to create a plan'}
        </p>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Plan visualization - left side */}
        <div style={{ flex: 1, borderRight: '1px solid #e5e7eb', overflow: 'hidden', position: 'relative' }}>
          {!plan && (
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
          )}
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
            attributionPosition="bottom-left"
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#e5e7eb" />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.id === selectedNodeId) return '#3b82f6';
                if (node.type === 'input') return '#10b981';
                if (node.type === 'output') return '#3b82f6';
                return '#9ca3af';
              }}
              style={{ backgroundColor: '#f9fafb' }}
            />
          </ReactFlow>
        </div>

        {/* Chat interface - right side */}
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
          {/* Chat header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>
              AI Planning Assistant
            </h3>
            {selectedNodeId && (
              <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0 0' }}>
                Selected: {selectedNodeId}
              </p>
            )}
          </div>

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    backgroundColor:
                      message.role === 'user'
                        ? '#3b82f6'
                        : message.role === 'system'
                        ? '#f3f4f6'
                        : '#fff',
                    color: message.role === 'user' ? '#fff' : '#111827',
                    border: message.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {message.content}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#9ca3af',
                    marginTop: 4,
                    textAlign: message.role === 'user' ? 'right' : 'left',
                  }}
                >
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <form
            onSubmit={handleSendMessage}
            style={{ padding: 16, borderTop: '1px solid #e5e7eb', backgroundColor: '#fff' }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: input.trim() && !isLoading ? '#3b82f6' : '#e5e7eb',
                  color: input.trim() && !isLoading ? '#fff' : '#9ca3af',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                }}
              >
                {isLoading ? '...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
