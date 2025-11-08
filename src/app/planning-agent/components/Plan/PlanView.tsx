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
  if (!plan) {
    // No plan exists yet - show placeholders
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

  // Plan exists - show actual starting point and end goal
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

  // Improved node positioning that handles branches
  let nodeCounter = 0;
  const addNodeToFlow = (planNode: PlanNode, depth: number, parentId: string, siblingIndex: number, totalSiblings: number) => {
    const statusColors = {
      'pending': { bg: '#f3f4f6', border: '#9ca3af' },
      'in-progress': { bg: '#fef3c7', border: '#f59e0b' },
      'completed': { bg: '#d1fae5', border: '#10b981' },
      'blocked': { bg: '#fee2e2', border: '#ef4444' },
    };

    const colors = statusColors[planNode.status] || statusColors.pending;

    // Calculate position based on depth and sibling index
    // For branches (multiple siblings), spread them horizontally
    let xOffset = 250; // Center by default
    if (totalSiblings > 1) {
      // Spread siblings horizontally
      const spacing = 250;
      const totalWidth = (totalSiblings - 1) * spacing;
      xOffset = 250 - totalWidth / 2 + siblingIndex * spacing;
    }

    const yPos = yOffset + depth * 120;

    nodes.push({
      id: planNode.id,
      data: { label: planNode.title },
      position: { x: xOffset, y: yPos },
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

    // Recursively add children
    planNode.children.forEach((child, index) => {
      addNodeToFlow(child, depth + 1, planNode.id, index, planNode.children.length);
    });
  };

  // Add all root nodes with proper sibling positioning
  plan.rootNodes.forEach((rootNode, index) => {
    addNodeToFlow(rootNode, 0, 'start', index, plan.rootNodes.length);
  });

  // Calculate the final yOffset based on the deepest node
  const calculateMaxDepth = (nodes: PlanNode[], depth: number = 0): number => {
    if (nodes.length === 0) return depth;
    return Math.max(...nodes.map(node => 
      node.children.length > 0 ? calculateMaxDepth(node.children, depth + 1) : depth
    ));
  };

  const maxDepth = plan.rootNodes.length > 0 ? calculateMaxDepth(plan.rootNodes) : 0;
  const goalYOffset = yOffset + (maxDepth + 1) * 120 + 50;

  // Add end goal node
  nodes.push({
    id: 'goal',
    type: 'output',
    data: { label: plan.context.endGoal || 'End Goal' },
    position: { x: 250, y: goalYOffset },
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
  const [editingNode, setEditingNode] = useState<PlanNode | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'pending' | 'in-progress' | 'completed' | 'blocked'>('pending');
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

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    
    // Don't allow editing start/goal nodes
    if (node.id === 'start' || node.id === 'goal') return;
    
    // Find the plan node to edit
    if (plan) {
      const findNode = (nodes: PlanNode[]): PlanNode | null => {
        for (const n of nodes) {
          if (n.id === node.id) return n;
          const found = findNode(n.children);
          if (found) return found;
        }
        return null;
      };
      
      const nodeToEdit = findNode(plan.rootNodes);
      if (nodeToEdit) {
        setEditingNode(nodeToEdit);
        setEditTitle(nodeToEdit.title);
        setEditDescription(nodeToEdit.description || '');
        setEditStatus(nodeToEdit.status);
      }
    }
  }, [plan]);

  const handleClearPlan = () => {
    if (confirm('Are you sure you want to clear this plan? This cannot be undone.')) {
      setPlan(null);
      setMessages([]);
      setSelectedNodeId(null);
      setEditingNode(null);
      localStorage.removeItem(PLAN_STORAGE_KEY);
    }
  };

  const handleSaveNodeEdit = () => {
    if (!editingNode || !plan) return;

    const now = new Date();
    
    const updateNode = (nodes: PlanNode[]): PlanNode[] => {
      return nodes.map((node) => {
        if (node.id === editingNode.id) {
          return {
            ...node,
            title: editTitle,
            description: editDescription,
            status: editStatus,
            updatedAt: now,
          };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };

    setPlan({
      ...plan,
      rootNodes: updateNode(plan.rootNodes),
      updatedAt: now,
    });

    setEditingNode(null);
  };

  const handleCancelNodeEdit = () => {
    setEditingNode(null);
  };

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
      // Build context-aware prompt with better instructions for multiple steps and branching
      let systemPrompt = `You are an expert planning assistant helping users build hierarchical project plans with intelligent branching.

Current state:
${plan ? `- Plan exists: "${plan.title}"
- End Goal: ${plan.context.endGoal}
- Starting Point: ${plan.context.startingPoint}
- Current steps: ${plan.rootNodes.length} root nodes
${plan.rootNodes.length > 0 ? `\nExisting nodes:\n${JSON.stringify(plan.rootNodes.map(n => ({ id: n.id, title: n.title, status: n.status, children: n.children.map(c => ({ id: c.id, title: c.title, status: c.status })) })), null, 2)}` : ''}` : '- No plan created yet'}

CRITICAL PLANNING PRINCIPLES:
1. **Think in layers**: Break down the journey from starting point to end goal into logical phases
2. **Identify parallel work**: When multiple tasks can happen simultaneously, create branches (same parentId)
3. **Sequential dependencies**: When one step must complete before another, use different phases
4. **Avoid linear chains**: Don't just create A→B→C→Goal. Think about what can happen in parallel
5. **Natural grouping**: Group related tasks that serve a common sub-goal

EXAMPLES OF GOOD PLANNING:

Bad (linear): Start → Step1 → Step2 → Step3 → Goal
Good (branched): Start → [Development, Marketing, Legal] (parallel) → Integration → Goal

Bad (everything sequential): Design → Code → Test → Deploy
Good (phases with branches): 
  Design phase → [Frontend Dev, Backend Dev, Database] (parallel) → Integration Testing → Deployment

When suggesting multiple steps:
- Identify which tasks are independent and can run in parallel
- Use the same parentId for all parallel tasks
- Create logical groupings (e.g., all "research" tasks, all "development" tasks)
- Think about dependencies: what MUST happen before what else can start

Format your response as:
1. Natural language explanation showing your reasoning about phases and branches
2. A JSON block with the structure below

**For creating a new plan:**
\`\`\`json
{
  "action": "create_plan",
  "data": {
    "title": "plan title",
    "endGoal": "the end goal",
    "startingPoint": "the starting point"
  }
}
\`\`\`

**For adding MULTIPLE steps with smart branching:**
\`\`\`json
{
  "action": "add_steps",
  "data": {
    "steps": [
      {
        "tempId": "step1",
        "title": "Research phase",
        "description": "Gather information",
        "parentId": null
      },
      {
        "tempId": "step2",
        "title": "Market research",
        "description": "Parallel task 1",
        "parentId": "step1"
      },
      {
        "tempId": "step3",
        "title": "Technical research",
        "description": "Parallel task 2",
        "parentId": "step1"
      },
      {
        "tempId": "step4",
        "title": "Legal research",
        "description": "Parallel task 3",
        "parentId": "step1"
      }
    ]
  }
}
\`\`\`

**CRITICAL**: When creating steps that reference each other:
- Give each step a unique "tempId" (e.g., "step1", "step2", "research", "dev")
- Reference parent steps using their tempId in the "parentId" field
- Steps with "parentId": null are root nodes
- Steps with "parentId": "step1" will be children of the step with tempId "step1"

**For updating status:**
\`\`\`json
{
  "action": "update_status",
  "data": {
    "nodeId": "node-id",
    "status": "pending" | "in-progress" | "completed" | "blocked"
  }
}
\`\`\`

IMPORTANT: 
- When user asks for a plan, suggest 3-5 major phases/areas
- For each phase, suggest 2-4 specific tasks that can run in parallel
- Explain WHY tasks are parallel vs sequential
- Use "add_steps" action with ALL steps in one response

User request: ${userMessage.content}`;

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: systemPrompt,
          messages: messages.slice(-5).map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp.toISOString() })),
          settings: {
            model: 'gpt-4o',
            maxIterations: 1,
            contextWindowSize: 8000,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText || 'Unknown error'}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Split by double newline to get complete SSE messages
          const sseMessages = buffer.split('\n\n');
          buffer = sseMessages.pop() || '';

          for (const sseMsg of sseMessages) {
            const lines = sseMsg.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const data = JSON.parse(jsonStr);
                
                // Handle error events from the stream
                if (data.error || data.type === 'error') {
                  const errorMsg = data.error || data.message || 'An error occurred';
                  console.error('Stream error:', errorMsg);
                  
                  // Show error to user
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                      newMessages[newMessages.length - 1] = { 
                        ...lastMsg, 
                        content: `⚠️ Error: ${errorMsg}\n\nPlease check that:\n1. OPENAI_API_KEY is set in your environment\n2. The API key is valid\n3. You have sufficient API credits` 
                      };
                    } else {
                      newMessages.push({ 
                        id: generateId(), 
                        role: 'assistant', 
                        content: `⚠️ Error: ${errorMsg}\n\nPlease check that:\n1. OPENAI_API_KEY is set in your environment\n2. The API key is valid\n3. You have sufficient API credits`,
                        timestamp: new Date() 
                      });
                    }
                    return newMessages;
                  });
                  setIsLoading(false);
                  return; // Stop processing
                }
                
                if (data.type === 'output_text_delta' && data.data?.delta) {
                  assistantMessage += data.data.delta;
                  
                  // Update message display in real-time
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                      newMessages[newMessages.length - 1] = { ...lastMsg, content: assistantMessage };
                    } else {
                      newMessages.push({ 
                        id: generateId(), 
                        role: 'assistant', 
                        content: assistantMessage, 
                        timestamp: new Date() 
                      });
                    }
                    return newMessages;
                  });
                } else if (data.type === 'raw_model_stream_event' && data.data?.type === 'output_text_delta' && data.data.delta) {
                  assistantMessage += data.data.delta;
                  
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                      newMessages[newMessages.length - 1] = { ...lastMsg, content: assistantMessage };
                    } else {
                      newMessages.push({ 
                        id: generateId(), 
                        role: 'assistant', 
                        content: assistantMessage, 
                        timestamp: new Date() 
                      });
                    }
                    return newMessages;
                  });
                }
              } catch (err) {
                // Skip malformed JSON
                console.warn('Skipped malformed JSON:', jsonStr.substring(0, 100));
              }
            }
          }
        }
      }

      // Parse AI response and update plan
      if (assistantMessage) {
        // Extract JSON block from markdown code fence
        const jsonBlockMatch = assistantMessage.match(/```json\s*([\s\S]*?)\s*```/);
        let planUpdate = null;

        if (jsonBlockMatch) {
          try {
            planUpdate = JSON.parse(jsonBlockMatch[1]);
          } catch (e) {
            console.error('Failed to parse JSON block:', e);
          }
        }

        // Fallback: try to find raw JSON object
        if (!planUpdate) {
          const jsonMatch = assistantMessage.match(/\{\s*"action"\s*:\s*"[^"]+"\s*,\s*"data"\s*:\s*\{[\s\S]*?\}\s*\}/);
          if (jsonMatch) {
            try {
              planUpdate = JSON.parse(jsonMatch[0]);
            } catch (e) {
              console.error('Failed to parse raw JSON:', e);
            }
          }
        }

        // Apply plan update if found
        if (planUpdate && planUpdate.action && planUpdate.data) {
          console.log('Applying plan update:', planUpdate);
          updatePlan(planUpdate);
        }

        // Ensure assistant message is finalized
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (!lastMsg || lastMsg.role !== 'assistant') {
            newMessages.push({ 
              id: generateId(), 
              role: 'assistant', 
              content: assistantMessage, 
              timestamp: new Date() 
            });
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        { 
          id: generateId(), 
          role: 'assistant', 
          content: `Error: ${error instanceof Error ? error.message : 'Failed to process request'}`, 
          timestamp: new Date() 
        },
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
      // Single step addition
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
    } else if (planUpdate.action === 'add_steps' && planUpdate.data?.steps && Array.isArray(planUpdate.data.steps) && plan) {
      // Multiple steps addition with ID mapping
      // Create a map from temporary IDs (from AI) to actual generated IDs
      const idMap: { [key: string]: string } = {};
      
      // First pass: create all nodes and build ID map
      const newNodes: PlanNode[] = planUpdate.data.steps.map((stepData: any, index: number) => {
        const actualId = generateId();
        // If the step has a tempId or we can use index as temp ID
        const tempId = stepData.tempId || stepData.id || `temp-${index}`;
        idMap[tempId] = actualId;
        
        return {
          id: actualId,
          title: stepData.title || 'New Step',
          description: stepData.description,
          status: 'pending',
          parentId: stepData.parentId || null, // Will be remapped in second pass
          children: [],
          createdAt: now,
          updatedAt: now,
          tempId: tempId, // Keep track for second pass
        } as PlanNode & { tempId: string };
      });

      // Second pass: remap parentIds from temp IDs to actual IDs
      newNodes.forEach((node: any) => {
        if (node.parentId && idMap[node.parentId]) {
          node.parentId = idMap[node.parentId];
        }
        // Remove tempId as it's no longer needed
        delete node.tempId;
      });

      // Group nodes by parentId for efficient insertion
      const rootNewNodes = newNodes.filter(n => !n.parentId);
      const childNewNodes = newNodes.filter(n => n.parentId);

      // Start with adding root nodes
      let updatedRootNodes = [...plan.rootNodes, ...rootNewNodes];

      // Add child nodes to their parents (within newly created nodes)
      if (childNewNodes.length > 0) {
        // First, try to attach to newly created nodes
        const attachToNewNodes = (nodes: PlanNode[]): PlanNode[] => {
          return nodes.map((node) => {
            const childrenForThisNode = childNewNodes.filter(child => child.parentId === node.id);
            
            if (childrenForThisNode.length > 0) {
              return { 
                ...node, 
                children: [...node.children, ...childrenForThisNode],
                updatedAt: now 
              };
            }
            
            return node;
          });
        };

        updatedRootNodes = attachToNewNodes(updatedRootNodes);

        // Then, try to attach remaining to existing nodes in the tree
        const remainingChildren = childNewNodes.filter(child => {
          // Check if this child was already attached
          const findInNodes = (nodes: PlanNode[]): boolean => {
            for (const node of nodes) {
              if (node.children.some(c => c.id === child.id)) return true;
              if (findInNodes(node.children)) return true;
            }
            return false;
          };
          return !findInNodes(updatedRootNodes);
        });

        if (remainingChildren.length > 0) {
          const addChildrenToExisting = (nodes: PlanNode[]): PlanNode[] => {
            return nodes.map((node) => {
              const childrenForThisNode = remainingChildren.filter(child => child.parentId === node.id);
              
              if (childrenForThisNode.length > 0) {
                return { 
                  ...node, 
                  children: [...node.children, ...childrenForThisNode],
                  updatedAt: now 
                };
              }
              
              if (node.children.length > 0) {
                return { ...node, children: addChildrenToExisting(node.children) };
              }
              
              return node;
            });
          };

          updatedRootNodes = addChildrenToExisting(updatedRootNodes);
        }
      }

      console.log('Updated plan with new nodes:', { rootNewNodes: rootNewNodes.length, childNewNodes: childNewNodes.length, total: updatedRootNodes.length });
      setPlan({ ...plan, rootNodes: updatedRootNodes, updatedAt: now });
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
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#111827', margin: 0 }}>
            📋 {plan?.title || 'Plan Builder'}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0 0' }}>
            {plan ? 'Manage your plan with AI assistance' : 'Define your end goal and starting point to create a plan'}
          </p>
        </div>
        {plan && (
          <button
            onClick={handleClearPlan}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            🗑️ Clear Plan
          </button>
        )}
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

      {/* Node editing modal */}
      {editingNode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleCancelNodeEdit}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 500,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#111827' }}>
              Edit Node
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                Title
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 14,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 14,
                  outline: 'none',
                }}
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelNodeEdit}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  backgroundColor: '#fff',
                  color: '#374151',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNodeEdit}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
