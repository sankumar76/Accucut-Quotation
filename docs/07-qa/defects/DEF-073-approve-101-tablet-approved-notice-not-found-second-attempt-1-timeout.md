# DEF-073: `approve.spec.ts:101` [tablet] "AC-8: the dialog at this width > is keyboard operable, ... and shows "Approving" while the request is under way": attempt-1 time-out with `#review-approved-notice` not found at :129 on `master` push run 45125449394 (30.1 s; retry 19.6 s); the case's **second** attempt-1 time-out (first: PR #613 run 45016832555 [desktop]); type Test, product not excluded (DL-334 (B))

| Field | Value |
|-------|-------|
| Story / AC | STORY-06.06 (AQP-323, Approve and lock, SCR-08), **AC-8 (NFR-016 to 018)**, verbatim from AQP-323: "SCR-08 at 360, 768, 1366 px / Playwright (CI) / Dialog keyboard-operable, safe focus, axe 0 violations, "Approving" saving state". The case also reads AC-2 / AC-5 on its last two lines (the approved notice, then the stored state `APPROVED`). **No AC is shown to fail:** attempt 1 ran out of its 30 s budget while waiting for the product's own notice, with no received value; the retry passed. This is an approval case, so a section 9 item 2 area (CLAUDE.md section 9 (2)) |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-23, on master's DL-334 (5)): fails closed (a retry passes; no wrong value received), a Test-type defect, no AC shown to fail, passes at the other widths on the same run. The raised care is for the area, not the grade (DL-301 (B)). A **received value on an approval assertion** is not this Bug: it comes to master at once |
| Priority | P3 (Jira Medium, label `sev-3`). **Lane: after DEF-072 and DEF-069's fix** (DL-334 (5)); never pauses a CR-01 story. **The cause step comes before any fix** (below). Not a G8 blocker |
| Type | **Test, product NOT excluded** (DL-334 (5)): the missing element is the product's own notice (`#review-approved-notice`), so the cause step must rule out a fault in the approve flow |
| Status | **Open** (logged 2026-11-23). No fix PR; no cause stated yet. DL-301 (B)(a) is met as written (a second attempt-1 time-out of `:101` on any run, any width). No re-run rule (DL-301 (B)(c), DL-334 (7), DL-326 (4)) |
| Jira / GitHub | [AQP-416](https://sankumar76.atlassian.net/browse/AQP-416) / [#647](https://github.com/sankumar76/Accucut-Quotation/issues/647). Jira "relates to" AQP-1 (Intake) and AQP-323 (the approval story); cross-linked (comment on AQP-416). Labels `ai-delivery`, `aiid-DEF-073`, `bug`, `sev-3`, `final-review`, `agent-qa-engineer`; priority Medium. DEF-073 was free: no file in `docs/07-qa/defects/`, JQL for `aiid-DEF-073` and "DEF-073" in the summary found nothing, GitHub search found nothing |
| Risk / rule | The run is a `master` push, and the case's retry passed, so the case was **flaky** (the push run's red is DEF-072). RISK-031 trigger (b) for 23 Nov (UTC) counts it: 7 + 2 (`estimate-review :210` [tablet] and `approve :101` [tablet]) = **9 on 3 runs** (DL-334 (8)). **Close-out (DL-326 (5), amended by DL-334 (8)):** `approve.spec.ts:101` joins `:135` and `:172` in the deferral clause: a time-out-mode flaky of any of the three on the run read for (iii) defers the close-out to the next run. In the same shard `:135` (28.1 s) and `:172` (22.2 s) [tablet] passed attempt 1 (QA re-read both), so DL-326 (6) is not triggered |
| Found by / date | CI, `master` push run 45125449394; found by master reading the job logs (DL-334 (1)); logged by qa-engineer 2026-11-23. Log lines re-read by QA on 2026-11-23 (job 137528621668, ANSI stripped) |
| Build / commit | `master` **06d5d56a** (#642's squash, Stage 11 test files only; the spec and the approve flow are unchanged by it). First occurrence: PR #613 run 45016832555 (head f70067fe, DEF-059's PR), shard 3 job 137190837912 |
| Environment | GitHub Actions `ubuntu-latest`, Stage 12 shard 2 of 4 (project tablet, 768 px), `next dev`, 4 workers, 30 s test timeout, one retry; invented data only |

## Steps to Reproduce
Not reproducible on demand: CI only (no local E2E, CLAUDE.md section 9 item 5). QA ran nothing locally and changed no code or test.
1. Read the job log: `gh api repos/sankumar76/Accucut-Quotation/actions/jobs/137528621668/logs --allow-escape-sequences` (run 45125449394, shard 2, test no. 171 and its retry 175).
2. The case (`tests/e2e/approve.spec.ts:101` to :131): `openedAsLead` (an Engineer with a calculated estimate, a Lead signed in, the review page opened); a route that delays the approve request by 800 ms (`SLOW_MILLISECONDS`, `APPROVE_ROUTE`); Enter on the focused Approve button opens the dialog; the price field is focused; no sideways scroll; `expectNoAxeViolations`; five Tab presses inside the dialog; Enter on the price field; the button reads "Approving" and is disabled; Escape does not dismiss it (:127, :128); then `expect(page.locator('#review-approved-notice')).toBeVisible()` at **:129**; then the estimate state is `{ status: 'APPROVED', calculations: 1 }` (:130).

## Expected Result
After the approval answers (the request is held for 800 ms), the page shows the approved state with the notice `#review-approved-notice` within the expect's 15 s, and the case passes inside 30 s (this run: mobile 20.4 s, desktop 20.8 s).

## Actual Result
```
✘ 171 [tablet] › tests/e2e/approve.spec.ts:101:3 › AC-8: the dialog at this width › is keyboard operable, ... (30.1s)     06:44:11.26Z
    Test timeout of 30000ms exceeded.
    Error: expect(locator).toBeVisible() failed
    Locator: locator('#review-approved-notice')    Expected: visible    Error: element(s) not found
    Call log:  - Expect "toBeVisible" locator('#review-approved-notice') with timeout 15000ms
               - waiting for locator('#review-approved-notice')
               - Test timeout of 30000ms exceeded.
    > 129 |     await expect(page.locator('#review-approved-notice')).toBeVisible();
✓ 175 [tablet] › ... (retry #1) (19.6s)                                                                                   06:44:34.91Z
Shard 2: 1 failed (estimate-review :210, DEF-072), 1 flaky (this case), 540 passed (20.8m)
```
No received value: the locator found no element at all. The call log ends at the 30 s budget, not at the expect's own 15 s, so the case reached :129 with **less than 15 s left** of its budget (a reading of the log: the expect's 15 s did not run out). The log does not say what happened between the "Approving" state and :129.

## Evidence
Logs read 2026-11-23 (QA, Stage 12 job logs of 45125449394, ANSI stripped); figures marked DL-334 are master's reading (DL-334 (1)).

**1. Same case, same run.** mobile 20.4 s (shard 1) and desktop 20.8 s (shard 3), both passed on attempt 1; tablet attempt 1 failed at 30.1 s, retry 19.6 s. Same shard: `approve.spec.ts:135` [tablet] passed attempt 1 in 28.1 s and `:172` [tablet] in 22.2 s (QA mapped each duration to its line).

**2. First occurrence (test plan section 7, watch entry; DL-301 (B)(3)).** PR #613 run 45016832555 (head f70067fe), shard 3 job 137190837912, test no. 300 [desktop], attempt 1 **30.1 s**, the same `expect(#review-approved-notice).toBeVisible()` at :129 "element(s) not found" (no received value); the retry passed in 18.6 s. So the same line and the same missing element, on a different width and a PR run (created 2026-11-22T11:20Z, about 19 hours before this push run).

**3. Attempt-1 readings of the case (s; mobile / tablet / desktop), from the watch entry:** 6087e8b8 14.8 / 25.8 / 23.4; 45008501202 10.9 / 22.1 / 15.7; 45010599354 12.6 / 15.5 / 14.6; eb4137f4 20.1 / 17.4 / 18.5; 50cb1150 17.5 / 20.1 / 12.8; f02c3b54 13.4 / 26.3 / 18.4; PR #616 run 45017915849 14.4 / 21.1 / 21.3. Tablet readings of 25.8 and 26.3 s were above the 25 s line. This run: 20.4 / **30.1 (failed)** / 20.8.

**4. Not a wave, not #642 (DL-334 (2)).** Shard 2 per-test median 1.000 against 45122632176 (86cf64d3); #642 changed Stage 11 test files only; the spec and `src/components/features/estimate-review` have not changed since `967e6337` (#624). The same minute (06:43:56Z to 06:44:11Z) had `estimate-tree.spec.ts:282` [desktop] waiting on a move answer on another runner (DEF-040's occurrence, below); a lead, not a finding: no shared cause is shown and the other shards in that window had no failures (DL-334 (6)).

## Cause step first (DL-334 (5); the order is binding)
1. **Before any fix**, the developer states, **by file:line on `master`**, what has to happen between the Approve press and `#review-approved-notice`: the request, the answer, the state change on the page. The statement must rule out a fault in the approve flow (the missing element is the product's own notice).
2. **If the log cannot name the step**, spec-local step-timing lines (the DL-327 (5) form) come first and merge on fully green CI.
3. **Approval is a section 9 item 2 area:** a change outside the spec, or any product cause, needs a combined review before merge. A **received value on an approval assertion** comes to master at once.
4. **DL-301 (B)(c) and (d) apply:** no re-run rule covers `:101` and a re-run of a run red on it is not merge evidence; the cause step must rule out a fault in the approve flow before any test-only fix.
5. The binding limits of DL-229 (4)(b) are the project's standing form for a time-out Bug (no skip, `fixme`, quarantine, retry, budget, timeout or `test.slow()` change; every assertion kept); DL-334 (5) states none beyond (1) to (4). The E2E test count stays the same while the DEF-057 and DEF-069 observers are being read (DL-296 (3)).

## Proof (QA's proposal, for the fix PR; master has not set one)
DL-334 (5) sets no proof line for this Bug. QA proposes the DL-257 (A) form used for DEF-072: attempt-1 pass at three widths on the fix PR's run of record and on the first `master` push after it, each under 25 s, and the watch trigger (any later attempt-1 time-out, or a received value) stays until G8. **This is a proposal, not a rule; master rules (below).**

## Suspected Area (optional)
`tests/e2e/approve.spec.ts:101` to :131, the wait between "Approving" and the notice; or the approve flow itself (request, answer, the page taking the answer and showing the notice). Cause not determined; product not excluded.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Cause stated (file:line on `master`) | developer | | not started |
| Fixed | developer (lane: after DEF-072 and DEF-069's fix) | | |
| Regression test added | developer (the case itself; count unchanged) | | |
| Verified | qa-engineer | | not started |

## For master
1. DL-334 (5) sets the order (cause step first) but not a proof line. QA proposes the DEF-072 form (above); please confirm or replace it before the fix PR opens.
