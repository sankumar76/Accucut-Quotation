# Consolidated review: AQP-275 (DEF-030), PR #334

| Field | Value |
|---|---|
| Defect | AQP-275 (DEF-030, GitHub #325, Sev-2 per DL-174, blocks G8) |
| PR / reviewed head | #334 at 8ecdc0b (`fix/AQP-275-notice-wraps-long-name`) |
| Route | DL-174 (c): reviewer-quality and reviewer-standards |
| CI (G5) | 43195864855, 5 of 5; +6 / +6 / +2 / +0 against `master` afecc58 push run 43182725471; JS `/users` 170,936; path 5:37 |
| Control | #335 (developer; `notice.tsx` only): red at 5 of 6 new unit tests, `masters-table-actions.spec.ts:411` at 360 and 768 px, and `aqp-122-qa.spec.ts:388` (mobile) |
| Since review | `master` moved to 3f22672 (#309), which also changes `master-texts.ts` and `treatment-panel.tsx`. Mechanical realignment commits (65ca898 and one for `treatment-panel.tsx`) make those files `master`'s version plus only #334's change, so GitHub's update-branch can merge. They change no behaviour reviewed here |
| Compiled by | orchestrator, 2026-11-12 |

## Verdicts

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info | Source |
|---|---|---|---|---|---|---|---|
| reviewer-quality | APPROVE | 0 | 0 | 0 | 0 | 3 | `quality.md`, review 5872762390, Jira 11657 |
| reviewer-standards | APPROVE WITH COMMENTS | 0 | 0 | 0 | 4 | 1 (+1 note) | `standards.md`, Jira 11656 |
| **Total** | | **0** | **0** | **0** | **4** | **4** | |

## Findings (sorted by severity)

| ID | Severity | Where | Finding | Suggested disposition |
|---|---|---|---|---|
| STD-01 | Minor | `master-texts.ts:12` | The `BREAK_LONG_NAMES` re-export leaves two import paths; `features/users/users-list.tsx` imports from another feature | Move the 10 importers to `@/components/shared/break-long-names` and drop the re-export, or mark it `@deprecated` with a tech-debt issue |
| STD-02 | Minor | `tests/unit/notice-wraps-long-names.test.ts:5` | Imports the constant through the re-export | With STD-01 |
| STD-04 | Minor | `masters-table-actions.spec.ts:416` | Repeated headers literal; `JSON_HEADERS` exists in `support/treatments.ts`, already imported | Cheap, same push |
| STD-05 | Minor | `masters-table-actions.spec.ts` | 412 lines on `master`, now 461 (limit 400), no inline justification (QLT-10 of AQP-245 already in #319) | Justify inline, or fold into #319 |
| STD-03 | Info | unit `describe` | Cites AQP-275 but not DEF-030 | Optional |
| QLT-01 | Info | #297 `customer-screen.tsx:65`, `customer-edit-screen.tsx:86` | Still pass `className={BREAK_LONG_NAMES}` to `Notice`; harmless (`cn` dedupes) | #297 developer drops both; check at AQP-142's G6 close |
| QLT-02 | Info | `users-screen.tsx:163` | The Admin-name notice title now also wraps (side effect, fixed) | QA sweep at 360 px (DL-174 (d)) |
| QLT-03 | Info | unit test | The CSS-value test is the only pin of `anywhere` vs `break-word`; it rightly stays green on the control | None |
| (note) | Info | commit | Scope `users`, files in `shared/` and `masters/`; `fix(shared)` fits better in the squash title | Squash title |

## Agreement checks
- Both reviewers agree the rule lives in one place (`Notice`, `notice.tsx:45`), all 23 `Notice` call sites are in full-width contexts, and nothing else changes on screen.
- E2E placement in the own-width file is right (+2 instances, RISK-023).
- Next per DL-174: master G6, then QA G7 with the 360 px sweep of every notice repeating a user-entered name (Users incl. the Admin-name notice, Process, Materials, Treatment / Color).
