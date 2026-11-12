// A small "is the agent actually alive" signal, driven by the same real
// health check useAgentHealth() already proves against /healthz — not a
// hardcoded "online" label. The pulse only plays while genuinely healthy;
// degraded/down states get a solid (non-pulsing) warning/error dot instead,
// so the animation itself carries meaning rather than just decorating.
"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { m, useReducedMotion } from "framer-motion";

import { useAgentHealth } from "@/hooks/useAgentHealth";
import { EMERALD } from "@/lib/theme";

const STATUS_COPY: Record<string, { label: string; color: string; pulsing: boolean }> = {
  ok: { label: "Agent online", color: EMERALD, pulsing: true },
  degraded: { label: "Agent degraded", color: "#fab219", pulsing: false },
  down: { label: "Agent offline", color: "#d03b3b", pulsing: false },
  pending: { label: "Checking…", color: "rgba(255,255,255,0.5)", pulsing: false },
};

interface AgentOnlineBadgeProps {
  dark?: boolean;
}

export function AgentOnlineBadge({ dark = true }: AgentOnlineBadgeProps) {
  const { status } = useAgentHealth();
  const prefersReducedMotion = useReducedMotion();
  const copy = STATUS_COPY[status] ?? STATUS_COPY.pending;

  return (
    <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.75 }}>
      <Box sx={{ position: "relative", width: 10, height: 10 }}>
        {copy.pulsing && !prefersReducedMotion && (
          <m.span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: copy.color,
              display: "block",
            }}
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: [0.6, 0, 0.6], scale: [1, 2.4, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <Box sx={{ position: "absolute", inset: 0, borderRadius: "50%", bgcolor: copy.color }} />
      </Box>
      <Typography
        variant="caption"
        sx={{ color: dark ? "rgba(255,255,255,0.92)" : "text.secondary", fontWeight: 600 }}
      >
        {copy.label}
      </Typography>
    </Stack>
  );
}
