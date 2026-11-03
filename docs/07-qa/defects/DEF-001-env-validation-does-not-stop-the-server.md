# DEF-001: Invalid environment at start-up leaves the server running and answering HTTP 500

| Field | Value |
|-------|-------|
| Story / AC | AQP-27 (STORY-10.01) / AC-3 ("fails fast") |
| Severity | Sev-2 Major (raised from Sev-3 by master's ruling at G7 attempt 1, Jira 10671: "fails fast" means the process exits, so AC-3 failed with a workaround) |
| Priority | P2 |
| Type | Product |
| Status | Closed (verified by qa-engineer on `60eeb67`, 2026-11-03) |
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
| Fixed | developer | 2026-11-03 | `60eeb67`: `register()` writes one line to stderr and calls `process.exit(1)` on an `EnvValidationError` (Node runtime only); any other error is re-thrown |
| Regression test added | developer | 2026-11-03 | `tests/unit/instrumentation.test.ts` (exit code 1 once, one line, names, no planted value, other errors re-thrown, edge runtime ignored) |
| Verified | qa-engineer | 2026-11-03 | Re-test on the built standalone server, below |

## Re-test on `60eeb67` (qa-engineer)
Build: `npx prisma generate && npx next build` exit 0 with no environment set (the build is not affected).

| Scenario (`.next/standalone`, `node server.js`; all values invented) | Result |
|---|---|
| `AUTH_SECRET` invalid, everything else unset | Exit 1 after 17 s (cold start). One line: `Invalid environment: DATABASE_URL (missing), AUTH_SECRET (invalid), APP_ORIGIN (missing), SMTP_AUTH_MODE (missing). Check .env against .env.example.` Port 3221 not listening afterwards |
| Empty environment | Exit 1 after 6 s; all four names listed as missing |
| Three variables invalid, each holding a sentinel string | Exit 1 after 7 s; names listed as invalid; the three sentinels occur 0 times in the log |
| Polling `/` every 0.3 s while an invalid start runs | No response was ever served (connection failures only); server exit 1 |
| `next start` with an invalid environment | Exit 1; same line; sentinel occurs 0 times |
| Complete invented environment | `GET /` returns 200; no `X-Powered-By` header; no error line in the log; still running after 4 s (stopped by QA) |

Regression: full suite 506 of 506 pass (instrumentation tests included); changed-code coverage 100 percent.
