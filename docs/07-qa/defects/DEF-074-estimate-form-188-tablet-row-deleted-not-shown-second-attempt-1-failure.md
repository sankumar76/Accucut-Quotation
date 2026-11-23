# DEF-074: `estimate-form.spec.ts:188` [tablet] "SQR-01 (b): typing into a part moves the part's revision, ... the part can still be deleted at once": `getByText('Row deleted')` not on the page after the delete dialog closed (attempt 1, :202); second occurrence, on PR #632's runs 45157657813 and 45171635228; type Test, product not excluded

| Field | Value |
|-------|-------|
| Story / AC | The tree's delete and the part form's revision: STORY-05.02 (AQP-302, the parts tree) and the SQR-01 (b) case of `estimate-form.spec.ts` ("AC-4, AC-5, AC-7: typing, refusing and saving"). **No AC is shown to fail:** after the delete dialog closed, the announcement "Row deleted" did not appear within the 15 s expect, with no received text; the next line (:203, no "changed by someone else" notice) was not reached; the retry passed both times |
| Severity | **Sev-3 Moderate** (qa-engineer, 2026-11-23; the watch entry of test plan section 7 and DL-342 (A): a second attempt-1 failure on any run is a Bug the same day, Sev-3, product not excluded). Fails closed on a PR run, no wrong value received |
| Priority | P3 (Jira Medium, label `sev-3`). **Holds #632 under DL-342 (A)** (its next run of record had to pass `:188` on attempt 1 at three widths; it did not). No lane set; master rules the order. Not a G8 blocker as Sev-3 Test |
| Type | **Test, product NOT excluded.** The delete is the tree's `change()` path (`confirmDelete`): the dialog closes whatever the server says and "Row deleted" is set only after an ok answer, so its absence means no answer inside 15 s, a refusal (for example a 409 `TREE_CHANGED`: a revision race in SQR-01 (b), the case's own subject), or an effect of Next 16.4.6 (both occurrences are on #632's branch). The spec has no diagnostic on this wait, so the logs cannot say which |
| Status | **Open** (logged 2026-11-23). No fix PR; no cause stated. **DL-344: not a G8 blocker for now; the cause step is a spec-local diagnostic in `estimate-form.spec.ts` (next free lane after the released CR-01 stories); #632 is post-G8 (the release ships on Next 16.4.5); one stated way back for #632 before the freeze.** See "DL-344" at the end |
| Jira / GitHub | [AQP-417](https://sankumar76.atlassian.net/browse/AQP-417) / [#657](https://github.com/sankumar76/Accucut-Quotation/issues/657). Jira "relates to" AQP-1 (Intake) and AQP-343 (DEF-040, the same change path). Labels `ai-delivery`, `aiid-DEF-074`, `bug`, `sev-3`, `final-review`, `agent-qa-engineer`; priority Medium. DEF-074 was free (no file, no Jira label or summary, no GitHub issue, no decision-log mention) |
| Risk / rule | **DL-345: a `:188` failure does not count against DEF-040's closing proof, but if its diagnostic shows #652's feedback missing (no in-flight sign, `busy` past the 20 s limit, or no Notice after it) QA reopens DEF-040 as Sev-2 the same day (section "DL-345" at the end).** No re-run rule (RISK-031 is open; PR runs). Not on RISK-031 trigger (a) or (b) (PR runs). **Not a DEF-040 failure by signature** (DEF-040's is a "Part renumbered to" wait with the `[AQP-343 renumber diagnostic]`; this file's wait has no diagnostic); whether it counts against DEF-040's closing proof is master's to rule, since the second occurrence is on a head that contains #652's fix |
| Found by / date | CI, PR #632 runs; logged by qa-engineer 2026-11-23 |
| Build / commit | PR #632 (`chore/AQP-1-next-16.4.6-vitest-5.1`): head 85b07b86 (run 45157657813) and head 7bae8081 (run 45171635228, 0 behind `master` 1eae9353, which contains #648, #650 and #652) |
| Environment | GitHub Actions `ubuntu-latest`, Stage 12 shard 2 of 4 (project tablet, 768 px), `next dev` on Next 16.4.6, 4 workers, 30 s test timeout, one retry; invented data only |

## Steps to Reproduce
Not reproducible on demand: CI only (no local E2E, CLAUDE.md section 9 item 5). The case (`tests/e2e/estimate-form.spec.ts:188` to :204): `openForm`; type 3 into the L field and blur, with the save awaited by field (200); open the tree; press the part's "Delete 1" button; the alertdialog "Delete row 1?" is visible; press "Delete row"; `expect(dialog).toHaveCount(0)` (:201); `expect(getByText('Row deleted')).toHaveCount(1)` (:202); `expect(getByText('The parts were changed by someone else.')).toHaveCount(0)` (:203).

## Expected Result
"Row deleted" is on the page once, within the 15 s expect, and no "changed by someone else" notice shows (the case's subject: typing into a part moves the part's revision and the tree follows, so the delete is not stale).

## Actual Result
```
✘ 409 [tablet] › tests/e2e/estimate-form.spec.ts:188:3 › ... SQR-01 (b): ... (24.1s)   PR #632 run 45157657813, job 137634606137
✘ 409 [tablet] › tests/e2e/estimate-form.spec.ts:188:3 › ... SQR-01 (b): ... (26.6s)   PR #632 run 45171635228, job 137682371936
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  getByText('Row deleted')    Expected: 1    Received: 0    Timeout: 15000ms    (33 x locator resolved to 0 elements)
    > 202 |     await expect(page.getByText('Row deleted')).toHaveCount(1);
✓ 418 ... (retry #1) (12.5s)   and   ✓ 417 ... (retry #1) (15.5s)
```
Both shard summaries read `1 flaky, 541 passed`; both runs are `success`.

## Evidence
Logs read 2026-11-23 (QA, ANSI stripped).
- **Same case at the other widths:** run 45157657813 mobile 12.0 s, desktop 12.5 s; run 45171635228 mobile 11.7 s, desktop 7.8 s (attempt 1, passed).
- **Same case on `master`:** push 45157602768 (425d2693) 13.1 / 10.2 / 11.6 s (tablet / mobile / desktop); push 45164384066 (ad0f53c7, #648) 15.4 / 8.7 / 10.4 s. No failure on a `master` push run so far.
- **The first occurrence was recorded as a watch entry** (test plan section 7, "One open item on #632's run") and under DL-342 (A) (a failure on 16.4.6 under M4, type undecided, nothing pointing to 16.4.6; the next run of record had to pass the case at three widths).
- **Both occurrences are on #632's branch** (Next 16.4.6, Vitest 5.1.0). Nothing in the logs separates "16.4.6" from "load on a tablet shard": the case passed at the other two widths in both runs, and on `master` (16.4.5) twice. That is a lead, not a finding.
- **The second occurrence is on a head that contains #652** (DEF-040's client fix: a 20 s limit, re-read and in-flight state on every tree change). The case's 15 s expect is shorter than #652's 20 s limit, so a change that nothing answers inside 15 s fails this assertion before #652's re-read would have shown "Row deleted"; #652 does not change that, and QA does not claim it explains the failure.

## Cause step first (QA's proposal, in the form of DEF-069 and DEF-073; master rules)
Before any fix, the developer states from spec-local step lines (the DL-327 (5) form: the delete request's status and duration, when the dialog closed, what was on the page at the 15 s cut) which of these held: the delete had no answer within 15 s; it answered with a refusal (a 409 `TREE_CHANGED` or other) so "Row deleted" was never set; it answered ok and the announcement was cleared or never drawn. A product cause changes the type to Product (a combined review is not required for the tree, DL-340 (3)). **Scope of a test-only fix, if the cause step clears the product:** `tests/e2e/estimate-form.spec.ts` only; no budget, retry, timeout, trace, artifact or `test.slow()` change; every assertion kept, including :202 and :203; test count unchanged (DL-296 (3)).

## Proof (QA's proposal, not set by master)
P1 attempt-1 pass at three widths on the fix PR's run of record and on the first `master` push after it; P2 each under 25 s; the watch trigger (any later attempt-1 failure of the case) stays until G8. **This is a proposal for master (below).**

## Suspected Area (optional)
`tests/e2e/estimate-form.spec.ts:188` to :204 (the wait for "Row deleted" has no diagnostic and a 15 s limit); the tree's delete path in `use-parts-tree.ts` (`confirmDelete` and `change()`); Next 16.4.6 on a tablet shard.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Cause stated (step lines) | developer | | not started |
| Fixed | developer | | |
| Regression test added | developer (the case itself; count unchanged) | | |
| Verified | qa-engineer | | not started |

## For master
1. #632 is held under DL-342 (A) (`:188` [tablet] failed attempt 1 on its fresh run of record, 26.6 s). Is the Bug's route and order (cause step with spec-local step lines first; lane; whether #632 waits for it or goes back to master for its own ruling, DL-333 (4) pre-ruled branches) yours to set?
2. Does a `:188` failure count against DEF-040's closing proof (DL-338 (7)) when the head contains #652? QA reads it as not a DEF-040 signature (no "Part renumbered to" wait, no diagnostic), and asks.
3. The proof line above is QA's proposal.

## DL-344 (master, 2026-11-23): #632 out of the queue, 16.4.6 the leading reading, the cause step with a diagnostic (QA's record; no ruling made here)

**Evidence master read (DL-344 (1)).** The case "SQR-01 (b) ... deleted at once", by title, in every Stage 12 log master had downloaded: **on 16.4.5, 13 runs (the `master` pushes 45093105551, 45095489270, 45098548601, 45101673685, 45103773451, 45110218895, 45116869670, 45122632176 and 45125449394, and the PR runs 45111572570, 45116955985 and 45128502168), 39 first attempts, 0 failures (tablet 8.4 to 16.3 s). On 16.4.6 (#632): 45125512077 passed at three widths (tablet 11.4 s); 45157657813 and 45171635228 failed attempt 1 [tablet]: 2 of 3 runs on 16.4.6, 0 of 13 on 16.4.5, all at tablet.** (QA adds the later `master` pushes: 45157602768, 45164384066, 45168772552 and 45171590856 passed at three widths, tablet 9.8 to 15.4 s; 16.4.5 is now 17 runs, 0 failures.) The second failure came after #652 was in, so the client gap alone does not explain it: #652's limit (at least 20 s) is longer than the 15 s wait.

**Ruling (DL-344 (2)).** DL-342 (A)(b) set the hold in advance, and DL-333 (4) gave the pattern for the same question about Vitest: a second failure on the new version with none on the old makes the new version the leading reading. So **#632 does not merge before G8; T3's fallback applies as the delivery lead agreed it (DL-320 (6)): the release ships on Next 16.4.5 (and Vitest 5.0.5); #632 and #513 are post-G8 items; #476 stays open and unmerged.** The final regression runs on a 16.4.5 head, so **DL-321 (5)'s 16.4.6 clause falls away** (test plan 7.1). **One stated way back before the freeze (about 3 Dec) (DL-344 (3)):** #632 may take **one** more fresh run of record only if (a) DEF-074's cause step names a cause that does not depend on the Next version (a revision race in the product, or a fault in the test), and (b) its fix has merged on `master`; that run must then meet DL-342 (A)(b) in full (`:188` attempt 1 at three widths). A pass with no cause named does not bring #632 back, nor does a cause on 16.4.6 itself. No re-run, no empty commit, no dispatch; an update of #632's branch after a real new `master` commit is allowed only to read the diagnostic of (4), and that run is read, not merged.

**DEF-074 (DL-344 (4)): Sev-3, type Test, product not excluded, not a G8 blocker for now.** Scope: the case by title, at any width. **Cause step:** the developer adds a spec-local diagnostic to `tests/e2e/estimate-form.spec.ts` only, in the form of the AQP-343 one. When the "Row deleted" wait fails it prints: the DELETE request's status and time (or "no answer"), the PATCH requests before it with their revisions, the notices and live regions on screen, and the tree as rendered. The listener is set before the click. No assertion, budget, retry or timeout is changed, no case is added, nothing under `tests/e2e/support/`, config or `src/` changes; it merges on section 9 item 1. **Reading on 16.4.6:** after it merges (a real new `master` commit) the orchestrator updates #632's branch once and that run is read for the diagnostic; it is not merged unless (3) holds. On 16.4.5 the diagnostic stays until G8 and is read on every run.

**Outcomes, set in advance (DL-344 (4)).** **A 409 `TREE_CHANGED`, or any refusal at :202, is a regression of SQR-01 (b): it comes to master at once** and is graded against test plan section 6 (a wrong "changed by someone else" for the person's own typing). **No answer within 15 s on 16.4.6 only** is the version, and it stays with #632 post-G8; the gzip change is the lead to read first. **A failure on 16.4.5 at any time comes to master.** **Lane:** the next lane that frees after the released CR-01 stories (7D AQP-401, and 3D, which holds lane 3) have theirs (DL-337 (6)); it never takes a lane promised to a CR-01 story; due before the freeze, so that a product race is found or excluded before the final regression. **Pre-G8 list:** DEF-074 on "open, not blocking, listed"; RISK-035's note (DL-320's "the fasteners failure on 16.4.6 may be a product fault") is read at G8 together with DEF-074's outcome.

**QA's questions in the file's "For master" section are answered or overtaken:** item 1 (route and order for DEF-074 and #632): DL-344 (3) and (4); item 2 (whether `:188` counts against DEF-040's closing proof): not answered in DL-344 as read by QA; QA keeps it out of the DEF-040 proof (not a DEF-040 signature by text) and asks again below; item 3 (the proof line): not set; QA's proposal stands until master rules.

**For master (2026-11-23, DL-344).** 1. DEF-074's proof line is QA's proposal (P1 attempt-1 pass at three widths on the fix PR's run and on the first `master` push after it, each under 25 s; watch to G8); the fix is a diagnostic first (DL-344 (4)), and whether the Bug closes on a diagnostic merge plus a later cause is yours to set. 2. Does a `:188` failure on `master` (16.4.5) count against DEF-040's closing proof? (Not one so far: 17 runs, 0 failures on 16.4.5.)

## DL-345 (master, 2026-11-23): the proof by outcome, the lane, and the DEF-040 reopen trigger (QA's record; no ruling made here)

**(A) `:188` and DEF-040's proof.** DL-338 (7) closes DEF-040 on "no DEF-040 signature", which is the "Part renumbered to" wait with the `[AQP-343 renumber diagnostic]`; proofs are bound by file and title and do not widen after the result (DL-257, DL-165). **A `:188` failure is not counted against DEF-040's closing proof.** **But the two share a path** (`:188`'s delete goes through the same `change()` that #652 fixed), so **DEF-074's diagnostic (DL-344 (4)) also prints, within its watch, whether #652's in-flight status was on screen, whether the trigger and the Move controls were `aria-disabled`, and whether a time-limit Notice appeared.** **Reopen trigger (binding on QA): if a `:188` failure's diagnostic shows a tree change left with no in-flight sign, or `busy` still set past #652's time limit (20 s), or no Notice after it, that is a failure of DEF-040's fix: QA reopens DEF-040 as Sev-2 (type Product (client)) the same day, whatever its proof reads, and it comes to master.** This is recorded in the DEF-040 file as well.

**(B) DEF-074's proof, by outcome (DL-345 (3)).** The diagnostic's merge does not close the Bug: the cause comes first (DL-344 (4)).

| Outcome of the cause step | What follows |
|---|---|
| **The cause is version-independent and a fix merges** | **P1:** attempt-1 pass at three widths on the fix PR's run of record **and on the first two `master` pushes after it** (the case is on the tree's change path, product is not excluded, and it is a section 9 item 2-adjacent area, as for DEF-069 and DEF-073). **P2:** each under 25 s. **P3:** if #632 takes its one way-back run (DL-344 (3)), `:188` passes attempt 1 at three widths there too. The diagnostic stays until G8, and the watch (any later attempt-1 failure of the case) stays until G8. |
| **The cause is 16.4.6 itself** (no answer on 16.4.6 only) | The Bug goes with #632 to post-G8. At G8 it is listed under "open, not blocking" as a post-G8 item tied to #632, and test plan section 6's rule for open Sev-3 applies. |
| **The cause is a refusal (409 or other) at :202** | It comes to master at once (DL-344 (4)), a regression of SQR-01 (b), graded against test plan section 6; the proof is set then with the grade. |
| **No failure is caught before the freeze (about 3 Dec)** | The Bug stays open, Sev-3, listed at G8 with its readings (0 on 16.4.5, 2 of 3 on 16.4.6). **It does not close on silence.** |

**(C) Lane (DL-345 (4)).** **Lane 2 is confirmed for the cause step** (7D AQP-401 holds lane 1, 3D AQP-406 holds lane 3). If 7D cannot proceed for long and lane 2 frees first, the lane stays with whatever holds it; no reshuffle. The cause step is a spec-local diagnostic in `estimate-form.spec.ts` only (DL-344 (4)), extended by (A): it also prints the in-flight status on screen, the `aria-disabled` state of the trigger and the Move controls, and any time-limit Notice.

**For the record (DL-345 (5)):** RISK-031's remaining close-out items are (ii) DEF-070 (#653) and (iv) DEF-072's half 2, then (iii), a clean `master` push containing them all. (QA's note: DEF-072 was closed on 2026-11-23 on P1 and P2 read on PR run 45158142007 and on the first `master` push 45164384066 (DEF-072 file, "Verification"); if "half 2" means a different reading, QA asks master which.)

**For master.** The two questions of the earlier "For master" section are answered by DL-345 (A) and (B). None open.

## Reads after #658 (the delete diagnostic is live on `master`) and #632's one update (qa-engineer, 2026-11-23; Stage 12 job logs, ANSI stripped; no re-run)

**The case moved.** #658 added the diagnostic to `estimate-form.spec.ts`, so the SQR-01 (b) case ("... the part can still be deleted at once ...") is now at `:422` (was `:188`); QA binds it by title.

| Run | Branch, Next | SQR-01 (b) attempt 1 (mobile / tablet / desktop) | `[AQP-417 delete diagnostic]` lines |
|---|---|---|---|
| **`master` push CI run 45200030493** (b85b2aa9, #658's squash; every job `success`, 0 flaky, 0 failed) | `master`, Next 16.4.5 | 10.1 / 7.4 / 7.2 s | 0 (no failure) |
| **#632's one update, CI run 45200124686** (head 0364a633, net diff `package.json` and `package-lock.json` only; every job `success`; shards `552 / 535 / 555 / 549 passed`, 0 flaky, 0 failed; Stage 11 `645 files, 16408 tests`, 0 five-second cuts) | `chore/AQP-1-next-16.4.6-vitest-5.1`, **Next 16.4.6**, Vitest 5.1.0 | **10.8 / 9.4 / 9.6 s** | 0 (no failure) |

**Reading.** On #632's branch (16.4.6) the case **passed on attempt 1 at all three widths** this time; it had failed on 2 of 3 earlier runs there (45157657813, 45171635228). There is no failure, so there is **no diagnostic content to read** (no DELETE status or time, no PATCH revisions, no in-flight line, no `aria-disabled` state, no Notice), and **no DL-344 (4) outcome is pointed to**; the DL-345 reopen trigger for DEF-040 (a `:188` failure whose diagnostic shows #652's feedback missing) is not fired. Per DL-344 (3), a pass with no cause named does not bring #632 back, and #632's run is read, not merged. **DEF-074 stays open** (Sev-3; DL-345 (B): "no failure caught before the freeze" leaves it open and listed; it does not close on silence). Counts, by QA: SQR-01 (b) attempt-1 failures on 16.4.6: 2 of 4 runs (45125512077 passed, 45157657813 and 45171635228 failed, 45200124686 passed); on 16.4.5: 0.
