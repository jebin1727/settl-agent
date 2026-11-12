import { NextResponse } from "next/server";

import { agentFetch } from "@/lib/agentFetch";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await agentFetch(`/v1/disputes/${encodeURIComponent(id)}/triage`, { method: "POST" });
  const body = await response.json();
  return NextResponse.json(body, { status: response.status });
}
