# DEF-080: `process-propagation.spec.ts:110` [mobile] ("a changed default reaches the customers", AC-1 to AC-3, AC-5, AC-10) fails attempt 1 at the 30 s test budget, in the time-out mode, with a retry that passes at 25.5 s (three attempt-1 failures on record: :109 [tablet] on PR #605, then :110 [mobile] on commit 6d92d76b and on `master` push 45352830027; DL-294 (2) trigger met; DL-364 (8) (i); DL-366)

| Field | Value |
|-------|-------|
| Story / AC | The case's own labels: AC-1 to AC-3, AC-5, AC-10 of the process-default propagation story (the "changed default" pack). **No AC is shown to fail:** the case ends on its own 30 s test budget, and its retry passes. Watch of record: test plan section 7 (the entry "process-propagation.spec.ts:109 [tablet]", added 2026-11-22; the line has moved to :110). |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-24; test plan section 6: a flaky test, type Test, that has not turned a required check red; DL-294 (2) names Sev-3 and type Test). Not a G8 blocker as Sev-3 (fixed before G8 or accepted in writing by master, section 6). |
| Priority | P3 (Jira Medium, label `sev-3`). Lane: DL-354 (5)'s Sev-3 order, after DEF-079 and STD-C-02 (DL-364 (8) (i)); a cause step comes first. |
| Type | **Test** (a flaky E2E case). Product cause **not excluded** (DL-364 (8) (i)): DEF-057's open shared-cause question (DL-294 (1)) and #568 (propagation holds the Process Master lock; AQP-365) are leads to read, not findings. |
| Status | **Open** (new, 2026-11-24; logged under DL-294 (2) and DL-364 (8) (i)). **2026-11-24, later (qa-engineer, DL-366): a second commit's occurrence, on a `master` push (row 2 of "Occurrences" below); master kept the lane and the binding (DL-366 (E)): the next free lane after #683, #698 and #699, cause step first; no change of grade.** |
| Jira / GitHub | [AQP-423](https://sankumar76.atlassian.net/browse/AQP-423) / [#697](https://github.com/sankumar76/Accucut-Quotation/issues/697) (labels bug, sev-3, ai-delivery; Jira also aiid-DEF-080, agent-qa-engineer). Relates to AQP-1, AQP-387 (DEF-057), AQP-383 (DEF-053, where the diagnostic run was taken) |
| Found by / date | qa-engineer, 2026-11-24, on master's notice DL-364 (8) (i) (the orchestrator's brief); the case is on QA's watch list since 2026-11-22 |
| Build / commit | PR #682 (draft, "AQP-383: DEF-053 diagnostic (phase print, never merged)", closed unmerged), head `6d92d76b`, `pull_request` run **45342140601**, run attempts 1 and 2 (the second is a re-run of all jobs on a draft that never merges). **The diff touches only `tests/e2e/users.spec.ts` (+38 / -3), so the failing case is unchanged by it.** |
| Environment | GitHub-hosted runner, `Stage 12: E2E (shard 1 of 4)`, Playwright Chromium, project `mobile` (360 px), production build, 4 workers. Jobs: run attempt 1 `138268070492` (06:40 to 07:02Z), run attempt 2 `138277660212` (07:04 to 07:26Z). |

## Status of the evidence (DL-364 (3))
Run 45342140601 is a **diagnostic PR run**, not a run of record. Per DL-364 (3) (c) its readings of other tests are occurrences on that commit, **counted once per commit**: the two run attempts are two samples of one commit (`6d92d76b`), so this is **one occurrence, not two**. It counts toward no census, proof or RISK-031 trigger (DL-364 (3) (b)); the Bug is logged because DL-294 (2)'s written trigger was met (master's notice, DL-364 (8) (i)), not because of a count. RISK-031 is untouched (a PR run; it stays Closed).

## Steps to Reproduce
No deterministic reproduction; it is a budget cut seen in CI.
1. Run the Stage 12 shard that holds the case (shard 1 of 4 on 6d92d76b: test no. 532 of 577, a late slot) with the `mobile` project on a CI runner.
2. The case creates three customers and a changed default rate, moves the customers on the old default, answers the keyboard question for the others, saves what was chosen, presses Escape, and removes the customers and the rate in `cleanUp` (:88 to :92, called from :176).

## Expected Result
The case passes on attempt 1 inside its 30 s budget, as it does on most runs (readings below).

## Actual Result
Attempt 1 ended with `Test timeout of 30000ms exceeded.` at **30.2 s** on both run attempts (the report line is `✘ 532 [mobile] ... (30.2s)`). The retry passed at **25.5 s** both times. Playwright counted it as flaky in the run's summary (`1 flaky` in the shard). Run attempt 2's log names the place: `Error: apiRequestContext.delete: Test timeout of 30000ms exceeded.` at `cleanUp` `process-propagation.spec.ts:89` (the customer `DELETE` loop), called from :176. Run attempt 1's log gives `Test timeout of 30000ms exceeded.` with an error-context file and no code frame (QA read the job log only; the attached context was not downloaded).

## Occurrences (one per commit, DL-364 (3) (c))
| # | Date | Run (head) | Result | Counts as |
|---|------|-----------|--------|-----------|
| 1 | 2026-11-24 | Diagnostic PR #682 run 45342140601 (6d92d76b), run attempts 1 and 2, shard 1, `[mobile]` | attempt 1 failed **30.2 s**, retry passed 25.5 s, on both run attempts (the two attempts are one commit) | One occurrence (the section above) |
| 2 | 2026-11-24 | **`master` push run 45352830027** (9e3111c0, #681's squash, `push`, run attempt 1, created 08:03Z), shard 1 (job 138303255995), `[mobile]`, test no. 532 | attempt 1 failed **30.3 s** (08:25:20Z), a bare `Test timeout of 30000ms exceeded.` (no call line, no `expect` message; an error-context file only, so the place in the case is not named, unlike run attempt 2 of row 1, which named `cleanUp` :89). **Retry (no. 544) passed 26.4 s** (08:25:50Z). Shard 1: `1 flaky, 571 passed (21.8m)`; the run stayed `success` for shard 1. The run is red for another reason (DEF-053, `users.spec.ts:58` in shard 4) | A **second occurrence of this Bug** (the PR #605 failure at :109 is earlier history), the first on a `master` push. Master found it in the log and the brief had not listed it (DL-366 (1)); DL-366 (E) keeps its lane and binding and does not fold it into DEF-053 (another test and another failing part: the scan there, the `cleanUp` delete loop here). Not re-run (DL-365 (2)(c)). Not a RISK-031 trigger by itself: it is a flaky retry that passed |

The case now reads, attempt 1 on `[mobile]`: 30.3 s (row 2, failed), 30.2 s (row 1, failed), 29.9 s (`master` push 45346776822, passed). The three are within 0.1 s of the 30 s budget or over it. No product cause is shown; DEF-057's open shared-cause question and #568 stay the leads (section "Suspected Area").

## Evidence
Job logs read by QA (ANSI stripped; no re-run, no change):
```
run 45352830027 (master push, 9e3111c0), shard 1 (job 138303255995): 08:25:20Z  X 532 [mobile] process-propagation.spec.ts:110 (30.3s) ; retry 08:25:50Z  ok 544 (26.4s) ; shard: "1 flaky, 571 passed (21.8m)" ; error: "Test timeout of 30000ms exceeded." + error-context file only (read by QA on 2026-11-24, later)
run 45342140601, run attempt 1, shard 1 (job 138268070492): 07:00:59Z  X 532 [mobile] process-propagation.spec.ts:110 (30.2s) ; retry 07:01:27Z  ok 544 (25.5s) ; shard: "1 flaky, 571 passed (21.2m)"
run 45342140601, run attempt 2, shard 1 (job 138277660212): 07:25:02Z  X 532 [mobile] process-propagation.spec.ts:110 (30.2s) ; retry 07:25:32Z  ok 545 (25.5s) ; shard: "1 flaky, 571 passed (21.3m)"
   attempt 2 error: apiRequestContext.delete: Test timeout of 30000ms exceeded.  at cleanUp (process-propagation.spec.ts:89:94), called from :176
```
Other readings of the case, attempt 1, seconds (mobile / tablet / desktop), from the logs QA holds (test plan section 7): `master` push 45346776822 (7029f697, today) **29.9 / 27.0 / 26.2**, all passes; `master` 08394110 26.3 / 11.1 / 24.1; PR #599 run 44990897082 28.8 / 24.8 / 18.0; PR #605 run 44999981920 21.2 / **FAIL 30.4** (retry 27.8) / 23.8, the first attempt-1 failure ([tablet], then at :109, in `cleanUp` :88 called from :175); `master` 44909939586 26.0 [mobile]. The case sits at 25 to 30 s on busy runs at all three widths; the mobile reading of 29.9 s on today's push is 0.1 s under the budget.

## Suspected Area (leads, not findings)
- `tests/e2e/process-propagation.spec.ts` `cleanUp` :88 to :92 (three customer `DELETE`s and one rate `DELETE`, each a request on a busy server) and the case's own steps; both failures sit at the end of a case that already reads 25 s or more.
- A shared cause with DEF-057 (slow server answers in the same seconds on PR #605's run; DL-294 (1)) and with #568 / AQP-365 (default propagation holds the Process Master lock). Whether the server's answers are slow on the product side is not known.

## Binding and proof (QA's proposal; master rules)
Same binding as DEF-053 and DEF-057: no change to the budget, a timeout, a retry, a skip, `test.slow()` or a fixed sleep; every assertion kept. **Proof proposed:** an attempt-1 pass of :110 at all three widths on the fix PR's run of record and on the first `master` push after the squash, each under 25 s; if the cause step shows a shared cause with DEF-057, it is folded into DEF-057 and DEF-057's proof adds an attempt-1 pass of :110 at all three widths (DL-294 (2)). No re-run rule; a red on both attempts comes to master.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Cause step (the lanes' Sev-3 order, DL-354 (5)) | developer | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-423 (linked "relates to" AQP-1); GitHub issue #697. Master's notice: DL-364 (8) (i).
