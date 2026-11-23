# DEF-070: `estimate-treatments.spec.ts` AC-1 (:86 on the failing head) [tablet]: "Test timeout of 30000ms exceeded." on attempt 1, the part form not found after `page.reload()` (PR #624 run of record 45099210407; DL-264 (5)(b) trigger met; type Test)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.06 (AQP-314, Done) owns `estimate-treatments.spec.ts`, its **AC-1** ("the list has the eight, each with its letter; a chosen one is stored as 1 and one that is left as 0; none chosen is valid; the trigger says which, and a reload keeps it"). **No AC is shown to fail**: the case ran out of its 30 s budget at its last assertion, with no received value |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-23, on master's DL-328 (2)) |
| Priority | P3. Lane: hardening window, behind DEF-064's fix and DEF-069's observation (DL-328 (3)), and only if the mechanism reading below does not hold. Does not block G8 as a Sev-3 |
| Type | **Test, product not excluded** (cause not determined; the family reading is below) |
| Status | **Open** (logged 2026-11-23). Proof route of DL-328 (3), "yes" branch: half 1 read (below), half 2 waits for #636's squash |
| Jira / GitHub | [AQP-413](https://sankumar76.atlassian.net/browse/AQP-413) / [#641](https://github.com/sankumar76/Accucut-Quotation/issues/641). Jira "relates to" AQP-1 (Intake) and AQP-314 (owner story). Labels `ai-delivery`, `aiid-DEF-070`, `bug`, `sev-3`, `final-review`, `agent-qa-engineer`; priority Medium. DEF-070 was free: no file in `docs/07-qa/defects/`, JQL `labels = "aiid-DEF-070"` found nothing, no GitHub issue named it |
| Risk / rule | The trigger is DL-264 (5)(b): "any attempt-1 failure, or a reading of 29 s or more, means a Bug the same day" (no wave clause; triggers apply as written, DL-284). **No re-run rule** (W1 does not cover a watch-list case with a Bug trigger). RISK-031 (reopened at 9, DL-326): not a trigger (b) event (a PR run). The watch trigger stays until G8: any later attempt-1 failure of the case reopens this Bug the same day |
| Found by / date | CI (PR run); wave reading by qa-engineer 2026-11-23 (14934a39); Bug logged on DL-328, 2026-11-23 |
| Build / commit | PR #624 (AQP-399) run **45099210407**, head **196fd467** (squashed as `967e6337`); that head did **not** contain #630 (squashed as `e10e746c`) |
| Environment | GitHub Actions ubuntu-latest, Stage 12 shard 2 of 4 (project tablet, 768 px), 4 workers, 30 s test timeout, one retry; invented data only |

## Steps to Reproduce
Not reproducible on demand (CI only; no local E2E, CLAUDE.md section 9 item 5). The case, as it stood at 196fd467 (:86 to :112): `openForm`; the trigger reads "None selected"; the list opens; eight checkboxes; `toggle(Foam)`, `toggle(Primer)`, two reads of the stored part; `toggle(Primer)`, `toggle(Foam)`, a read; a fifth `toggle(Foam)`, Escape, **`page.reload()`**, then `expect(trigger).toContainText('1 selected: Foam')`.

## Expected Result
The case passes in 15 to 21 s on a tablet (readings below) and the reloaded form shows "1 selected: Foam".

## Actual Result
Attempt 1: 30.1 s, `Test timeout of 30000ms exceeded.` while `expect(trigger).toContainText('1 selected: Foam')` (:110 in that head) was waiting; the locator `form[data-part-form]` > button `/^Surface treatments/` was **not found**: after the reload the form was not on the page. No received text ("None selected" would have been the DEF-065 / #513 family). Retry passed in **26.3 s**.

## Evidence
| Item | Reading |
|------|---------|
| Run, job | PR #624 run 45099210407, Stage 12 shard 2 job 137445894864: `1 flaky, 7 skipped, 541 passed (21.5m)`; the run is `success` (23 Nov 02:34Z) |
| Attempt 1 / retry | 30.1 s (failed) / 26.3 s (passed, above the 25 s line) |
| Same case, same run, other widths | mobile 13.8 s, desktop 16.2 s (attempt 1, passed) |
| Same case on `master` pushes, attempt 1, s (mobile / tablet / desktop) | 6d85f555 (45095489270) 20.0 / 15.3 / 20.6; 7a21de81 (45093105551) 14.3 / 20.8 / 15.1; 444d10b7 (45098548601) 15.8 / 19.3 / 17.5; 967e6337 (45101673685) 18.5 / 22.4 / 13.4. **After #630:** e10e746c (45103773451, :88) 21.6 / 21.2 / 19.7; d2771045 (45110218895, :88) **26.7** / 18.4 / 19.5 |

**Wave measure, W1 (d) as clarified by DL-328 (4)** (per-test median ratio of the matched tests of shard 2 against the latest fully green `master` push run that had **completed** when the measured run completed, named by run ID):

| Reference | Shard 2 median | First 4 minutes | Other shards (1, 3, 4) | Reading |
|---|---|---|---|---|
| **444d10b7, run 45098548601** (finished 02:27:56Z; the W1 reference) | **1.359** | 1.362 | 0.957, 0.795, 0.845 | +0.25 and 1.3x met, **1.4x not met: not a measured wave** |
| 6d85f555, run 45095489270 (QA's first reference, 14934a39) | 1.583 | 1.575 | 0.854, 1.161, 0.825 | **pointer only** (not the W1 reference; DL-328 (1)) |
| 967e6337, run 45101673685 (completed later, 03:05Z) | 0.99 (master's figure) | - | - | **pointer only** |

QA's own ratios for the later runs (same script, matched tests by project, file and title, attempt-1 durations) reproduce master's DL-326 figures to within 0.01.

## Mechanism reading (DL-328 (3) step 1: is the wait before `page.reload()` a page signal proven, by its `src/` line, to come after the save has settled; DL-240)
Read on `master` d2771045 and on #636's head `b6396c11`. **What the two PRs add.** #630 added the wait: `toggle` (spec :50-56) now ends with `await expectNothingUnsaved(page)` (:55), defined in `tests/e2e/support/part-form.ts` :52-54 over `hasUnsavedWork` :44-48. #636 adds **no wait before the reload**: it only changes `nextSave(page)` to `nextSave(page, flagLetterOf(name))` (the save that carries that flag's field ID), so the `saved` wait of `toggle` cannot end on a repeat save of another field; its own diff of the spec and of `part-form.ts` is that and nothing else.

**By line, the signal is the leave guard's own answer, and it comes after the save has settled:**
1. `hasUnsavedWork` dispatches a cancelable `beforeunload` and reads `defaultPrevented` (`part-form.ts` :44-48). The page's listener `onBeforeUnload` (`src/lib/estimates/leave-guard.ts` :128-133) prevents the event only if `gate.isDirty()`.
2. `isDirty` is `inFlight.size > 0 || unsaved.size > 0` (`src/lib/estimates/save-gate.ts` :73).
3. The choice's save is put in `inFlight` **synchronously at the click**: `commit` (`use-part-form.ts` :324-338) calls `queueSave` :337, which calls `gate.track(queueRef.current)` at :354 (`track`, `save-gate.ts` :44-55). So the guard reads "dirty" from the click until the answer is handled.
4. `inFlight` is emptied only when the whole queued chain has settled (`save-gate.ts` :51-54): `send` (`use-part-form.ts` :294-318), whose answer handling sets `revisionRef` (:312) and `heldRef` (:313) and reports the saved part (:317), then `.finally` (:348-352), then `syncWatchers` (:353). A flag is a valid choice, so `commit` marks nothing unsaved (`mark`, :328, is for a text the rule refuses). So after `expectNothingUnsaved` returns, the server's 200 for the flag has been received **and** the page has taken the answer, and the next action (here `page.reload()`) meets the stored state.

**Where this stops (QA's reading; master rules whether the "yes" branch holds):**
- **Gap 1, the guard is installed lazily.** The guard is fetched after the page is up (`estimate-workspace.tsx` :79, `useLazyComponent(loadGuard, true)`; `installLeaveGuard` at `leave-guard.tsx` :66). Until its listener is on the page `hasUnsavedWork` answers `false`, whatever is in flight. No line makes the first `expectNothingUnsaved` wait for it. For the toggle that precedes the reload it is the fifth, after four saves that each had a round trip, so it is installed in practice; that is a reading of time, not of a line.
- **Gap 2, the wait speaks to the save, and the failure was the page after the reload.** The failure is the form absent after `page.reload()` at the 30 s edge, not a stored flag that was wrong or an unsaved one lost. The wait closes the save-then-reload path (the #513 family); it does not shorten the case, and it adds polling time to five steps (after #630 the case reads 21.6, 21.2 and 19.7 s at e10e746c, and 26.7 s [mobile] at d2771045, against 13.4 to 22.4 s before it). So two first-attempt passes can be had with or without the mechanism that failed.
- **P1, half 1, read now.** #636's run of record **45111572570** (attempt 1, head b6396c11; its Stage 12 jobs are attempt 1's, `success` in all four shards, `548 / 542 / 545 / 529 passed`), the case "AC-1: the list has the eight ..." (:92 there), attempt 1: **mobile 18.4 s, tablet 18.5 s, desktop 23.0 s**, all passed, all under 25 s. Half 2: the first `master` push run after #636's squash, not yet available.

## Suspected Area (optional)
`tests/e2e/estimate-treatments.spec.ts` AC-1: seven steps that wait on a save each, then a reload and a 15 s expect, on a tablet shard that ran 1.36x slow. Cause not determined.

## Fix route (DL-328 (3))
- **"Yes" branch (the route master set):** no fix PR. The Bug closes when the case passes on its first attempt at all three widths, under 25 s, on #636's run of record (read above, 18.4 / 18.5 / 23.0 s) **and** on the first `master` push run after #636's squash. The watch trigger stays until G8: any later attempt-1 failure reopens it the same day, and "None selected" received after the reload sends QA to the DEF-065 / #513 family first.
- **"No" branch:** a test-only fix by the developer in the hardening window behind DEF-064 and DEF-069's observation, with the same proof on its own PR. No retry, budget or timeout change.
- No re-run rule. W1 does not cover the case.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer (only on the "no" branch) | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | half 1 read on 45111572570 (2026-11-23); half 2 waits for the first `master` push run after #636's squash |

## For master
1. **Step 1 answer, with its two limits.** The wait is a page signal that comes after the save has settled (lines above), subject to the lazy guard (gap 1). Whether "the change that should remove the exposure is already in #636" holds is not shown by it: #636 adds no wait before the reload, and the failing symptom was the form absent after the reload (gap 2). QA has not ruled; the Bug stays open on the DL-328 proof either way.
2. The after-#630 readings of this case are higher than the before-#630 ones (the added waits); one is 26.7 s [mobile] on d2771045. Below DL-264 (5)(b)'s 29 s, so nothing is triggered; reported as evidence.
3. No ruling asked. W1 (d) reference wording is recorded in test plan section 7.
