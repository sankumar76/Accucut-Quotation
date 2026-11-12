# Consolidated review, round 2: AQP-237 (STORY-10.18), PR #250 (fix head 57acbae)

Orchestrator, 2026-11-11. DL-156 condition R. Diff read: `87465b6..57acbae`; merge commit 2c543cd is clean (`git show --cc` empty, all three reviewers). CI 43056524392 on 57acbae: 5 of 5, unit 3,078, full Vitest 5,441, E2E 778, skipped 24. Round 1 is in `consolidated.md`.

| Reviewer | Round-2 verdict | Blocker | Critical | Major | Minor | Info | Review |
|---|---|---|---|---|---|---|---|
| quality | APPROVE WITH COMMENTS | 0 | 0 | 0 | 0 | 1 | 5867152081, `quality.md`, Jira 11537 |
| standards | APPROVE WITH COMMENTS | 0 | 0 | 0 | 1 | 2 | 5867143180, `standards.md`, Jira 11536 |
| performance | APPROVE WITH COMMENTS | 0 | 0 | 0 | 1 | 0 | `performance.md`, Jira 11539 |

## Round-1 findings: status

| ID | Round 1 | Round 2 |
|---|---|---|
| QLT-01 | Critical | Fixed (plants Q2, Q2b red) |
| QLT-02 | Major | Fixed (Q1, Q1b red) |
| QLT-03, QLT-05, QLT-06 | Minor | Fixed (Q3, Q3b red; Q6 not visited, no finding) |
| QLT-04 | Minor | Deferred to #259 (DL-156); pinned by an `OPEN_LIMITS` case |
| QLT-07 | Info | Accepted |
| STD-01 | Major | Fixed (longest function 21 lines; highest complexity 10, at the limit) |
| STD-02 to STD-04, STD-06 to STD-09 | Minor | Fixed |
| STD-05 | Minor | Fixed for this PR; older files deferred to #259 |
| STD-10, STD-11 | Info | Closed, no action |
| STD-12 | Info | Open: control branches still on the remote (delivery lead) |
| PRF-01 | Info | Open for the solution-architect: record the baseline as a range with a host factor (condition D) |
| PRF-02 | Info | Closed (rescans 0.13 to 0.27 s) |

## New findings, by severity

| ID | Severity | Finding | Raised by |
|----|----------|---------|-----------|
| STD-13 | Minor | `tests/support/lint-fixture.ts:32` drops messages with a null `ruleId`, so a fixture that does not parse, or an ignored path, returns `[]` and an "allows" test passes without the rule reading the code. Ask: throw on fatal or ignored-file messages | standards |
| PRF-03 | Minor (optional) | `createServicesProgram` could set `types: ['node']` and `lib` to cut the program build by 5 to 31 % locally; it changes the check's type environment, so plants would need a re-run. Reviewer suggests a follow-up only if readings stay over 8 s | performance |
| QLT-08 | Info | An awaited `record` whose error is caught and dropped passes; correct for AC-2, but the header's limits list should say so (one line) | quality |
| STD-14 | Info | Helper comment cites #259 for three files; #259 names two (`aqp-27-scaffold` missing) | standards |
| STD-15 | Info | `parameterOf` sits at complexity 10; the `forEachChild(...) || undefined` idiom has no comment | standards |

## Plant and timing evidence

- reviewer-quality control PR #272 (`chore/AQP-237-r3-qlt-plants`, closed unmerged), run 43126285285: Q1, Q1b, Q2, Q2b, Q3, Q3b each red with one finding in stage 6 (`checked: 24`); Q6 no finding; Q4, Q5 pass. A `tokens.test.ts` failure was caused by the plant's own comment text (`#259` read as a colour). `restrict()` mutation re-run locally: 81 of 111 fail, every refusal row (round 1: 22 stayed green).
- Architecture test file time: 10,515 ms (stage 6) and 10,561 ms (stage 11) on 57acbae; 7,685 ms on control B (same code, other host); 4,355 / 5,199 ms on the old 29-case test. reviewer-performance: no code change explains it; local A/B of the `beforeAll` is 5.3 s against 5.5 s; about half the CI rise is runner speed; AC-5's 10 s line "not shown to be breached" (one run, one host). CI path 4:22; no effect on RISK-023.

## Questions for master

- G6 attempt 2: GO or CONDITIONAL GO? STD-13 in this PR (one more push and a narrow re-read) or tech-debt?
- QLT-08 and STD-14: one-line comment fixes now, or with #259?
- PRF-03: follow-up issue, or no action unless readings stay over 8 s?
- Condition D (architect docs PR: §6 as built, count 15, the STD-08 Engineer `transaction` meaning, PRF-01 baseline as a range, §10 totals) before the squash, and the G7 route (master or QA). The branch is behind `master` (46f56d6, docs only): update by merge commit before the squash.
