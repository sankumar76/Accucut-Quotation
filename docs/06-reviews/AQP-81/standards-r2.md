# Review Report — AQP-81 (STORY-01.05) — Standards, round 2 (G6 attempt 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 2 (re-review of the new diff only: `git diff c4517e6 a7186f2`) |
| Base…branch | `master...feat/AQP-81-password-rule-2` (PR #341, base 3f22672) |
| Commit reviewed | a7186f211fe98f4297ea43e506647222efd86d8a (H2); 4 new commits: c372253, a4227ed, 21128e8, a7186f2 |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** (no Blocker, Critical or Major; PR review submitted as COMMENT, single-token) |

## Summary

All round-1 items that DL-191 and DL-193 required are fixed: the licence notice (STD-01, F3), the header note, the form split, the error-code constant and the single "minutes" source (STD-02, STD-04, STD-05, STD-06, F7), and the success log line (STD-07, F11). The licence file is byte-identical to the upstream SecLists `LICENSE` (SHA-256 `3dbdc93d...ded66c` on both, 1,072 bytes). The F11 line is one `logger.info` with `requestId`, `userId` and a fixed message; the tests prove one line on success, none on four kinds of refusal, and no typed value, e-mail or hash anywhere in any log method. DL-194 holds: the only removed Vitest titles are the two renamed ones. No secret-like literal was added. The new findings are one Minor (an unused `export` on a Next route file) and two Info items.

| Severity | Count (new, this round) |
|----------|-------------------------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 2 |

Round-1 findings: STD-01, STD-02, STD-04, STD-05, STD-06, STD-07 Fixed. STD-03 Deferred to #346 as ruled (DL-191 (3)). STD-08, STD-09, STD-10 optional, not taken, accepted. STD-11 stays with the orchestrator at merge.

## Checks Run

| Check | Command / source | Result |
|-------|------------------|--------|
| Lint | `eslint .`, CI run 43254379119 (H2), "Stage 4: lint" | Pass (read from the job steps; not re-run locally, the working tree is on the docs branch, not the PR head) |
| Type-check | `tsc --noEmit`, same run, "Stage 5: type-check" | Pass |
| Build | `next build`, same run, "Stage 9: build" | Pass (this also covers the new non-handler export in `route.ts`, see STD-12) |
| Data-file / licence stages | "Stage 3" and "Stage 8", same run | Pass (`.txt` licence file accepted) |
| Format-check | none configured | n/a |
| Run state | `gh run view 43254379119`: head SHA a7186f2, completed, success, 5 of 5 jobs | As briefed |
| Secret scan | Gitleaks is not installed on this machine (`which gitleaks`: not found), so no local scan. CI "Stage 2: secret scan (Gitleaks, full history)" on H2: "733 commits scanned", "no leaks found" | Pass. `.gitleaks.toml` unchanged by the round |
| Secret-like literals in added lines | Manual grep of all 610 added non-list lines (and the added lines of `common-passwords.ts`) for 24+ character tokens, `eyJ`, `session-token=`, `Bearer`, key/secret/token/password assignments | None token- or cookie-shaped. New literals: `HARNESS_NEXT_PASSWORD = 'invented-e2e-password-for-aqp-81-next'` (plain words), `'Not-the-current-1!'`, `'Short1!x'`. `'Tn4#vLm8@Qz-current'` is repeated in `change-password.test.ts` but was already in three test files at c4517e6 and passed Stage 2 on 733 commits; it is not a new value |
| Risky constructs in added lines | Manual grep: `any`, `!` assertions, `@ts-`, `eslint-disable`, `console.`, TODO/FIXME, `.only`, `.skip` | None found |
| Commit messages | `git log c4517e6..a7186f2` | All four carry `[AQP-81]` and a Conventional type: `fix(auth)`, `fix(account)`, `fix(account)`, `feat(account)` |

## Findings (new this round)

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-12 | Minor | `src/app/api/v1/account/password/route.ts:11` | Coding Standards §1 (dead code, small surface); Next.js route-module convention | `export const PASSWORD_CHANGED_LOG_MESSAGE` is exported from a route file but imported nowhere (`git grep` finds only the use at line 28; the test pins the literal instead, which is the right way to pin it). It is the only non-handler export in any `route.ts` under `src/app` | A route module's public surface is meant to be its HTTP handlers and segment config; Next.js has rejected other exports in route files in some versions. The build passes on H2 (Stage 9), so this is a convention and dead-export point, not a break | Drop `export`: `const PASSWORD_CHANGED_LOG_MESSAGE = '...';` (the test at `account-route.test.ts` already asserts the literal) |
| STD-13 | Info | `src/app/api/v1/account/password/route.ts:27-28` | Coding Standards §4 (info for business events) | The info line is written after `getSessionCookieIssuer().issue(...)`. If `issue` throws, the password has already changed (and every other session ended) but no line is written | The event the line records is the committed change; today the log can miss it on a cookie fault | Move `logger.info(...)` to directly after `changePassword(...)` and before `issue(...)`. Not needed to merge |
| STD-14 | Info | `src/lib/auth/change-password.ts:18`, `src/server/services/auth-service.ts:1,34` | Coding Standards §3 (module boundaries) | `BLOCK_MINUTES`, the origin of the server throttle policy's `blockMilliseconds`, now lives in the change-form messages module, and `auth-service.ts` imports it from there | The server policy's source of truth sits in a UI-message file; a future move of the form messages would have to carry the policy number. Direction is allowed (server may import `lib/`), so Info. The sign-in form's own "15 minutes" (`sign-in-form.tsx:28`) is already tracked in #346 | When #346 is done, move `BLOCK_MINUTES` to a policy module in `lib/auth/` and have both the messages and `THROTTLE_POLICY` read it |

## Previous Findings (re-review)

| ID | Status | Evidence at a7186f2 |
|----|--------|---------------------|
| STD-01 (Major) | **Fixed** | `src/lib/auth/LICENSE-SecLists-MIT.txt` (21 lines): fetched upstream `danielmiessler/SecLists` `LICENSE` with `gh api`; `diff` after stripping CR is empty and the SHA-256 of both files is `3dbdc93d5f8829de0941744841730a09c106d0732e5ae0e98ca1d77be7ded66c` (1,072 bytes each). "Copyright (c) 2018 Daniel Miessler" and the full permission notice are present. `common-passwords.ts:4-8` now says "the full text, unchanged from upstream, is in `LICENSE-SecLists-MIT.txt` beside this file, as the font licences are beside the fonts". CI Stages 3 and 8 pass |
| STD-02 (Minor) | **Fixed** | `common-passwords.ts:17-18`: "Over 400 lines on purpose (coding standards section 1): the list is data ... the logic below it is the last 30 lines". The logic is lines 10026-10059 (about 34), close enough; logic left in place, which was optional |
| STD-03 (Minor) | **Deferred, accepted** | Not in the diff. DL-191 (3): `import 'server-only'` throws under plain Node (`scripts/ensure-seed-version.ts:13`) and the list is reached by `scripts/bootstrap-admin.ts` (AC-4). GitHub #346 is OPEN, labels `ai-delivery`, `tech-debt`, due before G8. No `server-only` import was added, as ruled |
| STD-04 (Minor) | **Fixed** | `change-password-form.tsx` is 151 lines (was 235); `PasswordField`, `ResultNotice`, `ErrorSummary` are in `change-password-parts.tsx` (92 lines). `ChangePasswordForm` is now lines 55-151 (about 97 lines) and carries the inline "Over 40 lines on purpose (coding standards section 1)" comment with the `UserForm` precedent, which §1 allows |
| STD-05 (Minor) | **Fixed** | `CURRENT_PASSWORD_WRONG_RESPONSE` and `TOO_MANY_ATTEMPTS_RESPONSE` are gone (`git grep` at a7186f2: 0 hits). `errors.ts` exports `TOO_MANY_ATTEMPTS_CODE`, used by `TooManyAttemptsError` and by `resultOf` in `account-client.ts`. `message` is now required on `TooManyAttemptsError`; its one caller passes it |
| STD-06 (Minor) | **Fixed** (this PR's three copies) | `BLOCK_MINUTES = 15` is written once; `TOO_MANY_CHANGE_ATTEMPTS_MESSAGE`, `BLOCKED_BODY` and `THROTTLE_POLICY.blockMilliseconds` read it; the unused default in `errors.ts` is removed. `change-password.test.ts` "STD-06: the minutes of the block are written once" pins all four. The sign-in remainder (`sign-in-form.tsx:28`) is #346 as ruled |
| STD-07 (Info, required by DL-193 as F11) | **Fixed** | See the F11 table below |
| STD-08 (Info) | Not fixed, optional (DL-191 (2)) | `account.ts` imports unchanged. Accepted |
| STD-09 (Info) | Not fixed, optional | The session secret literal is still typed twice. Accepted |
| STD-10 (Info) | Not fixed, optional | `.env.example` unchanged. Accepted |
| STD-11 (Info) | Open at merge | The orchestrator writes a `feat(...)` squash subject with `[AQP-81]` (DL-191 (3)) |

### F11 (DL-193), `route.ts`

| Requirement | Evidence |
|-------------|----------|
| Exactly one `logger.info` on success | `route.ts:28`: `logger.info({ requestId, userId: user.id }, PASSWORD_CHANGED_LOG_MESSAGE)`; no other `logger` call in the file. `account-route.test.ts` "is one info line ..." asserts `logged.info` called once, with `{ requestId: <X-Request-Id header>, userId }` and `'A person changed their own password.'` |
| `requestId`, `userId`, fixed message only | Object has exactly those two keys; the message is a constant with no interpolation |
| No password, hash, e-mail or body | The same test serialises every call of `info`, `debug`, `warn` and `error` and asserts that `HARNESS_PASSWORD`, the new password, `invented.engineer@example.test` and `hash:` do not appear |
| None on a refusal, no submitted value | `it.each` over a wrong current password, a weak new password, a new password equal to the current one, and an invalid body: each asserts `logged.info` not called, and that no typed value appears in any log call |
| Logger usage | `logger` from `@/lib/logger` (pino, redaction by field name, structured JSON, architecture 9.4); correct level for a business event (§4) |

### DL-194, Vitest titles

`git diff c4517e6 a7186f2 -- tests` removes exactly two `it`/`test`/`describe` titles in Vitest files: "appears in no file of tests/e2e except the eleven ruled ..." and "are exactly the 52 tests ruled ..." in `tests/unit/one-width-tag.test.ts`. Each is re-created at the same place as "... except the twelve ruled ..." and "... exactly the 53 tests ...", and the other changes in that file are the header comment (eleven to twelve, 52 to 53), `'account.spec.ts'` in `RULED_FILES`, the one new pinned title, and `toHaveLength(53)`. The third removed title line is the E2E test in `account.spec.ts`: its title text is unchanged, and the diff adds `{ tag: '@one-width' }` (a Playwright test, not a Vitest title; the pinned key in `ONE_WIDTH_TESTS` matches it). No `describe` title was removed or changed in any Vitest file. The `it.each` tables lose no rows.

## Reviewer-specific tables

Layering (checklist 3): `account-client.ts` (lib) imports `../errors` and `./change-password` only; services read repositories through interfaces; the route holds the one log call and nothing else new; the form is client code only. No violation beyond STD-14 (Info).

Error handling and logging (checklist 5, 6): no swallowed error; the new 422 uses `FieldValidationError` with the existing `PASSWORD_RULE_CODE`; the 409 message is now a named constant; no password, hash or e-mail in any message or log.

Documentation (checklist 8): the new `resultOf` and `ChangeResult` are documented with the five kinds; the `common-passwords.ts` header states source, changes, licence file, size exception; service steps 4 and 5 renumbered in the JSDoc. No config or environment change, so no README change is due.

Tests (checklist 9): AAA shape and descriptive names kept; the new `describe` titles carry finding IDs (`QLT-01`, `STD-06`, `F11, STD-07`) as the repo does; data is invented; the harness `signInAs` reset has an explanatory comment.

Version control (checklist 10): four focused commits, all with `[AQP-81]`; all 29 changed files belong to F1 to F11; no generated file or lockfile change.

## Update after H3 (condition L, DL-196 / DL-198)

STD-12 is **Fixed** at H3 ff4e193: `git show ff4e193:src/app/api/v1/account/password/route.ts` shows `PASSWORD_CHANGED_LOG_MESSAGE` as a plain `const` (line 11), used only at line 28. Replied "Fixed (H3 ff4e193, DL-196 / DL-198)" in the STD-12 thread. No new review, no label change. The H3 diff `a7186f2..ff4e193` was not otherwise reviewed by standards (3 files: `route.ts`, `account.spec.ts`, `harness-password.ts`). The verdict stays APPROVE WITH COMMENTS; STD-13 and STD-14 remain Info.

## Issues for other roles

- **orchestrator:** STD-11, the squash subject at merge (`feat(...)` with `[AQP-81]`). Also #346 must stay open and due before G8 (STD-03, sign-in 15-minute wording, and STD-14 can ride on it).
- **developer (optional, any later PR):** STD-12 drop the `export`; STD-13 move the log line before `issue(...)`.
- **qa-engineer:** nothing from standards.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-81/standards-r2.md` (not committed)
- Jira / GitHub updates: PR #341 review submitted as COMMENT, verdict APPROVE WITH COMMENTS, with 3 inline comments (STD-12 to STD-14) and a reply in each of the 9 round-1 threads; label `review:standards-approved` replaces `review:standards-changes-requested`; hand-off comment on AQP-81
- Open questions: none
- Risks raised: none
- Recommended next agent: master — G6 attempt 2 decision once reviewer-quality's re-review is in
