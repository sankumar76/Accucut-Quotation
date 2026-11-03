import type { NextConfig } from 'next';

/**
 * Settings fixed by architecture section 10 ("Next.js settings").
 * - standalone output: the runtime image copies only what the server needs.
 * - unoptimized images: part pictures are already small and the optimiser would add `sharp`.
 * - external packages: native or large modules are loaded by Node, not bundled.
 * - no `X-Powered-By` header.
 * - `agentRules: false`: `next dev` would otherwise write an AGENTS.md into the working tree. This
 *   project's agent instructions are in CLAUDE.md.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  serverExternalPackages: ['exceljs', '@node-rs/argon2'],
  poweredByHeader: false,
  agentRules: false,
};

export default nextConfig;
