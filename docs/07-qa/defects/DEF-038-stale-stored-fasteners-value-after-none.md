# DEF-038: After Fasteners is set to "None" and the screen shows it, the server still held M6 bolt / 5.00 / 3.50 instead of None / 0.00 / 0.00 (seen once, `estimate-fasteners.spec.ts:113` [mobile])

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.05 (AQP-313) AC-2, AC-3; SPEC section 14.4 (the server holds 0.00 for Qty and Cost while Fasteners is None) |
| Severity | **Sev-3 Moderate, closed** (2026-11-23: the provisional Sev-2 of DL-321 (1) is withdrawn on the classification below; QA grade, master told). Earlier: Sev-3 (downgraded from provisional Sev-2 by master, DL-277, 2026-11-21, under DL-231 C4, on substitute evidence). **Returns to provisional Sev-2 the same day** if the diagnostic line appears (see Reopen trigger) |
| Priority | P3 (Jira Medium since 2026-11-21) |
| Type | **Test** (DL-277: the test read before the None save landed is the remaining reading; the product keeps None with zeroed values atomically) |
| Status | **CLOSED 2026-11-23 (qa-engineer, on master's DL-331).** The test fix is #636 (`ce7c8c21`); P-a, P-c and P-b (as read on #636's runs) are met. P-b's #632 clause is #632's merge condition, not a condition of this Bug (DL-331 (1), (2)). **The reopen trigger stays until G8 and covers #632's run:** any `[AQP-341 stored-values diagnostic]` line or first-read mismatch of the case on #632's run of record or on any later run reopens DEF-038 as provisional Sev-2 the same day (blocks #632's merge and G8, DL-323 (5)). See "Closure 2026-11-23 (DL-331)". Earlier, 2026-11-23, later: **Open**: the test fix merged (#636, `ce7c8c21`); P-a and P-c are met and P-b is met for #636's runs, but P-b's other clause, 0 diagnostic lines in every job of #632's run of record, cannot be read yet (#632 is open and behind; its last run is the red 45097669695). Not closed** (see "Proof reading 2026-11-23, after #636"). Earlier, 2026-11-23: **Open: classified Test on 2026-11-23 (DL-321); a test-only fix is needed before #632 merges** (see "Classification 2026-11-23"). Earlier: **Open on watch** (Jira In Review). No longer blocks G8 as a Sev-2 (DL-275 A2, DL-276); at G8 master accepts it in writing if the diagnostic has not fired (test plan section 6). PR #580 (tests only: a diagnostic in `estimate-fasteners.spec.ts`, a PostgreSQL journey test, a unit test of the request chain) merges on fully green CI with no combined review (DL-277 (3)) |
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

## Proof reading 2026-11-23, after #636 (qa-engineer; DL-323 (3) and (4), DL-325 (4); read from the Stage 12 job logs with `gh api .../jobs/<id>/logs --allow-escape-sequences`, ANSI stripped; no re-run, no ruling)

**Result: P-a met. P-c met. P-b met for #636's runs, and its #632 clause is not yet readable. DEF-038 is not closed; one clause is missing.**

**The fix and its runs.** #636 (AQP-341, test-only: `nextSave(page, fieldId)` waits for the PATCH that carries the field) squashed as `master` **ce7c8c21** (05:17:43Z). The attempt-1 Stage 12 jobs of PR run **45111572570** (head b6396c11, `behind_by 0` against d2771045) are its run of record for P-a (DL-325 (4): attempt 2 re-ran only the Mailpit 404 of Stage 11). The first `master` push after the squash is **45116869670** (ce7c8c21, `success` in all jobs). Both contain #633 (d2771045 is an ancestor of b6396c11 and of ce7c8c21; `git merge-base --is-ancestor`).

| Proof | Required | Reading | Met |
|---|---|---|---|
| **P-a** `estimate-fasteners.spec.ts:151` "AC-2, AC-3: back to "None" hides them and the server holds 0.00 ..." attempt-1 pass at three widths, on the PR run of the test fix and on the first `master` push after it | both runs | **PR run 45111572570, attempt 1** (jobs 137497464345 / 137497431254 / 137497484995): mobile **20.0 s**, tablet **25.6 s**, desktop **19.6 s**, all `✓`, no `✘`, no `(retry #`; shards `548 / 542 / 545 / 529 passed`, 0 flaky. **Push 45116869670** (jobs 137501596609 / 137501596336 / 137501596562): mobile **12.5 s**, tablet **22.7 s**, desktop **16.3 s**, all `✓`; `548 / 542 / 545 / 529 passed`, 0 flaky, 0 failed. (Mobile is shard 1, tablet shard 2, desktop shard 4.) | **Yes** |
| **P-b** 0 `[AQP-341 stored-values diagnostic]` lines in every job of #632's run of record and of the first `master` push after it | #632's run of record; the push | **0 lines** in every Stage 12 job of 45111572570 attempt 1 (4 jobs) and of the push 45116869670 (4 jobs). The string is in the spec on `master` (`estimate-fasteners.spec.ts:76`), so a mismatch would print it. The only `diagnostic` hits in the push run's `Stages 1 to 11b` log are two branch names from `git fetch` (`fix/AQP-343-renumber-diagnostic`, `fix/AQP-387-rates-changed-diagnostic`). **#632's run of record does not exist**: #632 is open, `BEHIND`, head 48de4c93 (the head of the red run 45097669695, built before #630) | **Partly**: met for #636's runs; the #632 clause is open |
| **P-c** `estimate-form-sections.spec.ts:194` "AC-3: clearing Fasteners shows "None" again, and a stored value is removed" attempt-1 pass at three widths on a run that contains #633 | one run | **PR run 45111572570 attempt 1**: mobile 11.1 s, tablet 10.5 s, desktop 11.5 s, all `✓`; **push 45116869670**: mobile 7.2 s, tablet 10.4 s, desktop 10.5 s, all `✓`. Both contain #633 | **Yes** |

**Why QA does not close on this.** P-b, as QA wrote it in the classification above, names "#632's run of record" next to "the first `master` push after it", and DL-323 (4) repeats the pair on #632's own run (`:151` and `:194` attempt-1 green at three widths, 0 diagnostic lines, a flaky mark counts as not green). Nothing on #632 has been run since 45097669695. If master reads P-b's #632 clause as #632's own merge condition (DL-323 (4), DL-320 M4) and not as a closing condition of this Bug, the Bug can close on the evidence above; that is master's reading, not QA's. Until then it stays open, Sev-3, Test, and it does not block G8 (DL-323 (5)).

**The reopen trigger stays on.** Any `[AQP-341 stored-values diagnostic]` line after this reading, or any first-read mismatch of this case, returns DEF-038 to provisional Sev-2 the same day. Counted so far since #636: 0 lines in 45111572570 (attempt 1) and 45116869670, and 0 in the jobs read of PR run 45116955985 (#640) so far (4 Stage 12 jobs, attempt 1).

**Limits.** Attempt 1 of 45111572570 is the run of record by DL-325 (4); the run's final state (attempt 2) is also `success` in every job. The tablet reading of 25.6 s on the PR run is above the 25 s line that DEF-069 and DEF-070 use; it is not a condition of P-a (a pass on the first attempt) and is recorded as a reading only. The push run's tablet reading was 22.7 s.

**Second push read (QA, 2026-11-23, later).** `master` push run **45122632176** (86cf64d3, #640 squash; `success` in all jobs, 0 flaky, 0 failed in all four shards): 0 `[AQP-341 stored-values diagnostic]` lines in every job; `estimate-fasteners.spec.ts:151` "back to None" attempt-1 pass at all three widths (mobile **28.6 s**, tablet 25.8 s, desktop 17.9 s), `estimate-form-sections.spec.ts:194` "clearing Fasteners" attempt-1 pass (12.5 / 15.8 / 8.5 s). The mobile reading of 28.6 s is 1.4 s under the 30 s budget on a passing attempt; it is a reading, not a trigger (the reopen trigger is a diagnostic line or a first-read mismatch), and it is above the 12.5 s of the previous push (45116869670).

## Closure 2026-11-23 (qa-engineer; master's DL-331; no new reading beyond the proof reading above; no re-run, no ruling)

**Result: CLOSED. Type Test, Sev-3 (DL-277 grade, DL-321 classification). The defect was a test wait that accepted any save of the part; #636 ties it to the field's own save.**

| Item | State |
|------|-------|
| Fix | #636 (AQP-341), test-only: `nextSave(page, fieldId)` in `tests/e2e/support/part-form.ts` and its use in `estimate-fasteners.spec.ts`; squashed as `master` **ce7c8c21** (2026-11-23, 05:17Z) |
| P-a | Met. `estimate-fasteners.spec.ts:151` "back to None" attempt-1 pass at three widths on PR run 45111572570 (attempt 1; 20.0 / 25.6 / 19.6 s) and on `master` push 45116869670 (12.5 / 22.7 / 16.3 s); the second push read, 45122632176, is also an attempt-1 pass at three widths (28.6 / 25.8 / 17.9 s) |
| P-c | Met. `estimate-form-sections.spec.ts:194` "clearing Fasteners" attempt-1 pass at three widths on 45111572570 (11.1 / 10.5 / 11.5 s) and on 45116869670 (7.2 / 10.4 / 10.5 s); both contain #633 |
| P-b | Met as DL-331 reads it: 0 `[AQP-341 stored-values diagnostic]` lines in every Stage 12 job of 45111572570, 45116869670, 45122632176 and 45116955985 (DL-331 (1)). The clause "#632's run of record and the first `master` push after it" **moved to #632's merge condition** (DL-323 (4), DL-320 M4); it is not a closing condition of this Bug (DL-331 (2)). No proof is dropped |
| Reopen trigger | **Stays on until G8 and covers #632's run.** A diagnostic line or a first-read mismatch of this case reopens DEF-038 as provisional Sev-2 the same day |
| Open item, for #632 | Its merge condition (DL-323 (4)): `:151` and `:194` attempt-1 green at three widths on its run of record, 0 diagnostic lines in every job (a flaky mark counts as not green). **Read (QA, 2026-11-23, 07:00Z) on #632's run 45125512077 (head 9f59beb3, `behind_by 0` against 06d5d56a; the run finished `failure`, see below): 0 `[AQP-341 stored-values diagnostic]` lines in all four Stage 12 jobs; `:151` attempt-1 `✓` at mobile 16.3 s, tablet 25.7 s, desktop 22.2 s; `:194` attempt-1 `✓` at 9.9 / 10.3 / 10.8 s; shards `548 / 542 / 545 / 529 passed`, no `✘`, no `(retry #`.** That run is **not green**: `Stages 1 to 11b` is red at Stage 11 on `overdue-scan.test.ts` (a different case, DEF-064's file list, reported to master) and the fan-in `Stages 1 to 11` is `failure`; so it is not a run of record for DL-323 (4), which stays master's to apply. The trigger did not fire on it |
| Links | Jira AQP-341 (Done), GitHub #462 (closed, completed) |
| Pre-G8 list | Leaves the "not blocking, listed" line (DL-331 (3)) |

**Fix & Verification.** Fixed: developer, #636 `ce7c8c21`. Regression test: the changed waits are the test; the diagnostic line stays in the spec (`:76`). Verified: qa-engineer, 2026-11-23, P-a, P-b (as DL-331 reads it) and P-c above.

**Reading on #632 (2026-11-23, 07:00Z; QA, no ruling).** #632's first run after the DEF-064 merge, 45125512077 (head 9f59beb3, Next 16.4.6 plus vitest 5.1.0), has 0 diagnostic lines and attempt-1 passes of `:151` (16.3 / 25.7 / 22.2 s) and `:194` (9.9 / 10.3 / 10.8 s) at mobile, tablet and desktop in all four Stage 12 jobs (0 `✘`, 0 retries). The reopen trigger did not fire. The run is red at Stage 11 (`overdue-scan.test.ts`), so it does not satisfy "fully green" (DL-332 (4)) for #632's merge condition.
