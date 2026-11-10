# DEF-023: `aqp-234-qa.spec.ts` "G7-7 SCR-13 at 768 px: keyboard" fails its first attempt in shard 3 of every CI run and passes on retry #1

| Field | Value |
|-------|-------|
| Story / AC | Found at G7 of STORY-10.19 (AQP-243) / AC-6 ("0 flaky tests in five full runs"). **Not caused by AQP-243**: the base shows the same line. Test written in AQP-234 G7 (PR #135) |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test (flaky E2E test; pre-existing at base `051c0b5`) |
| Status | New |
| Jira / GitHub | [AQP-268](https://sankumar76.atlassian.net/browse/AQP-268) / [#159](https://github.com/sankumar76/Accucut-Quotation/issues/159) |
| Found by / date | qa-engineer, 2026-11-10 |
| Build / commit | `6bdbb77` on `feat/AQP-243-ci-setup-cut` (PR #152); also the base run on `master` 051c0b5 |
| Environment | GitHub Actions `ubuntu-latest` (CI), `Stage 12: E2E (shard 3 of 3)`, Playwright project `desktop`, `retries: 1` |

## Steps to Reproduce
1. Open the shard 3 log of a CI run: master push run 42757450173 (attempts 1 to 3), PR run 42763746916 (attempts 1 to 5) or PR run 42802757357 (head `6bdbb77`). Read with `gh run view <run> --repo sankumar76/Accucut-Quotation --job <job id> --log`.
2. Read the end of the Playwright output.

## Expected Result
No `flaky` line (AQP-243 AC-6; test strategy 10.5: 0 flaky in five full runs).

## Actual Result
`1 flaky`, test `[desktop] tests/e2e/aqp-234-qa.spec.ts:446:5 G7-7 SCR-13 at 768 px: keyboard, with the table forced to scroll: Tab order, focus visible and not covered, Enter opens, Escape returns focus`. The first attempt fails at `aqp-234-qa.spec.ts:487`, `expect(seen.length, 'Tab reached the row actions: ...').toBeGreaterThanOrEqual(4)`: expected at least 4, received 3. Retry #1 passes (log line `✓ 9 [desktop] ... (retry #1)`), so the shard and the run stay green.

## Evidence
| Run | Attempts read | Shard 3 | Shards 1 and 2 |
|-----|---------------|---------|----------------|
| 42757450173 (master 051c0b5, base) | 1, 2, 3 | `1 flaky`, `233 passed`, 3 of 3 | none |
| 42763746916 (PR, `c24fe22`) | 1 to 5 | `1 flaky`, `233 passed`, 5 of 5 | none |
| 42802757357 (PR, `6bdbb77`) | 1 | `1 flaky`, `233 passed` | none |

Same test name in all 9 shard 3 logs. On the failing attempt the walk lists three row-action buttons, all from rows of sibling tests (`Edit QA234-kb768-...`, `Edit QA234-kb2768-...`, `Edit QA234-ax768-...`); the retry sees four. The PR body of #152 says "0 flaky in five full runs ... no `flaky` or `failed` line"; the logs do not support that sentence (it read the `passed` lines).

## Suspected Area (optional)
The test counts rows that other tests of the same file create, so the count when it runs depends on timing under `fullyParallel` and three shards. GitHub #137 (trim the duplicated G7-1 and G7-7 768 px tests from `aqp-234-qa.spec.ts`) already plans to delete the 768 px tests of G7-7; doing it would remove this flake. If the test is kept it should create its own rows. No retry increase and no wider limit (DL-057). Not confirmed by a local run (no local E2E, by agreement with the AQP-123 stream).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | qa-engineer (test is QA's; with #137) | | |
| Regression test added | n/a (the test itself) | | |
| Verified | qa-engineer: no `flaky` line in shard 3 over five full runs | | |
