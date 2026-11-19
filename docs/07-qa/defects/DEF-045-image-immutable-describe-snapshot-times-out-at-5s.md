# DEF-045: `image.test.ts:423` ("TRUNCATE is refused for the owner too, with CASCADE as well") times out at the default 5 s on `master` stage 11 (5049 ms; the green run took 2348 ms)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.07 (AQP-315, `b0b1cdbf`) owns the test; last changed by STORY-07.02 (AQP-332, `230bd77`). No AC fails: ADR-013 and FR-065 (the table is immutable) hold; the test ran out of time before it could say so. Test strategy flaky-test policy |
| Severity | **Sev-3 Moderate, graded by qa-engineer** on the test-plan scale (section 6, DL-094): a Test-type defect, fails closed (a red stage 11 on `master`), the workaround is a re-run, one occurrence, no product behaviour affected. The same grade as DEF-007 (#52), DEF-012 (#68) and DEF-041 to DEF-044. Re-grade by the master if it recurs or the margin shrinks (see Mechanism hypothesis) |
| Priority | P3 (Jira AQP-373 Medium, label `sev-3`). Fixed before G8 (hardening window, CLAUDE.md section 9 (3)) or accepted in writing by the master |
| Type | **Test** (integration test against real PostgreSQL, Vitest). No product path found |
| Status | New. Not fixed by QA (investigation and fix: developer) |
| Jira / GitHub | [AQP-373](https://sankumar76.atlassian.net/browse/AQP-373) / [#515](https://github.com/sankumar76/Accucut-Quotation/issues/515); Jira "relates to" AQP-315 and AQP-1 |
| Found by / date | CI, `master` push run 44475841405, job "Stages 1 to 11b" (135396046771), 2026-11-19 07:02:46Z; logged by qa-engineer, 2026-11-19 |
| Build / commit | `e4cf444` (squash of #512, AQP-363: `src/app/globals.css`, `estimate-workspace.tsx`, two layout tests; none touches `part_images`, the test or its support) |
| Environment | GitHub Actions `ubuntu-latest`, step "Stage 11: integration tests against PostgreSQL, with combined coverage" (`npx vitest run tests/unit tests/integration tests/security tests/acceptance --coverage`), 465 test files in one run, 188.40 s, one worker per file, a scratch database per file; invented data only |

## Steps to Reproduce
Not reproducible on demand: one occurrence in CI.
1. Push to `master` (or run) stage 11 on a loaded runner.
2. Read the per-test times of `tests/integration/estimates/image.test.ts` > "ADR-013, FR-065: the table is immutable".

## Expected Result
The test passes inside Vitest's 5 s default (`vitest.config.ts` sets no `testTimeout`; `retry: 0`). In the green run 44445679284 (job 135297100683, `1ca5f42`) it took 2348 ms.

## Actual Result
`Error: Test timed out in 5000ms.` at 5049 ms. `Test Files 1 failed | 464 passed (465)`, `Tests 1 failed | 12494 passed (12495)`. All four E2E shards and the Windows package passed on the same commit; unit stage 8060 passed.

## Evidence
Log: `gh api repos/sankumar76/Accucut-Quotation/actions/jobs/135396046771/logs --allow-escape-sequences` (failure block at 07:02:46Z; file summary "53 tests | 1 failed, 24192 ms").

| Test (same describe) | Green 44445679284 | Failed 44475841405 |
|---|---|---|
| runtime role refused (no grant): UPDATE bytes / name / type | 2351 / 2326 / 2431 ms | 1513 / 1755 / 1678 ms |
| runtime role refused: DELETE / TRUNCATE | 2169 / 2120 ms | 2164 / 2136 ms |
| owner refused by trigger: UPDATE bytes / name / DELETE | 2394 / 2160 / 2400 ms | 2471 / 2361 / 3928 ms |
| **owner TRUNCATE, then TRUNCATE CASCADE** | **2348 ms** | **5049 ms (timeout)** |
| grants test; "runtime role can still read and add" (no `snapshot()`) | 2 ms | 2 ms |

## Mechanism hypothesis (not confirmed)
Not a lock wait. Every test in the describe that calls `snapshot()` costs about 2.1 to 2.4 s even on an idle run, and every test that does not costs 1 to 20 ms. The runtime role's no-grant TRUNCATE is refused by the privilege check before any lock is taken, yet takes 2120 to 2136 ms, the same as the owner tests that are refused by trigger. Each scratch database belongs to one test file, so no other file can hold a lock on its `part_images`; neither `tests/support/scratch-database.ts` nor `vitest.config.ts` sets `lock_timeout`, `statement_timeout` or `testTimeout`; the owner and runtime clients are single `pg` `Client`s, not pools. The cost is `snapshot()` (`tests/integration/estimates/image.test.ts:~405`, `SELECT * FROM part_images ORDER BY id`): by the time the describe runs the table holds every picture the earlier tests stored (the table cannot be emptied; they include a 199 KB and a 204,799-byte picture), each is read as `bytea` with its bytes, and the test then compares the two arrays of Buffers with `toEqual`. Each refusal test does that twice (before and after). A normal run therefore sits at about 2.2 s of a 5 s budget (about 2.1x headroom). With 465 files in one run on a 4-vCPU runner, CPU contention stretches the read, the parse and the deep compare; the ramp inside the describe in the failed run (1.5 s, then 2.2, 2.4, 3.9, 5.05 s) fits a load burst. The TRUNCATE test is the last refusal test and runs two statements and two snapshots, so it is where the budget runs out first.

**What would confirm or refute it**
1. Time `snapshot()` split into the query and the `toEqual`, and log `count(*)`, `pg_total_relation_size('part_images')` and `sum(octet_length(bytes))` at the start of the describe. About 1 s per call confirms the snapshot is the cost.
2. Run only the describe alone (`-t "table is immutable"`). About 2 s per test alone confirms a fixed cost; tens of milliseconds points at load or contention.
3. During the TRUNCATE test, read `pg_locks` and `pg_stat_activity` from a second owner connection for `wait_event_type = 'Lock'`. Any hit refutes this hypothesis and reopens the lock theory.
4. Read the runner's CPU and Vitest worker count for 07:00 to 07:02Z, and the same describe's times in the next few `master` runs (the margin trend).

## Suspected Area (optional)
`tests/integration/estimates/image.test.ts` `snapshot()` (the helper of the "table is immutable" describe). A fix direction, not binding: make the "nothing changed" proof cheap and exact (compare `count(*)`, the ids and a per-row `md5(bytes)`, or take the "before" snapshot once in `beforeAll`). DL-229 (4)(b) bars a timeout increase, a quarantine and a skip. Same class as DEF-007 (#52) and DEF-012 (#68).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Root cause confirmed or refuted (checks 1 to 4) | developer | | AQP-373 comment |
| Fixed | developer | | `fix/AQP-373-<slug>`, before G8 |
| Regression test added | developer | | |
| Verified | qa-engineer | | by name in the fix PR's CI and the next `master` push run |

## Severity history and routing
- QA graded Sev-3, type Test, 2026-11-19, for the reasons in the table. It does not hold a story gate. Master may re-grade on a recurrence (CLAUDE.md section 9 (3): Sev-1 and Sev-2 are fixed before G8; Sev-3 is fixed or accepted in writing).
