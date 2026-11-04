# Test Report — AQP-168: test reliability (DEF-003 class, DEF-005)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | master `83eb6de` (merge of PR #51, an ordinary merge, made before this evidence). Master's tree is identical to `5933605`, the last commit of `fix/AQP-168-test-reliability` (`git diff 5933605 83eb6de` is empty) |
| CI | Run 41744449259 on master `83eb6de` (push): success. Run 41680299302 on `5933605`: success |
| Environment | Windows 11; Node v24.19.0 (CI uses Node 22); Docker 29.8.0; PostgreSQL 17 from `compose.dev.yml` as a throwaway Compose project `qa168` on host port 55516, with invented passwords. It was removed with its volume after the runs |
| Date | 2026-11-04 |
| **Recommendation** | **ACCEPT.** Ten consecutive green runs under load on master (series 3), and ten on `5933605` (series 2): 20 of 20 runs, 153 of 153 tests each. The warm-up retry never fired. DEF-003 and DEF-005 are verified and closed. New: **DEF-007 (AQP-182, #52), Sev-3, type Test**: three unit tests outside DEF-003's named set timed out once in the load runs themselves. Open: Sev-1 0, Sev-2 0, Sev-3 1 (DEF-007), Sev-4 0. DEF-004 (AQP-179, #43) stays open until AQP-28 merges, as master ruled |

## What was asked (master, Jira 10780 and 10782)

1. Fix QA's load-sensitive acceptance tests in `tests/acceptance/aqp-97-config-versions.test.ts` (QLT-24, Jira 10779).
2. Run ten consecutive green runs under the DEF-003 load, and note whether the warm-up retry fires.
3. Close AQP-168 and AQP-180 if they pass.

## 1. The acceptance-test fixes (in PR #51, now on master)

Three QA commits. The brief asked for one; the second and third followed from evidence gathered after the first was pushed, and a force-push was not an option.

| Commit | Change | Why |
|--------|--------|-----|
| `cb3faa3` | Set-up in hooks, as the four bullets below describe. Every hook limit is now 120 s, the global `hookTimeout` | QLT-24 as master set it |
| `1c09b6f` | The connection-ceiling tests hold each connection for 0.5 s instead of 1.5 s. A request queued behind two waves of holders now waits about 1 s, against the 5 s connect limit | The developer's run in PR #51 showed "6 sent" timing out on the connect limit itself under load |
| `5933605` | The statement-timeout test no longer compares a client stopwatch with the server's timer. It now takes "no earlier than the limit" from the server: `SHOW statement_timeout` = `10s` on the session, and SQLSTATE 57014 in the cause. Only a hang bound is left on the client clock | Series 1, run 5 measured 9.4 s against a 10 s server limit (see below) |

The four bullets of `cb3faa3`:
- **Connection ceiling:** polls `pg_stat_activity` every 50 ms for the whole run and keeps the maximum, instead of reading once after 600 ms.
- **12-caller and 6-document races:** the database is created and migrated in `beforeEach`. The 12 clients are created and warmed one at a time in the hook (a bounded retry on connect timeout only) before the race starts.
- **Real-process tests:** their database is created in `beforeEach`.
- **Full-pool test:** each of 10 holders keeps its connection in an open transaction until the test releases it, so neither the statement limit nor the clock frees a connection early. The pool is filled one holder at a time. The 11th request must wait at least the ruled 5 s (a lower bound, which load can only help) and be refused while all 10 holders are still in (an event order). The upper bound fails only on a hang. The holders are then released and the pool must recover. The ruled limits are written out (10 s, 5 s, 10 connections), so a changed constant fails these tests as well as the table test.

**Do the changed tests still fail on their bugs?** Each fault was made in `src`, run, and reverted with `git checkout`.

| Fault | Result |
|-------|--------|
| `ON CONFLICT DO NOTHING` removed | 5 tests fail (three 12-caller rounds, the 6-document race, the 4-process run) |
| App pool `max` 10 to 30 | The app ceiling test fails |
| Script pool `max` 2 to 6 | The script ceiling test fails |
| Statement timeout 10 s to 3 s | The statement test fails (SHOW check) |
| `statement_timeout` not passed to the pool | The statement test fails |
| Statement cancel not translated to DATABASE_BUSY | The statement test fails |
| Connect timeout 5 s to 60 s, and 5 s to 1 s | The full-pool test fails both ways |
| Connect timeout not translated | The full-pool test fails |

## 2. Ten consecutive runs under load

**Target files** (the brief): `tests/integration/config/database-timeouts.test.ts`, `tests/integration/config/immutability.test.ts` (the overlap test), `tests/unit/lint/layer-rules.test.ts`, and `tests/acceptance/aqp-97-config-versions.test.ts`. That is 153 tests per run.

**Load:** `npx vitest run tests/unit` (1,123 tests), repeated without pause for the whole series. This is the parallel unit-test load the brief and reviewer-quality (10779) name.

**Warm-up retry:** every run was made with a preload (`NODE_OPTIONS=--require`, QA-only, not committed). It records each `pg` connect timeout in the test processes. Each run has exactly two deliberate connect timeouts: the full-pool refusal in the developer's `database-timeouts` test and the one in QA's acceptance test. A warm-up or holder retry would show as a third. None did.

### Series 3: on master `83eb6de` (the evidence of record)

| Run | Result | Time | Connect timeouts | Unhandled errors |
|-----|--------|------|------------------|------------------|
| 1 | 153 of 153 | 176 s | 2 | 0 |
| 2 | 153 of 153 | 148 s | 2 | 0 |
| 3 | 153 of 153 | 326 s | 2 | 0 |
| 4 | 153 of 153 | 259 s | 2 | 0 |
| 5 | 153 of 153 | 213 s | 2 | 0 |
| 6 | 153 of 153 | 186 s | 2 | 0 |
| 7 | 153 of 153 | 196 s | 2 | 0 |
| 8 | 153 of 153 | 174 s | 2 | 0 |
| 9 | 153 of 153 | 154 s | 2 | 0 |
| 10 | 153 of 153 | 137 s | 2 | 0 |

12 unit load runs ran alongside: 11 passed and 1 failed 3 tests (DEF-007).

### Series 2: on `5933605` (same tree)

All ten runs passed, 153 of 153 each, in 149 to 211 s, with exactly 2 connect timeouts per run. 15 unit load runs ran alongside: 14 passed and 1 failed 2 tests (DEF-007, the child-process case).

### Series 1: on `1c09b6f` (not counted; it found a fault in QA's own test)

The load was the unit run plus the DEF-003 record's own load (`tsc`, `eslint` and `next build`, repeated), at the same time. Runs 1 to 4 passed (153 of 153).

Run 5 failed one test: QA's statement-timeout test measured 9,395 ms against a 10 s server limit. A client stopwatch had been compared with the server's timer, and under this load the database container's clock drifts from the host's. Fixed in `5933605`, as above.

The same run also had a test worker crash on `layer-rules.test.ts` (Windows `0xC0000409`). Two of the load's own unit runs aborted (exit 134). The machine was exhausted beyond the record's load, as the developer also saw in PR #51. The series stopped when the session ended and was not resumed; series 2 replaced it.

## 3. DEF-003 and DEF-005

| Defect | Re-test | Result |
|--------|---------|--------|
| DEF-003 ([AQP-168](https://sankumar76.atlassian.net/browse/AQP-168), [#24](https://github.com/sankumar76/Accucut-Quotation/issues/24)) | The named members (the first `layer-rules` lint, the 10 s integration hooks, the registry-index 100 ms bound, now a work count) plus the class the developer and QA fixed in PR #51, in the 20 loaded runs above | **Pass: verified, closed** |
| DEF-005 ([AQP-180](https://sankumar76.atlassian.net/browse/AQP-180), [#44](https://github.com/sankumar76/Accucut-Quotation/issues/44)) | `npx vitest run tests/unit/env.test.ts` on master, once with every setting of `env.ts` set in the shell (invented values, a complete README-style environment, no `.env` file) and once with none | **Pass: 20 of 20 both ways, verified, closed.** Control: master's test before the fix, under the same complete environment, fails 1 of 17 ("reads process.env when no source is given"), which confirms the reproduction |
| DEF-004 ([AQP-179](https://sankumar76.atlassian.net/browse/AQP-179), [#43](https://github.com/sankumar76/Accucut-Quotation/issues/43)) | Not in scope: `shell.spec.ts` is on AQP-28's branch | Stays open until AQP-28 merges (master 10780) |

## Defects

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| DEF-003 (AQP-168, #24) | Layer-rules first test (and its class) times out under load | Sev-3, Test | Closed, verified |
| DEF-005 (AQP-180, #44) | `env.test.ts` fails with a complete environment | Sev-3, Test | Closed, verified |
| DEF-007 ([AQP-182](https://sankumar76.atlassian.net/browse/AQP-182), [#52](https://github.com/sankumar76/Accucut-Quotation/issues/52)) | Three unit tests outside DEF-003's set time out at the default 5 s under load (`env-example` git check, `server-only` source scan); a child process that cannot start is read as a result | Sev-3, Test | New |
| DEF-004 (AQP-179, #43) | `shell.spec.ts` drawer-width tolerance | Sev-3, Test | Open, waits for AQP-28 |

Open by severity: Sev-1 0, Sev-2 0, Sev-3 2 (DEF-007 new; DEF-004 deferred by master), Sev-4 0.

## Observations

- **The merge came before G7.** PR #51 was merged by an ordinary merge, not a squash as master's 10780 said, and before this evidence. The evidence above is on master itself, so nothing merged is untested. The way the merge was made is for master to note.
- **The DEF-003 record's own load is heavier than the machine can take** when a test series runs beside it. Both the developer's runs and QA's series 1 ended in OS memory exhaustion. The parallel unit run is a load the machine survives and still exposes the class (it found DEF-007).

## Artefacts

Branch `docs/AQP-168-qa-report` (from `origin/master`, docs only): this report, `docs/07-qa/defects/DEF-003-layer-rules-test-times-out-under-load.md` (closed), and `docs/07-qa/defects/DEF-007-unit-tests-time-out-at-default-limit-under-load.md` (new). The QA test changes are already on master (`cb3faa3`, `1c09b6f`, `5933605`).

## Hand-off
- Status: COMPLETE
- Recommendation (G7): ACCEPT (Sev-1 0, Sev-2 0, Sev-3 1 new: DEF-007; DEF-004 deferred)
- Jira / GitHub: AQP-182 and #52 created; DEF-003 (#24) and DEF-005 (AQP-180, #44) closed after verification; results on AQP-168 and PR #51
- Story status: AQP-168 is closed as its own defect, on master's instruction (10780); no other status changed
