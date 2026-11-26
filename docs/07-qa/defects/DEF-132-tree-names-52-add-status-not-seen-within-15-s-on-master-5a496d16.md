# DEF-132: `estimate-tree-names.spec.ts:52` [desktop] fails attempt 1 because the add status "Added 1.1.1 Part. Type a Description to name it." is not seen within its 15 s expect (master 5a496d16); passes on retry (type not yet decided; product not excluded; Sev-3, provisional Sev-2 Product if the product can fail to show or announce it; Jira AQP-489, GitHub #802)

| Field | Value |
|-------|-------|
| Story / AC | AQP-446 / AQP-447 (DEF-089, DEF-090, PR #756: a row shows its name and kind; after an add, focus goes to the new row's link and the status reads 'Added <Sl. No> <kind>. Type a Description to name it.'; DL-410, DL-413, the ux ruling's add sequence). The case is `tests/e2e/estimate-tree-names.spec.ts:52`. **No AC is shown to fail:** the retry passed and no wrong value was received. If the status can fail to appear, the AC of DEF-090 (the status after an add) and WCAG 4.1.3 (Status Messages, Level AA; NFR-018) are at risk. |
| Severity | **Sev-3 Moderate (master, DL-439 (A)); provisional Sev-2 Product (DL-094: a WCAG 4.1.3 failure on a delivered screen) if step 1 shows the product can fail to show or announce the status.** |
| Priority | P3 (Jira Medium; labels `sev-3`, `final-review`) |
| Type | **Not yet decided; product not excluded** (master, DL-439 (A)): a missing status could be the product not writing, or not announcing, its 'Added ...' message in some sequence, or a test-side race. Not DEF-129 (a different mechanism and failing line; #796's hover helper does not reach it). |
| Status | **Open (new), 2026-11-27.** Owner: **lane 1** (#756's author), after #799, beside the DEF-053 split (lane 2 is dedicated to DEF-131's edit). **Step 1 due by the end of Sat 28 Nov 2026 (below).** |
| Jira / GitHub | [AQP-489](https://sankumar76.atlassian.net/browse/AQP-489) / [#802](https://github.com/sankumar76/Accucut-Quotation/issues/802) (labels bug, sev-3, ai-delivery, final-review; Jira also aiid-DEF-132, agent-qa-engineer). Relates to AQP-446, AQP-447 (#756), DEF-129 (AQP-486), DEF-090 (AQP-447), AQP-1. Searched first: JQL on `aiid-DEF-132`, 'DEF-132' and the status text: nothing (DEF-129 is the only hit and is a different signature). |
| Found by / date | CI (a `master` push); read by qa-engineer, 2026-11-27 (test plan 0.3.89); graded by master, DL-439 |
| Build / commit | `master` `5a496d16` (#795, DEF-103: the task queue tab order; the change cannot reach the estimate tree) |
| Environment | GitHub-hosted runner, `Stage 12: E2E (shard 4 of 4)`, Playwright Chromium, project `desktop`, production build, 4 workers. CI run 45842343024 (`push`, created 14:46:18Z), shard 4 (no. 96 attempt 1, 14:52:42Z; no. 100 the retry, 14:53:07Z). |

## Steps to Reproduce
Not on demand; no local run (CLAUDE.md section 9 (5)).
1. Run Stage 12 on `master` or a PR; read shard 4, `[desktop]`, `estimate-tree-names.spec.ts:52`.
2. Look for attempt 1 failing at spec :85 with `expect(getByText('Added 1.1.1 Part. Type a Description to name it.')).toHaveCount(1)`, Received 0.

## Expected Result
After 'Add under 1.1' and the 'Part' menu item are pressed, the polite status 'Added 1.1.1 Part. Type a Description to name it.' is present once, and the new row is focused (:86) and named 'Part, no description yet' (:87); the case reads 14 to 22 s.

## Actual Result
| # | Run | Attempt 1 | Retry |
|---|-----|-----------|-------|
| 1 | `master` push 45842343024 (5a496d16), shard 4, test no. 96 | **failed at 27.4 s** (14:52:42Z): `Error: expect(locator).toHaveCount(expected) failed`, Locator `getByText('Added 1.1.1 Part. Type a Description to name it.')`, Expected 1, **Received 0**, Timeout 15000 ms, 33 polls 'locator resolved to 0 elements'; reached from spec :85 (the add was pressed at :83 and :84) | passed, 22.3 s (no. 100, 14:53:07Z) |

## Evidence (job log, ANSI stripped; no secrets or personal data)
- **Not DEF-129's signature:** 0 'intercepts pointer events' lines in the whole CI log; no `locator.click` or `locator.hover` time-out; the click at :83 and :84 did not fail.
- **The failure is a 15 s `expect` of its own, not the 30 s test budget:** the case ended at 27.4 s because it had used about 12 s before :85 and then waited 15 s.
- **No trace for attempt 1** (`trace: 'on-first-retry'`): the log does not say whether the row was added late, not added, or announced with other words.
- **Not a ruled wave:** shard 4 draw **0.83** against 31015cce (343 tests; quartiles 0.74 to 0.94), 1.22 against `40feaa53`. 0 DEF-085 misses and 0 DEF-088 teardown lines on the push.
- **The case's other readings:** `:52` [desktop] 19.4 s on `744a8fa5` (passed), 22.3 s on the retry here, [tablet] 14.4 s and [mobile] 21.9 s on `744a8fa5`; on `3ece5e47` it failed attempt 1 at 30.5 s on a pointer interception (DEF-129).

## Leads (not findings; step 1 is lane 1's)
`src/lib/estimates/row-name.ts` `addedAnnouncement(before, after, addedId)` builds the text (it returns an **empty string when the added node is not in `after`**, appends ' 1.2 is now a Sub-part.' when the add made an earlier Part a Sub-part, and takes the kind word from the tree); `src/components/features/estimate-workspace/use-parts-tree.ts` (about line 233) calls `setAnnouncement(addedAnnouncement(before, answer.nodes, answer.nodeId ?? ''))` after the server's answer. Questions: when exactly is the status written (after the answer, after the tree re-read), into which live region, and can an existing message in that region make the same text not re-announce or not appear; is there a path where the answer carries no `nodeId`, or the added node is not in `answer.nodes`, so the status is silently empty.

## Binding and proof (master, DL-439 (A); QA reads it)
1. **Step 1, written on this Bug by the end of Sat 28 Nov 2026 (lane 1):** a read of #756's code for when the add status is written (after the server's answer, after the tree re-read, into which live region, and whether an existing message there can make the same text not re-announce or not appear), and a **spec-local diagnostic printed on every attempt**: the status region's text, with times for the add's request, its answer and the region update. **No change to the assertion, to `tests/e2e/support/**`, to the Playwright config or to `ci.yml`, and no new wait or budget.**
2. **If step 1 shows the product can fail to show or announce the status:** **provisional Sev-2, type Product**, the same day, and it comes to master; the fix gets the combined review only if it touches a data path; QA's checks: the status is present once after each add at three widths, a screen reader reads it (the manual pass at the final regression), axe clean, and no existing message blocks it.
3. **If it shows a test-side race:** a test-only fix, every assertion kept, no timeout raised, no retry or skip; **proof: the case attempt 1 under 25 s at three widths on the fix PR's run of record and the first two `master` pushes after the squash**, read by QA from the job logs.
4. **Until then:** a third attempt-1 failure of `:52` on any `master` push is read under this Bug (and DEF-129 for the interception signature); it counts against RISK-031's close-out (below).

## RISK-031 (master's DL-439 (B), recorded by QA)
**5a496d16 is not clean and the close-out count is 0.** A flaky test that passed on retry, failing attempt 1 on a wait time-out (a 15 s `expect`), breaks the count even when the run is green; master counted such failures the same way on `3ece5e47` and `744a8fa5` (DL-425 (2)). **`a6eb9809` no longer counts as candidate 1; the next clean `master` push is candidate 1.**

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-27 | DL-439 (A): Sev-3, type undecided, product not excluded, lane 1 |
| Step 1: the code read and the spec-local diagnostic | developer (lane 1) | | due the end of Sat 28 Nov 2026 |
| Cause found and type decided | developer (lane 1), master | | |
| Fixed | developer (lane 1) | | |
| Regression test | developer (lane 1) | | |
| Verified (PR run; two pushes; at three widths) | qa-engineer | | |

## Records
Jira Bug AQP-489 and GitHub issue #802, created 2026-11-27 and cross-linked. Related: DEF-129 (AQP-486, #793), DEF-090 and DEF-089 (#756), RISK-031, WCAG 4.1.3, NFR-018; DL-439, DL-426, DL-425, DL-364 (A3), DL-094; test plan 0.3.89 and 0.3.90; CI run 45842343024, shard 4.
