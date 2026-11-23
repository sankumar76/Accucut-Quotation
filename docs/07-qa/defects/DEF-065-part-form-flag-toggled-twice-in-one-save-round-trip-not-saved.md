# DEF-065: Part form treatments: a flag chosen then unchosen (or the reverse) within one save round trip is not sent; the screen and the stored value disagree

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.06 (AQP-314, Surface Treatments and Treatment / Color), **AC-1** ("selected = 1, not selected = 0 stored per flag"). Also touches STORY-05.03's save path (`commit`) and the calculation and export that read the stored flag (FR-049) |
| Severity | **Sev-2 Major** (qa-engineer, 2026-11-22, test plan section 6). Reason below |
| Priority | **P2**. Lane: hardening window (CLAUDE.md section 9 item 3); behind any Sev-1, ahead of Sev-3. **Blocks G8** until fixed and verified |
| Type | **Product** |
| Status | **Verified and Closed 2026-11-23** (fix merged: PR #633, `master` d2771045; see "Verification 2026-11-23"). Logged 2026-11-22 |
| Jira / GitHub | [AQP-407](https://sankumar76.atlassian.net/browse/AQP-407) / [#631](https://github.com/sankumar76/Accucut-Quotation/issues/631) (opened by the lane-3 developer as a `follow-up`; QA added `bug` and `sev-2`). Jira "relates to" AQP-314 (STORY-05.06) and AQP-1 (Intake). Labels `ai-delivery`, `aiid-DEF-065`, `sev-2`, `final-review`, `agent-qa-engineer`; priority High |
| Risk / rule | No re-run rule (it is a product fault, not a CI timing case). Not a RISK-031 event. DEF-064 is reserved by DL-305 for the Mailpit race, so this Bug takes the next free number (JQL `project = AQP AND labels in (aiid-DEF-064, aiid-DEF-065, aiid-DEF-066, aiid-DEF-067)` returned no issue on 2026-11-22 before AQP-407 was created) |
| Found by / date | Lane-3 developer, while fixing #513 (PR #630, E2E timing prep for Next 16.4.6); graded and reproduced by qa-engineer, 2026-11-22 |
| Build / commit | `master` 444d10b7 (`use-part-form.ts` unchanged from the records branch's base) |
| Environment | Hook level (Vitest, Node), the project's `tests/support/hook-harness.ts` and `tests/support/part-server.ts`; invented data only. Real-browser reproduction by the developer's planted delay, as described in #631 (not re-run by QA: no full E2E locally, CLAUDE.md section 9 item 5) |

## Steps to Reproduce
Hook level (what QA ran; the scratch file is not committed, the shape is below):
1. Open `usePartValues` over one flag field `p` (rule `flag`, `defaultValue: '0'`), with the invented part server holding nothing for `p`.
2. Hold the next save (`partServer.holdNextSave()`).
3. Do what `part-fields.tsx` `onToggle` does, twice, with no waiting in between: `form.setText('p', '1'); form.commit(P, '1');` then `form.setText('p', '0'); form.commit(P, '0');`.
4. Release the held save, `await gate.settle()`, read `partServer.sent`, `partServer.inputs` and the form's `texts`.
5. Mirror: start with `p: '1'` stored, toggle OFF then ON.

In the browser (the developer's method, #631): an init script wraps `fetch` with a 600 ms wait for `/inputs`; in `estimate-treatments.spec.ts` "AC-1" choose Primer, then unchoose it. The second PATCH is never sent. It also happens with no plant when the answer is late (slow link, busy server).

## Expected Result
The last choice is what the server holds, whatever the timing: ON then OFF ends with no `1` stored for the flag; OFF then ON (from stored `1`) ends with `1`. Screen and server agree.

## Actual Result
The second choice is dropped; the server keeps the first and the screen shows the second. Both directions fail:

| Case | Requests sent | Server holds | Screen shows | `gate.isDirty()` |
|---|---|---|---|---|
| ON then OFF, nothing stored | one: `{revision:1, values:{p:'1'}}` | `p = 1` | off | false |
| OFF then ON, `p = 1` stored | one: `{revision:1, values:{p:'0'}}` | `p = 0` | on | not read |
| Control: ON, answer handled, then OFF | two | `p` off | off | - |

`gate.isDirty()` false means the page's 30-second save does not tick (`use-autosave.ts`: `!gate.isDirty()` returns), so nothing heals it. Save draft (`sendAgain('draft')` calls `commit(field)` with the text, which differs from the stored `1`) or a reload shows and mends it, but only for a person who suspects it.

## Evidence
Run on `master` 444d10b7 with `node vitest.mjs run` on a throwaway file `tests/unit/zz-def065-scratch.test.ts` (moved out of the worktree, never committed): `Tests 2 failed | 1 passed (3)`.

```
ON->OFF sent [{"revision":1,"values":{"p":"1"}}] server {"p":"1"} screen 0 dirty false
OFF->ON sent [{"revision":1,"values":{"p":"0"}}] server {"p":"0"} screen 1
control sent ... server correct  (passed)
AssertionError: expected '1' to be '0'   (ON then OFF)
AssertionError: expected '0' to be '1'   (OFF then ON)
```

Test shape (for the developer to start from; it uses only the two support files and the mocks already in `tests/unit/use-part-values.test.ts`):

```ts
const P: FormField = { id: 'p', letter: 'P', label: 'Flag p', kind: 'input', unit: null, hint: null, defaultValue: '0', required: false, editable: true, visibleWhen: null, rule: { type: 'flag' } };
const toggle = (form, on) => { const t = on ? '1' : '0'; form.setText('p', t); form.commit(P, t); };
// open({}) ; const release = partServer.holdNextSave(); toggle(form, true); toggle(form, false); release(); await gate.settle();
// expect(partServer.inputs['p'] ?? '0').toBe('0')   // fails on master: server holds '1'
```

Code read at `origin/master` 444d10b7, `src/components/features/estimate-workspace/use-part-form.ts`: `commit()` line 322 compares with `heldRef.current` only; `heldRef` is set at the end of `send()` (line 299), after the answer; `queueSave()` (line 329) has its own dedupe on `onItsWayRef` but is never reached for the second choice.

## Suspected Area
`use-part-form.ts` `commit()` :322. The same stale-held compare appears at `autosaveField` :350, `differsFromHeld` :159 (it unmarks the field on the gate, which is why the 30-second save stays silent) and `syncWatchers` :376. The developer reads each; QA has shown the defect only for `commit()`.

## Why Sev-2 (test plan section 6)
- **Not Sev-3** ("wrong wording or state that does not mislead about a price"): this misleads about a price. The stored flag feeds the calculation and the export, and the part form shows the opposite of what is saved, with no message, no unsaved mark and no later automatic correction.
- **Not Sev-1** (a wrong total in a case with a stated expected value; an approved estimate changing; data loss; a bypass): no stated CE case covers it, nothing approved changes, no Engineer sees a cost (NFR-002 is untouched), and the person can see the wrong flag on a reload or mend it with Save draft.
- **Sev-2** ("an AC fails with a workaround"): AC-1's stored 1 / 0 outcome fails in a reachable timing window, and the workaround is only a manual re-read. Likelihood is low to moderate: it needs two choices inside one save round trip (a quick double tap of a checkbox, or any slow answer); Next 16.4.6's gzip of route-handler responses makes the window wider (developer's note, #631).
- The developer graded Sev-3 "by data reach (one optional flag, visible at once on reload)". QA agrees on the reach and disagrees on the grade: the harm is that the wrong value is not visible on the screen the person is using.
- Gate effect: a Sev-2 is fixed before G8 (CLAUDE.md section 9 item 3); no waiver without the delivery lead's word.

## Fix route (developer; QA does not fix production code)
The developer's proposal in #631, which QA agrees with: in `commit()`, compare the choice with **the value already on its way** (`onItsWayRef.current.get(field.id)`) before `heldRef`, so a choice that differs from what is queued is queued too (`queueSave` and the ticket then make the earlier one out of date and send the later one with the revision the earlier one made). Points to keep right:
- A repeat of the default must still send nothing (`tests/unit/fasteners-none-requests.test.ts`; STORY-05.04 AC-3, STORY-05.05): when nothing is on its way the compare is as before.
- Read `autosaveField`, `differsFromHeld` and `syncWatchers` for the same compare, and decide for each whether it needs the same change.
- Test-only changes to `tests/unit/use-part-values.test.ts` are the developer's; QA does not write the proof for them.

## Proof needed (binding)
1. **A unit test that fails on `master` before the fix**: `tests/unit/use-part-values.test.ts` (hook harness, `partServer.holdNextSave()`), both directions (ON then OFF from nothing; OFF then ON from stored `1`), asserting the server value, the screen text and the requests sent. The PR shows it red on the base commit (or a commit-1 red run) and green with the fix.
2. The whole unit and integration suites green; `fasteners-none-requests` and the autosave tests (`estimate-autosave*.test.ts`) unchanged and green.
3. CI green on the PR run of record; the E2E `estimate-treatments.spec.ts` attempt-1 green at all three widths (QA reads the run; no local E2E). The developer's #630 settle-wait stays; this fix does not depend on it.
4. QA verifies by rerunning the new test and the regression around it (not by reading the diff), then closes.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-22 | PR #633 squash `d2771045` (`use-part-form.ts`: `settledValue`, ticket-based clear, adopt-path and `send` guards) |
| Regression test added (red on master first) | developer | 2026-11-22 | `tests/unit/use-part-values.test.ts` describe "AQP-407: a flag toggled twice within one save round trip" (+ `failAfterHold()` in `tests/support/part-server.ts`); red on `444d10b7`'s hook, green on `d2771045` (QA rerun below) |
| Verified | qa-engineer | 2026-11-23 | see "Verification 2026-11-23" |

## State 2026-11-23 (qa-engineer; DL-319 P1 to P6; DL-321)
- **Fix:** PR #633 (`fix/AQP-407-flag-toggle-lost-update`, head 43b6366f): `settledValue()` (the value on its way, else the held one) used by `commit`, `autosaveField` and the unsaved mark in `setText` (`differsFromSettled`); the on-its-way entry is cleared by the field's latest ticket. The PR shows P1 red on the base (8 failed of 24) and green after (24 passed). QA has not read CI run 45100288884 for this note; the combined review (DL-319 (5)) and P2 to P6 are open.
- **Second occurrence of the mechanism, on a text field with a default (new evidence):** `estimate-form-sections.spec.ts:194` [mobile] "AC-3: clearing Fasteners shows "None" again" failed attempt 1 on PR #632's run 45097669695 (30.2 s, the `nextSave` at :200 never answered; retry 9.8 s). QA hook run (project harness, scratch file not committed): first save of "M6 bolt" held, then S cleared: **`master`** sends one request, the server keeps "M6 bolt", the screen shows "None"; **#633's head** sends both and the server ends with no value. #633 cures it in the hook run. The case is part of P6 (attempt-1 green at three widths on #633's run of record).
- **Site `syncWatchers` (:376), P5:** #633 leaves it alone ("heldRef is current when it compares"). QA's hook run shows a repeat of an unchanged watcher save when the watcher is typed within the watched field's round trip, on master and on #633: that is DEF-066 (Sev-4, no wrong data), recommended into #633 for the combined review to rule on.
- **DEF-038 (AQP-341):** classified Test on #632's run 45097669695 (see its file). `estimate-fasteners.spec.ts:151` is **not** a DEF-065 failure and #633 does not cure it. P6's wording ("`:151` passes on attempt 1 at all three widths and 0 diagnostic lines on the run of record") needs DEF-038's test-only fix as well as #633.

## Verification 2026-11-23 (qa-engineer; `master` d2771045 = PR #633 squash; run of record 45103803921)
Method: QA reran the tests (not read the diff). A clean copy of `master` d2771045 (`git archive`) in the session scratchpad, with the project's `node_modules` linked, run with `node node_modules/vitest/vitest.mjs run` (Vitest 5.1.0 in the linked `node_modules`, the version of #632, not master's pinned one; the files run are test-only and hook-level). No worktree was written; the copy is not committed.

| Proof (this file's "Proof needed") | Evidence | Result |
|---|---|---|
| 1. A unit test red on the base, both directions, asserting server value, screen text and requests sent | `use-part-values.test.ts` at d2771045: `Tests 34 passed (34)`; with the hook put back to `444d10b7`'s and the merged test file kept: `use-part-values` + `fasteners-none-requests` **16 failed, 21 passed (37)**; the 16 include ON then OFF and OFF then ON, each "at once" and "while the first save waits", the two "with the first request in flight" cases, the four-choices case, the two "typed back to what the server holds" cases, the two QLT-03 cases and the "Fasteners cleared" pair | **Pass** |
| 2. Whole suites green; `fasteners-none-requests`, `estimate-autosave*` unchanged and green | Local, 9 files at d2771045 (`use-part-values`, `fasteners-none-requests`, `estimate-autosave`, `estimate-autosave-part`, `part-conflict`, `save-gate`, `save-gate-dirty`, `part-form-lazy`, `part-completeness`): `Test Files 9 passed (9)`, `Tests 117 passed (117)`. CI run of record 45103803921, `Stages 1 to 11b` (job 137460556407) success: Stage 6 unit `473 files`, `10603 passed`; Stage 11 integration `637 files`, `16220 passed`. A local full `tests/unit` run in the archive copy is **not** counted: it fails in files that need `.git`, the generated Prisma client or the environment (for example `english-only`, `env-example`, `prisma-singleton`), which a `git archive` copy does not have | **Pass** (CI for the full suites; local for the related files) |
| 3. CI green on the run of record; `estimate-treatments.spec.ts` attempt-1 green at three widths | Run 45103803921, attempt 1, head 84052624 (up to date), conclusion `success`, 6 of 6 jobs success, required check "Stages 1 to 11" present. `estimate-treatments.spec.ts:88` (AC-1, the flag case) attempt-1 `✓` at mobile (no. 322), tablet (455), desktop (94). The only `✘` and the only `(retry #1)` in the whole run is `cost-details.spec.ts:152` [tablet] (DEF-069, not part-form) | **Pass** |
| P6 (DL-319): 0 `[AQP-341 stored-values diagnostic]` lines; "back to None" (`estimate-fasteners.spec.ts:151`) and "clearing Fasteners shows None again" (`estimate-form-sections.spec.ts:194`) attempt-1 green at three widths | `grep -c "stored-values diagnostic"` over the full run log (11,895 lines, all jobs): **0**. `:151` attempt-1 `✓` mobile (240), tablet (373), desktop (13); `:194` attempt-1 `✓` mobile (257), tablet (390), desktop (29) | **Pass** |
| QLT-01 of the combined review (a 409 that adopts the other tab's value must not let the queued second choice overwrite it) | The two QLT-01 tests (flag; number) pass at d2771045. Sensitivity: with the hook at `43b6366f` (the head the review found it on) `use-part-values` is `7 failed, 27 passed (34)` and the two QLT-01 tests are among the 7 (the others: QLT-03 x2, DEF-066 x3), as the review stated | **Pass** |
| Other review shapes | QLT-02 (ticket-based clear after a lost first save) and QLT-03 (a superseded failed save does not leave the field marked) tests pass at d2771045; the QLT-02 test is not among the failures at `43b6366f` and is the one that catches the value-based clear (reviewer's check; QA did not re-plant it) | Pass (as stated) |
| `master` push run on d2771045 (run 45110218895; Windows package 45110218896) | Finished 2026-11-23 (QA read the full log, 12,088 lines). **CI: `failure` only because `Stages 1 to 11b` failed at Stage 11 on DEF-064** (`daily-digest.test.ts` Mailpit 404; the fan-in `Stages 1 to 11` red on `RESULT_VERIFY: failure`). **All four Stage 12 shards success, 0 flaky, no `✘` and no retry**: `548 passed (20.5m)`, `542 passed (14.8m)`, `545 passed (14.8m)`, `529 passed (18.0m)`. `estimate-fasteners.spec.ts:151`, `estimate-form-sections.spec.ts:194` and `estimate-treatments.spec.ts:88` attempt-1 `✓` at mobile, tablet and desktop; 0 `[AQP-341 stored-values diagnostic]` lines | Pass for this fix (the E2E half is green on `master`); the red Stage 11 is DEF-064 |

Not shown by QA: a real-browser reproduction (no local E2E, CLAUDE.md section 9 item 5; the E2E evidence is the CI run above). The Stage 11 failure on the push run (DEF-064, the Mailpit race) is unrelated to this fix.

**Result: verified. DEF-065 is closed.** (The P1 to P6 conditions of DL-319 are all met on the run of record; DEF-038's test fix (#636) is a separate item and is not a condition of closing DEF-065.)
