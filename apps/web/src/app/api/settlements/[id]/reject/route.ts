import { NextResponse } from "next/server";

import { agentFetch } from "@/lib/agentFetch";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await agentFetch(`/v1/settlements/${encodeURIComponent(id)}/reject`, { method: "POST" });
  return NextResponse.json(await response.json(), { status: response.status });
}
