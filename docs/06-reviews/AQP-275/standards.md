# Review Report — AQP-275 (DEF-030) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...fix/AQP-275-notice-wraps-long-name` (PR #334, base cdcf18b) |
| Commit reviewed | 8ecdc0bb87428c549fbb5a1c2c2222d491326923 |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review (system of record): https://github.com/sankumar76/Accucut-Quotation/pull/334 (submitted as COMMENT, `REVIEW_IDENTITY = single-token`; label `review:standards-approved`). Routing: master's DL-174 (c).

## Summary
The fix puts the wrapping rule in one place, as DL-174 (b) asked: `Notice` applies `BREAK_LONG_NAMES` through `cn`, so a caller's class is merged and kept, and the three masters callers drop their duplicate class with no unused import left. The constant is rightly placed in `components/shared` (architecture section 10: reusable UI lives there), well named and documented. The remaining points are cleanup: the re-export leaves two import paths for one constant, two test-convention items, and one file-size item. None blocks the merge.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 4 (STD-01, STD-02, STD-04, STD-05) |
| Info | 1 (STD-03) |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Lint | `node node_modules/eslint/bin/eslint.js .` (worktree at 8ecdc0b) | exit 1, one error, only in the untracked, not-in-PR `tests/e2e/aqp-245-qa.spec.ts:31` (`no-console`); no problem in any file of the PR |
| Type-check | `node node_modules/typescript/bin/tsc --noEmit` | exit 2, three TS2379 errors, all in the untracked, not-in-PR `tests/e2e/aqp-245-qa.spec.ts` (lines 198 to 200); no error in any file of the PR |
| Format-check | none configured in `package.json` | n/a |
| CI | run 43195864855 (check runs read via the API) | 5 of 5 `success`: Stages 1 to 11, Stages 1 to 11b, E2E shards 1 to 3 (CI lint and type-check run on a clean checkout, the reference) |
| Importers of the constant | `grep -rn BREAK_LONG_NAMES src tests` | 10 source files import it from `./master-texts` or `../masters/master-texts` (15 uses); `notice.tsx` imports it from `shared`; the unit test imports it from `master-texts` |
| Stale comments in the three callers | read `process-screen.tsx`, `materials-panel.tsx`, `treatment-panel.tsx` at head | none; their comments describe the notice, not the class; no unused import left (`BREAK_LONG_NAMES` removed, `FAILED_DIALOGS_TITLE` and `PageNotice` kept) |
| Stale docs | grep of `docs/03-ux`, `docs/04-architecture`, `docs/05-backlog` | ux-spec 6.0 "Names wrap" names the constant only, not its file; no doc names `master-texts.ts` as its home (the v0.22 change-log row is history). Cross-reference for ux-expert: "Names wrap" speaks of "a name or description cell"; it could now say every notice wraps too |
| Secrets | manual scan of the diff; PR Dev Record: gitleaks over the commit's 8 files, CI gitleaks | none found |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Minor | `src/components/features/masters/master-texts.ts:12` (and the 10 importers) | Coding Standards §1 (DRY), §3; architecture section 10 (reusable UI in `components/shared`) | The re-export is not needed for anything to work. It leaves two import paths for one constant, and `features/users/users-list.tsx:15` imports it from another feature (`'../masters/master-texts'`) | Next authors keep importing from `master-texts`; a features-to-features import for a shared class is the coupling the move was meant to remove | Point the 10 importers at `@/components/shared/break-long-names` (one-line change each) and delete the re-export. Or keep it, mark `@deprecated`, and open a `tech-debt` issue. First option preferred; either acceptable |
| STD-02 | Minor | `tests/unit/notice-wraps-long-names.test.ts:5` | Coding Standards §3 | A test of a shared component imports the constant through the `features/masters` re-export | Ties the test to the re-export STD-01 asks to retire | `import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';` |
| STD-03 | Info | `tests/unit/notice-wraps-long-names.test.ts:31` | CLAUDE.md §6 rule 3; Coding Standards §6 | `describe` cites `(AQP-275)` only; the E2E describe cites `(AQP-275, DEF-030)` | A filter on DEF-030 finds the E2E tests and not these six | `'a notice wraps an unbroken name (AQP-275, DEF-030)'` (optional) |
| STD-04 | Minor | `tests/e2e/masters-table-actions.spec.ts:416` | Coding Standards §1 (DRY, no magic strings) | `{ origin: DEVELOPMENT_URL, 'content-type': 'application/json' }` written out again (also at line 82); `JSON_HEADERS` in `tests/e2e/support/treatments.ts` is the same two entries, and the spec already imports from that module | A change to the headers needs three edits | Import `JSON_HEADERS` and use `headers: JSON_HEADERS` |
| STD-05 | Minor | `tests/e2e/masters-table-actions.spec.ts` (header, line 33) | Coding Standards §1 (files ≤ 400 lines, justify exceptions inline) | The spec was 412 lines on `master` (already over) and is 461 with this PR; the reason for putting the tests here (file already in `OWN_WIDTH_FILES`) is in the PR body, not in the file | The limit stops meaning anything if growth past it is not recorded where the next author looks | Add a two-line inline justification in the header; move `findPerson` and `addPerson` to `tests/e2e/support/` when next touched. A new spec file is the fuller fix and is not asked for in this PR |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current** (`master-texts.ts`)
```ts
export { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
```
**Suggested** (in each of `material-form-dialog`, `material-list`, `material-results`, `process-delete-dialogs`, `process-form-dialog`, `process-list`, `treatment-delete-dialog`, `treatment-form-dialog`, `treatment-list`, `users-list`)
```ts
import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
```
and drop the re-export. `TRY_AGAIN_BODY` and the other words stay in `master-texts.ts`, imported alongside where a file uses both.

### STD-04
**Current**
```ts
const deactivated = await page.request.patch(`${DEVELOPMENT_URL}/api/v1/users/${person.id}`, {
  headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
```
**Suggested**
```ts
import { actionsOf, JSON_HEADERS, makeTreatment, openTreatments } from './support/treatments';
...
  headers: JSON_HEADERS,
```

### Good practice noted
- One rule in one place, in the component every caller uses (DL-174 (b)); `cn(BREAK_LONG_NAMES, className)` keeps the caller's class, and a unit test proves it.
- Placement and naming of `break-long-names.ts`: `components/shared`, kebab-case file, `UPPER_SNAKE` constant, one named export, doc comment with the ux-spec reference and why it exists.
- Test names cite the defect: the E2E describe says `(AQP-275, DEF-030)`; the E2E titles carry the width and the name length from constants (`NOTICE_WIDTHS`, `USER_NAME_LENGTH`), not bare numbers.
- The PR proves the tests can fail: red on master's code (1038 px and 633 px), and control PR #335 red where predicted.
- Version control: branch `fix/AQP-275-notice-wraps-long-name`, PR title `AQP-275: ...`, one Conventional commit with `[AQP-275]`. Info: the commit scope is `users` although the files changed are `shared/` and `masters/`; `fix(shared): ...` would describe the change better (a squash-merge title is the chance to adjust it). PR state is `behind` master (docs only), for the orchestrator to update before merge.
</details>

## Reviewer-specific tables
Not applicable (standards).

## Previous Findings (re-review only)
First review; none.

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 4, Info 1)
