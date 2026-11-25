# DEF-078: An Engineer's page for an Ignored task still shows the green banner of the status underneath: "Prepared ... sent for review/approval" or "Approved and locked ... the task has moved to Closed" (type Product; found in the final review, `final-review`)

| Field | Value |
|-------|-------|
| Story / AC | STORY-CR01.7D (AQP-401) AC-8 (the Engineer's notice on SCR-05) and the ux-expert's design of record, AQP-401 comment 12944 section 4: "Header badge: dashed Ignored. **The notice does not name the status underneath (the Engineer does not need it)**", "no action bar"; FR-102, FR-109 (A-CR01-2, A-CR01-8) |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-24; test plan section 6: wrong wording or state that does not mislead about a price; here it misleads about where the task is, not about a price; no cost, rate or formula is shown, NFR-002 holds) |
| Priority | P3 (Jira Medium, label `sev-3`); fixed before G8 or accepted in writing by master (section 6) |
| Type | **Product** |
| Status | **Closed** (2026-11-24; fixed by #669, `master` 9697d6a5; verified by qa-engineer) |
| Jira / GitHub | [AQP-421](https://sankumar76.atlassian.net/browse/AQP-421) / [#671](https://github.com/sankumar76/Accucut-Quotation/issues/671) (labels bug, sev-3, ai-delivery, final-review; Jira also aiid-DEF-078, agent-qa-engineer). Relates to AQP-401, AQP-1 |
| Found by / date | qa-engineer, 2026-11-24 (by-hand look at the Engineer's read-only view, `tests/e2e-qa/ro.qa.ts`, `ro2.qa.ts`; screenshot `qa-out/engineer-ignored-prepared.png`) |
| Build / commit | `master` `1fe1581b` (H) |
| Environment | Chromium 1366 x 768, `next dev`, throwaway Postgres; invented data |

## Steps to Reproduce
1. Engineer's estimate calculated (Prepared), or calculated and approved by a Lead (Approved).
2. A Lead or Admin presses Ignore RFQ with remarks (the status layer is set; the underlying status stays).
3. Sign in as the Engineer and open `/estimates/<code>` (the own Ignored task).

## Expected Result
The ignored notice (who, when, remarks, "You can read everything here, but nothing can be changed...") and the dashed Ignored badge only. No banner that names or describes the status underneath (12944 section 4).

## Actual Result
Below the notice, between the task folder card and "Parts and inputs", the page still draws the success banner of the underlying status:
- was Prepared: green banner **"Prepared. Cost will be calculated based on the input fields and sent for review/approval."**
- was Approved: green banner **"Approved and locked. This estimate is closed and the task has moved to Closed. Inputs cannot be changed."** The task is in the Ignored tab, not Closed, so the sentence is false.
- was Draft: no banner (correct).
The part form also says "This estimate can no longer be changed." (true, and acceptable).

## Evidence
`ro2.qa.ts` output, desktop: `ENGINEER view of Ignored (was PREPARED): banners [ ... "PreparedCost will be calculated based on the input fields and sent for review/approval." ...]` and `(was APPROVED): ["Approved and locked.This estimate is closed and the task has moved to Closed. Inputs cannot be changed."]`. Screenshot in the final-qa worktree: `qa-out/engineer-ignored-prepared.png`. The calculate or lock banner is drawn from the estimate's status, which the ignore layer does not change (ADR-019), so the Engineer's banner has to be told "ignored" (7D built the notice and the read-only inputs, not this banner). Suspected area: `src/components/features/estimate-workspace/calculate-summary.tsx` / `estimate-workspace.tsx` (the status banner), `calculate-bar.tsx`.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Fixed (no status banner while ignored; regression case: Engineer view of an Ignored task that was Prepared and Approved has only the ignored notice) | developer | 2026-11-24 | PR #669, squash `9697d6a5` (`estimate-workspace.tsx`: the Prepared banner and the locked notice are drawn only when not frozen; regression `tests/unit/estimate-workspace-locked-notice.test.ts`: DRAFT, PREPARED, APPROVED and QUOTED with the Ignored layer show the notice and badge and no status banner; banners kept when not ignored) |
| Verified | qa-engineer | 2026-11-24 | Fix read in the squash; PR run of record 45330500791 (head f3229c2d) green on attempt 1; first `master` push CI 45334499369 (9697d6a5) green in every job on attempt 1 (Stage 11 `667 files, 16,917 passed`, 0 flaky, 0 failed in four shards) and Windows package 45334499367 `success`. Closing proof met; test plan section 7.1 E and section 7 ledger |

## Records
Jira Bug AQP-421; GitHub issue #671.

Closed 2026-11-24: Jira AQP-421 to Done; GitHub #671 closed as completed (DL-363).
