import { config as loadEnv } from "dotenv";
import path from "node:path";
import type { NextConfig } from "next";

// Next.js only auto-loads .env files from THIS directory (apps/web), but
// SA-Arch.md §3 says there's exactly one root .env for the whole monorepo.
// Load it explicitly, before Next resolves its own env vars, so server-side
// code (API routes in particular — see src/app/api/*) can read
// AGENT_INTERNAL_TOKEN etc. Docker containers get these the same way they
// always have, via docker-compose's env_file — this only matters for local
// `next dev`/`next start`.
loadEnv({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  output: "standalone",
};

export default nextConfig;
