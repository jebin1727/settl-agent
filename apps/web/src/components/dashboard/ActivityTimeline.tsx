// Surfaces audit_logs — every meaningful action any service took, in order.
// This is the "make the AI legible" piece extended beyond just dispute
// rationale: settlement creation, invoice sends, failures, all traceable by
// the same request_id the backend's structured logs use (SA-Arch.md §9).
"use client";

import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { useAuditLogs } from "@/hooks/useAuditLogs";
import type { AuditLogDTO } from "@/types/api";

const ACTION_LABEL: Record<string, string> = {
  settlement_created: "Settlement created",
  invoice_sent: "Invoice sent",
  invoice_create_failed: "Invoice creation failed",
  invoice_send_failed: "Invoice send failed",
  dispute_triaged: "Dispute triaged",
};

const ACTOR_COLOR: Record<string, "default" | "primary" | "secondary"> = {
  settlement_service: "primary",
  dispute_service: "secondary",
};

function summarize(entry: AuditLogDTO): string {
  const d = entry.details;
  if (entry.action === "settlement_created") {
    return `$${d.gross_amount} — ${d.description ?? ""}`;
  }
  if (entry.action === "invoice_sent") {
    return `PayPal invoice ${d.invoice_id}`;
  }
  if (entry.action === "dispute_triaged") {
    return `risk ${d.risk_score} → ${d.decision} (${d.status})`;
  }
  return JSON.stringify(d);
}

export function ActivityTimeline() {
  const { data, isLoading } = useAuditLogs();
  const entries = data ?? [];

  if (!isLoading && entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No agent activity yet — create a settlement or triage a dispute to see it here.
      </Typography>
    );
  }

  return (
    <List dense disablePadding>
      {entries.map((entry) => (
        <ListItem key={entry.id} divider sx={{ py: 1 }}>
          <ListItemText
            primary={
              <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
                <Chip
                  label={entry.actor.replace("_", " ")}
                  size="small"
                  color={ACTOR_COLOR[entry.actor] ?? "default"}
                  variant="outlined"
                />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {ACTION_LABEL[entry.action] ?? entry.action}
                </Typography>
              </Stack>
            }
            secondary={
              <>
                {summarize(entry)} · {new Date(entry.created_at).toLocaleString()}
              </>
            }
          />
        </ListItem>
      ))}
    </List>
  );
}
