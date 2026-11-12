// Structured logging for the web app. No module should call console.log —
// eslint's no-console rule (eslint.config.mjs) enforces this at lint time.
// Mirrors the request-id correlation pattern used by the agent service
// (SA-Arch.md §9) so one user action can be traced end to end.
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  browser: { asObject: true },
});

export function withRequestId(requestId: string) {
  return logger.child({ request_id: requestId });
}
