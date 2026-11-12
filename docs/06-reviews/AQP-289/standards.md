# Review Report — AQP-289 (DEF-035, PR #361) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...fix/AQP-289-empty-state-title-wrap` (base b6b38c5) |
| Commit reviewed | b7fbad84e4666c581e33c24d2a6e9e3670f9106e |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review: https://github.com/sankumar76/Accucut-Quotation/pull/361 (submitted as COMMENT, `REVIEW_IDENTITY = single-token`). Label `review:standards-approved` applied.

## Summary
The change is small and on the ruled route (DL-196): the shared `EmptyState` heading takes `BREAK_LONG_NAMES` from `@/components/shared/break-long-names`, and Materials drops its now-redundant class and import in the same commit, so the rule is written once. Layering, import direction, naming, commit and PR conventions all conform. Three Minor findings remain: two doc/constant points in the tests and one stale doc sentence about when a caller adds the class.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Info | 0 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Import of `BREAK_LONG_NAMES` | `git grep BREAK_LONG_NAMES b7fbad8 -- src` | `states.tsx:9` imports `./break-long-names`. `material-results.tsx` no longer imports it from `master-texts`. The deprecated re-export (`master-texts.ts:13`) is untouched and still serves other importers (GitHub issue 225). Pass |
| DL-189: `#` + hex digits | `git diff b6b38c5 b7fbad8 -- src tests` filtered to added lines, regex `#[0-9a-fA-F]{3,}` | no match. Pass |
| `features` into `shared` | `git grep features b7fbad8 -- src/components/shared` | empty. `states.tsx` imports only `./break-long-names`, `./icon`, `@/components/ui/skeleton`, `@/lib/cn`. Pass |
| DL-188: high-entropy literals | read of all added lines | only `abcdefghij`, `'x'.repeat`, fixed words. Gitleaks (CI stage 2) passed. Pass |
| PR body | `pull_request_read get` | "Closes #123" and "Refs AQP-289" present; #123 is DEF-035 and shows this PR as its closer. Title `AQP-289: ...`. Pass |
| Commit and branch | `pull_request_read get_commits` | one commit `fix(ui): EmptyState title wraps a long search text [AQP-289]`; branch `fix/AQP-289-empty-state-title-wrap`. Pass |
| Test naming and location | compared with `tests/unit/notice-wraps-long-names.test.ts` | kebab-case file in `tests/unit/`, sentence-style `describe` with story and defect IDs, same as the sibling. Pass |
| Other `EmptyState` callers | `git grep -A8 "<EmptyState"` | no other caller passes a wrapping class. Pass |
| Lint, format, type-check | not re-run locally (main copy is on the docs branch; checkout not allowed). CI run 43268411939, check-runs API | 5 of 5 `success`, including Gitleaks, lint, type-check, build, changed-code coverage |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Minor | `src/components/shared/states.tsx:77` (anchor); doc sentences in `src/components/shared/break-long-names.ts:1-4` and `src/components/features/masters/master-texts.ts:10` | Coding Standards §8 | The two places that tell callers when to add `BREAK_LONG_NAMES` still say only `Notice` wraps by itself ("a caller never adds it to a notice; table cells, dialog titles and descriptions add it where they print a name"). `EmptyState` titles now wrap too. | The next author follows the doc and adds the class to a new `EmptyState` by hand, re-creating the redundancy this PR removes. | Add `EmptyState` titles beside `Notice` in both comments (below). One doc line each, in this PR or the GitHub issue 225 clean-up. |
| STD-02 | Minor | `tests/e2e/process-master.spec.ts:341` | Coding Standards §1 (no magic numbers) | `'abcdefghij'.repeat(LONG_SEARCH_LENGTH / 10)`: the `10` is the unnamed length of the literal. | A change of `LONG_SEARCH_LENGTH` to a non-multiple of 10 silently yields a different length than the constant and the test title say. | `const UNBROKEN_UNIT = 'abcdefghij';` then `UNBROKEN_UNIT.repeat(LONG_SEARCH_LENGTH / UNBROKEN_UNIT.length)`; keep the "letters only, a hyphen is a break point" reason as a one-line comment. |
| STD-03 | Minor | `tests/unit/empty-state-wraps-long-names.test.ts:55` (and `:54` name) | Coding Standards §1 | `'x'.repeat(100)`: bare `100`, the same value the E2E file names `LONG_SEARCH_LENGTH`. | The rule value (longest name the form allows, ux-spec 6.0) is repeated as a bare number in two files. | `const LONG_NAME_LENGTH = 100;` beside `LEVELS` with a half-line source comment; use it in the repeat. |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current** (`break-long-names.ts`)
```
`Notice` applies it to every notice (AQP-275, DEF-030), so a caller never adds it to a notice; table cells, dialog titles and descriptions add it where they print a name.
```
**Suggested**
```
`Notice` applies it to every notice and `EmptyState` to every empty-state title (AQP-275, DEF-030; AQP-289, DEF-035), so a caller never adds it to either; table cells, dialog titles and descriptions add it where they print a name.
```
Mirror the same words in the `@deprecated` re-export JSDoc of `master-texts.ts`.

### STD-02
**Current**
```ts
const query = 'abcdefghij'.repeat(LONG_SEARCH_LENGTH / 10);
```
**Suggested**
```ts
/** Letters only: a hyphen would give the browser a break point and hide the defect. */
const UNBROKEN_UNIT = 'abcdefghij';
...
const query = UNBROKEN_UNIT.repeat(LONG_SEARCH_LENGTH / UNBROKEN_UNIT.length);
```

### STD-03
**Suggested**
```ts
/** The longest name the form allows (ux-spec 6.0 "Names wrap"). */
const LONG_NAME_LENGTH = 100;
...
const title = `No rate matches "${'x'.repeat(LONG_NAME_LENGTH)}"`;
```
</details>

## Notes (not findings)
- Test names follow the sibling's sentence style rather than the `should_...` example in §6; accepted as the established project convention.
- Good practice: one shared rule; redundant caller class and import removed together; doc comment names AQP-289 and the cause; letters-only search text reasoned in the Dev Record; no change outside DL-196 (b)'s file list.
- Cross-reference for reviewer-quality: the regular expression that parses the rendered heading in the unit test (line 31) is a design question, not a standards one.

## Previous Findings (re-review only)
n/a (round 1).
