// Shared types for this agent's edge function.
// Reconstructed during Task 1.1 after MCP-sync (Task 0.1) did not return this file.

export interface ToolCallLog {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  ts: string;
}
