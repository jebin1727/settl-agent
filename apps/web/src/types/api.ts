// Hand-written to mirror services/agent/src/schemas/*. SA-Arch.md's shared-types
// package is where this would get OpenAPI-generated from eventually — kept
// hand-written for now since the surface is still small and moving fast.

export type SettlementStatus = "pending" | "paid_out" | "payout_failed" | "failed";

export interface SettlementDTO {
  id: string;
  gross_amount: string;
  platform_fee_amount: string;
  provider_amount: string;
  status: SettlementStatus;
  paypal_payout_batch_id: string | null;
  created_at: string;
}

export interface CreateSettlementRequest {
  gross_amount: string;
  platform_fee_percent: string;
  recipient_email: string;
  description: string;
}

export type DisputeStatus = "open" | "auto_resolved" | "escalated" | "closed";
export type DisputeDecision = "accept_claim" | "refund" | "escalate";

export interface DisputeDTO {
  id: string;
  paypal_dispute_id: string;
  status: DisputeStatus;
  risk_score: string | null;
  decision: DisputeDecision | null;
  rationale: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type SimulatedDisputeReason =
  | "ITEM_NOT_RECEIVED"
  | "SIGNIFICANTLY_NOT_AS_DESCRIBED"
  | "UNAUTHORIZED_TRANSACTION"
  | "MERCHANDISE_OR_SERVICE_NOT_RECEIVED";

export interface SimulateDisputeRequest {
  reason: SimulatedDisputeReason;
  amount: string;
  currency_code?: string;
  note?: string;
}

export interface DisputeTriageResult {
  dispute_id: string;
  risk_score: string;
  decision: "accept_claim" | "escalate";
  rationale: string;
  status: "auto_resolved" | "escalated";
}

export interface AuditLogDTO {
  id: string;
  request_id: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}
