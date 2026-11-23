# DEF-071: `overdue-scan.test.ts` AC-1 times out at Vitest's 5 s in Stage 11 (:56), and the next case then reads a leftover row (:75), on PR #632's run of record 45125512077 (head 9f59beb3); type Test, product excluded (DL-333)

| Field | Value |
|-------|-------|
| Story / AC | The overdue scan (`performOverdueScan`, the task-overdue e-mail rows) is owned by the stories behind `tests/integration/jobs/overdue-scan.test.ts` (describe "AC-1: one outbox row per task and deadline, by user ID"). **No AC is shown to fail:** case (a) ran out of time before it could assert, and case (b) read a row that belongs to (a); the rule itself (Cc to the Lead) is deterministic and passed on both earlier green runs read (DL-333 (2)) |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-23, on master's DL-333 (3)): a Test-type defect that fails closed (a red Stage 11 on a PR run), one occurrence, no product behaviour affected. Same grade as DEF-052 (the same class) |
| Priority | P3 (Jira Medium, label `sev-3`). **No lane now** (DL-333 (3), DL-266 (5): one occurrence, PR runs pass, the budget is not thin). Not a G8 blocker: it goes on the "open, not blocking, listed" line, and test plan section 6 applies at G8 (DL-333 (5)) |
| Type | **Test, product excluded** (DL-333 (2)): #632 changes nothing under `src/` (2 files, `package.json` and `package-lock.json`); the same cases passed on the same code on both green runs read; #642's mail helper is not on the failing path |
| Status | **Open** (logged 2026-11-23). No fix PR. **Second-occurrence trigger is armed** (below) |
| Jira / GitHub | [AQP-414](https://sankumar76.atlassian.net/browse/AQP-414) / [#644](https://github.com/sankumar76/Accucut-Quotation/issues/644). Jira "relates to" AQP-1 (Intake) and AQP-382 (DEF-052); cross-linked (comment on AQP-414). Labels `ai-delivery`, `aiid-DEF-071`, `bug`, `sev-3`, `final-review`, `agent-qa-engineer`; priority Medium. DEF-071 was free: no file in `docs/07-qa/defects/`, JQL `labels = "aiid-DEF-071"` found nothing, GitHub search for "DEF-071" found nothing |
| Risk / rule | RISK-031 (open at 9): run 45125512077 is a **PR run**, so it counts on neither trigger (a) nor trigger (b), which read `master` push runs; no re-score (DL-333 (5)). QA lists it in the ledger as a Stage 11 time-out-mode occurrence on a PR run (test plan section 7, a later task). A `master` push red on this file would be a Stage 11 time-out-mode red under trigger (a) |
| Found by / date | CI (PR run), found by master reading the log (DL-333 (1)); logged by qa-engineer 2026-11-23. Log lines re-read by QA on 2026-11-23 (job 137528825530, ANSI stripped) |
| Build / commit | PR #632 (`chore/AQP-1-next-16.4.6-vitest-5.1`) head **9f59beb3**, 0 behind `master` **06d5d56a**; Next 16.4.6, Vitest / `@vitest/coverage-v8` 5.1.0 (`master` is on 5.0.5 since #16, 55e21986) |
| Environment | GitHub Actions `ubuntu-latest`, Stage 11 (`npx vitest run tests/unit tests/integration tests/security tests/acceptance --coverage`): 638 test files, 268.38 s, one worker per file (`Isolate 638 workers spawned`), a scratch database per file, `retry: 0`, no `testTimeout` in `vitest.config.ts` (Vitest's 5 s default; `hookTimeout` 120 s); invented data only |

## Steps to Reproduce
Not reproducible on demand: one occurrence in CI. QA ran nothing locally (CI is the project's run path; no code or test was changed).
1. Read the job log: `gh api repos/sankumar76/Accucut-Quotation/actions/jobs/137528825530/logs --allow-escape-sequences` (run 45125512077, job "Stages 1 to 11b", step "Stage 11 ...").
2. Compare with the same three files on a green run, for example `master` push 45125449394, job 137528621551 (Vitest 5.0.5), and #632's earlier head f0d99902, run 45123584369, job 137522712936 (Vitest 5.1.0).

## Expected Result
Each case of `overdue-scan.test.ts` finishes in well under 1 s (the other 15 cases read 10 to 127 ms), and each case reads only the rows its own world wrote, so a row left by an earlier case can neither pass nor fail it.

## Actual Result
```
 ❯ tests/integration/jobs/overdue-scan.test.ts (17 tests | 2 failed) 6647ms          (06:45:58.91Z)
FAIL  tests/integration/jobs/overdue-scan.test.ts > AC-1: one outbox row per task and deadline, by user ID > writes task-overdue:<taskId>:<deadlineAtUtc>, To the Engineer and Cc the Lead, and no ...
Error: Test timed out in 5000ms.                       (:56, reporter 5,028 ms)
FAIL  tests/integration/jobs/overdue-scan.test.ts > AC-1: ... > copies the Admin when the Admin assigned the task
AssertionError: expected [ Array(1) ] to deeply equal [ Array(1) ]     (:75:50, 338 ms; expected [09dc27e9-...], received [2ad4fd20-...])

Test Files  1 failed | 637 passed (638)      Tests  2 failed | 16223 passed (16225)      Duration  268.38s
```
Stage 6 (`RUN v5.1.0`): `473 passed`, `10603 passed`, equal to the `master` push's 473 and 10,603 (DL-320 M5 holds). The failing job is "Stages 1 to 11b"; the fan-in "Stages 1 to 11" is red as a consequence (DL-333).

## Evidence
Source: DL-333 (1) (master's reading of job 137528825530), re-checked by QA against the same log on 2026-11-23: the `overdue-scan.test.ts` file line (2331), both `FAIL` blocks (2700, 2713), `Test Files` / `Tests` / `Duration` (2735 to 2738) and Stage 6's counts (1153, 1154) read as above.

**1. Three files, one window.** They started within 0.4 s of each other (about 06:45:52Z), were the only files running in that window, and each lost about 5 s at the same time:

| File | Ended (Z, 06:45:) | File time | Slowest case in the window |
|------|------|------|------|
| `tests/integration/tasks/close-reopen.test.ts` (14 tests) | 58.50 | 6,434 ms | "PREPARED: in Open..." 5,136 ms |
| `tests/integration/jobs/overdue-scan-rules.test.ts` (11 tests) | 58.69 | 6,773 ms | "shows markup in a title..." 5,170 ms |
| `tests/integration/jobs/overdue-scan.test.ts` (17 tests) | 58.91 | 6,647 ms | AC-1 "writes task-overdue:..." timed out at 5,000 ms |

On the green runs the same three files run side by side and end fast: `master` 45125449394 (Vitest 5.0.5) 2,153 / 1,534 / 1,853 ms; #632's f0d99902, 45123584369 (Vitest 5.1.0) 3,024 / 1,940 / 3,286 ms. So the runner scheduled them the same way on both versions. The PostgreSQL log in the job has no error, lock or terminate line between 06:45:20Z and 06:46:00Z, only checkpoint lines: a server-side wait can be neither shown nor excluded (DL-333 (1)).

**2. Code read on `master` 06d5d56a (master, DL-333 (1)).** Case (a)'s body is `seed` (`tests/support/overdue-world.ts:123`, four owner-role statements), `scan()` (`performOverdueScan`) and `outboxRows()`; no mail-capture call. `openMailpit` (`tests/support/mail-capture.ts`, as changed by #642) opens nothing on the network, and #642 did not change `overdue-world.ts`. `close-reopen.test.ts` does not import the mail capture at all. The scan path has no wait, sleep or lock (the only lock in the area is `FOR UPDATE SKIP LOCKED` in the outbox claim, which the scan does not use).

**3. Not a code regression (product excluded).** #632 changes `package.json` and `package-lock.json` only. The same cases passed on the same code twice. In this file run the AC-9 case (500 tasks) took 368 ms. A product fault in the Cc rule would fail (b) every time, not once.

**4. (b) is a consequence of (a), not a second cause (DL-333 (2)).** Vitest does not stop a timed-out test's body. It keeps running while (b)'s `beforeEach` (`resetWorld`, which deletes the rows) and (b)'s own body run, so a late write from (a) can land in (b)'s world. The received value is one UUID, which matches (a)'s Cc `[leadId]`. The run does not log `leadId`, so this is a lead, not a finding.

**5. Cause class, as ruled.** A short shared stall (CI host or PostgreSQL) in one Stage 11 window, the DL-266 / DEF-052 shape. Vitest 5.1.0 is not excluded on one draw (it passed this file once, on f0d99902), but no evidence points to it. What separates the remaining classes (DL-333 (2)): (i) a 5 s cut of a database-using Stage 11 case on any Vitest 5.0.5 run settles "load"; (ii) a second such cut on a 5.1.0 run with none on any 5.0.5 run read in the same period makes Vitest 5.1.0 the leading reading; (iii) host versus PostgreSQL cannot be told apart without server statistics, and that tooling is frozen (CLAUDE.md section 9 item 4).

## Scope (DL-333 (3))
1. The 5 s cut of a load-sensitive integration case.
2. The test-isolation weakness: a timed-out case can write into the next case's world, so one cut becomes two failures, the second with a wrong value that looks like a product fault. The case, the world and the leak are on `master` (Vitest 5.0.5), so `master` is exposed to it through load.

## Second-occurrence trigger (DL-333 (3))
Any of these, on any run (PR or `master` push): a 5 s cut in `overdue-scan.test.ts` or `overdue-scan-rules.test.ts`; a wrong-row failure at `overdue-scan.test.ts:75`; or a similar `[0]` read. The Bug then takes the next free lane for a test-only fix, after the items DL-329 (8) and DL-330 (4) have already queued, and it never pauses a CR-01 story. QA reads every Stage 11 log for 5 s cuts in database tests from now on (project-state "QA to do on resume"), and the #632 merge condition reads both `overdue-scan*` files and records the three files' durations and the Stage 11 total (DL-333 (4) (iii), (iv)).

## Fix route (binding when it starts; DL-333 (3))
- **Test files only:** `tests/integration/jobs/overdue-scan*.test.ts` and `tests/support/overdue-world.ts`. Each case reads only its own rows (its task's ID or idempotency key), so a row left by an earlier case can neither pass nor fail it.
- **No** `testTimeout`, per-test budget, retry, skip or `.concurrent` change; every assertion is kept.
- A change to `scratch-database.ts`, `auth-database.ts`, `src/` or `vitest.config.ts` comes to master first (DL-266 (4)).
- **Proof:** the file is green on the fix PR's run of record and on the first `master` push after it, and the PR body shows that a planted leftover row from another task does not change the case's result.
- No fix on #632 (it keeps its "package files only" basis, DL-320 (3), M6), no re-run of 45125512077 or 45097669695, no empty commit or manual dispatch (DL-333 (4)).

## Suspected Area (optional)
A shared stall of the CI host or PostgreSQL in one Stage 11 window (DL-266 shape), plus a test-isolation weakness: cases in `overdue-scan.test.ts` read rows by position (`[0]`) in a world that a timed-out earlier case can still write into.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer (not started; waits for the second-occurrence trigger) | | |
| Regression test added | developer (planted leftover row from another task does not change the result) | | |
| Verified | qa-engineer | | |

## For master
None asked. DL-333 (B) rules the grade, the scope, the trigger and the fix limits; QA only records them. Open for QA's later task: test plan section 7 ledger line for run 45125512077 and the "Vitest 5.0.5 to 5.1.0" wording fix (DL-333 (5)).
