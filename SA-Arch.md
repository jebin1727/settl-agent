# SettlAgent — System Architecture

PayPal AI Hackathon 2026 ("Build What's Next with PayPal and AI")
Last updated: 2026-11-03

---

## 1. What this document is

This is the single source of truth for how SettlAgent is built: folder structure, layering pattern, data flow,
infra, and the reasoning behind each choice. If you're unsure where a piece of code belongs, it belongs
somewhere in this document — come back here before inventing a new pattern.

Companion file: `Track.md` — day-by-day task tracking, decisions log, open questions. This file (`SA-Arch.md`)
answers "how is it built"; `Track.md` answers "where are we right now."

---

## 2. One-paragraph concept

SettlAgent is an autonomous agent that handles the back-office settlement lifecycle for a marketplace: when a
job/order is marked complete, it generates and sends a split invoice (platform fee + provider line items) via
PayPal's sandbox, tracks payment, and when a dispute lands, triages it — classifies risk with an LLM, auto-resolves
low-risk cases with a visible written rationale, and escalates ambiguous ones to a human with a drafted
recommendation instead of a black-box decision.

---

## 3. Monorepo layout

Managed with **Turborepo** + **pnpm workspaces**. The Python service is a sibling workspace with its own
`package.json` wrapper so `turbo run dev` / `turbo run build` orchestrate both languages uniformly.

```
settl-agent/
├── apps/
│   └── web/                      # Next.js 15 (App Router) + MUI dashboard
├── services/
│   └── agent/                    # FastAPI + LangChain + paypal-agent-toolkit (Python)
├── packages/
│   └── shared-types/             # TS types generated from the FastAPI OpenAPI schema
├── infra/
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
├── .env                          # single source of truth for ALL credentials (gitignored)
├── .env.example                  # committed template, no real values
├── turbo.json
├── pnpm-workspace.yaml
├── SA-Arch.md                    # this file
└── Track.md                      # task tracker
```

**Why one `.env` at the root, not one per service**: Docker Compose's `env_file: ../.env` injects the same
file into every container. No value is ever hardcoded anywhere in source — every secret, URL, and flag is read
from environment variables, validated at startup (see §8), and the app refuses to boot if something required is
missing. That "fail fast at startup" behavior is what actually prevents the 2am "crashed because a key was
empty" class of bug — not careful coding discipline, which doesn't scale under deadline pressure.

---

## 4. The layering pattern — Controller → Service → Repository → DTO

You asked what this looks like in practice. Here it is, traced through one real request: **a dispute comes in,
gets classified, and gets auto-resolved.**

```
HTTP request
   │
   ▼
┌─────────────┐   validates input shape, has ZERO business logic,
│  CONTROLLER │   just: parse request → call service → return response
│  (router)   │   lives in: services/agent/src/api/v1/disputes.py
└─────┬───────┘
      │ calls
      ▼
┌─────────────┐   the actual business logic / use case.
│   SERVICE   │   orchestrates: "to resolve a dispute, first fetch it,
│             │   then classify it, then act on it, then persist it"
│             │   knows NOTHING about HTTP or SQL — pure logic.
│             │   lives in: services/agent/src/services/dispute_service.py
└─────┬───────┘
      │ calls
      ▼
┌─────────────┐   abstracts WHERE data comes from / goes to.
│ REPOSITORY  │   "get_dispute()" might hit PayPal's API, a Postgres
│             │   table, or a cache — the Service doesn't know or care.
│             │   lives in: services/agent/src/repositories/
└─────┬───────┘
      │ returns
      ▼
┌─────────────┐   the DATA SHAPE that crosses each boundary.
│     DTO     │   a Pydantic model: "a DisputeDTO always has these
│             │   fields, these types, validated automatically."
│             │   Decouples your API contract from your DB schema —
│             │   you can change the database without breaking the API.
│             │   lives in: services/agent/src/schemas/
└─────────────┘
```

**Why this separation matters for a hackathon, concretely**: when a judge's PayPal sandbox call is slow or
flaky, you swap the Repository implementation (e.g., add a cache) without touching the Service's business
logic. When you add Postgres persistence on Day 4, the Service code doesn't change — only the Repository does.
And every Service method is unit-testable with a fake Repository, no real network calls needed (see §11).

### Worked example: `POST /v1/disputes/{id}/resolve`

```
disputes.py (Controller)
  → DisputeResolveRequestDTO validates the incoming body
  → calls dispute_service.resolve(dispute_id)

dispute_service.py (Service)
  → paypal_repo.get_dispute(dispute_id)          # Repository call
  → llm_provider.classify_risk(dispute)           # Service calls another service
  → if low_risk: paypal_repo.accept_claim(id)     # Repository call (writes to PayPal)
  → audit_repo.save(decision_record)              # Repository call (writes to Postgres)
  → returns DisputeResolutionDTO

disputes.py (Controller)
  → returns DisputeResolutionDTO as JSON, HTTP 200
```

Every arrow above is logged with a request ID (§9), so you can trace exactly what happened for any dispute by
grepping one ID.

---

## 5. Service responsibilities

| Service | Owns | Does NOT own |
|---|---|---|
| `apps/web` (Next.js) | Dashboard UI, MUI components, client state, proxying requests to `agent` via Next.js API routes (holds the bearer secret server-side, never exposed to the browser) | Any PayPal/LLM calls directly |
| `services/agent` (FastAPI) | PayPal toolkit calls, LLM reasoning, business logic, persistence, queue jobs | Rendering anything |
| `redis` | Queue backend (Arq), rate-limit counters, response cache | Durable business data |
| `postgres` | Durable ledger: settlements, dispute decisions, audit log | PayPal's own system of record (PayPal sandbox remains the source of truth for money movement; Postgres is OUR mirror for fast queries and audit trail) |

---

## 6. Frontend architecture (`apps/web`)

```
apps/web/
├── src/
│   ├── app/
│   │   ├── dashboard/page.tsx
│   │   ├── api/                      # BFF layer — holds secrets, proxies to agent service
│   │   │   ├── settlements/route.ts
│   │   │   └── disputes/route.ts
│   │   ├── error.tsx                 # route-level crash boundary (App Router convention)
│   │   └── global-error.tsx          # root-level crash boundary
│   ├── components/
│   │   ├── common/                   # AppButton, StatusChip, DataTable, ErrorFallback —
│   │   │                             # thin wrappers over MUI primitives, app-wide defaults
│   │   ├── layout/                   # AppShell, Sidebar, Topbar
│   │   ├── disputes/                 # feature components, COMPOSED from common/
│   │   └── settlements/
│   ├── hooks/                        # custom hooks — see §7
│   │   ├── useSettlements.ts
│   │   ├── useDisputes.ts
│   │   └── useReasoningLog.ts
│   ├── lib/
│   │   ├── apiClient.ts              # fetch wrapper, normalizes every error into one shape
│   │   ├── theme.ts                  # MUI theme — single source of design tokens
│   │   └── logger.ts                 # pino, browser-safe — see §9
│   ├── providers/
│   │   ├── ErrorBoundaryProvider.tsx
│   │   ├── ThemeProvider.tsx
│   │   └── QueryProvider.tsx         # TanStack Query — see §10
│   └── types/                        # imported from packages/shared-types
└── tests/
```

**MUI usage**: one `theme.ts` is the only place colors/spacing/typography are defined (design tokens, not
scattered `sx` overrides). `components/common/` wraps MUI primitives so the rest of the app never imports
`@mui/material` directly for anything reusable — it imports `components/common`. That's what makes components
actually reusable instead of each screen re-implementing its own button variant.

---

## 7. Hooks philosophy (so `useEffect`/`useState`/`useMemo` don't become spaghetti)

| Hook | Use it for | Don't use it for |
|---|---|---|
| `useState` | Local UI state only (is a modal open, which tab is selected) | Server data — that belongs in a custom hook backed by TanStack Query |
| `useEffect` | Synchronizing with something OUTSIDE React (subscriptions, a resize listener) | Deriving a value from props/state — that's a plain calculation or `useMemo` |
| `useMemo` | Expensive derived values (aggregating grid rows, computing totals across hundreds of records) | Trivial calculations — don't memoize `a + b` |
| Custom hooks (`useSettlements`, etc.) | Encapsulating fetch + loading + error state so **components stay declarative** — a component calls `useDisputes()` and gets `{data, isLoading, error}`, full stop | — |

Rule of thumb: if you're writing a `useEffect` that calls `setState`, ask whether that's actually a data-fetch
(→ belongs in a custom hook with TanStack Query) or a derived value (→ belongs in `useMemo` or just a plain
variable computed during render).

---

## 8. Backend architecture (`services/agent`)

```
services/agent/
├── src/
│   ├── api/v1/                       # Controllers
│   │   ├── disputes.py
│   │   ├── settlements.py
│   │   └── health.py                 # /healthz, /readyz — Docker healthchecks
│   ├── core/
│   │   ├── config.py                 # pydantic-settings — typed, validated env config
│   │   ├── logging.py                # structlog setup + request-id middleware
│   │   ├── errors.py                 # custom exceptions + global exception handlers
│   │   ├── security.py               # bearer-token auth dependency
│   │   └── rate_limit.py             # slowapi + Redis
│   ├── services/                     # business logic
│   │   ├── settlement_service.py
│   │   ├── dispute_service.py
│   │   └── llm_provider.py           # Gemini ⇄ Ollama swap, see §12
│   ├── repositories/                 # data access
│   │   ├── paypal_repository.py      # wraps paypal_agent_toolkit calls
│   │   └── ledger_repository.py      # Postgres persistence (SQLAlchemy)
│   ├── schemas/                      # DTOs (Pydantic)
│   │   ├── dispute_dto.py
│   │   ├── settlement_dto.py
│   │   └── common_dto.py
│   ├── models/                       # SQLAlchemy ORM models (DB tables, NOT the same as DTOs)
│   │   ├── dispute.py
│   │   ├── settlement.py
│   │   └── audit_log.py
│   ├── workers/                      # Arq queue consumers
│   │   ├── tasks.py
│   │   └── worker.py
│   └── main.py                       # FastAPI app factory, mounts routers + middleware
├── tests/
│   ├── unit/                         # services + repositories, everything external mocked
│   └── integration/                  # real sandbox calls, run separately/slower
├── pyproject.toml                    # uv-managed
├── .python-version                   # pinned to 3.12 (NOT system 3.14 — see local setup)
└── Dockerfile
```

**Why DTOs are separate from ORM models**: your database schema will change as the project evolves (adding a
column, renaming something). If the API response shape is generated directly from the DB model, every DB
change becomes a breaking API change. The DTO is a deliberate, stable contract you control explicitly.

---

## 9. Logging — no `console.log`, no `print()`, everything traced

- **Backend**: `structlog`, JSON output. A middleware generates a UUID per incoming request and binds it to
  every log line emitted during that request's lifecycle — controller entry, each service step, each
  repository call (PayPal API, LLM call, DB write), and the final response. This is what "track the log of
  each thing" actually means in practice: grep one request ID, see the complete trace of what the agent did
  and why.
- **Frontend**: `pino` (not `console.log`) via `lib/logger.ts`. ESLint rule `no-console: error` enforced in
  CI/lint so this isn't just a convention, it's a build failure if violated.
- **The reasoning log is a first-class feature, not just ops logging**: every LLM classification decision
  (risk score, rationale, action taken) is persisted to `audit_log` and surfaced in the dashboard UI — this is
  the "make the AI legible" differentiator from the earlier strategy discussion, and it reuses the same
  structured-logging pipeline.
- **Explicitly out of scope for the hackathon timeline**: a full OpenTelemetry collector + Grafana/Jaeger stack.
  Structured JSON logs + request-id correlation give you 90% of the debugging value for 10% of the setup time.
  Worth revisiting post-hackathon, not now.

---

## 10. New technology additions (beyond what you listed) and why

| Addition | Problem it solves |
|---|---|
| **Redis** | One box, three jobs: Arq queue backend, rate-limit counters, and a cache for PayPal reporting calls (`list_transactions`) so the dashboard doesn't re-hit PayPal's API — and doesn't re-hit Gemini's free-tier quota — on every page refresh. |
| **Arq** (async Redis queue, Python) | Invoice sending and dispute classification both involve external-API latency (PayPal, Gemini). Doing these inline in the HTTP request handler means a slow PayPal/Gemini response makes your API feel broken. Arq lets the controller return immediately ("accepted, processing") while the actual work happens async — this is also the correct pattern for PayPal webhooks specifically: acknowledge fast, process after. |
| **slowapi + Redis** | Rate limiting — inbound (protects your API from being hammered) AND a separate token-bucket around outbound LLM calls (protects your free-tier Gemini quota from being blown through by a bug or a judge double-clicking). These are two different concerns, both needed. |
| **pydantic-settings** (Python) / env validation at boot (TS) | App refuses to start if a required env var is missing, instead of crashing confusingly mid-request later. |
| **SQLAlchemy + Alembic** | Versioned DB schema migrations — "production grade" means someone (future you) can see exactly how the schema evolved. |
| **TanStack Query** (frontend) | Replaces manual `useEffect` fetch-and-setState boilerplate with built-in caching, retries, and loading/error states — directly supports the hooks philosophy in §7. |
| **Sentry (optional, stretch)** | Crash/error tracking dashboard. Not required for MVP — flagged here as the obvious next step if time allows, since you specifically asked about not disappointing on "crashing." |

---

### 10.1 Known gotcha: MUI 9.5.0 + React 19 component-prop typing

Broader than first scoped (originally found on `Stack`'s `justifyContent`/`alignItems`; also hit `Typography`'s
`fontWeight`/`textAlign` while building the landing page + overview stats). In this exact MUI/React/`@types/react`
combination, several MUI components' documented "own props" fail TypeScript overload resolution when passed
directly — a genuine upstream type-definition issue, not a config problem. **Workaround, applies everywhere**:
put the affected prop in `sx={{ ... }}` instead of passing it directly (`Stack`'s `spacing` and `Typography`'s
`gutterBottom`/`color`/`variant` are unaffected — only some props trip it; if a build fails with "No overload
matches this call" pointing at a prop that's documented as valid, move that one prop into `sx` and rebuild).

## 11. Testing

- **Python**: `pytest`. Unit tests for `services/` (business logic) and `repositories/` (with PayPal toolkit
  and LLM calls mocked) — test the money math (split calculations) and decision logic (risk thresholds) hard.
  Integration tests that hit real PayPal sandbox live separately and run less often.
- **Frontend**: `vitest` for hooks and `apiClient` logic; component tests for `common/` (the reusable pieces
  are exactly what's worth testing — they're used everywhere).
- Philosophy: test business logic and money math exhaustively; don't write tests that just re-assert a
  third-party SDK does what its own docs already promise.

---

## 12. LLM provider — Gemini (deployed) ⇄ Ollama (local dev)

`services/agent/src/services/llm_provider.py` exposes one function:

```python
def get_llm(provider: Literal["gemini", "ollama"] = settings.LLM_PROVIDER) -> BaseChatModel:
    ...
```

Driven entirely by `LLM_PROVIDER` in `.env`. Gemini 3.8 Flash (free tier) is the default for anything deployed
— judges hitting your Render URL get a hosted, consistent experience with no local setup. Ollama + `qwen3:8b`
(native tool-calling, ~8GB at Q4 quantization) is for your local dev loop so you're not burning Gemini quota on
every test run. Swapping is a one-line env change, which is itself a legitimate "Technological Implementation"
talking point for the demo video.

**Note (confirmed live, 2026-11-03)**: `gemini-2.5-flash` is retired for new accounts (404 "no longer
available to new users"). `gemini-3.8-flash` is current and works through the same `generateContent` API
`langchain-google-genai` already uses — no need to migrate to Google's newer Interactions API. If a future
model retirement happens again, check with a direct `curl` against `generativelanguage.googleapis.com` before
assuming the integration needs rework — it's usually just the model string.

---

## 13. Docker

`infra/docker-compose.yml` services: `web`, `agent`, `worker` (Arq consumer), `redis`, `postgres`. One root
`.env` injected into every container via `env_file`. Each service has its own multi-stage `Dockerfile` (small
final images, no build tooling shipped to production). `docker compose up` boots the entire stack locally,
identical to what gets deployed.

---

## 14. Local setup required (checked against this machine, 2026-11-03)

| Tool | Status | Action |
|---|---|---|
| Node v24.13.0, pnpm 12.5.1 | ✅ ready | none |
| Docker 29.9.2 + Compose v5.6 | ✅ ready | none |
| Git 2.52.0 | ✅ ready | none |
| Python | ⚠️ system is 3.14.7 (too new for safe compatibility) | install `uv`, pin project to 3.12 via `uv python install 3.12` — isolated, doesn't touch system Python |
| `uv` | ❌ not installed | `winget install astral-sh.uv` (or see astral.sh/uv install docs) |
| Ollama | ❌ not installed | only needed for local LLM dev loop — install when we reach that step, not blocking Day 1 |

---

## 15. Open architectural decisions (see `Track.md` for live status)

- Confirm Postgres + Redis addition is wanted (adds 2 Docker services) vs. a leaner PayPal-only state model.
- Confirm PayPal account path: existing personal/business PayPal account to log into developer.paypal.com, or
  fresh signup needed first.
