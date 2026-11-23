# DEF-065: Part form treatments: a flag chosen then unchosen (or the reverse) within one save round trip is not sent; the screen and the stored value disagree

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.06 (AQP-314, Surface Treatments and Treatment / Color), **AC-1** ("selected = 1, not selected = 0 stored per flag"). Also touches STORY-05.03's save path (`commit`) and the calculation and export that read the stored flag (FR-049) |
| Severity | **Sev-2 Major** (qa-engineer, 2026-11-22, test plan section 6). Reason below |
| Priority | **P2**. Lane: hardening window (CLAUDE.md section 9 item 3); behind any Sev-1, ahead of Sev-3. **Blocks G8** until fixed and verified |
| Type | **Product** |
| Status | **Open: fix in review, PR #633 (head 43b6366f, CI run 45100288884)** (logged 2026-11-22; see "State 2026-11-23") |
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
| Fixed | developer | | |
| Regression test added (red on master first) | developer | | |
| Verified | qa-engineer | | |

## State 2026-11-23 (qa-engineer; DL-319 P1 to P6; DL-321)
- **Fix:** PR #633 (`fix/AQP-407-flag-toggle-lost-update`, head 43b6366f): `settledValue()` (the value on its way, else the held one) used by `commit`, `autosaveField` and the unsaved mark in `setText` (`differsFromSettled`); the on-its-way entry is cleared by the field's latest ticket. The PR shows P1 red on the base (8 failed of 24) and green after (24 passed). QA has not read CI run 45100288884 for this note; the combined review (DL-319 (5)) and P2 to P6 are open.
- **Second occurrence of the mechanism, on a text field with a default (new evidence):** `estimate-form-sections.spec.ts:194` [mobile] "AC-3: clearing Fasteners shows "None" again" failed attempt 1 on PR #632's run 45097669695 (30.2 s, the `nextSave` at :200 never answered; retry 9.8 s). QA hook run (project harness, scratch file not committed): first save of "M6 bolt" held, then S cleared: **`master`** sends one request, the server keeps "M6 bolt", the screen shows "None"; **#633's head** sends both and the server ends with no value. #633 cures it in the hook run. The case is part of P6 (attempt-1 green at three widths on #633's run of record).
- **Site `syncWatchers` (:376), P5:** #633 leaves it alone ("heldRef is current when it compares"). QA's hook run shows a repeat of an unchanged watcher save when the watcher is typed within the watched field's round trip, on master and on #633: that is DEF-066 (Sev-4, no wrong data), recommended into #633 for the combined review to rule on.
- **DEF-038 (AQP-341):** classified Test on #632's run 45097669695 (see its file). `estimate-fasteners.spec.ts:151` is **not** a DEF-065 failure and #633 does not cure it. P6's wording ("`:151` passes on attempt 1 at all three widths and 0 diagnostic lines on the run of record") needs DEF-038's test-only fix as well as #633.
