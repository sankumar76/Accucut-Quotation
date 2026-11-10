# Review Report — tech-debt #130 (PR #139, under AQP-123) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 2. Round 1 is below; round 2 is at the end of this file |
| Base…branch | `master...tech-debt/130-shared-late-failure-runner` (PR #139; merge base eed733b) |
| Commit reviewed | Round 1: a0db6c2 (commits b165c2c, a0db6c2). Round 2: `a0db6c2..9254510` |
| Date | 2026-11-09 |
| **Verdict** | Round 2: **APPROVE WITH COMMENTS** (no open Blocker, Critical or Major; 1 new Minor, QLT-09). Round 1 was REQUEST CHANGES (1 Major: QLT-01) |

## Summary

The PR changes test code only: 7 files under `tests/`, and nothing under `src/`. The runner is correct, and it does what #130 asks.

- **How it works.** `createLateFailingRunner` decides "outermost" from the caller's `AsyncLocalStorage` context when `run` is called. It sets the marker only around `work`. Then:
  - the outermost transaction throws the given error object itself, after its work has finished;
  - a nested call opens a real transaction of its own and commits it;
  - an error from the work is rethrown unchanged, and nothing is caught.
- **Re-planted independently.** I re-ran A3 and A4 against a throwaway PostgreSQL 17:
  - With the old local runners, A3+A4 is masked: every AC-5 test passes.
  - With the shared runner, A3 fails the create test of both files, and A4 fails the update test of both files.
- **The finding.** The weak point is the guard test (`late-failure-runner-use.test.ts`). It is the PR's only way to enforce requirement 2 for future files ("every new audited master's integration test"), and two ordinary ways of writing a local runner get past it:
  - a file that imports `createLateFailingRunner`, as both current files do, and also writes `run: async (work) =>` or `run(fn) {`;
  - a file that passes `{ transactions }` in shorthand.

  So the PR's claim that the guard "fails any file in `tests/integration/masters` that does not [use the shared runner]" is not true. This is the copy route by which the DEF-017 class has come back twice already. The fix is two regular expressions (QLT-01).
- **The process-items concurrency failure in the developer's A3 run does not matter for this PR.** It comes from the plant, not from the runner. I reproduced it in 2 of 5 A3 runs. It also happens with the **old** runners and A3+A4 planted. It never happened without a plant. The test uses the default real runner, so the shared runner cannot be the cause (QLT-05).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (QLT-01) |
| Minor | 1 (QLT-02) |
| Info | 6 (QLT-03 to QLT-08) |

## Checks Run

The review used a detached worktree at a0db6c2 in the scratchpad (`rq-139`). Dependencies were linked from the developer's worktree at the same head, which has an identical `package-lock.json`. The PostgreSQL 17 container (`rq139-db`, port 55439, invented passwords) was migrated with `prisma migrate deploy` and **removed afterwards**. The shared dev database was not used.

| Check | Command | Result |
|-------|---------|--------|
| PR CI | check runs of PR #139 (run 42727883033, head a0db6c2) | 5 of 5 green: Stages 1 to 11, 1 to 11b, E2E shards 1, 2 and 3 |
| Runner and guard unit tests | `npx vitest run tests/unit/late-failure-runner.test.ts tests/unit/late-failure-runner-use.test.ts` | 2 files, **18 of 18 pass** |
| Lint, changed files | `npx eslint <the 7 files>` | clean |
| Runner probes (scratch file, not committed) | vitest, in-memory runner | 3 of 3 behave as intended: (a) two overlapping outer calls, **each with a nested call**: both outer calls fail and both nested ones commit; (b) a `run` on a second runner instance inside the first counts as nested (QLT-04); (c) a nested `run` started from a timer that fires after the outer call has settled still counts as nested and commits |
| Guard probes (scratch file, not committed) | the guard's `localRunnerProblems` copied exactly | **2 of 6 local-runner forms pass the guard** (QLT-01); one false positive |
| Integration baseline, shared runner | `npx vitest run tests/integration/masters/materials.test.ts tests/integration/masters/process-items.test.ts tests/integration/audit/late-failure-runner.test.ts` | Run 1: 57 of 58 (one materials AC-1 test, not touched by this PR, see QLT-07). Run 2: 58 of 58. `materials.test.ts` alone: 28 of 28 |
| **Plant A3**, shared runner | the two masters files, 5 runs | Every run: `create: no material is left and no entry is kept` and `create: no rate is left and no entry is kept` **fail** (`expected 5 to be 4`, `expected 6 to be 5`). The process-items race test also failed in 2 of the 5 runs (QLT-05) |
| **Plant A4**, shared runner | the two masters files, 1 run | `update: the material is as it was and no entry is kept` and `update: the rate is as it was and no entry is kept` **fail**. 52 pass, nothing else fails |
| **Control: A3+A4, old local runners** (both masters files from `origin/master`) | the two masters files, 1 run | **All AC-5 tests pass: the fault is masked.** 53 of 54; the only failure is the race test (QLT-05) |
| Type-check, full unit suite, coverage | not run locally | Memory limit, per the brief. CI stages 1 to 11 are green on a0db6c2. The changed files are test support, so the `src/` coverage gate does not apply |

### The plants (diffs printed before each run)

A3, in `src/server/services/masters-service.ts` (not committed):

```diff
-async function addMaterial({ masters, audit }: MaterialDependencies, tx: Transaction, context: AuditContext, material: NewMaterial): Promise<MaterialRecord> {
+async function addMaterial({ masters, audit, transactions }: MaterialDependencies, tx: Transaction, context: AuditContext, material: NewMaterial): Promise<MaterialRecord> {
-  await audit.record(tx, { event: 'master.created', ...materialEntryFor(context, record), before: null, after: materialAuditState(record) });
+  await transactions.run((tx2) => audit.record(tx2, { event: 'master.created', ...materialEntryFor(context, record), before: null, after: materialAuditState(record) }));
-    await audit.record(tx, { event: 'master.created', ...entryFor(context, record), before: null, after: auditState(record) });
+    await transactions.run((tx2) => audit.record(tx2, { event: 'master.created', ...entryFor(context, record), before: null, after: auditState(record) }));
```

A4, in the same file:

```diff
-  { masters, audit }: MaterialDependencies,
+  { masters, audit, transactions }: MaterialDependencies,
-  await audit.record(tx, { event: 'master.edited', ...entry, before: materialAuditState(before), after: materialAuditState(after) });
+  await transactions.run((tx2) => audit.record(tx2, { event: 'master.edited', ...entry, before: materialAuditState(before), after: materialAuditState(after) }));
-    await audit.record(tx, { event: 'master.edited', ...entryFor(context, after), before: auditState(before), after: auditState(after) });
+    await transactions.run((tx2) => audit.record(tx2, { event: 'master.edited', ...entryFor(context, after), before: auditState(before), after: auditState(after) }));
```

## AC conformance (the three "Required" items of #130)

| Requirement (#130) | Implemented in | Tested by | Result |
|----|----|----|----|
| 1. One shared, service-independent late-failure runner in `tests/support/`. It fails the outermost transaction only, with no retry and no raised limit (DL-057). `late-failure.ts` may use it | `tests/support/late-failure-runner.ts:32-45`; `tests/support/late-failure.ts:88` (the DEF-017 depth counter is replaced) | `tests/unit/late-failure-runner.test.ts` (10), `tests/integration/audit/late-failure-runner.test.ts` (4, real PostgreSQL), and my probes. `audit-atomicity.test.ts` (the user service) is green in CI | **Met.** The runner delegates to `real.run` once, so the 5 s `maxWait` and 10 s `timeout` of `createTransactionRunner` stay. A non-busy error goes through `withDatabaseErrors` unchanged, so callers see the same error object |
| 2. `materials.test.ts` and `process-items.test.ts` use it instead of their local runners, and so does every new audited master's integration test (02.04, 02.05, 02.02) | `materials.test.ts:259-262`, `process-items.test.ts:221-224`; the guard `tests/unit/late-failure-runner-use.test.ts` | Plants A3 and A4 (above); the guard's 8 tests | **Partly met.** Met for the two current files. For future files the guard can be passed with an ordinary local runner (QLT-01) |
| 3. Proof: plant A3 and A4. Each must fail the developer's materials file, and the same forms must fail the process-items file. Print each plant's diff before reading the result | The Dev Record's proof table | Re-run here: A3 and A4 each fail both files on the shared runner, and are masked on the old runners | **Met**, now with the diffs on record (above). The developer's diffs were printed locally but are not on the PR (QLT-05) |

Design check against #130. Nested calls get a **real separate transaction** that commits. They do not join the outer one. This is what #130 asks for: a joined entry would be rolled back with the change, and the bypass would be hidden again. The PR's "Decisions & deviations" says so correctly. The production runner `src/server/repositories/transaction.ts` is unchanged.

## Findings

| ID | Severity | File:line | Rule / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------|-------|--------|---------------|
| QLT-01 | **Major** | `tests/unit/late-failure-runner-use.test.ts:20-22` | #130 req. 2; DL-107; DL-121 (3) | The guard reads the file as text and has two holes: (a) the `run` check matches only `run: work`, `run: (work`, `run(work` and `run<T>(`; (b) the "injects a runner" check needs `transactions:` with a colon, or a function return type `): TransactionRunner`. Of 6 local-runner forms I fed it, these pass: shorthand `buildMastersService({ transactions })` with an untyped object, giving `[]`; and a file that imports `createLateFailingRunner`, as **both current files do**, plus `run: (unit) =>` / `run: async (work) =>` / `run(fn) {`, also giving `[]`. It also flags a plain forwarding call `real.run(work)` as a "run method of its own" (false positive) | The next audited master's test (02.04, 02.05, 02.02) will most likely be a copy of `materials.test.ts`, import included. A local runner written with `async` or another parameter name would then pass the guard, and the DEF-017 class would come back unseen. #130 route: the A3/A4 re-plant is promised only for AQP-123's G6, so for 02.05 and 02.02 this guard is the only control. The PR body's claim that the guard "fails any file … that does not" is not true as written | Match any `run` **definition** (property, method, async, generic, any parameter name) and allow only `.run(` calls. Count shorthand `transactions` as injecting. Require a call `createLateFailingRunner(`, not just the name. Add the evading forms as plants. See the snippet below; I checked it on the 7 forms and on the 3 current masters files: no false positives, every form caught |
| QLT-02 | Minor | `tests/unit/late-failure-runner.test.ts:86-98` | #130 req. 1 (the AsyncLocalStorage claim) | The concurrency test covers two overlapping **top-level** calls with no nesting. The case that justifies `AsyncLocalStorage` over a counter is not tested: two overlapping requests, each with a bypass, where each nested call must be nested only in its own outer call | Today it passes (my probe (a)). If someone later "simplifies" the runner back to a counter, or a store that is not reset per call, then only the existing test stands guard, and it does not cover nested isolation | Add one test: two `runner.run` calls started together. Each writes `o1`/`o2` and makes one nested `run` (`i1`/`i2`) at a different time. Expect both to reject with `LATE` and `committed` to be `['i1','i2']` in any order (the snippet is below) |
| QLT-03 | Info | `tests/integration/masters/materials.test.ts:261`, `process-items.test.ts:223` (and the `rejects.toThrow(LATE_FAILURE)` lines below them) | runner contract ("thrown, as this very object … A test asserts on it") | The masters AC-5 tests create a new `Error` on each call and match it by **message** substring. They do not check it is the same object. This is unchanged from before, but the shared runner now offers an identity check | A different error with the same text would pass. This is unlikely, so it is Info | Keep the error in a `const` in the `describe` and use `rejects.toBe(failure)`, as `tests/integration/audit/late-failure-runner.test.ts:50` does |
| QLT-04 | Info | `tests/support/late-failure-runner.ts:26` | design note | The marker store is shared by the whole module. A `run` on a **second** late-failing runner, called inside the work of a first, counts as nested and does not fail (probe (b)). For this purpose that is the right result, because the entry then commits on its own and the test sees it. The header does not say so | None today. Every caller builds one runner per service | Optional: one sentence in the header ("nesting is per async context, across runner instances") |
| QLT-05 | Info | `tests/integration/masters/process-items.test.ts:262-272` (not in the diff); PR #139 Dev Record, the "A3 alone" row | brief question | **Judgement: it does not matter for this PR.** The race test failed in 2 of 5 A3 runs on the shared runner, **and** in the control run with the old runners and A3+A4. It never failed in 3 runs without a plant, or in the A4 run. The test builds `db.mastersService`, which uses the default real runner, so `createLateFailingRunner` takes no part. The error was `FieldValidationError` `RATE_NAME_REFUSED` where `NAME_TAKEN` was expected, for one of the losing callers. So the extra transaction the plant puts inside the create changes which caller gets the lock first, and one spelling is then refused for another reason. I did not find which spelling or rule; a scratch instrumentation of the test was not permitted in this session. The Dev Record also gives no plant diffs, although #130 asks for them to be printed | The race test acts as a second, non-deterministic detector of A3. It is not a fault of this change | Developer: in the Dev Record, change "not investigated" to the facts above. If anyone wants to know which spelling is refused, an instrumented run that logs each caller's `code` and message under A3 will show it. No issue is needed for this PR |
| QLT-06 | Info | `tests/unit/late-failure-runner-use.test.ts:15` | #130 req. 2 | The guard only reads `tests/integration/masters/*.test.ts`, and finds runners only through `buildMastersService` or a return type. A future audited service built some other way (another folder, or `createMastersService` called directly) is not guarded | Low: EPIC-02's audited masters live in this folder and use `buildMastersService` | Keep in mind when 02.02 lands. The fix for QLT-01 covers the forms inside the folder |
| QLT-07 | Info | `tests/integration/masters/materials.test.ts:125` (not in the diff) | stability note | On the first run against a freshly migrated database, `reads no number for the options …` failed once. It passed in the 3 runs after that, alone and with the other files. It uses `db.mastersService` (the default runner), so this PR is not involved. I did not capture the error message | Possibly a cold-start flake of an existing test. One occurrence; no evidence that it is linked to this PR | None for this PR. QA can watch for it in CI |
| QLT-08 | Info (good practice) | `tests/support/late-failure-runner.ts:32-45`; `tests/unit/late-failure-runner.test.ts` | — | Good practice: the outermost check is read in the caller's context and the marker set around `work` only, so it is correct however Prisma schedules the callback. The error is rethrown unchanged with no `try/catch`. The developer showed by mutation that the tests have teeth (`if (true)` and the counter version each fail tests). The DEF-017 limit (an entry committed *before* the change) is documented in both helpers. `late-failure.ts` became simpler without changing behaviour | — | — |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-01

**Current** (`tests/unit/late-failure-runner-use.test.ts:18-24`)
```ts
function localRunnerProblems(source: string): string[] {
  const problems: string[] = [];
  const injectsRunner = /buildMastersService\(\s*\{[^}]*\btransactions\s*:/.test(source) || /\)\s*:\s*TransactionRunner\b/.test(source);
  if (injectsRunner && !/\bcreateLateFailingRunner\b/.test(source)) problems.push('uses a runner without createLateFailingRunner');
  if (/\brun\s*:\s*\(?\s*work\b|\brun\s*\(\s*work\b|\brun\s*<\s*T\s*>\s*\(/.test(source)) problems.push('declares a run method of its own');
  return problems;
}
```

**Probe results** (the function above, copied exactly)
```
run: async (work) => …  + buildMastersService({ transactions: failing() })   -> ['uses a runner without …']   (caught only because no import)
run: (fn) => …                                                                -> ['uses a runner without …']   (same)
const transactions = { run: (unit) => … }; buildMastersService({ transactions }) -> []                          (passes)
import { createLateFailingRunner } …; run: (unit) => …                         -> []                          (passes)
real.run(work)  (a forwarding call, with the import)                         -> ['declares a run method …'] (false positive)
```

**Suggested**
```ts
/** A `run` that the file defines: a property, a method, async or generic, whatever its parameter is called. A `.run(` call is not one. */
const RUN_DEFINITION = /(?<![.\w$])(?:async\s+)?run\s*(?:<[^>]*>)?\s*[:(]/;
/** The service is given a runner: `transactions: x` or the shorthand `{ transactions }`, or a function typed to return one. */
const INJECTS_RUNNER = /buildMastersService\(\s*\{[^}]*\btransactions\b|:\s*TransactionRunner\b/;

function localRunnerProblems(source: string): string[] {
  const problems: string[] = [];
  if (INJECTS_RUNNER.test(source) && !/\bcreateLateFailingRunner\s*\(/.test(source)) problems.push('uses a runner without createLateFailingRunner');
  if (RUN_DEFINITION.test(source)) problems.push('declares a run method of its own');
  return problems;
}
```
Add plants for `run: async (work) =>`, `run(fn) {`, `async run(fn) {`, `run<R>(`, and the shorthand `{ transactions }`, each **with** the shared import present. Add one negative case: `db.transactions.run((tx) => …)` gives `[]`. I checked `RUN_DEFINITION` on the three current files in `tests/integration/masters/`: no match, so there are no false positives. All five forms above match it.

### QLT-02

**Suggested** (in `tests/unit/late-failure-runner.test.ts`)
```ts
it('keeps two overlapping outer calls apart: each nested call belongs to its own outer one', async () => {
  const store = createStore();
  const runner = createLateFailingRunner(store.runner, LATE);
  const first = runner.run(async (outer) => {
    store.write(outer, 'o1');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await runner.run((inner) => Promise.resolve(store.write(inner, 'i1')));
  });
  const second = runner.run(async (outer) => {
    store.write(outer, 'o2');
    await runner.run((inner) => Promise.resolve(store.write(inner, 'i2')));
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
  const settled = await Promise.allSettled([first, second]);
  expect(settled.map((result) => (result.status === 'rejected' ? result.reason : 'resolved'))).toEqual([LATE, LATE]);
  expect([...store.committed].sort()).toEqual(['i1', 'i2']);
});
```
</details>

## Answers to the brief's questions

| Question | Answer |
|----|----|
| Does the design match #130? | Yes. Only the outermost transaction fails. A nested call opens a real, separate transaction that commits, so a second-transaction entry is not rolled back and the test fails on it. There is no retry and no raised limit |
| Correct under nesting and concurrency? | Yes. Any depth works (unit test "every level below the outermost"). Overlapping top-level calls each fail (unit test). Overlapping calls with nesting stay apart (probe; QLT-02 asks for a committed test) |
| Error rethrown unchanged? | Yes. The outermost call throws the given object itself. A work or nested error propagates through `await` with no `catch`, and the real runner's `withDatabaseErrors` passes non-busy errors through as they are (`database-errors.ts:78-80`). Covered by unit tests and by `tests/integration/audit/late-failure-runner.test.ts:47-94` |
| Is anything swallowed? | No. There is no `try/catch` in the runner. A nested call's result is returned to its caller (unit test "returns its result") |
| Does the guard really stop a masters file from passing its own runner? | **No, not in general.** It stops the exact old form and some variants. It misses the shorthand form, and any local `run` not written literally as `run: work` / `run(work` / `run<T>(` in a file that imports the shared helper (QLT-01) |
| Do the moved callers keep their coverage? | Yes. Each AC-5 test is unchanged except for the runner (create, update and delete for process items; create and update for materials). Unplanted, they pass; with A3 or A4 they now fail where they used to pass |
| Does the extra concurrency failure in the A3 run matter? | Not for this PR. It comes from the plant, it happens with the old runners too, and it does not go through the shared runner (QLT-05) |

## Issues for other roles

- **developer:** fix QLT-01 (and QLT-02 if convenient) in PR #139, and update the Dev Record for QLT-05.
- **qa-engineer:** no action. QA's own runners in `aqp-113-audit.test.ts:142` and `aqp-122-materials-audit.test.ts:164` are untouched, and the follow-up to move them is the developer's suggestion.
- **reviewer-quality (AQP-123 G6):** #130 still asks for A3 and A4 to be re-planted on AQP-123's new integration file. The plant script used here is re-usable.

## Previous Findings (re-review only)

None (round 1).

---

# Round 2: `a0db6c2..9254510`

## Summary (round 2)

Commit 9254510 changes 2 files under `tests/unit/`, with 119 lines added and 10 removed. Nothing under `src/` is touched, and the runner itself is unchanged.

- **QLT-01 is fixed, and the fix goes further than my suggestion.** The guard now parses each masters integration file with the TypeScript compiler API, not by text. It refuses a file that defines a member named `run`, or one that gives the masters service a runner without calling `createLateFailingRunner(`. Every form from round 1 is caught, plus quoted, computed and shorthand names and class methods. A call such as `real.run(work)` is no longer a false positive, and comments or strings are no longer read as code.
- **QLT-02 is fixed.** I checked the new test by mutation: with a shared depth counter in place of `AsyncLocalStorage`, both concurrency tests fail.
- **QLT-05 is closed.** The PR description now gives the facts.
- **One new Minor, QLT-09.** The guard's header says it refuses a `run` member "in any form", but two forms still pass:
  - a **class field** (`class X { run = async (fn) => … }`);
  - an **assignment** (`r.run = …`, `r['run'] = …`).

  The fix is two node kinds. I checked it on a copy of the guard.

| Severity (round 2, new) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 (QLT-09) |
| Info | 1 (QLT-10) |

## Checks Run (round 2)

The review worktree was moved to 9254510 (detached) in the scratchpad (`rq-139`). No database was needed: the diff is unit-test code only.

| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff a0db6c2..9254510` | 2 files: `tests/unit/late-failure-runner-use.test.ts` (+100 / −10) and `tests/unit/late-failure-runner.test.ts` (+19) |
| Runner and guard unit tests | `npx vitest run tests/unit/late-failure-runner.test.ts tests/unit/late-failure-runner-use.test.ts` | 2 files, **31 of 31 pass** |
| Lint, changed files | `npx eslint` on the 2 files | clean |
| QLT-02 mutation | runner changed to a shared `depth` counter (not committed; restored afterwards) | **2 tests fail**: the earlier concurrent top-level test, and the new overlapping-and-nested test. The others pass |
| AST guard probe | the guard's exact code at 9254510, transpiled and run on 8 more forms and the 3 current masters files (scratch script, not committed) | The 3 files give `[]`. Calls only, and an `interface` that declares `run`, give `[]` (correct). Class field, typed class field, `r.run =` and `r['run'] =` give `[]` (**missed**, QLT-09). `Object.defineProperty(…, 'run', …)` and a runner from an imported helper give `[]` (limits, QLT-10) |
| QLT-09 fix probe | the same code with `ts.isPropertyDeclaration` added and an assignment check | All 4 missed forms are caught. The 3 masters files, the calls-only case and the interface still give `[]` |
| `typescript` dependency | `package.json` | A direct `devDependency` (5.9.3), so the guard depends on no transitive package |
| PR CI | check runs of PR #139 (run 42730771190, head 9254510) | 5 of 5 green; see "CI (round 2)" below |

## Previous Findings (round 1 → round 2)

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-01 | Major | **Fixed** | 9254510. The AST guard catches every round-1 form: a renamed parameter, an async arrow, a method, an async or generic method, and the shorthand `{ transactions }`, each **with the shared helper imported and called**. It also catches quoted, computed-string and shorthand `run` members and class methods. It refuses a helper that is imported but never called. A forwarding call `real.run(work)`, `db.transactions.run(…)`, comments and strings are not flagged. The 3 current files are clean. The developer reports that the old `process-items.test.ts` still fails the guard. Two forms remain open, so I raised QLT-09 as a new, smaller finding |
| QLT-02 | Minor | **Fixed** | 9254510 adds `keeps two overlapping outer calls apart …` (`late-failure-runner.test.ts:100-117`). I confirmed it by mutation (above) |
| QLT-03 | Info | Not changed (accepted) | The developer keeps the moved tests a pure runner swap. AQP-123's new file can use `rejects.toBe(failure)` from the start |
| QLT-04 | Info | Not changed (accepted) | Optional header sentence |
| QLT-05 | Info | **Closed** | The PR description now records the facts in place of "not investigated" |
| QLT-06 | Info | Open (accepted) | The PR description's follow-ups now state the scope limit |
| QLT-07 | Info | Open (note) | No action for this PR |
| QLT-08 | Info | — | Note |

## Findings (round 2, new)

| ID | Severity | File:line | Rule / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------|-------|--------|---------------|
| QLT-09 | Minor | `tests/unit/late-failure-runner-use.test.ts:41-47` (`isNamedMember`) and `:55` (the `run` check in `visit`) | #130 req. 2; the guard's own header (`:15`, "in any form") | `isNamedMember` recognises property assignments, method declarations (object and class), accessors and shorthand. It does **not** recognise a class **property declaration**, and `visit` has no check for an **assignment** to `run`. These pass with `[]` even with the shared helper imported and called: `class Failing { run = async (fn) => real.run(fn); }`, the same with a type annotation, `r.run = (fn) => …`, and `r['run'] = (fn) => …` | A local runner written as a class with an arrow-function field, or built by assignment, would pass. Both forms are less common than the ones QLT-01 closed, but 8 test files in this repo already declare classes. The header and the PR description say "any form", which is not quite true | Add `ts.isPropertyDeclaration(node)` to `isNamedMember`, and an assignment check in `visit` (snippet below). Add the 4 forms to the `it.each` table. I checked both changes: all 4 forms are caught, and the 3 masters files, the calls-only case and an `interface` that declares `run` stay clean |
| QLT-10 | Info | `tests/unit/late-failure-runner-use.test.ts:7-19` (header) | scope note | Two forms are out of reach of a check on one file's syntax: `Object.defineProperty(x, 'run', …)`, and a bad runner defined in **another** file (for example a new `tests/support/*` helper) and imported. Both give `[]` | Low. The first is contrived, and the second would be a new support file that review would see. But the header should not claim more than the check does | State these two limits in the header next to the QLT-06 scope note. A bad runner in a support file is caught by the A3/A4 re-plant, not by this guard |

<details><summary>QLT-09 suggested code (round 2)</summary>

```ts
function isNamedMember(node: ts.Node, wanted: string): boolean {
  if (ts.isShorthandPropertyAssignment(node)) return node.name.text === wanted;
  if (ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
    return memberName(node.name) === wanted;
  }
  return false;
}

/** `x.run = …` or `x['run'] = …`: a `run` made by assignment. */
function isRunAssignment(node: ts.Node): boolean {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return false;
  const target = node.left;
  if (ts.isPropertyAccessExpression(target)) return target.name.text === 'run';
  if (ts.isElementAccessExpression(target)) {
    const key = target.argumentExpression;
    return (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) && key.text === 'run';
  }
  return false;
}

// in visit():
if (isNamedMember(node, 'run') || isRunAssignment(node)) seen.definesRun = true;
```

More rows for the `it.each` table:
```ts
['a class field', 'class Failing { run = async (fn) => real.run(fn); } const failing = () => new Failing();'],
['a typed class field', "class Failing { run: TransactionRunner['run'] = (fn) => real.run(fn); } const failing = () => new Failing();"],
['an assignment', 'const failing = () => { const r = {} as TransactionRunner; r.run = (fn) => real.run(fn); return r; };'],
['an element assignment', "const failing = () => { const r: any = {}; r['run'] = (fn) => real.run(fn); return r; };"],
```
</details>

## CI (round 2)

Run 42730771190 on head 9254510 is **green, 5 of 5**: Stages 1 to 11, Stages 1 to 11b, and E2E shards 1, 2 and 3 (all completed by 00:51:38Z). I read it once through the check-runs API. A `gh pr checks --watch` started earlier was stopped by the session because memory was low, and was not restarted.

## Verdict (round 2)

**APPROVE WITH COMMENTS.** There are no open Blocker, Critical or Major findings. QLT-01 (Major) and QLT-02 (Minor) are fixed. QLT-09 (Minor) is cheap and recommended before merge or with AQP-123's first commit, because 02.04 is the first story the guard has to protect. Whether it holds the merge is master's call at G6. QLT-10 is Info.
