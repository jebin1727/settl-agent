// Shared between ActivityTimeline (Agent Activity page, plain list) and
// LiveOperationsFeed (Command Center, step-sequence framing) — same real
// audit_log rows, two presentations. Keeping the label/summary logic in
// one place means a new action type only needs handling once.
import type { AuditLogDTO } from "@/types/api";

export const ACTION_LABEL: Record<string, string> = {
  settlement_created: "Settlement created",
  payout_sent: "Provider paid out",
  payout_failed: "Payout failed",
  invoice_sent: "Invoice sent",
  invoice_create_failed: "Invoice creation failed",
  invoice_send_failed: "Invoice send failed",
  dispute_triaged: "Dispute triaged",
};

export const ACTOR_COLOR: Record<string, "default" | "primary" | "secondary"> = {
  settlement_service: "primary",
  dispute_service: "secondary",
};

// Which domain an action belongs to — drives the Agent Activity page's
// settlement/dispute filter and the Command Center feed's icon choice.
export function actionDomain(action: string): "settlement" | "dispute" {
  return action.startsWith("dispute") ? "dispute" : "settlement";
}

export function summarizeAuditEntry(entry: AuditLogDTO): string {
  const d = entry.details;
  if (entry.action === "settlement_created") {
    return `$${d.gross_amount} — ${d.description ?? ""}`;
  }
  if (entry.action === "payout_sent") {
    return `$${d.provider_amount} via PayPal Payout ${d.payout_batch_id} (${d.batch_status})`;
  }
  if (entry.action === "payout_failed") {
    return `${d.error ?? "Unknown error"}`;
  }
  if (entry.action === "invoice_sent") {
    return `PayPal invoice ${d.invoice_id}`;
  }
  if (entry.action === "dispute_triaged") {
    return `risk ${d.risk_score} → ${d.decision} (${d.status})`;
  }
  return JSON.stringify(d);
}
