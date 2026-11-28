# DEF-150: on #811's island, the first save on a Prepared estimate asks for a `router.refresh()` that can land late and re-render the tree while the Lead opens the '+' or move menu (menu item detached in CI; unproven for a person) (Sev-3 provisional; type not determined; Jira AQP-507, GitHub #846)

| Field | Value |
|-------|-------|
| Story / AC | #811 (AQP-488), the Lead's editable tree (the '+' menu and the move menu); STORY-05.08 is not involved |
| Severity | **Sev-3 Moderate, provisional** (test-plan scale: a state that does not mislead about a price; the menu closes under the person's hand, no data is lost, every action is reachable again by opening the menu again) |
| Priority | P3 |
| Type | **Not determined**: Product if a person can hit the late refresh; Test if only the test's timing races it |
| Status | **Open, 2026-11-28.** Master has not ruled; owner proposed by the orchestrator: lane 2, after #811 and DEF-149, unless master rules otherwise |
| Jira / GitHub | [AQP-507](https://sankumar76.atlassian.net/browse/AQP-507) / #846 (labels bug, sev-3, ai-delivery; Jira also aiid-DEF-150, agent-qa-engineer, product-not-ruled-out). Searched first: JQL on `aiid-DEF-150`, 'router.refresh' and 'detached': nothing |
| Found by / date | lane 2, 2026-11-28, while fixing #811 (relayed by the orchestrator); logged by qa-engineer; **QA has not read the CI logs and has run nothing** |
| Build / commit | **#811's branch `fix/AQP-488-lead-edit-tree`**; CI runs on `a5769a12` and on `d71e62fa`. **The editable island is not on `master`** |
| Environment | CI (`next dev`); lane 2 could not reproduce it locally |

## What happens (lane 2's report)
On the Lead's review page with #811's island, the first save on a Prepared estimate asks for a `router.refresh()`. In CI it can land late and re-render the tree while the Lead is opening the '+' menu or the move menu, so the menu item detaches or closes.

## Evidence (relayed; not read by QA)
`tests/e2e/estimate-review-row-return.spec.ts:129` and `:156` on the CI runs of `a5769a12` and `d71e62fa`: 'element was detached from the DOM' at the menu click. Lane 2 could not reproduce it locally, and CI keeps no trace (no artefacts are uploaded), so **it is unproven whether a person sees it, or whether it is only the test racing the refresh.**

## Proof of fix (QA's proposal; not yet authorised)
The refresh does not re-render the tree under an open menu (held while a menu is open, or the menu survives the re-render). The two cases pass attempt 1 at 360, 768 and 1366 px on #811's run of record, with no wait, budget or time-out change (DL-404). QA reads #811's run of record for them. If a trace shows the test alone races the refresh, the type becomes Test and the fix is in the test's wait on the answer of the refresh (not a sleep).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Master's ruling (grade, type, owner) | master | | |
| Fix | developer (lane 2) | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-507 and GitHub issue #846, created 2026-11-28 and cross-linked; related AQP-488, #811, AQP-506 (DEF-149), AQP-1; test plan 0.3.165.