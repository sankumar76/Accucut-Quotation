# DEF-001: Invalid environment at start-up leaves the server running and answering HTTP 500

| Field | Value |
|-------|-------|
| Story / AC | AQP-27 (STORY-10.01) / AC-3 ("fails fast") |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Product |
| Status | New |
| Found by / date | qa-engineer, 2026-11-03 |
| Build / commit | `5390559` on `feat/AQP-27-scaffold-ci` |
| Environment | Windows 11, Node v24.19.0 locally (CI uses Node 22), `.next/standalone` build from `npx next build` |
| Jira / GitHub | [AQP-166](https://sankumar76.atlassian.net/browse/AQP-166) / [#21](https://github.com/sankumar76/Accucut-Quotation/issues/21) |

## Steps to Reproduce
1. `npx prisma generate && npx next build`.
2. In `.next/standalone`, start `node server.js` with `PORT=3211 HOSTNAME=127.0.0.1 AUTH_SECRET=short-invented-value` and nothing else set.
3. After about 10 seconds request `/`, `/api/health` and `/login`.
4. Check whether the process is still running.

## Expected Result
The process stops at start-up with a non-zero exit after logging the names of the missing or invalid variables.

## Actual Result
The log names the variables and prints no value (this part of AC-3 is met): `Invalid environment: DATABASE_URL (missing), AUTH_SECRET (invalid), APP_ORIGIN (missing), SMTP_AUTH_MODE (missing)`. Next.js catches the error thrown by `register()` ("Failed to prepare server"), the process keeps running, and all three requests return HTTP 500. `next start` behaves the same (still running after 45 seconds).

Positive control: the same build with valid invented values returns 200 on `/` and sends no `X-Powered-By` header.

## Evidence
- Server log of the invalid start, searched for the three sentinel values placed in the variables: 0 occurrences (no value is printed).
- `GET /`, `GET /api/health`, `GET /login`: 500, 500, 500. Listener still present until stopped by QA.
- `tests/unit/instrumentation.test.ts` passes: it proves `register()` throws, not what Next.js does with the throw.

## Suspected Area
`src/instrumentation.ts`. Either exit the process on a `ConfigurationError` in the Node runtime, or record in writing that fail-closed (500 on every request) is accepted and that `/api/health` (story 10.04) is the detector.

## Impact
Fails closed, not open. A Docker `restart: unless-stopped` policy does not restart a process that never exits, and the first sign of the fault is a 500 page or a failed health check. Matters for story 10.04.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
