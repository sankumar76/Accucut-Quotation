# DEF-027: `aqp-122-qa.spec.ts` "[AQP-122 AC-4] the browser fetch of /api/v1/options/materials" expects materials made by other tests, so it fails when it runs first on an empty database

| Field | Value |
|-------|-------|
| Story / AC | STORY-02.03 (AQP-122) / AC-4 (where the test lives); found in the CI of PR #167 (AQP-269, DEF-024 to DEF-026) |
| Severity | Sev-3 Moderate (fails closed: a red first attempt that a retry hides) |
| Priority | P3 |
| Type | Test (E2E test that depends on rows it did not create) |
| Status | Closed (fixed in PR #189, squash `278710f`; verified) |
| Jira / GitHub | [AQP-272](https://sankumar76.atlassian.net/browse/AQP-272) / [#184](https://github.com/sankumar76/Accucut-Quotation/issues/184) |
| Found by / date | master (DL-138) from the plant runs of PR #167; logged by qa-engineer, 2026-11-10 |
| Build / commit | PR #167 head `cde1b29` (also the three control runs on top of it); not seen on `69805d1`, in AQP-244's runs or on `master` before #167's tests changed the shard split |
| Environment | GitHub Actions `ubuntu-latest`, `Stage 12: E2E (shard 2 of 3)`, Playwright project `tablet`, `retries: 1` |

## Steps to Reproduce
1. Open the shard 2 log of run 42862491463 (`cde1b29`), or of the control runs 42863792922, 42863675866, 42863743797 (the same split plus a plant).
2. Find `[tablet] tests/e2e/aqp-122-qa.spec.ts:439:3 [AQP-122 AC-4] the browser fetch of /api/v1/options/materials as the Admin has exactly three keys per entry and no number`.

## Expected Result
The test passes on its first attempt wherever it runs in the shard.

## Actual Result
It runs in slot 4 to 5 of the shard, before any other test has made a material in that job's empty database. It fails at `aqp-122-qa.spec.ts:443`, `expect(body.options.length).toBeGreaterThan(0)`, and passes on retry #1 (slot 8). The `mobile` copy runs in slot 25 and passes.

## Evidence
Run 42862491463, shard 2: `1 flaky; 209 passed`, `✘ 4 [tablet] ... aqp-122-qa.spec.ts:439` then `✓ 8 [tablet] ... (retry #1)`. Run 42863792922, shard 2: `2 failed; 1 flaky; 207 passed`, the flaky one being this test (the two failures are the plant's).

## Suspected Area (confirmed at the fix)
The test made no material of its own, and a fresh CI database has none. #167's added tests moved the shard split so that this test runs early. Same class as DEF-023.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | qa-engineer | 2026-11-10 | PR #189 (squash `278710f`), `tests/e2e/aqp-122-qa.spec.ts` (+4 / -1): the test makes its own material before it reads the options |
| Regression test added | n/a (the test itself) | 2026-11-10 | it asserts that the material it made is in the answer (`name` is the Material in Drawing); the status 200, `length > 0`, three-keys and `no-store` assertions are unchanged |
| Verified | qa-engineer | 2026-11-10 | PR #189 run 42867881487, attempts 1 to 3: 5 of 5 green, 0 `flaky` or `failed` lines, the `[tablet]` test first-try in slots 6, 7 and 5. Control PR #190 (closed unmerged), `cde1b29` + the fix, run 42868028432, attempts 1 and 2: first-try in slots 6 and 5, 0 flaky. Audit: no other `*qa*.spec.ts` assertion needs rows it did not create (list in PR #189) |
