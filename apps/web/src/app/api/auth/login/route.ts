import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/session";

// Tiny in-memory brute-force brake: 5 attempts/minute per client address.
// Process-local, which is honest for a single-instance deployment; a
// multi-instance one would move this to Redis (already in the stack).
const attempts = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > MAX_ATTEMPTS;
}

// Hash both sides first so timingSafeEqual always compares equal-length
// buffers (and so length differences don't leak through timing either).
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(request: NextRequest) {
  const adminUser = process.env.ADMIN_USERNAME ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.SESSION_SECRET ?? "";

  if (!adminUser || !adminPassword || !secret) {
    return NextResponse.json(
      { error: { code: "auth_not_configured", message: "ADMIN_USERNAME, ADMIN_PASSWORD and SESSION_SECRET must be set." } },
      { status: 500 }
    );
  }

  const client = request.headers.get("x-forwarded-for") ?? "local";
  if (tooManyAttempts(client)) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many attempts. Wait a minute and retry." } },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  const userOk = safeEqual(body.username ?? "", adminUser);
  const passOk = safeEqual(body.password ?? "", adminPassword);

  if (!(userOk && passOk)) {
    return NextResponse.json({ error: { code: "invalid_credentials", message: "Incorrect username or password." } }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: await createSessionToken(adminUser, secret),
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
