# Review Report — AQP-269 (with AQP-270, AQP-271: DEF-024, DEF-025, DEF-026 dialog focus jump while typing) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...fix/AQP-269-dialog-focus-jump` (PR #167; base `master` 322cd8e) |
| Commit reviewed | 69805d1 |
| Date | 2026-11-10 |
| **Verdict** | **APPROVE WITH COMMENTS (0 Blocker, 0 Critical, 0 Major; 3 Minor, 3 Info)** |

## Summary

The fix is correct for all three dialogs, in Add and in Edit. The cause was an effect keyed on the `errors` object, which typing replaces. The new shared hook `useFocusOnRefusal` moves focus only when a new focus *request* is stored, and only `showErrors` stores one. Every refusal path in the three dialogs now goes through `showErrors`: the client check on submit, the server's 422 and the Users "an Admin is already active" refusal. Typing only calls `setErrors` with the field's own message removed, so it can never move focus. Each `showErrors` call stores a new object, so a second refusal moves focus again, even to the same field. `useEffectEvent` is used correctly: the event is called only inside the effect and is not a dependency.

Nothing outside the seven files changed. The Exchange rates tab does not import the shared hook (it keeps its own local copy), so it cannot regress through this PR. The DEF-020 guard (`onCloseAutoFocus`, `process-opener.ts`) is untouched, and its tests pass in the fix run.

The developer's plant (PR #168, run 42852695987) is sound. It restores exactly the three old effects and keeps the new tests. Exactly the 9 new tests fail, on the first try and on retry, at the first focus check after typing (`materials.spec.ts:192`, `process-master.spec.ts:147`, `users.spec.ts:153`). Every other test passes. I ran two more plants through CI (below).

My two plants show that the code is right and that the tests guard less than the code does. The old single effect covered every refusal path at once. The fix moves focus to each `showErrors` call site, so each site now needs its own test. Two gaps are open, both Minor:

- **Plant A, QLT-02.** The hook stores the field name instead of a new object. Then a second refusal of the same first field does not move focus. The whole suite stays green.
- **Plant B, QLT-03.** The server refusal stores its messages without asking for focus. Only the two Material duplicate-name tests fail. Process and Users stay green, including the second-Admin refusal on Role.

QLT-01 is that the new tests do not include the defects' F-b sequence for Material and Users. None of the three gaps blocks the merge: each fix is one or two assertions. I recommend adding them in this PR.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 (QLT-01, QLT-02, QLT-03) |
| Info | 3 (QLT-04, QLT-05, QLT-06) |

## Checks Run

No local runs: the machine had about 380 MB free (brief, DL-091, DL-105). Evidence comes from the diff, the full files at 69805d1, and CI.

| Check | Command / source | Result |
|-------|------------------|--------|
| CI on the head | run 42852617579 (head 69805d1) | 5 of 5 jobs green: `Stages 1 to 11b`, E2E shards 1 to 3, `Stages 1 to 11`. Includes tsc, eslint, unit tests and the 9 new E2E tests at 360, 768 and 1366 px |
| Developer's plant: old effects back, new tests kept | PR #168 (closed unmerged), run 42852695987, head 200418d | **Exactly the 9 new tests fail**, 3 per shard, each with `expect(locator).toBeFocused() failed / Expected: focused / Received: inactive` at line 192, 147 or 153, on the first try and on retry. Shards: 210, 207 and 248 passed. The plant diff touches only the three dialogs (+36 -33) |
| Plant A (mine): focus request stored as the field name, so a repeat of the same first field does not refocus | PR #169 (closed unmerged), run 42856570620 at 56082a7 | **Nothing fails**: 5 of 5 jobs green (E2E 251, 213 and 210 passed). No test in the suite guards "a second refusal moves focus again" (QLT-02) |
| Plant B (mine): server refusal stores messages without asking for focus (`showErrors(fromServer)` and the Admin-taken `showErrors` changed to `setErrors` in all three dialogs) | PR #170 (closed unmerged), run 42856414166 at c3c0dc1 | **Exactly 6 tests fail, all Material**: `materials.spec.ts:231` (line 244) and `aqp-122-qa.spec.ts:199` (line 207), at mobile, tablet and desktop, each `Expected: focused / Received: inactive`, on retry too; 208, 210 and 250 passed. The **Process and Users server refusals lose focus with no test failing** (QLT-03) |
| Scope | `gh pr diff 167` | 7 files: the hook, the three dialogs and the three specs. No change to `use-exchange-rates.ts`, `exchange-rates-panel.tsx`, `process-opener.ts` or any `onCloseAutoFocus` handler |
| Assertions weakened (G12 rule, DL-114) | diff of the three specs | None. Only additions (+26, +27, +26); no existing line changed or removed |
| Coverage of changed code | CI `Stages 1 to 11b` | 0 of 0 added executable lines in scope (`src/components` is outside unit coverage); the hook is covered by E2E only |

### Plant diffs (printed before the results, DL-105)

Plant A, commit 56082a7 on `control/AQP-269-qlt-second-refusal` (from 69805d1):

```diff
-  const [request, setRequest] = useState<{ readonly field: TField } | null>(null);
+  const [request, setRequest] = useState<TField | null>(null);
...
-    if (request !== null) focus(request.field);
+    if (request !== null) focus(request);
...
-    if (first !== undefined) setRequest({ field: first });
+    if (first !== undefined) setRequest(first);
```

Plant B, commit c3c0dc1 on `control/AQP-269-qlt-server-refusal` (from 69805d1):

```diff
 material-form-dialog.tsx:102, process-form-dialog.tsx:101, user-form-dialog.tsx:162
-    showErrors(fromServer);
+    setErrors(fromServer);
 user-form-dialog.tsx:157
-      showErrors({ role: outcome.title });
+      setErrors({ role: outcome.title });
```

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Minor | `tests/e2e/materials.spec.ts:196-205`, `tests/e2e/users.spec.ts:156-165` | DEF-024 and DEF-026 "Regression test added: the probe's F-a and F-b cases"; checklist 7 | In the second half of each test, the field before the focused one is already fixed. So Material and Users never type into a later refused field while an *earlier* one still has its message (F-b, where the old code jumped **back**). Process does cover it (Unit stays refused). Plant #168 also stops at the first focus check (lines 192, 147, 153), so the second halves were never shown to fail | A later change that refocuses "while an earlier field is refused" would pass in Material and Users. Low today: the cause is one shared hook | Before typing into the first field, Tab once to the second refused field and type there (the first still refused). Assert focus and value stay, and the first field is still empty (snippet below) |
| QLT-02 | Minor | `src/components/shared/use-focus-on-refusal.ts:18, 28` | UX 6.0 "Forms"; the hook's own contract, "a second refusal of the same field moves focus there again" | Nothing guards the new-object-per-request contract. Plant A (store the field name instead) passes the whole suite, run 42856570620 | If someone "simplifies" the state to the field name, the second refusal of the same first field leaves focus on the button. A keyboard user then hears no move to the message | One assertion in the shared hook's path: in `materials.spec.ts:166` (refuse empty form), click Add again without typing, then `expect(...'Material in Drawing').toBeFocused()`. One dialog is enough, because the contract lives in the shared hook |
| QLT-03 | Minor | `src/components/features/masters/process-form-dialog.tsx:101`, `src/components/features/users/user-form-dialog.tsx:157, 162` | SCR-11, SCR-14 (Second Admin: the message "sits under Role and takes focus"), UX 6.0 "Forms" | Under the old effect, server refusals got focus for free. Now each `showErrors(fromServer)` call is a separate site. Plant B (`setErrors` at those sites) fails only Material's two duplicate-name tests. Process and Users stay green, run 42856414166 | Someone could drop focus on a Process duplicate name, a used e-mail or a second Admin with CI green | Add `toBeFocused` on the named field to the existing tests: `process-master.spec.ts:185` (Rate name), `users.spec.ts:168` (e-mail) and `users.spec.ts:181` "AC-3: a second Admin is refused" (Role). They are `@one-width`, which is fine here, because focus does not depend on width |
| QLT-04 | Info | `src/components/shared/use-focus-on-refusal.ts:25` | Design | The returned `showErrors` is a new function every render. That is safe today, because only event handlers and `finish` call it. If it ever goes into an effect's dependency list, that effect re-runs on every render | None now | Optional: a JSDoc line saying "call from handlers only; not stable", or wrap it in `useCallback` (`order` and `setErrors` are stable) |
| QLT-05 | Info | the three dialogs | DEF-024 to DEF-026, Edit | Edit is fixed by the same code (`submit` and `finish` serve both modes). It has no test of its own, which is acceptable: the regression lives in the shared hook, and Add proves it | None | No change. QA can add one Edit check at G7 if wanted |
| QLT-06 | Info | `src/components/shared/use-focus-on-refusal.ts` | Praise | Small, focused hook with a clear why-comment. `useEffectEvent` is used correctly: it is called only in the effect and kept out of its dependencies. Every refusal path in the three dialogs was converted, and the only remaining `setErrors` calls clear one field. The plant evidence is precise. Exchange rates and the DEF-020 guard are untouched | — | — |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-01: F-b step (Material; Users the same with Name and E-mail)
**Suggested**, right after `await expect(dialog.getByLabel('Material in Drawing')).toBeFocused();` at line 188:
```ts
// F-b: the next refused field first, while the one before it still has its message (the old code jumped back).
await page.keyboard.press('Tab');
await expect(dialog.getByLabel('Material Considered')).toBeFocused();
await page.keyboard.type('abc');
await expect(dialog.getByLabel('Material Considered')).toBeFocused();
await expect(dialog.getByLabel('Material Considered')).toHaveValue('abc');
await expect(dialog.getByLabel('Material in Drawing')).toHaveValue('');
await page.keyboard.press('Shift+Tab');
```
After that, the test continues as it does now, with `xyz` going into Material in Drawing.

### QLT-02: second refusal, same first field
**Suggested**, at the end of `materials.spec.ts:166`:
```ts
await dialog.getByRole('button', { name: 'Add material' }).click();
await expect(dialog.getByLabel('Material in Drawing')).toBeFocused();
```
Proof the assertion has teeth: under plant A (`setRequest(first)` with string state), the click leaves focus on the button.

### QLT-03: server refusal focus, Process and Users
```ts
// process-master.spec.ts, after line 185
await expect(dialog.getByLabel('Rate name')).toBeFocused();
// users.spec.ts, the used e-mail test, after the message check
await expect(dialog.getByLabel('E-mail (used to sign in)')).toBeFocused();
// users.spec.ts, the second Admin test, after ADMIN_TAKEN is visible
await expect(dialog.getByRole('combobox', { name: 'Role' })).toBeFocused();
```
To prove them, re-run plant B (PR #170's commit c3c0dc1 on top of the change): these three should then fail too.

</details>

## Reviewer-specific tables

### AC conformance

The "ACs" are the Expected Results of DEF-024, DEF-025 and DEF-026, plus the UX spec 6.0 "Forms" rule that the fix must keep.

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| DEF-024: after a refusal of several fields in Add material, all typed letters land in the focused field and focus stays (F-a) | `use-focus-on-refusal.ts:21-29`; `material-form-dialog.tsx:89, 102, 109` | `materials.spec.ts:181` at 3 widths; fails under plant #168 | **Met** |
| DEF-024 F-b: typing first into a later refused field while an earlier one is still refused | same | not covered as such (QLT-01) | **Met in code**; test gap |
| DEF-025: the same in Add rate, incl. a later field while Unit is still refused | `process-form-dialog.tsx:66-79, 101, 108` | `process-master.spec.ts:136` at 3 widths (second half is an F-b case: Unit stays refused); fails under plant #168 | **Met** |
| DEF-026: the same in Add user | `user-form-dialog.tsx:124-128, 134, 157, 162` | `users.spec.ts:142` at 3 widths; fails under plant #168 | **Met** (F-b gap as DEF-024, QLT-01) |
| Edit mode of the three dialogs (the same code path) | same hook and the same `submit` / `finish` | not tested separately (QLT-05) | **Met in code** |
| UX 6.0 "Forms": after a refusal, focus goes to the first field with a message (client check) | `showErrors` from `submit` / `onSubmit` | existing tests `materials.spec.ts:166, 207, 283`, `process-master.spec.ts:123`, `users.spec.ts:129`, all green | **Met** |
| The same after a server refusal (422; Users: second Admin under Role) | `showErrors(fromServer)`; `showErrors({ role })` | Material: `materials.spec.ts:231`, `aqp-122-qa.spec.ts:199` (fail under plant B). Process and Users: no focus assertion (`process-master.spec.ts:163`, `users.spec.ts:168` and the second-Admin test check the message only) | **Met in code**; guarded for Material only (QLT-03) |
| A second refusal moves focus again | new object per `setRequest` (`use-focus-on-refusal.ts:28`) | none (plant A green) | **Met in code**; unguarded (QLT-02) |
| Exchange rates tab unaffected | not touched; it does not import the shared hook | `exchange-rates.spec.ts` green in run 42852617579 | **Met** |
| DEF-020 guard unaffected | `onCloseAutoFocus`, `process-opener.ts` not touched | DEF-020 tests in `process-master.spec.ts:393`, `aqp-234-qa.spec.ts`, `exchange-rates.spec.ts:383`, `tests/unit/process-opener.test.ts`, all green | **Met** |

### Edge cases checked

| Case | Result |
|------|--------|
| Second refusal, same first field | New `{ field }` object, so React re-renders and the effect runs again. Correct (plant A, see the result above) |
| Refusal naming one field vs two | `order.find` picks the first in form order; one field focuses that field. Correct |
| Valid submit after a refusal (`showErrors({})`) | Clears messages; no request, the old one stays and does not re-run (its identity is unchanged). Correct |
| Server 422 naming two fields | `serverErrors` keeps only known fields; `showErrors` focuses the first in order. Correct |
| Server answer after the dialog closed (Escape during save) | The form has unmounted, so `setErrors` and `setRequest` are no-ops (React 18+). Same as before the fix |
| Stale closure in `finish` after `await` | `showErrors` captured at submit uses only stable setters and a module constant; `focus` is an effect event, so it always calls the latest `focusField`. Correct |
| Dialog close and reopen | Each form mounts with its dialog (`UserForm` comment; `MaterialForm` and `ProcessForm` are children of `DialogContent`), so `request` starts at `null`. Correct |
| Users own row (Role disabled) | Focus on a disabled trigger is a no-op; this refusal cannot happen on the own row, since the role cannot change. Unchanged |
| React Strict Mode (dev double effects) | On mount `request` is `null`, so the effect does nothing. Correct |

## Cross-references (not repeated here)
- STD-01 (two hooks named `useFocusOnRefusal`) and STD-02 (`useFieldFocus` name; object lookup like Users) are in the standards review. I agree with both; the Exchange rates migration is the natural fix for STD-01.

## Issues for other roles
- qa-engineer: at G7, check the F-b sequence of DEF-024 and DEF-026 by hand or with the probe, unless QLT-01 is fixed first. DEF-026's file still says Sev-3 while Jira says Sev-2 (noted by the developer; QA owns the file).
