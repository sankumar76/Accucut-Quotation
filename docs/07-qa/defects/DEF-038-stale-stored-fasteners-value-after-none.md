# DEF-038: After Fasteners is set to "None" and the screen shows it, the server still held M6 bolt / 5.00 / 3.50 instead of None / 0.00 / 0.00 (seen once, `estimate-fasteners.spec.ts:113` [mobile])

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.05 (AQP-313) AC-2, AC-3; SPEC section 14.4 (the server holds 0.00 for Qty and Cost while Fasteners is None) |
| Severity | **Sev-3 Moderate** (2026-11-23: the provisional Sev-2 of DL-321 (1) is withdrawn on the classification below; QA grade, master told). Earlier: Sev-3 (downgraded from provisional Sev-2 by master, DL-277, 2026-11-21, under DL-231 C4, on substitute evidence). **Returns to provisional Sev-2 the same day** if the diagnostic line appears (see Reopen trigger) |
| Priority | P3 (Jira Medium since 2026-11-21) |
| Type | **Test** (DL-277: the test read before the None save landed is the remaining reading; the product keeps None with zeroed values atomically) |
| Status | **Open: classified Test on 2026-11-23 (DL-321); a test-only fix is needed before #632 merges** (see "Classification 2026-11-23"). Earlier: **Open on watch** (Jira In Review). No longer blocks G8 as a Sev-2 (DL-275 A2, DL-276); at G8 master accepts it in writing if the diagnostic has not fired (test plan section 6). PR #580 (tests only: a diagnostic in `estimate-fasteners.spec.ts`, a PostgreSQL journey test, a unit test of the request chain) merges on fully green CI with no combined review (DL-277 (3)) |
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

## Classification 2026-11-23 (qa-engineer, DL-321; reopen trigger fired on PR #632 run 45097669695)

**Result: type Test, Sev-3 (DL-277 grade). The provisional Sev-2 is withdrawn. The test fault is a wait that accepts any save; a product redundancy that shifts the wait is a separate Sev-4 Bug, DEF-066 (AQP-408, #634). The :194 flaky of the same run is a second occurrence of DEF-065's mechanism, which #633 cures.**

**The run.** #632 (Next 16.4.6 plus vitest 5.1.0) run 45097669695, head 48de4c93 (built before #630 merged), shard 1 job 137441009977. `estimate-fasteners.spec.ts:151` [mobile] "AC-2, AC-3: back to "None" hides them and the server holds 0.00 ..." failed on both attempts at `expectStored` (:173 via :84) and printed the diagnostic line on both (14.8 s attempt 1). First read M6 bolt / 5.00 / 3.50; second read 2 s later None / 0.00 / 0.00, both attempts.

**What the save lists say (diagnostic lines of the job log).**

| Attempt | Saves (revision sent, response time) |
|---|---|
| 1 | S "M6 bolt" rev 1 (+900 ms); T rev 2 (+1905); U rev 3 (+3258); **T rev 4 (+3640), unchanged**; **U rev 4 (+4073), unchanged**; S "None" rev 4 (+4299) |
| 2 | S "M6 bolt" rev 1 (+776); T rev 2 (+1683); **T rev 3 (+2727), unchanged**; U rev 3 (+3784); S "None" rev 4 (+4235) |

The unchanged repeats do not move the revision (T and U at rev 4, then S "None" at rev 4). The test's waits are `nextSave(page)` (`tests/e2e/support/part-form.ts:34`): the next PATCH of the part's inputs **of any field**. Each repeat is a PATCH the test did not ask for, so a wait ends on the wrong save and the test runs one step ahead. Attempt 1: the wait for the save of U is satisfied by the save of U (rev 3), the wait for "None" (registered at +3258) by the repeat of T (+3640), and the first read happens before the "None" request has even been sent (it is queued behind the repeats of T and U; its answer is at +4299). Attempt 2: the wait for U ends on the repeat of T (+2727), the wait for "None" on U (+3784), and "None" is answered at +4235. In both attempts the only save that holds "None" is last, and the old triple is exactly the state before it.

**Reproduced at hook level** (the project's harness; scratch file not committed): with the first save held, S "M6 bolt" then T "5" and U "3.5" typed in the round trip gives S rev 1, T rev 2, U rev 3, **T rev 4, U rev 4**, the same shape as attempt 1, on `master` 444d10b7 and on PR #633 head 43b6366f. Cause: `syncWatchers` (`use-part-form.ts` :363-380) sends a visible watcher by a direct `send()` while its own save is queued behind it; `onItsWayRef` is not set for the sync's send. That is DEF-066.

**Why Test and not Product for this failure.** DL-231 C4: Sev-3 Test if the read came before the save landed; Sev-2 if the save returned 200 and the server still held the old values. Here the save of "None" is the last one, the old triple is the state before it, and the second read is right. The diagnostic does not print the time of the first read and no trace of the failing attempts exists (the run has no artifacts), so "read before the answer" is shown by the save lists and the reproduction, not by a timestamp. A 200 for "None" followed by the old values would be a new server fault with no support in the other cases of this shard or in hundreds of earlier runs (DL-277); the server writes None with Qty and Cost zeroed in one transaction (DL-277).

**Not a DEF-065 failure for `:151`, and #633 does not cure it.** No save was dropped. #633 (head 43b6366f) leaves `syncWatchers` alone and the hook run above gives the same repeats on it. `:151` will fail again on #633 plus #632 unless the test is fixed.

**The second case of the run, `estimate-form-sections.spec.ts:194` [mobile]** "AC-3: clearing Fasteners shows "None" again, and a stored value is removed": attempt 1 failed at 30.2 s with `page.waitForResponse` timing out at `nextSave` (:200, `cleared`), the retry passed (9.8 s). **That is DEF-065's mechanism on a text field with a default**: after S "M6 bolt" is answered the test clears S at once; `heldRef` is still the stale "nothing stored", `standIn("")` equals `standIn(null)` = "None", `commit` returns, and no second PATCH is sent. Hook level: with the first save held, S "M6 bolt" then S "" gives one request and the server keeps "M6 bolt" while the screen shows "None" on `master`; on #633's head both are sent and the server ends with no value. Product (DEF-065), cured by #633 in the hook run; its proof is an attempt-1 pass at three widths on #633's run of record.

**Fix (test-only; the DL-308 H1 standard: no skip, `fixme`, retry, timeout, `test.slow()` or sleep change; every assertion kept).** `saveFasteners` and the typed Qty and Cost waits in `estimate-fasteners.spec.ts` wait for the response of the PATCH whose request body carries that field's ID (`nextSave(page, fieldId)` in `tests/e2e/support/part-form.ts`, a filter on `request.postData()`), so an extra save cannot end the wait. That is a precise condition, not a longer wait, and it keeps failing if "None" is never saved. DEF-066 (the repeats) is logged as a product Bug and is not hidden by it.

**Proof that closes DEF-038** (all on a run of record; no re-run to green, DL-320 M4): P-a: `estimate-fasteners.spec.ts` "back to None" attempt-1 pass at mobile, tablet and desktop, on the PR run of the test fix and on the first `master` push after it; P-b: **0** `[AQP-341 stored-values diagnostic]` lines in every job of #632's run of record and of the first `master` push after it; P-c: `estimate-form-sections.spec.ts` "clearing Fasteners" attempt-1 pass at three widths on a run that contains #633 (DEF-065's P6). The reopen trigger stays on: any diagnostic line after P-a to P-c reopens it as provisional Sev-2 the same day.

**Not shown / limits.** No timestamp of the first read; no trace of the failing attempts (no artifacts on the run); the run was built before #630. The mechanism fits both attempts' lists, the revisions and the second reads without exception.
