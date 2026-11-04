# DEF-007: three unit tests outside DEF-003's set time out at the default 5 s under load

| Field | Value |
|-------|-------|
| Story / AC | AQP-168 (DEF-003 class, DL-057); tests from AQP-27 (AC-3) and AQP-106 (AC-8) |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test (load-sensitive timing; test plan section 7) |
| Status | New |
| Found by / date | qa-engineer, 2026-11-04 |
| Build / commit | master `83eb6de` (also seen on `5933605`) |
| Environment | Windows 11, Node v24.19.0; throwaway Postgres 17 (Compose project `qa168`) |
| Jira / GitHub | [AQP-182](https://sankumar76.atlassian.net/browse/AQP-182) / [#52](https://github.com/sankumar76/Accucut-Quotation/issues/52) |

## Steps to Reproduce
1. Start a throwaway database and set `DATABASE_URL` and `MIGRATE_DATABASE_URL` to it (invented passwords).
2. Run `npx vitest run tests/unit` over and over.
3. At the same time, run `npx vitest run tests/integration/config/database-timeouts.test.ts tests/integration/config/immutability.test.ts tests/unit/lint/layer-rules.test.ts tests/acceptance/aqp-97-config-versions.test.ts` ten times in a row.

## Expected Result
Every unit run passes (1,123 of 1,123), as it does alone and in CI.

## Actual Result
On master, 1 of 12 unit runs failed 3 tests, each with `Test timed out in 5000ms` (Vitest's default test limit):
- `tests/unit/env-example.test.ts` > ".gitignore and .env.example (AC-3, TD-05) > AC-3: git does not ignore .env.example". The test runs a synchronous `git check-ignore` (`tests/support/git-ignore.ts`) inside the test.
- `tests/unit/formula/server-only.test.ts` > "no code is built from a string (AC-8, CONSTRAINT-02) > AC-8: 0 uses of new Function", and "... 0 uses of a string passed to setInterval". These scan the source tree inside the test.

Both files pass alone (34 of 34 and 24 of 24).

On `5933605`, 1 of 15 unit runs failed 2 tests for a related reason. A child process could not start (Windows status `0xC0000017`, STATUS_NO_MEMORY), and the helpers read that as a result: `data-files.test.ts` "passes on a throwaway repository" saw exit code 3221225495, and `env-example.test.ts` "ignores debug.log" saw "not ignored".

## Evidence
- Load logs: series 2 load run 3 and series 3 load run 4 (see `docs/07-qa/AQP-168-test-report.md`).
- None of the AQP-168 target files failed in the same twenty runs.

## Suspected Area
- `tests/unit/env-example.test.ts`, `tests/support/git-ignore.ts`, `tests/unit/formula/server-only.test.ts`, `tests/unit/data-files.test.ts`.
- Remedy as for DEF-003: do the one-off spawn or scan in a `beforeAll`, which has the 120 s hook limit, so the 5 s test limit covers only the assertion. No test limit is raised and nothing is retried.
- Make each helper that spawns a process fail with its own clear message when `spawnSync` returns `error` or a Windows status code at or above `0xC0000000`. That way a process that never started is not reported as a check result.

## Impact
No product effect. CI is green. A developer who tests while the machine is busy sees a red test that says nothing about the rule it checks.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
