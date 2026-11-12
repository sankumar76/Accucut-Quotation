# Review Report — AQP-142 (STORY-02.02 Customers) — Quality, G7 fix round F2

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | F2 (fix only, DL-192 (5)) |
| Base…branch | `git diff f269b05 7fd3cdd` on PR #297 (`feat/AQP-142-customers`): 4 files, +67 / -16 |
| Commit reviewed | 7fd3cdd6ec79784912f2874d62676e5c28805fdf (H3, one parent f269b05) |
| Date | 2026-11-12 |
| **Verdict** | **REQUEST CHANGES** (1 Major) |

## Summary

Both product fixes are correct and small:
- **DEF-031.** The shared `PageHeader` `h1` carries `[overflow-wrap:anywhere]`, so a caller adds nothing.
- **DEF-032.** A failed Save now moves focus to a `tabIndex={-1}` wrapper around the danger notice. This copies the sign-in form, and focus after a good Save and after Reset is unchanged.
- **The `use-customer-edit.ts` change.** The developer cites it as a deviation. It is in scope under DL-192 (4)(c) and (4)(e) (QLT-11).

The P2 plant proves the DEF-032 guard: `customers.spec.ts:168` goes red at 360, 768 and 1366 px, and nothing else does.

**The P1 plant does not meet DL-192 (5).** With the wrap class removed, the long-name guard `customers.spec.ts:140` is red at 360 px (580 px overflow) and at 768 px (326 / 323 px), but **green at 1366 px**. The test's "100 characters, no space" name is `E2E-customer-<project>-r0-t0-<hex>` padded with `x`. Its hyphens are break opportunities, so the longest run that cannot break is about 73 characters, and that fits at 1366 px. QA measured the defect at 1366 px (1,276 px of overflow with a name that has no break opportunity). So the guard does not protect AC-8 at one of its three widths (QLT-10, Major). The fix is a one-line test change, followed by a re-run of P1.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 0 |
| Info | 2 |

## Checks Run

| Check | Command / source | Result |
|-------|------------------|--------|
| Fix diff | `git diff --stat f269b05 7fd3cdd` | 4 files: `page-header.tsx` (+6 / -2), `customer-edit-screen.tsx` (+10 / -6), `use-customer-edit.ts` (+14 / -7), `customers.spec.ts` (+37 / -1). H3 has one parent, f269b05. No merge commit |
| Overlap with #341 (DL-190 (2)) | `gh pr view 341 --json files` (79 files) | None of F2's 4 files is in #341 |
| Callers | `git grep useCustomerEdit` / `PageHeader` at 7fd3cdd | `useCustomerEdit` is called only by `customer-edit-screen.tsx`. `PageHeader` is used in 15 files under `src` |
| Constant route (DL-192 (4)(b)) | `git log` times | 7fd3cdd was committed at 16:02:16Z and #334 (8f66157) merged at 16:12:25Z, so the literal route applied. Wording is for reviewer-standards |
| H3 CI | run 43254493912, jobs API | attempt 1 only; 5 of 5 success. The E2E logs show `customers.spec.ts:140` and `:168` passing on [mobile], [tablet] and [desktop]. Totals 297 + 296 + 283 passed and 3 + 4 + 17 skipped, matching the developer's hand-off |
| **P1** (#349, `control/AQP-142-f2-p1-no-wrap`, 3f46afe, one parent 7fd3cdd) | One-line anchor-once plant, diff printed before push: `text-ink [overflow-wrap:anywhere]">` changed to `text-ink">`. Run 43257773997, attempt 1, merge ref c9f8468 (into 8f66157) | Stages 1 to 11b green (Gitleaks green). Shard 1 [mobile]: 1 failed (`:140` at line 161, **580 px**, both attempts). Shard 2 [tablet]: 1 failed (`:140` line 161, **326 / 323 px**). **Shard 3 [desktop]: 0 failed, `:140` green.** Nothing else red. **Not caught at 1366: QLT-10** |
| **P2** (#350, `control/AQP-142-f2-p2-no-focus`, b8f23c1, one parent 7fd3cdd) | One-line anchor-once plant, diff printed: `if (failure !== null) failureNotice.current?.focus();` deleted. Run 43257794453, attempt 1, merge ref 9416859 (into 8f66157) | Stages 1 to 11b green (lint, type-check, Gitleaks). Each of the 3 shards has 1 failure, `:168` at line 212 (`toBeFocused`, received "inactive"), on both attempts. Totals 297 / 296 / 282 passed. Nothing else red. **Caught at 3 widths** |
| Local tests | — | Not run. The scratch worktree has no `node_modules`, and no database credentials were read. The results are taken from the CI runs above, which I read myself |

Both control PRs are drafts against `master`. Each has its result in a comment, and both were closed unmerged. The branches are kept. The plant commits contain no high-entropy literal (DL-188).

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-10 | Major | `tests/e2e/customers.spec.ts:47-48`, `:158-159` | AC-8 (no sideways scroll at 360 / 768 / 1366); DL-192 (4)(d) and (5); DEF-031 | `longNameOf` pads `newCustomerName(testInfo)` to 100 characters with `x`. That name has five hyphens (`E2E-customer-desktop-r0-t0-<hex>`), and a hyphen is a line-break opportunity, so the longest run that cannot break is about 73 characters. The comment says "no space, so the browser has nowhere to break it", which is not true. Under P1, the guard is red at 360 and 768 px but **green at 1366 px** | The DEF-031 guard does not protect AC-8 at desktop width. A later change that drops or overrides the wrap class at the desktop breakpoint, or moves the title out of `PageHeader`, would pass CI while QA's own name still scrolls 1,276 px. DL-192 (5)'s P1 criterion (red at three widths) is not met, so G6 cannot close on this evidence | Remove every break opportunity and widen the glyph, keeping the name unique: `const longNameOf = (name: string): string => name.replaceAll('-', '').padEnd(100, 'W');`, and correct the comment. Then reviewer-quality re-runs P1 on the new head, and it must be red at all three widths. The E2E delta stays +0 |
| QLT-11 | Info | `src/components/features/masters/use-customer-edit.ts:76-106`, `:173` | DL-192 (4)(c), (4)(e) | **The deviation is accepted.** `use-customer-edit.ts` is the customers feature's own hook: its one caller is `customer-edit-screen.tsx`, and `customers-source-rules.test.ts` lists it with the feature's files. (4)(e) names "a hook … of the customers feature if needed". The shared read-again hooks (`use-read-again.ts`, `useMasterList`) are untouched, so (4)(c)'s follow-up route is not triggered. The change is also necessary. It drops `setSaveFocusRequest` from the failure path. Without that, a failure would queue both the Save-button effect and the notice effect in the same commit, and the order of the effects would decide where focus lands. Now the failure path has one focus target and the success path has one | Focus after a good Save is unchanged (it uses the same effect, and the E2E asserts it after the failed attempt). Reset is untouched | None |
| QLT-12 | Info | `use-customer-edit.ts:126-133` | ux-spec SCR-12 "Failed Save" | The `setFailure` branch also covers a 409 that names no field (the server's title in the notice). That case now moves focus to the notice too, where before it moved focus to Save. This matches the spec's rule for a danger notice above the form, but no test covers the 409 branch's focus | Correct by design; low risk | Optional. QA can include it in (6)(b)'s focus check |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-10
**Current** (`tests/e2e/customers.spec.ts:47-48`)
```ts
/** The longest name the form accepts: 100 characters and no space, so the browser has nowhere to break it (DEF-031). */
const longNameOf = (name: string): string => name.padEnd(100, 'x');
```
**Suggested**
```ts
/** The longest name the form accepts: 100 characters with no space or hyphen, so the browser has nowhere to break it (DEF-031). */
const longNameOf = (name: string): string => name.replaceAll('-', '').padEnd(100, 'W');
```
`newCustomerName` keeps its random part, so the name stays unique without the hyphens. `canonicalCustomerName` changes only spaces (the round-2 QLT-04 rows). The test that would catch the fault is this same test, proven by P1 going red at 1366 px.
</details>

## AC conformance (fix scope)

| AC / item | Implemented in | Tested by | Result |
|-----------|----------------|-----------|--------|
| AC-8: no sideways scroll at 360 / 768 / 1366 with the longest accepted name (DEF-031) | `page-header.tsx:20` (`[overflow-wrap:anywhere]` on the `h1`; the title column already has `min-w-0`) | `customers.spec.ts:140` (lines 158-165, on load and after Saved) | **Code met; test partial.** Green on H3 at 3 widths. Under P1 it is red at 360 and 768 and **green at 1366** (QLT-10) |
| SCR-12 "Failed Save": focus goes to the notice; the words are unchanged; the typed values stay (DEF-032) | `customer-edit-screen.tsx:82` (wrapper), `use-customer-edit.ts:103-105` (effect) | `customers.spec.ts:168` (lines 200-221: focus log length 1 on the notice, words, Address kept) | **Met.** Under P2 it is red at 3 widths, only at line 212 |
| Focus after a good Save is unchanged | `use-customer-edit.ts:98-100`, `:124` | `customers.spec.ts:168` (lines 218-221) and the existing keyboard-save assertions | Met |
| Focus after Reset is unchanged | not touched (`onCloseAutoFocus`) | existing reset tests (green on H3) | Met (no change) |
| The other 13 `PageHeader` callers | `overflow-wrap: anywhere` breaks only a word wider than its box. Flex basis and wrapping use max-content, which the property does not change | H3 E2E (every page title test green) | No effect seen. QA's sweep (6)(c) confirms it |

## Previous Findings (re-review only)

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-01 to QLT-08 | — | Closed earlier | Not touched by F2 |
| QLT-09 | Minor | **Fixed** (outside F2) | ux-spec v0.26's sentence is `CUSTOMER_PAGE_ERROR_BODY` (`customer-texts.ts:38`), checked in `customers-error-pages.test.ts:24` |

## Notes

- **Focus wrapper.** It is `outline-none`, as in `sign-in-form.tsx`. It is a programmatic focus target outside the tab order, and the notice keeps its icon and thick border, so this is not an SC 2.4.7 issue. The effect depends on `failure`, and `save` clears it first, so a second failure in a row focuses the notice again.
- **Test placement.** No failed-Save test existed in `customers.spec.ts` at f269b05 (QA's series was outside the repo), so the developer extended the keyboard-save test instead of adding a title. That keeps the E2E delta at +0, as (4)(d) and (5) assume. The title does not mention the failure path. Naming is for reviewer-standards.
- **Out of my lane.** The literal class instead of `BREAK_LONG_NAMES`, the comment wording ("GitHub issue 225", DL-189) and the Dev Record are reviewer-standards' (DL-192 (5)).

## Issues for other roles

- **developer:** QLT-10, a one-line test change on #297 (H3 + 1). No product code changes.
- **reviewer-quality (me):** re-run P1 on the new head, using the same anchor-once script. It must be red at 360, 768 and 1366 px and nowhere else. P2 does not need a re-run unless `:168` or the hook changes.
- **qa-engineer:** at (6)(a), QA's own names have no break opportunity. Keep them that way. QLT-12 can join (6)(b).
