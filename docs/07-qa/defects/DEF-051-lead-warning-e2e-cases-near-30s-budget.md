# DEF-051: `lead-warning.spec.ts` AC-5 (:229), AC-8 keyboard (:253) and AC-8 dialog axe (:280) time out at 30 s, the last two as a cluster in a shard's first minute; the cases ran 13 to 24 s and now run 6 to 14 s (Test; closed 2026-11-21)

| Field | Value |
|-------|-------|
| Story / AC | STORY-06.10 (AQP-327, Done) owns `lead-warning.spec.ts`: AC-5 (the scope after DL-267 is the AC-5 case only; the AC-8 keyboard case is on the watch list). **No AC fails:** the one failure shows no value mismatch and no axe violation list (an `expect` wait cut by the 30 s budget). AC-5 and AC-8 are not shown to regress |
| Severity | **Sev-3 Moderate** (qa-engineer, on master's DL-264 (4)): a Test-type defect, fails closed (a red required check if both attempts fail), workaround is the retry or a re-run under R9, no product behaviour affected as far as the evidence shows. Same grade family as DEF-045 to DEF-050 |
| Priority | P3 on its own. **Lane (DL-264 (4), (6)): DEF-050's lane, straight after DEF-050, by the same developer**, ahead of every story not yet started; no lane of its own |
| Type | **Test** (E2E, Playwright, `desktop` project for (i); duration-tail class). No product defect found |
| Status | **Closed 2026-11-21 (qa-engineer), on master's DL-273 (B).** P1, P2 and P3 are met on PR #555's run of record 44870213022 and on the first `master` push run after the merge, 44890683601. Scope over time: DL-264 (4) :229 and :253; DL-267 narrowed it to :229; DL-269 put :253 back; DL-272 added :280; **at close-out all three are in scope** (DL-273 (A)). Fixed by the developer (PR #555, squash 03c81cbf: `lead-warning.spec.ts` only); not fixed by QA. **Early-shard reopen trigger until 2026-11-28** (see "Closure") |
| Jira / GitHub | [AQP-381](https://sankumar76.atlassian.net/browse/AQP-381) / [#544](https://github.com/sankumar76/Accucut-Quotation/issues/544). Jira "relates to" AQP-327 (STORY-06.10) and AQP-380 (DEF-050). RISK-031 in the register |
| Risk / rule | RISK-031 (master's): this Bug is not a close-out condition (DL-264 (3)). Rule **R9 ended at this close-out** (DL-273 (B)); R9 (b) named :229, :253 and :280 since DL-272. Rules in force afterwards: **W1 only** (DL-265) |
| Found by / date | CI. #540 run 44752189754 (head 06474b76, `[desktop]`, shard 4); inside the ruled runner wave of PR #526 run 44662178640 (DL-259). Evidence read by master (DL-264 (1)) and by qa-engineer from the job logs; logged by qa-engineer, 2026-11-20 |
| Build / commit | PR head 06474b76; `master` f652c22c (run 44755812730), 5d6d72b (run 44752152410). Spec read at `origin/master`; not edited |
| Environment | GitHub Actions `ubuntu-latest`, 4 vCPU, `Running 488 tests using 4 workers` (shard 4 of #540's run), one development server and one PostgreSQL shared by the four workers; invented data only |

## Closure (2026-11-21; qa-engineer, on DL-273)
**Result: P1 met, P2 met, P3 met in the diff (one spec file); 15 s reported, not gated. DEF-051 is closed.** The proof cases are the three that were in scope at close-out (DL-272, DL-273 (A)); #555 moved their lines: `tests/e2e/lead-warning.spec.ts`, describe "AC-5: the approval dialog says so, and Approve is not stopped", "AC-5: one line names the row, there is no box to tick, and Approve and lock approves the calculation that carries the warning" (:229 before, :222 on 03c81cbf); describe "AC-8: keyboard, focus and accessibility at this width", "AC-8: by keyboard alone: Enter on Recalculate opens the dialog with focus on "Go back"; Escape closes it with nothing sent; the next Enter and Tab to "Recalculate anyway" go ahead" (:253, now :246) and "AC-8: no sideways scroll and no axe violation with the dialog open" (:280, now :273). QA read the job logs of every run below itself (every shard; durations matched by project, file, line and title); the figures agree with the developer's, master's (DL-273) and the orchestrator's (AQP-381 comment 12490).

| Run | Head | Required check | P1: the three cases and the file's 39 readings, first attempt | The three cases, mobile / tablet / desktop, s | P2: worst of the 39 | Over 15 s |
|---|---|---|---|---|---|---|
| PR #555 run of record 44870213022 | 0dfef68e | success; shard 4 had 1 flaky (`users.spec.ts:58` [desktop], not a DEF-051 case) | 39 of 39, no retry | AC-5 11.2 / 7.7 / 13.9; keyboard 11.3 / 8.4 / 11.3; dialog axe 9.6 / 6.7 / 10.6 | **13.9 s** | 0 of 39 |
| PR #555 merged-head run 44888215530 (extra, QA) | d808bec0 | success; 1 flaky in shard 4 (`users.spec.ts:58` again) | 39 of 39, no retry | AC-5 8.5 / 8.6 / 11.8; keyboard 8.7 / 8.8 / 10.7; dialog axe 7.8 / 8.7 / 10.7 | 11.8 s | 0 of 39 |
| `master` push 44890683601 (jobs 136805603950, 136805603978, 136805604056, 136805604062) | 03c81cbf (#555's squash) | fully green; 522 / 515 / 517 / 501 passed, **0 flaky in all four shards** | 39 of 39, no retry | AC-5 8.2 / 9.2 / 9.1; keyboard 9.4 / 9.5 / 8.0; dialog axe 9.2 / 9.1 / 5.6 | **11.5 s** | 0 of 39 |

The cases ran 13 to 24 s before the fix (AC-5 read 22.7 / 23.8 / 13.5 s in the developer's diagnostic run 44865218505, tablet / mobile / desktop). The fix: the shared helper `engineerWentAhead` now sends the Engineer's Calculate requests with the existing `calculateAnywayWithoutThePage`, so no case opens a page for the Engineer, and only the Lead's open remains. No assertion changed and the case count is unchanged (master read the diff, DL-273 (1)). The DL-272 warm-up was allowed and was **not required** (DL-273 (A)).

**The first-minute cluster (evidence, DL-269 (2)(c), DL-272 (1)).** On two heads outside a ruled wave the three cases failed attempt 1 together, `[tablet]`, on parallel workers in shard 3's first two minutes, and passed on retry: PR #553 run 44863502429 (5b3f1719): :229 30.3 s (test no. 4), :280 30.9 s (no. 6), :253 30.2 s (no. 7), retries 17.9 / 19.4 / 20.1 s, about 70 s after the shard started (03:58:22Z against a 03:57:12Z start); PR #561 run 44883081233 (fff3faa8): :229 30.2 s (no. 4), :280 30.3 s (no. 5), :253 30.1 s (no. 7), retries 19.1 / 19.4 / 20.4 s, about 72 s in (08:06:08Z against 08:04:56Z). Master measured shard 3 at 1.28x and 1.25x `master`'s (below W1's 1.4x), so neither was a ruled wave (DL-269 (1), DL-272 (1)). This is the same early window as `estimate-form-sections:145` (DEF-050 hypothesis 3; test no. 6, about 70 s in). #555's runs did not place the three cases in a shard's first minute, so the cluster is neither reproduced nor shown fixed (DL-273 (3)); the new margin (7 to 14 s against 13 to 24 s) covers a 6 to 9 s first compile.

**Early-shard reopen trigger (DL-273 (3)), until 2026-11-28 (the 7 days after this close-out, inclusive).** Any attempt-1 failure of :229, :253 or :280 (by title) in the **first 2 minutes of a shard** (QA measures from the shard log's "Running N tests" line to the failed attempt's line), outside a ruled wave (W1 (d) measured, or ruled by master), on any run: QA **reopens DEF-051 the same day** (Status Reopened), R9 applies again, and the DL-272 warm-up becomes the required next step in the same lane. After 2026-11-28 a failure of any of the three is read under the Bug-or-watch line of DL-267 (2). QA reads the lead-warning rows of the Stage 12 logs it already reads.

## Scope after DL-267 (2026-11-21), as first written; superseded at close-out: all three cases are in scope (DL-269, DL-272, DL-273 (A))
**(i)** `tests/e2e/lead-warning.spec.ts`, describe "AC-5: the approval dialog says so, and Approve is not stopped", test "AC-5: one line names the row, there is no box to tick, and Approve and lock approves the calculation that carries the warning" (:229).

**(ii) (no longer in scope; on the watch list)** the same file, describe "AC-8: keyboard, focus and accessibility at this width", test "AC-8: by keyboard alone: Enter on Recalculate opens the dialog with focus on "Go back"; Escape closes it with nothing sent; the next Enter and Tab to "Recalculate anyway" go ahead" (:253). **This is the keyboard case.** The axe case of the same describe is "AC-8: no sideways scroll and no axe violation with the dialog open" (:280); it is **not** in scope (QA's earlier table B in the test plan labelled the cases by line only and was corrected on 2026-11-20). (ii) joins on the DL-257 (D)(ii) precedent: a case of the same spec at 95 % or more of its budget goes into the failing case's Bug.

## Steps to Reproduce
Not reproducible on demand: no local attempt (CLAUDE.md section 9 (5): heavy browser tests run in CI).
1. Run Stage 12 (E2E) on `master` or any PR; the shard that holds `lead-warning.spec.ts` (shard 4 of 4 in these runs).
2. Watch (i) in `[desktop]` and (ii) in any project.

## Expected Result
Each case inside its 30 s budget with margin: the proof below (P1 to P3, 15 s reported).

## Actual Result
| # | Date | Run (head) | Test | Result | Error position |
|---|---|---|---|---|---|
| 1 | 2026-11-20 | PR run 44752189754 (#540, 06474b76) | (i) [desktop] | **attempt 1 failed 30.2 s**; retry passed 16.4 s (test no. 168 of shard 4, about 10 minutes into the shard) | `expect(page.locator('#review-approved-notice')).toBeVisible()` at spec :245 after "Approve and lock": "element(s) not found", call log ends `Test timeout of 30000ms exceeded.` (the 15 s expect was cut by the 30 s budget). No value mismatch |
| 2 | 2026-11-20 | PR run 44752189754 (#540) | (ii) [desktop] | passed **29.5 s** (98 % of the budget) | - |
| 3 | 2026-11-20 | PR run 44662178640 (#526, 0307d91), a ruled 1.74x runner wave (DL-259 (1)) | (i) [desktop] and (ii) | both flaky in the time-out mode: (i) at the :245 expect cut by the budget; (ii) at its `page.waitForResponse` (:273) | master's reading, DL-259 (1); QA did not re-read this log. **Wave: does not count towards a trigger** (DL-259 (B)) |
| 4 | 2026-11-20 | `master` push 44755812730 (f652c22c, green, 0 flaky) | (i) / (ii) | (i) 13.6 / 17.4 / **25.0** s; (ii) 16.4 / 16.2 / **29.4** s (98 %) (mobile / tablet / desktop) | - |
| 5 | 2026-11-20 | `master` push 44752152410 (5d6d72b) | (i) / (ii) | (i) 25.4 / 24.8 / 18.7 s; (ii) **28.0** / 25.1 / 20.9 s | - |

**The distribution, corrected (QA, 2026-11-20).** In the logs QA holds (overlapping runs, not a full census), `[desktop]`: (i) 32 first-attempt readings, 1 failed (row 1); of the 31 that passed the median is **19.5 s**, 14 are at 20 s or more, **5 are at 25 s or more (25.0 to 29.6 s)**, the maximum is 29.6 s. (ii) 32 first-attempt readings, 0 failed; passing median 19.6 s, 14 at 20 s or more, 4 at 25 s or more, maximum 29.5 s. On mobile and tablet both cases have 0 failures, medians 18.2 to 19.6 s and maxima 25.4 to 28.4 s (mobile (ii) 28.0 s on 44752152410). **QA's earlier wording in the test plan ("Desktop readings 25.0 to 29.6 s on six passing runs") meant the readings at or above 25 s, not every reading; DL-264 (4) read it as every passing reading. That reading is not what the logs show** (see "Issues for other roles"). The case is in the near-budget tail on a slow draw, not at the edge on every draw.

**Mechanism (what the logs show, not more).** (i) hit the budget at the wait for the approved notice after "Approve and lock", i.e. after the set-up through the portal (an Engineer with an estimate, the Engineer going ahead past the warning, the Lead's sign-in and page open, the dialog) and the approval itself. The CI log has only the whole-test time and the error position, so where the 25 to 30 s goes is **not measured, so not known**.

## Evidence
Job logs of #540 run 44752189754 (shard 4), `master` push runs 44755812730, 44752152410 and 44739529276, and the older runs in QA's census, read by qa-engineer on 2026-11-20 (`gh api repos/.../actions/jobs/<id>/logs`); durations matched by project, file, line and title. DL-259 (1) and DL-264 (1) for row 3 and the draw. The shard-4 draw of #540's run was about 1.39x the `master` run 44752152410 (QA, 457 tests in common; its own `next build` reported "Finished TypeScript in 6.2 s" against 5.1 to 6.7 s on the other shards).

## Suspected Area
`tests/e2e/lead-warning.spec.ts` (:229 to :251; :253 to :278, its `page.waitForResponse` at :273), `tests/e2e/support/calculated-estimate.ts` (`engineerWithEstimate`, `signInAs`) and `tests/e2e/support/auth.ts`. Not `src/`, unless hypothesis 4 shows it.

## Measurement hypotheses (developer; measure before changing anything, cheapest first)
1. **Phase times of (i).** Print the time at: test start, Engineer and estimate made, Engineer's calculation (the warning gone past), Lead signed in and page open, dialog open, "Approve and lock" sent, `#review-approved-notice` visible. How much of 25 to 30 s is set-up through the portal?
2. **Phase times of (ii)** the same way, with the `page.waitForResponse` at :273 timed alone.
3. **Shared set-up with DEF-050.** (i) and DEF-050's `approve-override` :155 both make an Engineer with an estimate and have the Engineer calculate it through the portal before the Lead acts. Check whether one shared set-up helper (test-only, DL-257 (B): set-up that is not the case's subject) serves both; the same developer takes both Bugs.
4. **Product check.** Time to first render of `/estimates/<code>` for a Lead on the development server after the Engineer's calculation. If slow after the first hit, that is a **product defect**: QA re-grades and master is told at once.

## Binding for the fix (DL-264 (4); DL-229 (4)(b); DL-261 (4))
No skip, quarantine, retry, `test.slow()`, timeout change or fixed sleep, and no dropped width, assertion or check. **Measure first, then a test-only fix that keeps every assertion and the approval as a real action; the keyboard path of (ii) stays a real keyboard path.** Splitting a case is allowed if every assertion is kept. Set-up through rows or routes only for steps that are not the case's subject (DL-257 (B)). The fix stays in the spec or test-only support; a change under `src/`, `playwright.config.ts`, ci.yml or a dependency means stop and go to master. It takes a separate PR, in DEF-050's lane straight after DEF-050.

## Proof (DL-264 (4))
Read by the orchestrator from the job logs on the fix PR's run of record and on the first `master` push run after the merge whose Stage 2 is green, and posted on the Bug:
- **P1:** each case (or each case it is split into) passes on its first attempt at all three widths.
- **P2:** each takes under 25 s at every width.
- **P3:** each opens the page once and runs at most one axe scan.
- **15 s** reported, not gated.
If P1 or P2 fails, this Bug stays open and the developer brings the measured phases to master.

## Rule R9 (master, DL-264 (4), narrowed by DL-267, widened by DL-269 and DL-272; **ended at close-out, 2026-11-21**; history)
Any PR and `master` push runs. A red run may have its failed jobs re-run once per head only when all of these hold: R8's clauses **(a)** (`Stages 1 to 11b` success, the only red jobs are Stage 12 shards plus the fan-in, every red shard `1 failed`), **(c)** (every attempt's error is `Test timeout of 30000ms exceeded.`, alone or with a `page.*`, `locator.*`, `apiRequestContext.*` or `AxeBuilder.analyze` time-out, and no attempt shows an `expect(...)` failure message or an axe violation list) and **(e)** (every other test passed, each flaky listed with the re-run) and the multi-rule sentence of R8 apply as written, with these changes:
- **(b) as narrowed by DL-267 (2):** the failed test is exactly (i), in any project, identified by file and title. (The first text read "(i) or (ii)".)
- **(d)** (the clause for (ii) is withdrawn by DL-267 (2); it applies again if (ii) returns to scope, see "Watch" below) For (i), the failing call is the `expect(page.locator('#review-approved-notice')).toBeVisible()` after "Approve and lock" (spec :245 at f652c22), or an earlier wait of the same case, and its call log ends with "Test timeout of 30000ms exceeded": an expect cut by the 30 s budget counts as time-out mode. An expect that ran out on its own 15 s timeout, or that shows a value or a different element, is not covered. For (ii), the failing call is a wait cut by the 30 s budget (`page.waitForResponse`, `page.goto` or a locator wait whose call log ends with "Test timeout of 30000ms exceeded"). A focus or "nothing sent" check that failed on its own timeout or value is not covered, because that is the case's subject (AC-8).
- **(f)** The diff touches none of: `tests/e2e/lead-warning.spec.ts`; `tests/e2e/support/` files it imports (`auth.ts`, `calculated-estimate.ts`, `design-system.ts`, `servers.ts`); `playwright.config.ts`; the E2E global setup or seed; `prisma/seed/`; `src/lib/auth/`; the review and approval page, components, services, repositories and routes; the quantity-warning code (STORY-06.10); `prisma/` schema or migrations for estimates, calculations or approvals; or the `next`, `next-auth`, `@playwright/test`, `@axe-core/playwright` or `axe-core` versions.
- **Never re-run, and report to master at once:** an approval that did not happen (the database state check after :245 fails), a request sent after Escape, an expect that failed on its own timeout or a value, a red re-run, or a second red on the same head.
- **Records:** each re-run is one comment on AQP-381 (run ID, PR or `master`, head, result, the error position of each attempt), a line in the daily update, and an entry on RISK-031's re-run list (the orchestrator).

## Re-run list (orchestrator adds each; R9)
| When | PR / run | Head | Result |
|---|---|---|---|
| 2026-11-21 | (closed) | | R9 ended with the closure. QA holds no record of a re-run under R9 |

## Issues for other roles (no defect)
- **master: accepted (DL-267 (1), 2026-11-21).** Master corrected DL-264 (4) and narrowed this Bug to (i). The line that separates a Bug from a watch (DL-267 (2)): a time-out-mode attempt-1 failure outside a ruled wave plus at least three passing readings of 25 s or more in the same project is a Bug; one without the other is a watch with a trigger. (i) has both (1 failure; 5 readings); (ii) has the readings (4 of 32 at 25 s or more) but no failure outside the wave. **Watch (ii):** any attempt-1 failure of the keyboard case outside a ruled wave puts it back into this Bug the same day (QA records it), and R9 then covers it again with DL-264 (4)'s clause (d) for (ii). Readings are kept in the test plan, section 7. Earlier note:
- **master (a correction to the evidence in DL-264 (4)):** DL-264 reads "every passing desktop reading (six runs, 25.0 to 29.6 s) is at or above the 25 s P2 line". That came from QA's test-plan table C, whose wording was ambiguous and is corrected. In QA's logs the (i) desktop passing median is 19.5 s and 5 of 31 passing readings are at 25 s or more (see "The distribution, corrected"). The Bug was ordered and is logged as ordered, with the corrected figures. What changes is the strength of the evidence: one attempt-1 failure outside the wave (row 1), one wave occurrence, and a tail at 25 to 29.6 s on slow draws; (ii) has no failure outside the wave and passing readings at 98 %. Master may keep DL-264 (4) as ruled, or narrow the scope to (i) with (ii) on the watch list.
- **orchestrator:** please add this Bug and R9 to RISK-031's register line and keep the R9 re-run list; QA does not write the register or the decision log.
- **solution-architect:** same common root as DEF-048 to DEF-050 (the E2E per-case floor; the `architecture` issue of DL-264 (1)); QA did not create it.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Phases measured; mechanism confirmed or refuted | developer | 2026-11-21 | diagnostic run 44865218505 and the PR #555 body: every case that starts with the Engineer's going ahead opened the estimate page as the Engineer (1.9 to 5.7 s plus its sign-in) before the Lead's own open (AQP-381 comment 12480) |
| Fixed (spec or test-only helper) | developer | 2026-11-21 | PR #555 (`fix/AQP-381-lead-warning-e2e`), squash 03c81cbf: `lead-warning.spec.ts` only (the helper `engineerWentAhead` no longer opens a page) |
| Regression test added | developer | 2026-11-21 | the fix is the test change; no assertion changed, case count unchanged; the approval stays a real action and the keyboard path a real keyboard path |
| Verified: P1, P2, P3 on the fix PR's run and on the first `master` push run after merge | orchestrator reads, qa-engineer confirms | 2026-11-21 | PR #555 run of record 44870213022 (39 of 39 on attempt 1, worst 13.9 s, 0 over 15 s) and `master` push 44890683601 on 03c81cbf (39 of 39 on attempt 1, worst 11.5 s, 0 over 15 s, 0 flaky); read by QA from the job logs. **Closed 2026-11-21**; reopen trigger until 2026-11-28 |
| RISK-031 | master | | not a close-out condition (DL-264 (3)); R9 ended with this closure |

## Severity history and routing
- qa-engineer graded Sev-3, type Test, 2026-11-20, on master's DL-264 (4). It holds no story gate (AQP-327 is Done). It changes to a Product defect only if hypothesis 4 shows the estimate page for the Lead slow; master is told at once and QA re-grades.
