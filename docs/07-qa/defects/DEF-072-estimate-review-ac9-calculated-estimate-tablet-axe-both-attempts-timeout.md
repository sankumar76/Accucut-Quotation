# DEF-072: `estimate-review.spec.ts:210` [tablet] "AC-9: layout and accessibility > a calculated estimate: ... axe finds nothing" failed **both attempts** (30.2 s, then 31.6 s in the axe scan) on `master` push run 45125449394 (06d5d56a); type Test, product not excluded (DL-334 (A))

| Field | Value |
|-------|-------|
| Story / AC | STORY-06.02 (AQP-319, the estimate review, SCR-06), **AC-9 (NFR-016 to 018)**, verbatim from AQP-319: "360, 768, 1366 px / Playwright (CI) / Tiles stack at 360; tree drawer; axe 0 violations; notices `role="status"`". **No AC is shown to fail:** attempt 1 ran out of its 30 s budget with no step named, and the retry ran out of it inside the axe scan; no violation list, no `expect` failure and no received value was reported. AC-9's accessibility at 768 px was therefore **not checked** on this run (it was clean at mobile and desktop on the same run, and at all three widths on #643's run 45128502168) |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-23, on master's DL-334 (4)): fails closed (a red required check on `master`), a Test-type defect, no assertion failed, the case passes at the other two widths and on every earlier run read. Same grade as DEF-053 (the precedent master cites) |
| Priority | P3 (Jira Medium, label `sev-3`). **Lane: the next free lane, ahead of new story work** (DL-334 (4); DL-233 (3), DL-235 (A): the case turned the one required check red on `master`). Lane 3 (aqp-402) can take it now (#632 needs no developer work). The fix never pauses a CR-01 story in build and never takes a lane promised to a CR-01 story whose answer has arrived. **Not a G8 blocker** (Sev-3 Test) |
| Type | **Test, product NOT excluded** (DL-334 (4)). Two reasons: the scan did not finish, so AC-9's accessibility at 768 px was not checked on this run; and CR-01 items 7A, 7B, 3B and 7E have changed the review page since the earlier readings, so the cause step reads the page's size against 59a885d8 as one input (below) |
| Status | **Open** (logged 2026-11-23). No fix PR. No re-run rule (DL-334 (7): RISK-031 is open, DL-326 (4)); 45125449394 is not re-run (DL-266 (1)). The next squash's push run is `master`'s run of record |
| Jira / GitHub | [AQP-415](https://sankumar76.atlassian.net/browse/AQP-415) / [#646](https://github.com/sankumar76/Accucut-Quotation/issues/646). Jira "relates to" AQP-1 (Intake) and AQP-319 (the owner story of estimate-review AC-9); cross-linked (comment on AQP-415). Labels `ai-delivery`, `aiid-DEF-072`, `bug`, `sev-3`, `final-review`, `agent-qa-engineer`; priority Medium. DEF-072 was free: no file in `docs/07-qa/defects/`, JQL for `aiid-DEF-072` and for "DEF-072" in the summary found nothing, GitHub search found nothing |
| Risk / rule | **RISK-031 trigger (a) is met** (a red required check on a `master` push, time-out mode, Stage 12), RISK-031 is already open at 9: no re-score (DL-334 (8)). Trigger (b) for 23 Nov (UTC): 7 + 2 = **9 on 3 runs** (this case and `approve.spec.ts:101` [tablet]; `estimate-tree.spec.ts:282` is not counted). **Close-out (DL-326 (5), amended by DL-334 (8)): item (iv) = DEF-072 closed on its proof, and the run read for (iii) contains DEF-072's fix.** A PR run red on this case is not re-run and comes to master; a `master` push red on it is recorded by the orchestrator in the daily update and on this Bug, and comes to master (DL-334 (7)) |
| Found by / date | CI, `master` push run 45125449394; found by master reading the job logs (DL-334 (1)); logged by qa-engineer 2026-11-23. Log lines re-read by QA on 2026-11-23 (job 137528621668, ANSI stripped) |
| Build / commit | `master` **06d5d56a** (#642's squash: five Stage 11 test files, `tests/integration/mail/*`, `settings/alerts-settings`, `tasks/assign-email`, `tests/support/mail-capture.ts`). The spec and `src/components/features/estimate-review` have not changed since `967e6337` (#624) (DL-334 (2)) |
| Environment | GitHub Actions `ubuntu-latest`, Stage 12 shard 2 of 4 (project tablet, 768 px), `next dev`, 4 workers, 30 s test timeout, one retry, `trace: 'on-first-retry'` (the run has no uploaded artifacts: `gh api .../runs/45125449394/artifacts` lists none, so the retry's `trace.zip` named in the log is not available); invented data only |

## Steps to Reproduce
Not reproducible on demand: CI only (no local E2E, CLAUDE.md section 9 item 5). QA ran nothing locally and changed no code or test.
1. Read the job log: `gh api repos/sankumar76/Accucut-Quotation/actions/jobs/137528621668/logs --allow-escape-sequences` (run 45125449394, shard 2).
2. The case, as on `master` 06d5d56a (`tests/e2e/estimate-review.spec.ts:210` to :239): `engineerWithEstimate` (database set-up), the Engineer signs in **through the page** (the file's own `signInAs`, :44 to :50: `/sign-in`, then the queue), opens `/estimates/<code>`, presses Calculate by `fetch`, reads the estimate state; a disposable Lead signs in **through the page** (a second sign-in screen and queue) and opens the review page; reads the three tile boxes; opens and closes the parts tree twice; opens "How the total is built"; reads the overflow; then `expectNoAxeViolations(page)` at :238, the case's only axe scan, with the build panel open.

## Expected Result
The case passes inside its 30 s budget at all three widths, as it did on every earlier run read (tablet attempt 1: 17.7 to 27.8 s, below), and axe finds nothing at 768 px with the build panel open.

## Actual Result
```
✘ 441 [tablet] › tests/e2e/estimate-review.spec.ts:210:3 › AC-9: layout and accessibility › a calculated estimate: ... axe finds nothing (30.2s)      06:54:48.69Z
    Test timeout of 30000ms exceeded.                                                    (attempt 1; no step named, no received value)
✘ 446 [tablet] › ... (retry #1) (31.6s)                                                 06:55:25.23Z
    Test timeout of 30000ms exceeded.
    Error: frame.evaluate: Test timeout of 30000ms exceeded.
       at support/design-system.ts:100   const results = await new AxeBuilder({ page }).options({ resultTypes: ['violations'] }).withTags(AXE_TAGS).analyze();
       at AxeBuilder.runPartialRecursive (@axe-core/playwright/dist/index.mjs:282:39)
       at expectNoAxeViolations (tests/e2e/support/design-system.ts:100:19)
       at tests/e2e/estimate-review.spec.ts:238:5
Shard 2: 1 failed, 1 flaky, 540 passed (20.8m)      (7 skipped)
```
The shard's one flaky case is `approve.spec.ts:101` [tablet] (DEF-073). The run's fan-in "Stages 1 to 11" is red because of this case; `Stages 1 to 11b` is `success`; shards 1 (`548 passed`), 3 (`545 passed`) and 4 (`1 flaky, 528 passed`; the flaky one is `estimate-tree.spec.ts:282` [desktop], DEF-040) are `success`.

## Evidence
Logs read 2026-11-23 (QA, from the Stage 12 job logs of 45125449394, ANSI stripped); figures marked DL-334 are master's reading (DL-334 (1)) and were not recomputed by QA.

**1. Same case, same run, other widths and the sibling case.** mobile 22.9 s (shard 1) and desktop 18.6 s (shard 4), both passed on attempt 1; "not calculated: no sideways scroll and axe finds nothing" (:241) passed at tablet in 13.3 s in the same shard (a case with the same axe scan and no calculation, no tree, no panels).

**2. Attempt-1 readings of this case at tablet on earlier runs (DL-334 (3); s):** 17.7 (45111572570), 19.2 (45116869670), 21.0 (45116955985), 24.7 (45122632176), 20.4 (45125512077), **27.8 (45128502168, #643's run of record)**; then **30.2 (failed; this run)**. Mobile reads up to 23.3 s and desktop up to 23.8 s. This is the first failure on record: test plan section 7 has no entry for the case, and the only DL mention is a near-budget reading of 26.3 s (DL-222). The case is a near-budget case on a normal draw: the 27.8 s reading came one run earlier and passed.

**3. Not a wave, not #642 (DL-334 (2)).** Shard 2 per-test median **1.000** (540 tests matched, total 1.011) against the W1 (d) reference 45122632176 (86cf64d3), the latest fully green push that had completed (DL-328 (4), DL-332); shards 1, 3 and 4: 1.017, 0.957 and 0.795. #642 changed Stage 11 test files only. For Stage 12 the code under test is 86cf64d3's, which was fully green. #643's run of record (`master`'s tree plus three test lines) passed the case at three widths (18.4 / 27.8 / 21.7 s).

**4. What the log does not say.** Attempt 1 names no step. The retry stood in `frame.evaluate` of `AxeBuilder.analyze` (`design-system.ts:100`) from spec :238: the scan did not return within what was left of the budget. QA cannot tell from the log whether the time before :238 (two page sign-ins, two page loads, the calculation, the toggles) used most of the budget on attempt 1, or whether the scan itself stood. No server-side request timing reaches the log (`next dev`, no `stdout: 'pipe'`, `playwright.config.ts:107`).

## Cause-step inputs (for the developer; DL-334 (4); QA states facts, not the cause)
1. **Structure of the case (P3 asks the PR body to state it):** database set-up; **two sign-ins through the page** (each is the sign-in screen and the queue behind it; the file's own `signInAs`, not the support helper `signInWithoutThePage` that `calculated-estimate.ts` documents as saving "the two page loads" for specs whose subject is not the sign-in); the Engineer's workspace page; a Calculate `fetch`; the review page; box reads, two folds of the tree, the build panel opened; **one** axe scan at :238 on a whole page with the panel open.
2. **Class:** the same as DEF-048 (a long case ending in a whole-page axe scan on `next dev`; closed, scoped to `estimate-treatments`), but no open Bug covers this case (DL-334 (3)).
3. **Page size and change since the earlier readings.** The review page's code changed after the earlier near-budget readings: `59a885d8` (CR-01 7A, Prepared replaces Submitted, #620), `967e6337` (7B status machine, #624: `estimate-review.tsx`, `review-actions.tsx`, `review-texts.ts`), `7a21de81` (the download log and marker, #622: `review-page.tsx`, `estimate-review.tsx`), and earlier the same day `5db39609` (3B tree rows, #623), `d119ae39` (item 6, #601) and `08394110` (item 1, compact screens, #600). The cause step reads the page's size (DOM nodes, tree rows, scan time) against `59a885d8` as one input, because AC-9's scan covers the whole page.
4. **Changes to the test side (read with `git log` on `origin/master`, 2026-11-23):** the spec itself last changed in `59a885d8` (2 lines: the state read is `PREPARED`) and `5db39609` (3B: the tree rows are `[data-part-row]` instead of `li`, two places), both 22 Nov, before `967e6337`; so DL-334 (2)'s "has not changed since 967e6337" is right, and the spec's last change is `59a885d8`. The shared scan `expectNoAxeViolations` (`support/design-system.ts`) changed once in the window read, `efeed217` (#571, DEF-053, 21 Nov: `options({ resultTypes: ['violations'] })`, the same rules, tags and whole-page scope), and is **not** among the commits since the earlier near-budget readings of 23 Nov. `playwright.config.ts` and `.github/workflows/ci.yml` have no commit since 19 Nov (`abd09476`) in `git log --since=2026-11-17`.
5. **Run-level facts:** shard 2 ran the long `estimate-picture` cases just before this case; #643's run read the same case at 27.8 s.

## Binding limits and proof (master, DL-334 (4); QA's record, no ruling made here)
- **Root cause** (DL-229 (4)(b)). No skip, `fixme`, quarantine, retry, budget, timeout or `test.slow()` change.
- **Only `tests/e2e/estimate-review.spec.ts` changes.** A change to `tests/e2e/support/**` (including the scan in `design-system.ts`), `playwright.config.ts`, `ci.yml`, package files or `src/` comes to master first.
- **Every assertion is kept, including the axe scan with the build panel open at every width.** The E2E test count stays the same while the DEF-057 and DEF-069 observers are being read (DL-296 (3)). Direct-row set-up is allowed only on DL-257's terms.
- The PR body states what used the time on the failing attempts (or adds spec-local step lines first, in the DL-327 (5) form) and gives the case's attempt-1 durations at three widths, before and after.
- **Proof (the amended DL-257 (A) form):** **P1** attempt-1 pass at three widths on the fix PR's run of record **and** on the first `master` push after it; **P2** each under 25 s; **P3** the PR body states the case's structure (page opens, sign-ins, axe scans), with one axe scan. A 15 s figure is reported, not gated.
- **Watch until G8:** any later attempt-1 time-out of the case reopens the Bug. **An axe violation list, or a received value, on this case comes to master at once.**
- A PR run red on this case is not re-run (no re-run rule while RISK-031 is open) and comes to master.

## Suspected Area (optional)
`tests/e2e/estimate-review.spec.ts:210` to :239: a long case (two page sign-ins, two page loads, one whole-page axe scan with the build panel open) at 768 px on `next dev`, near its budget on a normal draw (17.7 to 27.8 s at tablet); and the review page itself, which gained code from several CR-01 items since the earlier readings. Cause not determined.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer (lane 3, ahead of new story work; not started) | | |
| Regression test added | developer (the case itself; count unchanged) | | |
| Verified (P1, P2, P3) | qa-engineer | | not started |

## For master
None asked. DL-334 (A) rules the grade, type, lane, limits and proof; QA records them. Open for the cause step: whether the page's size against 59a885d8 (input 3) is measured by the developer or by QA is not stated in DL-334 (it reads "the cause step reads"); QA assumes the developer, as for DEF-069.
