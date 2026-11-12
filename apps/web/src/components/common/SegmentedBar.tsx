// "Segmented bar" figure (dataviz skill): one whole, split into parts. Tall
// variant — 28px, 4px corners per block, 2px surface-color gap between
// blocks (never a border — the gap is the separator), share% printed inside
// a block only when it fits. No baseline: a part at zero draws nothing.
"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

export interface SegmentedBarPart {
  label: string;
  value: number;
  color: string;
}

export function SegmentedBar({ parts, title }: { parts: SegmentedBarPart[]; title: string }) {
  const theme = useTheme();
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const nonZeroParts = parts.filter((p) => p.value > 0);

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>

      {total === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No data yet.
        </Typography>
      ) : (
        <Stack sx={{ flexDirection: "row", height: 28, gap: "2px" }}>
          {nonZeroParts.map((part) => {
            const share = (part.value / total) * 100;
            // "a block too narrow for its label prints none" — ~12% is
            // roughly where "Label 100%" stops fitting at this bar height.
            const showLabel = share >= 12;
            return (
              <Box
                key={part.label}
                title={`${part.label}: ${part.value} (${share.toFixed(0)}%)`}
                sx={{
                  flexBasis: `${share}%`,
                  bgcolor: part.color,
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                {showLabel && (
                  <Typography
                    variant="caption"
                    sx={{ color: theme.palette.getContrastText(part.color), fontWeight: 600, px: 0.5 }}
                    noWrap
                  >
                    {share.toFixed(0)}%
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      <Stack sx={{ flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
        {parts.map((part) => (
          <Stack key={part.label} sx={{ flexDirection: "row", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: part.color, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary">
              {part.label} ({part.value})
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
