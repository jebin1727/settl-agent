// Generic status pill — distinct from StatusChip (which is specifically for
// agent service health). Settlement/dispute statuses are domain data, not
// infra health, so they get their own small reusable mapping here instead
// of overloading StatusChip with unrelated meanings.
import Chip from "@mui/material/Chip";

type Tone = "success" | "warning" | "error" | "info" | "default";

const TONE_BY_STATUS: Record<string, Tone> = {
  pending: "default",
  awaiting_approval: "warning",
  rejected: "error",
  paid_out: "success",
  payout_failed: "warning",
  failed: "error",
  open: "default",
  auto_resolved: "success",
  escalated: "warning",
  closed: "info",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONE_BY_STATUS[status] ?? "default";
  const label = status.replace(/_/g, " ");
  return <Chip label={label} color={tone} size="small" variant={tone === "default" ? "outlined" : "filled"} />;
}
