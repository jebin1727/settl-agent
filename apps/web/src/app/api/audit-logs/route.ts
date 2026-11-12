import { NextResponse } from "next/server";

import { agentFetch } from "@/lib/agentFetch";

export async function GET() {
  const response = await agentFetch("/v1/audit-logs");
  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
