# Consolidated Review — AQP-244 (STORY-10.20: CI path variance)

| Field | Value |
|-------|-------|
| PR | [#166](https://github.com/sankumar76/Accucut-Quotation/pull/166), head `953b8ca`, from `master` 322cd8e |
| Change | `OWN_WIDTH_FILES` (`aqp-234-qa.spec.ts`, `masters-table-actions.spec.ts`) in `testIgnore` of `mobile` and `tablet`; guard `tests/unit/own-width-files.test.ts`; one assertion in `one-width-tag.test.ts` relaxed for the two files (declared under G12) |
| Measurement | Base `master` 322cd8e run 42850365032 attempts 1-5: median 4:41, slowest 5:17. Head run 42852486467 attempts 1-5: median 4:37, slowest 4:52. Cache hit 40 of 40 jobs, 0 flaky, billed 0.95x |
| Rulings | Architect 11342 (the cut), 11367 (measured reading governs AC-3 (c)); test strategy v0.31 §10.5 item 9 |
| Review route | Full three reviews (config change, DL-124 (1)); nothing run locally |
| Reports | [standards.md](standards.md), [quality.md](quality.md) (review 5846162115), [performance.md](performance.md) |
| Consolidated by | orchestrator, 2026-11-10 |

## Verdicts

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info |
|----------|---------|---------|----------|-------|-------|------|
| reviewer-standards | APPROVE WITH COMMENTS | 0 | 0 | 0 | 8 | 1 |
| reviewer-quality | REQUEST CHANGES | 0 | 0 | 1 | 1 | 3 |
| reviewer-performance | APPROVE WITH COMMENTS | 0 | 0 | 0 | 1 | 3 |

## Findings that decide G6

| ID | Severity | Finding | Raised by |
|----|----------|---------|-----------|
| QLT-01 | Major | `masters-table-actions.spec.ts` skips non-desktop runs only inside its two describe blocks; a test added outside them would run in `desktop` only while every guard stays green (plant P4, control PR #178, green). Fix: file-level skip plus a test pinning that form | quality |
| STD-06 | Minor | The "adding a file needs a ruling" rule is not pinned by a test; the relaxed G12 assertion follows the config list | standards |
| STD-07 | Minor | Stale test title | standards |
| PRF-01 | Minor | The cut shows no measurable time effect: -4 s median against a standard error of about 15 s; head hosts about 7 % faster; the 35 s balance line is below the noise of its statistic (29 s on means, 46 s host-free, 68 s modelled) — for the architect | performance |
| Other | Minor / Info | See the three reports (6 more standards Minors, 1 quality Minor, Info items) | all |

## Verified (reviewer-performance and reviewer-quality)

- Every figure in the PR recomputed from the jobs API and 30 shard logs: base 4:41 / 5:17 / sd 21 s / billed 19; head 4:37 / 4:52 / sd 16 s / billed 18; summed test time max minus mean 26.3 s base, 15.6 s head.
- Each test runs once: 665 passed at base and head; skipped 131 → 23; the 54 own-width tests run once in `desktop`.
- Plants P1, P2, P3, P5 (control PRs #175, #176, #177, #179) fail the guards; P4 (#178) does not (QLT-01). All control PRs closed unmerged.
- AC-1 to AC-6 met on the evidence; AC-3 (c) 16 s against 35 s per 11367.

## For master (G6)

One Major (QLT-01). RISK-023: reviewer-performance reads the fall condition (DL-134: falls to 3 on AQP-244's AC-3 or a nightly median at most 5:00) as met by the numbers, and notes the unmodified base on `master` 322cd8e alone reads 4:41 / 5:17, so the fall does not rest on the cut; margin 23 s to 5:00. PRF-01 for the architect.
