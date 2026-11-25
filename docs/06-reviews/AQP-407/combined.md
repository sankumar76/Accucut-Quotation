# Review Report — AQP-407 (DEF-065) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (single combined security-and-quality review, CLAUDE.md section 9 item 2: a data-integrity fix) |
| Review round | 1 |
| Base…branch | `master` 444d10b7 … `fix/AQP-407-flag-toggle-lost-update` |
| Commit reviewed | 43b6366f473fcfd4bfdb66a8877e8171f6648e86 (PR [#633](https://github.com/sankumar76/Accucut-Quotation/pull/633)) |
| Date | 2026-11-22 |
| **Verdict** | **REQUEST CHANGES** |

## Summary
The fix is correct for the reported defect. Judging a choice against the value already on its way (`settledValue`) at the three compare sites is the right model. The tests fail on master for the right reason and pass on the fix. The ticket-based clearing in `queueSave` is also correct, and needed: a probe shows the old value-based clear loses ON, OFF, ON when the first save fails.

The change does open one new path. A second choice back to the held value is now queued. If the save ahead of it is answered 409 and the re-read **adopts** the other tab's newer value for that field, the queued save is still sent, so this tab's stale choice silently overwrites the other tab's value while the screen shows the adopted value. That is DEF-065's symptom (screen and server disagree, no mark, no message) reached through STORY-05.08 AC-6 ("nothing is overwritten unseen"). It passes on master and fails on this head (QLT-01). The fix is two lines in `reconcile`. The ticket-based clear also has no test that fails without it (QLT-02).

No security issue: no logging, no cost or rate path, NFR-002 untouched.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 1 |
| Major | 1 |
| Minor | 2 |
| Info | 4 |

## Checks Run
All local runs were in a private scratch copy of 43b6366f (`git archive` into the session scratchpad, with the project's `node_modules` linked). No worktree was written.

| Check | Command | Result |
|-------|---------|--------|
| PR tests and related unit files on the head | `node node_modules/vitest/vitest.mjs run` use-part-values, fasteners-none-requests, estimate-autosave, estimate-autosave-part, part-conflict, save-gate, save-gate-dirty, part-form-lazy, part-completeness | `Test Files 9 passed (9)`, `Tests 107 passed (107)` |
| Red before (hook reverted to 444d10b7, new tests kept) | same runner, `tests/unit/use-part-values.test.ts` | `Tests 8 failed \| 16 passed (24)`; the failing 8 are the 8 named in the PR. "three choices" and "same choice twice" pass on master (see QLT-04) |
| Probe P1 / P1b: 409 that adopts the field while a superseding save is queued (flag and number) | scratch `zz-probe.test.ts` | **Fails on the head** (P1: `sent [{rev1,p:1},{rev2,p:0}]`, server `p=0`, screen `1`, `isDirty` false; P1b: server `a=1.00`, screen `5.00`). **Passes on master** 444d10b7. Passes with the QLT-01 fix |
| Probe P2b: ON, OFF, ON; first save fails after the others queue; OFF while the third is in flight | scratch probe plus a 6-line hold-then-fail hook in the scratch `part-server.ts` | Passes on the head. **Fails with the old value-based clear** put back (server `p=1`, screen `0`). So the ticket clear is right, but nothing in the PR pins it (QLT-02) |
| Probe P3 / P3b: first save fails while a later different save is queued | scratch probe | Server and screen agree (`0` / `3.00`), but the field stays marked unsaved and in `unstored`. P3b fails the same way on master, so this is not new (QLT-03). Passes with the QLT-03 guard |
| Probe P4: first save succeeds, the superseding one fails | scratch probe | Field stays marked; the 30-second save heals it. Pass |
| Probe P5: the default chosen twice with nothing stored | scratch probe | No request. Pass ("a repeat of the default sends nothing" holds) |
| QLT-01 and QLT-03 fixes applied together in scratch | same 9 files + probes | All pass (P1, P1b, P3, P3b green; nothing else changed) |
| CI run of record | `gh pr checks 633` (run 45100288884) | **Stage 11 red** at `tests/integration/approval/approve.test.ts:339`. That test checks the approval record does not contain `600`, and the timestamp `…11.600Z` did. Time-dependent and unrelated to this diff; logged by QA as DEF-067 (QLT-07). E2E shards had not run yet |
| DEF-066 reproduction (QA steps: S, then T and U typed within the S round trip) | scratch `zz-def066.test.ts` | Fails on 43b6366f and on 444d10b7: 5 requests, `t` and `u` sent twice (QLT-06) |
| Type-check / lint | not re-run (the PR reports both clean; CI Stages 1 to 10 passed before Stage 11) | n/a |

## AC conformance

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| STORY-05.06 AC-1: "selected = 1, not selected = 0 stored per flag" (last choice stored, any timing) | `use-part-form.ts` `settledValue` :161, `commit` :332, ticket clear :346 | "AQP-407 …" describe (`use-part-values.test.ts` :258-396), both directions, at once and in flight | **Met** for one tab. **Not met** when the save ahead is answered 409 and the field is adopted (QLT-01) |
| STORY-05.08 AC-4: the unsaved mark guards leaving | `differsFromSettled` :167, used by `setText` :186 | "…still unsaved, so the 30-second save mends it" | Met. A stale mark can stay after a failed out-of-date save (QLT-03, not new, safe direction) |
| STORY-05.08 AC-6: nothing is overwritten unseen | `reconcile` :247 (unchanged) | SQR-01, SQR-02, SQR-13 tests (unchanged, green) | **Regressed** on the adopt path (QLT-01) |
| STORY-05.10 AC-1, AC-3: the 30-second save sends what is unsaved | `autosaveField` :362 | "…30-second save mends it"; estimate-autosave* (green) | Met |
| STORY-05.04 AC-3 / 05.05: a repeat of the default sends nothing | `commit` :332 (nothing on its way, so the compare is with the held value) | fasteners-none-requests (green); "a choice of the default with nothing on its way sends nothing"; probe P5 | Met |
| NFR-002: no cost or rate to the Engineer | no change to routes, services, responses or logging | diff read | Met (untouched) |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | **Critical** | `use-part-form.ts:332` (newly queued save), `:261-264` (`reconcile` adopt loop) | STORY-05.08 AC-6; STORY-05.06 AC-1; DEF-065 | A choice back to the held value is now queued. If the save ahead is answered 409 and `planAfterNewerPart` adopts the other side's value for the field (mine = held, other changed), `reconcile` shows the newer value but does not invalidate the queued save, which is then sent with the new revision | Another tab's or person's value is overwritten without being seen. The screen shows the adopted value, the server holds this tab's stale choice, no mark and no message: DEF-065's harm, on a new path. Verified: P1 and P1b fail on the head and pass on master | In the adopt loop: `newTicket(adoptedId); onItsWayRef.current.delete(adoptedId);`, as the conflict loop already does. Add P1 and P1b as tests |
| QLT-02 | **Major** | `use-part-form.ts:346`; `tests/support/part-server.ts` | Test adequacy; DEF-065 proof | The ticket-based clear (the guard for ON, OFF, ON) has no test that fails without it: all 24 tests pass with the old value-based clear put back | A later refactor can undo it unnoticed, bringing back a lost choice after a failed save (P2b: server 1, screen 0) | Add `failAfterHold()` to `part-server.ts` (6 lines, below) and test P2b |
| QLT-03 | Minor | `use-part-form.ts:300-302` (`send` → `explain`), via `:344` | STORY-05.08 AC-4; STORY-05.11 AC-7 | The failure of a save that a later save of the same field has made out of date is reported for the field (`mark` true, `unstored`, a problem). When the later save succeeds nothing clears it | Server and screen agree, but the field stays "unsaved": a false leave warning, the count leaves out a stored value, and the 30-second save finds nothing to send. Clears on Save draft or the next commit. Not new for text fields (P3b fails on master); now also reachable for flags | Only the field's latest save speaks for it: `if ((ticketsRef.current.get(fieldId) ?? 0) === ticket) explain(outcome, fieldId);`. Verified in scratch. Fix here, or open a `follow-up` issue for the hardening window |
| QLT-04 | Minor | `tests/unit/use-part-values.test.ts:334` | Test adequacy | "three choices in one round trip end with the last one" passes on master (master dedupes the third choice against the first). It proves nothing about the fix | False confidence in the ON, OFF, ON case | Replace it with P2b (QLT-02), or assert `sent` exactly and add a 4th choice that master gets wrong |
| QLT-05 | Info | `use-part-form.ts:332` | STORY-05.04 AC-3 | ON then OFF at once, from nothing stored, sends one `{p:'0'}` and stores `0` where nothing was stored | Same as the existing "answered, then OFF" path, so not a regression; the no-request rule still holds when nothing is on its way (P5) | Optional: when the save being superseded has not been sent, compare with the held value instead. Not needed for this fix |
| QLT-06 | Info | `use-part-form.ts:388-389` `syncWatchers` | STORY-05.05 AC-2, AC-3; DEF-066 (AQP-408, #634) | Left on `heldRef` on purpose. The PR's reasoning holds for the **stored data**: a skip loses nothing. It does not hold for the **request count**. The sync is queued right behind the watched save, so it runs before the watcher's own save queued after it, compares with `heldRef` (no T yet) and sends T directly. T's queued save, which still holds the latest ticket, then sends the same text again | **QA's DEF-066 reproduction confirmed** on 43b6366f and on 444d10b7 (scratch probe of QA's steps): 5 requests, `t` and `u` each sent twice, the second time unchanged at revision 4. Server holds `{s:'M6 bolt', t:'5.00', u:'3.50'}`, so no wrong data. Not caused by this PR | Compare with `standIn(watcher, settledValue(watcher))` at :388, so a watcher whose typed text is already on its way is left to its own queued save. The developer is adding this to #633; the delta review checks it (hand-off) |
| QLT-07 | Info | `tests/integration/approval/approve.test.ts:339` | CI; DEF-067 | `expect(JSON.stringify(view.priceRemoved)).not.toContain('600')` fails whenever the timestamp contains `600` (this run: `…11.600Z`) | The only red check on run 45100288884; not a finding against #633. Already logged by QA as DEF-067 | Fix under DEF-067. Re-run this PR's checks |
| QLT-08 | Info | whole diff | NFR-002, coding standards (security) | Security hygiene read | No new logging, no values in errors or announcements, no cost or rate data, no route, schema or auth change; diff limited to the hook and its test | none |

<details><summary>Detailed notes and code suggestions</summary>

### QLT-01: the sequence (flag `p`, nothing stored)
1. ON: `commit` queues `p=1` (ticket 1); the request reaches the server and waits.
2. OFF: `settledValue` is `1`, so `0` differs and `commit` queues `p=0` (ticket 2). On master this choice was dropped here, so no second save existed.
3. Another tab saves `p=1` (revision 2).
4. Save 1 is answered 409, and `reconcile` reads `fresh p=1`. `planAfterNewerPart` says mine `0` = held `0` (not changed by me) and now `1` ≠ held (changed by the other), so it **adopts** and shows `1`.
5. Save 2 still holds the latest ticket and `p` is not in conflict, so `send` posts `{revision:2, p:'0'}`. Result: server `0`, screen `1`, `isDirty` false.

**Current** (`reconcile`, :261)
```ts
for (const [adoptedId, text] of Object.entries(plan.adopt)) {
  showText(adoptedId, text);
  clearError(adoptedId);
}
```
**Suggested**
```ts
for (const [adoptedId, text] of Object.entries(plan.adopt)) {
  // A save already queued for this field carries a choice the re-read has just replaced on the screen: it is out of date, as in a conflict (AQP-407).
  newTicket(adoptedId);
  onItsWayRef.current.delete(adoptedId);
  showText(adoptedId, text);
  clearError(adoptedId);
}
```
**Test that catches it** (fails on 43b6366f, passes with the fix):
```ts
it('a 409 that adopts the other tab\'s value does not send the queued second choice over it', async () => {
  const { gate, hook } = await openFlag({});
  const form = hook.render();
  const release = partServer.holdNextSave();
  toggle(form, true);
  await flushMicrotasks();
  toggle(form, false);
  partServer.changeElsewhere({ p: '1' });
  release();
  await gate.settle();
  expect(partServer.inputs['p']).toBe('1');
  expect(hook.render().texts['p']).toBe('1');
  expect(partServer.sent).toHaveLength(1);
});
```
The same holds for a number field (type 2 and leave, type 1 and leave, other tab sets 5.00).

### QLT-02: the hold-then-fail hook and the test
`tests/support/part-server.ts`: add `failAfterHold: false` to `state`, reset it in `reset`, and:
```ts
/** The next held save reaches the server and is then lost (no answer), after its hold is released. */
failAfterHold(): void {
  state.failAfterHold = true;
},
// in save(), right after `if (held !== null) await held;`
if (held !== null && state.failAfterHold) {
  state.failAfterHold = false;
  return { status: 'failed' };
}
```
Test (passes on 43b6366f; fails with `if (onItsWayRef.current.get(field.id) === value)` put back):
```ts
it('ON, OFF, ON with the first save lost after the others queue: OFF while the third is in flight ends OFF', async () => {
  const { gate, hook } = await openFlag({});
  const form = hook.render();
  partServer.failAfterHold();
  const releaseFirst = partServer.holdNextSave();
  toggle(form, true);
  await flushMicrotasks();                       // save 1 reached the server and waits
  const releaseThird = partServer.holdNextSave(); // the next request to arrive is the third choice (the second is out of date, never sent)
  toggle(form, false);
  toggle(form, true);
  releaseFirst();
  await flushMicrotasks();                       // save 1 lost, save 2 skipped, save 3 waits
  toggle(form, false);
  releaseThird();
  await gate.settle();
  expect(partServer.inputs['p'] ?? '0').toBe('0');
  expect(hook.render().texts['p']).toBe('0');
});
```

### QLT-03: the guard
**Current** (`send`, :300)
```ts
if (outcome.status !== 'ok') {
  explain(outcome, fieldId);
  return;
}
```
**Suggested**
```ts
if (outcome.status !== 'ok') {
  // A save made out of date by a later save of the same field does not speak for it: the later one is sent next, and its answer is the one shown.
  if ((ticketsRef.current.get(fieldId) ?? 0) === ticket) explain(outcome, fieldId);
  return;
}
```
A later save or a conflict notice always exists when the ticket has moved on (`newTicket` is called only by `queueSave` and the conflict loop of `reconcile`), so no failure goes unreported. A 404 is reported by the later save, which meets the same missing part. This also stops `explain` recording the later value as the "refused text" at :198 when a superseded automatic save gets a 422.

### Concurrency read (what was checked and found sound)
- **Out-of-order answers:** cannot happen within one tab. Every save runs strictly one after another on `queueRef` (`then` chain), and `part-server` answers in arrival order. The `finally` of save *n* runs before save *n+1* starts.
- **Every compare site:** `commit` :332, `autosaveField` :362 and `differsFromSettled` :169 now read `settledValue`. A blank on its way maps to `null`, matching the held side (a removed key) and `standIn`. `syncWatchers` :388 stays on `heldRef`, correctly (QLT-06). `planAfterNewerPart` reads `heldRef` on purpose (it is "what the screen last held").
- **Ticket clear:** `onItsWay` is deleted by the field's latest save, or by `reconcile` for a conflict field (which also raises the ticket). So an entry never outlives the queue. A stale entry would now hide a needed save, which makes this property essential, and it holds.
- **Failed save:** if the latest save fails, its `finally` deletes the entry, so the next compare is with the held value and the 30-second save heals (P4). If an earlier save fails, see QLT-03.
- **Conflict answer:** the conflict and resend paths are correct (resend may repeat a queued value; the server ignores a no-op). The adopt path is QLT-01.
- **Reload (`readAgain`, 404):** `onItsWayRef` is not cleared on a re-read, but the queued save is still sent, so `settledValue` returns what the server will hold. After a 404 the part is gone and every save fails. No issue.
- **Trail:** `setText` calling `trail.saved` while an equal value is on its way only clears an earlier failure status. `isAutomatic` is unaffected, so a failing 30-second save is still told politely.
</details>

## Issues for other roles
- **qa-engineer / developer:** `tests/integration/approval/approve.test.ts:339` is time-dependent (QLT-07); QA has logged it as DEF-067.
- **qa-engineer:** DEF-065 verification should include the 409-adopt case (QLT-01) once fixed. DEF-066's reproduction is confirmed by this review (QLT-06).

## What the delta review must check (head after 43b6366f)
1. QLT-01: the adopt loop invalidates a queued save of the adopted field, with a test like P1 (flag) that fails on 43b6366f.
2. QLT-02: `failAfterHold` (or an equivalent hold-then-fail hook) in `part-server.ts`, and a P2b-shaped test that fails with the value-based clear.
3. QLT-03: either the out-of-date-failure guard in `send`, or a linked `follow-up` issue.
4. QLT-04: the "three choices" test replaced or tightened.
5. DEF-066 fix in `syncWatchers`: it compares with `settledValue`. Check that a watcher shown again after Fasteners goes back to "None" is still re-sent when nothing is on its way (the server stored the hidden number as 0); that `fasteners-none-requests` (four requests) and the DL-277 409 cases stay green; and that QA's exactly-one-request test fails on 444d10b7.
6. That no new compare site reads `heldRef` directly where a value can be on its way.

## Previous Findings (re-review only)
n/a (round 1).

---

## Delta review (febca143)

| Field | Value |
|-------|-------|
| Review round | 2 (delta) |
| Commits reviewed | e9ec27c1 (DEF-066, `syncWatchers`), febca143 (QLT-01 to QLT-04). Merge 2e395b41 (brings in master 967e6337) excluded: it does not touch `use-part-form.ts`, `part-server.ts` or `use-part-values.test.ts` |
| Head | febca1434bd7d615e8388423e6d8d68809afce55 |
| Date | 2026-11-22 |
| **Verdict** | **APPROVE** (no open Blocker, Critical, Major or Minor). The merge still waits for a fully green run of record (CLAUDE.md section 9 item 1); run 45102120443 was pending at the time of review |

| Severity (delta) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 2 |

### Checks run (private scratch copy of febca143; no worktree written)
| Check | Result |
|-------|--------|
| `use-part-values`, `fasteners-none-requests`, estimate-autosave, estimate-autosave-part, part-conflict, save-gate, save-gate-dirty, part-form-lazy, part-completeness, plus my round-1 probes (P1, P1b, P2b, P3, P3b, DEF-066) | `Test Files 11 passed (11)`, `Tests 126 passed (126)`. `use-part-values` is 34 of 34, as the developer reports |
| New tests against the hook at 444d10b7 | 16 fail, 21 pass (37, with `fasteners-none-requests`). The four-choices test is among the failures (QLT-04 met) |
| New tests against the hook at 43b6366f | 7 fail: QLT-01 ×2, QLT-03 ×2, DEF-066 ×3 |
| New tests against the hook at e9ec27c1 | 4 fail: QLT-01 ×2, QLT-03 ×2 (DEF-066 tests pass, so e9ec27c1 alone fixes DEF-066) |
| febca143 with the value-based clear put back | only the QLT-02 test fails |
| febca143 without the `send` guard | only the two QLT-03 tests fail |
| `fasteners-none-requests` (four requests; DL-277 409 cases) | green on every hook version above |
| Delta probe Q1: Qty kept while hidden (server holds `0.00`), Fasteners shows it again, nothing on its way | Sync re-sends: `[{rev1, s:'M6 bolt'}, {rev2, t:'5.00'}]`. The no-on-its-way path is unchanged (`settledValue` = held) |
| Delta probe Q2: the sync's save of Qty is lost | Qty is reported (`unstored`), the on-its-way entry is cleared, and the next leave sends it; server `5.00` |

### Previous findings
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-01 | Critical | **Fixed** | `reconcile` adopt loop: `newTicket` + delete the on-its-way entry. Flag and number tests fail on e9ec27c1, pass on febca143 |
| QLT-02 | Major | **Fixed** | `failAfterHold()` in `part-server.ts`; the QLT-02 test is the only one that catches the value-based clear |
| QLT-03 | Minor | **Fixed** | `send` reports a failure only for the field's latest save; flag and number tests fail without the guard |
| QLT-04 | Minor | **Fixed** | Four-choices test fails on master |
| QLT-05 | Info | unchanged | as before |
| QLT-06 | Info | **Fixed** (DEF-066) | `syncWatchers` compares with `settledValue` and sends as a ticketed on-its-way save. The three DEF-066 tests fail on 43b6366f |
| QLT-07 | Info | n/a | DEF-067, not this PR |
| QLT-08 | Info | re-checked | no logging, no values in messages, no cost or rate path, no route, schema or auth change in either commit |

### What the `syncWatchers` and `send` changes could break: read and probed
- **A watcher shown again with nothing on its way** is still re-sent: `settledValue` returns the held value, which is the old compare (Q1, and the second DEF-066 test).
- **A queued save of the watcher with older text** is made out of date by the sync's ticket, so it no longer lands after the newer text (the third DEF-066 test). A queued save of the same text makes the sync skip, so it goes in its own turn (the first DEF-066 test).
- **The sync's save fails:** its `finally` clears the on-its-way entry (its ticket is still the latest), `explain` runs, and the next leave sends it (Q2).
- **The sync and a conflict:** a watcher in conflict is never sent (`send` returns early); the sync's ticket also makes any older queued save out of date, which a conflict would have done anyway.
- **The `send` guard:** an out-of-date save never sends, so the guard only affects a save that was current when sent and became out of date while in flight. A later save of the field is then always queued and reports for it, including a 404 (it meets the same missing part). Reconcile and resend calls take the latest ticket, so they still report. Saves run strictly one after another, so a reconcile cannot raise a ticket while another save of the field is in flight.
- **The adopt fix** also makes an automatic save out of date; its `finally` still runs `trail.end`.

### Delta findings
| ID | Severity | File:line | Issue | Note |
|----|----------|-----------|-------|------|
| QLT-09 | Info | `use-part-form.ts:392-402` | On master the DEF-066 shape could also store **stale** data: Qty `5` left, then `6` typed while the sync was queued. The sync sent `6.00`, and the queued `5.00` was then sent after it, so the server held `5.00` while the screen showed `6` (the third DEF-066 test, failing on 444d10b7: `expected '5.00' to be '6.00'`). The field stayed marked, so the 30-second save would have mended it | For qa-engineer: DEF-066's "no wrong data" holds only for its own steps. e9ec27c1 closes this shape too; include it when verifying DEF-066 |
| QLT-10 | Info | `use-part-form.ts:399` (`send` from the sync) | A good save sent by the sync does not clear an unsaved mark on the watcher (as before this PR). Not reachable in the page: a hidden watcher has its mark cleared, and a watcher left during the sync is cleared by `commit` | No action |

### Hand-off for the merge
No open finding at Blocker, Critical, Major or Minor. Merge when run 45102120443 (or a later run on the same head) is fully green. QA verifies DEF-065 (including the QLT-01 shape) and DEF-066 (including QLT-09) by rerunning the tests.
