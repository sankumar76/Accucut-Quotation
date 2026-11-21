# DEF-050: `approve-override.spec.ts:155` [mobile] times out at 30 s in the Engineer's closing step (7 runs in 2 days, 3 of them `master` pushes, once on both attempts); `remove-price.spec.ts:136` [tablet] fails the same way (3 runs)

| Field | Value |
|-------|-------|
| Story / AC | STORY-06.07 (AQP-324, Done) owns `approve-override.spec.ts`, its AC-3 and AC-7. STORY-06.13 (AQP-330, Done) owns `remove-price.spec.ts`, its AC-3, AC-6 and AC-7. **No AC fails:** no attempt shows an `expect` message or a value mismatch; AC-3, AC-7 (and 06.13's AC-3, AC-6, AC-7) are not shown to regress |
| Severity | **Sev-3 Moderate** (qa-engineer): a Test-type defect, fails closed (a red required check when it fails on both attempts, as it did once), workaround is the retry, no product behaviour affected as far as the evidence shows. Same grade family as DEF-045 to DEF-049 |
| Priority | P3 on its own. QA asks master to rule on a lane (see "Issues for other roles"): the `approve-override` case has failed attempt 1 on two `master` push runs and on both attempts of one PR run |
| Type | **Test** (E2E, Playwright; duration-tail class). No product defect found |
| Status | **Closed 2026-11-21 (qa-engineer).** The proof (P1, P2, P3; DL-261 (4), DL-267 (3)) is met: PR #546's runs and the first `master` push run after the merge, 44850302908. See "Closure". Fixed by the developer (PR #546, squash 266db7a9: `approve-override.spec.ts` and `remove-price.spec.ts` only); not fixed by QA |
| Jira / GitHub | [AQP-380](https://sankumar76.atlassian.net/browse/AQP-380) / [#539](https://github.com/sankumar76/Accucut-Quotation/issues/539). Jira "relates to" AQP-324, AQP-330, AQP-377 (DEF-048) and AQP-378 (DEF-049) |
| Risk / rule | RISK-031 stays open until master closes it: this Bug's part of its close-out is met, and the `master` push run read for the proof (44850302908) has **0 flaky in all four shards**; DEF-051 is not a condition (DL-264 (3)). Rule **R8 ended at this close-out** (DL-267 (3)); it was written by DL-261 (3) and re-pointed to the eight new cases by DL-267 (3). Rules in force afterwards: R9 (DEF-051, `lead-warning` :229 only) and W1 (DL-265) |
| Found by / date | CI. Read from the job logs by qa-engineer, 2026-11-20 (the two runs of the day in the brief, then the earlier runs whose logs QA held) |
| Build / commit | `master` 402485c (run 44739529276); PR head fb15d167 (run 44738649937); the earlier runs in the table. Specs read at `origin/master`; not edited |
| Environment | GitHub Actions `ubuntu-latest`, 4 vCPU, `Running 474 to 476 tests using 4 workers`, one development server and one PostgreSQL shared by the four workers; invented data only |

## Closure (2026-11-21; qa-engineer, on DL-267)
**Result: P1 met, P2 met, P3 met in the diff; 15 s reported, not gated. DEF-050 is closed.** The proof cases are the eight that replace the two old cases (named by master in DL-267 (3), by file, describe and title): `tests/e2e/approve-override.spec.ts`, describe "AC-3, AC-7: an override with a reason": C1 "the reason is kept trimmed, in the row and in the audit entry" (:184 on 266db7a9), C2 "the reason is shown next to BO, with the difference" (:198), C3 "the Engineer sees neither the reason nor the difference, and the costs are refused" (:212); `tests/e2e/remove-price.spec.ts`, describe "AC-3, AC-6, AC-7: a good removal": C4 "shows "Removing" while it is under way, then the notice; the row and the audit entry keep the price; the password is in no audit row" (:162), C5 "BO reads "Not set yet" and the price is nowhere on the page or in the costs" (:199), C6 "with the price removed, the page has no axe violation" (:218), C7 "a Lead sees the same notice and "Not set yet", with no button" (:228), C8 "the Engineer sees no price and nothing of the removal" (:240). QA read the job logs of every run below itself (every shard; durations matched by project, file, line and title); the figures agree with the developer's, the orchestrator's (AQP-380 comment 12451) and master's (DL-267).

| Run | Head | Required check | P1: first attempt, 24 readings | P2: worst | Over 15 s |
|---|---|---|---|---|---|
| PR #546 first run 44781381557 | 8ce02097 | success; shards 496 / 490 / 491 / 476 passed, 0 flaky | **24 of 24**, no retry | 14.0 s (C5, tablet) | 0 of 24 |
| PR #546 run 44845556428 | 1de96d7f | success; 506 / 500 / 501 / 485 passed, 0 flaky | **24 of 24**, no retry | **16.0 s** (C5, tablet) | **2 of 24** |
| `master` push 44850302908 (jobs 136679835612, 136679835842, 136679835849, 136679836348) | 266db7a9 (#546's squash) | fully green; 506 / 500 / 501 / 485 passed, **0 flaky in all four shards** | **24 of 24**, no retry | **13.6 s** (C3, mobile) | **0 of 24** |

Readings on the `master` push run, seconds, mobile / tablet / desktop: C1 11.4 / 7.8 / 10.3; C2 11.7 / 7.8 / 11.4; C3 13.6 / 10.0 / 11.7; C4 11.2 / 9.4 / 11.6; C5 10.7 / 9.8 / 12.2; C6 10.5 / 8.5 / 10.3; C7 6.9 / 6.4 / 8.4; C8 6.1 / 6.1 / 8.1. The earlier cases took 22 to 31 s and failed attempt 1 on 7 runs in 2 days (see "Actual Result").

**Two notes on the PR half.** (1) The PR body's proof paragraph says "worst 14.0 s, none over 15 s", which is the first run only; the second run reads 16.0 s and 2 of 24 over 15 s (master asked for these figures in DL-267 (3); they are stated here and on AQP-380). (2) The merged head is f00952fa (a second merge of `master`, 2026-11-21 01:05Z); the run on it, 44848021750, is also fully green and passed all 24 on attempt 1, worst **17.6 s**, **4 of 24** over 15 s (slower draw: 485 to 506 tests, shards 11.5 to 19.4 minutes). The "final head" run named by the orchestrator, 44845556428, is on the intermediate head 1de96d7f. The diff of all three heads is the same two spec files (`gh pr diff 546 --name-only`: `tests/e2e/approve-override.spec.ts`, `tests/e2e/remove-price.spec.ts`). Neither note changes P1 or P2.

**P3 spot-check by QA.** QA counted the page-open calls per case at `origin/master`: one in each of the eight cases. Sign-ins made inside helpers were not counted by QA; the developer's phase table (PR body) and master's reading (DL-267 (3)) are the source for "one Engineer sign-in per case".

**R8:** ended. No re-run was made under R8 that QA knows of (the orchestrator keeps the list on AQP-380 and RISK-031). A red on any of the eight cases is a new failure for master. QA reopens this Bug (Status Reopened) if one fails on a `master` push run or on both attempts.

## Scope: two tests, each identified by file and title (not by line)
**(i)** `tests/e2e/approve-override.spec.ts`, describe "AC-3, AC-7: an override with a reason", test "the reason is kept trimmed, in the audit entry too, and shown next to BO; the Engineer sees neither it nor the difference" (:155), `[mobile]`. **This is the case that meets the trigger.**

**(ii)** `tests/e2e/remove-price.spec.ts`, describe "AC-3, AC-6, AC-7: a good removal", test "shows "Removing" while it is under way, then the notice, BO "Not set yet" and no price anywhere on the page or in the costs; the row and the audit entry keep the price; a Lead sees the same with no button; the Engineer sees nothing of it; the password is in no audit row" (:136), `[tablet]`. Included because it has the same mechanism and the same error position (below). Master may narrow the Bug to (i) and keep (ii) on a watch list.

## Steps to Reproduce
Not reproducible on demand: no local attempt (CLAUDE.md section 9 (5): heavy browser tests run in CI).
1. Run Stage 12 (E2E) on `master` or any PR.
2. Shard 1 holds (i) (test no. 29 of the shard in the two runs of today, about 95 to 100 s after the shard started); shard 3 held (ii) (no. 79 on #527's run). Watch `[mobile]` for (i) and `[tablet]` for (ii).

## Expected Result
Each case inside its 30 s budget with margin: the amended proof below (P1 to P3, the form of DL-257 (A)).

## Actual Result
Every failing attempt says only `Test timeout of 30000ms exceeded.` with a `page.evaluate`, `page.goto` or `apiRequestContext.get` time-out, and **no `expect(...)` message and no axe violation list**. Every failure is in the **closing step**: the test signs in again as the Engineer and opens `/estimates/<code>` (or fetches `/costs`) after a long run of earlier steps.

| # | Date | Run (head) | Test | Attempt 1 | Retry | Error position |
|---|---|---|---|---|---|---|
| 1 | 2026-11-19 | PR run 44498537886 (AQP-374 branch, 9ce86a87) | (i) [mobile] | **failed 30.1 s** | **failed 31.1 s** | `page.evaluate` at spec :178 (the `/costs` fetch). Shard 1 was `1 failed`: this test only |
| 2 | 2026-11-19 | `master` push 44505816384 (487b4b1b, green) | (i) [mobile] | **failed 30.2 s** | passed 25.7 s | `apiRequestContext.get` of `/api/auth/csrf`, `support/auth.ts:581` |
| 3 | 2026-11-19 | PR run 44542302799 (9995d5ab, #527) | (i) [mobile] | **failed 30.1 s** | passed 25.1 s | `page.evaluate` :178 |
| 4 | 2026-11-20 | PR run 44738649937 (fb15d167, #527) | (i) [mobile] | **failed 32.2 s** | passed 25.5 s | `page.goto` of `/estimates/<code>` at :173 |
| 5 | 2026-11-20 | `master` push 44739529276 (402485c, fully green) | (i) [mobile] | **failed 30.1 s** | passed 26.6 s | `page.evaluate` :178 |
| 6 | 2026-11-19 | `master` push 44490526653 (8b51872d, green) | (ii) [tablet] | **failed 30.3 s** | passed 19.2 s | `page.goto` of `/estimates/<code>` at spec :195 |
| 7 | 2026-11-20 | PR run 44662178640 (#526, 0307d91) | (ii) [tablet] | flaky, time-out mode | passed | `page.goto` (master's reading, DL-259 (1), under a 1.74x runner wave; QA did not re-read this log) |
| 8 | 2026-11-20 | PR run 44738649937 (fb15d167, #527) | (ii) [tablet] | **failed 30.1 s** | passed 23.6 s | `page.goto` of `/estimates/<code>` at :195 |
| 9 | 2026-11-20 | `master` push 44752152410 (5d6d72b, green) | (i) [mobile] | **failed 30.2 s** | passed 26.6 s | `page.evaluate` :178 (test no. 29 of shard 1). Added by QA at the 2026-11-20 close-outs; no re-run was used (green run) |
| 10 | 2026-11-20 | #542 diagnostic run 44752992735 (ffc0d93a) | (i) [mobile] | **failed 31.1 s** | passed 24.9 s | `page.evaluate` :178 (test no. 29 of shard 1). Added by QA; no re-run was used. The developer also reports (i) flaky on #540 run 44745410528 (AQP-378 comment 12401); QA did not read that log |

**Other readings (QA's census of the logs it holds; overlapping runs, not a full census).** (i) on `[mobile]`: 5 failed attempts of 25 first-attempt readings; the passing ones 13.7 to 28.1 s (median about 18 s). On `[tablet]` and `[desktop]` (i) has never failed in the logs read (worst 29.5 s tablet, 27.1 s desktop). (ii) on `[tablet]`: 2 failed attempts of 18 first-attempt readings, with passing readings at 28.4, 28.1, 28.9, 29.9 and 25.9 s; on `[mobile]` and `[desktop]` none failed (worst 26.0 s and 27.0 s). On `master` push 44739529276 the sibling cases of (i) on `[mobile]` were also long: `approve-override` :184 25.5 s, :133 24.9 s, :96 22.1 s; `approve` :171 23.8 s, :101 22.8 s.

**Mechanism (what the logs show, not more).** The failing step is the Engineer's second sign-in and first open of `/estimates/<code>` on the development server after the Lead's work on the same estimate. The retry passes in 19 to 27 s, so the case needs 19 to 28 s when it passes and sits at the 30 s edge. The time is not shown by a value or an assertion. The CI log has only the whole-test time and the error position, so where the 25 to 30 s goes (set-up through the portal, the dialog and approve, the second sign-in, the first compile of the estimate page and the `/costs` route for the Engineer) is **not measured, so not known**.

## Evidence
Run and job logs of 44739529276, 44738649937, 44737067927, 44498537886, 44505816384, 44542302799 and 44490526653 (`gh api repos/.../actions/jobs/<id>/logs`), read by qa-engineer on 2026-11-20; durations parsed from the Playwright list lines and matched by project, file, line and title. DL-259 (1) for row 7.

## Trigger check (qa-engineer, 2026-11-20)
- **DL-257 (6) trigger** ("a second occurrence on any run means QA logs a Bug the same day") is written for `estimate-save:107`, `rates-changed:135` and `unlock:186` and does not name these tests. Not the basis.
- **RISK-031 practice.** The reopen trigger of DL-234 is "a flaky in that mode on two runs in one day". (i) has it on 2026-11-19 (three runs: rows 1 to 3) and on 2026-11-20 (two runs: rows 4 and 5); two are `master` push runs and one is a red both-attempts run. DL-257 (D) logged DEF-049 on "two time-out-mode attempt-1 failures on the same test in one day, one of them on `master`". (i) meets that on both days. So a Bug is required for (i).
- (ii) has rows 6 to 8: `master` push on the 19th, and two PR runs on the 20th (one inside a ruled runner wave, DL-259). It meets the letter on the 20th only if the wave run is counted; without it, it has one occurrence on each of two days, with an identical error and line (:195). QA includes it in scope for the shared mechanism and asks master to confirm.

## Suspected Area
`tests/e2e/approve-override.spec.ts` (:155 to :181, the closing step :172 to :179), `tests/e2e/remove-price.spec.ts` (:136 to :200, the closing step :194 to :198), `tests/e2e/support/calculated-estimate.ts` (`signInAs`), `tests/e2e/support/auth.ts` (:581, the CSRF fetch of the sign-in) and `tests/e2e/support/approved-estimate.ts`. Not `src/`, unless hypothesis 4 shows the estimate page for the Engineer slow.

## Measurement hypotheses (developer; measure before changing anything, cheapest first)
1. **Phase times of the case.** Print the time at: test start, Engineer and estimate made, calculated, Lead signed in and page open, dialog open, approve response, tiles shown, Engineer's `signInAs` done, `goto` done, `/costs` done. The question is how much of 25 to 30 s is before the closing step.
2. **Closing step alone.** The second `signInAs(page, owner)` ends with the CSRF fetch (`auth.ts:581`, one failure is there) and then a cold `goto` of the estimate page as the Engineer. Time each.
3. **Early window of the shard.** In today's two runs (i) was test no. 29 of shard 1, 95 to 100 s after the shard started, while all four workers were still compiling routes on `next dev` for the first time (DL-257 (1): 6 to 9 s to open the part form). Check whether the failures cluster at the first compile of the `/costs` and estimate routes, and why `[mobile]` for (i) and `[tablet]` for (ii) and not the other projects. **Added 2026-11-20 (DL-264 (5)(a), evidence only, no change to this Bug's scope):** `estimate-form-sections.spec.ts:145` AC-2 `[desktop]` shows the same early-window pattern. It was test no. 6 of shard 4 on both runs that matter, about 70 s after the shard started (14:20:58Z against a 14:19:47Z start on #540 run 44752189754, 71 s: **failed attempt 1 at 30.1 s**, an expect after `page.reload()` cut by the budget; 14:43:24Z against 14:42:14Z on `master` push 44755812730, 69 s: **passed at 29.8 s**), while its other desktop readings have a median of 12.4 s (19 first attempts; the retry on #540 ran at about 95 s and passed in 19.7 s). With `approve-override:155` (test no. 29 of shard 1, 95 to 100 s in) this is two different specs whose slow or failed readings sit in the first two minutes of a shard, which is the window of the first compile of the estimate routes on `next dev`. It is a hypothesis for the developer to measure, not a finding.
4. **Product check.** Time to first render of `/estimates/<code>` and of `/api/v1/estimates/<id>/costs` for an Engineer on the development server. If slow after the first hit, that is a **product defect**: QA re-grades and master is told at once.

## Binding for the fix (DL-229 (4)(b); DL-256 (5); DL-257 (B))
No skip, quarantine, retry, `test.slow()`, timeout change or fixed sleep, and no dropped width, assertion or check. Splitting a case is allowed if every assertion is kept (for (i): the dialog and approval, the tiles with the reason and the difference, the audit entry from the database, the Engineer's page without the reason, the difference or the words, and the `/costs` 403; for (ii): as listed in the title). Set-up through rows or routes is allowed only for steps that are not the case's subject (DL-257 (B)). The fix stays in the specs or test-only support; a change under `src/`, `playwright.config.ts`, ci.yml or a dependency means stop and go to master. It takes a separate PR.

## Proof (the form of DL-257 (A))
Read by the orchestrator from the job logs on the fix PR's run of record and on the first `master` push run after the merge whose Stage 2 is green, and posted on the Bug:
- **P1:** each case (or each case it is split into) passes on its first attempt at all three widths.
- **P2:** each takes under 25 s at every width.
- **P3:** each opens the page once and does no more than one sign-in as the Engineer. A later change that adds a second page open or sign-in needs master.
- **15 s** is the target for a quiet draw: reported, not gated.
- If P1 or P2 fails, the Bug stays open and the developer brings the measured phases to master.

## Re-run list
None. R8 (DL-261 (3), re-pointed by DL-267 (3)) ended at the close-out of 2026-11-21; QA holds no record of a re-run under it. (Written before R8: no rule covered these tests on 2026-11-20 and a red went to master.)

## Issues for other roles (no defect)
- **master:** please rule on (1) whether remove-price :136 [tablet] stays in this Bug or goes to a watch list, (2) a re-run rule R8 for (i) and (ii) on the shape of R6 and R7 (exact titles, error is `Test timeout of 30000ms exceeded.`, no `expect` message, once per head), and (3) a lane: (i) failed both attempts on PR run 44498537886 on 2026-11-19, and I found no ruling that names it. QA did not find that run in DL-254 to DL-260.
- **orchestrator:** please add the occurrences in rows 1 to 8 to RISK-031's list (QA does not write the risk register or the decision log) and the same time-out flaky readings in the daily update.
- **solution-architect:** same recommendation as DEF-049: the E2E per-case floor (DL-257 (9)) is the common cause class; no `architecture` issue was created by QA.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Phases of (i) and (ii) measured; mechanism confirmed or refuted | developer | 2026-11-20 | diagnostic run 44768174508 (draft, phase prints) and the PR #546 body: no single step slow; the old cases did 17 to 29 s of work in one 30 s budget (three page opens, three or four sign-ins, an axe scan in one) (AQP-380 comment 12438) |
| Fixed (spec or test-only helper) | developer | 2026-11-20 | PR #546 (`fix/AQP-380-engineer-signin-e2e`), squash 266db7a9 on 2026-11-21: `approve-override.spec.ts` and `remove-price.spec.ts` only; each old case split so every new case opens the page once and signs the Engineer in once |
| Regression test added | developer | 2026-11-20 | the fix is the test change; the two old cases are the eight cases C1 to C8 (DL-267 (3)); assertion mapping in the PR body, read by master |
| Verified: P1, P2, P3 on the fix PR's run and on the first `master` push run after merge | orchestrator reads, qa-engineer confirms | 2026-11-21 | PR #546 runs 44781381557 (24 of 24, worst 14.0 s, 0 over 15 s) and 44845556428 (24 of 24, worst 16.0 s, 2 over 15 s); `master` push 44850302908 on 266db7a9 (24 of 24 on attempt 1, worst 13.6 s, 0 over 15 s, 0 flaky); read by QA from the job logs. **Closed 2026-11-21** |
| RISK-031 close-out (DEF-050 part) | master | | DEF-050's proof is met (2026-11-21), and `master` push 44850302908 has 0 flaky in all four shards. Master decides the close-out (DL-264 (3)) |

## Severity history and routing
- qa-engineer graded Sev-3, type Test, 2026-11-20. It holds no story gate (AQP-324 and AQP-330 are Done). It changes to a Product defect only if hypothesis 4 shows the estimate page or `/costs` itself slow; master is told at once and QA re-grades.
