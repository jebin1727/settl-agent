"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect } from "react";

import { logger } from "@/lib/logger";

// Next.js App Router convention: catches any error thrown while rendering a
// route segment. This is route-level "global error handling" — see
// ErrorBoundaryProvider for finer-grained section boundaries.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error({ error: error.message, digest: error.digest }, "route_error");
  }, [error]);

  return (
    <Stack spacing={2} sx={{ alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Typography variant="h6">Something went wrong.</Typography>
      <Button variant="contained" onClick={reset}>
        Try again
      </Button>
    </Stack>
  );
}
