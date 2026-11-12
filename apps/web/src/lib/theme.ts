// Single source of truth for design tokens. Nothing in components/ should
// hardcode a color, spacing value, or font size — it comes from here, via
// MUI's theme, or it doesn't belong. See SA-Arch.md §6.
"use client";

import { createTheme } from "@mui/material/styles";

// The "Command Center" visual language: deep navy-teal (not a straight
// green anymore) + an emerald accent reserved for "the agent is alive"
// signals — glow rings, pulsing dots, the online badge. Semantic
// error/warning/success stay as they were; those meanings shouldn't shift
// just because the brand did.
export const EMERALD = "#10B981";
export const EMERALD_GLOW = "rgba(16,185,129,0.35)";
export const NAVY_DEEP = "#071A2B";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0B2B3B", light: "#1E7A5F", dark: NAVY_DEEP },
    secondary: { main: "#1E7A5F", light: "#3FA082", dark: "#0B2B3B" },
    error: { main: "#B3261E" },
    warning: { main: "#B06E00" },
    success: { main: "#1B873F" },
    background: { default: "#F4F7F8", paper: "#FFFFFF" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    h1: { fontWeight: 800, letterSpacing: "-0.02em" },
    h2: { fontWeight: 800, letterSpacing: "-0.02em" },
    h3: { fontWeight: 700, letterSpacing: "-0.01em" },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        outlined: { borderColor: "rgba(11,59,46,0.12)" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, textTransform: "none", fontWeight: 600 },
      },
    },
  },
});

// Reused wherever a hero/header surface needs visual weight beyond a flat
// fill — kept as plain strings (not a full palette token) since MUI's
// palette type doesn't model gradients; sx={{ background: heroGradient }}.
export const heroGradient = `linear-gradient(135deg, ${NAVY_DEEP} 0%, #0B2B3B 55%, #1E7A5F 100%)`;
export const subtleGradient = "linear-gradient(180deg, #FFFFFF 0%, #F0F5F2 100%)";

// A reusable glassmorphism surface — frosted, not flat-white. Used
// sparingly (Command Center panels, case cards), per the brief: "minimal
// glassmorphism", not applied to every card in the app.
export const glassSurface = {
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(16px) saturate(160%)",
  WebkitBackdropFilter: "blur(16px) saturate(160%)",
  border: "1px solid rgba(255,255,255,0.5)",
  boxShadow: "0 8px 32px rgba(7,26,43,0.08)",
} as const;

// Same idea, for glass-on-dark surfaces (e.g. a panel sitting on the navy
// hero gradient).
export const glassSurfaceDark = {
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(16px) saturate(160%)",
  WebkitBackdropFilter: "blur(16px) saturate(160%)",
  border: "1px solid rgba(255,255,255,0.14)",
} as const;
