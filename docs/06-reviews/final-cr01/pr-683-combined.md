# Review Report — PR #683 (STD-C-02, `rfq` in the password rule's product words) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (one combined security-and-quality review, CLAUDE.md §9 item 2: authentication and passwords) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-1-std-c-02-rfq-password-words` (PR [#683](https://github.com/sankumar76/Accucut-Quotation/pull/683)), merge base `7029f697` = `origin/master` |
| Commit reviewed | `5b836a89` (two commits: `f9c53c7c` the change, `5b836a89` the comment reworded for the AQP-389 guard) |
| Date | 2026-11-24 |
| **Verdict** | **APPROVE WITH COMMENTS**: no Blocker, Critical or Major finding. Merge condition: CI run 45351058360 fully green (it was still running at review time) |

## Summary

The PR adds `'rfq'` to `PRODUCT_WORDS` in `src/lib/auth/common-passwords.ts` (one array entry and a comment) and adds 16 test cases to `tests/unit/auth/password-rule.test.ts`. That is exactly what FR-098 (PRD 0.48) states: "contains `accucut`, `quotation` or `rfq` anywhere, in any letter case ... 'My-RFQ-pass-1' ... is refused as too common". It is the fix STD-C-02 asked for, and `quotation` stays, as the PRD says.

The security side is sound. There is still one list and one check. Every server path that stores a password runs `assertPasswordRule` → `isCommonPassword` before it hashes anything: own change, Admin create and Admin set, reset link (which is also the first-password path) and the `bootstrap-admin` CLI. No second copy of the word list exists in `src`, `scripts`, `prisma`, `deploy` or `tests`. The refusal message is the unchanged `TOO_COMMON` sentence. It does not name the word that matched and holds nothing of the password. The check runs only after the 128-code-point length cap and is three `String.includes` calls with no regex, so there is no timing or ReDoS concern. The new refusal tests fail on the base source (10 red, verified) and pass on the head.

One Minor and three Info notes. The product name and the product words can drift apart again on a future rename, which is how STD-C-02 arose; one cheap test would catch it (QLT-683-01).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 3 |

## Checks Run

All local runs used a throwaway detached worktree at `5b836a89` in the session scratchpad, removed afterwards. Its dependencies were linked read-only.

| Check | Command | Result |
|-------|---------|--------|
| Changed test file and the AQP-389 guard, at head | `vitest run tests/unit/auth/password-rule.test.ts tests/unit/product-name.test.ts` | **68 passed**, 0 failed |
| Red without the change | the same test file with `src/lib/auth/common-passwords.ts` taken from base `7029f697` | **10 failed** (the 2 new case-table rows and the 8 new `it.each` refusals). The 6 false-positive guards and the "old words still refuse" test pass on base, as they should. Matches the PR's Dev Record |
| Every unit test of a password-setting path, at head | `vitest run tests/unit/auth tests/unit/product-name.test.ts tests/unit/account-route.test.ts tests/unit/account-service.test.ts tests/unit/bootstrap-admin-service.test.ts tests/unit/user-service-password-rule.test.ts tests/unit/users-routes.test.ts` | **25 files, 604 passed**, 0 failed |
| Callers of the check | `git grep` on the PR head for `isCommonPassword`, `assertPasswordRule`, `hasher.hash` and `passwordHash` in `src`, `scripts` and `prisma` | see the security notes below |
| Second copy of the list | `git grep` on the PR head for list-only entries (`eyphed`, `evangeli`) and for an array holding `'accucut'` and `'quotation'` | only `src/lib/auth/common-passwords.ts` |
| Test or seed passwords holding `rfq` | case-insensitive `git grep rfq` over `tests`, `.github`, `.env.example`, `deploy`, `prisma`, `scripts` and `playwright*.ts`; a search for generated or templated passwords | none. The `RFQ` hits are folder paths and UI text, not passwords. The one base64 value (`tests/e2e/support/reset-link.ts:21`) is a reset token, not a password |
| CI | `gh pr checks 683` | run 45351058360 **in progress** at review time ("Stages 1 to 11b" and E2E shards 1 to 4 pending). The earlier red run 45348945654 (AQP-389 guard) is explained and fixed by `5b836a89` |
| Lint, type-check, build, E2E | not run locally (the change is one array entry; CI is the record, CLAUDE.md §9 item 5) | — |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-683-01 | Minor | `src/lib/auth/common-passwords.ts:10041`; `tests/unit/auth/password-rule.test.ts:162-176` | FR-098 (product words); coding standards §6 (tests hold the rule) | `'rfq'` is written by hand, separately from `PRODUCT_NAME` in `src/lib/product-name.ts`. Nothing ties the two together, and STD-C-02 itself came from exactly this gap: CR-01 item 2 changed the name and the product words were not updated. The new tests state the literal `RFQ`, which is right for this rule. But on a future rename they keep passing, and the new name is never refused. | A later rename again leaves the product's own name accepted as a password, silently. Low likelihood, low impact (the 10,000-word list and the length rule still apply). | Add one test that imports the constant, so a rename fails until the words are reviewed. For example: `import { PRODUCT_NAME } from '@/lib/product-name'; it('FR-098: the product name, run together or spaced, is a product word', () => { expect(isCommonPassword(`${PRODUCT_NAME} 2026!`)).toBe(true); expect(isCommonPassword(`${PRODUCT_NAME.replace(/\s+/g, '')}#2026`)).toBe(true); });`. It lives under `tests/`, so the AQP-389 guard (`src` only) is not affected. Catching test: that test itself, run after changing `PRODUCT_NAME`. |
| QLT-683-02 | Info | `src/lib/auth/common-passwords.ts:10034-10035` | coding standards §8 (comments say why) | The parenthesis "(`src/lib/product-name.ts`; the name itself is written only there, so a password that runs the two words together is caught by this one word too)" joins two unrelated reasons with "so". The name is written only there because of the AQP-389 guard. The run-together case is caught because `rfq` is a substring. A reader may think one follows from the other. | Readability only | Split it: "`rfq` is the first word of the product's name (see `src/lib/product-name.ts`; the name is not written here because of the AQP-389 guard). As a substring it also catches the two words run together." Style is reviewer-standards' area: cross-reference, not a request. |
| QLT-683-03 | Info | `src/lib/auth/common-passwords.ts:10063-10064` | coding standards §5 (ASVS L1 context-specific words) | No Unicode normalisation before the match: full-width `ＲＦＱ` or Cyrillic look-alikes are not matched. This was already true for `accucut` and `quotation`, and the PR rightly adds no new matching rule. ASVS L1 does not ask for homoglyph folding. | None in practice: a person typing a look-alike is not choosing the guessable word | None for this PR. If ever wanted, `password.normalize('NFKC').toLowerCase()` covers full-width forms, and it is one place for all three words. |
| QLT-683-04 | Info | `scripts/lib/measurement-user.ts:60`, `scripts/seed-lighthouse-data.ts:65,71` | — | These two scripts hash a password without the rule. This is by design and predates this PR. Both refuse to run unless `assertThrowawayDatabase` passes (no production, no staging host), and they make measurement users with cheap hashes. The `bootstrap-admin` CLI, the only script that writes a real user, goes through the rule (`bootstrap-admin-service.ts:38`). | None: these are not paths where a person sets a password | None. Noted only so the "every path" check is complete. |

## Security and authorisation notes (the §9 item 2 focus)

| Check asked in the brief | Result | Evidence |
|--------------------------|--------|----------|
| Every place a password is set goes through the same check | **Yes** | `assertPasswordRule` (`src/server/services/password-policy.ts:25-28`, the only importer of `isCommonPassword`) is called before `hasher.hash` in: own change `account-service.ts:92` (hash at :108); Admin creates a user `user-service.ts:124` (:126); Admin sets or resets a password `user-service.ts:199` (:202); reset link, which is also the first-password path, `password-reset-service.ts:180` (:181); first Admin by CLI `bootstrap-admin-service.ts:38` (:44), called by `scripts/bootstrap-admin.ts`. `prisma/seed` creates no user and no password. The only other `hash(` calls are the throwaway-database measurement scripts (QLT-683-04) and the sign-in dummy hash (`auth-service.ts:107`), which is not a password being set. |
| No second copy of the word list | **Yes** | List-only entries and the product-word array appear only in `src/lib/auth/common-passwords.ts`. No file under `src/app`, `src/components` or `src/features` imports it. The page form leaves `isCommon` out by design (`password-rule.ts:11-12`, NFR-009), so a password holding `rfq` passes the page check and is refused by the server with the `TOO_COMMON` message, the same as `accucut` today (pinned by the test at `password-rule.test.ts:178-182`). |
| The error message stays the existing one and leaks nothing | **Yes** | `MESSAGES.TOO_COMMON` ("That password is too common. Choose a different one.") is unchanged. It does not say which word matched or whether the list or a product word refused it. `FieldValidationError` carries only `{ field, message }`, and `bootstrap-admin.ts:39` prints only that message. |
| The tests fail without the change | **Yes** | 10 red on base, all green on head (Checks Run). |
| AQP-389 product-name guard respected | **Yes** | The guard (`tests/unit/product-name.test.ts`, `/rfq[\s_-]+portal/i` and `/quotation[\s_-]+portal/i` over `src`) passes at head. The new `src` comment writes only `` `rfq` `` and the file path. The full name appears only in the tests, which the guard does not scan. |
| No timing or length issue | **Yes** | `isCommon` runs only after `lengthFailure` has capped the password at 128 code points (`password-rule.ts:82-87`). The match is three `includes` calls on at most 256 UTF-16 units, with no regex and no backtracking. The rule runs before argon2, so an over-long or refused password costs no hash work (unchanged). The difference in response time between a refused and an accepted new password reveals nothing secret: it is the person's own input, and the refusal is shown to them anyway. |
| The 3-letter substring matches FR-098 | **Yes** | FR-098 (PRD 0.48, line 74) says "contains ... `rfq` anywhere, in any letter case". The code lower-cases the password and checks `includes('rfq')`, the same as the other two words. The cost of false refusals is as the developer states: about 14 positions × 26⁻³ ≈ 0.08 % of random 16-letter strings, and no ordinary English word holds "rfq". The six acceptance cases (`r-f-q`, `rf#Quartz`, `Fq-Rock8!`, `Rfp#Portal` and others) pin that only the three letters in a row refuse. |
| Existing users | **Unaffected** | Sign-in does not run the rule (`password-rule.ts:4`, AC-4), so an existing password holding `rfq` still signs in. Only the next change or reset is refused. |

## Reviewer-specific tables

### AC conformance (FR-098 as amended in PRD 0.48, STD-C-02)

| Requirement | Code | Test | Status |
|-------------|------|------|--------|
| A password containing `rfq` anywhere, in any case, is refused as too common | `common-passwords.ts:10041`, `:10063-10064` | `password-rule.test.ts:45-46` (case table, server form); `:164-176` (8 refusals incl. "My-RFQ-pass-1", run-together, upper and mixed case, mid-string) | Met |
| `accucut` and `quotation` still refused | unchanged | `password-rule.test.ts:178-182` and the existing cases | Met |
| The failing part is named with the existing message | `password-rule.ts` unchanged | the case-table rows assert `'TOO_COMMON'` through `checkPasswordRule` | Met |
| Unrelated passwords are not refused by the short word | no code needed | `password-rule.test.ts:185-192` (6 acceptances) | Met |
| Applies on every screen that sets a password (FR-002, FR-004, FR-003) | through `assertPasswordRule` on every server path (security notes) | path tests in the 25 files run (604 passed); no path-level `rfq` case is needed because the paths share the one function | Met |

### Finding → code → test

| Finding | Code | Test that would catch it |
|---------|------|--------------------------|
| QLT-683-01 | `common-passwords.ts:10041` vs `product-name.ts:8` | the proposed test importing `PRODUCT_NAME` |
| QLT-683-02 | comment only | n/a |
| QLT-683-03 | `common-passwords.ts:10063` | a full-width `ＲＦＱ` case, if normalisation is ever added |
| QLT-683-04 | pre-existing scripts | n/a |

## Issues for other roles

- **solution-architect:** `docs/04-architecture/architecture.md:774` ("d. Item 2") still says `PRODUCT_WORDS` is "out of scope on purpose ... logged as a follow-up for the end review", and the table at `:786` says "`PRODUCT_WORDS` deliberately untouched". After this merge both can say "done in PR #683 (STD-C-02)". Section 8 (`:1419`, "Product words such as `accucut` are added") stays true.
- **reviewer-standards:** STD-C-02 can be closed against PR #683 once it merges. QLT-683-02 (comment wording) is in your area if you want it.

## Previous Findings (re-review only)

None (round 1).

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 1, Info 3). Nothing blocks the merge apart from the CI run still in progress at review time.
- Recommended next agent: orchestrator. Merge once CI run 45351058360 is fully green. QLT-683-01 is optional and can be done in this PR or in the hardening window.
