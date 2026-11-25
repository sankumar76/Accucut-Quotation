# DEF-052: `master` red: three lock-out cases in `aqp-38-sign-in.test.ts` (:298, :318, :330) time out at Vitest's 5 s in Stage 11 on push run 44778990017 (251636c8); in 9 green runs they take under 0.3 s

| Field | Value |
|-------|-------|
| Story / AC | STORY-01.01 (AQP-38, `85c699f4`, #62) owns the test (one commit in `git log origin/master`; #541 did not change it). Describe "[AQP-38 AC-3] the lock-out, one attempt at a time, on a controlled clock". **No AC is shown to fail:** AC-3 (the lock-out) held in the seven cases of the describe that finished; the three that timed out ran out of time before they could assert, and no `expect` fired or reported a value |
| Severity | **Sev-3 Moderate, graded by qa-engineer** on the test-plan scale (section 6, DL-094): a Test-type defect that fails closed (a red Stage 11 on `master`), the workaround is a re-run (not done, see below), one occurrence, no product behaviour affected, no assertion failed. Same grade as DEF-007, DEF-012 and DEF-041 to DEF-046. The area is authentication (CLAUDE.md section 9 (2)); that raises the care taken in the assessment, not the grade, because nothing read shows a product fault (see Evidence, "Not a code regression"). **Re-grade by master** if it recurs on a different head within two days, if any failure of this file shows an assertion or a received value, or if the measurement below shows the sign-in path itself is slow (a product reading) |
| Priority | P3 (Jira AQP-382 Medium, label `sev-3`). Master has already ordered the measurement into the next lane that frees (DL-265 (5)); the fix is before G8 (hardening window, CLAUDE.md section 9 (3)) or accepted in writing by master |
| Type | **Test** (integration/acceptance test against real PostgreSQL, Vitest, a fixed 5 s budget). No product path found |
| Status | **Accepted for G8 as option B (master DL-356 (B), 2026-11-24): a Sev-3 Test defect with no product path, failing closed, listed at G8 with master's written acceptance and its readings; second-occurrence trigger armed (below). Options A and C refused for now.** Earlier: **New.** `master` is red at its tip (251636c8) and **no re-run was done** (DL-265 (5): no rule covers it; W1 excludes `master` push runs and Stage 1 to 11b) |
| Jira / GitHub | [AQP-382](https://sankumar76.atlassian.net/browse/AQP-382) / [#550](https://github.com/sankumar76/Accucut-Quotation/issues/550); Jira "relates to" AQP-38 and AQP-1; cross-linked (first comment on AQP-382); same time-out class as RISK-031, outside Stage 12 |
| Found by / date | CI, `master` push run 44778990017, job "Stages 1 to 11b" (136436338030), step "Stage 11: integration tests against PostgreSQL, with combined coverage", failure at 17:09:50Z; found by master reading the log (DL-265 (5)); logged and measured by qa-engineer, 2026-11-20 |
| Build / commit | `251636c8`, the squash of #541 (AQP-367, STORY-05.10, autosave every 30 s). `gh pr view 541 --json files`: 13 files, all under `src/components/features/estimate-workspace`, `src/lib/estimates/save-gate.ts`, `tests/e2e/estimate-autosave.spec.ts`, `tests/support/part-server.ts` and three unit tests. None is in auth, users, the throttle, a migration, `vitest.config.ts`, `tests/support/auth-database.ts` or `tests/support/scratch-database.ts`; the test imports only `auth-database`, `builders/user`, `defined` and `test-prisma-client` from `tests/support` |
| Environment | GitHub Actions `ubuntu-latest`, Stage 11 (`npx vitest run tests/unit tests/integration tests/security tests/acceptance --coverage`): 524 test files in one run, 265.62 s, one worker per file, a scratch database per file, `retry: 0`, no `testTimeout` in `vitest.config.ts` (Vitest default 5 s; `hookTimeout` 120 s); invented data only |

## Steps to Reproduce
Not reproducible on demand: one occurrence in CI. QA did not run anything locally (browsers and CI are the project's run path; no code or test was changed).
1. Read the job log: `gh run view 44778990017 --repo sankumar76/Accucut-Quotation --log-failed` (job 136436338030).
2. Read the same file's lines in a green Stage 11 log, for example `master` push 44755812730, job 136355114535: `gh api repos/sankumar76/Accucut-Quotation/actions/jobs/136355114535/logs --allow-escape-sequences`.

## Expected Result
The three cases pass inside Vitest's 5 s default, as they did in all nine green runs read (each under Vitest's 300 ms print threshold, see the table).

## Actual Result
```
FAIL  tests/acceptance/aqp-38-sign-in.test.ts > [AQP-38 AC-3] the lock-out, one attempt at a time, on a controlled clock > [AQP-38 AC-3] per address: 30 failures on 30 accounts in 15 minutes block the 31st, even a correct password, until exactly 15 minutes after the 30th
Error: Test timed out in 5000ms.        (:298, 5,007 ms)
... [AQP-38 AC-3] per address: 29 failures, then the 15-minute window runs out, and the count starts again
Error: Test timed out in 5000ms.        (:318, 5,001 ms)
... [AQP-38 AC-3] a forged X-Forwarded-For first entry does not buy a fresh address: only the proxy's last entry counts
Error: Test timed out in 5000ms.        (:330, 5,004 ms)

Failed Suites 1
FAIL  tests/acceptance/aqp-38-sign-in.test.ts [ tests/acceptance/aqp-38-sign-in.test.ts ]
error: permission denied to terminate process      (42501, detail: "Only roles with privileges of the role whose process is being terminated ...")
 ❯ withClient tests/support/scratch-database.ts:71:12
 ❯ dropScratchDatabase tests/support/scratch-database.ts:127:7
 ❯ Object.close tests/support/auth-database.ts:41:7
 ❯ tests/acceptance/aqp-38-sign-in.test.ts:111:3        (the afterAll)

Test Files  1 failed | 523 passed (524)      Tests  3 failed | 13877 passed (13880)      Duration 265.62 s
```
All four Stage 12 shards `success`; "Stages 1 to 11" `failure` only as the fan-in; no other file failed. The file line reads `❯ tests/acceptance/aqp-38-sign-in.test.ts (42 tests | 3 failed) 45704ms`.

## Evidence
Logs: `gh run view <run> --log-failed` for the red run; `gh api repos/sankumar76/Accucut-Quotation/actions/jobs/<job>/logs --allow-escape-sequences` for each green job (all read 2026-11-20 after 17:40Z).

**1. The three cases, and the file, on the red run and nine green runs.** "under 300 ms" means the default reporter did not print the case: it prints a passing case only above Vitest's 300 ms slow-test threshold (inferred from the log: the lowest printed reading for any case is 302 ms, and the file's 4 ms and 0 ms cases print only in the red run, where the file failed).

| Run (head) | Kind | `:298` 30 failures / 30 accounts | `:318` 29 failures, then window | `:330` forged X-Forwarded-For | "refused attempts do not lengthen it" | "busy database" (fixed lock wait) | Whole file (42 tests) |
|---|---|---|---|---|---|---|---|
| **44778990017 (251636c8)** | `master` push, **red** | **5,007 (timeout)** | **5,001 (timeout)** | **5,004 (timeout)** | 2,064 | **13,242** | **45,704** |
| 44768826277 (967a8adf) | `master` push, green | under 300 | under 300 | under 300 | under 300 | 784 | 3,026 |
| 44755812730 (f652c22c) | `master` push, green | under 300 | under 300 | under 300 | under 300 | 751 | 2,521 |
| 44752152410 (5d6d72b3) | `master` push, green | under 300 | **302** | under 300 | 375 | 783 | 4,626 |
| 44748626585 (7131b6bf) | `master` push, green | under 300 | under 300 | under 300 | 362 | 756 | 2,637 |
| 44745460656 (d50d092f) | `master` push, green | under 300 | under 300 | under 300 | under 300 | 762 | 2,350 |
| 44739529276 (402485cb) | `master` push, green | under 300 | under 300 | under 300 | under 300 | 755 | 2,132 |
| 44736214137 (703c61b7) | `master` push, green | under 300 | under 300 | under 300 | under 300 | 745 | 1,985 |
| 44775580925 (7ccfe3c4) | **#541's own PR run**, green | under 300 | under 300 | under 300 | under 300 | 803 | 2,573 |
| 44780475691 (359d3689, contains 251636c8) | #538 PR run, green | under 300 | **333** | under 300 | under 300 | 803 | 5,441 |

Reading: the three cases never printed above 333 ms in nine green runs, so the budget is **at least 15x** their highest green reading (5,000 / 333), and 5 s was cut at 5,001 to 5,007 ms in the red run (their true durations are not known; Vitest stops the wait, it does not abort the body). The loop cases make 34 (:298), 60 (:318) and 31 (:330) `signIn` calls each, so a green case under 300 ms is under about 9 ms per attempt, and a case of 5 s or more is at least 83 ms per attempt (:318) or 147 ms (:298). The other seven cases of the describe passed in the red run (116 to 2,064 ms): "five failures; the sixth is locked" 1,208 ms (under 300 in all nine greens), "refused attempts do not lengthen it" 2,064 ms (362 and 375 in two greens, under 300 in seven), the AC-2 cases 1,027 / 289 / 958 ms (green 309 to 1,339 for the two that printed). The slowdown therefore built up inside the describe and was already 4x to 5x on its first AC-3 cases.

**2. The stall was local, not the whole runner.** On the 524 files of the red run, matched by path to each green run (files at 200 ms or more in the green run), the median ratio red / green is 0.78 to 1.37 across eight of the green runs (0.78 #538; 0.83 5d6d72b3; 0.89 d50d092f; 1.01 967a8adf; 1.23 402485cb; 1.26 f652c22c; 1.36 7131b6bf; 1.37 703c61b7). Stage 11's own time was 265.62 s against 151.84 to 274.54 s in the nine green runs (second slowest, inside the range), so this is **not** a uniformly slow machine, and clause (d) of W1 (a median of at least 1.4x) would not hold. What was slow, in the same minute (17:05:35Z to 17:06:33Z, the window in which the three files finished), were PostgreSQL-heavy files:

| File | Red 44778990017 | Green range (9 runs) | Ratio to the highest green |
|---|---|---|---|
| `tests/acceptance/aqp-38-sign-in.test.ts` | 45,704 ms | 1,985 to 5,441 | 8.4x |
| `tests/integration/estimates/image.test.ts` | 37,852 ms | 1,379 to 2,970 | 12.7x |
| `tests/acceptance/aqp-97-config-versions.test.ts` | 67,675 ms | 25,042 to 29,331 | 2.3x |
| `tests/unit/playwright-system-deps.test.ts`, `tests/security/engineer-import-rule.test.ts` (no database) | 17,596 / 7,416 ms | 17,376 to 19,539 / 5,218 to 10,687 | within the range |

And inside the failed file, the "busy database" case is a **fixed lock wait** (it holds a lock and waits out a short statement limit; 745 to 803 ms in nine greens): it took **13,242 ms, 16.5x**. A deterministic wait that stretches 16x points at PostgreSQL (or the connection set-up) being slow in that window rather than at the test's own CPU work. That is consistent with the evidence but **unconfirmed** (see "What would confirm or refute it").

**3. The second error in the same file is the DEF-003 class.** `dropScratchDatabase` (`tests/support/scratch-database.ts:117-131`) retries `DROP DATABASE ... WITH (FORCE)` 20 times, 500 ms apart (about 10 s), when PostgreSQL answers 42501, because a superuser's background process (the code comment says an autovacuum worker) is still in the freshly migrated database. In this run it still refused after the 20th try, so the `afterAll` threw and the suite counted as failed. The nine green runs show no such error. This is a second sign of the same window (a slow or busy PostgreSQL), and it **by itself would have made the file red**, so a longer budget for the three cases alone is not shown to turn the file green.

**4. Not a code regression (likely, not proven).**
- #541's 13 files touch nothing the test imports or runs (Build / commit row); the test file has had one commit since #62.
- #541's own PR run 44775580925 on head 7ccfe3c4 (524 files, the same count as the red run) was green: this file 2,573 ms, Stage 11 171.17 s.
- #538's run 44780475691, on a head that contains 251636c8 (`behind_by 0`), was green: this file 5,441 ms, the three cases under 333 ms.
- The earlier `master` push runs of the same day (nine green) cover the file's whole life at this size.
Same code, a different PostgreSQL draw. A single red does not prove it; a repeat on a different head would weaken it.

**5. Other.** Stage 12, the four shards of the red run, were all `success`: the failure is isolated to Stage 11 and to this file. The red run's Stage 11 job took 9 min 28 s; the nine green jobs took 5 min 14 s to 9 min 14 s (job start to end; #538's 9 min 14 s the longest). `master` was still 251636c8 when QA read it (`git ls-remote`, after the log reading), so the red run is the latest run of record.

## Mechanism hypotheses (not confirmed)
**H1: PostgreSQL contention among concurrent DB-heavy files.** 524 files run at once on 4 vCPUs against one PostgreSQL service; in 17:05:35Z to 17:06:33Z at least three files that talk to PostgreSQL a lot (`aqp-97-config-versions`: 12-client rounds and four real processes; `image.test.ts`; this file) all stretched, and the fixed-wait case stretched 16x. A `signIn` is a CSRF step, the credentials callback and several throttle statements (`login_throttles` reserve, count, clear) per attempt, so a 34-call or 60-call loop pays any extra round-trip delay 34 or 59 times. That is why the loop cases (and not the five-call ones) cross 5 s first.
**H2: a timed-out body keeps running.** Vitest ends the wait at 5 s, but the async body continues, so the three cut loops kept writing to `login_throttles` while the next cases (the throttle-table check and the 13 s busy-database case) and the teardown ran. That may explain part of the 13,242 ms, the 45.7 s file time and the teardown refusal. It is a consequence of H1, not a second cause.
**H3: an autovacuum worker held the scratch database longer than the 10 s of retries** (the existing comment's theory). It fits a database that received many throttle inserts and updates in a short time, and it needs a PostgreSQL that is slow to finish a worker.

**Why this is not a thin budget (unlike DEF-045).** In DEF-045 the case sat at 2,348 ms of 5,000 on green runs and the budget was already half used. Here the three cases sit at 0.3 s or less, a margin of at least 15x. A fix that only raises the number would be a guess about a stall of unknown length; the measurement must come first.

## What would confirm or refute it (developer, in this order; not binding)
1. Time one `signIn` and each of the three cases alone, 50 repeats, against the scratch database. Under about 10 ms per call and under 0.3 s per case confirms the normal figure and so the 15x margin. A case that is slow even alone refutes "a stall" and makes this a Product reading to report to master (sign-in path slow), and the grade to be reviewed.
2. Run the file together with `image.test.ts` and `aqp-97-config-versions.test.ts` (and any other PostgreSQL-heavy file) in one `vitest run`, several times, and record the three cases and the busy-database case each time. A stretch of several times in some runs confirms H1.
3. During a stretched run read `pg_stat_activity`, `pg_locks` and `pg_stat_progress_vacuum` from a second owner connection (the scratch database's autovacuum state, H3), and log the elapsed time of each `signIn` in the loop to see whether the delay is steady or arrives in bursts.
4. Read the same three titles and the "busy database" case in the next `master` and PR Stage 11 logs (the 300 ms print threshold shows them above 0.3 s): first sign of a trend or of a second red.

## Suspected Area
`tests/acceptance/aqp-38-sign-in.test.ts:298-340` (three loops of 31 to 60 sequential `signIn` calls each, on the default 5 s), the PostgreSQL service in Stage 11 shared by 524 files, and `tests/support/scratch-database.ts:117-131` (the drop retry).

**A fix direction, not binding.** Make the loop cheaper without weakening what it proves (for example an `afterAll` that does not depend on the drop's retry window; fewer round-trips per attempt in the test's own set-up; the three loops sharing less state), or give those three cases an explicit, reasoned per-test budget. DL-229 (4)(b), as stated in DEF-045 and DEF-046, bars a retry, a skip, a quarantine, a loosened assertion and a timeout increase. Whether that bar should hold when the measurement shows a stall rather than a thin budget is **a question for master**, not QA. QA changes no budget and no test. A fix inside the test file does not need the section 9 item 2 combined review; a change under `src/`, `tests/support/` (the scratch database or the auth database) or `vitest.config.ts` is in the authentication/data area and goes to master first.

## Issues for other roles (no defect)
- master: **a re-run rule for `master` push runs** (DL-265 (5) says master rules once these readings are in). Facts for the ruling: (1) PRs are not blocked: #541's own run and #538's run both passed this file; only `master`'s record at its tip is red. (2) The next squash merge (#538 once its re-run is green, then #549) gives a new `master` push run that becomes the run of record, so a re-run of 44778990017 is needed only if no merge follows soon. (3) If master wants a rule, a signature-exact one in the shape of R3 and R4 would be: Stage 11b the only red job; `Test Files 1 failed`; the failed tests are only the three titles of this Bug (or any subset), each exactly `Test timed out in 5000ms.`, with at most the file's `afterAll` 42501 error from `dropScratchDatabase` and no other error or unhandled error; every Stage 12 shard `success`; once per head, `master` push runs included, until the fix merges; a second red on one head waits for the fix. W1 cannot be used here: its runner control (the median per-file ratio of at least 1.4x) does not hold for this run (0.78 to 1.37) and its clause (c) names Stage 12 time-outs only. QA recommends **no re-run now**, because it would also hide the first reading of this window (master's alternative (iii) in DL-265), unless the next merge is delayed.
- master / orchestrator: RISK-031 (time-outs under load) now has an occurrence outside Stage 12 (Stage 11, Vitest 5 s). The register is not QA's file; the entry is for the orchestrator.
- product-owner / developer: AQP-38 is Done and no AC is affected; no story change.
- test plan: section 7 near-budget list is E2E only. Stage 11 per-case readings for these three cases and the busy-database case are recorded in this file only; QA will add them to the list if a second occurrence appears.

## Readings after DL-266 (step 4; qa-engineer, 2026-11-21; no second occurrence)
DL-266 (5) gave QA step 4 (read the three cases, the "busy database" case and the `afterAll` in each `master` push and PR Stage 11 log). QA read the "Stages 1 to 11b" job log of each run below (step "Stage 11 ... with combined coverage").

| Run (head) | Kind | Whole file (42 tests) | "with login_throttles locked by another session ..." (the fixed-wait "busy database" case) | The three cases (:298, :318, :330) | `afterAll` / 42501 / "Test timed out" |
|---|---|---|---|---|---|
| 44823699480 (a514ad3a) | `master` push, green | **3,331 ms** | 826 ms | not printed (under 0.3 s) | none |
| 44850302908 (266db7a9, #546's squash) | `master` push, green | **3,161 ms** | 810 ms | not printed (under 0.3 s) | none |
| 44845556428 (1de96d7f) | PR #546, green | 3,838 ms | - | not printed | none |
| 44848021750 (f00952fa) | PR #546 merged head, green | 4,194 ms | - | not printed | none |

All four runs: `Test Files` all passed, no "Test timed out in" line and no "permission denied to terminate process" in the log; the only "42501" lines are the unrelated approved-price grant test. The file sits at 3.2 to 4.2 s against 2.0 to 5.4 s on the earlier green runs and 45.7 s on the red run. **None of DL-266 (5)'s second-occurrence triggers has fired** (no case timed out, no `afterAll` 42501 error, the "busy database" case 0.81 to 0.83 s against the 5 s line). The Bug stays in the hardening window; DEF-052 is not closed by these readings (its Verified step is the fix PR's run and a `master` push run after it).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Mechanism confirmed or refuted (checks 1 to 4) | developer | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | Rerun of the three cases and the file on the fix PR's run; the same cases and the busy-database case in the first `master` push run after the merge (each under 0.3 s, file near 2 to 3 s, no 42501 in the `afterAll`) |

## Severity history and routing
- QA graded Sev-3, type Test, 2026-11-20, on master's order (DL-265 (5): Sev-3, type Test unless the reading shows a product fault; the reading shows none). It does not hold a story gate (AQP-38 is Done; #541's change is not implicated). Lane: the next one that frees, ahead of DEF-050's successor DEF-051 (DL-265 (5)); 08.04 is never paused without the delivery lead.

## Option B accepted (master's DL-356 (B); recorded by qa-engineer, 2026-11-24)
**Ruling.** On the developer's measurement (AQP-382 comment 13018; #550 comment 7119358979; local, not gate evidence): one sign-in has a median of 29 ms; the three cases alone have medians of 0.9 to 1.7 s and a p95 up to 5.0 s on that PC; with `aqp-97-config-versions.test.ts` on the machine at the same time they hit the 5 s cut in 4 of 5 runs and no assertion fired; with `image.test.ts` only there is no slowdown. The sign-in and lock-out path is not slow; the cut comes from sharing the machine. **Option A (a per-test budget) is refused** (DL-266 (3): a budget in the authentication area must not hide a slow sign-in path). **Option C (an `afterAll` retry window in `scratch-database.ts` or `auth-database.ts`) is refused for now** (DL-266 (4)). **Option B is accepted:** Sev-3, Test, no product path, fails closed (a red Stage 11), one occurrence in the runs read (master push 44778990017, 251636c8, 20 Nov) and no recurrence. It is **listed at G8 with master's written acceptance and its readings** (DL-354 (4)). Lane 3 is released.

**Second-occurrence trigger (any run):** a 5 s cut of one of the three cases (`aqp-38-sign-in.test.ts` :298, :318, :330) **or the `afterAll` 42501** comes to master the same day. Master then re-rules among A, C and a measured `vitest.config.ts` pool change (which comes to master first), with the section 9 item 2 combined review for any change. The PR run is not re-run (DL-266 (1)). This is also RISK-031's reopen trigger (d) (DL-353). QA reads the three cases and the `afterAll` in every Stage 11 log (readings so far: none since 20 Nov; latest push 45297038711, 662 files, 0 five-second cuts).
