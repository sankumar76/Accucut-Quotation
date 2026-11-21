# DEF-056 (Test): `process-items.test.ts:269` "two requests at once": exactly one create wins, but a loser got RATE_NAME_REFUSED instead of NAME_TAKEN (seen once, PR #580 run 44904746418)

| Field | Value |
|-------|-------|
| Story / AC | STORY-02.01 (AQP-113) AC-2 (a name another rate has, ignoring letter case, is refused as taken) and AC-3 (a name that reads as formula text is refused); relates to STORY-02.08 (AQP-365, PR #564, squash `242c21f7`) |
| Severity | **Sev-3 Moderate** until close (re-typed to Test on master's DL-283, 2026-11-21; the Sev-2 trigger of DL-278 lapsed because the lock is shown to serialise the check) |
| Priority | P3 |
| Type | **Test** (DL-283: the test's assumption that every spelling is valid alone was wrong; no product defect). Was logged as Product, provisional |
| Status | **Closed 2026-11-21 (qa-engineer), type Test, on master's DL-283.** Fixed by PR #587 (squash `dcf8a192`, tests only; run of record on head `ae320fbd` all green). First `master` push after the merge, run 44922163960 on `dcf8a192` (green): `process-items.test.ts` green (28 tests, 1,256 ms). Jira AQP-386 Done, GitHub #582 closed |
| Jira / GitHub | [AQP-386](https://sankumar76.atlassian.net/browse/AQP-386) / [#582](https://github.com/sankumar76/Accucut-Quotation/issues/582). Jira "relates to" AQP-113 and AQP-365 |
| Found by / date | CI, 2026-11-21; logged by qa-engineer on master's DL-278 |
| Build / commit | PR #580 head `02d13ec1` (tests only: nothing under `src/`), so the code under test is `master` `7e42970c` plus nothing |
| Environment | GitHub Actions, run 44904746418, job 136847805522 (Stages 1 to 11b, Stage 11 integration tests, PostgreSQL service), 2026-11-21 12:39 UTC; invented data only |

## Steps to Reproduce
Not reproduced; it is a race. Run `tests/integration/masters/process-items.test.ts`, describe "two requests at once", in Stage 11. The test starts four `createProcessItem` calls at once with `Race-Rate`, `RACE-RATE`, `race-rate`, `Race-rate`.

## Expected Result
Exactly one create wins and every loser is `NAME_TAKEN` (422 on `name`). `addInTransaction` (`src/server/services/masters-service.ts`) takes `LOCK TABLE process_items IN SHARE ROW EXCLUSIVE MODE`, reads all rate names in the transaction (`ratesOtherThan`, `listProcessItemNames(tx)`), and `assertNameUsable` (`rate-name-rules.ts`) asks, in order: (1) another rate with this name ignoring case: `NAME_TAKEN`; (2) the name reads as column letters, numbers, operators or other rates; (3) the change makes the set ambiguous; (4) a stored formula would not round-trip: each `RATE_NAME_REFUSED`. A loser that read after the winner committed stops at (1).

## Actual Result
```
FAIL tests/integration/masters/process-items.test.ts > two requests at once > let exactly one of several simultaneous creations of one name (in different letter case) win; the others are told the name is taken
AssertionError: expected FieldValidationError: A rate name cannot … { …(3) } to match object { code: 'NAME_TAKEN' }
(3 matching properties omitted from actual)
- Expected  - "code": "NAME_TAKEN"
+ Received  + FieldValidationError { "code": "RATE_NAME_REFUSED" }
at tests/integration/masters/process-items.test.ts:269:47
```
(log lines about 1607, 1638 and 2488 to 2512). The message is cut after "A rate name cannot …" in the log; the messages that start that way are in `src/lib/formula/rate-names.ts` (empty, spaces, braces, and line 84: "A rate name cannot read as column letters, numbers, operators or other rate names: a formula would take it for those."). The test took 52 ms (no stall). The winner count at line 268 passed (one fulfilled); the database count at line 270 was not reached. Stage 11 result: 589 files passed, 1 failed; 15,072 tests passed, 1 failed. The Postgres log of the job shows no deadlock and no lock timeout.

## Evidence
Job log 136847805522 (`gh api repos/sankumar76/Accucut-Quotation/actions/jobs/136847805522/logs`), read by qa-engineer on 2026-11-21; every other recent Stage 11 run passed this file (for example `master` push 44904394383, 588 files, 15,067 tests). PR #564's change to `masters-service.ts` and `master-repository.ts` is additive (default propagation); `addInTransaction` and `ratesOtherThan` are unchanged, so the evidence does not tie the failure to #564.

## Why it matters
The loser did not see the winner's row in the read under the lock, or the rule order differs from the one written. If the read can miss a committed row after the lock, near-names that read as another rate (DEF-006) could pass the service check; the unique index `uq_process_items_name_lower` stops only an exact case-insensitive duplicate.

## Measurement hypotheses (developer; measure first, cheapest first)
1. Which of the messages the loser got, and from which of rules (2), (3), (4); log the whole message and the `others` it read (a diagnostic run).
2. Whether `transactions.run` can open its snapshot before `lockProcessItems` (isolation level, or a statement before the lock), so the read after the lock misses the winner.
3. Whether `others` held the winner under another spelling, or the leftover rates of earlier tests in the file change rule (2) for one letter case only.
4. A loop of the file in CI (`--repeat-each`) to see the rate.

## Binding for the fix
The product must answer `NAME_TAKEN`. No loosening of the assertion (accepting `RATE_NAME_REFUSED`) and no dropped case.

## Suspected Area
`src/server/services/masters-service.ts` (`addInTransaction`, `ratesOtherThan`), `src/server/services/rate-name-rules.ts`, `src/server/repositories/master-repository.ts` (`lockProcessItems`, `listProcessItemNames`), `src/server/repositories/transaction.ts`.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Measured (hypotheses above) | developer | 2026-11-21 | AQP-386 comment 12540: 200 races per run on PostgreSQL 17, 0 reads after a winner's lock that missed the winner; 67 of 200 mismatches before, 0 of 200 after; the cause is the test's `RACE-RATE` spelling (DL-283) |
| Fixed | developer | 2026-11-21 | PR #587 (tests only), squash `dcf8a192` |
| Regression test added | developer | 2026-11-21 | the `NAME_TAKEN` assertion unchanged with `rACE-RATE`; a gated lock test; all-capitals tests (`process-items.test.ts`, 28 tests) |
| Verified | qa-engineer | 2026-11-21 | `master` push runs 44922163960 (`dcf8a192`) and 44924430846 (`c0cf1d21`): `process-items.test.ts` 28 tests green (1,256 ms and 1,620 ms) |

## Re-typed to Test (master DL-283, 2026-11-21)
- **Cause (master, from `rate-names.ts` `rateNameIssues`):** `readsAsFormulaText(name, otherNames)` refuses a name that reads as column letters, numbers, operators or other rate names (`RATE_NAME_IS_COLUMN_LETTER`, surfaced as `RATE_NAME_REFUSED`). The test's `RACE-RATE` in capitals reads as the columns RACE minus RATE, so it is refused on its own, by design, whenever it takes the lock first (no rate has the name yet, so no `NAME_TAKEN` applies). The test's assumption, that every case spelling is valid alone, was wrong.
- **Corrects:** DL-278 (1) and QA's own filing, which graded it Product on the reading that a loser could only reach the `RATE_NAME_REFUSED` rules if the read under the lock missed the winner. QA's hypotheses 1 to 4 above are superseded: the lock serialises the check (developer: 200 races per run on PostgreSQL 17, 0 reads after a winner's lock that missed the winner; 67 of 200 mismatches before the change, every one `RACE-RATE` taking the lock first; 0 of 200 after).
- **Fix:** PR #587 (tests only, one file `tests/integration/masters/process-items.test.ts`): `rACE-RATE` replaces `RACE-RATE` (valid alone; four case spellings kept; the `NAME_TAKEN` assertion unchanged), a gated test that holds the first create uncommitted and shows a second create of a name refused alone waits for the lock and answers `NAME_TAKEN` (fails with the lock call removed), and tests of the all-capitals name alone and after another rate has it. No `src/` change; no section 9 item 2 review.
- **Close-out (QA):** #587's run of record and the first `master` push after the merge, with `process-items.test.ts` green.

## Close-out re-check (qa-engineer, 2026-11-21, after pause 4)
- Jira AQP-386 Done (resolved 2026-11-21 11:21), GitHub #582 closed as completed, and this file Closed: all three agree.
- Nothing left in the product or the suite: the test file at `c0cf1d21` has no `.skip`, `.fixme`, `.todo`, retry or `slow()`; the `NAME_TAKEN` assertions are in place (the race test at :272, also :139, :175, :301, :315); PR #587 changed one test file and nothing under `src/`; no open follow-up issue names DEF-056 or AQP-386 (GitHub search: #582 only, closed; #114 is the older AQP-113 G7 observation list and does not mention it).
- The race diagnostic `tests/integration/masters/zz-race-diag.test.ts` named in the pause-4 notes is not on `master`, not on the remote branch `fix/AQP-386-rate-name-race` (its only file is `process-items.test.ts`) and no longer in the `aqp-341` worktree (clean apart from `.claude/agent-memory/`); nothing to commit or drop.
- Housekeeping only: the remote branch `fix/AQP-386-rate-name-race` (4 ahead, 2 behind `master`, PR #587 merged) is not deleted; the orchestrator or delivery lead may delete it.
- Run 44924430846 (`c0cf1d21`, #583 on top) passed the file again: 28 tests, 1,620 ms.
