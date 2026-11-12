# Devpost submission text — copy/paste into the form

## Project name
SettlAgent

## Tagline / one-liner
An autonomous agent that settles marketplace jobs and triages PayPal disputes — real payouts, real risk-assessed decisions, every action explained.

## Inspiration
Marketplace and gig platforms have two recurring, manual pain points: paying
out providers after a job is done, and triaging the disputes that inevitably
follow. Both are usually a human clicking through a dashboard. We wanted to
see how far an autonomous agent could go on both — not a chatbot wrapper,
but something that actually moves real money and makes real, explainable
decisions using PayPal's own APIs.

## What it does
SettlAgent is a backend agent + dashboard with two autonomous loops:

- **Settlement → Payout.** The moment a job is marked complete, the agent
  calculates the platform fee split and sends a real PayPal Sandbox Payout
  directly to the provider — no invoice. Routine payouts need no manual step.
- **Payment Guardian (human in the loop).** Before any money moves, rule-based
  risk checks over the real payout history (large amount, amount anomaly,
  velocity, high fee, new recipient) decide whether to pay or hold. Held
  payouts wait in an approval queue: approving fires the real payout,
  rejecting never pays. Money decisions are deliberately not left to an LLM.
- **Dispute → Triage.** A PayPal webhook fires when a dispute is created.
  The agent fetches the dispute, has an LLM assess risk with a visible
  written rationale, auto-resolves low-risk disputes via PayPal's Disputes
  API, and escalates everything else — with that same reasoning attached,
  not just a status badge.
- A **"Simulate a dispute"** path lets anyone exercise the exact same real
  LLM reasoning and decision logic on demand, with zero PayPal mutation —
  useful for demos, and tagged `simulated` in the audit trail so it's never
  confused with a real case.
- An authenticated operator console (signed httpOnly session, every page and API route gated) shows all of it live: settlement volume over time, a
  dispute-risk plot against the agent's own auto-resolve threshold, and a
  full audit/reasoning log of every decision the agent made and why.

## How we built it
- **Agent service**: FastAPI + LangChain + PayPal's own `paypal-agent-toolkit`,
  Python. Structured logging, rate limiting (both inbound API and outbound
  LLM-quota budgeting), Postgres for the audit ledger, Redis + Arq for the
  webhook-triggered background job queue.
- **Frontend**: Next.js + MUI dashboard, with its own BFF layer so secrets
  never reach the browser.
- **LLM provider swap**: the exact same risk-classification call runs on
  Gemini or a fully local Ollama model — swapping is a one-line config
  change, proven live both ways.
- Controller → Service → Repository → DTO layering throughout, 65 backend
  + 17 frontend tests, Docker Compose for the full stack.

## Challenges we ran into
- PayPal Sandbox regional quirks (an India-region sandbox account couldn't
  send USD or use Payouts) — solved by provisioning a US-region sandbox app.
- A genuinely nasty one: the LLM call was synchronous inside an async
  handler, so a slow or rate-limited Gemini call froze the *entire* server,
  not just that one request — found live, fixed, and verified by hitting
  `/healthz` while a slow call was in flight.
- Gemini's free tier turned out to cap at 20 requests/day (not just
  per-minute) — a real constraint for a live demo, handled by keeping a
  local Ollama fallback path with zero code changes needed to switch.

## How the AI is used responsibly
The LLM only does what it is good at — reading messy dispute data and writing a
risk assessment with a rationale. A dispute auto-resolves only when the model
recommends it *and* the numeric risk score is under 0.3; either one
disagreeing escalates it. Payouts are gated by deterministic rules plus a
human, and every decision lands in an audit trail with its actor and reason.

## Accomplishments we're proud of
A real agent that moves real (sandbox) money and makes real, auditable
decisions — not a mocked demo. Every dispute decision carries its own
written rationale, all the way through to the UI.

## What we learned
How much of "agentic" reliability is actually unglamorous engineering:
async correctness, rate-limit budgeting, and handling a third-party
service's real quirks — not just prompt design.

## What's next for SettlAgent
Deploying with a registered PayPal webhook for a fully live (not
locally-triggered) autonomous loop, and agent-to-agent negotiation between
a provider-side and platform-side agent on disputed amounts.

## Built With
fastapi, langchain, python, paypal-agent-toolkit, nextjs, react, typescript,
mui, postgresql, redis, arq, docker, gemini, ollama, pytest, vitest
