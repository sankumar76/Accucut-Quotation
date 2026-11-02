# ADR-010: Route Handlers, one wrapper, no Server Actions

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-007; NFR-001, 002, 003, 024; SPEC §14.1; ADR-008, ADR-009 |

## Context
Next.js offers two ways to run server code from the client: Server Actions, and Route Handlers. FR-007 needs a role-matrix test over "each route and API". The Next.js documentation notes that Server Functions are not separate routes: they are POST requests to the page that uses them, so a matcher change or refactor can silently remove Proxy coverage, and each must verify authorisation itself.

## Decision Drivers
- NFR-001: 100 % of routes checked, provable
- NFR-002: an enumerable surface for the canary scan
- NFR-003: CSRF protection on all state-changing requests
- A single place for errors, logging and request IDs

## Considered Options
### Option A — All client-driven server calls through Route Handlers under `/api/v1`, one wrapper, one manifest
- Pros: an explicit list of endpoints that a test can iterate; one origin check, one error format; plain HTTP is easy to test and to reuse later
- Cons: more boilerplate than an action; CSRF must be handled by us rather than by the framework
- Cost / effort: low

### Option B — Server Actions for mutations
- Pros: less code, framework origin check, progressive enhancement
- Cons: endpoints have generated IDs and cannot be enumerated from a list; every action needs its own check; harder to role-test
- Cost / effort: lower code, weaker proof

## Decision
Client-driven reads and all writes go through Route Handlers under `/api/v1`, declared with `withRoute({ roles, input, output }, handler)`. The wrapper does the session check, role check, origin check on non-GET, zod parsing, output parsing, error mapping to `application/problem+json`, request ID and `no-store`. `route-manifest.ts` lists every page and API route with its allowed roles. Tests compare that manifest with the files on disk and with the `roles` declared. Server Components call services directly for first paint, using the same projections.

`'use server'` is forbidden by an ESLint rule.

`proxy.ts` does only a redirect for signed-out users and sets security headers. It is never treated as an authorisation control.

## Consequences
- Positive: a missing check is a failing test, not an audit finding.
- Negative / trade-offs accepted: some boilerplate; no progressive enhancement, which an authenticated tool does not need.
- Follow-up actions (with owners): developer builds `withRoute` in the first story, so nothing ships without it.

## Verification
Manifest completeness test, role-matrix test, cross-origin POST test, and a code search for `'use server'`.
