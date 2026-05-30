// Shared types for the agent-router edge function.
// Reconstructed during Task 1.1 after MCP-sync (Task 0.1) did not return this file.

export type AgentType = 'offers' | 'invoices' | 'planning' | 'materials';

export type TriggerType = 'user' | 'heartbeat' | 'email';

export interface IntentClassification {
  agent: AgentType;
  action: string;
  entities: Record<string, unknown>;
}

export type EmailCategory = 'Anfrage' | 'Auftrag' | 'Rechnung';

export interface EmailRouterRequest {
  trigger: 'email';
  emailId: string;
  category: EmailCategory;
  companyId: string;
  extractedData?: Record<string, unknown>;
}

export type RouterRequest =
  | { trigger: 'heartbeat'; agent: AgentType; action: string; payload?: Record<string, unknown>; companyId: string }
  | EmailRouterRequest
  | { trigger?: 'user'; message: string };
