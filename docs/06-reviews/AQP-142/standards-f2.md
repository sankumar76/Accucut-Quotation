# Review Report — AQP-142 (STORY-02.02 Customers) — Standards, fix round F2

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | F2 (fix-only review; round 1 is `standards.md`) |
| Base…branch | `f269b05...7fd3cdd` on `feat/AQP-142-customers` (PR #297); H2 = f269b05, H3 = 7fd3cdd, one commit, 4 files, +67 / -16 |
| Commit reviewed | 7fd3cdd6ec79784912f2874d62676e5c28805fdf |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** (0 Blocker, 0 Critical, 0 Major; 3 Minor, 4 Info). GitHub review submitted as COMMENT (`REVIEW_IDENTITY = single-token`); label `review:standards-approved`. |

## Summary

F2 does what DL-192 (4) asks, inside the scope DL-192 (4)(e) allows, and every standards constraint the brief names holds. The `h1` carries the literal class with a comment that names "GitHub issue 225" and writes no `#` before hex digits, no shared file is created, `shared` imports nothing from `features`, and the focus fix reuses the sign-in form's wrapper pattern. The commit message follows Conventional Commits with `[AQP-142]`, the PR body has "Refs #342" and "Refs #344" and no closing keyword, and no test title or Vitest case is added (E2E delta +0). The findings are small and cheap: the extended keyboard-save test is now 55 lines (over the 40-line unit), one JSDoc line is much wider than anything else in the file, and the spec's header comment does not mention the new coverage. The remaining items are Info notes for GitHub issue 225 (duplication of the wrapping class) and housekeeping.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Info | 4 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Lint | not run locally by this reviewer (the PR branch is not checked out in the main copy, and a worktree would write to `.git`). Read from CI: PR run 43254493912 on 7fd3cdd, job "Stages 1 to 11b", step "Stage 4: lint" | success (attempt 1, the only attempt). The PR body also records `npx eslint .` exit 0 from the developer |
| Type-check | same job, step "Stage 5: type-check" (`npx tsc --noEmit`) | success; the PR body records 0 errors |
| Format check | none configured (`package.json` has no Prettier or format script; `eslint.config.mjs` has no `max-len`) | n/a |
| Secret scan | same job, step "Stage 2: secret scan (Gitleaks, full history)" | success; the PR body records "734 commits scanned", "no leaks found" |
| Hex-colour guard (DL-189) | `git diff f269b05 7fd3cdd` filtered for `#` + hex digits, `console.`, `TODO`, `FIXME`, `eslint-disable`, `@ts-` | 0 matches. `tokens.test.ts` runs in Stage 6, success |
| CI | `gh api .../actions/runs/43254493912/jobs` | 5 of 5 `success` (Stages 1 to 11b, E2E shards 1 to 3, Stages 1 to 11), attempt 1 |
| Scope | `git diff --stat f269b05 7fd3cdd`; `comm` against the file list of PR #341 | exactly the 4 files; 0 files shared with #341 |
| Commit message | `git log --format=%B f269b05..7fd3cdd`, grep for closing keywords | `fix(customers): ... [AQP-142]`; "Refs #342", "Refs #344"; no `close`, `fix #`, `resolve` followed by an issue reference |
| PR body | `gh pr view 297 --json body` | "Refs #342" (line 5), "Refs #344" (line 6); no closing keyword in the body; F2 rows per defect, CI table and counts present (lines 112 to 132) |
| Function / file size | `git show 7fd3cdd:<file> | wc -l`, `awk` over the `test(` blocks | files 26, 152, 202 and 322 lines (limit 400); one test block of 55 lines (STD-01); no production function over 40 lines |

## Findings

| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `tests/e2e/customers.spec.ts:168-222` | Coding Standards §1 (functions <= 40 lines, justify exceptions inline), §6 (one behaviour per test) | The test "AC-2: a rate and the details are changed and saved by keyboard ..." grew from 32 to 55 lines. The new DEF-032 block (lines 200-221, 22 lines) is a second behaviour (a failed Save, then a good Save) inside a test about saving by keyboard. No inline justification. Two other spec blocks in the repo exceed 40 lines (48 and 43, at f269b05), but none is this long | A long multi-behaviour test is harder to read and to diagnose when it fails. DL-192 (4)(d) required extending an existing test instead of adding a title, so the extension is right; the size is what can be cut | Move the DEF-032 block into a local function in `customers.spec.ts` (no support-file change, so no scope change), for example `expectFailedSaveFocusesNotice(page: Page)`, called from the test. The test is then about 35 lines. Do **not** rename the title: DL-192 (6)(e) compares regression by name, and a changed title would read as a missing base name. See notes |
| STD-02 | Minor | `src/components/features/masters/use-customer-edit.ts:172` (also 46-48) | Coding Standards §1 (readability), §8 (comments) | The new JSDoc line on `useCustomerEdit` is 193 characters. The widest line in this file before F2 was 157, and in `customer-edit-screen.tsx` 161. Lines 173 (153) and 177 (157) are within the file's range. Separately, the reflow of the header comment left line 47 short ("notice that says so (the pattern of the sign-in form, DEF-032). After the reset dialog") with the next line unchanged | Readability only; ESLint and the build do not mind (no `max-len`). The next editor re-wraps it and the diff grows | Wrap the JSDoc at the file's usual width (about 155), for example two lines: "`saveButton` and `failureNotice` are the screen's refs to its Save button and to the wrapper of the failed-save notice, so the screen can attach them and the save can move focus to them." Re-flow lines 46-48 to the same width |
| STD-03 | Minor | `tests/e2e/customers.spec.ts:29-40` | Coding Standards §8 (documentation updated when behaviour changes) | The file's header comment lists what the spec covers and says where focus is covered ("Where focus goes when a read is slow or fails ... is `customers-focus.spec.ts`"). It does not say that this file now also asserts the 100-character name (DEF-031) and the focus on a failed Save (DEF-032). A reader looking for failed-Save focus will go to `customers-focus.spec.ts` | The two new assertions are findable only by their inline `// DEF-03x` comments | Add one sentence to the header, for example: "A name of 100 characters with no space wraps in the page title (DEF-031), and a failed Save puts focus on the notice, read as the whole focus sequence (DEF-032)." |
| STD-04 | Info | `src/components/shared/page-header.tsx:20`; `src/components/features/masters/customer-edit-screen.tsx:89` | Coding Standards §1 (DRY, but not the wrong abstraction; no magic strings) | `[overflow-wrap:anywhere]` is now written in `page-header.tsx` and in `src/components/shared/break-long-names.ts` on `master` (`BREAK_LONG_NAMES`, merged by #334 as 8f66157). This is the literal route that DL-192 (4)(b) and DL-195 (5)(e) rule and keep, with the comment naming issue 225, so it is **not** a finding against F2. Two follow-ups for #225: (a) `page-header.tsx` should import `BREAK_LONG_NAMES` from `./break-long-names` (shared to shared, so no layering issue) and drop the literal and the "until it joins" sentence; (b) after the final update takes `master`, `Notice` applies the class itself and the `className={BREAK_LONG_NAMES}` at `customer-edit-screen.tsx:89` (an unchanged line) is redundant, and contradicts the new JSDoc of `break-long-names.ts` ("a caller never adds it to a notice") | Two copies of one rule can drift. Low risk while the string is one line | For #225, not for this PR. Also note for the orchestrator: the PR body (line 115) still says "#334 (AQP-275) has not merged"; true at push time, stale now. Refresh it when the final update is written |
| STD-05 | Info | `tests/e2e/customers.spec.ts:48` | Coding Standards §1 (no magic numbers) | `name.padEnd(100, 'x')` uses the literal 100, which is `CUSTOMER_NAME_MAX_LENGTH` (`src/lib/masters/customers.ts:14`, from `MASTER_NAME_MAX_LENGTH = 100`). The JSDoc one line above names the 100, and no spec under `tests/e2e` imports from `@/lib` (0 matches); other tests write `'N'.repeat(100)` | Negligible; the helper's comment carries the meaning | No change needed. If a constant is wanted later, `const LONGEST_NAME_LENGTH = 100;` next to `longNameOf` with a pointer to `CUSTOMER_NAME_MAX_LENGTH` |
| STD-06 | Info | commit `7fd3cdd` | Coding Standards §9 (one logical change per commit) | One commit holds two defects (DEF-031 in `page-header.tsx`, DEF-032 in the customers hook and screen) and the tests of both. The message names both, with `[AQP-142]`, `Refs #342` and `Refs #344` | None here: DL-192 (4) ruled one fix round, the PR is squash-merged with a body the orchestrator writes (DL-192 (9)(g), (f)), and the history of F2 does not survive the squash | No change. Informational |
| STD-07 | Info | `customer-edit-screen.tsx:82`, `use-customer-edit.ts:101-105`, `customers.spec.ts:200-221` | Coding Standards §1, §8 (praise) | Good practice: the wrapper copies the sign-in form's pattern (`sign-in-form.tsx:69-102`) with a comment that says why; the ref is created in the screen and passed down, which is what the React-compiler `react-hooks/refs` rule needs and the PR body says so; the effect depends on `failure`, so it runs once the notice is in the page; the old `setSaveFocusRequest` call is removed rather than left dead, and the two comments that described it are updated; the test records the whole focus sequence (`recordFocus`, `afterOneFrame`) instead of one look, and then asserts the good Save returns focus to the Save button; the DEF-031 test uses the longest name the form accepts at all three projects | None | None |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current** (`customers.spec.ts:200-221`, inside the 55-line test)
```ts
// DEF-032: a save that fails puts focus on the notice and nowhere else ...
let failing = true;
await page.route('**/api/v1/customers/*', (route) => (route.request().method() === 'PATCH' && failing ? route.fulfill(BUSY) : route.fallback()));
...
failing = false;
await pressWithKeyboard(save);
await expect(page.getByRole('status').filter({ hasText: `${customer.name} was saved.` })).toBeVisible();
await expect(save).toBeFocused();
```
**Suggested** (a local function above the `describe`, the test body calls it once; the `customer` name is passed in)
```ts
/** DEF-032: a failed Save puts focus on the notice and nowhere else (the whole focus sequence), and the next good Save returns it to the Save button. */
async function expectFailedSaveFocusesNotice(page: Page, customerName: string): Promise<void> {
  let failing = true;
  await page.route('**/api/v1/customers/*', (route) => (route.request().method() === 'PATCH' && failing ? route.fulfill(BUSY) : route.fallback()));
  // ... the body of lines 204-221 unchanged ...
}
```
Why not rename the test: the title is the key that the by-name regression compares (DL-192 (6)(e), "every base name present"). Splitting it into a second `test(...)` is the other cheap route, but DL-192 (4)(d) said not to add titles, so a local function is the route that needs no ruling. If master prefers to leave the test as it is, an inline reason on the test ("one test so that the failed Save and the good Save that follows share one customer and one route; DL-192 (4)(d)") also satisfies "justify exceptions inline".

### Constraints from the brief, checked one by one

| Constraint | Result | Evidence |
|------------|--------|----------|
| No `#` + hex digits in `src` (DL-189, `tokens.test.ts`) | Holds | 0 matches in the diff; comment at `page-header.tsx:14` reads "GitHub issue 225"; Stage 6 success |
| Comment names "GitHub issue 225" | Holds | `page-header.tsx:14` |
| No new shared break-long-names file | Holds | `git ls-tree 7fd3cdd` has no `break-long-names*` |
| No import from `features` into `shared` | Holds | `page-header.tsx` has one import (`react`) |
| Literal class stays (DL-195 (5)(e)) | Holds | `page-header.tsx:20`; see STD-04 for #225 |
| Scope (DL-192 (4)(e)) | Holds | 4 files; the hook file is the allowed deviation; no support, `shared` hook or other file; 0 files shared with #341 |
| Commit message | Holds | `fix(customers): ... [AQP-142]`, Conventional Commits, `Refs #342`, `Refs #344` |
| PR body | Holds | "Refs #342", "Refs #344", no closing keyword; stale "#334 has not merged" sentence noted in STD-04 |
| Test naming and counts | Holds | No new `test(` title, no new Vitest case; two existing titles extended; E2E +0 (876 passed, 24 skipped = H2's run 43242211495); Vitest 167 / 3,327 and 229 / 5,812 equal to H2 |
| Console, TODO, dead code, `any`, casts | Holds | 0 matches in the diff; `saveFocusRequest` is still used by the good-Save path |

</details>

## Reviewer-specific tables

Not applicable (standards review).

## Previous Findings (re-review only)

This is a fix-only review of F2 (DL-192 (5)). The round-1 findings in `standards.md` were closed at G6 and are not re-opened; F2 does not touch their lines.

## Issues for other roles

- **orchestrator:** the PR body line 115 ("#334 (AQP-275) has not merged") will be stale when the final update (H5) takes `master` 8f66157; refresh it with the F2 rows. The comment on #225 (DL-192 (11)) should add STD-04 (a) and (b).
- **reviewer-quality:** `failed.locator('xpath=..')` at `customers.spec.ts:212` finds the focus wrapper through its parent; it is correct but depends on the DOM shape. Your lane (test design), so noted only.
