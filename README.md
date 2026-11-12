# SettlAgent

An autonomous AI agent for the back-office settlement lifecycle of a marketplace or services business.
When a job/order is marked complete, it splits the payment (platform fee vs. provider share) and **pays the
provider directly** via a real PayPal Sandbox Payout — not an invoice billing them for their own earnings.
When a dispute lands, a PayPal webhook reacts on its own (no human clicks "triage"): an LLM classifies risk
with a visible written rationale, auto-resolves low-risk cases, and escalates ambiguous ones to a human with a
drafted recommendation instead of a black-box decision.

Built for the [PayPal AI Hackathon 2026](https://paypalaihackathon.devpost.com) — "Build What's Next with
PayPal and AI."

## What makes it safe

- **Payment Guardian** — every payout is scored by deterministic rules over your real payout history
  (large amount, amount anomaly, velocity, high fee, new recipient). Clean payouts go through; risky ones are
  **held** and nothing moves until an operator approves in the console. Rejecting never pays.
- **Two-key dispute resolution** — the LLM's recommendation *and* a numeric risk score below 0.3 must both agree
  before a dispute is auto-resolved. Everything else escalates with the written rationale.
- **Authenticated console** — single admin login from `.env`, signed httpOnly session cookie, and every page
  and `/api/*` route is gated server-side.
- **Full audit trail** — every decision records its actor, rationale and provider.

See [`docs/ONBOARDING.md`](./docs/ONBOARDING.md) for architecture diagrams, the step-by-step flows, how the AI is
used, and a demo walkthrough (also as [Word](./docs/SettlAgent_Onboarding_Guide.docx)).

See [`SA-Arch.md`](./SA-Arch.md) for the full architecture (layering pattern, folder structure, infra
decisions) and [`Track.md`](./Track.md) for build status.

## Stack

- **Frontend**: Next.js (App Router) + MUI — `apps/web`
- **Agent service**: FastAPI + LangChain + [`paypal-agent-toolkit`](https://github.com/paypal/agent-toolkit) — `services/agent`
- **LLM**: Gemini 3.8 Flash (deployed) / Ollama + qwen3:8b (local dev) — swappable via `LLM_PROVIDER`
- **Infra**: Postgres (audit ledger), Redis (queue + rate limiting + cache), Arq (background jobs), Docker Compose
- **Monorepo**: Turborepo + pnpm

## Run locally

Prerequisites: Docker Desktop, Node 20+, pnpm, `uv` (Python).

1. Copy `.env.example` to `.env` and fill in your PayPal Sandbox Client ID/Secret
   ([developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → Sandbox), your
   `GEMINI_API_KEY` ([Google AI Studio](https://aistudio.google.com/apikey)), and choose your own
   `ADMIN_PASSWORD` and a long random `SESSION_SECRET` for the console login. `GUARDIAN_REVIEW_THRESHOLD`
   (default 500) sets the payout amount that always needs human approval.
2. From the repo root: `docker compose -f infra/docker-compose.yml up --build`
3. Open http://localhost:3000 → **Sign in to the console** (username `ADMIN_USERNAME`, default `admin`, and your
   `ADMIN_PASSWORD`). Agent API health: http://localhost:8000/healthz

For local development without Docker, see per-service instructions in `apps/web/README.md` and
`services/agent/README.md`.

## Testing

- Agent service: `cd services/agent && uv run pytest`
- Web app: `cd apps/web && pnpm test`

## Credits

- Illustration by Freepik (storyset) via Freepik/Magnific — free license, attribution required.

## License

MIT — see [`LICENSE`](./LICENSE).
