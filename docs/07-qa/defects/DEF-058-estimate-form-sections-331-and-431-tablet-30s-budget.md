# DEF-058: `estimate-form-sections.spec.ts` :331 (AC-8) and :431 (AC-4, AC-8) [tablet] cut by the 30 s budget on PR #599 run 44985919886, outside a slow-shard wave (Test)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.04 (AQP-304, Done): the case at :331, its AC-8 ("no sideways scroll, axe finds nothing (with a message showing and with values saved), every control is 44 px high and the strip links too"). STORY-05.11 (AQP-368, Done): the case at :431, its AC-4 and AC-8 ("the save that completes a part changes its icon in the tree with no reload, and says "Part 1 is complete." once, politely"). **No AC is shown to fail:** every failed attempt reads only `Test timeout of 30000ms exceeded.` (no call log, no received value, no violation list) |
| Severity | **Sev-3 Moderate** (master's DL-290 ruling A2): a Test-type defect, fails closed (a red required check if both attempts fail), workaround is the retry or an R11 re-run, no product behaviour affected as far as the evidence shows. Same grade family as DEF-045 to DEF-053 |
| Priority | P3. **Lane (DL-290 (5)):** hardening window, behind the Sev-2 and Major items already queued, ahead of the Minors |
| Type | **Test** (E2E, Playwright, `tablet` project; duration-tail class: 60 to 80 % of the 30 s budget on an ordinary draw) |
| Status | **Closed** (logged 2026-11-22; P1, P2 and P3 met, closed by QA 2026-11-22, see "Proof P2 and close-out") |
| Jira / GitHub | [AQP-392](https://sankumar76.atlassian.net/browse/AQP-392) / [#602](https://github.com/sankumar76/Accucut-Quotation/issues/602). Jira "relates to" AQP-1 (Intake), AQP-304 (STORY-05.04) and AQP-368 (STORY-05.11). RISK-031 (master's register, closed by DL-279) is the context: not a Jira issue, named in the Jira description. Labels `ai-delivery`, `aiid-DEF-058`, `agent-qa-engineer`, `final-review`, `sev-3`; priority Medium |
| Risk / rule | RISK-031 (closed; this Bug does not reopen it: the failures are on a PR run and trigger (b) counts `master` push runs only, DL-290 (4)). Re-run rule **R11** (DL-290 (5)) governs PR runs until this Bug closes; live rules with it: W1, R10 |
| Found by / date | CI, on PR #599 (AQP-389); read by master (DL-290); logged by qa-engineer, 2026-11-22. Earlier history: :431 watch entry (DL-270, DL-274 (3), DL-281); :331 failed both attempts once before, inside PR #538's 1.62x wave (DL-265), which does not count |
| Build / commit | PR #599 head `5fe9fed6`, merge ref "Merge 5fe9fed6 into 60ac0d18", run 44985919886, attempt 1, Stage 12 shard 2 (job 137096326780). Base: `master` push 44985240147 (60ac0d18) |
| Environment | GitHub Actions ubuntu-latest, Stage 12 shard 2 of 4, project tablet, dev server, 4 workers, test timeout 30 s, expect timeout 15 s, one retry; invented data only |

## Steps to Reproduce
Not reproducible on demand (CI only; no local run, CLAUDE.md section 9 item 5). Run `npx playwright test tests/e2e/estimate-form-sections.spec.ts --project=tablet` in Stage 12 (CI) on a slow draw: the two cases need the whole-page axe scan at three widths (:331) or a save, a tree icon check and the polite status (:431), and read 18 to 24 s at tablet and mobile on a normal draw.

## Expected Result
Each case passes on attempt 1 with margin under the 30 s budget (the P2 line of DL-257 (A) is 25 s).

## Actual Result
On PR #599 run 44985919886, attempt 1 (shard 2: `1 failed, 1 flaky, 525 passed (21.2m)`; shards 1, 3 and 4 green with 0 flaky):

| Case | Project | Attempt 1 | Retry | Result |
|---|---|---|---|---|
| :331 AC-8 (STORY-05.04) | tablet | 30.2 s (test no. 375) | 31.5 s (no. 381) | **failed both attempts** |
| :431 AC-4, AC-8 (STORY-05.11) | tablet | 30.2 s (no. 379) | 31.2 s (no. 384) | flaky: failed attempt 1, **passed** on the retry (at 31.2 s, the report's duration for the retry) |

```
Test timeout of 30000ms exceeded.
```
(for each failed attempt, with no `Error:` block, no call log and no received value; `trace: on-first-retry` keeps nothing of attempt 1.) Both first attempts ended in minute 12 of the shard, 21 s apart, on parallel workers.

**Not a ruled wave (W1 (d); master's DL-290 (2), QA agrees):** shard 2 ran **1.23x** the base run's shard 2 (1.20 in its first 4 minutes, 1.45 in minutes 10 to 12, where both cases ran); the other shards ran 0.98, 0.71 and 1.00, so shard 2 sat 0.23 above the highest. All three W1 (d) lines fail (1.4x, 1.3x, 0.25).

**Readings, s (attempt 1 unless marked; mobile / tablet / desktop; read by QA from the job logs)**

| Run | :331 | :431 |
|---|---|---|
| PR #599 run 44985919886, attempt 1 (5fe9fed6) | 22.6 / **FAIL 30.2** / 13.7 | 16.0 / **FAIL 30.2** / 16.0 |
| PR #599 run 44985919886, attempt 2 (re-run of shard 2 only, **outside the rules**, DL-290 A; evidence only) | - / 12.0 / - | - / 16.3 / - |
| `master` push 44985240147 (60ac0d18), base of the failed run (master's figures, DL-290 (1)) | 19.9 / 18.3 / 13.8 | 23.9 / 22.7 / 14.1 |
| `master` push 44988681963 (45512bd4), 0 flaky, 0 failed in all four shards | 11.8 / 18.6 / 22.4 | 13.6 / 23.9 / 23.8 |
| `master` push 44990887665 (08394110, #600 squash), attempt 1 (readings added 2026-11-22 from the Stage 12 logs; 0 flaky) | 20.5 / 15.7 / 24.5 | 26.4 / 15.4 / 23.7 |
| **PR #599 run of record 44990897082 (95d882cc), attempt 1, DL-290 (7) proof**: 0 flaky, 0 failed in all four shards | 20.6 / 13.8 / 17.1 | 17.3 / 18.8 / 18.8 |
| `master` push 44992801362 (6087e8b8, #599 squash), attempt 1; shard 2 `1 flaky` (`estimate-calculate.spec.ts:238` [tablet], not these cases) | 12.2 / 21.0 / 11.8 | 15.2 / **28.3** / 14.1 |
| `master` push 44995772811 (62ff83c4, #588 squash), attempt 1; shard 2 `1 flaky` (`estimate-form.spec.ts:74` [tablet], not these cases); `Stages 1 to 11b` red (not these cases) | 15.5 / 22.7 / 15.2 | 14.9 / 22.7 / 15.8 |
| Older, from test plan section 7: :331 [tablet] 30.4 / 31.8 inside #538's 1.62x wave (DL-265); :431 [tablet] 14 passing readings, one at 25.1 s (`master` push 44890683601), failures in #557's run (wave 1.53x) and #584's run (1.29x), see section 7 | | |

On a normal draw the two cases sit at 18 to 24 s on tablet and mobile and 22 to 24 s on desktop: one ordinary slow draw (DL-264 found 1.3x to 1.4x common) leaves them a few seconds of margin or none.

## Evidence
Run 44985919886 attempt 1 and attempt 2 Stage 12 shard 2 logs (jobs 137096326780 and 137102677096); `master` push runs 44985240147 and 44988681963; DL-290 (1), (2), (5) and DL-281 in `docs/00-governance/decision-log.md`; test plan section 7 (the :431 watch entry, DL-281 count) and section 7.1. Attempt 2 of shard 2 (job 137102677096, same merge ref): `527 passed (12.6m)`, :331 12.0 s, :431 16.3 s, so the cases pass when the shard is not slow.

## What decides it (not collected)
- **Test or runner (leading reading, and master's ruling A2):** a margin fault. Both cases do a lot in one test at tablet (the whole-page axe scan at three widths for :331; a save, a tree-icon check and a polite-status check for :431) and have no room for a draw above about 1.3x.
- **Product:** nothing in the evidence points to a product fault (no `expect` message, no value, no violation list). A trace of a failed attempt would decide it, but `trace: on-first-retry` keeps none, and a change to the trace setting is frozen tooling (CLAUDE.md section 9 item 4, DL-234). If a fix attempt shows a real fault, a change under `src/` means stop and go to master.

## Suspected Area
`tests/e2e/estimate-form-sections.spec.ts` :331 (AC-8 at 360, 768 and 1366 px) and :431 (the completion line, tree icon and polite status, STORY-05.11); the helper they share for the axe scan (`expectFormAccessible`, `tests/e2e/support/design-system.ts`).

## Binding for the fix (DL-290 (5); DL-229 (4)(b), DL-257 (B))
Test-only, in the hardening window behind the Sev-2 and Major items and ahead of the Minors. It **branches from a `master` that contains #600 (AQP-388, compact screens)**, which changes this spec's expectations and the form's layout. No budget, retry or timeout change, no skip, quarantine, `test.slow()` or fixed sleep; the axe scans and **every assertion are kept**. A spec-local warm-up as in DL-272 (B) is allowed. Proof as DL-257 (A): **P1** (the PR run of record) and **P2** (the first `master` push run after the merge): each case passes on its first attempt at all three widths and takes under 25 s; **P3** as stated there; 15 s reported, not gated.

## Re-run rule R11 (DL-290 (5); PR runs only, never a `master` push)
R8's clauses (a), (c) and (e) and the multi-rule sentence apply as written, with: **(b)** the failed test is exactly one of the two cases, in any project, identified by file and title; **(d)** every failed attempt is a page or locator wait or the axe scan cut by the 30 s budget, or "Test timeout of 30000ms exceeded." alone, with no received value and no violation list; **(f)** the diff touches none of: `tests/e2e/estimate-form-sections.spec.ts`; the `tests/e2e/support/` files it imports (`auth`, `design-system`, `part-form`, `servers`); `tests/support/customer-canary.ts`; `playwright.config.ts`; the E2E global setup or seed; `src/app/(portal)/estimates/**`; `src/components/features/estimate-workspace/**`; the estimate routes and services; or the `next`, `@playwright/test` or axe versions. **Never re-run:** an axe violation list; a 44 px or sideways-scroll assertion; a progress line, tree icon or status text that fails with a received value; an `expect` that ran out on its own timeout; a red re-run; or a second red on the same head. Each re-run is listed on the PR and in the daily update. #599's 30 files are outside (f).

**Binding by title.** #600 moved the second case from :431 to :432 (read on 44990897082, 44990887665, 44992801362, 44995772811; the spec line numbers differ by run, and #601 changes them again). The cases are bound by file and title, as DL-257 (B) says: ":331" is "AC-8: no sideways scroll, axe finds nothing (with a message showing and with values saved), every control is 44 px high and the strip links too", and ":431/:432" is "AC-4, AC-8: the save that completes a part changes its icon in the tree with no reload, and says "Part 1 is complete." once, politely". Both are in `estimate-form-sections.spec.ts`.

**Readings added 2026-11-22 (qa-engineer, DL-291 request 1; every reading is attempt 1 and green, no retry line for either case in any of the three runs).** The rows above are from the Stage 12 job logs of the PR run of record of #599 (44990897082, head 95d882cc; jobs 137111493431, 137111493378, 137111493387 for mobile, tablet, desktop; shard 3 holds neither case) and of the three `master` push runs after #600. Shard summaries, PR run 44990897082: shard 1 `537 passed (20.0m)`, shard 2 `530 passed (13.9m)`, shard 3 `532 passed (14.8m)`, shard 4 `516 passed (13.8m)`; **0 flaky and 0 failed, so no flaky line to name**. `master` 44992801362: `537 passed (13.4m)`, `1 flaky, 529 passed (21.2m)`, `532 passed (13.9m)`, `516 passed (11.1m)`. `master` 44995772811: `537 passed (15.5m)`, `1 flaky, 529 passed (20.0m)`, `532 passed (10.5m)`, `516 passed (12.6m)`.

What the readings show: neither case failed on any of the 24 readings added here (4 runs x 3 widths x 2 cases). The longest are **28.3 s on 6087e8b8 [tablet] (:432, 94 % of the 30 s budget, over the 25 s P2 line)**, 26.4 s on 08394110 [mobile] (:432) and 24.5 s on 08394110 [desktop] (:331). So the margin reading of DL-290 (A2) stands: a case that passes at 28 s on a normal draw is one slow draw from a cut. These readings are evidence on the unfixed cases, not the DEF-058 proof; **P1 and P2 are still open** until the fix PR exists.

**#605 (AQP-392, the DEF-058 fix PR, test-only, one file) run 44999981920, head 9f54429d, read 2026-11-22 (qa-engineer, DL-293 request 4).** Required checks green (`Stages 1 to 11` success). Stage 12 shard summaries: shard 1 `538 passed (15.3m)`, shard 2 `532 passed (21.3m)`, shard 3 `2 flaky, 532 passed (14.5m)`, shard 4 `517 passed (17.6m)`. **The flaky lines are not these cases:** `process-propagation.spec.ts:109` [tablet] and `rates-changed.spec.ts:224` [tablet] (the DEF-057 case), both on a PR run (not a `master` push, so not on RISK-031 trigger (b)), both with "Test timeout of 30000ms exceeded." in the log. The fix split the old :331 case into three cases at the same widths, by title: "AC-8: no sideways scroll, axe finds nothing (first paint), every control is 44 px high and the strip links too" (:341), "... (with a message showing)" (:350) and "... (with values saved)" (:359); the second case moved to :445. Seconds, attempt 1, mobile / tablet / desktop, all green, no retry line for any of them:

| Case (title, #605 head) | mobile | tablet | desktop |
|---|---|---|---|
| AC-8 first paint (:341) | 11.1 | 19.8 | 15.6 |
| AC-8 with a message showing (:350) | 10.0 | 21.4 | 13.8 |
| AC-8 with values saved (:359) | 11.0 | 20.0 | 13.5 |
| AC-4, AC-8 the save that completes a part (:445) | 12.7 | 16.4 | 16.0 |

Worst 21.4 s (tablet, "with a message showing"), under the 25 s P2 line, so **P1's attempt-1 and under-25 s clauses read met on this run of record** for #605's head; P1 is for master and QA to read on the run of record, and P2 (the first `master` push after the squash) is still to come. The first-load case by title read 12.0 / 14.8 / 14.5 s (mobile / tablet / desktop) on the same run. Shard 2 (tablet) ran 21.3 minutes, the longest of the four.

## Proof P2 and close-out (qa-engineer, 2026-11-22; DL-291 (3)(a), DL-294 (3), DL-295 request)
The fix is #605 (AQP-392, squashed as `d959e8f7`; test-only, one file). **P1** is the PR run of record 44999981920 (head 9f54429d): 12 of 12 readings passed on attempt 1, worst 21.4 s (master re-read it, DL-294 (3)(a)). **P2** is the first `master` push after the merge, CI run 45008501202 (`d959e8f7`), `Stages 1 to 11` success, `Stages 1 to 11b` success, Stage 12 shards `538 passed (13.5m)`, `532 passed (18.3m)`, `534 passed (11.1m)`, `517 passed (10.9m)`: **0 flaky, 0 failed**. Readings, seconds, attempt 1, all passed:

| Case (by title) | mobile | tablet | desktop |
|---|---|---|---|
| AC-8 first paint (:341) | 9.0 | 16.2 | 6.7 |
| AC-8 with a message showing (:350) | 10.3 | 15.0 | 7.4 |
| AC-8 with values saved (:359) | 9.6 | 13.2 | 8.2 |
| AC-4, AC-8 the save that completes a part (:445) | 10.9 | 15.9 | 10.0 |

The next `master` push, 45010599354 (`d119ae39`, #601), also has 0 flaky and 0 failed in all four shards: the same cases read 8.8 / 9.4 / 11.6, 8.3 / 10.8 / 10.5, 7.3 / 10.9 / 9.0 and 10.0 / 12.1 / 12.8 (mobile / tablet / desktop).

- **P1:** attempt-1 pass at all three widths, under 25 s: **met** (worst 21.4 s). **P2:** the same on the first `master` push: **met** (worst 16.2 s, tablet).
- **P3 (structural floor, DL-257 (A)):** each case opens the page once and runs at most one axe scan. QA read the spec on `origin/master`: the three AC-8 cases each call `openForm` once and end on `expectFitsAndAccessible` (one overflow check and one `expectFormAccessible`); the AC-4, AC-8 case opens the page with one `page.goto` and ends on one `expectFormAccessible`. **Met.**
- **15 s, reported not gated:** above 15 s: 6 of the 12 P1 readings (tablet 19.8, 21.4, 20.0, 16.4; desktop 15.6, 16.0) and 2 of the 12 P2 readings (tablet 16.2 and 15.9); none of the 12 on `d119ae39`.
- **R11 ends with this Bug** (DL-290 (5): in force until it closes). W1 and R10 stay.
- **Closed by QA 2026-11-22.** Jira AQP-392 Done; GitHub #602 closed.

## Proof still to come (DL-290 (7), reported on the PR, not a further condition)
On the run of record of #599's updated head (after #600 squashes and "Update branch"): the shard summaries with every flaky line named, and the :331 and :431 readings at the three widths. **Done 2026-11-22:** run of record 44990897082 (95d882cc) is read above (0 flaky, both cases attempt-1 green at all three widths, worst 20.6 s).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Logged | qa-engineer | 2026-11-22 | AQP-392, #602 |
| Fixed | developer | 2026-11-22 | #605 (`fix/AQP-392-form-sections-margin`), squashed as `d959e8f7`; test-only, `tests/e2e/estimate-form-sections.spec.ts` |
| Regression test added | developer | 2026-11-22 | the fix is the test change (the AC-8 case split into three one-scan cases; the AC-4, AC-8 case opens the page once); every assertion kept (master read P1, DL-294 (3)) |
| Verified | qa-engineer | 2026-11-22 | P1 (run 44999981920, worst 21.4 s), P2 (`master` push 45008501202, worst 16.2 s), P3 (one page open and at most one scan per case): all met |
