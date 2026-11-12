# Review Report — AQP-274 (DEF-029) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...fix/AQP-274-saved-not-shown` (PR #309, base 6b1883f) |
| Commit reviewed | 356e9d612639aa474f5206fced14ea6d5770a546 |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review (system of record): https://github.com/sankumar76/Accucut-Quotation/pull/309 (submitted as COMMENT, `REVIEW_IDENTITY = single-token`; label `review:standards-approved`). Routing: DL-169 (c).

## Summary
The change is small and clean. Process and Materials now pass the shared `SAVED_NOT_SHOWN_BODY` to `MasterLoadError` only while a success notice is on the page, and Treatment / Color's identical copy is replaced by the shared constant with no stale reference left. The sentence matches ux-spec v0.23 (section 6.0 "Error (load)", SCR-11, SCR-13 Materials) character for character. Lint and type-check are clean. Only two Minor test-convention items and three Info notes remain; none blocks the merge.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Lint | `node node_modules/eslint/bin/eslint.js .` (worktree at 356e9d6) | exit 0 |
| Type-check | `node node_modules/typescript/bin/tsc --noEmit` | exit 0 |
| Format-check | none configured in `package.json` | n/a |
| Wording vs ux-spec | `git show origin/docs/AQP-1-records-sprint1-j:docs/03-ux/ux-spec.md` (section 6.0 line 388, SCR-11 line 756, SCR-13 Materials line 834) | identical to `SAVED_NOT_SHOWN_BODY` |
| Stale-reference grep | `TREATMENT_SAVED_NOT_SHOWN_BODY`, `SAVED_NOT_SHOWN_BODY`, `SAVED_BUT_NOT_SHOWN` over `src`, `tests`, `docs` | no reference to the removed constant; `treatment-texts.ts` header and `master-load-error.tsx` docs still accurate |
| Secrets | manual scan of the full diff; PR commits carry only the session trailer | none found; CI gitleaks per PR Dev Record |
| CI | run 43173595283 | 5 of 5 green (per PR; mergeable_state clean) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Minor | `tests/e2e/masters-slow-read.spec.ts:77` (title) and `:105` (title); assertions at `:86` and `:114` | Coding Standards §6 (descriptive names); CLAUDE.md §6 rule 3 (tests reference defect/AC ids) | Both tests that now prove DEF-029 are titled `... (DEF-020)` only | A search for DEF-029 does not find the regression test; the PR's AC table points to titles that do not carry the id | Title both: `a slow read that fails after a save: the load error's title keeps focus and says the change was saved (DEF-020, DEF-029)`; E2E count stays +0 |
| STD-02 | Minor | `tests/e2e/support/masters.ts:147`, `:149` | Coding Standards §1 (no magic strings) | `'The change is in the audit log.'` and `'Nothing was changed.'` are bare literals in the helper, next to a named constant and other named words in the same file | The audit-log clause is what makes the "notice still on the page" check meaningful; it has no name or single place to change | Two file-local constants, written out (not imported from `src`) so the test stays independent of the code it checks |
| STD-03 | Info | `src/components/features/masters/master-texts.ts:35` | Coding Standards §2, §8 | Constant is well named and documented, but sits after the `PageNotice` interface, away from its sibling `TRY_AGAIN_BODY` (line 18) | A reader looking for the load-error sentences finds them at opposite ends of the file | Optional: move the comment and constant beside `TRY_AGAIN_BODY` |
| STD-04 | Info | `tests/e2e/aqp-122-qa.spec.ts:46` | Coding Standards §1 (DRY, rule of three) | `WORDS.savedNotShown` is another test-side copy of `SAVED_BUT_NOT_SHOWN` (`support/treatments.ts:22`). The file's `WORDS` block writes the ux-spec words out on purpose, so it follows local convention | If ux-spec rewords the sentence, e2e has two literals to change (plus `src`) | Optional: import `SAVED_BUT_NOT_SHOWN`; later, move that constant from the treatments helper to `support/masters.ts`, since three screens use it |
| STD-05 | Info | `process-results.tsx:50`, `material-results.tsx:58`, `treatment-panel.tsx:63` (and `exchange-rates-panel.tsx:111`, a variant) | Coding Standards §1 (rule of three) | The same `notice?.tone === 'success' ? SAVED_NOT_SHOWN_BODY : undefined` choice and a two-line comment are now in three places | Future wording or condition changes need three edits; the three callers take the notice from different state shapes, so a helper is not required now | Follow-up only: if a fourth caller appears, move the choice into `MasterLoadError` (it already documents the rule at `master-load-error.tsx:24`) |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current**
```ts
test('a slow read that fails after a save: the load error\'s title keeps focus and the page heading never takes it (DEF-020)', ...
```
**Suggested**
```ts
test('a slow read that fails after a save: the load error\'s title keeps focus and says the change was saved (DEF-020, DEF-029)', ...
```
Apply to both the Process (line 77) and Materials (line 105) tests, and update the quoted names in the Dev Record.

### STD-02
**Current**
```ts
await expect(page.getByRole('status').filter({ hasText: 'The change is in the audit log.' }), ...).toBeVisible();
await expect(page.getByText('Nothing was changed.'), ...).toHaveCount(0);
```
**Suggested**
```ts
const SAVED_NOTICE_CLAUSE = 'The change is in the audit log.';
const NOTHING_WAS_CHANGED = 'Nothing was changed.';
```
The other 15 `Nothing was changed` literals in `tests/e2e` follow a local habit and need no change.

### Good practice noted
- One shared constant replaces the Treatment copy (no third copy), and its doc comment says why and cites DEF-020, DEF-029 and ux-spec v0.21 / v0.23.
- `expectSavedNotShown` checks the success notice first, so it cannot pass on a page where the save did not show; control PR #316 shows the assertions fail exactly where predicted.
- Branch `fix/AQP-274-saved-not-shown`, PR title `AQP-274: ...`, commits `fix(masters): ... [AQP-274]` and `test(masters): ... [AQP-274]`; the scope is the eight listed files only.
- Commit hygiene, Info: commit 1 alone leaves the AQP-122 AC-8 test red (fixed by commit 2, found by CI); harmless under squash-merge.
</details>

## Reviewer-specific tables
Not applicable (standards).

## Previous Findings (re-review only)
First review; none.

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 2, Info 3)
