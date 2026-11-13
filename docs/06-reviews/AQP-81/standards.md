# Review Report — AQP-81 (STORY-01.05) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...feat/AQP-81-password-rule-2` (PR #341, base 3f22672) |
| Commit reviewed | c4517e65d5c57715036e448a02bb2fb8f8f4f559 |
| Date | 2026-11-12 |
| **Verdict** | **REQUEST CHANGES** (one Major; PR review submitted as COMMENT, single-token) |

## Summary

The change is well made against the rule-book: strict typing with no `any`, `!` or `as` escapes, one place for the password rule that runs before any hash, deny-by-default `mustChangeAllowed` on exactly two manifest rows, a cookie serializer that cannot split a header, and passwords and hashes never logged, returned or put in an error. README and JSDoc headers are thorough. No secret-like test literal remains after the DL-188 incident. The one item to fix before merge is the missing MIT permission notice for the bundled SecLists word list (STD-01); the rest is Minor or Info.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 5 |
| Info | 5 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Lint | `eslint .` (CI Stages 1 to 11 / 11b, run 43235390390) | Pass (read from the PR check runs; not re-run locally, see note) |
| Type-check | `tsc --noEmit` (same CI stages) | Pass (same) |
| Format-check | none configured (Dev Record) | n/a |
| Build | `next build` (CI) | Pass |
| Secret scan | Gitleaks, CI Stage 2 (all branches on origin), run 43235390390 | Pass; `.gitleaks.toml` and `.gitleaks-baseline.json` unchanged by the PR |
| Secret-like literals in added lines | Manual grep of the full diff for 24+ character strings, `eyJ`, `session-token=`, `Bearer`, key/secret/token assignments | None token- or cookie-shaped. Test values are `invented-*` strings or short human-made passwords. Commit 333e0ba is not in this branch's history (`git log c4517e6` shows 0 matches) |
| Risky constructs in added lines | Manual grep: `any`, `!` assertions, `as` casts, `@ts-`, `eslint-disable`, `console.`, TODO/FIXME, `.only`, `.skip` | None found |
| Local re-run of lint and tsc on the head | Extracting the head tree to a scratch directory | Not done: the command was refused by the permission system. Tooling results above are CI's |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Major | `src/lib/auth/common-passwords.ts:4-6` | Coding Standards §5 (licence check on third-party material); repo practice `src/app/fonts/LICENSE-*-OFL.txt`; AC-1, assumption A-1 | The list is the whole of SecLists `10k-most-common.txt` (MIT). The header gives a copyright line and a URL, and says "the full text is at the source above". The MIT permission notice is not in the repository | MIT requires the copyright notice and the permission notice in copies or substantial portions; a pointer does not meet it. A technical licence breach in a company repository, cheap to remove | Add `src/lib/auth/LICENSE-SecLists-MIT.txt` with the full MIT text and "Copyright (c) 2018 Daniel Miessler"; reword header lines 5-6 to point at it |
| STD-02 | Minor | `src/lib/auth/common-passwords.ts:18` | Coding Standards §1 (files ≤ 400 lines, justify exceptions inline) | 10,046 lines with no inline note that the size is intended; the 27 lines of logic (`PRODUCT_WORDS`, `withoutNonLettersAtEnds`, `isCommonPassword`) sit at the bottom of the data | A reader cannot tell the size is deliberate; the logic is hard to find and review | Add "Over 400 lines on purpose (coding standards section 1): a word list" to the header (precedent: `tests/support/route-calls.ts`). Optionally move the logic to `is-common-password.ts` |
| STD-03 | Minor | `src/lib/auth/common-passwords.ts:11-14` | Coding Standards §3 (module boundaries); NFR-009 | "Read by the server only" is stated in a comment and enforced nowhere; the file is in `src/lib`, which client code may import | One stray client import adds about 80 KB to first-load JS; only the JS-budget test catches it, after the fact | `import 'server-only';` first line (as `src/server/views/schemas/index.ts` does), or move under `src/server/auth/` and amend the architecture tree |
| STD-04 | Minor | `src/components/features/account/change-password-form.tsx:71` (71-235) | Coding Standards §1 (functions ≤ 40 lines) | `ChangePasswordForm` is 165 lines with no justification; three field blocks and three result notices repeat one shape each | Hard to review and to change. Precedent: `UserForm` (146 lines) merged on master, hence Minor | Extract `PasswordField` and `ResultNotice`, about 90 lines left; or add the "over 40 lines on purpose" comment |
| STD-05 | Minor | `src/lib/auth/account-client.ts:13-14` | Coding Standards §1 (no magic strings, DRY), checklist item 11 (dead code) | `CURRENT_PASSWORD_WRONG_RESPONSE` is exported and never imported (src, scripts, tests). Both constants re-type codes whose home is `src/lib/errors.ts` (`CURRENT_PASSWORD_WRONG_CODE` line 81; `'TOO_MANY_ATTEMPTS'` literal line 73) | If the server code changes, the check at `change-password-form.tsx:128` silently stops matching | Delete the unused constant; add `TOO_MANY_ATTEMPTS_CODE` in `errors.ts`, use it in `TooManyAttemptsError` and the form |
| STD-06 | Minor | `src/lib/auth/change-password.ts:15` (also `src/lib/errors.ts:72`, `src/components/features/account/texts.ts:22`) | Coding Standards §1 (no magic numbers or strings) | "15 minutes" is typed in three new messages; the real value is `THROTTLE_POLICY.blockMilliseconds`. The default message of `TooManyAttemptsError` (`errors.ts:72`) is never used because the only caller passes its own | A policy change leaves the screens promising the wrong time. Sign-in has the same habit (`sign-in-form.tsx:28`), hence Minor | Make `message` required on `TooManyAttemptsError`; add one test that ties the wording to the policy so the copies cannot drift |
| STD-07 | Info | `src/app/api/v1/account/password/route.ts:22` | Coding Standards §4 (`info` for business events); Dev Record open question 2 | A successful own-password change leaves no log or audit trace (`withRoute` logs refusals only) | Nothing to look up after an incident. A product decision (question 2), not a defect | If "no audit event" stands, one structured `logger.info({ requestId, userId }, 'password changed')`, no password, hash or e-mail |
| STD-08 | Info | `src/server/views/schemas/account.ts:4` | Coding Standards §3 (module boundaries) | The account contract imports `PASSWORD_INPUT_CEILING`, `PASSWORD_REQUIRED_MESSAGE`, `PASSWORD_TOO_LONG_MESSAGE` from `lib/users/validation` | Account wording would move with a Users screen change | Move the three constants beside `PASSWORD_MAX_LENGTH` in `password-rule.ts`. Not needed to merge |
| STD-09 | Info | `tests/support/session-harness.ts:133`, `tests/unit/account-route.test.ts:40` | Coding Standards §6, §1 | `'invented-session-secret-for-the-harness'` is typed twice; the test passes only while they stay equal | Small drift risk. Good point: the value is invented and low-entropy, the right answer to DL-188 | Export one `HARNESS_SESSION_SECRET` and import it in the route test |
| STD-10 | Info | `.env.example:39-41` (not in this diff) | Coding Standards §8 (config docs) | `ADMIN_INITIAL_PASSWORD=CHANGE_ME_ADMIN_PASSWORD` has no comment about the rule; the placeholder now fails it (no digit), which is acceptable | A first run that copies the placeholder gets a refusal with no hint in the file; README does state the rule | Add one comment line: "must meet the password rule: 10 to 128 characters, a number, a symbol" |
| STD-11 | Info | commit `84cae81` | Coding Standards §9 (Conventional Commits) | `wip: AQP-81 password rule in progress [AQP-81]` is not a Conventional Commits type | Moot under squash-merge (all-auto policy); the squash subject must be a `feat(...)` line with `[AQP-81]` | Check the squash subject at merge |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current** (`common-passwords.ts:4-6`)
```
 * Source: SecLists, `Passwords/Common-Credentials/10k-most-common.txt` (the 10,000 most common passwords),
 *   https://github.com/danielmiessler/SecLists, MIT Licence, Copyright (c) 2018 Daniel Miessler. The licence permits use, copying,
 *   modification and distribution with this notice kept; the full text is at the source above.
```
**Suggested**
```
 *   https://github.com/danielmiessler/SecLists, MIT Licence, Copyright (c) 2018 Daniel Miessler. The full licence notice is in
 *   `LICENSE-SecLists-MIT.txt` beside this file, as the font licences are beside the fonts.
```
and a new file `src/lib/auth/LICENSE-SecLists-MIT.txt` holding the MIT text unchanged.

### STD-05 and STD-06 together
**Suggested** (`src/lib/errors.ts`)
```ts
export const TOO_MANY_ATTEMPTS_CODE = 'TOO_MANY_ATTEMPTS';

export class TooManyAttemptsError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(options.code ?? TOO_MANY_ATTEMPTS_CODE, 429, message, options.cause);
  }
}
```
`change-password-form.tsx` then compares `outcome.code === TOO_MANY_ATTEMPTS_CODE`, and `account-client.ts` drops both of its constants.

### STD-03
**Suggested** (first line of `common-passwords.ts`)
```ts
import 'server-only';
```
</details>

## Reviewer-specific tables

Documentation check (checklist 8): public functions in `password-rule.ts`, `password-policy.ts`, `account-service.ts`, `session-cookie.ts`, `set-cookie.ts` carry purpose, errors and the reason for non-obvious choices (A-3). README updated for the rule, the bootstrap refusal and Change password. The only documentation gap is STD-10.

Layering check (checklist 3): `lib/` stays free of `server/` imports; services depend on repositories through interfaces; the route holds no logic beyond `setSessionCookie(issue(...))`; the page and screen are server components with only the form as client code; the frame props still hand the browser only the whitelisted fields. No layering violation found beyond STD-03 and STD-08.

Security hygiene (checklist 7): input validated at the boundary by a strict zod schema with a 1,024-character ceiling before the rule and before hashing; CSRF origin check unchanged and first; authZ by manifest row, deny by default; no string-built queries (Prisma `select`, `update` with `where` on the expected hash); no new dependency (`next-auth/jwt` is already installed); no secret in code or tests.

Test conventions (checklist 9): files are in `tests/unit`, `tests/integration`, `tests/security`, `tests/e2e` as the strategy says; names are descriptive sentences, matching the existing suite; data is invented (`.test` addresses, `invented-*` passwords). The two longest E2E tests combine several steps by design (one disposable person per test); I leave that to reviewer-quality.

## Previous Findings (re-review only)

Not applicable: round 1.

## Issues for other roles

- **developer / orchestrator:** the Dev Record's order note (DL-180: AQP-142, AQP-276, then this story) is untouched by anything here.
- **product-owner / solution-architect (Dev Record open question 2):** decide whether an own-password change needs an audit event; STD-07 is the standards view of the same gap.
- **solution-architect:** if STD-03 is resolved by moving the list under `src/server/auth/`, the source tree at `architecture.md` line 1360 needs the matching edit.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-81/standards.md`
- Jira / GitHub updates: PR #341 review submitted as COMMENT with 9 inline comments (STD-01 to STD-09) and the verdict in the body; label `review:standards-changes-requested` added; hand-off comment on AQP-81
- Open questions: none new
- Risks raised: none new
- Recommended next agent: orchestrator — collect the three G6 reviews; developer to fix STD-01 (and the Minors if cheap) before master's G6 decision
