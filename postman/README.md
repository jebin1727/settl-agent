# Postman collection

Import `SettlAgent.postman_collection.json` and `SettlAgent.postman_environment.json` into Postman.

1. Select the "SettlAgent — Local" environment
2. Set `bearer_token` to the value of `AGENT_INTERNAL_TOKEN` from the repo's `.env`
3. Run requests against the agent service at `http://localhost:8000` (default `base_url`) — start it with `docker compose -f infra/docker-compose.yml up` or `pnpm turbo run dev` from the repo root first

"Create settlement" pays the provider directly via a real PayPal Sandbox Payout — not an invoice, not a mock.
