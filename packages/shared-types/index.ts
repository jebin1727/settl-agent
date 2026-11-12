// Run `pnpm --filter @settl-agent/shared-types generate` once the agent
// service is running locally — this regenerates src/generated.ts from the
// FastAPI OpenAPI schema (DTOs defined in services/agent/src/schemas/*).
// Until the first generation runs, this file has nothing to re-export.
export {};
