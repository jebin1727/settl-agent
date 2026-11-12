"use client";

import AutorenewOutlinedIcon from "@mui/icons-material/AutorenewOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import GppMaybeOutlinedIcon from "@mui/icons-material/GppMaybeOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import WebhookOutlinedIcon from "@mui/icons-material/WebhookOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { m } from "framer-motion";
import type { Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/common/BrandMark";
import { heroGradient } from "@/lib/theme";

const FEATURES: { title: string; body: string; icon: ReactNode; color: string }[] = [
  {
    title: "Real PayPal integration",
    body: "Every settlement pays the provider's share directly via a real PayPal Sandbox Payout — not an invoice billing them for their own earnings, not a mock.",
    icon: <PaymentsOutlinedIcon />,
    color: "#2a78d6",
  },
  {
    title: "Autonomous dispute triage",
    body: "An LLM assesses risk with a visible rationale, auto-resolves low-risk disputes via PayPal's Disputes API, and escalates the rest with its reasoning attached.",
    icon: <PsychologyOutlinedIcon />,
    color: "#6250d6",
  },
  {
    title: "Event-driven, not button-driven",
    body: "A PayPal webhook receiver reacts to new disputes on its own — signature-verified, queued to a background worker — no human has to click \"triage.\"",
    icon: <WebhookOutlinedIcon />,
    color: "#eb6834",
  },
  {
    title: "Vendor-agnostic reasoning",
    body: "The same decision logic runs on Gemini or a fully local Ollama model — swapping providers is a one-line config change, proven live.",
    icon: <AutorenewOutlinedIcon />,
    color: "#1baf7a",
  },
];

const AGENTS: { name: string; body: string; color: string }[] = [
  {
    name: "Payment Guardian",
    body: "Scores every payout against your real history — large amount, amount anomaly, velocity, fee ratio, new recipient — and holds risky ones before money moves.",
    color: "#B06E00",
  },
  {
    name: "Dispute Investigation",
    body: "Reads each PayPal dispute, produces a risk score with a written rationale, then resolves or escalates it through PayPal's Disputes API.",
    color: "#6250d6",
  },
  {
    name: "Human operator",
    body: "Held payouts and escalated disputes wait for an authenticated operator. Approve releases the real payout; reject never pays.",
    color: "#1E7A5F",
  },
];

const STEPS: { label: string; body: string; icon: ReactNode }[] = [
  {
    label: "Job marked complete",
    body: "A settlement is created with the platform fee split.",
    icon: <TaskAltOutlinedIcon />,
  },
  {
    label: "Guardian checks the risk",
    body: "Clean payouts go through; risky ones wait for a human to approve.",
    icon: <GppMaybeOutlinedIcon />,
  },
  {
    label: "Agent pays the provider",
    body: "A real PayPal Payout is sent for the provider's share.",
    icon: <PaymentsOutlinedIcon />,
  },
  {
    label: "Disputes triage themselves",
    body: "A webhook fires, the agent reasons, resolves or escalates — with context.",
    icon: <FactCheckOutlinedIcon />,
  },
];

const SPOTLIGHTS: { title: string; body: string; image: string; alt: string; reverse: boolean }[] = [
  {
    title: "Settlement becomes a real payout",
    body: "The moment a job is marked complete, the agent calculates the split and sends a real PayPal Payout to the provider — no invoice, no waiting on the platform to push a button.",
    image: "/images/payouts-illustration.jpg",
    alt: "Illustration of money transferring from one phone to another via PayPal-style wallet and card screens",
    reverse: false,
  },
  {
    title: "Disputes get a reasoned decision, not a queue",
    body: "Low-risk disputes are auto-resolved with a visible rationale; anything uncertain is escalated with that same reasoning attached — refunds and cashback handled the way a careful human would.",
    image: "/images/disputes-illustration.jpg",
    alt: "Illustration of a customer completing a point-of-sale refund with a confirmation checkmark",
    reverse: true,
  },
];

// Shared motion variants — fade-up for individual elements, a stagger
// orchestrator for their parent. `show` on the parent cascades to any
// child using the `fadeUp` variants, so each section only needs one
// whileInView trigger instead of one per element.
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const slideFrom = (fromRight: boolean): Variants => ({
  hidden: { opacity: 0, x: fromRight ? 40 : -40 },
  show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } },
});

const VIEWPORT = { once: true, amount: 0.3 } as const;

export default function LandingPage() {
  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh" }}>
      <Box
        sx={{
          background: heroGradient,
          color: "common.white",
          position: "relative",
          overflow: "hidden",
          "&::after": {
            content: '""',
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 70%)",
            top: -180,
            right: -120,
          },
        }}
      >
        <Container maxWidth="lg" sx={{ pt: { xs: 8, sm: 10 }, pb: 9, position: "relative" }}>
          <Grid container spacing={{ xs: 5, md: 8 }} sx={{ alignItems: "center" }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <m.div variants={stagger} initial="hidden" animate="show">
                <Stack sx={{ alignItems: { xs: "center", md: "flex-start" }, textAlign: { xs: "center", md: "left" } }}>
                  <m.div variants={fadeUp}>
                    <Chip
                      label="Built for the PayPal AI Hackathon 2026"
                      size="small"
                      sx={{ mb: 3, bgcolor: "rgba(255,255,255,0.14)", color: "common.white", fontWeight: 600 }}
                    />
                  </m.div>
                  <m.div variants={fadeUp}>
                    <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1.5, mb: 1 }}>
                      <BrandMark size={56} radius={14} />
                      <Typography variant="h2" component="h1" sx={{ fontWeight: 800, fontSize: { xs: "2.5rem", sm: "3.25rem" } }}>
                        SettlAgent
                      </Typography>
                    </Stack>
                  </m.div>
                  <m.div variants={fadeUp}>
                    <Typography variant="h6" component="p" sx={{ mt: 2, maxWidth: 480, opacity: 0.88, fontWeight: 400 }}>
                      An autonomous agent that settles marketplace jobs and triages PayPal disputes —
                      real payouts, real risk-assessed decisions, every action explained.
                    </Typography>
                  </m.div>
                  <m.div variants={fadeUp}>
                    <m.div style={{ display: "inline-block", marginTop: 32 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        component={Link}
                        href="/login"
                        variant="contained"
                        size="large"
                        sx={{
                          px: 4,
                          bgcolor: "common.white",
                          color: "primary.dark",
                          "&:hover": { bgcolor: "rgba(255,255,255,0.88)" },
                        }}
                      >
                        Sign in to the console
                      </Button>
                    </m.div>
                  </m.div>
                </Stack>
              </m.div>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <m.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
              >
                <Stack sx={{ alignItems: "center" }}>
                  <Box
                    sx={{
                      borderRadius: "24px",
                      overflow: "hidden",
                      bgcolor: "common.white",
                      boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
                      p: 2,
                      maxWidth: 420,
                      width: "100%",
                    }}
                  >
                    <Image
                      src="/images/hero-ai-agent.jpg"
                      alt="Illustration of an AI agent surrounded by charts and dashboards, with two people reviewing automated settlement and dispute data"
                      width={800}
                      height={800}
                      priority
                      style={{ width: "100%", height: "auto", display: "block" }}
                    />
                  </Box>
                </Stack>
              </m.div>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 8 }}>
        <m.div variants={stagger} initial="hidden" whileInView="show" viewport={VIEWPORT}>
          <Grid container spacing={2.5}>
            {FEATURES.map((f) => (
              <Grid key={f.title} size={{ xs: 12, sm: 6 }}>
                <m.div variants={fadeUp} style={{ height: "100%" }}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 3,
                      height: "100%",
                      transition: "box-shadow 0.15s, transform 0.15s",
                      "&:hover": { boxShadow: 3, transform: "translateY(-2px)" },
                    }}
                  >
                    <Stack
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "12px",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: alpha(f.color, 0.12),
                        color: f.color,
                        mb: 2,
                      }}
                    >
                      {f.icon}
                    </Stack>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
                      {f.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {f.body}
                    </Typography>
                  </Paper>
                </m.div>
              </Grid>
            ))}
          </Grid>
        </m.div>
      </Container>

      <Container maxWidth="md" sx={{ pb: 8 }}>
        <Stack spacing={7}>
          {SPOTLIGHTS.map((s) => (
            <Grid
              key={s.title}
              container
              spacing={4}
              sx={{ alignItems: "center", flexDirection: { xs: "column-reverse", md: s.reverse ? "row-reverse" : "row" } }}
            >
              <Grid size={{ xs: 12, md: 6 }}>
                <m.div variants={slideFrom(s.reverse)} initial="hidden" whileInView="show" viewport={VIEWPORT}>
                  <Box
                    sx={{
                      borderRadius: "20px",
                      overflow: "hidden",
                      boxShadow: "0 16px 40px rgba(11,59,46,0.14)",
                    }}
                  >
                    <Image
                      src={s.image}
                      alt={s.alt}
                      width={750}
                      height={500}
                      style={{ width: "100%", height: "auto", display: "block" }}
                    />
                  </Box>
                </m.div>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <m.div variants={fadeUp} initial="hidden" whileInView="show" viewport={VIEWPORT}>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
                    {s.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {s.body}
                  </Typography>
                </m.div>
              </Grid>
            </Grid>
          ))}
        </Stack>
      </Container>

      <Container maxWidth="md" sx={{ pb: 8 }}>
        <Typography variant="h5" sx={{ textAlign: "center", fontWeight: 700, mb: 1 }}>
          A small team of specialised agents
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mb: 4 }}>
          Real services with named responsibilities — and a human with the final say. Console access requires sign-in.
        </Typography>
        <m.div variants={stagger} initial="hidden" whileInView="show" viewport={VIEWPORT}>
          <Grid container spacing={2.5}>
            {AGENTS.map((a) => (
              <Grid key={a.name} size={{ xs: 12, md: 4 }}>
                <m.div variants={fadeUp} style={{ height: "100%" }}>
                  <Paper variant="outlined" sx={{ p: 3, height: "100%", borderTop: `3px solid ${a.color}` }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: a.color }} gutterBottom>
                      {a.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {a.body}
                    </Typography>
                  </Paper>
                </m.div>
              </Grid>
            ))}
          </Grid>
        </m.div>
      </Container>

      <Box sx={{ background: heroGradient, color: "common.white", py: 7 }}>
        <Container maxWidth="md">
          <Typography variant="h5" sx={{ textAlign: "center", mb: 5, fontWeight: 700 }}>
            How it works
          </Typography>
          <m.div variants={stagger} initial="hidden" whileInView="show" viewport={VIEWPORT}>
            <Grid container spacing={3}>
              {STEPS.map((s, i) => (
                <Grid key={s.label} size={{ xs: 12, sm: 6, md: 3 }}>
                  <m.div variants={fadeUp}>
                    <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center" }}>
                      <Stack
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: "50%",
                          bgcolor: "rgba(255,255,255,0.14)",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                        }}
                      >
                        {s.icon}
                        <Box
                          sx={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            bgcolor: "secondary.light",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {i + 1}
                        </Box>
                      </Stack>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {s.label}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.85 }}>
                        {s.body}
                      </Typography>
                    </Stack>
                  </m.div>
                </Grid>
              ))}
            </Grid>
          </m.div>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 4, textAlign: "center" }}>
        <Typography variant="caption" color="text.secondary">
          Sandbox environment — no real funds move. Source on GitHub, MIT licensed.
        </Typography>
      </Container>
    </Box>
  );
}
