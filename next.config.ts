import type { NextConfig } from 'next';

/**
 * Settings fixed by architecture section 10 ("Next.js settings").
 * - standalone output: the runtime image copies only what the server needs.
 * - unoptimized images: part pictures are already small and the optimiser would add `sharp`.
 * - external packages: native or large modules are loaded by Node, not bundled.
 * - no `X-Powered-By` header.
 * - allowed dev origins: `next dev -H 0.0.0.0` lets a phone on the same Wi-Fi open the portal at the computer's
 *   address (README "First use"). Next.js blocks the page scripts of such a request unless the address is
 *   listed. These are the private network ranges, so any home or office Wi-Fi works. Development only: it has
 *   no effect on `next build` or `next start`.
 * - `agentRules: false`: `next dev` would otherwise write an AGENTS.md into the working tree. This
 *   project's agent instructions are in CLAUDE.md.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  serverExternalPackages: ['exceljs', '@node-rs/argon2'],
  poweredByHeader: false,
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],
  agentRules: false,
};

export default nextConfig;
