// Settlement gross volume by day — a hand-built SVG line/point chart, same
// philosophy as SegmentedBar (dataviz skill): no charting library, theme
// colors. Line, not bars: references/choosing-a-form.md is explicit that
// "trend over time" defaults to a line (area for a single series), bars
// are for comparing magnitude. Mark specs from marks-and-anatomy.md: 2px
// line, round join/cap, >=8px markers (r>=4), ~10% opacity area wash,
// hairline recessive axis, label only the endpoint.
"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { m } from "framer-motion";
import { useMemo } from "react";

import { useSettlements } from "@/hooks/useSettlements";
import { formatCompactCurrency } from "@/lib/format";
import type { SettlementDTO } from "@/types/api";

export interface DailyVolumePoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Nov 3"
  total: number;
}

// Pure and exported on its own so it's testable without rendering
// anything — grouping is the part of this component worth proving
// correct; SVG layout is proven by the component test instead.
export function aggregateDailyVolume(
  settlements: Pick<SettlementDTO, "created_at" | "gross_amount">[]
): DailyVolumePoint[] {
  const byDay = new Map<string, number>();
  for (const s of settlements) {
    const day = s.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + Number(s.gross_amount));
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({
      date,
      label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      total,
    }));
}

const CHART_HEIGHT = 140;
const TOP_PAD = 28; // room for the endpoint value label above the highest point
const POINT_GAP = 72;
const PAD_X = 10;
const MARKER_R = 5; // >=4 per mark spec (8-10px diameter)
const END_LABEL_PAD = 44; // room for the endpoint value label's right half
const LINE_COLOR = "#1E7A5F"; // brand secondary — same accent OverviewStats uses for "Settlements processed"
const AXIS_COLOR = "#D8DEDA"; // one step off the card surface, recessive

function EmptyState() {
  return (
    <Typography variant="caption" color="text.secondary">
      No data yet.
    </Typography>
  );
}

function SinglePointState({ point }: { point: DailyVolumePoint }) {
  return (
    <Stack spacing={1}>
      <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 2, height: CHART_HEIGHT * 0.5 }}>
        <Box
          sx={{
            width: MARKER_R * 2 + 4,
            height: MARKER_R * 2 + 4,
            borderRadius: "50%",
            bgcolor: LINE_COLOR,
            border: "2px solid",
            borderColor: "background.paper",
            boxShadow: "0 0 0 1px rgba(11,59,46,0.15)",
            flexShrink: 0,
          }}
        />
        <Stack spacing={0.25}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {formatCompactCurrency(point.total)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {point.label}
          </Typography>
        </Stack>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Only one day of data so far — this fills in as more settlements are processed.
      </Typography>
    </Stack>
  );
}

function TrendChart({ points }: { points: DailyVolumePoint[] }) {
  const max = Math.max(...points.map((p) => p.total));
  // Extra right-side room for the endpoint's value label — it's
  // text-anchor:middle on the last point, so its right half extends past
  // that point's x position and would otherwise get clipped by the SVG's
  // own width (SVG content outside its viewport is clipped, same as
  // overflow:hidden).
  const width = PAD_X * 2 + (points.length - 1) * POINT_GAP + END_LABEL_PAD;
  const axisY = CHART_HEIGHT;
  const plotHeight = CHART_HEIGHT - TOP_PAD;
  // Remounts the whole chart (and so restarts the draw-in animation)
  // whenever the underlying day/total pairs actually change — a plain
  // re-render from an unrelated prop wouldn't replay it.
  const chartKey = points.map((p) => `${p.date}:${p.total}`).join("|");

  const coords = points.map((p, i) => ({
    ...p,
    x: PAD_X + i * POINT_GAP,
    y: axisY - (max > 0 ? (p.total / max) * plotHeight : 0),
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${axisY} L${coords[0].x},${axisY} Z`;

  return (
    <Box sx={{ overflowX: "auto", color: "text.secondary" }}>
      <svg key={chartKey} width={width} height={CHART_HEIGHT + 24} role="img" aria-label="Settlement gross volume by day">
        <line x1={0} y1={axisY} x2={width} y2={axisY} stroke={AXIS_COLOR} strokeWidth={1} />

        <m.path
          d={areaPath}
          fill={LINE_COLOR}
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        />

        <m.path
          d={linePath}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />

        {coords.map((c, i) => {
          const isLast = i === coords.length - 1;
          return (
            <g key={c.date}>
              <title>
                {c.label}: {formatCompactCurrency(c.total)}
              </title>
              <m.circle
                cx={c.x}
                cy={c.y}
                r={MARKER_R}
                fill={LINE_COLOR}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.05, duration: 0.25, ease: "easeOut" }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
              {/* surface-color ring so the marker reads distinctly where the line passes under it */}
              <circle cx={c.x} cy={c.y} r={MARKER_R} fill="none" stroke="#FFFFFF" strokeWidth={2} />
              {isLast && (
                <text x={c.x} y={c.y - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="currentColor">
                  {formatCompactCurrency(c.total)}
                </text>
              )}
              <text x={c.x} y={axisY + 16} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.75}>
                {c.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

export function VolumeTrend() {
  const { data } = useSettlements();

  const points = useMemo(() => aggregateDailyVolume(data ?? []), [data]);

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Settlement volume by day
      </Typography>
      {points.length === 0 && <EmptyState />}
      {points.length === 1 && <SinglePointState point={points[0]} />}
      {points.length > 1 && <TrendChart points={points} />}
    </Stack>
  );
}
