# DEF-079: Standalone links under 44 px on touch layouts: the task-code link of the queue (139 x 18 px on the phone card, the only way to open a task on a phone) and "View cost details" on SCR-06 (94 x 16 px) (type Product (layout); found in the final review, `final-review`)

| Field | Value |
|-------|-------|
| Story / AC | NFR-017 (touch targets at least 44 px), as ruled by the product-manager on 2026-11-24 (PRD 0.49; AQP-420 comment 13040, AQP-1 comment 13041): on touch layouts (below 1024 px or a coarse pointer) a standalone link that is the way to open a task or a view is a control and is at least 44 px high, by padding or minimum height, with the visible text size unchanged; a link inside a sentence is exempt; the folder path is exempt when its Copy path button is 44 px. Related: STORY-04.02 (the queue, SCR-03), the cost-review screen SCR-06 (the cost tree), CR-01 item 1 (compact layout, NFR-031) |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-24; test plan section 6, same grade as the product-manager's suggestion): a layout defect at touch widths that leaves every action reachable (both links open what they should; the phone card link is small but works). WCAG 2.5.8 (AA) is not shown failed: axe `target-size` finds nothing (the 24 px rule passes by its spacing exception), so section 6's Sev-2 form "WCAG AA violation" is not met. **Re-grade to Sev-2** if a measurement shows one of the two links under 24 px high without the spacing exception, or a tap on the task-code link on a phone lands on the neighbouring row |
| Priority | P3 (Jira Medium, label `sev-3`); fixed before G8 or accepted in writing by master (section 6) |
| Type | **Product (layout)** |
| Status | **Closed** (qa-engineer, 2026-11-24: fixed by #698, squash 402c00bf; verified on the first `master` push after the squash, CI 45391629607, and on #698's run of record 45387913685; Jira AQP-422 Done, GitHub #672 closed as completed). Opened 2026-11-24. |
| Jira / GitHub | [AQP-422](https://sankumar76.atlassian.net/browse/AQP-422) / [#672](https://github.com/sankumar76/Accucut-Quotation/issues/672). Labels `ai-delivery`, `aiid-DEF-079`, `bug`, `sev-3`, `final-review`, `agent-qa-engineer`. Relates to AQP-1 (Intake), AQP-420 (DEF-077) and AQP-421 (DEF-078) as the same final-review pass |
| Found by / date | qa-engineer (fresh QA session, final-review pass, `docs/07-qa/final-review-cr01.md` sections 5.2 and 7 (3)), 2026-11-24; ruled a defect by the product-manager's NFR-017 ruling the same day; logged by qa-engineer 2026-11-24 |
| Build / commit | `master` `1fe1581b` (H) for the measurement; code read at `a7ff0a73` (records-u) |
| Environment | Chromium, 360 x 800, 768 x 1024 and 1366 x 768, `next dev`, throwaway PostgreSQL, invented data (the fresh QA session's run; no real phone) |

## Steps to Reproduce
1. As a Lead, open the queue (SCR-03) at 360 x 800 (the phone card list; `md:hidden`, `queue-list.tsx:174`). Read the bounding box of a task's code link (`<Link href={taskHref(task.code)}>`, `queue-list.tsx:65`, in `TaskCell`, used by the card at :183 and by the table at :134).
2. As a Lead, open an estimate's cost review (SCR-06) at any width. Read the bounding box of the "View cost details for <row>" link of any row (`review-tree.tsx:61`; the visible text is "View cost details", the rest is `sr-only`).
3. Compare with NFR-017: on a touch layout (below 1024 px or a coarse pointer) a standalone link is at least 44 px high.

## Expected Result
Both links are at least 44 px high on touch layouts (below 1024 px or a coarse pointer), by padding or minimum height, with the visible text size unchanged (NFR-017 as ruled 2026-11-24).

## Actual Result
| Link | Where | Measured (final-review pass, `final-review-cr01.md` 4.x "Target size") | Needed |
|---|---|---|---|
| The task code of a task on the **phone card** (also on the Closed tab) | `queue-list.tsx:65` | **139 x 18 px** (it is the only way to open a task on a phone) | 44 px high |
| **"View cost details"** on SCR-06 | `review-tree.tsx:61` | **94 x 16 px**, at all widths | 44 px high on touch layouts |

Also affected by the same markup and so by the same fix, not separately measured: the task-code link in the queue **table** from 768 px, where a tablet (768 to 1023 px, or any coarse pointer) is a touch layout.

**Copy path button (checked on the request of the orchestrator; the folder path exemption depends on it).** `FolderPath` (`src/components/shared/folder-path.tsx`) renders the button as `<Button variant="secondary">` with the default size, which is `h-(--control-h)` and `--control-h` is `44px` (`globals.css:42`). No class on the button, and no media rule of the compact layout (which changes fields only, `--compact-field-h`), lowers it at any width. So **the Copy path button is 44 px high on touch layouts: confirmed by the code (not browser-measured by QA now), and the folder path link (361 x 22 px, measured by the fresh pass) is therefore exempt under the ruling.** Nothing is added to this Bug for it. The final regression reads its bounding box at 360 and 768 px with the automated check below.

## Evidence
`docs/07-qa/final-review-cr01.md` section 4 (target size row) and 5.2 / 7 (3); PRD 0.49 NFR-017; AQP-420 comment 13037 and 13040. Axe `target-size` finds nothing on these screens; the measurement is a bounding-box read, not an axe finding.

## Suspected Area
`src/components/features/queues/queue-list.tsx:65` (task-code `Link` in `TaskCell`), `src/components/features/estimate-review/review-tree.tsx:61` (`<a>` with `COST_DETAILS_LINK`). A fix by padding or `min-h` on a touch layout (below 1024 px or `@media (pointer: coarse)`), with the text size unchanged and no change to the fine-pointer desktop layout; the table row and the card layout must not grow in an unplanned way. Product code under `src/`: a fix gets the usual review; it is not one of the section 9 item 2 areas.

## Fix route and proof (QA's recommendation; master routes)
- Fix both links (and any other standalone link the check finds) in one small PR from `master`, test-first.
- **Proof:** an automated bounding-box check in E2E at 360 and 768 px (and a coarse pointer at 1024 px or more if a project exists): every standalone link of the two screens is at least 44 px high, a link inside a sentence is skipped, the folder path link is skipped when its Copy path button is 44 px; attempt-1 pass at the three widths on the fix PR's run of record and on the first `master` push after the squash; the first-load budget headroom is stated (first load under 200,000 B).
- QA reads the two screens at 360, 768 and 1366 px by hand in the final regression (no sideways scroll, rows not made unreadable by the taller links).

## Fix & Verification  _(developer / qa-engineer)_
- Fix PR: [#698](https://github.com/sankumar76/Accucut-Quotation/pull/698) "make the task code, "Read all remarks" and "View cost details" 44 px controls on touch layouts [AQP-422]", squash **402c00bf** on `master` (changes `review-tree.tsx`, `queue-list.tsx`, new `src/components/shared/touch-link.ts`, `estimate-review.spec.ts`, `queue-actions-visible.spec.ts`, new `tests/e2e/support/touch-link.ts`, new `tests/unit/touch-link.test.ts`).
- Verified by: qa-engineer, 2026-11-24, in the job logs (`gh api --allow-escape-sequences .../actions/jobs/<id>/logs`), attempt 1, nothing re-run.

| Proof asked above | Result | Evidence |
|---|---|---|
| Bounding-box check in E2E at 360 and 768 px: every standalone link of the two screens at least 44 px high | **Pass** | Touch-width cases passed in every project on the push: `estimate-review.spec.ts:227` ("View cost details", at the width of the project) [mobile] no. 310 (shard 1), [tablet] no. 452 (shard 2), [desktop] no. 71 (shard 4); `queue-actions-visible.spec.ts:305` (task code and "Read all remarks", Ignored tab) [mobile] no. 539 (shard 1), [tablet] no. 104 (shard 3), [desktop] no. 372 (shard 4). `tests/unit/touch-link.test.ts` (5 tests) passed in `Stages 1 to 11b` (499 files, 11,169 tests) |
| A coarse pointer at 1024 px or more (the desktop project) | **Pass** | `estimate-review.spec.ts:238` [desktop] no. 72 and `queue-actions-visible.spec.ts:317` [desktop] no. 373 passed (shard 4); both are skipped by design on [mobile] and [tablet] (the spec reads them once, in the desktop project; skip reasons in the spec) |
| Attempt-1 pass at the three widths on the fix PR's run of record | **Pass** | #698 run 45387913685 (39abf7d6): every job `success`; the same cases (nos. 310, 452, 71, 72, 539, 104, 372, 373) passed in shards 1 to 4 |
| Attempt-1 pass at the three widths on the first `master` push after the squash | **Pass** (the run itself is red for another reason) | CI **45391629607** (402c00bf): the cases above passed at attempt 1 (shard 1 job 138436572608, shard 2 job 138436572450, shard 3 job 138436573047, shard 4 job 138436572690). The run is red only because shard 4's `users.spec.ts:58` [desktop] failed both attempts (32.2 s, 32.0 s): DEF-053, ruled so by master (DL-367 (A)), not a #698 regression. No DEF-079 test failed; `Stages 1 to 11b` and shards 1 to 3 are `success` |
| First-load budget headroom stated (under 200,000 B) | **Not read by QA** | The JS-budget checks run in `Stages 1 to 11b` (`js-budget*.test.ts` and the production-route check passed, the job is `success`); QA did not read a first-load figure from the log and states none |
| QA reads the two screens at 360, 768 and 1366 px by hand (no sideways scroll, rows not made unreadable) | **Not done here; stays in the final regression** | The automated cases check no sideways scroll and axe at the project widths; the hand read is the final regression's item |

The Copy path button exemption (section "Actual Result") is not changed by this closure.

| Step | By | Date | Ref |
|------|----|------|-----|
| Fixed | developer | 2026-11-24 | #698, squash 402c00bf |
| Regression test added | developer | 2026-11-24 | the E2E cases and `tests/unit/touch-link.test.ts` above |
| Verified | qa-engineer | 2026-11-24 | CI 45391629607 and 45387913685 (above) |
| Closed | qa-engineer | 2026-11-24 | Jira AQP-422 Done (comment 13124); GitHub #672 closed (completed) |
