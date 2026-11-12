// The human-in-the-loop half of the Payment Guardian: settlements it held
// (real rule hits on real history — never a canned score) wait here until
// an operator approves (which is the moment the real PayPal payout fires)
// or rejects (which never pays).
"use client";

import GppMaybeOutlinedIcon from "@mui/icons-material/GppMaybeOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { m } from "framer-motion";
import { useMemo } from "react";

import { useApproveSettlement, useRejectSettlement, useSettlements } from "@/hooks/useSettlements";
import type { SettlementDTO } from "@/types/api";

function HeldSettlementCard({ settlement }: { settlement: SettlementDTO }) {
  const approve = useApproveSettlement();
  const reject = useRejectSettlement();
  const busy = approve.isPending || reject.isPending;
  const error = (approve.error ?? reject.error) as Error | null;

  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Paper variant="outlined" sx={{ p: 2, borderColor: "warning.main" }}>
        <Stack spacing={1.25}>
          <Stack sx={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              ${settlement.gross_amount} → {settlement.recipient_email ?? "unknown recipient"}
            </Typography>
            <Chip label={`Guardian risk ${settlement.risk_score ?? "—"}`} size="small" color="warning" variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {settlement.description} · provider receives ${settlement.provider_amount}
          </Typography>
          <Stack sx={{ flexDirection: "row", gap: 0.75, flexWrap: "wrap" }}>
            {(settlement.risk_flags ?? []).map((flag) => (
              <Chip key={flag.rule} label={`${flag.rule}: ${flag.detail}`} size="small" variant="outlined" />
            ))}
          </Stack>
          {error && <Alert severity="error">{error.message}</Alert>}
          <Stack sx={{ flexDirection: "row", gap: 1 }}>
            <m.div whileTap={{ scale: 0.97 }}>
              <Button variant="contained" size="small" disabled={busy} onClick={() => approve.mutate(settlement.id)}>
                {approve.isPending ? "Paying out…" : "Approve & pay via PayPal"}
              </Button>
            </m.div>
            <m.div whileTap={{ scale: 0.97 }}>
              <Button variant="outlined" color="error" size="small" disabled={busy} onClick={() => reject.mutate(settlement.id)}>
                Reject
              </Button>
            </m.div>
          </Stack>
        </Stack>
      </Paper>
    </m.div>
  );
}

export function ApprovalQueue() {
  const { data } = useSettlements();
  const held = useMemo(() => (data ?? []).filter((s) => s.status === "awaiting_approval"), [data]);

  if (held.length === 0) return null;

  return (
    <Stack spacing={1.5}>
      <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
        <GppMaybeOutlinedIcon color="warning" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Payment Guardian — awaiting your approval ({held.length})
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Held before any money moved. Approving releases the real PayPal payout; rejecting never pays.
      </Typography>
      {held.map((s) => (
        <HeldSettlementCard key={s.id} settlement={s} />
      ))}
    </Stack>
  );
}
