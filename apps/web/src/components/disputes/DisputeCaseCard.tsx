// Replaces the plain AG Grid table: each real dispute as an actionable
// case card (amount, reason, risk, status, the agent's own confidence and
// recommendation) instead of a dense row. All fields come straight from
// DisputeDTO — nothing here is invented when a dispute predates a column
// (amount/reason/risk_breakdown all show an honest "—" rather than a
// fabricated value).
"use client";

import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { m } from "framer-motion";

import { StatusBadge } from "@/components/common/StatusBadge";
import type { DisputeDTO } from "@/types/api";

const REASON_LABEL: Record<string, string> = {
  ITEM_NOT_RECEIVED: "Item not received",
  SIGNIFICANTLY_NOT_AS_DESCRIBED: "Significantly not as described",
  UNAUTHORIZED_TRANSACTION: "Unauthorized transaction",
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Merchandise/service not received",
};

function formatAmount(dispute: DisputeDTO): string {
  if (dispute.amount === null) return "—";
  const currency = dispute.currency_code ?? "USD";
  return `${currency} ${Number(dispute.amount).toFixed(2)}`;
}

export function DisputeCaseCard({ dispute, onViewReplay }: { dispute: DisputeDTO; onViewReplay: () => void }) {
  const confidencePct = dispute.risk_score !== null ? Math.round((1 - Number(dispute.risk_score)) * 100) : null;

  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          <Stack sx={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Dispute {dispute.paypal_dispute_id}
            </Typography>
            <StatusBadge status={dispute.status} />
          </Stack>

          <Stack sx={{ flexDirection: "row", gap: 3, flexWrap: "wrap" }}>
            <Stack>
              <Typography variant="caption" color="text.secondary">
                Amount
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {formatAmount(dispute)}
              </Typography>
            </Stack>
            <Stack>
              <Typography variant="caption" color="text.secondary">
                Reason
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {dispute.reason ? (REASON_LABEL[dispute.reason] ?? dispute.reason) : "—"}
              </Typography>
            </Stack>
          </Stack>

          {dispute.rationale && (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Agent investigation
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {dispute.rationale}
              </Typography>
            </Stack>
          )}

          <Stack sx={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
            <Stack sx={{ flexDirection: "row", gap: 1, flexWrap: "wrap" }}>
              {confidencePct !== null && (
                <Chip label={`AI confidence: ${confidencePct}%`} size="small" variant="outlined" />
              )}
              {dispute.status === "escalated" && (
                <Chip label="Escalation recommended" size="small" color="warning" variant="outlined" />
              )}
              {dispute.status === "auto_resolved" && (
                <Chip label="Auto-resolved" size="small" color="success" variant="outlined" />
              )}
            </Stack>
            <m.div style={{ display: "inline-block" }} whileTap={{ scale: 0.97 }}>
              <Button size="small" variant="outlined" onClick={onViewReplay} disabled={!dispute.risk_breakdown && !dispute.rationale}>
                View Decision Replay
              </Button>
            </m.div>
          </Stack>
        </Stack>
      </Paper>
    </m.div>
  );
}
