"use client";

import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { m } from "framer-motion";
import { useState } from "react";
import type { FormEvent } from "react";

import { BrandMark } from "@/components/common/BrandMark";
import { heroGradient } from "@/lib/theme";

// Only same-origin relative paths are honored, so ?next= can't be abused as an open redirect.
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message ?? "Sign-in failed");
        return;
      }
      const next = safeNext(new URLSearchParams(window.location.search).get("next"));
      window.location.assign(next);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", background: heroGradient, display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
      <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ width: "100%", maxWidth: 400 }}>
        <Paper
          component="form"
          onSubmit={onSubmit}
          sx={{ p: 4, borderRadius: "20px", backdropFilter: "blur(12px)", bgcolor: "rgba(255,255,255,0.96)" }}
        >
          <Stack spacing={2.5}>
            <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1.25 }}>
              <BrandMark size={36} radius={10} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                SettlAgent
              </Typography>
            </Stack>
            <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
              <LockOutlinedIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Operator console — sign in to move money and review disputes.
              </Typography>
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </Stack>
        </Paper>
      </m.div>
    </Box>
  );
}
