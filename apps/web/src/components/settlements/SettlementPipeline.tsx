// A horizontal pipeline view, in the spirit of "Received → Verified →
// Processing → Completed" — but using SettlAgent's actual lifecycle
// states, not invented ones. We don't track separate "received"/
// "verified"/"processing" stages server-side, so labeling stages we don't
// have would be fabricating data; this uses only the 4 real statuses
// SettlementStatus supports (see types/api.ts) — including the Payment
// Guardian's awaiting_approval/rejected states.
"use client";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { m } from "framer-motion";
import { useMemo } from "react";

import { useSettlements } from "@/hooks/useSettlements";
import type { SettlementDTO, SettlementStatus } from "@/types/api";

const STAGES: { status: SettlementStatus; label: string; color: string }[] = [
  { status: "pending", label: "Pending", color: "#5B6B66" },
  { status: "awaiting_approval", label: "Awaiting approval", color: "#B06E00" },
  { status: "paid_out", label: "Paid Out", color: "#0ca30c" },
  { status: "payout_failed", label: "Payout Failed", color: "#B06E00" },
  { status: "rejected", label: "Rejected", color: "#8a5a5a" },
  { status: "failed", label: "Failed", color: "#d03b3b" },
];

function countByStatus(rows: SettlementDTO[]) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

export function SettlementPipeline() {
  const { data, isLoading } = useSettlements();
  const counts = useMemo(() => countByStatus(data ?? []), [data]);

  if (isLoading) {
    return <Skeleton variant="rounded" height={88} />;
  }

  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary">
        Settlement pipeline
      </Typography>
      <Stack sx={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: { xs: 1, sm: 0 } }}>
        {STAGES.map((stage, i) => (
          <Stack key={stage.status} sx={{ flexDirection: "row", alignItems: "center" }}>
            <m.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
            >
              <Stack
                sx={{
                  alignItems: "center",
                  justifyContent: "center",
                  width: 108,
                  height: 72,
                  borderRadius: "14px",
                  border: "1px solid rgba(11,43,59,0.12)",
                  bgcolor: "background.paper",
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700, color: stage.color }}>
                  {counts[stage.status] ?? 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stage.label}
                </Typography>
              </Stack>
            </m.div>
            {i < STAGES.length - 1 && (
              <Box sx={{ mx: 1, color: "text.disabled", display: { xs: "none", sm: "block" } }}>
                <ArrowForwardIcon fontSize="small" />
              </Box>
            )}
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
