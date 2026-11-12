"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AnimatePresence, m } from "framer-motion";
import { useMemo, useState } from "react";

import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { OverviewStats } from "@/components/dashboard/OverviewStats";
import { StatusChip } from "@/components/common/StatusChip";
import { AppShell, type DashboardSection } from "@/components/layout/AppShell";
import { DisputesPanel } from "@/components/disputes/DisputesPanel";
import { SettlementsPanel } from "@/components/settlements/SettlementsPanel";
import { ErrorBoundaryProvider } from "@/providers/ErrorBoundaryProvider";
import { useAgentHealth } from "@/hooks/useAgentHealth";

function AgentHealthCard() {
  const { status, dataUpdatedAt, isLoading } = useAgentHealth();

  // useMemo here is warranted: formatting a timestamp on every render (even
  // ones unrelated to dataUpdatedAt changing) is wasted work once this card
  // is sitting next to a live-updating grid — see SA-Arch.md §7.
  const lastChecked = useMemo(
    () => (dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"),
    [dataUpdatedAt]
  );

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack sx={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle1">Agent service</Typography>
          {isLoading ? <Skeleton variant="rounded" width={100} height={24} /> : <StatusChip status={status} />}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Last checked: {lastChecked}
        </Typography>
      </CardContent>
    </Card>
  );
}

const PANEL_TRANSITION = { duration: 0.18 };

export default function DashboardPage() {
  const [section, setSection] = useState<DashboardSection>("settlements");

  return (
    <AppShell activeSection={section} onSectionChange={setSection}>
      <Stack spacing={3}>
        <Typography variant="h5">Settlement &amp; Dispute Dashboard</Typography>
        <ErrorBoundaryProvider>
          <AgentHealthCard />
        </ErrorBoundaryProvider>

        <ErrorBoundaryProvider>
          <OverviewStats />
        </ErrorBoundaryProvider>

        <ErrorBoundaryProvider>
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={PANEL_TRANSITION}
            >
              {section === "settlements" && <SettlementsPanel />}
              {section === "disputes" && <DisputesPanel />}
              {section === "activity" && (
                <Paper variant="outlined" sx={{ p: 2.5 }}>
                  <ActivityTimeline />
                </Paper>
              )}
            </m.div>
          </AnimatePresence>
        </ErrorBoundaryProvider>
      </Stack>
    </AppShell>
  );
}
