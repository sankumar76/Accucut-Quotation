# DEF-041: `estimate-save.spec.ts:240` flaky: closing the tab raises a second beforeunload prompt, then times out at 60 s (passed on retry; 5 failed attempts in 3 runs since 14:43 UTC; not caused by #452)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.08 (AQP-316) AC-4, AC-8 |
| Severity | Sev-3 Moderate |
| Priority | P2 (Jira Medium) |
| Type | Test (a timing race in the test; no product defect shown) |
| Status | **Closed** (Jira Done; GitHub #473 closed). Fixed by PR #514, squash `6f275add`: wait until nothing is unsaved before the second close |
| Jira / GitHub | [AQP-344](https://sankumar76.atlassian.net/browse/AQP-344) / [#473](https://github.com/sankumar76/Accucut-Quotation/issues/473) |
| Found by / date | qa-engineer, 2026-11-17 (the delivery lead had suspected Dependabot PR #452) |
| Environment | CI, Playwright 1.65.0, shards 1, 2 and 4, mobile, tablet and desktop |

> Restored on 2026-11-21 (DL-276) from the Jira Bug AQP-344, which is the source of truth for the full text. This file is a condensed copy for the defects folder.

## Steps to Reproduce
Not reproducible on demand: `--repeat-each=30` on a loaded machine was suggested, not run.

## Expected Result
Once the save of the field is seen with 200 and nothing is unsaved, closing the page raises no dialog.

## Actual Result
Sometimes a second `beforeunload` appears and the page stays open (`prompts` holds two entries); 60 s timeout; passed on retry (8 to 14 s). First failure on react-hook-form 7.91.0, nine minutes before #452 merged; the library is never imported in `src/`; #452 was not the cause and was not reverted.

## Suspected Area
`tests/e2e/estimate-save.spec.ts` lines 256 to 262: `waitForResponse` resolves before `SaveGate.isDirty()` clears (`save-gate.ts`, `leave-guard.ts`). The direction was the safe one (an extra prompt, never a missing one), so Sev-3.

## Fix & Verification  _(developer / qa-engineer)_
PR #514. The AQP-316 AC-4 assertion was kept.
