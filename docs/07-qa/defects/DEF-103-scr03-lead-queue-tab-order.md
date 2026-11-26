# DEF-103: SCR-03 Lead task queue tab order is Open, Closed, Overdue, Ignored; the design is Open, Overdue, Closed, Ignored (conformance; Product; Sev-2; Jira AQP-460, GitHub #753)

| Field | Value |
|-------|-------|
| Story / AC | AQP-298 (STORY-04.02); SCR-03 Task queue (Lead); the ux-expert's batch 1, item L. The mock-up and spec text quoted below. |
| Severity | **Sev-2, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Major); the AC check and master's grade move it to Sev-2. |
| Priority | P2 (Jira High) (labels `sev-2`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **VERIFIED and CLOSED 2026-11-27 (qa-engineer, on the ux-expert's hands-on re-check pass 1 and the CI of `master` `c30b349f`): Closed now (Sev-2 cleared).** (the tracker issues were already closed by the PR's merge; QA's verification is recorded here and on both.) **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-2; lane 2.** Open. |
| Jira / GitHub | [AQP-460](https://sankumar76.atlassian.net/browse/AQP-460) / [#753](https://github.com/sankumar76/Accucut-Quotation/issues/753) (labels bug, sev-2, ai-delivery, final-review, conformance; Jira also aiid-DEF-103, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
Tabs: Open, Overdue, Closed, Ignored.

## Build (what the ux-expert saw)
Open, Closed, Overdue, Ignored.

## Ruling check
No ruling found; master to confirm.

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** **Raised from Sev-3 to Sev-2 by master (DL-414 (2)):** FR-034 sets the order "Open, Overdue, Closed and Ignored", its fit test is "Tab membership and order correct", and DL-299 (2) states the same order, so "no ruling" in the filing is corrected. **Note for the product-owner and the ux-expert:** the story text of AQP-298 AC-1 ("Open, Closed ... Overdue") and the ux-spec SCR-03 content line ("Tabs Open, Closed, Overdue with counts") still list the old order, which the build follows; they need amending with the fix. The fix is trivial. Lane 2 with DEF-104 (one PR).

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-2, lane 2 |
| Fixed | developer | 2026-11-27 | PR #795, squash `5a496d16` (`QUEUE_TABS` is `open, overdue, closed, ignored` in `src/lib/tasks/queue.ts`; `queue-screen.tsx`) |
| Regression test added | developer | 2026-11-27 | `task-queue.spec.ts`, `ignore-restore.spec.ts`, `task-queue-contract`, `task-queue-screen`, `ignored-tab` and `ignored-tab-screen` tests updated in #795 |
| CI proof read by QA (the push `5a496d16`, CI 45842343024, Windows package 45842343047, both `success`) | qa-engineer | 2026-11-27 | `task-queue.spec.ts` 9 cases, `task-queue-filters.spec.ts` 6 and `ignore-restore.spec.ts` 16 passed at each of the three widths on attempt 1; the four unit files passed; the push's one flaky (`estimate-tree-names.spec.ts:52`) is unrelated; test plan 0.3.89 |
| Hands-on check repeated | ux-expert | 2026-11-27 | pass 1 on `c30b349f` (`hands-on-recheck-1-2026-11-27.md`) |
| Verified | qa-engineer | 2026-11-27 | the ux-expert's pass 1 on `c30b349f` and its CI; closed |

## Verified and closed (qa-engineer, 2026-11-27; test plan 0.3.97)
**Evidence:** the ux-expert's hands-on re-check pass 1 (`docs/03-ux/rulings/hands-on-recheck-1-2026-11-27.md`, records-u 9e4d6272): scripted Playwright (Chromium, not the Playwright MCP) at 360, 768 and 1366 px against a throwaway PostgreSQL 17 database and invented estimates, on a production build of `master` `c30b349f`. Conforms at 360, 768 and 1366: the tabs read 'Open', 'Overdue', 'Closed', 'Ignored', in that order, with counts.
**CI, read by QA on the same push** (`c30b349f`, CI 45854831021 and Windows package 45854831146, both `success`): 0 failed, 1 flaky (`estimate-warning.spec.ts:117` [tablet], unrelated, test plan 0.3.95); the E2E and unit cases of the fix are in the suite and passed; no DEF-085 miss and no interception line.
**This clears one of the G8 blockers (a Sev-2 conformance item).** CI proof (the push `5a496d16`): `task-queue.spec.ts`, `task-queue-filters.spec.ts` and `ignore-restore.spec.ts` passed at three widths (test plan 0.3.89).
**Not covered by this closure (all defects of this pass):** the Indian digit grouping of the figures (the conformance report's open check), drag reorder, the unsaved-changes dialog, Picture too large, and an accessibility scan were not part of the pass; the final regression's keyboard, screen-reader and axe checks remain.

## Records
Jira Bug AQP-460 and GitHub issue #753, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
