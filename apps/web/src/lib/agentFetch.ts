// Every BFF route (src/app/api/*) proxies through this — it's the ONLY
// place the bearer secret is attached, server-side only, never shipped to
// the browser. See SA-Arch.md §6/§8.
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL ?? "http://localhost:8000";
const AGENT_INTERNAL_TOKEN = process.env.AGENT_INTERNAL_TOKEN ?? "";

export async function agentFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${AGENT_SERVICE_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${AGENT_INTERNAL_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}
