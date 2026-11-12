"use client";

import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { m } from "framer-motion";
import { useState, type FormEvent } from "react";

import { TableSkeleton } from "@/components/common/TableSkeleton";
import { DisputeCaseCard } from "@/components/disputes/DisputeCaseCard";
import { useDisputes, useSimulateDispute, useTriageDispute } from "@/hooks/useDisputes";
import type { SimulatedDisputeReason } from "@/types/api";

const SIMULATED_REASONS: { value: SimulatedDisputeReason; label: string }[] = [
  { value: "ITEM_NOT_RECEIVED", label: "Item not received" },
  { value: "SIGNIFICANTLY_NOT_AS_DESCRIBED", label: "Significantly not as described" },
  { value: "UNAUTHORIZED_TRANSACTION", label: "Unauthorized transaction" },
  { value: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED", label: "Merchandise/service not received" },
];

function SimulateDisputeForm() {
  const [reason, setReason] = useState<SimulatedDisputeReason>("ITEM_NOT_RECEIVED");
  const [amount, setAmount] = useState("15.00");
  const [note, setNote] = useState("");
  const simulate = useSimulateDispute();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    simulate.mutate({ reason, amount, note: note || undefined });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderColor: "secondary.light", borderWidth: 1.5 }}>
      <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1, mb: 1.5 }}>
        <ScienceOutlinedIcon color="secondary" fontSize="small" />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Simulate a dispute
        </Typography>
        <Chip label="Demo-safe" size="small" color="secondary" variant="outlined" />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Real LLM reasoning, real decision logic, no live PayPal dispute required — nothing here mutates PayPal.
        Every result is tagged <code>simulated</code> in the audit trail.
      </Typography>
      <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 420 }}>
        <TextField select label="Reason" value={reason} onChange={(e) => setReason(e.target.value as SimulatedDisputeReason)} size="small">
          {SIMULATED_REASONS.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Amount (USD)" value={amount} onChange={(e) => setAmount(e.target.value)} size="small" required />
        <TextField
          label="Buyer context (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          size="small"
          multiline
          minRows={2}
          placeholder="e.g. Tracking shows delivered but buyer says it never arrived."
        />
        <m.div style={{ display: "inline-block" }} whileTap={{ scale: 0.97 }}>
          <Button type="submit" variant="outlined" color="secondary" disabled={simulate.isPending}>
            {simulate.isPending ? "Agent is reasoning…" : "Simulate & watch agent decide"}
          </Button>
        </m.div>
        {simulate.isError && <Alert severity="error">{(simulate.error as Error).message}</Alert>}
        {simulate.isSuccess && (
          <Alert severity={simulate.data.status === "auto_resolved" ? "success" : "warning"}>
            {simulate.data.status === "auto_resolved" ? "Auto-resolved" : "Escalated"} — risk{" "}
            {simulate.data.risk_score}. {simulate.data.rationale}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}

interface DisputesPanelProps {
  onViewReplay?: (disputeId: string) => void;
}

export function DisputesPanel({ onViewReplay }: DisputesPanelProps) {
  const { data, isLoading } = useDisputes();
  const triage = useTriageDispute();
  const [disputeId, setDisputeId] = useState("");

  const handleTriage = (event: FormEvent) => {
    event.preventDefault();
    triage.mutate(disputeId);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Disputes
      </Typography>

      <SimulateDisputeForm />

      <Typography variant="h6">Triage a real dispute</Typography>
      <Stack component="form" onSubmit={handleTriage} spacing={2} sx={{ maxWidth: 420 }}>
        <TextField
          label="PayPal dispute ID"
          value={disputeId}
          onChange={(e) => setDisputeId(e.target.value)}
          size="small"
          required
        />
        <Button type="submit" variant="contained" disabled={triage.isPending}>
          {triage.isPending ? "Agent is reasoning…" : "Triage with SettlAgent"}
        </Button>
        {triage.isError && <Alert severity="error">{(triage.error as Error).message}</Alert>}
        {triage.isSuccess && (
          <Alert severity={triage.data.status === "auto_resolved" ? "success" : "warning"}>
            {triage.data.status === "auto_resolved" ? "Auto-resolved" : "Escalated"} — risk{" "}
            {triage.data.risk_score}. {triage.data.rationale}
          </Alert>
        )}
      </Stack>

      <Typography variant="h6">Dispute cases</Typography>
      {isLoading ? (
        <TableSkeleton />
      ) : (data ?? []).length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No disputes yet — triage or simulate one above to see it here.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {(data ?? []).map((dispute) => (
            <DisputeCaseCard
              key={dispute.id}
              dispute={dispute}
              onViewReplay={() => onViewReplay?.(dispute.paypal_dispute_id)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
