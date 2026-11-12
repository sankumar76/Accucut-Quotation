# Consolidated review: AQP-274 (DEF-029), PR #309

| Field | Value |
|---|---|
| Story / defect | AQP-274 (DEF-029, GitHub #308, Sev-3); related to AQP-113 and AQP-122 |
| PR / head | #309 at 356e9d6 (`fix/AQP-274-saved-not-shown`) |
| Route | DL-169 (c): reviewer-quality and reviewer-standards; no performance review (no data path, query, dependency or CI change; JS +58 / +57 B) |
| CI | 43173595283, 5 of 5; +0 / +0 / +0 / +0 against `master` 6b1883f push run 43169697211; path 5:23 |
| Controls | #316 (developer; description removed): red at 9 (`masters-slow-read.spec.ts:77`, `:105`, `aqp-122-qa.spec.ts:278` x 3 widths). #320 (reviewer-quality; condition "any notice"): green, which shows QLT-01 |
| Compiled by | orchestrator, 2026-11-12 |

## Verdicts

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info | Source |
|---|---|---|---|---|---|---|---|
| reviewer-quality | APPROVE WITH COMMENTS | 0 | 0 | 0 | 1 | 2 | `quality.md`, review 5870753553, Jira 11606 |
| reviewer-standards | APPROVE WITH COMMENTS | 0 | 0 | 0 | 2 | 3 (+1 note) | `standards.md`, Jira 11605 |
| **Total** | | **0** | **0** | **0** | **3** | **5** | |

## Findings (de-duplicated, by severity)

| ID | Severity | Where | Finding | Suggested disposition |
|---|---|---|---|---|
| QLT-01 | Minor | `process-results.tsx`, `material-results.tsx` | No test checks the standard line when there is no notice, or a warn/info notice (e.g. "no longer exists"). Control #320 ("any notice") stays green. A `renderToStaticMarkup` unit test (pattern already in `tests/unit/`) adds no E2E | Master: fix now, or a follow-up due with STORY-02.07 |
| STD-01 | Minor | `masters-slow-read.spec.ts:77`, `:105` | The two tests that now prove DEF-029 are titled `(DEF-020)` only (CLAUDE.md §6 rule 3) | Cheap, same push |
| STD-02 | Minor | `tests/e2e/support/masters.ts:147`, `:149` | Two bare literals in the helper | Cheap, same push |
| QLT-02 | Info | `support/masters.ts` | Helper is strong; only Edit exercised, Add/Delete share the notice builder | None |
| QLT-03 | Info | `master-texts.ts` | One shared `SAVED_NOT_SHOWN_BODY` replaces DL-169's "one per screen"; allowed by ux-spec v0.23 | Master to note in the G6 record |
| STD-03 | Info | `master-texts.ts:35` | Constant sits away from sibling `TRY_AGAIN_BODY` | None |
| STD-04 | Info | `aqp-122-qa.spec.ts:46` | `WORDS.savedNotShown` duplicates `SAVED_BUT_NOT_SHOWN`; follows the file's own convention | None |
| STD-05 | Info | three callers | `notice?.tone === 'success'` repeated in three places | Follow-up only at a fourth caller |
| (note) | Info | commits | Commit 1 alone leaves AQP-122 AC-8 red; harmless under squash | None |

## Agreement checks
- Both reviewers confirm the words match ux-spec v0.23 (§6.0, SCR-11, SCR-13) and that Treatment's visible text is unchanged (old and new constants byte-identical, no remaining references).
- Not in scope: condition K (#307, failed writes) stays separate.
- QA note from reviewer-quality: G7 should include a manual deleted-elsewhere notice followed by a failed re-read (standard line expected).
