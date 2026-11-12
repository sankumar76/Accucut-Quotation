# Review Report — AQP-81 (STORY-01.05) — Quality, round 2

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 2 (G6 attempt 2; DL-191 (4), DL-193, DL-194) |
| Base…branch | `git diff c4517e6 a7186f2` (the new diff only; PR #341, `feat/AQP-81-password-rule-2`) |
| Commit reviewed | a7186f2 (H2) |
| Date | 2026-11-12 |
| **Verdict** | **REQUEST CHANGES** (one new Major, QLT-13; PR review submitted as COMMENT because the review identity is a single token) |

## Summary
The round fixes all six of my round-1 findings, and the fixes are well made. Every production fix that DL-191 told me to plant has a test that goes red without it. Plants P1a, P1b, P2, P3, P4 and P5 each turned the expected tests red in CI Stage 6, and nothing else. The recipe change is sound and load-bearing. `signInAs` puts each harness person back on the first password. A local probe that removes that reset turns exactly two tests red: the role-matrix role-change loop, and the account-route test that pins repeatability.

There is one new Major, and it comes from the round. QLT-01's fix added a step to the E2E test "AC-2, AC-7: ... axe 0 violations". That step sends a case-only-different password, which the server accepts (204). The block that follows says "The error state, as a person sees it: ... axe finds nothing". It now scans the in-flight or saved page, so it no longer scans the error state. In the same round, the error summary and the password fields were moved into `change-password-parts.tsx` (STD-04). That means the refactored error state is now checked by axe, overflow and the 44 px rule at no width. Control C3 shows this (see Checks Run). The fix is to move or drop two lines.

| Severity | Count (new in round 2) |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (QLT-13) |
| Minor | 1 (QLT-14) |
| Info | 4 (QLT-15 to QLT-18) |

Round-1 findings: QLT-01 to QLT-06 are **Fixed**, 6 of 6. QLT-07 to QLT-12 were Info and are closed by rulings (see Previous Findings).

## Checks Run
| Check | Command / source | Result |
|-------|------------------|--------|
| CI on H2 | run 43254379119 (read, not re-run) | `a7186f2 success`: Stages 1 to 11b, Stages 1 to 11 and E2E shards 1 to 3 all `success`. The Dev Record states +191 / +236 / +13 / +0 against 3f22672's push run 43197966408 (u = 35, a = 36, named by file) |
| Story unit and security tests, local (scratch worktree at a7186f2) | `npx vitest run tests/unit/auth tests/unit/account-service.test.ts tests/unit/account-route.test.ts tests/unit/user-service.test.ts tests/unit/http-route-manifest.test.ts tests/unit/http-with-route-must-change.test.ts tests/unit/http-page-access.test.ts tests/unit/user-service-password-rule.test.ts tests/security/role-matrix.test.ts tests/security/csrf.test.ts tests/security/strict-schema.test.ts tests/security/engineer-refused-before-lookup.test.ts` | 25 files, **775 passed** |
| Recipe probe (local only, not committed) | `signInAs` without its password reset (`void HARNESS_PASSWORD;`), then `npx vitest run tests/security tests/unit/account-route.test.ts` | 2 failed of 1,124: `role-matrix.test.ts` "a role change is seen at the next request: ..." and `account-route.test.ts` "putting the person back on the first password (signInAs) makes the recipe repeatable". The reset is load-bearing and pinned |
| Plants P1a to P5 | Node script `plant.mjs` (scratchpad). It throws unless each anchor occurs exactly once, and each diff was printed before any result was read (DL-128, DL-155). Each plant is one commit on a7186f2, on its own `control/AQP-81-qlt-r2-*` branch and draft PR against `master`. ESLint is clean on every planted file. Locally, each plant's named tests were run red first | See the plant table below. All six are **red in CI Stage 6 on exactly the named tests** and on nothing else |
| Control C3 (QLT-13) | #357, `control/AQP-81-qlt-r2-c3`. Step 1: `opacity-10` on the error summary's list (a contrast fault that exists only in the error state), plus one assertion that the case-only step shows the success notice. Step 2: the case-only step removed | **Step 1** (2c4c66b, run 43259540330): **5 of 5 green.** "AC-2, AC-7: ..." passed at mobile, tablet and desktop, *with* the contrast fault and *with* the success notice visible after the case-only step. So the step really changes the password, and the axe scan does not see the error summary. **Step 2** (fb35b8e, run 43261793288): with the step gone, "AC-2, AC-7: ..." is **red at mobile, tablet and desktop**, axe `color-contrast`, and nothing else fails. This proves QLT-13, and proves that removing or moving the step restores the check. #357 is closed unmerged |
| F10 merge | `git log --oneline c4517e6..a7186f2` | Four linear commits (c372253, a4227ed, 21128e8, a7186f2) with no merge of `master`, so there is no `git show --cc` to read |
| DL-194 renames | `git diff c4517e6 a7186f2 -- tests/unit/one-width-tag.test.ts` | Only the two titles changed (eleven → twelve, 52 → 53). The rest of the diff is the header comment, `account.spec.ts` in `RULED_FILES`, one entry in `ONE_WIDTH_TESTS` and `toHaveLength(53)` |

### Plants (DL-191 (4))
| Plant | PR (branch) | Diff (printed before results) | Run | Red tests (CI Stage 6) |
|-------|-------------|-------------------------------|-----|------------------------|
| P1a: server same-as-current check removed | #351 (`control/AQP-81-qlt-r2-p1a`, 6425e6c) | `account-service.ts`: the 3-line `if (newPassword === currentPassword) throw ...` removed, and the two imports it used | 43259467039 | 6 of 3,391: `account-service.test.ts` "QLT-01: ... > is 422 PASSWORD_RULE under newPassword in "Set a new password": ...", "... > is refused in the ordinary state too", "... > a right current password ends the run of failures even when the new one is refused"; `account-route.test.ts` "QLT-01: ... > is 422 PASSWORD_RULE under newPassword in the ordinary state, ..." and "... in "Set a new password", ...", and "F11, STD-07: ... > writes no info line for a new password equal to the current one, ..." |
| P1b: page same-as-current check removed | #352 (`...-p1b`, 4706fe6) | `change-password.ts`: the `else if (values.newPassword === values.currentPassword)` line removed | 43259481299 | 1: `change-password.test.ts` "changePasswordProblems > QLT-01: says the new password must differ from the current one, whenever the two are the same text and the rule is met" |
| P2: symbols-only-stripped candidate removed | #353 (`...-p2`, 79e285c) | `withoutSymbolsAtEnds` returns `text`, so the third candidate equals `lower` | 43259492436 | 4: `password-rule.test.ts` "the list of common passwords > QLT-02: refuses 1234567890!", "!1234567890", "123456789!", "1qaz2wsx!!" |
| P3: the reset's change-key clear removed | #354 (`...-p3`, b9628e9) | `user-service.ts`: the clear and its import removed (the file is byte-identical to c4517e6's, blob 7cfa1b4) | 43259501384 | 1: `user-service.test.ts` "AC-5: resetting a password > QLT-03: clears the block of the change-password form too, ..." |
| P4: control C2's line re-applied | #355 (`...-p4`, 0211278) | `route-manifest.ts`: `mustChangeAllowed: true` on `/api/v1/options/materials` (round 1: survived run 43240917570) | 43259510591 | 1: `http-route-manifest.test.ts` "STORY-01.05 AC-5, QLT-06: ... > are exactly the account page and the change of the password, and no other row carries the flag" |
| P5: F5's refused branch reverted | #356 (`...-p5`, 38ebd5f) | `resultOf`: `return FAILED;` for a refusal with no field | 43259521637 | 2: `change-password.test.ts` "resultOf ... > QLT-04: a 409 with no field shows the server's own title, ..." and "QLT-04: a 403 with a title shows that title" |

**E2E shards of the same runs (extra evidence).** P1a: "Set a new password" (`account.spec.ts:296`) red at mobile, tablet and desktop, at the API step that expects 422. P1b: "AC-2, AC-7: ..." (`:168`) red at all three widths, because the page sent the request. P5: the block test (`:245`, `@one-width`) red on desktop at the stubbed 409. P2, P3 and P4 have green E2E, as expected: their behaviour is held by unit tests only.

All plant PRs are draft and are closed unmerged after reading. The branches are left on origin (the brief does not allow deletions). They hold no literal values: each plant only removes or reverts code.

## Findings (new in round 2)
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-13 | Major | `tests/e2e/account.spec.ts:226-227` (then `:229-240`) | AC-7 (axe 0, 44 px, no overflow at 360, 768, 1366); test adequacy; the test's own title and comment | The QLT-01 step `fillAndSend(page, { current: E2E_PASSWORD, next: E2E_PASSWORD.toUpperCase() })` is not refused by the page. The rule passes and the two values differ, so the request is **sent**. The current password is right, so the server **changes the password** (204). `toHaveCount(0)` passes as soon as the field is edited. The block that follows ("The error state, as a person sees it: ... axe finds nothing") then measures overflow, the 44 px targets and axe on a page that is in flight or saved, with no error summary and no `aria-invalid` field. The comment "sending it would change the password" shows that a send was not intended | At c4517e6, this was the only axe, overflow and 44 px check of SCR-23's error state at three widths (the must-change test scans before any error, and the change test runs no axe). The same round moved the error summary and the fields into `change-password-parts.tsx` (STD-04 split), so the refactored error state now has no automated accessibility check. C3 step 1 shows that a contrast fault in the summary passes CI | Move the two lines below `expectNoAxeViolations(page)`, so the scan reads the "too short" refusal again. If the step should stay a real send, assert what it does: `await expect(page.getByRole('status').filter({ hasText: SUCCESS_TITLE })).toBeVisible();`. Otherwise drop it, because `change-password.test.ts` and `account-service.test.ts` already pin "case counts". Test that catches it: C3 step 2 (the fault turns this test red once the step is gone) |
| QLT-14 | Minor | `tests/support/harness-password.ts:3-6` | Maintainability (comment states the opposite of the code) | The header still says the recipe "sends it as both the current and the new password". Since QLT-01 it sends `HARNESS_NEXT_PASSWORD` as the new one, and the repeatability now comes from `signInAs` (see the second constant's comment) | The next reader of the harness is told the opposite of the design, and may "simplify" the recipe back to one value | Reword: "... sends it as the current password and `HARNESS_NEXT_PASSWORD` as the new one; the vitest harness puts each person back on this value in `signInAs`, so the call repeats" |
| QLT-15 | Info | `src/server/services/account-service.ts:105-107` | AC-5; FR-004 | **Accepted, with praise.** The placement is after the current-password check and its `throttles.clear`, and before the hash. A wrong current password is told as such and counted, and a right one ends the run of failures even if the new password is refused. Neither costs an argon2 hash. The ordering against the rule matches the page (rule first, then same-as-current). The code `PASSWORD_RULE` for this refusal is acceptable: the ux-spec fixes only the field and the words, the client keys on fields and not on the code, and the interface comment lists it | — | None |
| QLT-16 | Info | `src/lib/auth/change-password.ts:18`; `src/server/services/auth-service.ts:1,34` | Cohesion (cross-reference STD-06, reviewer-standards) | `BLOCK_MINUTES` is written once, which is good. Its home is the change-form helper, though, and the sign-in policy (`THROTTLE_POLICY`) now imports the SCR-23 form module for its block length. The test "STD-06: the minutes of the block are written once" pins it | A later change to the form module touches the sign-in throttle's import graph. No behaviour risk | Optional, with #346's sign-in remainder of STD-06: move `BLOCK_MINUTES` to a neutral `src/lib/auth/throttle-policy.ts` (or next to `MILLISECONDS_PER_MINUTE`) |
| QLT-17 | Info | `src/lib/auth/account-client.ts:30-65` | QLT-04; ux-spec v0.27 SCR-23 part 2 | **Praise.** `resultOf` is a pure, total mapping of an `Outcome` to five kinds. It is tested branch by branch (204, 429, fields with an unknown field ignored, 409, 403, empty title, failed) and matches the "Refused, with no message for a field" row: title, no body, never the connection sentence, and "Failed" when no title is given. The form keeps the values after every refusal (WCAG 3.3.7), and focus returns to the notice on every new result (a new object for each `setShown`) | — | None |
| QLT-18 | Info | `tests/unit/auth/password-rule.test.ts:143-152` | DL-191 F2 ("in the AC-1 table") | The four cases are an `it.each` under "the list of common passwords", not rows of the AC-1 `cases` array. Each one also asserts `checkPasswordRule(password, SERVER) === 'TOO_COMMON'`, so the coverage is the same. Placement only | — | None (the product-owner's AC-1 wording note covers the text) |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-13
**Current** (`tests/e2e/account.spec.ts:224-240`)
```ts
await fillAndSend(page, { current: 'Short1!x', next: 'Short1!x' });
await expect(page.locator('#new-password-error')).toHaveText('The new password must be at least 10 characters.');
await fillAndSend(page, { current: E2E_PASSWORD, next: E2E_PASSWORD.toUpperCase() });   // sent; 204; password changed
await expect(page.locator('#new-password-error')).toHaveCount(0);                         // true as soon as the field is edited

// The error state, as a person sees it: it fits the width, its controls are large enough, and axe finds nothing.
expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
...
await expectNoAxeViolations(page);                                                        // scans the in-flight or saved state
```
**Suggested**
```ts
await fillAndSend(page, { current: 'Short1!x', next: 'Short1!x' });
await expect(page.locator('#new-password-error')).toHaveText('The new password must be at least 10 characters.');

// The error state, as a person sees it: ...
expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
...
await expectNoAxeViolations(page);

// Case counts: a password that differs from the current one only by case is accepted and saved.
await fillAndSend(page, { current: E2E_PASSWORD, next: E2E_PASSWORD.toUpperCase() });
await expect(page.getByRole('status').filter({ hasText: SUCCESS_TITLE })).toBeVisible();
```
(or drop the last two lines; the unit tests already hold "case counts").

### QLT-14
```ts
 * as (`E2E_PASSWORD` in `tests/e2e/support/auth.ts` is this value). The recipe of `POST /api/v1/account/password` (`route-calls.ts`) sends it
 * as the current password and `HARNESS_NEXT_PASSWORD` as the new one; the vitest harness puts each person back on this value whenever
 * `signInAs` names them, so the same recipe repeats in the role matrix, and the confidentiality scan makes it once for a person made for the run.
```
</details>

## Reviewer-specific tables

### AC conformance (H2; only what the round changed)
| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 | `common-passwords.ts` third candidate (`withoutSymbolsAtEnds`) | `password-rule.test.ts` QLT-02 ×4 and the inside-symbol case; P2 red | **Met**, intent gap closed (QLT-02 Fixed) |
| AC-2 | unchanged; the new message uses the same slot, summary and words | `change-password.test.ts`, `account.spec.ts` | Met |
| AC-3 | 409 title replaced (`PASSWORD_CHANGED_ELSEWHERE_MESSAGE`); `resultOf` shows refusals; F11 info line | `account-service.test.ts` (409 message), `change-password.test.ts` `resultOf`, `account-route.test.ts` F11 ×5, E2E stubbed 409 / 403 / abort; P5 red | Met (QLT-04 Fixed) |
| AC-4 | unchanged | — | Met |
| AC-5 | new = current refused on the server (`account-service.ts:105-107`) and the page (`change-password.ts:45`); `mustChangeAllowed` rows pinned | service, route, DB (`account-password.test.ts`), page helper, E2E "Set a new password" (page and API 422, `/api/v1/me` still 403); manifest pin; P1a, P1b, P4 red | **Met, purpose restored** (QLT-01, QLT-06 Fixed) |
| AC-6 | the reset clears `passwordChangeThrottleKey`; Blocked words; the block test at one width (F9) | `user-service.test.ts` ×2; E2E block test (`@one-width`, DL-194); P3 red | Met (QLT-03 Fixed). Blocked-state axe at three widths goes to QA at G7 (DL-194 (2)) |
| AC-7 | form split into `change-password-parts.tsx` (`PasswordField`, `ResultNotice`, `ErrorSummary`) | `account.spec.ts` "AC-2, AC-7: ..." | **Met in code; verification gap QLT-13 (Major):** the error state is no longer scanned (C3) |

### ux-spec v0.27 "SCR-23 Account: final words" against the build
| Row | Build | Result |
|-----|-------|--------|
| Part 1: new = current message, slot and summary, exact comparison, order (empty, rule, same) | `NEW_PASSWORD_SAME_MESSAGE`; `changePasswordProblems`; server the same constant | Matches. "Cleared when the person edits New": yes (`withoutProblem`). Editing Current leaves it until the next submit, which the spec allows |
| Blocked body, fields kept, button enabled | `BLOCKED_BODY` from `BLOCK_MINUTES`; E2E asserts the value is kept and the button is enabled | Matches |
| Failed body | `FAILED_BODY` | Matches |
| Refused with no field: title, no body, never the connection sentence; no title → Failed | `resultOf` + `ResultNotice` | Matches |
| 409 title | `PASSWORD_CHANGED_ELSEWHERE_MESSAGE` | Matches |
| Tests (1) to (8) of the spec | (1) unit + E2E; (2) unit + E2E; (3) unit + E2E (QLT-13); (4) real 429, not stubbed; (5) to (7) stubbed in the block test; (8) E2E empty submit | All present |

### Recipe change (brief item 3)
- `route-calls.ts:90`: the account recipe sends `HARNESS_PASSWORD` → `HARNESS_NEXT_PASSWORD` (204).
- `session-harness.ts:139`: `signInAs(role)` resets that role's person's hash to `hash:${HARNESS_PASSWORD}`. `FakeUserRecord.passwordHash` is now mutable for this.
- `role-matrix.test.ts:305-308`: the role-change loop calls `signInAs('ENGINEER')` before each of its two calls. It sets `record.role` first, and `idOf` is fixed by ID, so the reset hits the same record.
- Other users of the recipe are safe: the role-matrix `it.each` (one `signInAs` and one call per case), `csrf.test.ts` (`beforeEach` signs in as Admin; refused calls never reach the service), `strict-schema`, `engineer-refused-before-lookup` (one call per test after `signInAs`), and the "12 hours" test (the second call is a 401 before any body is read). The E2E scan makes one call for a disposable person.
- Evidence: the local probe without the reset turns exactly two tests red (see Checks Run). Stale comment: QLT-14.

## Previous Findings (re-review)
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-01 | Major | **Fixed** | a4227ed, 21128e8; P1a (#351) and P1b (#352) red |
| QLT-02 | Major | **Fixed** | c372253; P2 (#353) red. Master's correction on `11111111111!` accepted |
| QLT-03 | Minor | **Fixed** | a4227ed; P3 (#354) red |
| QLT-04 | Minor | **Fixed** | a4227ed, 21128e8; P5 (#356) red; words are ux-spec v0.27's |
| QLT-05 | Minor | **Fixed** | Dev Record deviation row; §8 wording is the solution-architect's (DL-191 (6)) |
| QLT-06 | Minor | **Fixed** | a4227ed; P4 (#355), C2's line, red |
| QLT-07 | Info | Closed | ADR-009 amendment 3 (Dev Record) |
| QLT-08 | Info | Closed | Blocked words replaced by ux-spec v0.27 |
| QLT-09 | Info | Closed | DL-193: no audit event; F11 log line in place (reviewer-standards reads it) |
| QLT-10 | Info | Closed | DL-193 (1): `quotation` stays |
| QLT-11 | Info | Closed | ux-spec v0.27 part 2 |
| QLT-12 | Info | Closed | Leetspeak stays outside the spec (DL-191 (3)) |

## Issues for other roles
- **developer:** QLT-13 (two lines in `account.spec.ts`), QLT-14 (comment).
- **qa-engineer (G7):** besides DL-194 (2)'s Blocked state, a manual axe pass of the SCR-23 error state at 360, 768 and 1366 px is worthwhile if QLT-13 is not fixed before In QA.
- **reviewer-standards:** QLT-16 overlaps STD-06 (cross-reference only).

## Trail
- PR review: https://github.com/sankumar76/Accucut-Quotation/pull/341#pullrequestreview-5878476881 (COMMENT; inline QLT-13, QLT-14). Thread replies for QLT-01 to QLT-06: discussion_r4553310407, r4553311421, r4553312178, r4553312890, r4553313777, r4553314762.
- Label: `review:quality-changes-requested` kept.
- Jira AQP-81 hand-off: comment 11732.
- Plant and control PRs (draft, closed unmerged; branches left on origin): #351 to #356 (P1a, P1b, P2, P3, P4, P5), #357 (C3).
