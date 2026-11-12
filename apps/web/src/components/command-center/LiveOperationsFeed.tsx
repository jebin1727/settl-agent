// "Show them an AI agent actually working" — the same real audit_logs
// ActivityTimeline shows as a plain list, framed instead as a sequence of
// steps the agent just took. Real data, different presentation: no action
// here is invented, each row is a genuine persisted audit_log entry.
"use client";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { m } from "framer-motion";
import type { ReactNode } from "react";

import { useAuditLogs } from "@/hooks/useAuditLogs";
import { ACTION_LABEL, summarizeAuditEntry } from "@/lib/auditSummary";
import { EMERALD } from "@/lib/theme";
import type { AuditLogDTO } from "@/types/api";

const ACTION_ICON: Record<string, ReactNode> = {
  settlement_created: <ReceiptLongOutlinedIcon fontSize="small" />,
  payout_sent: <PaymentsOutlinedIcon fontSize="small" />,
  payout_failed: <ErrorOutlineIcon fontSize="small" />,
  dispute_triaged: <GavelOutlinedIcon fontSize="small" />,
};

const ACTION_COLOR: Record<string, string> = {
  settlement_created: "#2a78d6",
  payout_sent: "#0ca30c",
  payout_failed: "#d03b3b",
  dispute_triaged: "#6250d6",
};

function StepRow({ entry, index, isLast }: { entry: AuditLogDTO; index: number; isLast: boolean }) {
  const color = ACTION_COLOR[entry.action] ?? "#5B6B66";
  return (
    <m.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
    >
      <Stack sx={{ flexDirection: "row", gap: 1.5 }}>
        <Stack sx={{ alignItems: "center", flexShrink: 0 }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              bgcolor: `${color}1F`,
              color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {ACTION_ICON[entry.action] ?? <CheckCircleOutlineIcon fontSize="small" />}
          </Box>
          {!isLast && <Box sx={{ flexGrow: 1, width: "1px", bgcolor: "rgba(11,43,59,0.12)", my: 0.5 }} />}
        </Stack>
        <Box sx={{ pb: isLast ? 0 : 2.5, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {ACTION_LABEL[entry.action] ?? entry.action}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", wordBreak: "break-word" }}>
            {summarizeAuditEntry(entry)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(entry.created_at).toLocaleTimeString()}
          </Typography>
        </Box>
      </Stack>
    </m.div>
  );
}

export function LiveOperationsFeed({ limit = 6 }: { limit?: number }) {
  const { data, isLoading } = useAuditLogs();
  const entries = (data ?? []).slice(0, limit);

  return (
    <Stack spacing={1.5}>
      <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: EMERALD }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: "0.04em" }}>
          LIVE OPERATIONS
        </Typography>
      </Stack>

      {isLoading && (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={52} />
          ))}
        </Stack>
      )}

      {!isLoading && entries.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No agent operations yet — create a settlement or triage a dispute to see it here.
        </Typography>
      )}

      {entries.map((entry, i) => (
        <StepRow key={entry.id} entry={entry} index={i} isLast={i === entries.length - 1} />
      ))}
    </Stack>
  );
}
