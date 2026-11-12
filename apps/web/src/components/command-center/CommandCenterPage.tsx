// The default dashboard view — "show judges an AI agent actually working,"
// not a chart. KPIs reuse the existing StatTile component (same contract
// as Audit & Reports' tiles); the feed and pending-review panel are new,
// but every number on this page comes from useSettlements/useDisputes/
// useAuditLogs — nothing fabricated, no new backend endpoints.
"use client";

import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { m } from "framer-motion";
import { useMemo } from "react";

import { StatTile, StatTileSkeleton } from "@/components/common/StatTile";
import { LiveOperationsFeed } from "@/components/command-center/LiveOperationsFeed";
import { useDisputes } from "@/hooks/useDisputes";
import { useSettlements } from "@/hooks/useSettlements";
import { formatCompactCurrency, formatCompactNumber } from "@/lib/format";
import type { DashboardSection } from "@/components/layout/AppShell";

const ACCENT_SETTLEMENTS = "#1E7A5F";
const ACCENT_VOLUME = "#2a78d6";
const ACCENT_DISPUTES = "#6250d6";
const ACCENT_REVIEW = "#B06E00";

interface CommandCenterPageProps {
  onNavigate: (section: DashboardSection) => void;
}

export function CommandCenterPage({ onNavigate }: CommandCenterPageProps) {
  const { data: settlements, isLoading: settlementsLoading } = useSettlements();
  const { data: disputes, isLoading: disputesLoading } = useDisputes();
  const isLoading = settlementsLoading || disputesLoading;

  const stats = useMemo(() => {
    const s = settlements ?? [];
    const d = disputes ?? [];
    return {
      settlementCount: s.length,
      grossTotal: s.reduce((sum, row) => sum + Number(row.gross_amount), 0),
      disputesTriaged: d.length,
      pendingReview:
        d.filter((row) => row.status === "escalated").length +
        s.filter((row) => row.status === "awaiting_approval").length,
    };
  }, [settlements, disputes]);

  const pendingDisputes = useMemo(
    () => (disputes ?? []).filter((row) => row.status === "escalated").slice(0, 4),
    [disputes]
  );

  const heldSettlements = useMemo(
    () => (settlements ?? []).filter((row) => row.status === "awaiting_approval").slice(0, 4),
    [settlements]
  );

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Command Center
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Live autonomous operations — settlements, disputes, and the agent&apos;s own reasoning.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {[
          {
            label: "Settlements processed",
            value: formatCompactNumber(stats.settlementCount),
            icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 22 }} />,
            accentColor: ACCENT_SETTLEMENTS,
          },
          {
            label: "Volume processed",
            value: formatCompactCurrency(stats.grossTotal),
            caption: "gross, USD",
            icon: <TrendingUpOutlinedIcon sx={{ fontSize: 22 }} />,
            accentColor: ACCENT_VOLUME,
          },
          {
            label: "Disputes triaged",
            value: formatCompactNumber(stats.disputesTriaged),
            icon: <ShieldOutlinedIcon sx={{ fontSize: 22 }} />,
            accentColor: ACCENT_DISPUTES,
          },
          {
            label: "Needs human review",
            value: formatCompactNumber(stats.pendingReview),
            icon: <PendingActionsOutlinedIcon sx={{ fontSize: 22 }} />,
            accentColor: ACCENT_REVIEW,
          },
        ].map((tile, index) => (
          <Grid key={tile.label} size={{ xs: 12, sm: 6, md: 3 }}>
            {isLoading ? (
              <StatTileSkeleton />
            ) : (
              <m.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                style={{ height: "100%" }}
              >
                <StatTile {...tile} />
              </m.div>
            )}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
            <LiveOperationsFeed limit={6} />
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Needs your review
              </Typography>
              {pendingDisputes.length === 0 && heldSettlements.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nothing waiting on a human right now.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {heldSettlements.map((row) => (
                    <Stack
                      key={row.id}
                      sx={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        p: 1.25,
                        borderRadius: "10px",
                        border: "1px solid rgba(176,110,0,0.4)",
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          Payout ${row.gross_amount} held
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Guardian risk {row.risk_score ?? "—"}
                        </Typography>
                      </Box>
                      <Chip label="Awaiting approval" size="small" color="warning" variant="outlined" />
                    </Stack>
                  ))}
                  {heldSettlements.length > 0 && (
                    <Typography
                      variant="body2"
                      onClick={() => onNavigate("settlements")}
                      sx={{ color: "primary.main", fontWeight: 600, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                    >
                      Approve in Settlements →
                    </Typography>
                  )}
                  {pendingDisputes.map((d) => (
                    <Stack
                      key={d.id}
                      sx={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        p: 1.25,
                        borderRadius: "10px",
                        border: "1px solid rgba(11,43,59,0.1)",
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {d.paypal_dispute_id}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          risk {d.risk_score ?? "—"}
                        </Typography>
                      </Box>
                      <Chip label="Escalated" size="small" color="warning" variant="outlined" />
                    </Stack>
                  ))}
                  <m.div style={{ display: "inline-block" }} whileTap={{ scale: 0.97 }}>
                    <Typography
                      variant="body2"
                      onClick={() => onNavigate("disputes")}
                      sx={{ color: "primary.main", fontWeight: 600, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                    >
                      Review in Disputes →
                    </Typography>
                  </m.div>
                </Stack>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
