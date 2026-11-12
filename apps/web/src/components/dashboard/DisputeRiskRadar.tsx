// Replaces DisputeRiskStrip: the same "why did this dispute land here"
// signal, as a 5-axis radar instead of a 1-D strip. The 5 axes are real —
// the same risk-assessment LLM call that produces risk_score/reasoning is
// asked to also break its view into these 5 named factors (see
// DisputeRiskAssessment in services/agent/src/schemas/dispute_dto.py) and
// they're persisted on the dispute row. Disputes triaged before this
// column existed have risk_breakdown: null and fall back honestly — see
// EmptyState — rather than showing fabricated values.
"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { m, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import type { DisputeDTO, RiskBreakdown } from "@/types/api";

const TEAL = "#0f8f87";
const TEAL_FILL = "rgba(15,143,135,0.22)";
const GRID_COLOR = "#D8DEDA";
const AXIS_LABEL_COLOR = "#5B6B66";

// Mirrors AUTO_RESOLVE_THRESHOLD in services/agent/src/services/dispute_service.py —
// the Low/Medium boundary isn't arbitrary, it's the agent's own cutoff.
const LOW_MEDIUM_THRESHOLD = 0.3;
const MEDIUM_HIGH_THRESHOLD = 0.6;

// SIZE is wider than 2*RADIUS on purpose — leaves margin for the axis
// labels (e.g. "Merchant" at the leftmost vertex) so they don't clip
// against the SVG's own edge, confirmed live at viewBox width 220.
const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 80;
const RING_COUNT = 4;

const AXES: { key: keyof RiskBreakdown; label: string }[] = [
  { key: "fraud_risk", label: "Fraud" },
  { key: "policy_risk", label: "Policy" },
  { key: "chargeback_risk", label: "Chargeback" },
  { key: "identity_risk", label: "Identity" },
  { key: "merchant_risk", label: "Merchant" },
];

function axisPoint(index: number, fraction: number) {
  const angle = (-90 + index * (360 / AXES.length)) * (Math.PI / 180);
  return { x: CENTER + RADIUS * fraction * Math.cos(angle), y: CENTER + RADIUS * fraction * Math.sin(angle) };
}

function riskCategory(score: number): { label: string; color: "success" | "warning" | "error" } {
  if (score < LOW_MEDIUM_THRESHOLD) return { label: "Low", color: "success" };
  if (score < MEDIUM_HIGH_THRESHOLD) return { label: "Medium", color: "warning" };
  return { label: "High", color: "error" };
}

interface LatestWithBreakdown extends DisputeDTO {
  risk_breakdown: RiskBreakdown;
}

function hasBreakdown(d: DisputeDTO): d is LatestWithBreakdown {
  return d.risk_breakdown !== null && d.risk_score !== null;
}

export function DisputeRiskRadar({ disputes }: { disputes: DisputeDTO[] }) {
  const prefersReducedMotion = useReducedMotion();
  // Deferred to a post-mount effect, not a lazy useState initializer —
  // Next's Cache Components prerendering forbids non-deterministic calls
  // like Date.now() during the server-side render pass. `now` is briefly
  // null during that initial render; the trend falls back to its "not
  // enough history" state until the client-side effect fills it in.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // requestAnimationFrame (not a direct setState call) keeps this
    // asynchronous relative to the effect body itself — calling setState
    // synchronously inside an effect trips react-hooks/set-state-in-effect.
    const id = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(id);
  }, []);

  const latest = useMemo(() => {
    const withBreakdown = disputes.filter(hasBreakdown);
    if (withBreakdown.length === 0) return null;
    return [...withBreakdown].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [disputes]);

  // "vs last 7 days": current score against the trailing-week average of
  // every OTHER triaged dispute, excluding `latest` itself. Sparse demo
  // data legitimately has no prior window — shown as "—", not a fake 0%.
  const trend = useMemo(() => {
    if (!latest || now === null) return null;
    const week = 7 * 24 * 60 * 60 * 1000;
    const prior = disputes.filter(
      (d) => d.id !== latest.id && d.risk_score !== null && now - new Date(d.created_at).getTime() <= week
    );
    if (prior.length === 0) return null;
    const priorAvg = prior.reduce((sum, d) => sum + Number(d.risk_score), 0) / prior.length;
    if (priorAvg === 0) return null;
    const current = Number(latest.risk_score);
    return ((current - priorAvg) / priorAvg) * 100;
  }, [disputes, latest, now]);

  if (!latest) {
    return (
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          Dispute risk overview
        </Typography>
        <Typography variant="caption" color="text.secondary">
          No triaged disputes yet.
        </Typography>
      </Stack>
    );
  }

  const score = Number(latest.risk_score);
  const category = riskCategory(score);
  const points = AXES.map((axis, i) => axisPoint(i, latest.risk_breakdown[axis.key]));
  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  // Remounts (and replays the grow-in animation) only when the plotted
  // dispute's own values change — not on every unrelated dashboard refetch.
  const chartKey = `${latest.id}:${AXES.map((a) => latest.risk_breakdown[a.key]).join(",")}`;

  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary">
        Dispute risk overview
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Latest triaged: {latest.paypal_dispute_id}
      </Typography>
      <Stack sx={{ flexDirection: { xs: "column", sm: "row" }, alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ color: "text.secondary", flexShrink: 0 }}>
          <svg key={chartKey} width={SIZE} height={SIZE} role="img" aria-label="Dispute risk radar across five factors">
            <defs>
              <filter id="risk-radar-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {Array.from({ length: RING_COUNT }).map((_, ring) => {
              const fraction = (ring + 1) / RING_COUNT;
              const ringPoints = AXES.map((_, i) => axisPoint(i, fraction))
                .map((p) => `${p.x},${p.y}`)
                .join(" ");
              return <polygon key={ring} points={ringPoints} fill="none" stroke={GRID_COLOR} strokeWidth={1} />;
            })}

            {AXES.map((axis, i) => {
              const outer = axisPoint(i, 1);
              const labelPos = axisPoint(i, 1.22);
              return (
                <g key={axis.key}>
                  <line x1={CENTER} y1={CENTER} x2={outer.x} y2={outer.y} stroke={GRID_COLOR} strokeWidth={1} />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill={AXIS_LABEL_COLOR}
                  >
                    {axis.label}
                  </text>
                </g>
              );
            })}

            <m.polygon
              points={polygonPoints}
              fill={TEAL_FILL}
              stroke={TEAL}
              strokeWidth={2}
              strokeLinejoin="round"
              initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />

            {points.map((p, i) => (
              <g key={AXES[i].key}>
                {!prefersReducedMotion && (
                  <m.circle
                    cx={p.x}
                    cy={p.y}
                    r={4}
                    fill={TEAL}
                    initial={{ opacity: 0.6, scale: 1 }}
                    animate={{ opacity: [0.6, 0, 0.6], scale: [1, 2.2, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                  />
                )}
                <circle cx={p.x} cy={p.y} r={4} fill={TEAL} stroke="#FFFFFF" strokeWidth={1.5} filter="url(#risk-radar-glow)">
                  <title>
                    {AXES[i].label}: {(latest.risk_breakdown[AXES[i].key] * 100).toFixed(0)}%
                  </title>
                </circle>
              </g>
            ))}
          </svg>
        </Box>

        <Paper
          variant="outlined"
          sx={{ p: 2, minWidth: 180, flexShrink: 0, alignSelf: { xs: "stretch", sm: "center" } }}
        >
          <Stack spacing={1}>
            <Stack sx={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Risk Score
              </Typography>
              <Chip label={category.label} size="small" color={category.color} variant="outlined" />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {score.toFixed(2)}
            </Typography>
            {trend === null ? (
              <Typography variant="caption" color="text.secondary">
                Not enough history yet for a 7-day trend.
              </Typography>
            ) : (
              <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.5 }}>
                {trend <= 0 ? (
                  <TrendingDownIcon fontSize="small" color="success" />
                ) : (
                  <TrendingUpIcon fontSize="small" color="error" />
                )}
                <Typography variant="body2" sx={{ color: trend <= 0 ? "success.main" : "error.main", fontWeight: 600 }}>
                  {trend > 0 ? "+" : ""}
                  {trend.toFixed(0)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  vs last 7 days
                </Typography>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  );
}
