# DEF-038: After Fasteners is set to "None" and the screen shows it, the server still held M6 bolt / 5.00 / 3.50 instead of None / 0.00 / 0.00 (seen once, `estimate-fasteners.spec.ts:113` [mobile])

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.05 (AQP-313) AC-2, AC-3; SPEC section 14.4 (the server holds 0.00 for Qty and Cost while Fasteners is None) |
| Severity | **Sev-3 Moderate** (downgraded from provisional Sev-2 by master, DL-277, 2026-11-21, under DL-231 C4, on substitute evidence). **Returns to provisional Sev-2 the same day** if the diagnostic line appears (see Reopen trigger) |
| Priority | P3 (Jira Medium since 2026-11-21) |
| Type | **Test** (DL-277: the test read before the None save landed is the remaining reading; the product keeps None with zeroed values atomically) |
| Status | **Open on watch** (Jira In Review). No longer blocks G8 as a Sev-2 (DL-275 A2, DL-276); at G8 master accepts it in writing if the diagnostic has not fired (test plan section 6). PR #580 (tests only: a diagnostic in `estimate-fasteners.spec.ts`, a PostgreSQL journey test, a unit test of the request chain) merges on fully green CI with no combined review (DL-277 (3)) |
| Jira / GitHub | [AQP-341](https://sankumar76.atlassian.net/browse/AQP-341) / [#462](https://github.com/sankumar76/Accucut-Quotation/issues/462) |
| Found by / date | qa-engineer, 2026-11-17 (DL-231 condition C4) |
| Environment | CI run 43998662056, Stage 12 shard 1, Chromium [mobile], master `dc2f98ea` |

> Restored on 2026-11-21 (DL-276) from the Jira Bug AQP-341, which is the source of truth for the full text. This file is a condensed copy for the defects folder.

## Steps to Reproduce
From the test: open the form for a new part; save Fasteners = "M6 bolt", then Qty 5.00 and Cost 3.50; save Fasteners = "None" (the screen hides Qty and Cost); read the stored values (`storedValues`, spec line 131).

## Expected Result
Stored: Fasteners (`...000100000019`) = "None", Qty (`...020`) = "0.00", Cost (`...021`) = "0.00".

## Actual Result
All three held the old values ("M6 bolt", "5.00", "3.50"), not a partial update. The first attempt failed on stored values at 15.3 s, not on time; the retry then failed with a 30 s timeout (a separate mode). Passed on desktop in shard 3. Seen once. No trace of the first attempt was kept.

## Suspected Area
Not investigated: ordering of the "None" save against the read (`saveFasteners`, `storedValues`); the server write that zeroes Qty and Cost; a save that answers before the write is stored.

## Fix & Verification  _(developer / qa-engineer)_
Downgrade rule (DL-231 C4): to Sev-3 Test if a trace shows the read came before the save landed; keep Sev-2 if the save returned 200 and the server still held the old values. QA note 2026-11-21: `estimate-form-sections.spec.ts:161` [tablet] (Fasteners "None", reload, locator not found) was flaky on master push 44892640890; its error is a missing locator, not a wrong value, so it is not shown to be a recurrence. The developer should read it first.

## Re-grade and watch (DL-277, 2026-11-21)
- Grade: Sev-3, type Test. Jira priority Medium and label sev-3; GitHub #462 label sev-3. Substitute evidence read by master: the server keeps None with Qty and Cost zeroed in one transaction under the estimate lock with a revision-conditioned UPDATE; 12 concurrent journeys never showed an old value; the form sends four chained saves; no recurrence in hundreds of later runs of the case at three widths. Condition: a test that a 409 on a part save shows the conflict state and re-reads the part (cited in #580 or added to it).
- **Reopen trigger:** any `[AQP-341 stored-values diagnostic]` line in a CI job log, or any first-read mismatch of this case. It then returns to provisional Sev-2 the same day, blocks G8, qa-engineer reads the second read and the save list, and master is told.
- QA reads every `master` push run daily for the line (test plan section 7). Final-regression note: `estimate-form-sections.spec.ts:161` [tablet] was flaky on 44892640890 with a missing locator after reload, not a wrong value; it is not this defect.
