export type ApprovalContext = {
  action: string;                 // z. B. 'AI_ESTIMATE_APPLY'
  reason: string;                 // Menschlich lesbarer Hinweis
  metadata?: Record<string, unknown>;
  userId?: string | number;
};

export type ApprovalEvent = ApprovalContext & {
  approved: boolean;
  timestamp: string;              // ISO-String
};

async function logApprovalEvent(event: ApprovalEvent): Promise<void> {
  try {
    await fetch('/api/audit/approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch {
    // Non-blocking: falls Backend-Endpoint noch nicht existiert
    // eslint-disable-next-line no-console
    console.warn('[approval] audit log failed (non-blocking)', event);
  }
}

/**
 * Fordert eine menschliche Bestätigung ein.
 * Gibt true zurück, wenn freigegeben; false bei Abbruch.
 * In beiden Fällen wird ein Audit-Event geschrieben (best effort).
 */
export async function requireHumanApproval(ctx: ApprovalContext): Promise<boolean> {
  let approved = true;

  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    const message =
      `Bitte bestätigen:\n\n${ctx.reason}\n\n` +
      `Hinweis: Diese Aktion basiert auf einem KI/Score-Vorschlag und erfordert Ihre Freigabe.`;
    approved = window.confirm(message);
  }

  await logApprovalEvent({
    ...ctx,
    approved,
    timestamp: new Date().toISOString(),
  });

  return approved;
}

import { complianceConfig, ComplianceGate } from "../config/compliance";

export async function shouldRequireApproval(gate: ComplianceGate): Promise<boolean> {
  return Boolean(complianceConfig.requireHumanApproval && complianceConfig.gates[gate]);
}

export async function withApproval<T>(
  gate: ComplianceGate,
  ctx: Omit<ApprovalContext, "action"> & { action?: string },
  fn: () => Promise<T> | T
): Promise<T | undefined> {
  const need = await shouldRequireApproval(gate);
  if (need) {
    const ok = await requireHumanApproval({
      action: ctx.action ?? gate.toString().toUpperCase(),
      reason: ctx.reason,
      metadata: ctx.metadata,
      userId: ctx.userId,
    });
    if (!ok) return undefined;
  }
  return await fn();
}