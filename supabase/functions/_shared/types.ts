// Shared types für die Agent-Engine.
// Werte synchron mit der DB-CHECK-Constraints in agent_tasks halten.

export type AgentType = 'offers' | 'invoices' | 'planning' | 'materials';
export type TriggerType = 'user' | 'heartbeat';
export type TaskStatus = 'pending' | 'running' | 'awaiting_approval' | 'done' | 'failed';

export interface IntentClassification {
  agent: AgentType;
  action: string;
  entities: Record<string, unknown>;
}

export interface ToolCallLog {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  ts: string; // ISO 8601
}

export interface AgentTaskRow {
  id: string;
  company_id: string;
  agent_type: AgentType;
  trigger_type: TriggerType;
  status: TaskStatus;
  input: Record<string, unknown>;
  intent: IntentClassification | null;
  tool_calls: ToolCallLog[];
  output: Record<string, unknown> | null;
  error: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface RouterRequestUser {
  trigger?: 'user';
  message: string;
  // companyId/userId are derived from the JWT, NOT from the body
}

export interface RouterRequestHeartbeat {
  trigger: 'heartbeat';
  agent: AgentType;
  action: string;
  payload?: Record<string, unknown>;
  companyId: string;  // service_role caller is trusted
}

export type RouterRequest = RouterRequestUser | RouterRequestHeartbeat;

export interface AgentInvocation {
  taskId: string;
  action: string;
  payload: Record<string, unknown>;
}
