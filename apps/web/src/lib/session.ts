// Stateless signed-session helpers (HMAC-SHA256 via Web Crypto, so the same
// code runs in the Next proxy and in route handlers). The cookie holds
// `<base64url payload>.<base64url signature>`; payload is {u, exp}. Nothing
// secret is in the cookie — it's tamper-evident, not encrypted — and the
// signing key (SESSION_SECRET) only ever exists server-side.
export const SESSION_COOKIE = "settlagent_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createSessionToken(username: string, secret: string): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }))
  );
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64Url(signature) as BufferSource,
      encoder.encode(payload)
    );
    if (!valid) return false;
    const { exp } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { exp: number };
    return typeof exp === "number" && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
