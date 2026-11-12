// The "is this project bigger than it looks" view: aggregate KPIs computed
// client-side from the already-fetched settlements/disputes lists — no new
// backend aggregation endpoint needed for this. useMemo here is warranted
// (SA-Arch.md §7): recomputing sums/counts on every unrelated re-render
// (e.g. a form keystroke) would be wasted work once this sits above a
// live-polling grid.
"use client";

import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { m } from "framer-motion";
import { useMemo } from "react";

import { SegmentedBar } from "@/components/common/SegmentedBar";
import { StatTile, StatTileSkeleton } from "@/components/common/StatTile";
import { DisputeRiskRadar } from "@/components/dashboard/DisputeRiskRadar";
import { useDisputes } from "@/hooks/useDisputes";
import { useSettlements } from "@/hooks/useSettlements";
import { formatCompactCurrency, formatCompactNumber } from "@/lib/format";

// Status palette (dataviz skill, references/palette.md) — fixed, never
// themed, distinct from the app's categorical/brand colors on purpose.
const STATUS_GOOD = "#0ca30c";
const STATUS_WARNING = "#fab219";
const STATUS_MUTED = "#898781";

// Categorical accents (dataviz skill palette) — distinct hues per stat tile
// so the row reads as four different metrics at a glance, not four
// identical white boxes.
const ACCENT_SETTLEMENTS = "#1E7A5F"; // brand secondary
const ACCENT_VOLUME = "#2a78d6"; // categorical slot 1 (blue)
const ACCENT_FEES = "#6250d6"; // categorical slot 7 (violet)
const ICON_SIZE = { fontSize: 22 };

// Fade-up stagger per tile, in grid order. A plain array of delays (not a
// function of data) so it stays referentially stable — framer-motion only
// plays `initial` -> `animate` on mount, never on a later prop change, so
// this naturally doesn't replay on the 10s background refetch.
const TILE_TRANSITION = (index: number) => ({ duration: 0.3, delay: index * 0.08 });

export function OverviewStats() {
  const { data: settlements, isLoading: settlementsLoading } = useSettlements();
  const { data: disputes, isLoading: disputesLoading } = useDisputes();
  const isLoading = settlementsLoading || disputesLoading;

  const stats = useMemo(() => {
    const rows = settlements ?? [];
    const grossTotal = rows.reduce((sum, s) => sum + Number(s.gross_amount), 0);
    const feeTotal = rows.reduce((sum, s) => sum + Number(s.platform_fee_amount), 0);
    const paidOutCount = rows.filter((s) => s.status === "paid_out").length;

    return {
      settlementCount: rows.length,
      grossTotal,
      feeTotal,
      paidOutCount,
    };
  }, [settlements]);

  const disputeBreakdown = useMemo(() => {
    const rows = disputes ?? [];
    const autoResolved = rows.filter((d) => d.status === "auto_resolved").length;
    const escalated = rows.filter((d) => d.status === "escalated").length;
    const open = rows.filter((d) => d.status === "open").length;
    const total = rows.length;
    const autoResolveRate = total > 0 ? Math.round((autoResolved / total) * 100) : null;

    return { autoResolved, escalated, open, total, autoResolveRate };
  }, [disputes]);

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        {[
          {
            label: "Settlements processed",
            value: formatCompactNumber(stats.settlementCount),
            caption: `${stats.paidOutCount} paid out`,
            icon: <ReceiptLongOutlinedIcon sx={ICON_SIZE} />,
            accentColor: ACCENT_SETTLEMENTS,
          },
          {
            label: "Volume processed",
            value: formatCompactCurrency(stats.grossTotal),
            caption: "gross, USD",
            icon: <TrendingUpOutlinedIcon sx={ICON_SIZE} />,
            accentColor: ACCENT_VOLUME,
          },
          {
            label: "Platform fees collected",
            value: formatCompactCurrency(stats.feeTotal),
            caption: "USD",
            icon: <AccountBalanceWalletOutlinedIcon sx={ICON_SIZE} />,
            accentColor: ACCENT_FEES,
          },
          {
            label: "Dispute auto-resolution rate",
            value: disputeBreakdown.autoResolveRate !== null ? `${disputeBreakdown.autoResolveRate}%` : "—",
            caption: `${disputeBreakdown.total} disputes triaged`,
            icon: <VerifiedOutlinedIcon sx={ICON_SIZE} />,
            accentColor: STATUS_GOOD,
          },
        ].map((tile, index) => (
          <Grid key={tile.label} size={{ xs: 12, sm: 6, md: 3 }}>
            {isLoading ? (
              <StatTileSkeleton />
            ) : (
              <m.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={TILE_TRANSITION(index)}
                style={{ height: "100%" }}
              >
                <StatTile {...tile} />
              </m.div>
            )}
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={3}>
          <SegmentedBar
            title="Dispute resolution breakdown"
            parts={[
              { label: "Auto-resolved by agent", value: disputeBreakdown.autoResolved, color: STATUS_GOOD },
              { label: "Escalated to human", value: disputeBreakdown.escalated, color: STATUS_WARNING },
              { label: "Open / untriaged", value: disputeBreakdown.open, color: STATUS_MUTED },
            ]}
          />
          <DisputeRiskRadar disputes={disputes ?? []} />
        </Stack>
      </Paper>
    </Stack>
  );
}
