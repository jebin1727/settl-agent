"use client";

import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";

export function AgentActivityPage() {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Agent Activity
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Every action either agent took, in order — which service acted, what happened, and when.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <ActivityTimeline />
      </Paper>
    </Stack>
  );
}
