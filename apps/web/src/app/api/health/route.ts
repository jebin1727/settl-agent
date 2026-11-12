// BFF pattern: this route holds AGENT_INTERNAL_TOKEN server-side and is the
// ONLY thing that talks to the agent service directly. The browser never
// sees the token — see SA-Arch.md §6/§8. Every other apps/web/src/app/api/*
// route follows this same shape.
import { NextResponse } from "next/server";

export async function GET() {
  const agentUrl = process.env.AGENT_SERVICE_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(`${agentUrl}/healthz`, { cache: "no-store" });
    const body = await response.json();
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: { code: "agent_unreachable", message: "Agent service is unreachable.", request_id: "-" } },
      { status: 502 }
    );
  }
}
