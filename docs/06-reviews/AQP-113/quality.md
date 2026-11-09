# Review Report — AQP-113 (STORY-02.01) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `origin/master...origin/feat/AQP-113-process-master` (PR #107) |
| Commit reviewed | 62267af |
| Date | 2026-11-06 |
| **Verdict** | **REQUEST CHANGES** (2 Major) |

## Summary

The Process master is well built. Each change and its audit entry are written in one transaction with the change's own `tx`, as architecture v0.29 §6 requires. The `failingAfterTheLastStep` integration tests prove this: the change and its entry roll back together. The database enforces the name rules (`uq_process_items_name_lower`) and the value rules (CHECK) as a backstop, and rates travel as decimal text throughout. The role check runs before any lookup. Every AC has code and a test behind it.

There are two blocking issues:

- **QLT-01.** The DEF-006 fix works in one direction only. A compound name is refused when its parts already exist. But adding or renaming a *part* after the compound exists is still accepted. A reviewer probe reproduced the silent round-trip change of DEF-006 this way.
- **QLT-02.** The new DEF-006 race test orders audit entries by a millisecond timestamp. The developer fixed this same tie problem elsewhere in this PR, so the test can fail at random in CI, where retries are off (DL-057).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 (QLT-01, QLT-02) |
| Minor | 6 (QLT-03 to QLT-08) |
| Info | 6 (QLT-09 to QLT-14) |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| PR CI | GitHub check runs for 62267af (run 42316869370) | 4 of 4 green: Stages 1 to 11, Stages 1 to 11b, E2E shard 1, E2E shard 2 |
| Unit + acceptance at PR head (scratchpad worktree, Prisma client generated there) | `npx vitest run tests/unit tests/acceptance` | 2,754 passed, 7 failed, 114 skipped. All 7 failures are environmental and outside the PR's files: 3 acceptance files need `MIGRATE_DATABASE_URL`, and `playwright-system-deps.test.ts` is a Linux-only script. Every test file the PR adds or changes under `tests/unit` and `tests/acceptance` passed |
| DB-backed suites (`tests/integration/masters`, `tests/integration/audit`, security) | `npx vitest run tests/integration/masters ...` | **Not run locally.** The local DB container uses credentials from `.env*`, which this reviewer may not read. Relying on CI stage 11 (green) |
| E2E `tests/e2e/process-master.spec.ts` | not run locally | CI shards green |
| Coverage | not run locally (needs the DB levels) | CI stage 6 and stage 11 gates green |
| DEF-006 probe, reverse order | throwaway test in the scratchpad worktree (not in the repo, not committed) | Defect reproduced, see QLT-01 |
| DEF-006 tests against the old code | reasoning from the probe | The old `readsAsFormulaText(name)` equals the new function with an empty rate list. The probe shows it returns `[]` for `Cost-Waste`, `Cost 2`, `Cost AB` and `Cost Cost`, so every new "refuses …" case and the AQP-106 AC-6 test **would fail on the old code**. The "still accepts" and duplicate cases pass on both, which is correct for guards. Running the tests against the old file directly was refused by the permission system |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Major | `src/server/services/masters-service.ts:80-85`, `src/lib/formula/rate-names.ts:55-66` | DEF-006 (GH #49), AC-2, AC-3 | The check judges only the **new** name against the others. It never asks whether an **existing** name becomes readable as other names plus an operator once the new name joins the set. Probe: with `Cost-Waste` present, adding `Cost` and then `Waste` is accepted. `toDisplayForm('{{rate:Cost}}-{{rate:Waste}}')` is then `Cost-Waste`, and `toInternalForm` turns it into the compound rate (round trip equal: false). Renames reach the same state: a formula stored with `Alpha` and `Beta`, `Gamma-Delta` existing, then `Alpha`→`Gamma` and `Beta`→`Delta`. The integration race test (lines 292-293) records this one-way rule as intended | A formula re-saved from display form (the R2 formula editor) silently prices a different rate with no error. That is exactly the DEF-006 outcome. The ambiguous set of names can be created **now**, through this story's screen, and stays in the database | Judge the whole resulting set. In `assertNameUsable`, after checking the new name, also check every other name `E` against `(others − E) + newName` with `rateNameIssues`, and refuse with `RATE_NAME_REFUSED`. With n ≈ 15 this costs nothing. QA should not close DEF-006 until this is fixed |
| QLT-02 | Major | `tests/integration/masters/process-items.test.ts:281-298` | Test strategy §10 (DL-057, retries off) | The race test finds the order of creation from `audit_log ORDER BY created_at, id`. `created_at` is `clock_timestamp()` cut to the millisecond (architecture §8), and `id` is a random UUID. Two creations that the table lock puts one after the other can share a millisecond, and the random `id` then decides their order. The test can then read `[Qq, Rr, C]` when the real order was `Qq, C, Rr`, and fail line 295. This is the same tie the developer fixed in `audit-database.test.ts` | A random red CI on unrelated PRs with retries off, or a false pass. The assertions also accept almost any outcome, so the test pins little | After QLT-01 the outcome is the same in every order: **exactly two of the three creations succeed**, and the refusal is `RATE_NAME_REFUSED`. Assert that and drop the ordering. Add two deterministic sequential tests (parts then compound; compound then parts) |
| QLT-03 | Minor | `src/server/services/masters-service.ts:175-176` | Concurrency; cross-ref PRF-01 | Delete takes the row lock (`FOR UPDATE`) without `lockProcessItems`. Update takes `SHARE ROW EXCLUSIVE` and then the row lock. A delete and an update of the **same** rate at once deadlock: the delete holds the row and waits for `ROW EXCLUSIVE`, while the update holds `SHARE ROW EXCLUSIVE` and waits for the row. PostgreSQL then aborts one with 40P01, and `withDatabaseErrors` passes that through as a 500 | A rare 500 for an Admin acting in two tabs. No data harm | Call `await masters.lockProcessItems(tx)` first in delete, which gives the same lock order everywhere (one line, as PRF-01). Test: race a delete and an update of one ID; neither ends in 500 |
| QLT-04 | Minor | `src/server/services/masters-service.ts:173-174` | AC-4, architecture §4.5 | The used-by check reads the current configuration outside the transaction, with no lock on `config_versions`. Today only `ensure-seed-version` writes versions, so this is safe now. Once the R2 editor publishes versions, a publish that starts using a rate can race a delete of that rate | A formula that refers to a deleted rate (R2) | Open a `follow-up` issue for the config-publish story: either publish checks every `{{rate:<id>}}` exists under `lockProcessItems`, or delete re-reads the current version inside the transaction with a shared lock |
| QLT-05 | Minor | `src/server/services/masters-service.ts:132, 169` | Error paths; cross-ref PRF note | `usesByRate()` runs **after** the commit in create and update. If the configuration cannot be read, the route answers 500 for a change that was saved and audited. The dialog then says "could not add", and a retry gets "A rate with this name already exists." | Misleading error and a confusing retry | Read the uses before `transactions.run`, as delete already does, so a failure happens before anything is written |
| QLT-06 | Minor | `src/components/features/masters/process-delete-dialogs.tsx:73-74`; `process-form-dialog.tsx:148` | AC-8 (error state) | A 404, when the rate was deleted elsewhere, shows the generic "Try again" notice. Retrying always fails, and the list is not refreshed | The Admin is stuck in a dialog that cannot succeed | For `httpStatus === 404`, close the dialog, refresh the list, and say the rate no longer exists |
| QLT-07 | Minor | `tests/support/process-master-canary.ts:7` | AC-6, dependency AQP-57 (blocks this story) | AC-6 says "adds its values to `canaryMasters` (story 01.03)". That file does not exist yet, because AQP-57 is Ready for Dev and not merged. The interim test checks every Engineer route in the manifest plus the Process master routes and page, so the substance holds (no rate reaches an Engineer). The literal AC part is deferred | AC-6 is not fully met until 01.03 runs the full scan | Master to rule. Accept as interim, and put a note on AQP-57 that 01.03 must import `PROCESS_MASTER_CANARIES` (agrees with reviewer-standards) |
| QLT-08 | Minor | `tests/e2e/process-master.spec.ts:236` | AC-8 | AC-8 lists four states. "No match" and "Error / Try again" are tested. "Skeleton after 300 ms" and "Empty state with an Add action" have no test for this screen. The empty state has no action of its own and relies on the header's "Add rate", which is on the same screen and so meets the AC text | A regression in two AC-8 states would not be caught | Add a component or E2E test: delay the GET by more than 300 ms and assert the skeleton and `aria-busy`; fulfil an empty list and assert "No rates yet" with "Add rate" visible |
| QLT-09 | Info | `tests/integration/audit/audit-database.test.ts:233-235, 252-253` | Developer Q5; AQP-74 AC-3 | Judged: the change from sequence to set **does not weaken** what the story promises. Order inside one transaction was never a requirement, because both entries carry the same instant to the millisecond. The count, the events, the labels and the row state are still asserted, and the DEF-017 tests still prove atomicity. Side effect: SCR-16 shows same-millisecond entries in a random but stable order (the `(created_at, id)` keyset stays correct) | none | Worth a line in test-strategy §10: "entries of one transaction are compared as a set". If the order on SCR-16 ever matters, the architect could add a sequence column. QLT-02 is the same problem in new code |
| QLT-10 | Info | `src/server/services/audit-events.ts` (master events) | AC-5; developer Q2 | `master.created/edited/deleted` with `object_type = 'process_item'` follows architecture §8 (AQP-74 ruling, which allows `master.created` and `master.deleted` "without a new ruling"). The AC-5 text `master.process_item.*` is out of date | none | Product-owner to correct the AC-5 text; no code change |
| QLT-11 | Info | `src/components/features/masters/process-delete-dialogs.tsx:159` | AC-4; developer Q3 | The refusal links to `/config/fields`, which is `planned` (R2) and answers 404 today. AC-4 asks for a link | A dead link in R1 | UX or PO to choose: keep it as AC-4 says, or render the label as text while the manifest row is `planned` |
| QLT-12 | Info | `src/components/features/masters/process-form-dialog.tsx:61-69` | AC-3 | The edit form checks all three fields, including an unchanged default. The column holds 4 decimals, so a value loaded with 3 or 4 decimals (for example through #108's placeholders) blocks a rename until the value is retyped | Unlikely; would confuse the Admin | Check the default only when it changed, or make sure #108's placeholders have at most 2 decimals |
| QLT-13 | Info | — | Developer Q1, Q4 | Q1: see QLT-07. Q4: Clear filters on "no match" follows AC-8; the 14 versus 15 in architecture §5.1 and §5.6 and the SCR-11 mock-up is for the solution-architect and ux-expert; the story says 15 | — | — |
| QLT-14 | Info (praise) | `masters-service.ts`, `master-repository.ts`, `process-items.test.ts:220-266` | Architecture v0.29 §6, AC-5 | Every `audit.record` call takes the `tx` of its own `transactions.run`. No entry is written in a separate transaction. The late-failure runner and the refused-entry test prove the change and its entry roll back together. The database rule for names is the backstop of the code check, and races on one name end in `NAME_TAKEN`. Decimal text is used throughout | — | — |

<details><summary>Detailed notes and code suggestions</summary>

### QLT-01

**Probe (scratchpad only):**
```
add Cost-Waste with none:            []   (accepted)
add Cost with [Cost-Waste]:          []   (accepted)
add Waste with [Cost-Waste, Cost]:   []   (accepted)
display of {{rate:Cost}}-{{rate:Waste}}: "Cost-Waste" | round trip equal: false | became the compound: true
```

**Suggested (`masters-service.ts`):**
```ts
function assertNameUsable(name: string, otherNames: ReadonlyArray<string>): void {
  const lower = name.toLowerCase();
  if (otherNames.some((other) => other.toLowerCase() === lower)) throw nameRefusal(NAME_TAKEN_MESSAGE, NAME_TAKEN_CODE);
  const [issue] = rateNameIssues(name, otherNames);
  if (issue !== undefined) throw nameRefusal(issue.message, NAME_REFUSED_CODE);
  // DEF-006 in the other direction: the new name must not make an existing name read as other names and an operator.
  for (const existing of otherNames) {
    const rest = [...otherNames.filter((other) => other !== existing), name];
    if (rateNameIssues(existing, rest).some((found) => found.code === 'RATE_NAME_IS_COLUMN_LETTER')) {
      throw nameRefusal(REFUSED_BY_EXISTING_MESSAGE, NAME_REFUSED_CODE);
    }
  }
}
```
Here `REFUSED_BY_EXISTING_MESSAGE` is new wording that does not repeat any name (STD-05 rule), for example "This name would make another rate's name read as a formula." The rule could also live in `src/lib/formula/rate-names.ts` as `rateSetIssues(names)`, so that the formula engine owns it.

**Tests that would catch it:** unit `rateNameIssues`/service: refuse `Waste` when `Cost` and `Cost-Waste` exist; refuse renaming `Alpha` to `Gamma` and then `Beta` to `Delta` when `Gamma-Delta` exists (the second rename is refused); integration: the same against PostgreSQL.

### QLT-02

**Suggested:**
```ts
const attempts = await Promise.allSettled(['Qq-Rate', 'Rr-Rate', 'Qq-Rate-Rr-Rate'].map(create));
expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(2);
expect(attempts.filter((a) => a.status === 'rejected').map((a) => (a as PromiseRejectedResult).reason)).toMatchObject([{ code: NAME_REFUSED_CODE }]);
```

### QLT-03

**Suggested:**
```ts
await transactions.run(async (tx) => {
  await masters.lockProcessItems(tx); // same lock order as create and update: table, then row
  const before = await masters.findProcessItemForUpdate(id, tx);
```
</details>

## Reviewer-specific tables

### AC conformance

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 list, Used in, search, 15 seed items at 0 | migration `20261107090000_process_items`, `master-repository.ts`, `rate-usage.ts`, `process-screen.tsx`, `process-list.tsx` | `process-items.test.ts` AC-1 block (rows equal `seed-ids.ts`, all 0), `masters-service.test.ts`, `rate-usage.test.ts`, E2E list test | Met ("Customers with own value" is for 02.02, as the AC says) |
| AC-2 add: unique ignoring case, not a column letter, unit list, 0+ with 2 decimals, hint, Decimal(18,4) | `views/schemas/process-items.ts`, `lib/masters/process-items.ts`, `masters-service.ts`, migration index and CHECK | service and route unit tests, integration AC-2 blocks, E2E add test | Met. The DEF-006 part is incomplete (QLT-01) |
| AC-3 edit name, unit, default; formulas hold the ID | `masters-service.ts` update, `process-form-dialog.tsx` | integration AC-3 block (ID kept, usedBy unchanged), E2E edit test | Met (QLT-01 applies to renames) |
| AC-4 used rate → 409 with formulas and link; unused deleted after confirmation | `masters-service.ts` delete, `ProcessItemInUseError`, `problem.ts`, `process-delete-dialogs.tsx` | integration AC-4 block (two formulas listed), route tests, E2E delete and blocked tests | Met (QLT-04 future race, QLT-11 link) |
| AC-5 exactly one audit entry; none for a refusal | `audit-events.ts`, `audit-service.ts` (`objectType`), the service in the same `tx` | `audit-database.test.ts` AC-3 scenarios, `process-items.test.ts` DEF-017 block, `masters-audit-events.test.ts` | Met. The event names follow architecture §8, and the AC text is out of date (QLT-10) |
| AC-6 role first, 403/401, SCR-26, no rate to an Engineer, canaryMasters | manifest rows, `withRoute`, `authorizePage`, `process-master-canary.ts` | `role-matrix.test.ts`, `process-master-confidential.test.ts`, `csrf.test.ts`, route tests | Met in substance with an interim scan. The `canaryMasters` part waits on AQP-57 (QLT-07) |
| AC-7 three widths, 44 px, axe, keyboard dialogs | screen and dialog components | `tests/e2e/process-master.spec.ts` (10 tests × 3 widths, CI green) | Met |
| AC-8 skeleton 300 ms, empty with Add, no match with Clear filters, error with Try again | `process-screen.tsx` | E2E covers no match and error | Met in code; the tests for skeleton and empty are missing (QLT-08) |
| AC-9 README First use sentence | `README.md` | `tests/unit/readme-first-use.test.ts` | Met |

### DEF-006 (GH #49) verification

| Question | Answer |
|----------|--------|
| Is the reported case (compound added after its parts) refused? | Yes: `RATE_NAME_IS_COLUMN_LETTER` / service `RATE_NAME_REFUSED` |
| Would the new tests fail on the old code? | Yes, for every "refuses …" case and the rewritten AQP-106 AC-6 test (see Checks Run) |
| Is the defect class closed? | **No.** Reverse order and renames still reach it (QLT-01) |

## Previous Findings (re-review only)

n/a (round 1)

## Issues for other roles

- product-owner: AC-5 event names (QLT-10).
- solution-architect: QLT-04 follow-up for the config-publish story; the 14 versus 15 in §5.1 and §5.6; the `@one-width` ruling (no quality objection to tagging the three tests the developer proposed: they read server rules and text, not layout).
- ux-expert / product-owner: the link to the planned `/config/fields` (QLT-11).
- test-strategy owner: a §10 line on comparing same-transaction audit entries as a set (QLT-09).
- qa-engineer: do not close DEF-006 on 8d15405 alone (QLT-01).

---

## Round 2

| Field | Value |
|-------|-------|
| Review round | 2 |
| Diff reviewed | `62267af..66ae5117` (fix push: bc09fac, f2e9fe1, 66ae511, 7bec601). The update-branch merge a4d4d57 is docs-only and was not reviewed |
| CI | Run 42326697243 on 66ae511: green (developer, comment 11144). Run 42327412105 on a4d4d57: verify and E2E shard 2 green, shard 1 still in progress when checked |
| Date | 2026-11-06 |
| **Verdict** | **REQUEST CHANGES** (1 Major, QLT-15) |

### Summary

Every round-1 finding the coordinator listed is fixed and tested:

- **QLT-01:** `rateSetIssues` judges the whole resulting set on create and rename.
- **QLT-02:** the race test no longer depends on order.
- **QLT-03:** delete takes the table lock first.
- **QLT-05:** the uses are read before the transaction.
- **QLT-06:** follows the ux-expert's wording exactly, with `role="status"` and focus on the `h1`.
- **QLT-08:** skeleton and empty-state tests added.
- **QLT-12:** an unchanged default is no longer checked.
- **AC-4:** plain text with Close only, as the product-owner ruled in 11142.

Master's planted-fault check passes: each of the four DEF-006 cases has a test that fails when its fault is planted.

One new Major remains. `rateSetIssues` uses the formula tokenizer's **greedy, longest-first reading**, which never backtracks. A longer name that begins another name can hide a valid split from it, and two names that overlap can change the reading with no compound name at all. Two probes show sets the new check accepts, in which a stored formula still comes back as a different rate (QLT-15). This is the same defect class as DEF-006 and QLT-01.

| Severity (new in round 2) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (QLT-15) |
| Minor | 0 |
| Info | 2 (QLT-16, QLT-17) |

### Previous findings

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-01 | Major | **Fixed** | `rateSetIssues([...others, name])` in `assertNameUsable` (`masters-service.ts`), used on create and rename. The 15 seed names are tested as a safe set (unit and PostgreSQL). Planted faults below. The residual hole is QLT-15 |
| QLT-02 | Major | **Fixed** | `process-items-names.test.ts:104-120`: 6 rounds, each asserts exactly 2 fulfilled and 1 `RATE_NAME_REFUSED`, with no ordering query. The old test was removed. Sequential forward and reverse tests were added |
| QLT-03 | Minor | **Fixed** | `removeInTransaction` calls `lockProcessItems` first. Unit lock-order test plus a 6-round delete-versus-update race against PostgreSQL. The race test is deterministic: delete always succeeds, and update succeeds or is `NotFoundError` |
| QLT-04 | Minor | Routed | #111 (master 11139) |
| QLT-05 | Minor | **Fixed** | `usesByRate()` runs before `transactions.run` in create, update and delete. The integration test asserts no row, value or entry changes when the read fails |
| QLT-06 | Minor | **Fixed** | A 404 on save or delete calls `onGone`: the dialog closes, the `goneNotice` text matches ux-expert 11143 word for word, the notice has `role="status"`, the list is read again, and focus goes to the `h1` (`focusOpener(null)`), also after a successful delete. E2E `expectGone` asserts the status text, no `alert` inside `main`, no dialog, the row gone and the heading focused |
| QLT-07 | Minor | Accepted as interim | Master 11139; PO note on AQP-57 (11141) |
| QLT-08 | Minor | **Fixed** | E2E skeleton test (a slow GET; asserts "Loading the rates" and `aria-busy`, then cleared) and empty-state test ("No rates yet" with Add rate working). See QLT-16 |
| QLT-09 | Info | For the test-strategy owner | No code change |
| QLT-10 | Info | **Fixed** (PO 11142, AC-5 text) | — |
| QLT-11 | Info | **Fixed** (PO 11142) | `blockedSentence` gives the Release 1 sentence; Close is the only button; the link and path constants are removed; E2E asserts `getByRole('link')` count 0 |
| QLT-12 | Info | **Fixed** | `formProblems` skips the default when it is unchanged; `editChanges` normalises, so a 4-decimal value is not re-sent (`process-form.test.ts`) |
| QLT-13, QLT-14 | Info | n/a | — |

### Planted faults (master's requirement)

These were planted in a scratchpad worktree at 66ae5117, one at a time, in `src/server/services/masters-service.ts`, then restored. `git status` shows no tracked change, and nothing was committed. Each fault switches off one direction of the check on one path. The command was `npx vitest run tests/unit/masters-service-set.test.ts tests/unit/masters-service.test.ts` (40 tests).

| Fault | DEF-006 case | Planted change | Result |
|-------|--------------|----------------|--------|
| F1 | Forward, create (compound added after its parts) | Create path judges the new name with no other names and checks only whether existing names become ambiguous | **2 failed**: "forward order: the parts first and then the compound …" (`masters-service-set`), "DEF-006: refuses a name that reads as two other rates …" (`masters-service`) |
| F2 | Reverse, create (parts added after the compound) | Create path uses the round-1 rule (`rateNameIssues` only, no set check) | **3 failed**: "reverse order …", "writes no entry for a refused addition …", "refuses the same compound whichever part is last" |
| F3 | Rename into the compound (forward) | Rename path forward-blind, as F1 | **1 failed**: "refuses a rename into the compound of two other rates" |
| F4 | Rename into the parts, either order (reverse) | Rename path with the round-1 rule | **2 failed**: "the first rename that makes a part is accepted and the second is refused …" (Gamma then Delta) and "the same in the other order: Delta first …" |

After restoring: 21 files and 709 tests passed (masters, formula, form, client, routes, AQP-106 acceptance). The PostgreSQL versions (`process-items-names.test.ts`) were not run locally because the database credentials are in `.env*`; they ran in CI.

### New findings

| ID | Severity | File:line | Rule / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------|-------|--------|---------------|
| QLT-15 | Major | `src/lib/formula/rate-names.ts` (`rateSetIssues`, `readsAsFormulaText`); `src/server/services/masters-service.ts` (`assertNameUsable`) | DEF-006, QLT-01, AC-2, AC-3 | The set check asks whether a name reads as other names under the tokenizer's **greedy** reading (longest name first, no backtracking, and a hyphen is a boundary). That misses two shapes. **(a) Prefix shadow:** with the names `Cost`, `Waste-Fee`, `Cost-Waste` and `Cost-Waste-Fee`, `rateSetIssues` returns `[]`, because the greedy reading of `Cost-Waste-Fee` takes `Cost-Waste` and then fails on `Fee`, never trying `Cost` - `Waste-Fee`. The stored formula `{{rate:Cost}}-{{rate:Waste-Fee}}` is shown as `Cost-Waste-Fee` and read back as the compound rate. **(b) Overlap, no compound name:** with `Cost`, `Waste-Fee`, `Cost-Waste` and `Fee`, `rateSetIssues` returns `[]`, yet the same stored formula comes back as `{{rate:Cost-Waste}}-{{rate:Fee}}`. Both sets can be reached in any order of adds or renames, because each step passes `rateNameIssues` and `rateSetIssues` (probe, scratchpad only) | The DEF-006 outcome: a formula re-saved from display form (R2 editor) silently prices different rates. The unsafe set can be created now through SCR-11 | **Exact rule (recommended):** on create and rename, also require that every formula of the current configuration round-trips unchanged under the proposed set of names: `toInternalForm(toDisplayForm(f, next), next) === f`. Otherwise refuse with `RATE_NAME_REFUSED` and a message that names no rate. The service already reads the current configuration before the transaction (QLT-05), so the cost is about 60 formulas, each tokenized twice. Keep `rateSetIssues` as the guard for formulas not yet written. **Then** either make it decide by *any* split rather than the greedy one (closes (a)), or have the solution-architect make display form uniquely decodable for R2, for example operators shown with spaces and a name not allowed to contain ` - `. **Tests:** both probe sets, in every add order and by rename, against the seed configuration plus a formula that uses the two rates |
| QLT-16 | Info | `tests/e2e/process-master.spec.ts` (skeleton test, route handler) | DL-057 | The slow answer is a fixed `setTimeout(1500)` inside the route handler. That is not a raised timeout or a retry, so DL-057 holds, but the test depends on timing and adds 1.5 s per width | — | Hold the route on a promise the test releases after asserting the skeleton |
| QLT-17 | Info | `masters-service.ts` (`assertNameUsable`) | AC-2 | `rateSetIssues` reports an ambiguity anywhere in the set. If the stored set were already unsafe (rows loaded by SQL, such as #108's placeholders), **every** add and rename would be refused, with a message that names no rate | Unlikely; the integration test asserts that the stored set stays safe | Report only the issues the change introduces (compare the set before and after), or make #108's loader check its set |

### DEF-006 status after round 2

| Case | Closed by this push? | Evidence |
|------|----------------------|----------|
| Compound added after its parts (forward) | Yes | F1 and F3 caught; unit and PostgreSQL tests |
| Parts added or renamed after the compound (reverse) | Yes | F2 and F4 caught |
| Prefix shadow and overlap (QLT-15) | **No** | Probes (a) and (b) |

DEF-006 stays open (master 11139). QA should verify on the head that fixes QLT-15.

### Issues for other roles (round 2)

- solution-architect: QLT-15. Decide between the exact round-trip check on rename and a display form that can be read only one way for the R2 formula editor (the editor should also round-trip-check a formula on save).
- qa-engineer: add probes (a) and (b) to the DEF-006 verification.
- Developer housekeeping: none.

### Scratchpad state

- Throwaway probes `tests/unit/zz-qlt-probe.test.ts` (round 1) and `tests/unit/zz-qlt-r2-probe.test.ts` (round 2) remain untracked in the scratchpad worktrees `wt113` and `wt113r2`, because the permission system refused `rm`.
- Neither is in the repo or committed.
- Remove both worktrees with `git worktree remove --force <path>`.

---

## Round 3 (narrow re-review, DL-091, master's ruling 11148 / DL-110)

| Field | Value |
|-------|-------|
| Review round | 3 (narrow: QLT-15, QLT-16, QLT-17) |
| Diff reviewed | `a4d4d57..c262853` (5182720 for QLT-15 and QLT-17, c262853 for QLT-16 and STD-15 to STD-17; the STD items are master's to check) |
| CI | Run 42330556486 on c262853: 4 of 4 green (Stages 1 to 11, 1 to 11b, E2E shards 1 and 2) |
| Date | 2026-11-06 |
| **Verdict** | **APPROVE WITH COMMENTS** (0 Blocker, 0 Critical, 0 Major, 0 Minor, 2 Info) |

### The four checks the coordinator asked for

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | The round-trip check `toInternalForm(toDisplayForm(f, next), next) === f` runs on add and rename; delete has none; the message is exact and names nothing | **Met** | `src/lib/fields/formula-round-trip.ts` (`roundTrips`, `fieldsBrokenByChange`), called last in `assertNameUsable` (`src/server/services/rate-name-rules.ts`) from `addInTransaction` and from `changeInTransaction` when the name changes. `removeInTransaction` has no name or round-trip check. `ROUND_TRIP_MESSAGE` = "This name would change how an existing formula reads, so it cannot be used." exactly; `expectRoundTripRefusal` asserts that message and that the error text holds no rate name. It uses the configuration read before the transaction, as ruled. A formula that cannot be shown or read back counts as broken (`FormulaError`), and any other error is rethrown |
| 2 | QLT-17: only what the change introduces counts | **Met** | Ambiguity guard: names ambiguous after, minus those ambiguous before (`wasAmbiguous`). Round trip: fields broken after, minus those broken before, and the "before" set is read only when something is broken. Tests: an unsafe stored set does not block an unrelated add or rename; an add that makes another name ambiguous is still refused; an already-broken formula does not block |
| 3 | Both reviewer sets are refused at the breaking step, on add and on rename | **Met** | `tests/unit/masters-service-round-trip.test.ts` (configuration holds `{{rate:A}}-{{rate:B}}`). Set (a): adding `Cost-Waste` is refused by the round trip; `Cost-Waste-Fee` is refused as first or second; renames into either compound are refused, the rate keeps its name, and no entry is written. Set (b): `Fee` then `Cost-Waste` refused at the second step, and `Cost-Waste` first refused, then `Fee` accepted. The same holds by rename in both orders. PostgreSQL versions are in `process-items-names.test.ts` (run in CI). The seed names and configuration are still accepted (15 renames and an add) |
| 4 | QLT-16: a promise instead of the fixed delay | **Met** | The skeleton test holds the GET on `held` and calls `release()` after asserting "Loading the rates" and `aria-busy`. No timeout is raised and there is no retry (DL-057) |

### Planted faults (master's ruling 4)

These were planted in a scratchpad worktree at c262853, one at a time, then restored. `git status` shows no tracked change, and nothing was committed. The targeted run was `npx vitest run tests/unit/masters-service-round-trip.test.ts tests/unit/formula-round-trip.test.ts tests/unit/masters-service-set.test.ts tests/unit/masters-service.test.ts` (61 tests).

| Fault | Planted change | Result |
|-------|----------------|--------|
| G1 | Round-trip check removed (add and rename) | **6 failed**: set (a) add Cost-Waste, add Cost-Waste-Fee, rename into either compound; set (b) Fee then Cost-Waste, Cost-Waste first, by rename in both orders |
| G1a | Round-trip check removed on **add** only | **4 failed** (the four add tests of sets (a) and (b)) |
| G1b | Round-trip check removed on **rename** only | **2 failed** (the rename tests of sets (a) and (b)) |
| G2 | Before/after comparison removed from the round trip (`fieldsBrokenByChange` returns every broken field) | **2 failed**: "does not count a formula that was already broken before the change" (pure) and "a formula that did not round-trip before the change does not refuse it …" (service) |
| G3 | Before/after comparison removed from the ambiguity guard (`wasAmbiguous` empty) | **3 failed**: the unsafe-set test, the "add that makes another name ambiguous" test, and the already-broken-formula test |

G1 was first run with the whole unit suite. Four unrelated files also failed in that run: `config-service`, `lint/layer-rules` and `changed-coverage` each ran about 18 minutes under machine load, and `playwright-system-deps` is Linux-only. All of them except the Linux-only one passed on restored code: 23 files, 667 tests, including the masters, formula and repository suites.

### Adversarial sets of my own

These ran through the real service over the fake repository with an injected configuration, as a throwaway file in the scratchpad worktree. Names are invented.

| Probe | Stored formula | Change | Result |
|-------|----------------|--------|--------|
| Column letter plus hyphen hides a split | `{{f:<AL>}}-{{rate:Waste-Fee}}` | Add, or rename to, `AL-Waste`, with and without a rate `Fee` | **Refused** with `ROUND_TRIP_MESSAGE` in all 4 cases. The name guards pass it, and only the round trip catches it, which shows the round trip covers a shape the name rules never saw |
| Spaces around the operator | `{{rate:Cost}} - {{rate:Waste-Fee}}` | Add `Cost - Waste` | **Refused** with `ROUND_TRIP_MESSAGE` |
| The renamed rate is in the formula | `{{rate:X}}-{{rate:Fee}}`, `Waste-Fee` exists | Rename X to `Waste` | **Refused**, by the ambiguity guard (`RATE_SET_AMBIGUOUS_MESSAGE`) before the round trip |

### Round 2 findings

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-15 | Major | **Fixed (R1 half)** | The exact round-trip invariant now holds for every stored formula of the current configuration on add and rename. The R2 write paths and a display form that can be read only one way are with #112 and the architect (master 11148) |
| QLT-16 | Info | **Fixed** | Held promise |
| QLT-17 | Info | **Fixed** | Before/after on both checks; G2 and G3 caught |

### New findings (Info only)

| ID | Severity | File:line | Issue | Suggested fix |
|----|----------|-----------|-------|---------------|
| QLT-18 | Info | `tests/unit/masters-service-round-trip.test.ts` (last QLT-17 test) | The title says "… and the one the change breaks still does", but the body only asserts that the already-broken formula does not refuse. The second half is covered by the set (a) and (b) tests, not here | Add one assertion in the same fixture: a name that breaks a second, still-healthy formula is refused. Or shorten the title |
| QLT-19 | Info | `src/server/services/rate-name-rules.ts` | The invariant covers the **current** configuration version only. An older version (revert, R2) or a version published while a rename waits is not checked. This matches the ruling (#111, #112) | None for R1. Keep the round-trip check at every R2 formula and configuration write path (#112) |

### DEF-006

The cases found so far are closed for R1: forward and reverse orders, rename in either order, prefix shadow, overlap, column letter plus hyphen, and spaced operators. Each is refused at the step that would break a stored formula. Master's ruling closes DEF-006 at G7 once QA's checks pass, probes (a) and (b) included.

### Scratchpad state

- The throwaway probe `tests/unit/zz-qlt-r3-probe.test.ts` remains untracked in the scratchpad worktree `wt113r3`.
- Together with `wt113` and `wt113r2`, remove all three with `git worktree remove --force <path>`.
