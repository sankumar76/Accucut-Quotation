# Review Report — AQP-130 (STORY-02.05 Treatment / Color list) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-130-treatment-color-list` (PR #195; base `master` 41848eb) |
| Commit reviewed | 67febe3 |
| Date | 2026-11-10 |
| **Verdict** | **APPROVE WITH COMMENTS** (no Blocker, Critical or Major; 4 Minor, 6 Info) |

## Summary

The server side is correct and follows the pattern of the masters already delivered:

- **Validation.** The schema checks the shape. The service checks it again, and it refuses the reserved names in any case, spacing or full-width form.
- **Uniqueness.** `uq_treatments_name_lower` decides whether a name is taken, so two requests that race for one name cannot both win.
- **Locking.** Each change takes the table lock first, then `FOR UPDATE` on the row.
- **Audit.** Each audit entry is written with the change's own `tx`.
- **"Other".** It is locked twice: the service answers 409 `TREATMENT_LOCKED`, and the repository's rename and delete statements carry `isSystem: false`.
- **Hidden rows.** The default filter of §4.9 applies to every read and lookup.

**I re-planted A3 and A4 myself (control PRs #204 and #205). Each one fails exactly the late-failure test it targets** in `tests/integration/masters/treatments.test.ts`. So the shared runner of #130 has teeth for this master too.

A third plant took out both locks (#206) to test the concurrency tests. The whole suite stayed green, 5,081 of 5,081, including all 27 treatment integration tests and all three E2E shards. So no test shows that changes are serialised (QLT-03).

The four Minor findings are small:

- **QLT-01.** Names that differ only in inner spaces or in full-width letters can both be stored, although the reserved-name check treats them as the same name.
- **QLT-02.** The reserved-name check runs before the lookup, so "Other" renamed to "Other" gets 422, not 409.
- **QLT-03.** The concurrency tests do not prove that changes are serialised.
- **QLT-04.** The tab's first read can land after a later re-read and show a stale list.

On DL-135, I rule that the one-field replacement is a sufficient control. Plant #199 staying green in the browser is acceptable, because the old effect cannot misbehave on a form with one field (QLT-05).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 4 (QLT-01 to QLT-04) |
| Info | 6 (QLT-05 to QLT-10) |

## Checks Run

The machine limits applied: nothing was run locally (no database, no vitest, no tsc, no Playwright, no dev server). The code was read from `gh pr diff 195` and from `git show 67febe3:<file>` for full files and callers. The plants ran in CI on throwaway control PRs, each built from 67febe3 plus one commit. Each control PR was read once with `gh pr view --json statusCheckRollup` and `gh run view --log-failed`, then closed unmerged.

| Check | Command / evidence | Result |
|-------|--------------------|--------|
| PR CI on 67febe3 | run 42881974487 (G5 evidence) | Green, 5 of 5. Changed-code coverage 99.2 % (121 of 122 lines). Integration `treatments.test.ts` 27 of 27. E2E 240 + 242 + 293 passed, no retry |
| **Plant A3** (add) | control PR #204, run 42887783288; diff below | **Fails exactly 1 of 27**: "AC-6 (DEF-017) … add: no treatment is left and no entry is kept" (`expected 13 to be 12`, `treatments.test.ts:277`). Units 2,868 of 2,868 green; overall 1 failed, 5,080 passed. Closed unmerged |
| **Plant A4** (rename, delete) | control PR #205, run 42887795091; diff below | **Fails exactly 2 of 27**: "rename: the treatment is as it was and no entry is kept" (`expected 14 to be 13`, `:287`) and "delete: the treatment is still there and no entry is kept" (`expected 16 to be 15`, `:296`). Overall 2 failed, 5,079 passed. Closed unmerged |
| **Plant: no table lock, no row lock** | control PR #206, run 42887806416; diff below | **All green**: 5,081 of 5,081 (integration `treatments.test.ts` 27 of 27), and all 3 E2E shards green. As predicted, this is evidence for QLT-03, not a pass. Closed unmerged |
| Developer plants | #196 to #200 (read, not re-run) | A3 1 of 27 red; A4 2 of 27 red; focus-on-refusal removed 30 browser tests red; DEF-020 close handler 9 red; old `[errors]` effect only the source guard red (QLT-05) |
| G12 (test strategy §10, DL-114) | `tests/security/**` diff read line by line; scan spec and gate untouched | Nothing removed or weakened. `role-matrix.test.ts` adds two Admin-only rows and one signed-in route, and merges two materials rows onto one line with the same values. `engineer-import-rule.test.ts` adds `treatment-repository` and `treatment-service` to the **blocked** lists, which is stricter |
| Other edited tests | `masters-audit-events.test.ts`, `materials.spec.ts`, `aqp-122-qa.spec.ts`, `http-route-manifest.test.ts` | Justified. A bare `{ name }` is now a valid master state, so the "older shape" example needed a `unit`. The page description now names three tabs (ux-spec v0.18, last row). The Engineer route list gains `/api/v1/options/treatments` (AC-5) |

### The plants (diffs printed before each run)

A3, `src/server/services/treatment-service.ts` `add` (commit 3a8eef9 on `control/AQP-130-rq-a3`):

```diff
-async function add({ masters, audit }: TreatmentDependencies, tx: Transaction, context: AuditContext, name: string): Promise<TreatmentRecord> {
+async function add({ masters, audit, transactions }: TreatmentDependencies, tx: Transaction, context: AuditContext, name: string): Promise<TreatmentRecord> {
   await masters.lockTreatments(tx);
   const record = await masters.createTreatment(name, tx);
-  await audit.record(tx, { event: 'master.created', ...entryFor(context, record), before: null, after: auditState(record) });
+  // QUALITY PLANT A3 (control PR, never merged): the entry is written in a second transaction opened inside the change.
+  const plantedEntry = { event: 'master.created' as const, ...entryFor(context, record), before: null, after: auditState(record) };
+  await transactions.run((plantTx) => audit.record(plantTx, plantedEntry));
   return record;
```

A4, the same file, `change` and `remove` (commit 5ac39a6 on `control/AQP-130-rq-a4`):

```diff
   const after = await dependencies.masters.renameTreatment(before.id, next.name, tx);
   if (after === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
-  await dependencies.audit.record(tx, { event: 'master.edited', ...entryFor(context, after), before: auditState(before), after: auditState(after) });
+  // QUALITY PLANT A4 (control PR, never merged): the rename's entry is written in a second transaction opened inside the change.
+  const plantedEdit = { event: 'master.edited' as const, ...entryFor(context, after), before: auditState(before), after: auditState(after) };
+  await dependencies.transactions.run((plantTx) => dependencies.audit.record(plantTx, plantedEdit));
   return after;
@@
   if (!(await dependencies.masters.deleteTreatment(before.id, tx))) throw new NotFoundError(NOT_FOUND_MESSAGE);
-  await dependencies.audit.record(tx, { event: 'master.deleted', ...entryFor(context, before), before: auditState(before), after: null });
+  // QUALITY PLANT A4 (control PR, never merged): the delete's entry is written in a second transaction opened inside the change.
+  const plantedDelete = { event: 'master.deleted' as const, ...entryFor(context, before), before: auditState(before), after: null };
+  await dependencies.transactions.run((plantTx) => dependencies.audit.record(plantTx, plantedDelete));
```

No lock, `src/server/repositories/treatment-repository.ts` (commit 4e970d6 on `control/AQP-130-rq-nolock`). The service still calls `lockTreatments` and then `findTreatmentForUpdate`, so the unit tests, which spy on the call order, are not the target:

```diff
-  // Prisma has no row lock, so this is a raw statement: the ID is a bound parameter. The default filter applies (section 4.9).
+  // QUALITY PLANT: no row lock (FOR UPDATE removed; control PR, never merged).
   const rows = await clientFor(db, tx).$queryRaw`
-    SELECT id::text AS "id", name, is_system AS "locked" FROM treatments WHERE id = ${id}::uuid AND is_hidden = false FOR UPDATE`;
+    SELECT id::text AS "id", name, is_system AS "locked" FROM treatments WHERE id = ${id}::uuid AND is_hidden = false`;
@@
     lockTreatments: (tx) =>
       withDatabaseErrors(async () => {
-        await clientFor(db, tx).$executeRaw`LOCK TABLE treatments IN SHARE ROW EXCLUSIVE MODE`;
+        // QUALITY PLANT: no table lock (control PR, never merged).
+        await Promise.resolve(clientFor(db, tx));
       }),
```

## AC conformance

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 list; "Other" first, locked, visible reason, no controls; no hidden entry | migration (fixed "Other" row, `is_hidden`); `treatment-repository.ts` (`LISTED`, `LIST_ORDER`); `treatment-list.tsx` (`LockedReason`, no `RowActions` when `locked`) | integration AC-1 (3 tests, including a hidden row never listed or found); unit lists; E2E "AC-1, AC-8 …" at 3 widths (first row is "Other" with the reason and 0 buttons) | **Met** |
| AC-2 required, unique ignoring case, "Other" / "Not applicable" in any case → 422 `NAME_RESERVED` "That name cannot be used." | `schemas/treatments.ts`; `treatment-service.ts:80-103` (`usableName`, `isReservedTreatmentName`, `withNameRule`); `uq_treatments_name_lower` | unit (9 reserved spellings, including full-width); routes unit; integration (6 reserved spellings, case-insensitive duplicates, race of 4); E2E reserved names ×4, "Duplicate name" | **Met.** Inner spacing is normalised for reserved names but not for duplicates (QLT-01). The reserved check runs before the lock check (QLT-02) |
| AC-3 (negative) PATCH / DELETE of "Other" refused by service and API, nothing changes | `lockedChangeable` → 409 `TREATMENT_LOCKED`; repository `isSystem: false` in rename and delete | unit service and routes; integration AC-3 (service and repository); E2E against the real server | **Met.** One wrinkle: `PATCH "Other" { name: "Other" }` is refused with 422, not 409 (QLT-02). It is still refused and nothing changes |
| AC-4 an unused treatment deleted leaves the list | `remove` (hard `DELETE`, as the architecture has no `deleted_at`) | integration and routes delete tests; E2E keyboard delete in an alertdialog; "deleted elsewhere" notice | **Met.** "In use" cannot happen yet: no estimate exists, and the question is open with the architect (QLT-09) |
| AC-5 `GET /options/treatments`: IDs and names, "Other" included, strict, all roles | `options/treatments/route.ts`, `treatmentOptionsResponseSchema` (strict), manifest `ALL_ROLES` | routes unit ×3 roles; integration (keys are exactly `id`, `name`); E2E; manifest Engineer-route pin; the canary scan covers it | **Met** |
| AC-6 exactly one audit entry with who, when, object, before, after | `add` / `change` / `remove` with the change's `tx`; `treatmentState` and words | unit and integration (exactly one entry; none for a no-op rename; none for a refused change); DEF-017 late-failure ×3 plus a refused entry rolling back the change; **plants A3 and A4 (this review)** | **Met in substance.** The events are `master.created / edited / deleted` with `object_type` `treatment`, not the AC's literal `master.treatment.*` (QLT-06) |
| AC-7 role check first: Lead / Engineer 403, signed-out 401 or redirect; the options route passes the scan | manifest rows `ADMIN_ONLY`; `withRoute` | `role-matrix.test.ts` rows; manifest walks (refused before lookup); `route-calls.ts` recipes; canary scan (Engineer route list) | **Met** |
| AC-8 360 / 768 / 1366: no sideways scroll, 44 px, axe 0, keyboard add / rename / delete (delete in an alertdialog) | panel, list, dialogs; shared `Table` with `actionButtons={2}` | `treatments.spec.ts` and `treatments-focus.spec.ts` at 3 widths; `masters-table-actions.spec.ts` at the 11 widths of Dev Context 11240; the 8 px gap and 112 px column measured | **Met** |
| Dev Context 11240 §4 / 11354 (DEF-020, DL-135, the failed-write sentence) | `use-treatments.ts` (`focusOpener(…, status === 'error')`, the effect ignores an error); `useFocusOnRefusal`; `treatment-texts.ts` | DEF-020 ×3 at 3 widths (plant #200: 9 red); refusal typing tests (plant #198: 30 red); the source guard (plant #199); "Nothing was changed." absent ×3 | **Met.** On the one-field form, see QLT-05 |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Minor | `src/server/services/treatment-service.ts:87-92` | AC-2 (spirit); consistency inside the story | `isReservedTreatmentName` folds NFKC forms, case and inner whitespace. The duplicate rule (`lower(name)`) folds case only, and the stored name keeps its inner spaces. So "Powder coat" and "Powder  coat" (two spaces), or "Powder coat" and "Ｐｏｗｄｅｒ coat", are both accepted | HTML collapses runs of spaces, so the Admin's list and the Engineer's drop-down (story 05.06) would show two entries that look the same. The Materials and Process masters behave the same way, so this does not regress anything | Store the canonical spacing: in `usableName`, `const stored = name.normalize('NFKC').trim().replace(/\s+/g, ' ')`, then check reserved names and store `stored`. The schema's `.trim()` stays. Test: integration "refuses 'Invented  powder coat' (two spaces) when 'Invented powder coat' exists, with NAME_TAKEN". The other masters can follow later as a separate item |
| QLT-02 | Minor | `src/server/services/treatment-service.ts:162-163` | AC-3; architecture §6 (404 for unknown or hidden, 409) | `updateTreatment` calls `usableName` before the transaction, so the reserved-name refusal comes before the lookup and the lock check. `PATCH /treatments/<Other> {"name":"Other"}` (or `"OTHER"`) gives **422 NAME_RESERVED**, not 409 `TREATMENT_LOCKED`. `PATCH /treatments/<unknown or hidden> {"name":"Other"}` gives 422, not 404 | The request is still refused and nothing changes, so AC-3 holds. But the API's answer depends on the body rather than on the resource, which a client or a later test could misread. Nothing leaks: unknown and hidden IDs answer alike | Do the cheap shape check before the transaction, and the reserved-name check inside `change`, after `lockedChangeable` (it is pure, so it costs nothing under the lock). Test: unit and routes "PATCH Other with 'Other' → 409 TREATMENT_LOCKED" and "PATCH unknown ID with 'Other' → 404" |
| QLT-03 | Minor | `tests/integration/masters/treatments.test.ts:328-342` | Test adequacy (concurrency) | The "two requests at once" rename/delete test passes **with no lock at all** (plant #206: 27 of 27 green). A rename that runs after a delete fails on `P2025` and gives "not found" whether or not a lock is held. No test runs two renames at once or checks the `before` of the audit entry that comes second. The table lock is checked only by the unit order spies on the fakes | The locks are correct today. But a later change could drop `FOR UPDATE`, which is exactly what keeps the audit `before` truthful, and the suite would stay green. The audit trail could then record a `before` that was never the stored value (NFR-007) | Add one integration test: two simultaneous renames of one treatment to different names. Assert that the second `master.edited` entry's `before` equals the first one's `after` (the entries form a chain). Optionally, have the rename/delete race assert the `master.deleted` entry's `before` equals the name the row had when it was deleted. Show it failing with the #206 plant |
| QLT-04 | Minor | `src/components/features/masters/use-treatments.ts:46-51, 103` | Correctness (async ordering) | `read` has no "latest request wins" guard. "Add treatment" is enabled while the tab's first `GET` is still in flight. If that first read answers after the re-read that follows an add, the older list replaces the newer one: the notice says "X was added", but X is not shown, and `wantsFocus` is spent by the wrong answer | Only on a slow first read, for example a cold dev server or a busy database. The fix is a page refresh. The other masters' hooks have the same shape, but there the first list comes from the server render, so this race is new to the lazy tabs (Exchange rates has one save and no list) | Add a counter: `const latest = useRef(0); … const ticket = ++latest.current; const outcome = await listTreatments(); if (ticket !== latest.current) return;`. Test (Playwright): hold the first `GET` with a route gate, add a treatment, release the gate, and expect the new row and focus on "Add treatment" |
| QLT-05 | Info | `tests/unit/treatments-focus-rule.test.ts:39-43` | DL-135; Dev Context 11354 §1 | **Ruling asked of the reviewers.** The one-field replacement for DL-135's two-field typing test is a **sufficient control**, and #199 staying green in the browser is **acceptable**. With one field, the old `[errors]` effect fires only when a refusal sets the name's message, which is exactly when focus should move. Typing clears that message, so the effect finds no refused field and does nothing. The fault DL-135 targets (focus jumping to the next refused field) cannot happen on this form, so no browser test could see it. The behavioural tests that can fail here do fail (#198: 30 red). The source guard is narrow: it reads `useEffect` only, dependency names matching `errors?`, and five named files | None for this PR. Two notes for the record: (a) when the form gains a second field (for example a colour code), the two-field typing test of 11354 becomes possible and must be added then; (b) if the guard is kept, also match `useLayoutEffect` and any identifier ending in `Errors`, or scan the folder rather than a fixed list |
| QLT-06 | Info | `src/server/services/treatment-service.ts:37-38` | AC-6; architecture §8; DL-129 (4)(a) | The events are `master.created / edited / deleted` with `object_type` `treatment`, not the AC's `master.treatment.*` | None. This is the binding §8 rule, and DL-129 ruled the same for AQP-123 (AQP-122 read it the same way). The audit screen's words for `treatment` are tested | The product-owner amends AC-6's text before G7, as DL-129 did for AQP-123 AC-4. No code change |
| QLT-07 | Info | `src/server/services/treatment-service.ts:106-108`; `treatment-form-dialog.tsx:98` | AC-3; architecture §6 row "Treatments" (409) | I agree with 409 `TREATMENT_LOCKED`: the resource's state, not the request's shape, forbids the change, and §6 lists 409 for the row. The screen never offers the action. If a 409 ever reached the dialog, it would show the connection sentence (`setFailed(true)`), which would be misleading, but no current path gets there | None | None now. If the 05.06 "in use" rule also answers 409 on delete, give the delete dialog a sentence for it then |
| QLT-08 | Info | `prisma/migrations/20261110120000_treatments/migration.sql:36, 39` | Defence in depth; issue #202 | I support #202 in the form it proposes: a trigger (story 02.06's) that refuses `UPDATE` and `DELETE` of any `is_system` row. Today only the repository's own statements spare "Other". The runtime role holds `UPDATE, DELETE` on the whole table, so any later code path in the app could change it. Separately, `ck_treatments_name_not_blank` uses `btrim`, which trims spaces only, so a name of a tab or a newline alone passes the CHECK. The app trims all whitespace first, so this is only a weaker backstop | Low | Architect to decide #202 before 02.06 is built. If the CHECK is touched again, use `btrim(name, E' \t\r\n')` or `name ~ '\S'` |
| QLT-09 | Info | `src/server/services/treatment-service.ts:144-148` | AC-4; Risks (open question with the architect) | A delete is a hard `DELETE` and the entry keeps the name, so the history stays readable. Once 05.06 adds a reference from an estimate to `treatments`, the delete of a treatment in use will fail on the foreign key, and that would reach the Admin as a 500, not as a refusal | None today, because no estimate exists | Carry this into the architect's open question for 05.06: decide between restrict + 409 "in use", a soft delete, or keeping the name on the estimate. Add a test then |
| QLT-10 | Info | — | Praise | The server design is clean. The table lock, then the row lock, is the same order everywhere. The reserved-name check never names the hidden entry. A non-UUID is "not found", not a database error. The hidden-row test in integration exercises the §4.9 default filter before 02.06 needs it. The failed-write and DEF-020 rules are applied and plant-proven at three widths | — | — |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-01
**Current** (`treatment-service.ts:87-92`)
```ts
function usableName(name: string): string {
  const problem = treatmentNameProblem(name);
  if (problem !== null) throw refusal(problem);
  const trimmed = name.trim();
  if (isReservedTreatmentName(trimmed)) throw refusal(TREATMENT_NAME_RESERVED_MESSAGE, NAME_RESERVED_CODE);
  return trimmed;
}
```
**Suggested**
```ts
/** The name as it is stored: compatibility forms folded and runs of whitespace made one space, so two names that read the same are one name. */
const canonicalName = (name: string): string => name.normalize('NFKC').trim().replace(/\s+/g, ' ');

function usableName(name: string): string {
  const problem = treatmentNameProblem(name);
  if (problem !== null) throw refusal(problem);
  const stored = canonicalName(name);
  if (isReservedTreatmentName(stored)) throw refusal(TREATMENT_NAME_RESERVED_MESSAGE, NAME_RESERVED_CODE);
  return stored;
}
```
`treatmentEditChanges` on the screen would then send a name the server stores differently, which is harmless: the server compares against the stored name.

### QLT-02
**Suggested** (sketch)
```ts
async updateTreatment(context, id, changes) {
  const wanted = changes.name === undefined ? changes : { name: shapedName(changes.name) }; // shape only: blank / too long
  return withNameRule(() => transactions.run((tx) => change(dependencies, tx, context, id, wanted)));
},
// in change(), after lockedChangeable(): if (wanted.name !== undefined && isReservedTreatmentName(wanted.name)) throw refusal(…, NAME_RESERVED_CODE);
```

### QLT-04
**Suggested**
```ts
const latest = useRef(0);
const read = useCallback(async (returnFocus: boolean): Promise<void> => {
  const ticket = ++latest.current;
  wantsFocus.current = returnFocus;
  const outcome = await listTreatments();
  if (ticket !== latest.current) return; // a later read was asked for; its answer is the one to show
  if (outcome.status === 'ok') setItems(outcome.value);
  setStatus(outcome.status === 'ok' ? 'ready' : 'error');
}, []);
```
</details>

## Answers to the orchestrator's questions (quality view)

| Question | Answer |
|----------|--------|
| One-field form vs DL-135's two-field test; #199 green in the browser | Sufficient and acceptable (QLT-05). The fault cannot happen with one field. The refusal-focus tests can fail and do (#198). The source guard keeps the pattern out. Add the two-field test when a second field arrives |
| Audit event names vs AC-6 | Keep `master.*` with `object_type` `treatment` (§8, DL-129). The product-owner amends AC-6 (QLT-06) |
| 409 `TREATMENT_LOCKED` | Agree (QLT-07). Fix the check order so "Other" always gets 409 (QLT-02) |
| #201 (UX words) | Out of quality's lane. From a correctness view, the words obey ux-spec v0.21: no failed write says "Nothing was changed.", the saved-but-not-shown sentence is used, and the reserved-name sentence names neither entry. Fine for the ux-expert to rule before G8 |
| #202 (DB guard for system rows) | Support it, as defence in depth in 02.06's trigger (QLT-08) |
| The 5:51 path | reviewer-performance's lane; not assessed here |

## Issues for other roles

- **product-owner:** amend AC-6's text to `master.created / edited / deleted` with `object_type` `treatment` before G7 (QLT-06, DL-129 precedent).
- **solution-architect:** #202 (QLT-08). Also the "treatment in use" rule before 05.06, including what an FK refusal answers (QLT-09).
- **developer (follow-up, any master):** the inner-whitespace and NFKC duplicate rule applies to Materials and Process too (QLT-01), if master wants it everywhere.

## Verdict

**APPROVE WITH COMMENTS.** There is no Blocker, Critical or Major finding. Every AC is met, with tests that fail when the behaviour breaks (A3, A4, focus and DEF-020 plants). QLT-01 to QLT-04 are cheap to fix in this PR, or can be deferred to a tech-debt issue at master's choice. On re-review I will check each fix and only the new diff.
