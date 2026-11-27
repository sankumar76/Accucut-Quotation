# DEF-147: masters-table-actions.spec.ts:409 [desktop] (SCR-14 Users axe scan of the forced table, the DEF-047 family) timed out on both attempts on PR #833's run 46035822905, shard 4: a bare time-out, then a time-out inside axe (Test; Sev-3; Jira AQP-504, GitHub #837)

| Field | Value |
|-------|-------|
| Story / AC | STORY-10.21 (AQP-245) AC-5 and DEF-021 own the case; family of DEF-047 (AQP-376, closed); RISK-031 (time-out mode) |
| Severity | **Sev-3 (DL-264 (1)); not a G8 blocker on its own** |
| Priority | P3 (Jira Medium; labels `sev-3`, `test`, `near-budget`) |
| Type | **Test** (a whole-page axe scan that ran past the 30 s budget); no axe violation and no product cause shown. It becomes a Product defect only if a violation list or a product cause appears |
| Status | **Open, 2026-11-27.** Logged on master's DL-471 (C) under DL-264 (1); master rules before any re-run. Not attributed to #833. |
| Jira / GitHub | [AQP-504](https://sankumar76.atlassian.net/browse/AQP-504) / [#837](https://github.com/sankumar76/Accucut-Quotation/issues/837) (labels bug, sev-3, ai-delivery; Jira also aiid-DEF-147, agent-qa-engineer, test, near-budget). Searched first: JQL on `aiid-DEF-147`, `aiid-DEF-047` and 'masters-table-actions': only the closed DEF-047 (AQP-376), AQP-245 and AQP-261. |
| Found by / date | qa-engineer, 2026-11-27, on master's DL-471 (C) (relayed by the orchestrator) |
| Build / commit | PR #833 (AQP-502), head `da536811`, CI run 46035822905 attempt 1, job `Stage 12: E2E (shard 4 of 4)` (140630839660), [desktop], test nos. 336 (attempt 1) and 344 (retry) |
| Environment | CI, `next dev` |

## Reading (job log, ANSI stripped)
- **Attempt 1:** `Test timeout of 30000ms exceeded.` with no further error text (32.0 s on the progress line).
- **Retry #1:** `Test timeout of 30000ms exceeded.` inside `AxeBuilder.analyze` -> `page.evaluate` (`support/design-system.ts:100`, called from `masters-table-actions.spec.ts:417`); the `[cause]` is the same `page.evaluate` time-out (35.2 s).
- **A bare time-out, not a violation list:** no `expect` failed and axe returned no violation on either attempt.
- **Siblings:** the two other cases on the same line (the parametrised Users axe cases) passed at **29.9 s and 28.1 s**, near the 30 s budget.
- **Against earlier runs:** the same case read 16.1 to 25.4 s [desktop] in the 27 Nov logs QA holds (09:16Z to 13:51Z, `master` push runs and the PR runs read for the cause step), with no failure in any.
- **Draw:** shard 4 on 46035822905 attempt 1 read median 1.13 against 31015cce (first-4-minute 1.43 on 14 tests; margin 0.06 over shard 2); W1 (d) not met. DL-264's finding that the axe cases scale about 1.6 times steeper than the shard applies (1.13 to the power 1.6 is about 1.22; the siblings read about 1.3 to 1.4 times the usual 20 to 23 s).

## Attribution
Not attributed to #833: its 27 files include none under masters, users, design-system or axe (`gh pr view 833 --json files`), and master read SCR-14 as untouched. The same run's shard 4 also held the six `estimate-warning` both-attempt failures that master put on a cause step (DL-471 (3)); this case is a different mechanism (axe's whole-page evaluate) and is read on its own.

## Fix (not yet authorised)
None proposed by QA. DL-264 (1) and DL-263 (6) apply: DL-264 (1) required the post-G8 `architecture` issue of DL-257 (9) for the axe cases' cost. Master rules before any re-run or any change.

## Proof of fix
QA reads this case on every `master` push (attempt-1 durations at the three widths, whether any is 25 s or more at a draw of 1.10 or less, and any violation list). The Sev-3 stays unless a violation list or a product cause appears.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Master's ruling | master | | |
| Fix or acceptance | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-504 and GitHub issue #837, created 2026-11-27 and cross-linked; related AQP-376 (DEF-047), AQP-245, AQP-261, AQP-1, AQP-502; test plan 0.3.149; DL-471, DL-264, DL-263, DL-257.