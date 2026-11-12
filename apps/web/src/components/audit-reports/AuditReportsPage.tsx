// Secondary analytics destination — the dispute breakdown bar, risk radar,
// and volume trend all live here now instead of on the main Command
// Center view, per the brief: "remove the radar graph from the main
// dashboard... keep advanced analytics as a secondary page." The raw
// action log itself lives on the Agent Activity page instead, so this
// page doesn't just duplicate it — this one is KPIs and analytics only.
"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { OverviewStats } from "@/components/dashboard/OverviewStats";

export function AuditReportsPage() {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Audit &amp; Reports
      </Typography>
      <Typography variant="body2" color="text.secondary">
        KPIs and dispute-risk analytics. For the raw, filterable action log, see Agent Activity.
      </Typography>

      <OverviewStats />
    </Stack>
  );
}
