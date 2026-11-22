# DEF-060: `tests/unit/load-plan.test.ts:104` AC-4 "is a PNG of 199 KB ..." cut by the 5 s Vitest budget in Stage 6 on slower runners; `master` push 44995772811 red (Test)

| Field | Value |
|-------|-------|
| Story / AC | STORY-10.09 (AQP-371, load, capacity and volume runs, #588), AC-4: "the pictures of the export are accepted by the content check of the portal, every one". The case is "is a PNG of 199 KB that checkPicture accepts for 300 indexes, and holds no `<`, so no page or script marker can be in it". **No AC is shown to fail:** the case ends on "Test timed out in 5000ms" |
| Severity | **Sev-3 Moderate** (master's DL-293 (1), ruling 1a): a Test-type defect that reds the required check on every run that draws the slow runner class, workaround none until the fix (no re-run is allowed), no product behaviour affected |
| Priority | **P1 for the lane, Sev-3 for the grade.** A red `master` is a pre-emption trigger (DL-265 (E), DL-256 (5) pattern): the fix starts at once, ahead of every queued item. **Merge freeze (DL-293 ruling 1b):** nothing squashes into `master` before the fix except the fix PR |
| Type | **Test** (unit, Vitest; a 1.5x margin against the 5 s budget; not a runner wave, DL-293 ruling 1a) |
| Status | **New** (logged 2026-11-22). Developer fixing on `fix/DEF-060-load-plan-unit-time` |
| Jira / GitHub | [AQP-394](https://sankumar76.atlassian.net/browse/AQP-394) / [#608](https://github.com/sankumar76/Accucut-Quotation/issues/608). Jira "relates to" AQP-371 (the story that added the case; the Jira site has no "is caused by" link type, only Blocks, Cloners, Duplicate and Relates) and AQP-1 (Intake). RISK-031 (reopened by DL-293 (2)) is named in the Jira description. Labels `ai-delivery`, `aiid-DEF-060`, `agent-qa-engineer`, `final-review`, `sev-3`; priority Medium. GitHub labels `bug`, `sev-3`, `ai-delivery` |
| Risk / rule | RISK-031 (reopened at 9 by DL-293 (2), on trigger (b) 2 of 2; this red is entered as an occurrence, and trigger (a) now reads "Stage 6, Stage 11 or Stage 12"). **No re-run** of 44995772811 or of any PR run red on this case; no rule covers Stage 6 (W1 (b) needs `Stages 1 to 11b` success). The fix's push run is `master`'s run of record |
| Found by / date | CI, `master` push run 44995772811; read by master (DL-293); logged by qa-engineer, 2026-11-22 |
| Build / commit | `master` push 44995772811 on 62ff83c4 (#588 squash, STORY-10.09), job `Stages 1 to 11b` 137126360326 (attempt 1 of 1) |
| Environment | GitHub Actions ubuntu-latest, Stage 6 "unit tests with coverage of pure code" (`npx vitest run tests/unit --coverage`, narrowed to `src/lib` and `scripts/lib`), Vitest default test timeout 5 s; the same file also runs in Stage 11 (`tests/unit`); invented data only |

## Steps to Reproduce
Not reproducible on demand (CI; no local run, CLAUDE.md section 9 item 5). Run Stage 6 of CI on a slower runner draw: `npx vitest run tests/unit/load-plan.test.ts` builds 300 random 199 KB pictures (`acceptedPicture`, `tests/perf/load/plan.ts:73`, about 60 MB) and runs `checkPicture` over each inside one test. On a fast host it takes 2.3 to 3.4 s.

## Expected Result
The case passes with margin under the 5 s Vitest budget on any host draw. The floor of DL-266 (3) is a margin of about 3x (a floor of 1.5 s).

## Actual Result
```
FAIL  tests/unit/load-plan.test.ts > AC-4: the pictures of the export are accepted by the content check of the portal, every one > is a PNG of 199 KB that checkPicture accepts for 300 indexes, and holds no `<`, so no page or script marker can be in it
Error: Test timed out in 5000ms.
Test Files  1 failed | 458 passed (459)
     Tests  1 failed | 10014 passed (10015)
```
The case took 5,676 ms. Stages 7 to 11 did not run; the fan-in `Stages 1 to 11` failed. The four Stage 12 shards were green (537, 529, 532, 516 passed).

**Readings of the case by job (Stage 6 total in brackets), from master's DL-293 (1), the figures QA holds from the job logs are the master push ones:**

| Run | Case, ms | Class |
|---|---|---|
| `master` push 44995772811 (62ff83c4), job 137126360326 | **5,676** (Stage 6 133.1 s) | slow, red |
| #601 run 44995940002, attempt 1, job 137126865094 | **5,706** (133.7 s) | slow, red |
| records-t run 44997491093, job 137131569791 | **5,744** (136.2 s) | slow, red |
| #581 run 44997762703, job 137132386687 | **6,256** (125.2 s) | slow, red |
| #588 PR run 44989377021 | 3,318 in Stage 6; 3,416 in Stage 11 (88.6 s) | fast, green |
| #588 PR run 44992810917 | 3,349 and 2,335 (88.7 s) | fast, green |
| #601 run 44995940002, attempt 2 (re-run, **unsanctioned**, DL-293 ruling 1c; not merge evidence), job 137131576581 | 3,191 and 3,613 (91.8 s) | fast, green |

Since the squash, 4 of the 5 Stage 6 runs with the case in their merge ref drew the slow class, and all 4 failed. On that class the whole of Stage 6 runs 1.4x to 1.5x slower and this case about 1.8x. Fast-host floor 2.3 to 3.4 s: a margin of about 1.5x.

## Evidence
`master` push run 44995772811 job 137126360326 log (QA read the failing block and the counts: 1 failed, 458 files passed; `tests/unit/load-plan.test.ts` 5676 ms; "Test timed out in 5000ms"); DL-293 (1) in `docs/00-governance/decision-log.md` (the other runs' readings are master's); DL-266 (3) and DL-229 (4)(b) for the budget rule.

## What decides it
- **Test:** the case does about 60 MB of random-byte generation and 300 `checkPicture` calls in one test with a 1.5x margin. It failed on every slow-class draw. A cut in the work keeps every property, so a budget is not allowed (DL-293).
- **Product:** nothing points to `checkPicture` or any `src/` file. The case is new on this `master` (#588).

## Suspected Area
`tests/unit/load-plan.test.ts:104` (AC-4); `tests/perf/load/plan.ts:73` (`acceptedPicture`); `checkPicture` in `src/`, called but not at fault.

## Binding for the fix (DL-293 (1), ruling 1a; developer, branch `fix/DEF-060-load-plan-unit-time`)
- **Test files only:** `tests/unit/load-plan.test.ts`, plus `tests/perf/load/plan.ts` if needed; nothing under `src/`.
- **Banned:** a Vitest budget change (no per-test timeout argument and no `testTimeout` in `vitest.config.ts`), a retry, skip, `.concurrent`, quarantine, a move to `tests/perf` (it would take AC-4 off the PR path), a change to the coverage scope.
- **Kept:** every property of the case for each picture it checks (exactly 199 KB, under `MAX_PICTURE_BYTES`, no 0x3C byte, `checkPicture` gives `{ ok: true, mime: 'image/png' }`), checked on a sample that includes index 0 and index 299; the `<svg` refusal case; the "random filler" case. "Every one" stays guarded at run time: the PR body cites the line where the load script's picture upload stops the run, naming the picture, when the portal refuses it (#588's "refusal code in set-up errors"). If no such line exists, the script gains a check before the upload that throws with the index, plus a unit case that the check throws on a planted `<`.
- #601 changes the same two files in other hunks (AC-10 `customerShortName`); the fix does not touch those lines.
- **Proof** (gates close-out, not the merge, section 9 item 1): the case reads **1.5 s or less in both Stage 6 and Stage 11**, on the PR run of record and on the first `master` push after the squash, whatever the host. The developer runs one local plant (disable the `<` replacement in `acceptedPicture`), prints its diff and the red result in the PR body, then reverts it.
- **Freeze:** it lifts at the fix's squash. If the first `master` push after it is red on this case again, the freeze returns and the run comes to master.

## Re-run rule
None. **Never re-run** 44995772811 or any PR run red on this case.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Logged | qa-engineer | 2026-11-22 | AQP-394, #608 |
| Fixed | developer | | `fix/DEF-060-load-plan-unit-time`, test files only |
| Regression test added | developer | | the sample-based case with every property kept, the run-time guard, one local plant shown in the PR body |
| Verified | qa-engineer | | the case at 1.5 s or less in Stage 6 and Stage 11 on the PR run of record and on the first `master` push after the squash |
