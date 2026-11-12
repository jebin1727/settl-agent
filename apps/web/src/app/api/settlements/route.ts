import { NextResponse } from "next/server";

import { agentFetch } from "@/lib/agentFetch";

export async function GET() {
  const response = await agentFetch("/v1/settlements");
  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const response = await agentFetch("/v1/settlements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
