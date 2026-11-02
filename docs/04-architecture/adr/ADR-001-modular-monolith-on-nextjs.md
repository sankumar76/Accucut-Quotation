# ADR-001: Modular monolith on Next.js with a separate worker

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | NFR-002, 008, 010, 011, 025, 030; FR-091; ADR-002, ADR-010, ADR-011 |

## Context
`CLAUDE.md` §1 and SPEC §2 fix TypeScript, Node 22, Next.js App Router, shadcn/ui, Tailwind and Docker Compose with app, worker and Postgres. The open choice is how the code is shaped: one application or several services, and how the layers are kept apart. The team is small and the load is fewer than 50 users.

## Decision Drivers
- NFR-002: cost data must be easy to prove absent from Engineer responses
- NFR-030: installable by following a README in 30 minutes
- NFR-025: maintainable within file and function limits
- Delivery effort is tight (RISK-007): every extra deployable costs hours

## Considered Options
### Option A — Modular monolith: one Next.js app with enforced layers, plus a worker entry point from the same codebase
- Pros: one build, one image, one language, shared schemas; transactions span the whole use case; simplest to run
- Cons: layer discipline depends on tooling; the framework sits close to the domain unless kept out
- Cost / effort: lowest

### Option B — Next.js front end plus a separate API service
- Pros: a hard network boundary around cost data
- Cons: two deployables, duplicated auth and schemas, API latency, more to test. The boundary it adds can be had inside one process through import rules and strict output schemas
- Cost / effort: adds days

## Decision
We will build a modular monolith. `src/lib` is pure and framework-free, `src/server` holds services, repositories and role projections, and `src/app` stays thin. `src/worker/main.ts` shares the same code and image. Import rules are enforced by ESLint and architecture tests (architecture section 10). Versions are pinned exactly, because several `latest` tags are misleading.

## Consequences
- Positive: one image, one pipeline, one transaction boundary. The pure core is testable without Next.js and portable if offline ever needs it.
- Negative / trade-offs accepted: a single process shares fate, so heavy work must leave the event loop (ADR-012). Import rules replace a network boundary.
- Follow-up actions (with owners): developer sets up ESLint boundaries in the scaffold story; reviewer-standards enforces them.

## Verification
Build fails on a forbidden import. Architecture test enumerates route files. Coverage and size limits run in CI.
