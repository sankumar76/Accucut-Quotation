import type { NextConfig } from 'next';

/** The first and last second octet of the RFC 1918 block 172.16.0.0 to 172.31.255.255. */
const PRIVATE_172_RANGE = { first: 16, last: 31 } as const;

const PRIVATE_172_ORIGINS = Array.from(
  { length: PRIVATE_172_RANGE.last - PRIVATE_172_RANGE.first + 1 },
  (_, index) => `172.${PRIVATE_172_RANGE.first + index}.*.*`,
);

/** A day, then a stale copy may serve for a week while it is refreshed: the logo URL carries no version, so not `immutable`. */
const LOGO_CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800';

/**
 * Settings fixed by architecture section 10 ("Next.js settings").
 * - standalone output: the runtime image copies only what the server needs.
 * - unoptimized images: part pictures are already small and the optimiser would add `sharp`.
 * - external packages: native or large modules are loaded by Node, not bundled.
 * - no `X-Powered-By` header.
 * - allowed dev origins: `next dev -H 0.0.0.0` lets a phone on the same Wi-Fi open the portal at the computer's
 *   address (README "First use"). Next.js blocks the page scripts of such a request unless the address is
 *   listed. These are the three RFC 1918 private ranges (192.168.x.x, 10.x.x.x and 172.16.x.x to 172.31.x.x), so
 *   any home or office Wi-Fi works and no public address is trusted. Development only: it has no effect on
 *   `next build` or `next start`.
 * - the logo (also the favicon) is a file in `public/`, which Next.js would serve with `max-age=0`, so every page
 *   view would ask for it again (PRF-02). It gets a day.
 * - `experimental.authInterrupts`: lets a page call `forbidden()`, which renders `(portal)/forbidden.tsx` (SCR-26 "no
 *   access") with status 403 (STORY-01.02 AC-4). `authorizePage` is the only caller. It is Next.js's flag for exactly this
 *   and the version is pinned; it has no effect on the other rules (no Server Actions, ADR-010). The same flag lets a page
 *   call `unauthorized()`, which renders `app/unauthorized.tsx` (SCR-26 "Session ended") with status 401 when the session
 *   has ended; `requireUserOrRedirect` is the only caller (STORY-01.06 AC-3).
 * - `agentRules: false`: `next dev` would otherwise write an AGENTS.md into the working tree. This
 *   project's agent instructions are in CLAUDE.md.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  serverExternalPackages: ['exceljs', '@node-rs/argon2'],
  poweredByHeader: false,
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', ...PRIVATE_172_ORIGINS],
  agentRules: false,
  experimental: { authInterrupts: true },
  headers: () => [{ source: '/accucut-logo.jpg', headers: [{ key: 'Cache-Control', value: LOGO_CACHE_CONTROL }] }],
};

export default nextConfig;
