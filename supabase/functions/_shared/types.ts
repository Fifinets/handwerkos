export interface ToolCallLog {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  ts: string;
}
