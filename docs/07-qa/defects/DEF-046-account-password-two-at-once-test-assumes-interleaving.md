# DEF-046: `account-password.test.ts:122` ("two changes at once cannot both win") assumes an interleaving it does not enforce: the losing change got 422 `CURRENT_PASSWORD_WRONG` instead of 409 `PASSWORD_CHANGED_ELSEWHERE` (PR #510 stage 11, 1 of 12,526)

| Field | Value |
|-------|-------|
| Story / AC | STORY-01.05 (AQP-81; `0f5fb72e`, #341) owns the test and the code. Header of the test: "AC-3, AC-5 and AC-6". **No AC fails.** AQP-81 AC-3 gives a current password that does not match as 422 "Your current password is not correct."; none of AC-1 to AC-7 requires 409 for two changes at once. The 409 "Changed elsewhere" state is UX words only (AQP-81 change note item 7, ux-spec v0.27 SCR-23) |
| Severity | **Sev-3 Moderate, graded by qa-engineer** on the test-plan scale (section 6, DL-094): a Test-type defect that fails closed (a red stage 11), the workaround is a re-run, one occurrence, no product behaviour affected, the "cannot both win" invariant held in the failing run. Not Sev-1 or Sev-2: no cost value, role bypass, data loss or AC failure, and the product path is correct (see Mechanism). Same grade as DEF-007, DEF-012 and DEF-041 to DEF-045. The area is authentication and passwords (CLAUDE.md section 9 (2)); that raises the care taken in the assessment, not the grade, because the evidence rules out a product fault. Re-grade by the master if it recurs, or if checks 1 or 2 below refute the hypothesis |
| Priority | P3 (Jira AQP-374 Medium, label `sev-3`). Fixed before G8 (hardening window, CLAUDE.md section 9 (3)) or accepted in writing by the master |
| Type | **Test** (integration test against real PostgreSQL, Vitest; flaky by unsynchronised concurrency). No product defect found |
| Status | **Closed, verified 2026-11-19** (fixed by PR #520, squash `4232a36`; Jira AQP-374 Done, GitHub #517 closed as completed) |
| Jira / GitHub | [AQP-374](https://sankumar76.atlassian.net/browse/AQP-374) / [#517](https://github.com/sankumar76/Accucut-Quotation/issues/517); Jira "relates to" AQP-81 and AQP-1 |
| Found by / date | CI on PR #510 (AQP-336, export warning notice), run 44486817397, job 135432227063 "Stages 1 to 11b", failure at 08:26:16Z; logged by qa-engineer, 2026-11-19 |
| Build / commit | PR #510 head `4f8e0c8` (merge of master `6f275ad`). `gh pr diff 510 --name-only` lists 20 files, all under `src/components/features/estimate-export`, `estimate-review`, `src/components/shared` (two notice files), `calculation-repository.ts`, `export-service.ts`, `views/schemas/export.ts` and export/review tests. Nothing in auth, users, passwords or the throttle. The test and `account-service.ts` have each one commit in `git log origin/master` (`0f5fb72e`): unchanged since the story |
| Environment | GitHub Actions `ubuntu-latest` (image ubuntu-26.04), step "Stage 11: integration tests against PostgreSQL" (466 test files, one worker per file, a scratch database per file, 161.44 s); invented data only |

## Steps to Reproduce
Not reproducible on demand: one occurrence in CI.
1. Run `tests/integration/auth/account-password.test.ts` against PostgreSQL (stage 11, or locally with the scratch-database settings).
2. Watch the test "two changes at once cannot both win". It passes when the second call reads the stored hash before the first call's write commits, and fails when it reads after.

## Expected Result
The test passes every run. The test expects: exactly one of the two changes succeeds (`outcomes.filter(null)` has length 1), the other fails with `httpStatus: 409, code: 'PASSWORD_CHANGED_ELSEWHERE'`, and `session_version` is 1.

## Actual Result
```
FAIL  tests/integration/auth/account-password.test.ts > AC-3, AC-5: the change > two changes at once cannot both win: the second finds the stored password already changed
AssertionError: expected FieldValidationError: Your current passwo… { …(3) } to match object { httpStatus: 409, …(1) }
- { "code": "PASSWORD_CHANGED_ELSEWHERE", "httpStatus": 409 }
+ FieldValidationError { "code": "CURRENT_PASSWORD_WRONG", "httpStatus": 422 }
 ❯ tests/integration/auth/account-password.test.ts:122:18
Test Files  1 failed | 465 passed (466)      Tests  1 failed | 12525 passed (12526)
```
Line 120 (exactly one change succeeded) **passed**; the failure is at line 122, the code of the loser.

## Evidence
Log: `gh api repos/sankumar76/Accucut-Quotation/actions/jobs/135432227063/logs --allow-escape-sequences`.

| Observation | Source | Reading |
|---|---|---|
| File line `tests/integration/auth/account-password.test.ts (10 tests \| 1 failed) 721ms`, this test `× 25ms`, the other nine `✓` | 08:25:37Z | The file was not slow. Master's green runs: 799 ms (job 135396046771, `e4cf444`) and 640 ms (job 135297100683, `1ca5f42`). So CPU load is not shown to be the trigger |
| `expect(outcomes.filter(null)).toHaveLength(1)` passed (line 120) | test source, failure line 122 | Exactly one change won. "Two changes cannot both win" held |
| `never overwrites a password the Admin reset after the current one was checked` (17 ms) `✓` in the same file | 08:25:37Z | The compare-and-set on the stored hash works, proven deterministically |
| `FieldValidationError`, `CURRENT_PASSWORD_WRONG`, 422 as the loser | failure block | The loser failed at step 3 of `changePassword` (the current-password check), not at step 5 (the compare-and-set) |
| No other failure in the 466 files; unit stage (349 files) green; the PR's own tests green | log | The failure is isolated to this one test |

## Mechanism hypothesis: test-ordering race, not a product race (not confirmed by reproduction)
`AccountService.changePassword` (`src/server/services/account-service.ts`, master) runs for each call: `findAccountById`, the rule check, `reserveAttempt`, **`findCredentialsById` and the Argon2 verify of the current password against the hash just read** (`checkCurrent`), `clear`, the hash of the new password, then `changeOwnPassword(id, storedHash, newHash)`, which is one `UPDATE ... WHERE id = ? AND password_hash = <storedHash>` (`user-repository.ts:288`, Prisma `user.update` with `passwordHash` in the `where`; "not found" gives `null` and so 409).

The two calls in the test share the same user, CURRENT password and throttle key, and are started together with `Promise.all`. Each call has several `await` points; nothing in the test holds either call until both have read the hash. Two outcomes are therefore possible and both are correct product behaviour:
1. **Interleaved reads.** Both read the old hash and both verify the same CURRENT. The first writes; the second's `UPDATE ... WHERE password_hash = old` matches no row (PostgreSQL re-checks the `WHERE` after waiting on the row lock) and the service answers 409 `PASSWORD_CHANGED_ELSEWHERE`. The test asserts this one.
2. **Late read.** The second call reads the hash after the first one's `UPDATE` has committed. CURRENT no longer matches the stored hash, so the second fails at the current-password check with 422 `CURRENT_PASSWORD_WRONG` ("Your current password is not correct."), the failure seen here. This is what AC-3 specifies for a current password that is not the stored one, and the person's password is not overwritten (`session_version` rises once).

What decides between them is how long the second call's first three statements take compared with the first call's whole run. That gap is small in a normal run: the earlier tests of the file run one after another, so the `pg` pool behind the Prisma client (`max: 10`, `connectionTimeoutMillis: 5 s`, lazy connections) has probably opened one connection; the second call may have to open a second connection (TCP plus SCRAM) while the first call runs six statements and two cheap Argon2 operations (`TEST_HASH_COST` memoryCost 64, timeCost 1, parallelism 1) on a warm one. If that connection set-up, a thread-pool wait for the Argon2 verify or a scheduling pause lasts a few milliseconds longer, the late-read case happens. These causes are consistent with the evidence but unmeasured; the file time (721 ms against 640 and 799 ms in green runs) says the runner was not unusually loaded for this file, so the window is probably tight even on a quiet runner and the test has no margin by design.

**Why this is not a product race.** (a) The invariant the AC and the architecture care about held: one winner, the other refused, nothing overwritten (line 120 passed; the compare-and-set is atomic in PostgreSQL and proven by the deterministic sibling test, which passed). (b) The refusal that was returned is a defined, specified response of this same endpoint. (c) The loser is refused in both outcomes; no path lets both succeed, and no secret, hash or session is exposed by either. (d) `account-service.ts` has not changed since the story, so no new commit introduced it; the PR under test does not touch it. I did not find a path in which a late read ends in a wrong write.

**What would confirm or refute it** (developer, in this order)
1. Run the file's test alone 200 times in a loop against the scratch database (`npx vitest run tests/integration/auth/account-password.test.ts -t "two changes at once"` with `--repeat`/a shell loop, or a temporary local copy of the test body inside `for`), counting loser codes. A mix of 409 and 422 with no run where both succeed confirms the hypothesis. A both-succeed result, or a 5xx or a code other than 409 and 422, refutes it and makes this a Product defect at Sev-1.
2. Log, per call, the order of `findCredentialsById` start and finish and of the `UPDATE` commit (a wrapper around `db.users`), to see the interleaving in the 422 runs.
3. Re-run with the pool warmed to two connections before the test (two parallel `SELECT 1`). If the 422s drop sharply, the lazy second connection is the cause.
4. Check the next several `master` and PR stage-11 logs for this test's name (first logged occurrence; I have not scanned earlier runs, so the rate is unknown).

## Suspected Area
`tests/integration/auth/account-password.test.ts:114-124`. The test name ("the second finds the stored password already changed") is itself ambiguous: it describes the late-read outcome, which is the one that fails the assertion.

**A fix direction, not binding.** Make the interleaving deterministic instead of hoping for it: wrap `db.users.findCredentialsById` in the test so both calls wait at a barrier until both have returned their (old) hash, then let them continue; assert 409 `PASSWORD_CHANGED_ELSEWHERE` for the loser exactly as now. Add a second case with the order forced the other way (the second call starts after the first completes) asserting 422 `CURRENT_PASSWORD_WRONG`, so each response has its own deterministic test. DL-229 (4)(b) bars a retry, a skip, a quarantine and a loosened assertion that accepts either code without separating the two cases.

**Gap this exposes.** The service line that maps a lost compare-and-set to `ConflictError(PASSWORD_CHANGED_ELSEWHERE)` is covered at service level only by this racy test. The repository-level sibling proves `changeOwnPassword` returns `null` when the stored hash changed meanwhile, and the G7 report's control (d) shows the screen's 409 text for a stubbed 409; I did not search for a route-level or service-level test of the mapping, so whether one exists is unverified. Nothing I read ties the repository result to the 409 at service level deterministically.

## Issues for other roles (no defect)
- product-owner / ux-expert: in the late-read case the person sees "Your current password is not correct." although the cause is a change from another tab, and the failed attempt stays counted against the 5-in-15 change throttle (it is reserved before the check and not released on a wrong password). That is AC-3 and AC-6 as written, so nothing is wrong; it is noted in case the product-owner wants the "Changed elsewhere" help to cover the late-read case too. No action requested.
- Related items, different mechanism: #488 (E2E `account.spec.ts` "the change" test close to its 30 s timeout; a browser-level time margin, not a race between two API calls). #346 and #509 are not related.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Mechanism confirmed or refuted (checks 1 to 4) | developer | 2026-11-19 | AQP-374 comment 12318 (DL-254 P2): 1,200 repetitions, loser 409 x 1,197, 422 x 3, both-won / neither-won / 5xx / other code x 0. Confirmed: test race, not a product race |
| Fixed | developer | 2026-11-19 | PR #520, squash `4232a36` (`fix/AQP-374-password-race-two-orders`), test-only: `tests/integration/auth/account-password.test.ts` +68/-9 |
| Regression test added | developer | 2026-11-19 | Two forced-order cases: both read before either writes (409 `PASSWORD_CHANGED_ELSEWHERE`); second reads after first committed (422 `CURRENT_PASSWORD_WRONG`); each keeps one winner and `session_version` 1 |
| Verified | qa-engineer | 2026-11-19 | Diff checked against DL-254 P1 to P4, no assertion weakened. Local 200 of 200 per case; PR run 44495397184 green; first `master` push run 44540107462 on `4232a36`: success, `account-password.test.ts` 11 tests, 706 ms, no failure (DL-254 P5 met) |

## Severity history and routing
- QA graded Sev-3, type Test, 2026-11-19, for the reasons in the table. It does not hold a story gate (AQP-81 is Done; PR #510's own change is not implicated). If check 1 shows both changes succeeding, or any result other than 409 or 422, the grade becomes Sev-1 (data or credential integrity in an authentication path) and the master is told at once.
