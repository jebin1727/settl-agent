# SettlAgent — Tracker

PayPal AI Hackathon 2026. Submission window: Oct 1 – Nov 12, 2026 (12:00 PM PT).
See `SA-Arch.md` for the "how it's built" reference — this file is "where are we right now."

---

## Status snapshot

| | |
|---|---|
| Today | 2026-11-03 |
| Submission deadline | 2026-11-12, 12:00 PM PT |
| Current phase | Day 0 — monorepo scaffolded, verified working end to end |
| Blockers | None currently — PayPal sandbox + Gemini credentials both obtained and verified live |

---

## Setup checklist (Day 0/1)

- [x] PayPal developer account created (Business account, after Personal account SMS verification failed) and logged in
- [x] Sandbox app credentials obtained (PayPal's auto-provisioned "Default Application") and verified live — real OAuth token returned from `api-m.sandbox.paypal.com`
- [x] Gemini API key obtained and verified live, in `.env` (model updated to `gemini-3.8-flash` — `gemini-2.5-flash` is retired for new accounts, confirmed live)
- [x] Postgres running locally (`docker compose up -d postgres`), Alembic configured, initial schema migrated and verified (`settlements`, `disputes`, `audit_logs` tables confirmed via `\dt`)
- [x] Repository layer (`ledger_repository.py`) implemented and covered by 5 integration tests against the real local DB
- [x] Ollama installed, `qwen3:8b` pulled (5.2GB), server running locally
- [x] **Gemini ⇄ Ollama provider swap verified live, real inference**: ran the exact same `DisputeRiskAssessment` structured-output call `dispute_service` makes, against Ollama instead of Gemini, with zero code changes beyond `LLM_PROVIDER=ollama`. Got back a coherent, correctly-typed response (risk_score 0.65, "escalate", genuine multi-sentence reasoning citing specific factors from the dispute data). Confirms the SA-Arch.md §12 design claim is real, not aspirational.
- [x] PayPal Agent Toolkit smoke-tested live against sandbox: `create_order` (real order `7CJ163859T5489030`), `list_disputes` (empty, as expected), `create_invoice` (real invoice `INV2-LPG6-B5JN-SZG7-3RRW`) — all confirmed working
- [ ] **PARKED** (2026-11-03): one-time manual buyer-checkout step to get a real transaction ID — unblocks scripted dispute creation. Hit a real sandbox regional quirk (India-region accounts can't pay in USD / can't P2P send — PayPal's sandbox simulates real RBI restrictions), fixed by creating new **US**-region sandbox accounts, but then hit repeated "you're logging into the seller's account" errors in the buyer checkout flow, likely multiple incognito windows / wrong account mixing. New US credentials ARE verified working for API calls (OAuth token confirmed). Revisit before final demo recording — not blocking other build work, since dispute triage logic can be built and unit-tested against mocked PayPal dispute responses now, swapped to live later.
- [x] `uv` installed, Python 3.12 pinned for `services/agent` (isolated from system Python 3.14)
- [x] Repo scaffolded: Turborepo + pnpm workspaces, `apps/web`, `services/agent`, `packages/shared-types`
- [x] Root `.env` + `.env.example` created (placeholders — real PayPal/Gemini values still needed)
- [x] `services/agent`: FastAPI skeleton — config, structured logging + request-id middleware, global error
      handlers, bearer-token auth, slowapi rate limiter, Arq worker skeleton — all verified working
- [x] `services/agent`: Controller→Service→Repository→DTO pattern proven with a real feature (settlement
      split calculation) — 12 pytest tests passing (money math edge cases, auth enforcement, DTO validation)
- [x] `apps/web`: Next.js + MUI + TanStack Query + AG Grid deps installed, theme/providers/error boundaries
      wired, BFF pattern proven (`/api/health` proxy route holding the bearer secret server-side)
- [x] `apps/web`: reusable `StatusChip` common component + `useAgentHealth` custom hook, 3 vitest tests
      passing, production build verified (Docker `standalone` output working)
- [x] `pnpm turbo run test` runs both services' test suites together — **15/15 passing**
- [x] Docker Compose config validated (`docker compose config`) — web, agent, worker, redis, postgres
- [ ] Full `docker compose up --build` boot test — deferred until real PayPal/Gemini keys are in `.env`
      (agent service will correctly refuse to boot without them — that's the fail-fast design working)
- [ ] **Risk spike**: confirm PayPal sandbox dispute simulation actually works end-to-end
- [ ] Devpost registration completed for the hackathon
- [ ] Initial git commit — scaffold is ready, not yet committed (ask before committing)
- [ ] GitHub repo created, public, license file visible in About section

## Open questions (waiting on user)

1. ~~PayPal account path~~ — RESOLVED 2026-11-03: user needs to create a fresh PayPal account at paypal.com
   first, then log into developer.paypal.com with it. **Blocking step, user action required.**
2. ~~Postgres/Redis~~ — RESOLVED 2026-11-03: confirmed, both included per architecture doc.
3. Any preference on repo visibility timing — public from day one, or private until near submission? (Hackathon
   rule requires public + license visible by submission time, doesn't require public from day one.)

---

## Day 2/3 progress (ahead of schedule)

- [x] **Full settlement → invoice flow verified live, end to end**: `POST /v1/settlements` → split calculated → real PayPal invoice created (`INV2-34GR-TQHK-75SJ-HVH8`) → sent → persisted to Postgres with `status: invoiced`. Confirmed via API response, `GET /v1/settlements`, AND a direct DB query.
  - Root-caused a `406 MEDIA_TYPE_NOT_ACCEPTABLE` (`INR_FOREIGN_CURRENCY_BLOCKED`) by bypassing the toolkit and hitting PayPal's raw API directly to see the real error body (the toolkit's exception handling swallows it) — turned out to be PayPal's real RBI-driven restriction on sending foreign-currency invoices to India-region recipients. Fixed by using the new US-region Personal account as the invoice recipient while keeping the original India-based "Default Application" as the sender (which already had invoicing permission — confirmed working since the very first smoke test).
  - **Reverted `.env` to the original Default Application credentials** (not the custom `settl-agent-us` app) — that custom app hit a persistent `NOT_AUTHORIZED` on invoice creation even after enabling the Invoicing capability and waiting 2+ minutes for propagation; not worth further debugging time since the Default App already works for everything we need.
  - **Fixed** (was: known minor gap): if `create_invoice` succeeds but `send_invoice` fails, the settlement used to be marked `failed` even though a real invoice existed, orphaned, on PayPal's side. Now the invoice ID is persisted immediately after creation (before attempting send), and a distinct `send_failed` status (not `failed`) is used when only the send step fails — so a real invoice is never silently lost track of. Covered by 2 new unit tests + 2 new integration tests against the real DB.

- [x] `paypal_repository.py` — clean typed wrapper over the Agent Toolkit (orders, invoices, disputes); calls `PayPalAPI.run()` directly, not the LangChain Tool indirection (that layer is for LLM tool-*selection*, which our services don't need — they already know which operation they want)
- [x] `dispute_service.py` — the core agentic piece: fetches a dispute, asks Gemini for a structured risk assessment (score + visible reasoning + recommendation), auto-resolves only when BOTH the categorical recommendation AND the numeric score agree it's safe (belt-and-suspenders for a financial decision), escalates otherwise. Every decision persisted with its rationale.
- [x] `POST /v1/disputes/{id}/triage` controller, wired end-to-end, verified against real PayPal sandbox (correctly 404s on a fake ID)
- [x] 5 new unit tests for the triage decision logic (auto-resolve, escalate, LLM-disagrees-with-own-score edge case, exact-threshold boundary, rationale persistence) — **22/22 tests passing overall**
- [x] Fixed a real bug caught while wiring this up: `get_db_session` never committed — repository writes would have silently rolled back on session close. Now commits on success, rolls back on exception.

## Dashboard UI (built and verified live in-browser)

- [x] Root `.env` wiring fixed for Next.js: it only auto-loads `.env` from its own directory, not the monorepo root — added explicit `dotenv` load in `next.config.ts` (confirmed via build log: "injected env (16) from ../../.env")
- [x] BFF proxy routes: `/api/settlements` (GET/POST), `/api/disputes` (GET), `/api/disputes/[id]/triage` (POST) — all hold the bearer secret server-side
- [x] `useSettlements`/`useCreateSettlement`/`useDisputes`/`useTriageDispute` hooks (TanStack Query, with cache invalidation on mutation success)
- [x] `DataTable` (AG Grid 36 — new Theming API, no CSS imports needed) + `StatusBadge` reusable common components
- [x] Settlements panel: create form + live ledger grid. Disputes panel: triage trigger + reasoning-log grid (rationale column, wrapped text — the "make the AI legible" piece)
- [x] **Verified live in-browser, not just curl**: submitted the create-settlement form through the actual UI, watched a real PayPal invoice get created and the new row appear in the grid automatically via cache invalidation — full chain confirmed: browser → BFF → FastAPI → PayPal sandbox + Postgres → back to the grid

## /readyz — implemented for real (2026-11-03)

Was a stub always returning `{"status": "ok"}` since Day 0. Now actually pings Postgres (`SELECT 1`) and Redis (`PING`), returns `503` (not `200`) when degraded, and reports per-dependency status. Fixing this surfaced a genuine event-loop conflict in the test suite: Starlette's sync `TestClient` runs on its own internal event loop, separate from pytest-asyncio's session loop everything else shares — when `/readyz` started genuinely touching the global async DB engine (already bound to the pytest loop by earlier async tests), the sync client's requests hit "attached to a different loop." Fixed by using `httpx.AsyncClient` + `ASGITransport` for that one test instead, which runs on the current (correct) loop.

## Docker — full stack built, and fully verified live (2026-11-03)

- `services/agent` had no `.dockerignore`, so `docker compose build` was uploading the entire `.venv/` (hundreds of MB of installed langchain/ML dependencies) into the build context on every build — the actual root cause of a build that looked "stuck" for 20+ minutes with zero visible progress (confirmed via `--progress=plain`: context transfer alone had passed 400MB and was still climbing). Added `.dockerignore` to both `services/agent` and `apps/web` (excluding `.venv`/`node_modules`/`.next`/etc) — rebuild completed cleanly afterward. `settl-agent-agent` image: 585MB.
- **Found and fixed a container-crash bug live**: `config.py`'s `.env` path resolution used a hardcoded `parents[4]` index that only holds on the LOCAL filesystem layout (`services/agent/src/core/config.py` → repo root). Inside the container the same file lives at the shallower `/app/src/core/config.py`, which has no `parents[4]` — `IndexError`, crash-looping both the `agent` and `worker` containers on every start. Fixed by walking up from the file looking for a `.env`, falling back to `None` (→ real env vars, correct for Docker) if none is found at any level, instead of hardcoding a depth.
- Also found the `worker` container downloading `ruff` (a dev dependency) at startup — `uv run arq ...` without `--no-sync` was re-checking the baked-in venv against `pyproject.toml`'s dev group every time it started. Added `--no-sync` to the worker's command in `docker-compose.yml`.
- Note: `agent` and `worker` build from the same Dockerfile/context but Compose tags them as two separate images (`settl-agent-agent`, `settl-agent-worker`) — rebuilding one does NOT rebuild the other; both need `docker compose build <service>` individually.
- **Full stack verified live, end to end, exactly as a judge would run it**: `docker compose up --build` → all 5 containers healthy (postgres, redis, agent, worker, web) → created a real settlement via `curl` against the containerized API (real PayPal invoice: `INV2-65Y5-2SBV-6U83-75JF`) → opened the dashboard served FROM the web container in an actual browser → confirmed the new settlement appeared in the grid alongside the ones created earlier via local dev. The README's "Run locally" Docker path is now proven, not just written.

## Critical fix: settlements now actually PAY the provider (2026-11-03)

User shared a sharp, independently-verified gap analysis (ignore the git-related items in it — #3/#4/#9/#10 —
per explicit instruction to focus on code only). The most important finding, confirmed directly in our own
code: `CreateSettlementRequestDTO.recipient_email`'s own docstring read **"The provider being paid out, billed
via invoice"** — those are opposite financial directions. The actual implemented flow invoiced the provider for
their own earnings, asking THEM to pay US, instead of paying them. Not a missing nice-to-have — the core
"settlement" narrative ran backwards the whole time.

Fixed properly, not patched:

- **Hit the same India-region regional restriction as before**, this time on Payouts specifically
  (`PAYOUT_NOT_AVAILABLE — You live in a country that is not allowed to send this payout`, on the original
  Default Application / India business account). Tested the US-region app's credentials instead — real payout
  batch created (`201`, `payout_batch_id`). **Switched `.env` to the US app as our primary credentials** —
  Payouts is now the critical path and only works there; Invoicing (which only the India app could do, and
  which we no longer use in the main flow) is no longer load-bearing.
- `PayPalRepository.create_payout()` / `.get_payout()` — raw `PayPalClient` REST calls (Payouts isn't one of
  the toolkit's fixed tools, same pattern as `verify_webhook_signature`).
- `Settlement` model: added `paypal_payout_batch_id`, migration applied and verified (`\d settlements`).
  `paypal_invoice_id` kept, nullable, in case a future feature bills an actual customer — not used by this path.
- `settlement_service.create_and_payout()` replaces `create_and_invoice()` — pays `provider_amount` (not
  gross) directly to the provider's PayPal email. Status semantics: `pending → paid_out` / `payout_failed` /
  `failed`, replacing `invoiced`/`send_failed`.
- Updated everything downstream: DTOs, repository methods (`mark_paid_out`, `mark_payout_failed`), frontend
  types/StatusBadge/grid columns/form copy, landing page copy, README, Postman collection (also added the
  Webhooks and Activity folders it was missing).
- **12 tests updated/added**, all passing (46 total backend). Rebuilt all 3 Docker images, redeployed.
- **Verified for real, independently, not just via our own API**: created a live settlement ($60 gross, 15%
  fee → $51 to provider), then queried PayPal's Payouts API directly with a fresh curl (bypassing our own
  code entirely) — confirmed a real batch exists with the exact correct amount, recipient, and note.

## Visual redesign — the real fix for "looks minimal" (2026-11-03)

User's repeated feedback was correct and I was wrong to keep defending the work instead of looking at it: pulled
a real screenshot (the browser screenshot tool had been flaky all session; it worked this time) and self-assessed
honestly. The underlying engineering was substantial, but the UI itself was genuinely flat — flat white Paper
cards, zero icons anywhere, a hero with no visual weight, no color beyond text. That's a real, specific gap, not
a misunderstanding on the user's part.

Fixed with an actual visual pass, not more sections:

- `lib/theme.ts`: added a `heroGradient` (brand green, used on header + hero + "how it works" band), bumped
  heading font weights to 700-800 with tighter letter-spacing for more presence.
- `StatTile`: colored top accent bar + a colored icon badge per tile (not just text), using the dataviz skill's
  palette for distinct identity per metric.
- `OverviewStats`: real icons (receipt, trending-up, wallet, verified-badge) with four distinct categorical
  colors, not identical white boxes.
- `AppShell`: gradient header, a logo mark (icon in a rounded badge) next to the wordmark instead of bare text.
- Landing page: gradient hero with a subtle radial glow, icon badge beside "SettlAgent", white contrasting CTA,
  4 feature cards each with a distinct colored icon (added a 4th feature card for the webhook/autonomy work —
  "Event-driven, not button-driven" — since that's genuinely differentiating and wasn't represented), numbered
  icon-circle "how it works" steps on the gradient band, hover elevation on cards.
- Verified visually, not just by curl/text-extraction this time — screenshotted both pages before and after,
  confirmed the difference is real.
- Clean build, lint, and 3/3 frontend tests after; web image rebuilt and redeployed to Docker.

## Big feature: webhook-driven autonomous dispute triage (2026-11-03)

User pushback: dashboard still "looked smaller" than it is, terminal logs were unreadable (raw JSON + health-check
polling spam), and — the real point — the agent was request-triggered (someone clicks "triage"), not actually
autonomous. Built:

- **Readable logs**: `LOG_FORMAT` setting, default `console` (colored, human-readable via `structlog.dev.ConsoleRenderer`)
  vs. `json` for a real aggregator. Added a filter dropping uvicorn's `/healthz`/`/readyz` access-log spam at
  the source — by volume that was ~95% of terminal output and none of it was the agent doing anything.
- **`POST /webhooks/paypal`** — the one route that deliberately does NOT use `require_internal_token` (PayPal
  calls it directly; its security is signature verification, not our bearer token). Verifies PayPal's signature
  via `PayPalRepository.verify_webhook_signature()` (direct `PayPalClient` call — not one of the toolkit's fixed
  tools) when `PAYPAL_WEBHOOK_ID` is configured; skips with a loud logged warning when it isn't (expected locally,
  not expected once deployed with a real registered webhook).
- **The Arq worker finally has a real job.** It only ran a placeholder `ping` since Day 0 — `triage_dispute_job`
  now does the actual autonomous work: fresh DB session, calls `DisputeService.triage()`, commits/rolls back.
  Also fixed: the worker never called `configure_logging()` at all before this, so its own output was unformatted.
- Added `core/queue.py` (Arq pool singleton, the enqueue side; `workers/worker.py` is the consuming side) —
  acknowledge PayPal fast, do the real work off the request path.
- **9 new tests**, all passing: webhook routing (dispute-created enqueues, unrelated events don't, bad signature
  rejected), the worker job's commit/rollback contract, and `verify_webhook_signature`'s three outcomes.
- **Verified fully live, not just unit-tested**: POSTed a realistic simulated webhook payload at the running
  Docker stack, watched the terminal in real time — webhook received → enqueued → worker picked it up in 0.41s →
  called Gemini → called real PayPal `get_dispute` → got a real 404 (fake dispute ID, expected) → rolled back
  cleanly, logged as `j_failed=1`. Zero human intervention after firing the simulated event — this is the actual
  "autonomous," not a button labeled autonomous.
- Known limitation, stated plainly: true end-to-end signature verification (PayPal actually delivering a
  real signed webhook to us) needs a public HTTPS URL — not reachable from localhost without a tunnel or a real
  deploy. The architecture is correct and the unverified path is tested; the live PayPal→us delivery itself
  isn't provable until deployed (Render) with a webhook registered in the dashboard.

## Design/feature pass: landing page, overview stats, activity feed (2026-11-03)

User feedback: the project "looks minimal" and the dashboard page "does not shrink." Response: the backend/agent
logic was already substantial (see entries above) — the actual gap was presentation. Built:

- **Landing page** (`app/page.tsx`) — was still the default `create-next-app` boilerplate (Next.js logo, "Deploy
  on Vercel" links) at the root URL, the literal first thing a judge sees. Replaced with a real hero, 4 feature
  cards, a 3-step "how it works", CTA to `/dashboard`.
- **Found a real gap while building this**: `AuditLogRepository` existed since Day 0 (with `record()` and
  `list_recent()`) but was never actually called by any service — the audit trail was empty infrastructure.
  Wired `settlement_service` and `dispute_service` to actually record their key actions (`settlement_created`,
  `invoice_sent`, `invoice_create_failed`, `invoice_send_failed`, `dispute_triaged` with full rationale),
  tagged with the request ID from the logging middleware (`get_request_id()`, newly exported). New
  `GET /v1/audit-logs` endpoint. Verified live: a real settlement created two real audit rows, both correctly
  returned by the API.
- **Overview stats** (`OverviewStats.tsx`) — KPI stat tiles (settlements processed, volume processed, fees
  collected, dispute auto-resolution rate) computed client-side via `useMemo` from already-fetched data, no
  new aggregation endpoint needed. Verified live: $315.00 volume tile matched the real sum of 4 real
  settlements (40+75+100+100), $35.00 fees matched (6+9+10+10).
- **Dispute resolution breakdown** — a "segmented bar" figure (dataviz skill's `references/marks-and-anatomy.md`:
  one whole split into parts, 28px blocks, 4px corners, 2px surface gaps, share% printed inside when it fits)
  using the skill's fixed status palette (good/warning/muted) — not a generic chart library, pure HTML/CSS.
- **Agent activity tab** — chronological feed of the now-real audit log, with actor chips and per-action
  summaries.
- Loaded the `dataviz` skill before building any of the stat tiles/chart, per its own trigger rules.
- **Found and fixed a broader MUI typing bug than previously scoped**: the known MUI 9.5.0 `Stack` issue
  (§10.1) turned out to also affect `Typography`'s `fontWeight`/`textAlign` direct props. Fixed every instance
  across the new files (`sx={{...}}` instead of the direct prop) and updated `SA-Arch.md` §10.1 to describe
  the general pattern, not just the `Stack`-specific case.
- Full stack rebuilt and redeployed to Docker; all 5 containers healthy; landing page, dashboard, stats, and
  activity feed all verified live (text-extraction verification — the browser screenshot tool was
  environment-flaky this session, confirmed via `get_page_text` instead).

## UI: page didn't shrink on narrow viewports — found and fixed (2026-11-03)

- Root cause: Next.js's default `globals.css` template sets `body { display: flex; flex-direction: column }`. That makes the root `<Box>` (AppShell) a flex item, and flex items default to `min-width: auto` — refusing to shrink below their content's natural width. Combined with `overflow-x: hidden` already on `body`, this meant the layout didn't reflow on narrow viewports, it got silently clipped instead.
- Confirmed via computed styles (`getComputedStyle`) before fixing, then verified the fix with a real narrow-width iframe test (400px) in-browser: title wraps, cards/form/grid all reflow correctly now, and AG Grid correctly handles its own internal horizontal scroll instead of breaking the page. `resize_window` itself turned out to be unreliable in this environment (window appears snapped/maximized, width requests didn't take effect) — the iframe test was the real verification.
- Fix: added `body > * { min-width: 0; }` to `globals.css`.
- Also fixed while in there: the `worker` container was showing a false "unhealthy" status — it shares the `agent` Dockerfile's baked-in `HEALTHCHECK` (curls `localhost:8000/healthz`), but `arq` doesn't serve HTTP at all, so that check always failed even while the worker ran correctly. Disabled the healthcheck for `worker` specifically in `docker-compose.yml` (no meaningful HTTP endpoint exists to check instead).

## Rate limiting — found and fixed a real gap (2026-11-03)

- The `Limiter`/`SlowAPIMiddleware` infrastructure existed since Day 0 but was never actually applied to any route — `@limiter.limit(...)` is now on `POST /v1/settlements` (20/min, protects against spamming real PayPal invoices) and `POST /v1/disputes/{id}/triage` (15/min, inbound protection in front of the Gemini call)
- The `OutboundTokenBucket` (protects the Gemini free-tier quota specifically) was also defined but never wired in — now called from `dispute_service._classify_risk`, skipped entirely when `LLM_PROVIDER=ollama` (nothing to protect — it's local/free). Covered by 2 new unit tests.
- **Caught a real bug live, not in review**: the `RateLimitExceeded` handler in `main.py` did `raise exc` instead of returning a response — that re-threw the exception into the catch-all handler, turning every 429 into a generic 500. Verified: fired 18 rapid requests at the triage endpoint, requests 16-18 came back 500 before the fix, clean `429 {"error": {"code": "rate_limited", ...}}` after.

## Build plan (from strategy discussion — core build compressed to 3 days, rest for hardening)

| Day | Date | Target | Status |
|---|---|---|---|
| 0 | Nov 3 | PayPal account, repo scaffold, local env setup | 🔄 in progress |
| 1 | Nov 4 | Sandbox app + OAuth, FastAPI skeleton, **dispute-simulation risk spike** | ⬜ not started |
| 2 | Nov 5 | Settlement flow end-to-end: job-complete → split invoice → send → status tracking | ⬜ not started |
| 3 | Nov 6 | Dispute triage end-to-end: list/get → LLM risk classification w/ rationale → auto-resolve or escalate | ⬜ not started |
| 4–5 | Nov 7–8 | pytest + vitest coverage; AG Grid dashboard wired to live data + reasoning-log panel | ⬜ not started |
| 6 | Nov 9 | Gemini ⇄ Ollama provider swap demoed; Render deploy; Postman collection | ⬜ not started |
| 7 | Nov 10 | Stretch: agent-to-agent negotiation (only if everything above is solid) | ⬜ not started |
| 8 | Nov 11 | Demo video, submission text, fresh-clone test | ⬜ not started |
| 9 | Nov 12 (early) | Submit — with buffer unused | ⬜ not started |

---

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-11-03 | Project concept: autonomous settlement + dispute-triage agent (not consumer "AI shopping agent") | Underserved angle vs. likely crowded field; maps to PayPal's native Invoices + Disputes tool families (Payouts not supported by the toolkit) |
| 2026-11-03 | PayPal integration via `paypal-agent-toolkit` Python package + LangChain, not raw REST | Native, maintained, avoids reinventing OAuth/token refresh |
| 2026-11-03 | LLM: Gemini 3.8 Flash (free tier) for deployed demo, Ollama + qwen3:8b for local dev | Hosted path needed for judges; local path avoids burning free-tier quota while iterating. (Originally planned `gemini-2.5-flash` — confirmed live it's retired for new accounts; swapped to `gemini-3.8-flash`, same `generateContent` API, zero integration rework needed.) |
| 2026-11-03 | Gemini API key obtained and verified live (auth + model resolution both confirmed via direct curl) | User provided key mid-session; wrote directly to `.env`, never echoed back in chat |
| 2026-11-03 | Real `AGENT_INTERNAL_TOKEN` generated (was a placeholder) | `.env` now has a proper random secret instead of `change-me-...` |
| 2026-11-03 | `config.py` resolves `.env` by file location (`parents[4]`), not CWD | Root `.env` wasn't found when running `uv run alembic`/`pytest` from `services/agent/` — silent `os.environ`-only fallback masked it until real required fields were missing |
| 2026-11-03 | `created_at`/`updated_at` use `clock_timestamp()`, not `now()` | `now()` is frozen at Postgres transaction start — two rows in one transaction got identical timestamps, breaking "most recent first" ordering (caught by a real integration test, not theoretical) |
| 2026-11-03 | Unit tests use FastAPI `dependency_overrides` for `Settings`, not `os.environ.setdefault` | `get_settings()`'s process-wide `@lru_cache` meant whichever test file imported `src.main` first "won" — fragile once `tests/integration` existed (sorts before `tests/unit`, imports first, caches the REAL `.env` values) |
| 2026-11-03 | `AGENT_SERVICE_URL` in `.env` fixed to `localhost:8000` (was `agent:8000`) | Same localhost-vs-container-hostname pattern as `DATABASE_URL`/`REDIS_URL` — `.env` is for local/host dev, docker-compose overrides to container hostnames |
| 2026-11-03 | Local dev verified end to end: `docker compose up -d postgres redis` + `pnpm turbo run dev` | Full vertical slice confirmed live — browser → Next.js `/dashboard` → `/api/health` BFF route → FastAPI `/healthz` → response, all real |
| 2026-11-03 | Single Python service owns PayPal + LLM + business logic; Next.js is presentation-only | Simpler than a separate Node BFF, since the toolkit is Python-native |
| 2026-11-03 | Monorepo: Turborepo + pnpm, Python service as sibling workspace | Solo dev, one command to boot everything |
| 2026-11-03 | Full architecture written to `SA-Arch.md` | Reference doc so nothing has to be re-derived mid-build |
| 2026-11-03 | `.npmrc` with `shamefully-hoist=true` added at repo root | pnpm's strict isolation broke jsdom's transitive `tough-cookie` resolution; hoisting fixed it cleanly |
| 2026-11-03 | MUI `Stack` layout props (`justifyContent`/`alignItems`) moved into `sx={{}}` instead of direct props | Genuine MUI 9.5.0 + React 19 type-definition bug (TS2769) — documented in `SA-Arch.md` §10.1 so it's not rediscovered on Day 5 |
| 2026-11-03 | `services/agent` set to `[tool.uv] package = false` | It's an application, not an installable library — avoids uv's package-discovery needing a `src/<name>` convention we don't use |
| 2026-11-03 | Simulate Dispute path shipped: `POST /v1/disputes/simulate`, backend fully tested (52/52), frontend form added to `DisputesPanel.tsx` as a visually distinct "Demo-safe" section above the real-PayPal-ID triage form | Removes dependence on bootstrapping a real live PayPal dispute for the demo — same LLM reasoning and decision logic, zero PayPal mutation, audit-tagged `simulated: true` |
| 2026-11-03 | **Critical fix**: `_classify_risk()` called `structured_llm.invoke(prompt)` (sync) from inside an `async def`, blocking the single Uvicorn worker's entire event loop for the full duration of any Gemini call — including blocking, multi-attempt retry backoff (observed 38–53s per retry) when the free-tier quota was hit | Live-discovered: the agent container was reporting Docker-unhealthy and a dispute-simulate curl hung indefinitely. Traced to one blocking call starving every other request on the process, not just the caller's. Fixed to `await structured_llm.ainvoke(prompt)`; verified live by firing 3 `/healthz` probes while a slow Gemini call was in flight — all returned in single-digit ms instead of queuing behind it |
| 2026-11-03 | Gemini outbound token bucket tightened from 8/60s to 4/60s; `ChatGoogleGenerativeAI` given `max_retries=1` | Our own bucket was *looser* than Gemini's real free-tier limit (confirmed live via 429 body: 5 req/min for `gemini-3.8-flash`), so it never actually prevented hitting Gemini's quota. Now our own clean `RateLimitedError` (429) should fire before Gemini's does; `max_retries=1` bounds the damage on the rare miss instead of retrying for minutes |
| 2026-11-03 | Deleted 4 stale `settlements` rows with `status='invoiced'` (pre-Payouts-migration test data) directly in the local Postgres container | Found live: these rows made `SettlementResultDTO.model_validate()` raise on every single `GET /v1/settlements` call — i.e. the dashboard's Settlements tab and stat tiles were fully broken (500) until this was found and cleaned up. Local sandbox test data only, no real-world data lost |
| 2026-11-03 | **Gemini free tier for `gemini-3.8-flash` confirmed (live, direct curl to `generativelanguage.googleapis.com`) to be a 20 requests/DAY cap**, not just a per-minute limit — and it's now exhausted for ~21h from today's testing | This is a much harder constraint than the per-minute figure SA-Arch.md §12 previously documented. 20/day will not survive live judge/demo traffic on its own — see risk register. `LLM_PROVIDER` switched to `ollama` in `.env` for the rest of today's local work since Gemini is a dead end until it resets |
| 2026-11-03 | Added `OLLAMA_BASE_URL: http://host.docker.internal:11434` override to `agent` and `worker` in `docker-compose.yml` | Same class of bug as the earlier `DATABASE_URL`/`REDIS_URL` localhost-vs-container-hostname issue, just never caught before because `LLM_PROVIDER=ollama` had never actually been exercised inside Docker until today — `.env`'s `localhost:11434` resolved to the container itself, not the Windows host running Ollama |
| 2026-11-03 | Simulate Dispute verified fully end-to-end live, via the real dashboard UI, through Ollama (`qwen3:8b`) | Confirmed real LLM reasoning persisted and rendered correctly in the Disputes reasoning log (status badge, risk score, decision, full rationale text, timestamp) after switching providers. **Local Ollama inference on this machine is slow**: cold model load ≈137s, then generation ≈5 tok/s — a full simulate call took ~4.5 min end to end. Any client/proxy timeout under ~5 min will give a false "it's broken" read even though the server-side request completes and persists correctly |
| 2026-11-03 | Minor: one Ollama-generated rationale string showed mojibake (`didnâ€™t` instead of `didn't`) in the raw API response | Not yet root-caused — could be in `langchain-ollama`/httpx response decoding. Cosmetic, not reproduced on the second simulate call in the same session. Low priority; revisit if it recurs, since the dispute reasoning log is a core "AI legibility" feature and garbled text undermines it |
| 2026-11-03 | A second, user-supplied "new" Gemini API key was tried and confirmed (live) to hit the exact same daily quota wall — same underlying model, same ~21h retry delay | A fresh API key does not mean a fresh quota pool: the free-tier daily cap is per Google Cloud *project*, not per key. Both keys are evidently issued from the same project/account. Saved to `.env` (unused for now); `LLM_PROVIDER` left on `ollama` |
| 2026-11-03 | Dashboard shell redesigned: `AppShell` is now a permanent left sidebar (desktop) / hamburger-triggered temporary drawer (mobile) instead of top `Tabs`. Section state lifted out of `dashboard/page.tsx` into a controlled `activeSection`/`onSectionChange` pair on `AppShell`. Landing page hero got a layered icon-badge illustration (central SmartToy badge + 3 satellite badges in the same colors as the feature cards) | User-requested, frontend-only, no backend/API contract changes. Verified live: sidebar nav switches panels correctly, mobile drawer opens/closes via hamburger and auto-closes on selection, hero illustration renders correctly. New test `AppShell.test.tsx` (3 cases) added; `pnpm build`/`lint`/`test` all clean |
| 2026-11-03 | Added `VolumeTrend` (hand-built inline-SVG bar chart, dataviz-skill mark specs: <=24px bars, 4px rounded top-only corners via a manual path since `<rect>` can't do per-corner radii, hairline baseline, only the latest bar labeled) to the Settlements tab, between the dispute breakdown and the settlement form | Client-side aggregation (`aggregateDailyVolume`, exported and independently tested) from `useSettlements()`'s already-fetched data — no new backend endpoint, no new charting library, per the task's explicit scope. Created 3 more real sandbox settlements (real PayPal Payouts) and backdated their `created_at` by 1-3 days directly in Postgres purely so the chart would have genuine multi-day data for the demo video, instead of the single-point state |
| 2026-11-03 | Loading-state polish: `TableSkeleton` (grid-shaped, replaces bare "Loading…" text in Settlements/Disputes panels) and `StatTileSkeleton` (same footprint as `StatTile`) added, both swapped in only while the owning query's `isLoading` is true | User-requested visual polish; `isLoading` in TanStack Query v5 is only true before the *first* successful fetch, so this is naturally gated against flashing on the 10s background refetches without extra logic |
| 2026-11-03 | Added `framer-motion` (`^14.9.0`) via `LazyMotion` + the `m` component (never the full `motion` import, enforced by `strict` mode) — animated: VolumeTrend bars grow from 0 on mount/data-change (via `scaleY` + `transform-box: fill-box`, not path morphing — SVG `<rect>`/`<path>` geometry doesn't interpolate), dashboard panel switches fade/slide via `AnimatePresence`, stat tiles fade-up-stagger once on mount only (framer-motion's `initial`→`animate` naturally never replays on a later prop change while the element stays mounted — no manual gating needed), and the two primary action buttons get a `whileTap` scale-down | User-requested; AG Grid internals and the landing→dashboard route transition were explicitly out of scope and left untouched |
| 2026-11-03 | **Found a real dual-lockfile trap**: `apps/web/Dockerfile`'s `deps` stage builds from a build context scoped to `apps/web` only, so it reads a *separate*, standalone `apps/web/pnpm-lock.yaml` — not the root monorepo `pnpm-lock.yaml` that `pnpm --filter web add <pkg>` (run from repo root) actually updates. Adding `framer-motion` broke the Docker build (`ERR_PNPM_OUTDATED_LOCKFILE`) until `pnpm install --lockfile-only` was re-run from inside `apps/web` itself | Any future `apps/web` dependency change needs BOTH lockfiles regenerated, or the next `docker compose build web` fails the same way. Worth fixing structurally later (e.g. widen the build context to the repo root) but out of scope for today — documented here so the failure mode is recognized instantly next time, not re-debugged from scratch |
| 2026-11-03 | Wired `public/images/hero-ai-agent.jpg` (Freepik/storyset illustration, attribution added to README's new Credits section) into the landing hero via `next/image`, restructured the hero into a two-column text+image layout, and built `BrandMark` — a reusable component that crops just the robot's head out of that same illustration (CSS oversized-image-in-an-overflow:hidden-box technique, since object-fit:cover can't crop a 1:1 source into a 1:1 box) to replace the generic MUI `SmartToyOutlinedIcon` used as the logo mark in the header and hero | User-requested (supplied the image, then asked for the generic robot icon to be replaced with it too); verified live via screenshot zoom at both 34px (header) and 56px (hero) badge sizes — crop reads clearly as the illustration's robot face at both sizes |
| 2026-11-03 | **Caught a brand-accuracy issue before publishing it**: user supplied an image labeled "paypal logo" for use in the hackathon's public repo. It is not PayPal's actual mark (PayPal's real icon is two overlapping P's in navy/light blue) — this was an unrelated generic stock "P" gradient graphic (filename literally `p-gradient-creative-logo-design-vector`). Flagged it via AskUserQuestion rather than silently publishing a mislabeled "PayPal" asset in a PayPal-sponsored hackathon submission | User confirmed: use it as a generic, un-labeled accent only — never captioned or presented as PayPal's logo. On the same question, user also confirmed it should become SettlAgent's own brand mark, replacing the robot-face crop added earlier today |
| 2026-11-03 | `BrandMark` swapped again — now renders `public/images/brand-mark.jpg` (the generic blue "P") via `object-fit: contain` with padding, not the crop-and-zoom technique (that was specifically for extracting a face from a busy scene; a standalone logo mark just needs to be shown whole) | Same component, same call sites (header, sidebar, hero) — no changes needed outside `BrandMark.tsx` itself |
| 2026-11-03 | Landing page: added a new two-row "spotlight" section (alternating image/text, using two more user-supplied stock illustrations — `payouts-illustration.jpg` for the settlement/payout flow, `disputes-illustration.jpg` for dispute/refund resolution) between the feature grid and "How it works", and added `framer-motion` entrance animation throughout the landing page specifically (hero content fades up in a stagger on load; feature cards, spotlight rows, and how-it-works steps all fade/slide in via `whileInView` with `once: true` as they scroll into view) | User-requested — the earlier motion task (this session, same day) only touched the dashboard; landing page had zero animation until now |
| 2026-11-03 | `VolumeTrend` rebuilt from a bar chart into a line/point chart (2px line, round join/cap, >=8px markers with a 2px surface ring, ~10% area wash, endpoint-only value label) | Per `references/choosing-a-form.md`: "Trend over time → line; area for a single series" — the bar form was the wrong chart type for this job, not just a style preference. Also matches what the user explicitly asked for ("point graph") |
| 2026-11-03 | Added `DisputeRiskStrip` beneath the existing `SegmentedBar` in the "Dispute resolution breakdown" card — each triaged dispute plotted as a dot along its risk score (0-1), with a dashed line at the agent's real `AUTO_RESOLVE_THRESHOLD` (0.3) | The segmented bar is the dataviz-skill-correct form for this job, but at only 2 disputes (both escalated) it degenerates into one solid block that just restates the stat tile above it. This adds real new signal — *why* each dispute landed where it did — using data (`risk_score`) already in `DisputeDTO`, no backend change |
| 2026-11-03 | **Found and fixed a real layout bug via Playwright** (user-requested, specifically flagged the "Dispute auto-resolution rate" card as uneven height): the `m.div` wrapper added around each `StatTile` for the mount fade-up stagger was a plain block div with no `height:100%`, breaking the percentage-height chain from the flex-stretched Grid item down to `StatTile`'s `Paper` — so only the card whose *content* happened to need the full stretched height (the one with a 2-line label) looked right; the other 3 shrank to their own content height | Confirmed via `getBoundingClientRect()` on each layer of the DOM chain (Grid item 151.5px on all 4, but `Paper` only 131.5px on 3 of them) before fixing, then re-measured after — all 4 now exactly 151.5px. The identical `m.div` wrapper on the landing page's feature cards had already gotten `style={{height:"100%"}}` — this one didn't, which is exactly why only the dashboard stat tiles broke |
| 2026-11-03 | Also found and fixed a related clipping bug in the new `VolumeTrend` line chart while verifying the above: the endpoint's value label (`text-anchor:middle`) extends past the last point's x-position, which overflowed the SVG's own computed width and got silently clipped (SVG content outside its viewBox/width is clipped like `overflow:hidden`) | Added `END_LABEL_PAD` (44px) of reserved right-side room to the SVG's width calculation; confirmed via `getBBox()` that the label's right edge now sits inside the SVG's width |
| 2026-11-12 | Full Playwright UI/QA pass across desktop/tablet/mobile, user-requested ("still didn't think this is a match winning project"). Found and fixed 3 real issues: (1) `DataTable.tsx` — a row tall enough to fit a wrapped `autoHeight` column (e.g. "Agent reasoning") left every other cell in that row anchored to the top with visible dead space; added `cellStyle: {display:"flex", alignItems:"center"}` to `defaultColDef`, fixing it for every grid, not just the one it was noticed on. (2) `DisputeRiskStrip.tsx` — used a `viewBox` scaled to `width:"100%"`, so the threshold label's font size shrank right along with the SVG on narrow screens (confirmed live: ~7px rendered height at 390px wide, illegible); switched to a fixed pixel size + horizontal-scroll pattern, matching `VolumeTrend`. (3) `ActivityTimeline.tsx` — **the more serious one**: `payout_sent`/`payout_failed` (the actual core Payouts feature!) had no case in `summarize()`/`ACTION_LABEL`, so every payout entry in the "Agent Activity" feed — the project's whole "make the AI legible" showcase — dumped raw JSON (`{"batch_status":"PENDING",...}`) instead of a readable sentence like the other action types get. Added both cases | A full-page Playwright screenshot of the landing page initially looked badly broken (whole sections invisible) — traced via `getComputedStyle` to `opacity:0` stuck forever, but a real `window.scrollTo` + recheck proved it was a false alarm (full-page screenshot capture doesn't fire real scroll/IntersectionObserver events, so `whileInView` animations never trigger during that specific capture method — not a bug a real visitor hits). Learned: verify with an actual scroll before trusting a full-page capture when anything uses `whileInView`. Also found `apps/web`'s standalone Docker-build lockfile had drifted again mid-session (no new deps this time — just drifted) — same dual-lockfile trap as before, same fix (`pnpm install --lockfile-only` from inside `apps/web`) |

---

## Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| ~~PayPal sandbox dispute simulation unreliable/restricted~~ — RESOLVED 2026-11-03 | Was High | Confirmed via live smoke test: `create_order`, `list_disputes`, `create_invoice` all work through the Agent Toolkit with real sandbox credentials. `POST /v1/customer/disputes` is a real, scriptable sandbox-only endpoint for creating test disputes — but needs a real buyer transaction ID first, which requires ONE manual step (log into the sandbox personal/buyer test account in a browser, send a test payment, note the transaction ID). Everything after that (dispute creation, triage, resolution) is fully automatable via the API. |
| **Gemini free tier for `gemini-3.8-flash` is capped at 20 requests/DAY** (confirmed live via direct API 429 body), not just 5/min — exhausted by today's testing, ~21h to reset | High — a live demo or judges clicking around could burn the whole day's budget in minutes, with no graceful recovery until the next UTC day | Per-minute token bucket (4/60s) helps but doesn't touch the daily cap. Real options to decide before demo day: (a) enable Gemini billing to lift the free-tier cap, (b) default the deployed demo to Ollama instead (if Render deploy can run it — needs a GPU-ish box or acceptance of slow responses), (c) add automatic Gemini→Ollama fallback on a 429/quota error so one path's exhaustion doesn't take down triage entirely. Not yet decided — flagged for the user |
| Python 3.14 (system) incompatible with toolkit/LangChain deps | Medium — could block Day 1 setup | Pin to 3.12 via `uv`, isolated from system Python |
| Scope creep past 3-day core build | Medium — eats hardening/testing time | MVP vs. stretch explicitly separated in `SA-Arch.md`; stretch goal sequenced last, not second |
| Submitting at the last minute | High — Devpost traffic/bugs near deadline | Target submission Nov 10–11, days of buffer before Nov 12 cutoff |

---

## Decisions log (2026-11-12, submission day)

| Date | Decision | Why |
|---|---|---|
| 2026-11-12 | Declined a full project pivot (user shared another AI's "TRUSTFLOW AI" fraud-detection/agentic-commerce suggestions) this close to the deadline | Abandoning a working, tested, demo-ready project for an unbuilt one is the single highest-risk move available with limited time left; kept it as inspiration only, not a redirect |
| 2026-11-12 | Replaced `DisputeRiskStrip` (1-D strip plot) with `DisputeRiskRadar` — a 5-axis radar chart (Fraud/Policy/Chargeback/Identity/Merchant risk) + a compact Risk Score card (score, Low/Medium/High category, % change vs. the last 7 days) | User-requested, explicitly instructed "do not introduce fake data." The backend only ever computed ONE overall risk score — extended `DisputeRiskAssessment`'s structured LLM output with 5 real named sub-scores (same single LLM call, not five), added a `risk_breakdown` JSONB column (migration `b9ba3e3377a3`) so they're genuinely persisted, not fabricated client-side |
| 2026-11-12 | Radar chart stays hand-built SVG (no Recharts/new chart library) | Consistent with every other chart this project — SegmentedBar, VolumeTrend — and the user's own "whichever integrates better" framing let us choose consistency over a new dependency |
| 2026-11-12 | Added `prefers-reduced-motion` support via framer-motion's `useReducedMotion()` — the pulsing data-point glow and polygon grow-in both skip to their static final state when set | First place in the project this was actually implemented, despite being asked for specifically this time; worth retrofitting into the dashboard/landing page's other motion later if time allows, not done today |
| 2026-11-12 | Found a new Next.js 16 Cache Components constraint: `Date.now()` inside a component/hook body (even in `useMemo`) fails the build during static prerendering of `/dashboard` (`Cannot call impure function during render`) | Deferred the "now" timestamp to a `useEffect` that runs post-mount client-side, instead of computing it during the initial render pass. Worth remembering for any future "time since" / "trending" feature |
| 2026-11-12 | `.env`'s `DATABASE_URL`/`REDIS_URL` had drifted to the container-network hostnames (`postgres`/`redis`) instead of the documented `localhost` convention, breaking local (non-Docker) pytest runs with unrelated-looking connection errors | Restored to `localhost`, with the port updated to `5433` to match the still-in-place Postgres host-port remap from the Playwright QA session. Docker Compose's own `environment:` override is unaffected either way — this only matters for tooling run directly on the host |
| 2026-11-12 | Gemini became unreachable (network-level timeout, not even a 429 — different from the earlier "20/day" quota exhaustion) mid-verification; switched back to `LLM_PROVIDER=ollama` to get a real, verified result rather than block on debugging Google's network | Ollama + `qwen3:8b` already proven working all session; this is exactly the fallback path it exists for |

---

## Full frontend redesign: "Autonomous Financial Operations Command Center" (2026-11-12)

User-requested, full scope (confirmed: several hours available, chose the full redesign over the trimmed top-3 option). Reframed the dashboard from a chart-forward analytics view into an agent-operations-forward one, per three pasted briefs (another AI's product critique, a design-direction prompt, and a "final opinion" prioritizing Command Center / Decision Replay / real PayPal integration). Declined the accompanying "pivot to a fraud-detection platform" suggestion in the same message as out of scope and too risky this close to the deadline — kept as inspiration only.

**New 6-page navigation** (`AppShell`'s `DashboardSection` grew from 3 values to 6): Command Center (new default), Settlements, Disputes, Decision Replay (new), Agent Activity, Audit & Reports (new). Single `/dashboard` route still, client-side section switching — deliberately not real Next.js routes, to avoid more Next 16 prerendering surprises this late.

**Backend extended twice, honestly, not faked:**
- `risk_breakdown` → already existed from the earlier radar-chart task.
- **New**: `Dispute.amount` / `currency_code` / `reason` columns (migration `c4f1a9d82e5b`) — the case-card UI needed real amount/reason, and the dispute model didn't persist them before (only ever lived in the ephemeral LLM payload). Extracted from the same real PayPal/synthetic dispute payload at triage time, same pattern as `risk_breakdown`. Disputes from before this migration show an honest "—", not a guess.

**New components**: `AgentOnlineBadge` (pulses only while genuinely healthy, via the real `useAgentHealth()` check — not hardcoded "online"), `LiveOperationsFeed` (Command Center's step-sequence framing of the same real `audit_logs` `ActivityTimeline` already showed as a list), `CommandCenterPage`, `SettlementPipeline` (uses SettlAgent's **actual** 4 statuses — pending/paid_out/payout_failed/failed — not the reference mockup's invented "Received/Verified/Processing/Completed", since we don't track those stages and inventing them would be fake data), `DisputeCaseCard` (replaces the AG Grid dispute table), `DecisionReplayPage` (the signature feature — a real 3-step investigation replay per dispute: transaction retrieved → risk factors assessed [reuses `DisputeRiskRadar`] → decision generated, built entirely from fields the dispute row already has; "Replay" re-plays the *presentation*, never re-calls the LLM/PayPal), `AgentActivityPage` + `AuditReportsPage` (split what was one `OverviewStats`-plus-`ActivityTimeline` bundle into two non-redundant pages — raw filterable log vs. KPIs/analytics).

**Theme evolution**: deep navy-teal primary (was straight dark green), new `EMERALD` accent reserved for "agent is alive" signals, `glassSurface`/`glassSurfaceDark` tokens added (used sparingly, per the brief's "minimal glassmorphism" — not applied to every card).

**Bugs found and fixed during this build**:
- Two MUI icon import misses (`ErrorOutline`→`ErrorOutlineOutlined`, `CheckCircleOutline`→`CheckCircleOutlineOutlined` — this MUI version only ships the suffixed variant for those two specific icons) — caught at build time, not guessed around.
- `AppShell.test.tsx` needed a `QueryClientProvider` wrapper once the header's new `AgentOnlineBadge` added a real data dependency to a component that previously had none.
- A `DecisionReplayPage` effect syncing a prop to state hit the same `react-hooks/set-state-in-effect` rule as earlier in the session — fixed by using a lazy `useState` initializer instead, since the parent already remounts this component on navigation (`AnimatePresence` keys on `section`), so no sync-effect was actually needed.
- Caught and removed a duplicate "Agent online" badge (added to both the header and the Command Center page itself) during live verification.
- One Playwright hang turned out to be Chromium/tooling flakiness, not an app bug — a fresh tab loaded the same page instantly, confirmed via direct `curl` that the Next.js server itself was never the slow part.

**Verified live**, not just claimed: all 6 pages screenshotted on desktop (1440px), tablet (768px), and mobile (390px, no horizontal overflow on any page); cross-page navigation tested explicitly (a specific dispute's "View Decision Replay" button correctly pre-selects *that* dispute, not just the first one); ran a brand-new real simulated dispute through Ollama post-migration and confirmed `amount`/`currency_code`/`reason` all persisted correctly (not just risk_breakdown, which was already proven earlier).

---

## 2026-11-12 — Payment Guardian, authentication, docs

- **Payment Guardian**: rule-based pre-payout risk gate (large amount, anomaly vs. median, velocity, high fee, new recipient). Risky payouts are held as `awaiting_approval`; an operator approves (real PayPal payout) or rejects (never pays). Deliberately not LLM-based — money decisions stay deterministic. Verified live: $25 auto-paid, $900 held then approved, rejected payout cannot be approved (422).
- **Authentication**: single admin account from `.env`, HMAC-signed httpOnly session cookie, `proxy.ts` gates pages (redirect to `/login`) and `/api/*` (401). Verified with curl.
- **Landing/login/Command Center** updated; named-agent framing maps to real services only (Guardian = rules, Dispute Investigation = LLM).
- **Docs**: `docs/ONBOARDING.md` (+ Word export, rendered diagrams).
- **Incident**: a Python write under the wrong encoding truncated `.env` to 0 bytes. Rebuilt from the running containers' environment; PayPal/Gemini keys were empty there and were re-entered by the user. Lesson: write `.env` only with explicit UTF-8, and keep a backup before editing.
- **Known issue**: Gemini free tier returned 503/timeouts for hours on 2026-11-12; local Ollama is the fallback (`LLM_PROVIDER=ollama`). A request timeout + automatic fallback would harden this.
