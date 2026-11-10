# Consolidated Review — AQP-130 (STORY-02.05: Treatment / Color list)

| Field | Value |
|-------|-------|
| PR | [#195](https://github.com/sankumar76/Accucut-Quotation/pull/195), head `67febe3`, from `master` 41848eb, 50 files |
| CI on head | Run 42881974487, green 5 of 5, coverage 99.2 %, path 5:51 (master 4:45) |
| Review route | Full three reviews; nothing run locally (machine memory); evidence from the diff, CI logs and control PRs |
| Reports | [standards.md](standards.md) (review 5848269835), [quality.md](quality.md), [performance.md](performance.md) |
| Consolidated by | orchestrator, 2026-11-10 |

## Verdicts

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info |
|----------|---------|---------|----------|-------|-------|------|
| reviewer-standards | APPROVE WITH COMMENTS | 0 | 0 | 0 | 8 | 6 |
| reviewer-quality | APPROVE WITH COMMENTS | 0 | 0 | 0 | 4 | 6 |
| reviewer-performance | APPROVE WITH COMMENTS | 0 | 0 | 1 | 1 | 5 |

## Findings that decide G6

| ID | Severity | Finding | Raised by |
|----|----------|---------|-----------|
| PRF-01 | Major | One path reading of 5:55 (5:51 by the developer) is over 5:30; test strategy v0.32 §10.5 item 9 needs a median of five full runs with cache hit in every job before merge. Estimate 5:10 to 5:25. If the median is 5:30 or more, do PRF-02 first. Attribution: +101 E2E tests, about +26 s on the path (shard 3); about +40 s runner variance (control run 42883355254, same split, shard 3 224 s vs 273 s); placement about 20 s, under the 80 s trigger | performance |
| QLT-03 | Minor | The concurrency tests pass with no locking at all: control PR #206 (both `LOCK TABLE` and `FOR UPDATE` removed) stays green on all 5,081 tests and three shards, so no test proves changes are serialised | quality |
| QLT-01 | Minor | Two names differing only in inner spaces or full-width letters can both be saved, although the reserved-name check treats them as one | quality |
| QLT-02 | Minor | Renaming "Other" to "Other" answers 422, not 409 | quality |
| QLT-04 | Minor | The tab's first read can arrive late and replace a newer list | quality |
| PRF-02 | Minor | Optional: pin width-independent tests to desktop (about 6 s per shard) | performance |
| STD-01 to STD-08 | Minor | Standards items, incl. STD-05 (four literals escape `treatment-texts.ts`), STD-03/STD-04 (neutral-names and extraction items on #119 grew) | standards |
| Info | Info | 17 Info items across the three reports (PRF-06: product-manager to state a maximum volume; QLT-09: deleting a treatment an estimate uses needs an answer before 05.06) | all |

## Plant evidence

- Developer's control PRs (closed): #196 A3 (1 of 27 red), #197 A4 (2 of 27), #198 focus-on-refusal removed (30 browser tests red), #200 DEF-020 close handler (9 red), #199 old `[errors]` effect (only the source guard red).
- reviewer-quality's control PRs (closed, branches deleted): #204 A3 (1 of 27 red), #205 A4 (2 of 27 red), #206 locks removed (all green: QLT-03).

## Questions the reviewers answered

- **DL-135 two-field typing test:** the one-field replacement is sufficient; #199 staying green in the browser is acceptable, because with one field the old effect cannot misbehave (QLT-05).
- **Audit event names:** keep `master.created`, `master.edited`, `master.deleted` with `object_type` `treatment` (architecture §8); the product-owner amends AC-6, as DL-129 did for AQP-123.
- **409 `TREATMENT_LOCKED` for "Other":** accepted; the architect adds it to the §6 codes line.
- **#201 (UX words):** for the ux-expert; the words sit in `treatment-texts.ts` (four literals escape it, STD-05).
- **#202 (DB guard for system rows):** supported by reviewer-quality; for the architect.
- **SQL conventions:** no departure needs recording.
- **Master's open items:** STD-03 (material-repository split) is not done and is due by AQP-142's G6; the #119 neutral-names and extraction items grew: master rules whether they are done here or stay on #119.

## For master (G6)

Zero Blocker and Critical. The Major is a measurement, not a code defect: the orchestrator runs the median of five on the final head. Decide the fix scope (QLT-01 to QLT-04, STD Minors), the re-review route, the routing of #201, #202, AC-6 and the §6 code line, and whether the median of five is read before or after a fix push.
