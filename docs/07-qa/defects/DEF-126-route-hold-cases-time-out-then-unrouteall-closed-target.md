# DEF-126: route-hold E2E cases time out and then fail in `finally` with `page.unrouteAll: Target page, context or browser has been closed` (`estimate-tree-width.spec.ts:497` [desktop], second occurrence, on a `master` push; family of `estimate-picture.spec.ts:409`) (Test; product not excluded; Sev-3; Jira AQP-483, GitHub #779; CLOSED as a duplicate of DEF-088)

| Field | Value |
|-------|-------|
| Story / AC | AQP-426 (STORY-CR01.3E, the resizable parts tree) and its DEF-085 follow-up (AQP-441, DL-391): the case is 'DEF-085, DL-391: the form comes first and the controls appear in place: before the handle and the menu have loaded (their code held) ...'. No AC fails by itself: the case passes on retry in 13.6 and 14.6 s. |
| Severity | **Sev-3 Moderate, proposed by QA** (a test-only fix; it can turn a required shard red; master grades). QA's own watch entry of 26 Nov (test plan 0.3.69, section 7) set this as the result of a second attempt-1 time-out on a `master` push. |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`) |
| Type | **Test; product not excluded.** The case hangs to its 30 s budget with no `expect` message and no call line, so the step that hangs is not known from the log; the `unrouteAll` error is the consequence (the page was closed by the time-out). The spec holds `/_next/static/chunks/` requests on purpose; whether the product or the hold causes the hang is the developer's first question. |
| Status | **CLOSED 2026-11-26 as a duplicate of DEF-088 (AQP-444, #732)** (master, DL-419 (3)). DEF-088 is REOPENED by its written condition (a tree-width case at 25 s or more on attempt 1 on a later `master` push) and takes this occurrence. The Jira Bug is Done and linked 'Duplicate'; the GitHub issue is closed as not planned. The occurrences and the evidence below stay as the record. |
| Jira / GitHub | [AQP-483](https://sankumar76.atlassian.net/browse/AQP-483) / [#779](https://github.com/sankumar76/Accucut-Quotation/issues/779) (labels bug, sev-3, ai-delivery, final-review; Jira also aiid-DEF-126, agent-qa-engineer). Relates to AQP-441 (DEF-085), AQP-444 (DEF-088), AQP-426 and AQP-1. Searched first: JQL on `aiid-DEF-126`, 'unrouteAll' and 'estimate-tree-width' and a GitHub search found only DEF-088. |
| Found by / date | CI; read and logged by qa-engineer, 2026-11-26 |
| Build / commit | `master` `6085f71e` (#742's squash, DEF-092 / AQP-449). #742 changes `add-node-menu-panel.tsx`, `add-node-menu.tsx`, `row-actions.tsx`, `tree-panel.tsx`, `node-kinds.ts`, a unit test, a new E2E spec and two lines of `estimate-tree.spec.ts`. |
| Environment | GitHub-hosted runner, `Stage 12: E2E (shard 4 of 4)`, Playwright Chromium, project `desktop`, production build, 4 workers. |

## Steps to Reproduce
Not on demand; no local run (CLAUDE.md section 9 (5): heavy browser tests run in CI).
1. Run Stage 12 on `master` or a PR; read shard 4, `[desktop]`, `estimate-tree-width.spec.ts:497`.
2. Look for attempt 1 ending `Test timeout of 30000ms exceeded.` followed by `page.unrouteAll: Target page, context or browser has been closed` at `tests/e2e/support/tree-width.ts:112` (called from the spec's `finally`, `:525`).

## Expected Result
The case finishes in about 10 to 15 s (9.7 s on `e3dc5b0b`, 10.1 s on the DEF-088 run, 14.6 s and 13.6 s on the two retries), with no time-out and no error in `finally`.

## Actual Result
| # | Run | Attempt 1 | Retry |
|---|-----|-----------|-------|
| 1 | PR #742 run 45775084307 (head 3f333b43, `pull_request`), shard 4 job 139756691257, 07:32:56Z, test no. 129 | **failed at the 30 s test time-out**, then `page.unrouteAll: Target page, context or browser has been closed` at `tree-width.ts:112`; draw 0.81 | passed 13.6 s |
| 2 | **`master` push 45778919991** (6085f71e), shard 4 job 139769309956, 08:05:35Z, test no. 131 | **failed at 30.0 s**, `Test timeout of 30000ms exceeded.`, then the same `unrouteAll` error at `tree-width.ts:112` (`stop`, called from `estimate-tree-width.spec.ts:525`); draw 1.03 against 31015cce, 1.50 against e3dc5b0b | passed 14.6 s (no. 186, 08:08:17Z) |

On the same `master` push, in minutes 8 to 10.5 of the shard, two other `[desktop]` cases failed attempt 1 at the budget and passed on retry: `export-refusal.spec.ts:93` (30.2 s, retry 29.5 s) and `formula-editor.spec.ts:62` (30.2 s, retry 16.7 s); and `users.spec.ts:58` failed both attempts (DEF-053 row 17). Those are not route-hold cases; see the test plan 0.3.69.

## Evidence (job log, ANSI stripped; no secrets or personal data)
- The error text and file lines are in the table. No 'Request context disposed' line and no 'error was not a part of any test' line on either run, so it is **not DEF-088's signature**.
- The case is the DEF-085 'controls appear in place' case: `holdControlsCode(page, 'hold')`, `store`, `page.reload()`, `waitForForm(page)`, then the assertions, then `finally { await controls.stop() }`. The log gives only the time-out, so the hanging step is not known (a hypothesis for the developer, not a finding: a step that waits for the page `load` event while a lazy chunk is held, which a slow draw can turn into a hang).
- The same family: `estimate-picture.spec.ts:409` on `6bf10f7d` (attempt 1 failed at its 60 s timeout with the same `unrouteAll` error in its `finally`, test plan 0.3.63).
- QA draw on the failing run: 1.03 (506 tests, quartiles 0.92 to 1.19) against 31015cce's shard 4; 1.50 (544 tests, quartiles 1.32 to 1.74) against the W1 (d) reference e3dc5b0b (DL-328 (4)), with 2.29 in minutes 8 to 10, the window of this failure; shard 3 of the same run 1.46, shards 1 and 2 1.17 and 1.00. The case's own references: 9.7 s on e3dc5b0b.

## Suspected Area (leads, not findings; the fix is the developer's)
`tests/e2e/estimate-tree-width.spec.ts` (:497 case) and `tests/e2e/support/tree-width.ts` (`holdControlsCode`, `stop`); `estimate-picture.spec.ts:409` for the sibling. Whether the hang is in the case (a wait that can outlast the budget when chunks are held) or in the product (the controls chunk is requested in a way that can block `load`) is the first question. A `finally` that cannot run after a time-out is expected; the cause is the time-out, not the `unrouteAll` error.

## Binding and proof (proposed; master sets it)
1. Fix test-only unless the cause is in the product; keep every assertion; no retry added, no timeout raised, no quarantine.
2. Proof: on the fix PR's run and the first two `master` pushes after it, no `estimate-tree-width` or `estimate-picture` case at 25 s or more on attempt 1 and no `unrouteAll: Target page ... closed` line in any shard. QA reads each from the job logs.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Cause found | developer | | |
| Fixed | developer | | |
| Regression test | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-483 and GitHub issue #779, created 2026-11-26 and cross-linked. Related: DEF-088, DEF-085, DEF-053 (row 17, same run), DEF-092 (#742), RISK-031; DL-399, DL-391; test plan 0.3.69.
