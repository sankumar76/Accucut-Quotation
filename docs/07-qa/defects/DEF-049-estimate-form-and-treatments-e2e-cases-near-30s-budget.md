# DEF-049: `estimate-form` AC-9 axe case times out at 30 s on the tablet (flaky on `master` and on PR #531); `estimate-treatments` AC-2 "every treatment chosen" runs at 98 % of its budget

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.03 (AQP-303, Done) owns `estimate-form.spec.ts`, its AC-9. STORY-05.06 (AQP-314, Done) owns `estimate-treatments.spec.ts`, its AC-2. Seen on `master` push run 44546695829 and on PR #531 (AQP-377, DEF-048's fix), which is not the cause. **No AC fails:** neither time-out shows an `expect` message or an axe violation list. AC-9 and AC-2 are not shown to regress |
| Severity | **Sev-3 Moderate** (qa-engineer, per master's DL-257 (D)): a Test-type defect, fails closed (a red required check), workaround is a re-run under rule R7, no product behaviour affected as far as the evidence shows. Same grade family as DEF-045 to DEF-048 |
| Priority | P3 on its own; **takes the first lane that frees and is not already promised**, ahead of any new story (DL-257 (5)). Pre-emption: either test failing on both attempts on a second head, or on any `master` push run, gives it a lane at once; a slot the delivery lead promised is never taken without asking the delivery lead first |
| Type | **Test** (E2E, Playwright, `tablet` project; duration-tail class). No product defect found |
| Status | New (2026-11-19). **Fix in progress (AQP-378).** Not fixed by QA (measurement and fix: developer). **From 2026-11-20 this file also holds the near-budget watch list** (section below), moved from DEF-048 when that Bug closed |
| Jira / GitHub | [AQP-378](https://sankumar76.atlassian.net/browse/AQP-378) / [#533](https://github.com/sankumar76/Accucut-Quotation/issues/533). Jira "relates to" AQP-377 (DEF-048), AQP-314 and AQP-303 |
| Risk / rule | RISK-031 stays open at 9 (DL-257 (8)); its close-out now also needs this Bug's proof. Rule **R7** (DL-257 (5)) governs re-runs until the fix PR has merged |
| Found by / date | CI. `master` push run 44546695829 (head 1e6a4d42, tablet) and PR #531 run 44580739670 attempt 2 (head b0320c05, tablet). Evidence read by master (DL-257 (1)); logged by qa-engineer, 2026-11-19 |
| Build / commit | `master` 1e6a4d42 (run 44546695829), `master` 0056227 (run 44509175744, for (ii)), PR head b0320c05 (run 44580739670). Specs read at `origin/master`; not edited |
| Environment | GitHub Actions `ubuntu-latest`, 4 vCPU and 15,983 MB, Stage 12 E2E shard 2 of 4, four workers; one development server and one PostgreSQL shared by the four workers; invented data only |

## Scope: two tests, each identified by file and title (not by line)
**(i)** `tests/e2e/estimate-form.spec.ts`, describe "AC-9: the screen", test "AC-9: no sideways scroll, axe finds nothing (with an error showing and with a value saved), every control is 44 px high and every label is visible" (:224).

**(ii)** `tests/e2e/estimate-treatments.spec.ts`, describe "AC-1, AC-2: the eight surface treatments as one multi-select", test "AC-2: with every treatment chosen the trigger shows every name as text and the page still does not scroll sideways" (:264 on `master`, :275 after #531).

## Steps to Reproduce
Not reproducible on demand: no local attempt (CLAUDE.md section 9 (5): heavy browser tests run in CI).
1. Run Stage 12 (E2E) on `master` or any PR; the shard that holds `estimate-form.spec.ts` and `estimate-treatments.spec.ts` (shard 2 of 4 in these runs).
2. Watch `[tablet]` for the two tests above.

## Expected Result
Each case inside its 30 s budget with margin: the amended proof below (P1 to P3, DL-257 (A) and (5)).

## Actual Result
| Test | Run | Result |
|---|---|---|
| (i) `estimate-form` AC-9 [tablet] | `master` push 44546695829 (1e6a4d42) | **attempt 1 failed at 30.2 s, flaky; passed on retry in 28.5 s.** `page.evaluate: Test timeout of 30000ms exceeded` in `AxeBuilder.analyze` at `tests/e2e/support/design-system.ts:96`, via `expectFormAccessible` at spec :248 |
| (i) | PR #531 run 44580739670 attempt 2 (b0320c05) | flaky [tablet], **same error and same location** |
| (i) | the other tablet and desktop readings of the three `master` runs master read (44546695829, 44540107462, 44509175744) | 19.8 to 27.1 s (26.1 s on 44509175744, in DEF-048's table) |
| (ii) `estimate-treatments` AC-2 [tablet] | `master` push 44509175744 | 28.8 s, passed (96 % of 30 s) |
| (ii) | PR #531 run 44580739670 | attempt 1 25.3 s; attempt 2 **29.4 s (98 % of the budget)**, passed. **Has not failed yet** |
| (i) and (ii) | 2026-11-20, read by QA from the job logs: PR #531 run of record 44737067927 (85735d86); `master` push 44739529276 (402485c) | **(i)** `estimate-form` AC-9, mobile / tablet / desktop: 14.4 / 17.9 / 10.8 s on #531's run; **26.2 / 23.1 / 18.2 s** on the `master` push run (26.2 s is 87 % of the budget; no failure). **(ii)** treatments AC-2 "every treatment chosen" (:275): 17.5 / 16.2 / 15.9 s on #531's run; **22.5 / 20.7 / 15.9 s** on the `master` push run. All first attempt, no retry. Neither failed on these two runs |

**Mechanism.** (i) is DEF-048's: the form opens, then two whole-form axe scans. (ii) differs: **eight save round trips plus the form open and one scan** (the eight saves are the case's subject). Neither shows an `expect` message or an axe violation list.

## Evidence
Read from the job logs by master (DL-257 (1)) and recorded here; the CI log has only the whole-test time and the error position. Not measured, so not known: the time of each scan inside (i), the time per save in (ii), and the server time of the part form (DEF-048 hypotheses 2 and 4 apply). The measured floor for opening the part form on `next dev` is 6 to 9 s and one whole-form scan 2.2 to 3.4 s (DL-257 (1), the developer's phases on run 44567048767). The tablet draw of shard 2 is normal (16.9 to 19.8 minutes on these runs), not an outlier.

## Suspected Area
`tests/e2e/estimate-form.spec.ts` (:224 to :250), `tests/e2e/estimate-treatments.spec.ts` (the AC-2 "every treatment chosen" case, with `tests/e2e/support/treatment-rows.ts`), `tests/e2e/support/design-system.ts:96` and `tests/e2e/support/part-form.ts` (`expectFormAccessible`, `openForm`). Not `src/`, unless DEF-048 hypothesis 4 (time to first render of the part form) shows it.

## Rule R7 (master, DL-257 (5), as written; until the fix PR has merged)
**Rule R7, from now until the Bug's fix PR has merged** (any PR, and `master` push runs while that commit is the tip). A red run may have its failed jobs re-run once per head only when all of these hold: (a) as in R6 (a); (b) the failed test is exactly (i) or (ii) above, in any project, identified by file and title; (c) every attempt's error is `Test timeout of 30000ms exceeded.`, alone or with a `page.*`, `locator.*` or `AxeBuilder.analyze` "Test timeout of 30000ms exceeded" error, and no attempt shows an `expect(...)` failure message or an axe violation list; (d) as in R6 (d); (e) the diff touches none of these: `tests/e2e/estimate-form.spec.ts` or `tests/e2e/estimate-treatments.spec.ts`; `tests/e2e/support/part-form.ts`, `design-system.ts`, `auth.ts`, `servers.ts` or `treatment-rows.ts`; `tests/support/defined.ts`; `prisma/seed/`; `src/lib/columns.ts`; `playwright.config.ts`; the E2E global setup or seed; `src/components/features/estimate-workspace/`; the estimate workspace page or its API routes under `src/app/`; the part-input or treatment services, repositories and routes; `prisma/` schema or migrations for estimates, parts or treatments; or the `@playwright/test`, `@axe-core/playwright` or `axe-core` versions. A run that is red on the signatures of more than one live rule (R5, R6, R7) may be re-run once only if it meets each of those rules in full. **Never re-run, and report to master at once:** an `expect` failure or an axe violation in either test (a possible AC-9 or AC-2 regression), or a second failure on the same head. Each re-run is recorded as for R6: one comment on the PR's story and on the new Bug, a line in the daily update, and an entry on RISK-031's re-run list.

For reference, R6 (a) and (d) (DL-256 (3), see DEF-048): (a) `Stages 1 to 11b` success and only Stage 12 shards plus the fan-in red, each red shard `1 failed`; (d) every other test passed (each flaky listed with the re-run).

## Binding for the fix (DL-257 (5); DL-229 (4)(b); DL-256 (5))
No skip, quarantine, retry, `test.slow()`, timeout change or fixed sleep, and no dropped width, axe scan or assertion. Splitting a test is allowed if every assertion and scan is kept. Set-up through rows or routes is allowed as in DL-257 (B), but only for steps that are not the case's subject: **the eight saves are the subject of (ii), so they stay real saves.** The fix stays in the specs or in test-only support; a change under `src/`, `playwright.config.ts`, ci.yml or a dependency means stop and come back to master. The fix takes a separate PR, in practice by the AQP-377 developer after #531 has merged; #531 is not widened.

## Proof (amended form of DL-257 (A))
Read by the orchestrator from the job logs on the fix PR's run of record and on the first `master` push run after the merge whose Stage 2 is green, posted on AQP-378:
- **P1:** each case (or each case it is split into) passes on its first attempt at all three widths (mobile, tablet, desktop).
- **P2:** each takes under 25 s at every width.
- **P3:** each opens the page once and runs at most one axe scan. A later change that adds a second page open or scan to one of these cases needs master.
- **15 s** stays the target for a quiet draw: reported, not gated.

If P1 or P2 fails, this Bug stays open, R7 continues, and the developer brings the measured phases to master.

## Near-budget watch list (moved here from DEF-048 on 2026-11-20; QA keeps it current)
**Why here.** DEF-048 closed on 2026-11-20 (its proof is met), and DEF-048's table of cases at 25 s or more was the live watch list (DL-256 to DL-259). DEF-049 is open, covers the same class (the E2E per-case floor, DL-257 (9)) and has the same owner lane, so the list lives here until this Bug closes; then it moves to the QA test plan (section "Flaky tests") or to the next open Bug of the class. **Evidence only, not scope**: a case on this list is not part of any Bug's scope unless master widens it (DL-259 (3)). **Lines:** 25 s is the near-budget line for a 30 s budget (P2); 20 s is the lower line master set in DL-259 (3) for green-run readings. A case with `test.slow()` (90 s) or `test.setTimeout(60_000)` is counted against that budget and is not on the list unless it is over 80 %.

**A. Readings over 20 s that master asked to add (DL-259 (3); green run 44667850276 on #510's head 3caadda, read by master; QA did not re-read that log).**

| Case (project as master read it) | Reading | Budget |
|---|---|---|
| `users.spec.ts:58` [desktop] | 24.6 s | 30 s |
| `remove-price.spec.ts:136` | 22.5 s | 30 s |
| `lead-warning.spec.ts:253` | 21.5 s | 30 s |
| `estimate-warning.spec.ts:117` | 20.8 s | 30 s |
| `estimate-review.spec.ts:166` | 20.0 s | 30 s |

On #526's slow run 44662178640 (a 1.74x runner wave) most of these were flaky in the time-out mode; on the fully green `master` shard 4 of run 44667806338 they took 12 to 18 s (DL-259 (1)). The wave run is not a reading of the tests.

**B. QA's reading of the same five on `master` push 44739529276 (402485c, 2026-11-20; mobile / tablet / desktop, s).**

| Case | Reading | Note |
|---|---|---|
| `users.spec.ts:58` | 8.4 / 9.9 / **20.3** | desktop is the only reading over 20 s |
| `remove-price.spec.ts:136` | **25.4** / 19.3 / 19.3 | in DEF-050 (AQP-380), scope (ii) [tablet]: flaky on 3 runs |
| `lead-warning.spec.ts:253` | **22.1 / 22.0** / 15.4 | |
| `estimate-warning.spec.ts:117` | **21.3** / 19.7 / 16.8 | |
| `estimate-review.spec.ts:166` | 15.1 / 15.3 / 18.5 | under 20 s on this run |

**C. This Bug's two cases (verified, 2026-11-20).** (i) `estimate-form` AC-9: **26.2 / 23.1 / 18.2 s** on `master` push 44739529276 (mobile / tablet / desktop), 14.4 / 17.9 / 10.8 s on #531's run 44737067927. (ii) treatments AC-2 "every treatment chosen" (:275): **22.5 / 20.7 / 15.9 s** and 17.5 / 16.2 / 15.9 s on the same two runs. The orchestrator's figures on AQP-377 (comment 12390) agree. The 26.2 s reading is above the P2 line of 25 s on the (i) mobile case; it is a reading of the unfixed test, so it counts as evidence for this Bug, not as a proof miss.

**D. Other 30 s cases at 25 s or more on the same `master` push run 44739529276 (project, s).** `estimate-treatments.spec.ts:61` [mobile] 26.0 (AC-1; 25.0 and 26.5 on the 2026-11-19 runs); `approve-override.spec.ts:184` [mobile] 25.5; `approve-override.spec.ts:133` [mobile] 24.9; and `approve-override.spec.ts:155` [mobile], which failed attempt 1 at 30.1 s and passed on retry in 26.6 s (DEF-050). Cases on a 60 s or 90 s budget are not listed (for example `estimate-save.spec.ts:304` [mobile] 33.0 s on a 60 s budget is 55 %). The `auth.setup.ts:165` set-up test reads 27.1 to 36.6 s on the same run; QA did not check its budget and lists it as a question, not a finding.

**Reading rule.** A case moves to a Bug when it meets the RISK-031 practice (a time-out-mode flaky on two runs in one day, or a failure on both attempts) and no open Bug covers it; QA logs the Bug the same day and tells master. QA refreshes sections B to D from the first `master` push run after each merge that touches E2E, and at the hardening window.

## Re-run list (orchestrator adds each; R7)
| When | PR / run | Head | Result |
|---|---|---|---|
| | none yet | | |

## Issues for other roles (no defect)
- **master:** watch only, no Bug (DL-257 (E)): `estimate-save.spec.ts:107` [mobile], `rates-changed.spec.ts:135` [tablet], `unlock.spec.ts:186` [mobile]. A second occurrence of any of the three on any run means QA logs a Bug the same day and tells master. None may be re-run under any R-rule. QA has not logged Bugs for them.
- **orchestrator:** keeps the R7 re-run list (here, on AQP-378, in the daily update and on RISK-031). QA did not edit the risk register or the decision log.
- **solution-architect:** DL-257 recommends an `architecture` GitHub issue for after G8 (section 9 item 4) on the E2E per-case floor (6 to 9 s to open the part form on `next dev` under four workers). QA did not create it.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Phases of (i) and (ii) measured; mechanism confirmed or refuted | developer | | AQP-378 comment |
| Fixed (spec or test-only helper) | developer | | `fix/AQP-378-<slug>`, first free lane after #531 merges |
| Regression test added | developer | | the fix is the test change; both specs keep every assertion and scan; the eight saves stay real |
| Verified: P1, P2, P3 on the fix PR's run and on the first `master` push run after merge | orchestrator reads, qa-engineer confirms at hardening | | |
| RISK-031 close-out (DEF-049 part) | master | | the proof plus a `master` push run with 0 time-out-mode flaky |

## Severity history and routing
- qa-engineer graded Sev-3, type Test, 2026-11-19, on master's DL-257 (D). It holds no story gate (AQP-303 and AQP-314 are Done; #531 is not the cause). It changes to a Product defect only if a measurement shows the part form itself slow; master is told at once and QA re-grades.
