// A thin wrapper over MUI's Chip with app-wide status semantics baked in.
// Feature components should import THIS, not @mui/material/Chip directly —
// that's what keeps "reusable" from meaning "copy-pasted with slightly
// different colors every time." See SA-Arch.md §6.
import Chip from "@mui/material/Chip";

export type AppStatus = "ok" | "degraded" | "down" | "pending";

const STATUS_CONFIG: Record<AppStatus, { label: string; color: "success" | "warning" | "error" | "default" }> = {
  ok: { label: "Operational", color: "success" },
  degraded: { label: "Degraded", color: "warning" },
  down: { label: "Down", color: "error" },
  pending: { label: "Checking…", color: "default" },
};

export function StatusChip({ status }: { status: AppStatus }) {
  const config = STATUS_CONFIG[status];
  return <Chip label={config.label} color={config.color} size="small" variant="outlined" />;
}
