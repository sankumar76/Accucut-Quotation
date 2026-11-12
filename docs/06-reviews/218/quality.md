# Review Report — #218 (QLT-11, tech-debt from AQP-130) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 (narrow route, as issue #218 sets it) |
| Base…branch | `master` (b3403e3) … `fix/218-audit-master-shapes` (PR #247) |
| Commit reviewed | d833f4761c4cfcf9b76cb580657198f92b03e809 |
| Date | 2026-11-11 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review (system of record): https://github.com/sankumar76/Accucut-Quotation/pull/247#pullrequestreview-5858735404

## Summary
The audit writer now checks a generic master entry's `before` and `after` against `MASTER_SHAPES[object_type]` instead of the union of every master's shape, so a partial state or another master's state is refused with `shape`. The change is small and correct. The two required tests exist, and the control proves they are guards: both are red in CI when the writer goes back to the union. Two Minor findings: the test that is meant to pin "shape and words agree" cannot fail (QLT-01, shown with two plants), and an event with `objectType: 'master'` but no `forMasterShape` would fall back to the union without any warning (QLT-02). The developer's open question is ruled in QLT-03: refusing an unnamed or unknown master type is a correct behaviour change, not a G12 weakening.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| PR CI on d833f47 | Actions run 43015245028 | 5 of 5 green (stage 6: 2,921; stage 11: 5,244) |
| Unit tests, local, on d833f47 | `vitest run tests/unit/masters-audit-events.test.ts tests/unit/materials-audit-events.test.ts` | 2 files, 30 of 30 passed |
| **Control PR #249** (writer back on the union) | branch `control/218-union-writer` from d833f47, commit 8cdbab6, **base `master`** so CI runs. The diff was printed in the PR body before reading (DL-091). Actions run 43019917793 | Stage 6 **red**: 1 file failed, **5 failed** / 2,916 passed of 2,921. Red tests: both tests #218 requires, the cross-master matrix, the deny-by-default test (`quotation`, `master`, `constructor`) and the changed unnamed test. Stage 12, 3 shards: green, unaffected. Locally the same 5 of 23 failed. **Closed unmerged; branch deleted.** |
| Plant (a), local only | on d833f47: `treatment` line removed from `MASTER_WORDS`; reverted | `masters-audit-events.test.ts` **23 of 23 green**. Only `treatments-audit-events.test.ts` failed (1 test) |
| Plant (b), local only (the AQP-142 drift) | on d833f47: `customer` added to `MASTER_SHAPES`, `masterState` and the test's `STATES`, but not to `MASTER_WORDS`; reverted | `masters-audit-events.test.ts` **23 of 23 green**. With QLT-01's suggested assertion added: 1 failed (`customer: expected { before: '—', after: '—' } to not deeply equal …`) |
| Callers name their master | `grep` over `src/` | `masters-service.ts:115,136`, `treatment-service.ts:77`, `exchange-rate-service.ts:131`: all pass `objectType`; `audit-database.test.ts` passes `process_item` |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Minor | `tests/unit/masters-audit-events.test.ts:194` (and the claim at `audit-events.ts:152-153`, Dev Record decision 4) | #218 "one table"; coding standards §6 (meaningful assertions) | `has a shape for exactly the masters that have words` asserts `describeStored(...)` is `not.toBeNull()`. For a type with no `MASTER_WORDS` entry, `describeMasterChange` returns `NO_DETAIL`, not `null`, so the test passes. Plants (a) and (b) both stay green. `MASTER_WORDS` is `Record<string, …>`, so `tsc` does not catch it either | AQP-142 can add `customer` to the table and the union but not to the words. The writer then stores customer entries that the screen shows as a dash, and the test the PR relies on stays green | `.not.toEqual(NO_DETAIL)` in the test (verified red on plant b), and/or type `MASTER_WORDS` as `{ readonly [K in keyof typeof MASTER_SHAPES]: … }` so a missing master is a compile error |
| QLT-02 | Minor | `src/server/services/audit-events.ts:72` | deny by default; coding standards §3 | `schemasFor` falls back to the event's own (union) schemas when `forMasterShape` is absent, while `objectTypeOf` (`audit-service.ts:113`) lets the caller name a master whenever `objectType === 'master'`. Two signals mean "generic master event" | A future `master.*` event declared without `forMasterShape` gets the union back silently, and the QLT-11 hole reopens for it with no red test | Return `null` (refuse) when `objectType === 'master'` and `forMasterShape` is missing; or add a unit test asserting that `schemasFor('quotation')` is `null` for every event whose `objectType` is `'master'` |
| QLT-03 | Info | `tests/unit/masters-audit-events.test.ts:79`; `audit-service.ts:142-143` | test strategy §10 (G12); architecture §8 | Ruling on the developer's open question: refusing an unnamed (`master`) or unknown master type, and changing the test `is "master" when the caller names none` to expect the refusal | None. The change is accepted (see ruling below) | Master records the reading; the solution-architect adds one sentence to §8; optional `follow-up` issue: make `objectType` required in the type for `master.*` |
| QLT-04 | Info | `src/server/services/audit-events.ts:155-160` | AQP-142 readiness (architecture v0.37 §8, PR #246) | Adding `customer` (`{ name, contact, rates }`) is one line in `MASTER_SHAPES` plus its schema. It also needs one entry in `masterState` (caught twice: the payload type and the `not.toBeNull` test) and one in `MASTER_WORDS` with its describer (caught by nothing today: QLT-01). Nested `rates` fits `StoredShape = z.ZodType<JsonValue>` | With QLT-01 fixed, all three places are guarded | — |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-01
**Current**
```ts
expect(AUDIT_EVENTS['master.created'].describeStored(null, STATES[objectType], objectType), objectType).not.toBeNull();
```
**Suggested**
```ts
expect(AUDIT_EVENTS['master.created'].describeStored(null, STATES[objectType], objectType), objectType).not.toEqual(NO_DETAIL);
```
```ts
const MASTER_WORDS: { readonly [K in keyof typeof MASTER_SHAPES]: (state: unknown) => string | null } = { ... };
```

### QLT-02
**Current**
```ts
if (definition.forMasterShape === undefined) return { before: definition.before, after: definition.after };
```
**Suggested**
```ts
if (definition.forMasterShape === undefined) {
  return definition.objectType === 'master' ? null : { before: definition.before, after: definition.after };
}
```
</details>

## Ruling on the unknown / unnamed `objectType` question (for master)
**Accepted. It is a correct behaviour change, not a weakening.**
1. **G12 does not apply.** Test strategy §10 scopes the G12 rule to `tests/e2e/canary-scan.spec.ts`, `tests/e2e/support/canary-scan.ts`, `tests/unit/canary-scan-gate.test.ts` and `tests/security/**`. `tests/unit/masters-audit-events.test.ts` is outside that scope. The change also tightens behaviour (an entry that was stored is now refused); no `expect` is removed and no matcher is widened. The PR body declares it anyway (deviation 1), in the spirit of the rule.
2. **It matches the architecture.** Architecture §8 (AQP-74 ruling): a masters story's `master.*` event has "`object_type` then names the master". An entry under `master` or an unknown type cannot be described, because `MASTER_WORDS` has no key for it, so the screen shows a dash. It also cannot be corrected (NFR-007). Storing it was the hole that #218 closes, and the old test pinned that hole.
3. **No production write changes.** All three callers name their master.
4. **The new assertion still guards behaviour.** It is red on control #249 in CI.
5. Issue #218's statement "an unknown type is already refused by `objectTypeOf`" is inaccurate: `objectTypeOf` checks spelling only. The developer's reading is the right one.
6. **Recommended:** master records the reading in the G6 decision. The solution-architect adds to §8: "a generic master event whose `object_type` names no master in `MASTER_SHAPES` (including none, stored as `master`) is refused with `shape` / `objectType`". Optional follow-up issue: make `objectType` required in `AuditEntryInput` for `master.*`.

## Reviewer-specific tables
**Quality: AC conformance (the "Required" items of #218)**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| One table `MASTER_SHAPES`, read by `MASTER_WORDS` and the writer | `audit-events.ts:155-190`; `audit-service.ts:142-147` | `has a shape for exactly the masters that have words…` | Met for values; key set of `MASTER_WORDS` not pinned (QLT-01) |
| Writer parses before/after with `MASTER_SHAPES[objectType]` | `schemasFor`, `forMasterShape` on the three `master.*` events | cross-master matrix; own-state-kept test | Met |
| Unit: `process_item` with `{ name }` refused, reason `shape` | writer | `[AC-5] refuses a process_item entry…` (l.131) | Met; red on control |
| Unit: `treatment` with an exchange rate's state refused, reason `shape` | writer | `[AC-5] refuses a treatment entry…` (l.137) | Met; red on control |
| Every master's existing before/after integration assertions stay green | callers unchanged | CI 43015245028 stage 11, 5,244 | Met |
| Route: control reverting to the union, both new tests red | control #249 | CI 43019917793 | Met |

## Previous Findings (re-review only)
n/a (first round).

## Issues for other roles
- **solution-architect:** add one sentence to architecture §8 on refusing an unnamed or unknown master type (QLT-03).
- **developer / AQP-142:** when adding `customer`, update `MASTER_SHAPES`, `masterState` and `MASTER_WORDS` together. With QLT-01 fixed, the test enforces this.

---

## Round 2

| Field | Value |
|-------|-------|
| Review round | 2 (re-review of the push only, condition A of master's CONDITIONAL GO, DL-154) |
| Diff reviewed | d833f47..9e98dca (`src/server/services/audit-events.ts` +20/-10, `tests/unit/masters-audit-events.test.ts` +27/-1) |
| Commit reviewed | 9e98dca22e992d43ac60bce72c79c76bc359c848 |
| Date | 2026-11-11 |
| **Verdict** | **APPROVE** (label `review:quality-approved` kept) |

PR review: https://github.com/sankumar76/Accucut-Quotation/pull/247#pullrequestreview-5859759729

**Counts (new diff):** Blocker 0 · Critical 0 · Major 0 · Minor 0 · Info 1 (QLT-05)

### Previous findings
| ID | Severity | Status | Evidence |
|----|----------|--------|----------|
| QLT-01 | Minor | **Fixed** | The test also asserts `.not.toEqual(NO_DETAIL)`. `MASTER_WORDS` is `as const satisfies { readonly [K in keyof typeof MASTER_SHAPES]: … }`, so a missing key and an extra key are both compile errors, with no type assertion. P1 and P2 are red on both the unit test and tsc (below). Thread reply: https://github.com/sankumar76/Accucut-Quotation/pull/247#discussion_r4538673295 |
| QLT-02 | Minor | **Fixed** | `schemasFor` returns `null` when `objectType` is `GENERIC_MASTER_TYPE` and `forMasterShape` is missing. A new `[QLT-02]` test loops over every registered `master` event. P3 and P3b are red (below). Thread reply: https://github.com/sankumar76/Accucut-Quotation/pull/247#discussion_r4538674447 |
| QLT-03 | Info | Unchanged | Ruling stands |
| QLT-04 | Info | Unchanged; now guarded | AQP-142 `customer` drift in any of the three places is now caught (P2) |

### Checks run (all local on 9e98dca; each plant's diff printed before it ran, DL-091; all reverted, nothing committed or pushed)
| Check | Result |
|-------|--------|
| CI 43028036603 on 9e98dca | 5 of 5 green |
| Baseline: `vitest run tests/unit/masters-audit-events.test.ts` | 24 of 24 passed |
| No #218 `expect` removed or loosened | Met. The only removed test line is the import, which was replaced. `expect(` count 38 to 46; existing matchers unchanged |
| **P1**: `treatment` line removed from `MASTER_WORDS` | Unit **red**, 1 of 24 (`treatment: expected { before: '—', after: '—' } to not deeply equal …`). tsc **TS1360** at `audit-events.ts:199` |
| **P2**: `customer` added to `MASTER_SHAPES`, `masterState` and `STATES`, not to `MASTER_WORDS` | Unit **red**, 1 of 24 (`customer: …`). tsc **TS1360** at `audit-events.ts:201` |
| **P3**: refusal removed (fallback to the union) and `'master.planted'` registered (`objectType: GENERIC_MASTER_TYPE`, union schemas, no `forMasterShape`) | `[QLT-02]` test **red** (`master.planted: unknown master: expected { before: ZodUnion… } to be null`) |
| **P3b** (extra): refusal kept, only `'master.planted'` registered | `[QLT-02]` test **red** (`master.planted process_item: expected null not to be null`) |

tsc note: this worktree has no generated Prisma client (`src/generated/prisma`), and some `next-auth` paths do not resolve, so `tsc --noEmit` already reports unrelated module and implicit-`any` errors without any plant. A plant's tsc result counts only errors in `audit-events.ts` and `masters-audit-events.test.ts`; there are none without a plant. CI's type-check stage is green on 9e98dca.

### New findings
| ID | Severity | File:line | Issue | Suggested fix |
|----|----------|-----------|-------|---------------|
| QLT-05 | Info | `src/server/services/audit-events.ts:38`, `src/server/services/audit-service.ts:108` | `GENERIC_MASTER_TYPE = 'master'` is declared privately in both files: the two "generic master" signals from QLT-02 now share a literal, but not one declaration | Optional: export it from `audit-events.ts` and import it in `audit-service.ts`; or fold it into the QLT-03 follow-up (make `objectType` required for `master.*`) |

### Notes
The design is sound. `satisfies` with a mapped type ties the key sets in both directions while keeping the literal types. The `Map` view (`MASTER_WORDS_BY_TYPE`) replaces `Object.hasOwn` and matches `MASTER_SHAPES_BY_TYPE`, so `toString` and `constructor` stay denied. The `[QLT-02]` test covers every registered master event, including future ones, not only the three that exist today.
