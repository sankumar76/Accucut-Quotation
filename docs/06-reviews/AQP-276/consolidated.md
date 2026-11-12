# Consolidated review: AQP-276 (STORY-10.22 CI fourth shard), PR #336

| Field | Value |
|---|---|
| Story | AQP-276 (STORY-10.22, enabler), Jira In Review |
| PR / head | #336 at 0c8b898 (`feat/AQP-276-fourth-shard`, base `master` 3f22672) |
| Route | Narrow route (DL-179 (2)): reviewer-performance and reviewer-standards. Both confirm the diff is 3 files (+14 / -14: `ci.yml`, `tests/unit/ci-workflow.test.ts`, `tests/unit/ci-workflow-shards.test.ts`) with no `src/` file or runtime helper, so no third reviewer is needed |
| CI (G5) | 43202416203 on 0c8b898, all six jobs green, no cache miss. Against `master` 3f22672 push run 43197966408: unit 3,194 (+0), full 5,558 (+0), E2E passed 210 + 209 + 210 + 194 = 823 (+3, the per-shard `setup` test in the fourth shard; 835 real tests both sides), skipped 24 (+0). One-run path 4:12 against 5:40 (information only) |
| Controls (AC-3) | A: #337, run 43212324945, shard 4 red, fan-in red. B: #338, run 43212224753, shard 4 cancelled, fan-in red. Both closed unmerged |
| Not yet shown (by design) | AC-4 to AC-7, the ten-run head-against-base measure, wait until AQP-142 (#297) merges (DL-180). AC-9 merge hold: not before AQP-142, before AQP-81 |
| Compiled by | orchestrator, 2026-11-12 |

## Verdicts

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info | Source |
|---|---|---|---|---|---|---|---|
| reviewer-standards | APPROVE WITH COMMENTS | 0 | 0 | 0 | 1 | 3 | `standards.md`, Jira 11668, label `review:standards-approved` |
| reviewer-performance | APPROVE WITH COMMENTS | 0 | 0 | 0 | 1 | 5 | `performance.md`, Jira 11669, label `review:performance-approved` |
| **Total** | | **0** | **0** | **0** | **2** | **8** | |

No duplicates between the two reports. STD-03 and PRF-01 both route to the solution-architect, but they are different points: STD-03 is a stale `[1, 2, 3]` in docs, and PRF-01 is the expected figure.

## Findings (sorted by severity)

| ID | Severity | Where | Finding | Proposed fix / owner |
|---|---|---|---|---|
| STD-01 | Minor | `tests/unit/ci-workflow.test.ts:184` | The test title still opens with `AQP-227 AC-1 (AQP-208 AC-1)`, but the `[1, 2, 3, 4]` pin now belongs to AQP-276 AC-2 (CLAUDE.md §6 rule 3) | Developer: rename on the same line (no added line; the file stays at 396 of 400). Optional per the reviewer |
| PRF-01 | Minor | `ci.yml:330`; test strategy §10.5 item 12 item 4 | The 5:00 line and the 4:35 to 4:50 expectation predate AQP-142's 53 new E2E instances, which the measure will include. The reviewer's estimate for the head median is about 4:49 to 5:11. No change to the line is proposed | Solution-architect: restate the expected figure on the post-AQP-142 suite before the measure, and have both sets' listed E2E counts reported |
| PRF-02 | Info | §10.5 item 12 item 4 (host-draw exit) | The exit's "base at least 20 s slower" names no comparator, and the 5:30 slowest-of-five line has no slow-host outlier rule | Solution-architect: clarify before the measure |
| PRF-03 | Info | measure plan (T6) | Alternate head and base runs one at a time; start after `master`'s post-merge push run saves the new Next.js cache key; use re-runs of one commit (the concurrency group cancels a PR run on a new push); keep clear of other measures | Developer at T6; orchestrator schedules it |
| PRF-04 | Info | AC-5 | One-run cost: raw 1.04 times, billed about 1.05 to 1.15 times; read raw minutes first | Developer at T7 |
| PRF-05 | Info | AC-6, AC-7 | Balance: 212 / 212 / 212 / 211 listed; shard spread 43 s against 111 s | None (good) |
| PRF-06 | Info | `ci.yml:312`; item 11 | Slack to `Stages 1 to 11b` is 38 to 39 s; a fifth shard would save at most about 40 s | None (recorded for RISK-023) |
| STD-02 | Info | `ci.yml:330` and the two pins | Conforms to AC-1 and AC-2: exact block, fan-in and `needs` unchanged, shard comments rewritten and width comments left, no `PWTEST_*`, no forbidden file touched | None (good practice) |
| STD-03 | Info | `architecture.md:1169`; `test-strategy.md:599, 677` | Docs still say `[1, 2, 3]`; `docs/04` is deliberately outside this PR | Solution-architect, with the AC-8 record |
| STD-04 | Info | origin branches `control/AQP-276-shard4-fails`, `control/AQP-276-shard4-cancelled` | Throwaway branches remain on origin | Delivery lead: delete after G7 (agents cannot delete branches) |

## For master (G6)

- Zero open Blocker or Critical findings and zero Major across both reviews.
- Open decision points: whether STD-01 is fixed now (one line, would need a new head and CI run) or deferred. The other point is when PRF-01 and PRF-02 must be settled by the solution-architect: before T6, so that the measure is judged against a stated expectation.
- G7 for this story cannot be taken until AC-4 to AC-7 are measured, which by DL-180 starts only after AQP-142 merges.
