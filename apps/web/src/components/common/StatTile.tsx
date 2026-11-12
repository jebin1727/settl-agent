// Stat-tile contract (dataviz skill): label (sentence case, no trailing
// colon) · value (semibold, auto-compact figures) · optional caption.
// Value text always stays in text-ink tokens, never a data/series color —
// identity here comes from the icon badge beside it, not from coloring the
// number itself.
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: string;
  caption?: string;
  icon?: ReactNode;
  accentColor?: string;
}

export function StatTile({ label, value, caption, icon, accentColor = "#1E7A5F" }: StatTileProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        height: "100%",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          bgcolor: accentColor,
        },
      }}
    >
      <Stack sx={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h4" component="p" sx={{ fontWeight: 700, fontVariantNumeric: "proportional-nums" }}>
            {value}
          </Typography>
          {caption && (
            <Typography variant="caption" color="text.secondary">
              {caption}
            </Typography>
          )}
        </Stack>
        {icon && (
          <Stack
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: "12px",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: alpha(accentColor, 0.12),
              color: accentColor,
            }}
          >
            {icon}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

// Same footprint as StatTile above (padding, icon badge size, text sizes)
// so swapping one for the other causes no layout jump.
export function StatTileSkeleton() {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
      <Stack sx={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Stack spacing={0.75} sx={{ minWidth: 0, flexGrow: 1 }}>
          <Skeleton variant="text" width="70%" height={20} />
          <Skeleton variant="text" width="50%" height={36} />
          <Skeleton variant="text" width="40%" height={16} />
        </Stack>
        <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: "12px", flexShrink: 0 }} />
      </Stack>
    </Paper>
  );
}
