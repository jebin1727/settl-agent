// Loading placeholder shaped like a grid, not a generic block — a header
// row plus a few body rows at roughly AG Grid's own row height, so the
// page doesn't jump when the real DataTable swaps in. Shared by
// SettlementsPanel and DisputesPanel instead of each hand-rolling its own.
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

const ROW_HEIGHT = 40;

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Stack spacing={1} sx={{ py: 0.5 }} data-testid="table-skeleton">
      <Skeleton variant="rounded" height={ROW_HEIGHT} sx={{ opacity: 0.7 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={ROW_HEIGHT} />
      ))}
    </Stack>
  );
}
