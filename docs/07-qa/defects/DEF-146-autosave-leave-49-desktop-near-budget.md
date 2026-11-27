# DEF-146: estimate-autosave-leave.spec.ts:49 [desktop] (AC-7a to AC-7c) runs 14 to 30 s at attempt 1 and has timed out outside a ruled wave: DL-267's Bug line met (Test; Sev-3; Jira AQP-503, GitHub #834)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.10 (autosave on hide and on leaving), AC-7a to AC-7c; RISK-031 (time-out mode); the DEF-085 family (the same page's part-form wait) |
| Severity | **Sev-3 (DL-267's Bug line); not a G8 blocker on its own** |
| Priority | P3 (Jira Medium; labels `sev-3`, `test`, `near-budget`) |
| Type | **Test** (a spec case that runs too close to its 30 s budget) |
| Status | **Open, 2026-11-27 (qa-engineer).** QA asks master to authorise a test-only DL-430 split (as for `approve.spec.ts:312`, DL-449 (3)(c)) and to say whether a product cause holds it (this is the Engineer's form, not a Lead page). |
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
| Master's ruling: authorise the split or hold | master | | |
| Split PR | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-503 and GitHub issue #834, created 2026-11-27 and cross-linked; test plan 0.3.142.
