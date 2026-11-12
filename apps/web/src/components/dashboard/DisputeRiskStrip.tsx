// Complements SegmentedBar's "Dispute resolution breakdown" above it: at
// low dispute counts a 0%/100% proportional bar just degenerates into one
// solid block and restates the stat tile above it. This adds the signal
// that bar can't: each triaged dispute's actual risk score plotted against
// the agent's own auto-resolve threshold, so "why" each outcome happened
// is visible, not just "what" happened. Hand-built SVG, dataviz skill
// mark specs (>=8px markers, 2px surface ring, hairline recessive axis).
"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { m } from "framer-motion";
import { useMemo } from "react";

import type { DisputeDTO } from "@/types/api";

// Mirrors AUTO_RESOLVE_THRESHOLD in services/agent/src/services/dispute_service.py.
const THRESHOLD = 0.3;
const STATUS_GOOD = "#0ca30c";
const STATUS_WARNING = "#fab219";
const THRESHOLD_COLOR = "#B06E00";
const AXIS_COLOR = "#D8DEDA";

const VIEW_WIDTH = 560;
const HEIGHT = 86;
const PAD_X = 14;
const TRACK_Y = 44;
const DOT_R = 6;
const STACK_STEP = 15;
const MIN_GAP_PX = 20; // points closer together than this stack vertically instead of overlapping

interface RiskPoint {
  id: string;
  disputeId: string;
  score: number;
  color: string;
  decisionLabel: string;
}

function buildPoints(disputes: DisputeDTO[]): RiskPoint[] {
  return disputes
    .filter((d) => d.risk_score !== null && (d.status === "auto_resolved" || d.status === "escalated"))
    .map((d) => ({
      id: d.id,
      disputeId: d.paypal_dispute_id,
      score: Number(d.risk_score),
      color: d.status === "auto_resolved" ? STATUS_GOOD : STATUS_WARNING,
      decisionLabel: d.status === "auto_resolved" ? "Auto-resolved" : "Escalated",
    }))
    .sort((a, b) => a.score - b.score);
}

export function DisputeRiskStrip({ disputes }: { disputes: DisputeDTO[] }) {
  const points = useMemo(() => buildPoints(disputes), [disputes]);

  const plotWidth = VIEW_WIDTH - PAD_X * 2;
  const xFor = (score: number) => PAD_X + Math.min(Math.max(score, 0), 1) * plotWidth;
  const thresholdX = xFor(THRESHOLD);

  // Points whose x lands within MIN_GAP_PX of the previous one stack
  // upward instead of overlapping — risk scores cluster near the
  // threshold in practice, so this keeps every dot visible and hoverable.
  // A reduce (not a mutable loop) since render bodies must stay pure.
  const placed = points.reduce<{ acc: (RiskPoint & { x: number; y: number })[]; lastX: number; stack: number }>(
    (state, p) => {
      const x = xFor(p.score);
      const stack = x - state.lastX < MIN_GAP_PX ? state.stack + 1 : 0;
      return { acc: [...state.acc, { ...p, x, y: TRACK_Y - stack * STACK_STEP }], lastX: x, stack };
    },
    { acc: [], lastX: -Infinity, stack: 0 }
  ).acc;

  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary">
        Dispute risk overview
      </Typography>

      {points.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No triaged disputes yet.
        </Typography>
      ) : (
        <>
          <Box sx={{ color: "text.secondary" }}>
            <svg
              viewBox={`0 0 ${VIEW_WIDTH} ${HEIGHT}`}
              width="100%"
              height={HEIGHT}
              role="img"
              aria-label="Dispute risk scores against the auto-resolve threshold"
            >
              <line x1={PAD_X} y1={TRACK_Y} x2={VIEW_WIDTH - PAD_X} y2={TRACK_Y} stroke={AXIS_COLOR} strokeWidth={1} />
              <line
                x1={thresholdX}
                y1={8}
                x2={thresholdX}
                y2={HEIGHT - 14}
                stroke={THRESHOLD_COLOR}
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <text x={thresholdX} y={HEIGHT - 2} textAnchor="middle" fontSize={10} fontWeight={600} fill={THRESHOLD_COLOR}>
                auto-resolve &lt; {THRESHOLD}
              </text>
              {placed.map((p, i) => (
                <m.circle
                  key={p.id}
                  cx={p.x}
                  cy={p.y}
                  r={DOT_R}
                  fill={p.color}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 + i * 0.05, duration: 0.3, ease: "easeOut" }}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                >
                  <title>
                    {p.disputeId}: risk {p.score.toFixed(2)} — {p.decisionLabel}
                  </title>
                </m.circle>
              ))}
            </svg>
          </Box>
          <Stack sx={{ flexDirection: "row", gap: 2, flexWrap: "wrap" }}>
            <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: STATUS_GOOD }} />
              <Typography variant="caption" color="text.secondary">
                Auto-resolved
              </Typography>
            </Stack>
            <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: STATUS_WARNING }} />
              <Typography variant="caption" color="text.secondary">
                Escalated
              </Typography>
            </Stack>
          </Stack>
        </>
      )}
    </Stack>
  );
}
