/**
 * Planning data structures for the planning agent
 * Supports hierarchical, expandable planning with sub-plans and branches
 */

/**
 * Represents a single node in the plan hierarchy
 * Each node can be expanded into sub-nodes or branch into multiple parallel tracks
 */
export interface PlanNode {
  /** Unique identifier for this node */
  id: string;
  
  /** Title/summary of this plan step */
  title: string;
  
  /** Detailed description of what needs to be done */
  description?: string;
  
  /** Current status of this node */
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  
  /** Parent node ID (null for root nodes) */
  parentId: string | null;
  
  /** Child nodes (sub-steps or branches) */
  children: PlanNode[];
  
  /** Timestamp when this node was created */
  createdAt: Date;
  
  /** Timestamp when this node was last updated */
  updatedAt: Date;
  
  /** Optional metadata for additional context */
  metadata?: Record<string, any>;
}

/**
 * Context information for the planning session
 * Stores the current state and position within the plan
 */
export interface PlanContext {
  /** The current node being worked on */
  currentNodeId: string | null;
  
  /** User's defined end goal */
  endGoal: string;
  
  /** User's defined starting point */
  startingPoint: string;
  
  /** Additional context notes or constraints */
  notes?: string;
  
  /** Timestamp of last activity */
  lastActivityAt: Date;
}

/**
 * Complete plan structure including nodes and context
 */
export interface Plan {
  /** Unique identifier for this plan */
  id: string;
  
  /** Plan title */
  title: string;
  
  /** Root nodes of the plan (typically one, but can support multiple) */
  rootNodes: PlanNode[];
  
  /** Current context and state */
  context: PlanContext;
  
  /** Chat history associated with this plan */
  chatHistory: ChatMessage[];
  
  /** Timestamp when plan was created */
  createdAt: Date;
  
  /** Timestamp when plan was last modified */
  updatedAt: Date;
}

/**
 * Chat message structure for plan-related conversations
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system';
  
  /** Message content */
  content: string;
  
  /** Associated plan node ID if applicable */
  nodeId?: string;
  
  /** Timestamp when message was sent */
  timestamp: Date;
}

/**
 * Stored versions of the interfaces for persistence
 * (Dates stored as ISO strings)
 */
export interface StoredPlanNode extends Omit<PlanNode, 'createdAt' | 'updatedAt' | 'children'> {
  createdAt: string;
  updatedAt: string;
  children: StoredPlanNode[];
}

export interface StoredPlanContext extends Omit<PlanContext, 'lastActivityAt'> {
  lastActivityAt: string;
}

export interface StoredChatMessage extends Omit<ChatMessage, 'timestamp'> {
  timestamp: string;
}

export interface StoredPlan extends Omit<Plan, 'rootNodes' | 'context' | 'chatHistory' | 'createdAt' | 'updatedAt'> {
  rootNodes: StoredPlanNode[];
  context: StoredPlanContext;
  chatHistory: StoredChatMessage[];
  createdAt: string;
  updatedAt: string;
}
