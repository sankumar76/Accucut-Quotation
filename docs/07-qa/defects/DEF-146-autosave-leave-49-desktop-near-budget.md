# DEF-146: estimate-autosave-leave.spec.ts:49 [desktop] (AC-7a to AC-7c) runs 14 to 30 s at attempt 1 and has timed out outside a ruled wave: DL-267's Bug line met (Test; Sev-3; Jira AQP-503, GitHub #834)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.10 (autosave on hide and on leaving), AC-7a to AC-7c; RISK-031 (time-out mode); the DEF-085 family (the same page's part-form wait) |
| Severity | **Sev-3 (DL-267's Bug line); not a G8 blocker on its own** |
| Priority | P3 (Jira Medium; labels `sev-3`, `test`, `near-budget`) |
| Type | **Test** (a spec case that runs too close to its 30 s budget) |
| Status | **VERIFIED and CLOSED 2026-11-27 (qa-engineer, on `f7b20eff`, the squash of #835): the split's three cases pass attempt 1 at all three widths at normal draws, worst 6.0 s against the 25 s line. Jira AQP-503 Done, GitHub #834 closed.** Earlier status: **Open, 2026-11-27. DL-466: the DL-430 split is AUTHORISED for lane 3 (no step at #806: QA's step check below); merge on a fully green run at 0 behind by the end of Wed 2 Dec, else G8 open, named.** |
| Jira / GitHub | [AQP-503](https://sankumar76.atlassian.net/browse/AQP-503) / [#834](https://github.com/sankumar76/Accucut-Quotation/issues/834) (labels bug, sev-3, ai-delivery; Jira also aiid-DEF-146, agent-qa-engineer, test, near-budget). Searched first: JQL on `aiid-DEF-146` and 'autosave-leave': no earlier Bug for this case. |
| Found by / date | qa-engineer, 2026-11-27, counting the logs since #800 (the case went on the near-budget watch with `d35ad821`, test plan 0.3.127) |
| Build / commit | `master` `60ca5a08` (CI 45998716995), shard 3, [desktop]; the logs listed below |
| Environment | CI, `next dev` |

## DL-267's line, [desktop], since #800
**Attempt-1 time-out OUTSIDE a ruled wave:** `60ca5a08` (#806): **30.3 s**, `expect(locator('#part-field-...')).toBeEnabled()` (waiting for a part field; Test timeout of 30000ms exceeded); the retry passed in 24.1 s. Shard 3 read 1.50 (first-4-minute 1.49, margin 0.09 over the next shard: the margin test fails, NOT a ruled wave; shard 3's last five readings 1.50, 1.12, 1.43, 1.37, 1.56 make it persistently slow by DL-450 (A), so its time-outs count as outside a wave). (`d35ad821`: both attempts at 30 s on `page.reload()` at spec line 76, INSIDE a ruled wave at 1.53 / 0.37 / 1.49.) **Passing attempt-1 readings of 25 s or more:** 28.6 s (#800's run of record), 25.0 s (`1b30b17f`), 26.8 s (#812's run), 25.4 s (`864ecb0f`), 30.0 s (`f9695aa7`): five. **MET.**

## Attempt-1 durations ([desktop] / [tablet] / [mobile], s)
`c30b349f` 18.7 / 20.2 / 14.1; `0cce6691` 18.6 / 14.5 / 22.1; `d5e352f9` 17.3 / 16.6 / 19.2; `7753cdff` 18.7 / 13.0 / 15.4; `2e11c44d` 17.2 / 15.6 / 14.9; `1b30b17f` **25.0** / 17.9 / 19.6; `73143e7e` 24.0 / 20.0 / 17.0; `ffd02f7d` 19.6 / 20.3 / 17.2; `e0153858` 19.2 / 15.0 / 22.0; `c83e57b0` 21.8 / 13.7 / 22.2; `d35ad821` **time-out, both attempts (30 s)**; `a51103e0` 22.6 / 19.3 / 23.1; `864ecb0f` **25.4** / 26.2 / 18.9; `3c561ce1` 23.1 / 17.6 / 17.8; `f9695aa7` **30.0** / 14.4 / 13.6; `9eb8409b` 23.5 / 25.2 / 21.5; `635e7f7a` 24.6 / 19.4 / 13.3; `7aa23c44` 18.9 / 15.2 / 19.6; `60ca5a08` **30.3 (time-out; retry 24.1)** / 23.6 / 16.7; #800's run 28.6 / 19.2 / 25.4; #812's run 26.8 / 17.9 / 19.9. On a normal draw the case takes 17 to 25 s on [desktop]; the readings rise with the draw.

## Product question
The case runs on the Engineer's form, so DEF-141's Lead-page cause does not apply, and no step at a squash was found. The wait that timed out in `60ca5a08` is the part field being enabled, the same page wait as the DEF-085 family (four `form[data-part-form]` 15 s misses in shard 4 of the same run, at 1.00). QA reads it as a long case near its budget plus the form's slow first render in `next dev`; master rules whether a product cause is suspected.

## Fix (to be authorised)
A test-only split on DL-430's terms: every assertion kept, in the original order, on one page (a serial pair on a shared page if needed); each case under 25 s at a normal draw (1.10 or less) on attempt 1 at all three widths; the person ledger stays at +0 (DL-422); the PR body maps each assertion before and after; no wait, `force`, retry or budget change; no time-out raised (DL-404). Due by the end of Wed 2 Dec if authorised; else it stays on the watch and goes to G8 open, named.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Master's ruling: authorise the split or hold | master | 2026-11-27 | DL-466 (authorised, no step at #806) |
| Split PR | developer (lane 3) | 2026-11-27 | #835 squashed as `f7b20eff`; one file, `tests/e2e/estimate-autosave-leave.spec.ts`, +30 -8 |
| Verified | qa-engineer | 2026-11-27 | CI 46007880263 on `f7b20eff`, see the section below |

## Records
Jira Bug AQP-503 and GitHub issue #834, created 2026-11-27 and cross-linked; test plan 0.3.142.

## DL-466 step check: is there a step at #806 (`60ca5a08`)? (qa-engineer, 2026-11-27; read only, existing logs; test plan 0.3.143)
**Why:** #806 changed `use-part-form.ts` (+13) and `part-fields.tsx` (+9), the shared form state and autosave that this case exercises, and the failing push is its own squash; a product cause must be ruled out before the split (DL-449 (3)(e), DL-466 (3)).
**(1) The five readings of 25 s or more ([desktop], attempt 1), with date and commit (all UTC, 27 Nov 2026):** **28.6 s** #800's run of record (CI 45922705204, head `6aa4dfbd`, created 01:27Z, a PR run); **25.0 s** `1b30b17f` (#818, 04:17Z); **26.8 s** #812's run (CI 45945851576, head `dae95c35`, 05:26Z, a PR run); **25.4 s** `864ecb0f` (SCR-17, 08:40Z); **30.0 s** `f9695aa7` (#829, 09:41Z). **All five PREDATE #806 (`60ca5a08`, 12:26Z)**; three are on pushes that carry none of #806's code.
**(2) Attempt-1 durations at every width on the last five `master` pushes before `60ca5a08`, against `60ca5a08`, with the draw of the shard that carries the project (duration / draw in brackets):**
| Push | [desktop] s (shard 3 draw) | [tablet] s (shard 2) | [mobile] s (shard 1) |
|---|---|---|---|
| `3c561ce1` | 23.1 (1.23) [18.8] | 17.6 (1.25) [14.1] | 17.8 (0.92) [19.3] |
| `f9695aa7` | 30.0 (1.56) [19.2] | 14.4 (1.01) [14.3] | 13.6 (0.71) [19.2] |
| `9eb8409b` | 23.5 (1.37) [17.2] | 25.2 (1.54) [16.4] | 21.5 (1.03) [20.9] |
| `635e7f7a` | 24.6 (1.43) [17.2] | 19.4 (1.32) [14.7] | 13.3 (0.71) [18.7] |
| `7aa23c44` | 18.9 (1.12) [16.9] | 15.2 (1.08) [14.1] | 19.6 (0.92) [21.3] |
| **`60ca5a08` (#806)** | **30.3 time-out, retry 24.1** (1.50) [20.2; retry 16.1] | 23.6 (1.59) [14.8] | 16.7 (0.83) [20.1] |
**Later pushes: none yet (no `master` push since `60ca5a08`).**
**(3) Reading: NO STEP AT #806.** Normalised by the draw, [tablet] (14.1 to 16.4 before; 14.8 after) and [mobile] (18.7 to 21.3 before; 20.1 after) are level; [desktop] ran 16.9 to 19.2 before and 20.2 at `60ca5a08`'s attempt 1 (a one-sample rise of about 5 % over the highest earlier figure, `f9695aa7`'s 19.2, which also sits before #806), and its retry ran 16.1, level with the earlier pushes. The readings of 25 s or more all predate #806 and rise with the draw. **QA's caveats:** one attempt-1 sample on [desktop]; the timed-out wait was a part field being enabled (the form's first render in `next dev`, the same family as the DEF-085 misses in shard 4 at 1.00 of the same run); QA read no profile of #806's `use-part-form.ts` change, so lane 2's read of that file for added work before the field is enabled is still a prudent follow-up, but the durations do not call for it. **Per DL-466 (3) 'no step at #806': the split is authorised for lane 3, on DL-430's terms (every assertion kept in order on one page, each case under 25 s at a normal draw on attempt 1 at all three widths, +0 person ledger, no wait/force/retry/budget/time-out change, the PR body maps each assertion), merged on a fully green run at 0 behind by the end of Wed 2 Dec; if not merged by the freeze, DEF-146 goes to G8 open and is named.** QA re-reads the case after #806's neighbours land and reports a step if one appears.


## VERIFIED and CLOSED on `f7b20eff` (qa-engineer, 2026-11-27; test plan 0.3.145)
Read: CI 46007880263 (`master` push, run_attempt 1, `success`), the shard 3 log (`[desktop]` and `[tablet]`) and the shard 1 and 2 logs. Draw (matched per-test median against 31015cce): shard 1 0.76, shard 2 0.95, shard 3 1.07, shard 4 0.92: normal, no wave ruled.

| Case | [desktop] | [tablet] | [mobile] |
|------|-----------|----------|----------|
| A `:70` (AC-7a, AC-7c: saved at once when the tab is hidden) | 6.0 s | 4.4 s | 4.4 s |
| B `:87` (AC-7b: saved at once when the page is left) | 0.99 s | 0.84 s | 1.2 s |
| C `:96` (after a reload the last value is there) | 5.9 s | 2.8 s | 4.0 s |

All nine passed on attempt 1 (no retry marker). DL-430's terms: every case under 25 s at a draw of 1.10 or less on attempt 1 at all three widths (met, worst 6.0 s); every assertion kept in its order and no timeout, wait, force, retry or budget set or changed (QA read `gh pr diff 835`: one file, comments and the split only); person ledger +0 (test-only). The old case read 14 to 30 s on [desktop] (five readings of 25 s or more, all before #806). Nothing in this defect needed a product change.

Jira AQP-503 moved to Done and GitHub #834 closed (not planned: none; completed) on this proof. Windows package 46007880261 on the same push: still in progress when this was written (the install steps; the result follows in 0.3.146) (not part of DEF-146's proof).