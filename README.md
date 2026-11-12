# SettlAgent

An autonomous AI agent for the back-office settlement lifecycle of a marketplace or services business.
When a job/order is marked complete, it splits the payment (platform fee vs. provider share) and **pays the
provider directly** via a real PayPal Sandbox Payout — not an invoice billing them for their own earnings.
When a dispute lands, a PayPal webhook reacts on its own (no human clicks "triage"): an LLM classifies risk
with a visible written rationale, auto-resolves low-risk cases, and escalates ambiguous ones to a human with a
drafted recommendation instead of a black-box decision.

Built for the [PayPal AI Hackathon 2026](https://paypalaihackathon.devpost.com) — "Build What's Next with
PayPal and AI."

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
   ([developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → Sandbox) and your
   `GEMINI_API_KEY` ([Google AI Studio](https://aistudio.google.com/apikey)).
2. From the repo root: `docker compose -f infra/docker-compose.yml up --build`
3. Dashboard: http://localhost:3000 · Agent API: http://localhost:8000/healthz

For local development without Docker, see per-service instructions in `apps/web/README.md` and
`services/agent/README.md`.

## Testing

- Agent service: `cd services/agent && uv run pytest`
- Web app: `cd apps/web && pnpm test`

## Credits

- Illustration by Freepik (storyset) via Freepik/Magnific — free license, attribution required.

## License

MIT — see [`LICENSE`](./LICENSE).
