import { NextResponse } from "next/server";

import { agentFetch } from "@/lib/agentFetch";

export async function POST(request: Request) {
  const payload = await request.json();
  const response = await agentFetch("/v1/disputes/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
