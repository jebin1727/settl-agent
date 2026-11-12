// The signature feature: play back a real triage decision as a sequence
// of investigation steps, instead of showing the end result cold. Every
// step is built from fields DisputeDTO already carries — amount, reason,
// risk_breakdown, decision, rationale — nothing synthesized. "Replay"
// replays the *presentation* of a stored decision; it never re-calls the
// LLM or PayPal (that would be a new, real, potentially-costly action, not
// a replay).
"use client";

import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { m, useReducedMotion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";

import { DisputeRiskRadar } from "@/components/dashboard/DisputeRiskRadar";
import { useDisputes } from "@/hooks/useDisputes";
import type { DisputeDTO } from "@/types/api";

const REASON_LABEL: Record<string, string> = {
  ITEM_NOT_RECEIVED: "Item not received",
  SIGNIFICANTLY_NOT_AS_DESCRIBED: "Significantly not as described",
  UNAUTHORIZED_TRANSACTION: "Unauthorized transaction",
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Merchandise/service not received",
};

function hasReplayData(d: DisputeDTO): boolean {
  return d.rationale !== null && d.risk_score !== null;
}

interface Step {
  label: string;
  icon: ReactNode;
  content: ReactNode;
}

function buildSteps(dispute: DisputeDTO): Step[] {
  const amount =
    dispute.amount !== null ? `${dispute.currency_code ?? "USD"} ${Number(dispute.amount).toFixed(2)}` : "—";
  const reason = dispute.reason ? (REASON_LABEL[dispute.reason] ?? dispute.reason) : "—";

  return [
    {
      label: "Transaction retrieved",
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
      content: (
        <Typography variant="body2" color="text.secondary">
          Dispute <strong>{dispute.paypal_dispute_id}</strong> — {amount}, reason: {reason}.
        </Typography>
      ),
    },
    {
      label: "Risk factors assessed",
      icon: <FactCheckOutlinedIcon fontSize="small" />,
      content: dispute.risk_breakdown ? (
        <DisputeRiskRadar disputes={[dispute]} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          This dispute predates per-factor risk breakdowns — only the overall risk score ({dispute.risk_score}) is
          available.
        </Typography>
      ),
    },
    {
      label: "Decision generated",
      icon: <GavelOutlinedIcon fontSize="small" />,
      content: (
        <Stack spacing={1}>
          <Chip
            label={dispute.status === "auto_resolved" ? "Auto-resolved" : "Escalated to human"}
            size="small"
            color={dispute.status === "auto_resolved" ? "success" : "warning"}
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
          />
          <Typography variant="body2" color="text.secondary">
            {dispute.rationale}
          </Typography>
        </Stack>
      ),
    },
  ];
}

function ReplayTimeline({ dispute }: { dispute: DisputeDTO }) {
  const [replayKey, setReplayKey] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const steps = useMemo(() => buildSteps(dispute), [dispute]);

  return (
    <Stack spacing={2.5}>
      <Stack sx={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Decision Replay — {dispute.paypal_dispute_id}
        </Typography>
        <Button
          size="small"
          startIcon={<ReplayIcon />}
          onClick={() => setReplayKey((k) => k + 1)}
        >
          Replay
        </Button>
      </Stack>

      <Stack key={replayKey} spacing={0}>
        {steps.map((step, i) => (
          <m.div
            key={step.label}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.35, ease: "easeOut" }}
          >
            <Stack sx={{ flexDirection: "row", gap: 1.5 }}>
              <Stack sx={{ alignItems: "center", flexShrink: 0 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                    color: "common.white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {i + 1}
                </Box>
                {i < steps.length - 1 && (
                  <Box sx={{ flexGrow: 1, width: "2px", bgcolor: "rgba(11,43,59,0.15)", my: 0.5, minHeight: 24 }} />
                )}
              </Stack>
              <Box sx={{ pb: 3, minWidth: 0, flexGrow: 1 }}>
                <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                  {step.icon}
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {step.label}
                  </Typography>
                </Stack>
                {step.content}
              </Box>
            </Stack>
          </m.div>
        ))}
      </Stack>
    </Stack>
  );
}

interface DecisionReplayPageProps {
  initialDisputeId?: string | null;
}

export function DecisionReplayPage({ initialDisputeId }: DecisionReplayPageProps) {
  const { data, isLoading } = useDisputes();
  const replayable = useMemo(() => (data ?? []).filter(hasReplayData), [data]);
  // Initializer (not an effect) is enough: the parent remounts this
  // component (AnimatePresence keys on `section`) every time navigation
  // sets a new initialDisputeId, so this always picks up the latest one.
  const [selectedId, setSelectedId] = useState<string>(initialDisputeId ?? "");

  const selected = replayable.find((d) => d.paypal_dispute_id === selectedId) ?? replayable[0] ?? null;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Decision Replay
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Explainable AI: step through exactly what the agent checked and why it decided what it decided.
        </Typography>
      </Box>

      {!isLoading && replayable.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No triaged disputes yet — triage or simulate one from the Disputes page first.
        </Typography>
      )}

      {replayable.length > 0 && (
        <Stack spacing={2.5}>
          <TextField
            select
            label="Choose a dispute to replay"
            value={selected?.paypal_dispute_id ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            size="small"
            sx={{ maxWidth: 420 }}
          >
            {replayable.map((d) => (
              <MenuItem key={d.id} value={d.paypal_dispute_id}>
                {d.paypal_dispute_id} — {d.status === "auto_resolved" ? "Auto-resolved" : "Escalated"}
              </MenuItem>
            ))}
          </TextField>

          {selected && (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <ReplayTimeline dispute={selected} />
            </Paper>
          )}
        </Stack>
      )}
    </Stack>
  );
}
