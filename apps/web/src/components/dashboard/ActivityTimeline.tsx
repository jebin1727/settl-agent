// Surfaces audit_logs — every meaningful action any service took, in order.
// This is the "make the AI legible" piece extended beyond just dispute
// rationale: settlement creation, invoice sends, failures, all traceable by
// the same request_id the backend's structured logs use (SA-Arch.md §9).
"use client";

import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";

import { useAuditLogs } from "@/hooks/useAuditLogs";
import { ACTION_LABEL, ACTOR_COLOR, actionDomain, summarizeAuditEntry } from "@/lib/auditSummary";

type DomainFilter = "all" | "settlement" | "dispute";

export function ActivityTimeline() {
  const { data, isLoading } = useAuditLogs();
  const [filter, setFilter] = useState<DomainFilter>("all");
  const entries = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => actionDomain(e.action) === filter)),
    [entries, filter]
  );

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup
        value={filter}
        exclusive
        size="small"
        onChange={(_, value: DomainFilter | null) => value && setFilter(value)}
      >
        <ToggleButton value="all">All</ToggleButton>
        <ToggleButton value="settlement">Settlements</ToggleButton>
        <ToggleButton value="dispute">Disputes</ToggleButton>
      </ToggleButtonGroup>

      {!isLoading && filtered.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {entries.length === 0
            ? "No agent activity yet — create a settlement or triage a dispute to see it here."
            : "No events match this filter."}
        </Typography>
      )}

      <List dense disablePadding>
        {filtered.map((entry) => (
          <ListItem key={entry.id} divider sx={{ py: 1 }}>
            <ListItemText
              primary={
                <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
                  <Chip
                    label={entry.actor.replace("_", " ")}
                    size="small"
                    color={ACTOR_COLOR[entry.actor] ?? "default"}
                    variant="outlined"
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {ACTION_LABEL[entry.action] ?? entry.action}
                  </Typography>
                </Stack>
              }
              secondary={
                <>
                  {summarizeAuditEntry(entry)} · {new Date(entry.created_at).toLocaleString()}
                </>
              }
            />
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
