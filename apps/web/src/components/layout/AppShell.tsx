"use client";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/common/BrandMark";
import { AgentOnlineBadge } from "@/components/common/AgentOnlineBadge";
import { heroGradient } from "@/lib/theme";

export type DashboardSection =
  | "command_center"
  | "settlements"
  | "disputes"
  | "decision_replay"
  | "activity"
  | "audit_reports";

const SIDEBAR_WIDTH = 248;
const NAV_ACCENT = "#1E7A5F";

const NAV_ITEMS: { key: DashboardSection; label: string; icon: ReactNode }[] = [
  { key: "command_center", label: "Command Center", icon: <DashboardOutlinedIcon /> },
  { key: "settlements", label: "Settlements", icon: <ReceiptLongOutlinedIcon /> },
  { key: "disputes", label: "Disputes", icon: <GavelOutlinedIcon /> },
  { key: "decision_replay", label: "Decision Replay", icon: <ReplayOutlinedIcon /> },
  { key: "activity", label: "Agent Activity", icon: <TimelineOutlinedIcon /> },
  { key: "audit_reports", label: "Audit & Reports", icon: <FactCheckOutlinedIcon /> },
];

interface AppShellProps {
  children: ReactNode;
  activeSection: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
}

function Logo() {
  return (
    <Stack
      component={Link}
      href="/"
      sx={{ flexDirection: "row", alignItems: "center", gap: 1, textDecoration: "none", color: "inherit" }}
    >
      <BrandMark size={34} radius={9} />
      <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
        SettlAgent
      </Typography>
    </Stack>
  );
}

export function AppShell({ children, activeSection, onSectionChange }: AppShellProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navList = (
    <List sx={{ px: 1.5, py: 2 }}>
      {NAV_ITEMS.map((item) => {
        const active = item.key === activeSection;
        return (
          <ListItemButton
            key={item.key}
            selected={active}
            onClick={() => {
              onSectionChange(item.key);
              setMobileOpen(false);
            }}
            sx={{
              borderRadius: "10px",
              mb: 0.5,
              "&.Mui-selected": { bgcolor: alpha(NAV_ACCENT, 0.12) },
              "&.Mui-selected:hover": { bgcolor: alpha(NAV_ACCENT, 0.18) },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: active ? NAV_ACCENT : "text.secondary" }}>
              {item.icon}
            </ListItemIcon>
            <Typography
              sx={{ fontWeight: active ? 700 : 500, fontSize: "0.9rem", color: active ? NAV_ACCENT : "text.primary" }}
            >
              {item.label}
            </Typography>
          </ListItemButton>
        );
      })}
    </List>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" elevation={0} sx={{ background: heroGradient, zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            sx={{ mr: 1.5, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Stack sx={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <Logo />
            <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
              <AgentOnlineBadge />
              <IconButton
                color="inherit"
                aria-label="Sign out"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  router.replace("/login");
                }}
              >
                <LogoutOutlinedIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", sm: "block" },
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            boxSizing: "border-box",
            borderRight: "1px solid rgba(11,59,46,0.08)",
          },
        }}
      >
        <Toolbar />
        {navList}
      </Drawer>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH, boxSizing: "border-box" },
        }}
      >
        <Toolbar />
        {navList}
      </Drawer>

      <Box component="main" sx={{ ml: { sm: `${SIDEBAR_WIDTH}px` } }}>
        <Toolbar />
        <Container maxWidth="lg" sx={{ py: 4 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
