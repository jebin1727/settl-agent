// Single source of truth for design tokens. Nothing in components/ should
// hardcode a color, spacing value, or font size — it comes from here, via
// MUI's theme, or it doesn't belong. See SA-Arch.md §6.
"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0B3B2E", light: "#1E7A5F", dark: "#062019" },
    secondary: { main: "#1E7A5F", light: "#3FA082", dark: "#0B3B2E" },
    error: { main: "#B3261E" },
    warning: { main: "#B06E00" },
    success: { main: "#1B873F" },
    background: { default: "#F6F8F7", paper: "#FFFFFF" },
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
export const heroGradient = "linear-gradient(135deg, #0B3B2E 0%, #0F4F3D 55%, #1E7A5F 100%)";
export const subtleGradient = "linear-gradient(180deg, #FFFFFF 0%, #F0F5F2 100%)";
