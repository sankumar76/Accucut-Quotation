# DEF-005: tests/unit/env.test.ts fails on a computer that has a complete .env (the README setup)

| Field | Value |
|-------|-------|
| Story / AC | AQP-28 (STORY-10.02) / AC-10 (regression; the test itself came with AQP-27, AC-3) |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test (the test depends on the ambient environment) |
| Status | New |
| Found by / date | qa-engineer, 2026-11-03 |
| Build / commit | `f903d48` on `feat/AQP-28-tokens-and-shell`; the test file is unchanged on the merged head `a4b94a0` |
| Environment | Windows 11, Node v24.19.0, PostgreSQL 17 from `compose.dev.yml` (throwaway project) |
| Jira / GitHub | [AQP-180](https://sankumar76.atlassian.net/browse/AQP-180) / [#44](https://github.com/sankumar76/Accucut-Quotation/issues/44) |

## Steps to Reproduce
1. Put every variable that the README's first-use setup puts in `.env` into the shell, with invented values: `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `AUTH_SECRET` (32 characters or more), `APP_ORIGIN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_AUTH_MODE=none`. A real `.env` has the same effect: `tests/support/dotenv.ts` loads it into `process.env` before every run and never overrides a variable already set.
2. Run `npx vitest run tests/unit/env.test.ts`.
3. Run the same command with only `DATABASE_URL` and `MIGRATE_DATABASE_URL` set (what CI sets).

## Expected Result
17 of 17 pass in both cases.

## Actual Result
Step 2: 16 pass, 1 fails: `default environment source > reads process.env when no source is given`, `AssertionError: expected function to throw an error, but it didn't` at `tests/unit/env.test.ts:138` (`expect(() => loadAppEnv()).toThrow(EnvValidationError)`). Step 3: 17 of 17. The same failure shows in a full `npx vitest run` (2 failures in the first run on the machine: this one and the known DEF-003 timeout; 647 of 647 once the application variables were unset).

## Evidence
- The test sets `MIGRATE_DATABASE_URL` and assumes the application variables are absent from `process.env`.
- QA is denied access to `.env` and `.env.example`, so the cause is shown by setting the variables in the shell, not by reading them.

## Suspected Area
`tests/unit/env.test.ts` lines 133 to 145. The test should set the variables it needs and delete the others for its duration, then restore them in `finally`.

## Impact
No product effect. The first `npx vitest run` after following the README is red for a reason unrelated to the code. CI is unaffected (no `.env`). It does not hold G7 (Sev-3).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
