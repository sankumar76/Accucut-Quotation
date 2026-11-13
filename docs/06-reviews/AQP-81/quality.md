# Review Report — AQP-81 (STORY-01.05) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-81-password-rule-2` (PR #341; base 3f22672, three E2E shards) |
| Commit reviewed | c4517e6 |
| Date | 2026-11-12 |
| **Verdict** | **REQUEST CHANGES** (two Major; PR review submitted as COMMENT, single-token) |

## Summary
The change is well built. The rule is one pure function shared by page and server. It runs before any hash. The throttle reserves an attempt before it checks the current password, on a key of its own. The password update is a compare-and-swap on the stored hash, so a race or an Admin reset made in between is never overwritten. The must-change guard is deny by default in both `withRoute` and `authorizePage`, and the fresh session cookie is sealed from server-held values only. Tests are thorough at every level.

Two correctness gaps need fixing before merge:
- **QLT-01.** The new password may be the same as the current one. A person in "Set a new password" can type the Admin's temporary password again, which clears the flag. That defeats FR-004 ("temporary") and the story's own purpose.
- **QLT-02.** The common-password check misses every list entry that starts or ends with a digit, or has no letters. So `1234567890!`, `123456789!`, `11111111111!` and `1qaz2wsx!!` are accepted. These are exactly the "composition-rule products" that architecture §8 says the stripped check exists to catch.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 |
| Minor | 4 |
| Info | 6 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| CI on head | run 43235390390 (read, not re-run) | 5 of 5 green: unit 3,350, all levels 5,758, E2E 284 + 282 + 269 = 835, skipped 24, changed-code coverage 96.0 % |
| Story unit and security tests, local (scratch worktree at c4517e6) | `npx vitest run tests/unit/auth tests/unit/account-service.test.ts tests/unit/account-route.test.ts tests/unit/http-with-route-must-change.test.ts tests/unit/http-page-access.test.ts tests/unit/auth-session-cookie.test.ts tests/unit/http-set-cookie.test.ts tests/unit/user-service-password-rule.test.ts tests/unit/users-validation.test.ts tests/unit/bootstrap-admin-service.test.ts tests/security/role-matrix.test.ts` | 23 files, 628 tests passed |
| Probe of the common-password check | `node --experimental-strip-types` on copies of `password-rule.ts` and `common-passwords.ts`, 16 inputs | Accepted: `1234567890!`, `!1234567890`, `123456789!`, `11111111111!`, `1qaz2wsx!!`, `P@ssw0rd123`, `P@ssword123`. Refused: `Password1!`, `Welcome@123`, `qwerty123!`, `iloveyou1!`, `Abcdefgh1!` (QLT-02) |
| Control C1, PR #343 (draft, closed unmerged) | `control/AQP-81-qlt-mustchange-allowlist` at c4517e6 + 1 line: `mustChangeAllowed: true` on the `GET /api/v1/audit` row | Run 43238118333: red only in `tests/unit/audit-route.test.ts` "is listed in the manifest with GET only, for the Admin only", a deep-equal of that one row written for STORY-01.07. This is incidental: no AQP-81 test failed |
| Control C2, PR #343 second commit | the same line on the `GET /api/v1/options/materials` row instead | Run 43240917570: "Stages 1 to 11b" **green**. Lint, type-check, Stage 6 unit with coverage, Stage 11 integration and security against PostgreSQL, changed-code coverage and the JS budget all pass. **The plant survives every unit, security and integration test**, which confirms QLT-06. The three E2E shards then also passed, so **the whole run is green with the plant**. Closed unmerged |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Major | `src/server/services/account-service.ts:87-95`; `src/lib/auth/change-password.ts:31-42` | FR-004 ("temporary: that user chooses their own password"); AC-5; story "a password the Admin gave me is only used once"; SCR-23 notice | Nothing refuses a new password equal to the current one. After `matches`, the service hashes `newPassword` and clears `must_change_password` even when `newPassword === currentPassword`. The harness depends on this: the `POST /api/v1/account/password` recipe in `tests/support/route-calls.ts:88` and `harness-password.ts` send the same value as current and new and expect 204 | A person whose password the Admin set or reset can type it again in "Set a new password". The flag clears, and the Admin-known password, given by phone or in person, stays in use. The notice "The password you were given is only for your first sign-in" becomes false | Once the current password matches, refuse `newPassword === currentPassword` with a 422 under `newPassword`, before hashing. The current password was just verified, so a string comparison is enough and costs no argon2. Add the same check in `changePasswordProblems`. The wording needs the ux-expert (proposal: "Choose a new password that is different from your current one."). Change the recipe so it still returns a repeatable answer, for example two alternating invented passwords, or the 422 of a wrong current password |
| QLT-02 | Major | `src/lib/auth/common-passwords.ts:10033-10045` | AC-1 intent; architecture §8 "Common" ("a composition rule produces `Password1!` and `Welcome@123`, which a plain list misses"); NFR-003; BR-049 | `withoutNonLettersAtEnds` strips digits too. A list entry that starts or ends with a digit, or has no letters at all, can never match the stripped form: `1234567890!` becomes `""`, and `1qaz2wsx!!` becomes `qaz2wsx`. Probe: `1234567890!`, `!1234567890`, `123456789!`, `11111111111!` and `1qaz2wsx!!` all pass the rule | The most common entries of the list (`123456`, `12345678`, `123456789`, `1234567890`, `1qaz2wsx`) become valid passwords once a single `!` is added. That is the exact pattern the stripped check was designed for. A weak password is accepted at all four entry points | Also test the password with only symbols stripped from both ends: `lower.replace(/^[^\p{L}\p{Nd}]+\|[^\p{L}\p{Nd}]+$/gu, '')`. Optionally also test it with only trailing non-letters stripped. Add `1234567890!`, `!123456789`, `1qaz2wsx!!` to the AC-1 case table and to "the list of common passwords" in `password-rule.test.ts`. Leetspeak (`P@ssw0rd123`) is outside the spec: see QLT-12 |
| QLT-03 | Minor | `src/server/services/user-service.ts:213` (reset; diff hunk at :193) | AC-5, AC-6; architecture §6 Rate limits ("An Admin password reset clears the block"); reviewer-performance point routed by the orchestrator (Jira 11697) | **Confirmed.** The Admin reset clears only `accountThrottleKey(email)`, not `passwordChangeThrottleKey(userId)` | A person blocked on SCR-23 (five wrong current passwords) and then reset by the Admin is sent to "Set a new password" and refused with 429 for up to 15 minutes. That page is the only one open to them, and the Admin cannot lift the block. Rare, but it contradicts what the Admin expects a reset to do | After the commit, also `await throttles.clear(passwordChangeThrottleKey(keySecret, target.id))`. Test: in `user-service` and in `account-password.test.ts`, block the form, reset, and the next change is not 429 |
| QLT-04 | Minor | `src/components/features/account/change-password-form.tsx:126-132` | AC-3; open question 5 | A refusal with no field messages (409 `PASSWORD_CHANGED_ELSEWHERE`, a 403, or a 401 other than `SESSION_ENDED`) falls through to `setPhase('failed')`: "We could not change your password. Check your connection and try again." The server's `title` ("Your password was changed in another place. Try again.") is in `outcome.title` but is discarded | Wrong advice: the connection is fine, and the person should re-enter the current password (now the other one). No test covers the 409 on the page | For `outcome.status === 'refused'` with no fields, show `outcome.title` (a refused phase), and keep the connection sentence for `failed` only. Add a unit or E2E case with a stubbed 409 |
| QLT-05 | Minor | `src/lib/auth/password-rule.ts:14` | AC-1 Given ("one zod rule used on client and server"); architecture §8 ("One zod schema"); Dev Record "Decisions & deviations" | The rule is a pure function with no zod. The zod schemas check only presence and the 1,024 ceiling. The behaviour of AC-1 is met in full, and the reason (NFR-009, the same as `lib/users/validation.ts`) is sound, but the Dev Record does not list it as a deviation | AC text and architecture now disagree with the code, and the next reader of §8 looks for a zod schema that does not exist | List the deviation in the Dev Record. solution-architect amends §8 to "one rule" (the zod schemas carry the ceiling). No code change |
| QLT-06 | Minor | `src/server/http/route-manifest.ts:78` (with `:192-193`) | AC-5 ("every other page and API route is refused"); test adequacy | The guard is deny by default (good), but no test pins **which** rows are open. `account-route.test.ts` checks `/api/v1/me` and `/api/v1/users`; `http-with-route-must-change.test.ts` uses invented rows. Control C1 went red only through an unrelated STORY-01.07 deep-equal. Control C2 (the same line on `GET /api/v1/options/materials`) passed stages 1 to 11b, so no test caught it | A later story can add `mustChangeAllowed: true` to a real row (copy-paste from the account rows), and a person who has not yet replaced the Admin's password can then use that route. Nothing for AC-5 would fail | In `http-route-manifest.test.ts`: `expect(ROUTE_MANIFEST.filter((row) => row.mustChangeAllowed === true).map((row) => row.path)).toEqual(['/account', '/api/v1/account/password'])`, with a comment that the list changes only with an AC |
| QLT-07 | Info | `src/server/auth/session-cookie.ts:1-52`; `route.ts:24-25` | Open question 4; assumption A-3; architecture §8 "12 hours from sign-in"; ADR-009 | **Accepted.** The route-issued cookie is the safer design. It holds the same three server-held claims, uses the same `encode` and secret, and is set only on a 204. The tests decode it, check its keys, show that another secret cannot read it, that a refusal sets none, and that the browser stays in while another device gets 401. Restarting the 12 hours at the change is acceptable, because the change proves the current password (equal to a sign-in) and is throttled. It cannot be done without the password. `sessionCookieName` repeats next-auth's naming, which E2E proves today | The architecture text "the sign-in time" no longer describes `signedAt` exactly | solution-architect: record in ADR-009 / §8 that `signedAt` is the time of the last proof of the password (sign-in or own change), and that A-3 is replaced. No code change |
| QLT-08 | Info | `src/components/features/account/texts.ts:92-94` | Open question 1 | **Accepted.** "Too many attempts." / "Try again in 15 minutes. You can still sign in." is true (own key; AC-6 test proves sign-in still works) and matches the API title | — | ux-expert confirms the wording in ux-spec SCR-23 (state "Blocked") |
| QLT-09 | Info | `src/server/services/account-service.ts:24-25` | Open question 2; FR-011 | **Accepted for this story.** FR-011 covers "user changes made by the Admin", and an own change is not one. The session raise is visible in `users.session_version`. Same point as STD-07 (standards), not repeated | No trace of a password change for incident review | product-manager decides whether a `user.password_changed` follow-up is wanted; if not, the `logger.info` of STD-07 |
| QLT-10 | Info | `src/lib/auth/common-passwords.ts:10030, 10044` | Open question 3; architecture §8 ("Product words such as `accucut` are added") | **Accepted.** A substring match is stricter than a list entry and stronger for security. `quotation` is an ordinary English word, so a passphrase such as "Zebra quotation 42" is refused as "too common" (probe), which reads a little oddly | Small usability cost only | product-owner / ux-expert confirm `quotation` stays a product word; no change needed to merge |
| QLT-11 | Info | `texts.ts:90-91`, `change-password.ts:10-15`, `with-route.ts:170` | Open question 5 | **Accepted**, except where the failed sentence is used for a refusal (QLT-04). The empty-field messages follow the pattern of SCR-14 | — | ux-expert adds the words to ux-spec SCR-23 |
| QLT-12 | Info | `account-service.ts`, `throttle-repository.ts`, `user-repository.ts:288-302`, `with-route.ts:169-171`, `page-access.ts:27` | Praise and notes | Good practice: the rule before the throttle and the hash (a weak new password costs no attempt and no argon2); reserve-before-verify on an atomic counter; release on our own fault; compare-and-swap on `password_hash` (with integration tests of the race and of an interleaved Admin reset); the must-change check before the role check; `navGroups` emptied, not hidden. Note: leetspeak variants (`P@ssw0rd123`) pass; the spec does not ask for them, so this is not a finding | — | Optional: consider a leet-normalised candidate when QLT-02 is fixed |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-01
**Current** (`account-service.ts:87-95`)
```ts
const { storedHash, matches } = await checkCurrent(account.id, currentPassword, key);
if (!matches) { throw new FieldValidationError([{ field: 'currentPassword', ... }]) }
await throttles.clear(key);
const newHash = await hasher.hash(newPassword);
```
**Suggested**
```ts
await throttles.clear(key);
if (newPassword === currentPassword) {
  throw new FieldValidationError([{ field: 'newPassword', message: NEW_PASSWORD_SAME_MESSAGE }], { code: PASSWORD_RULE_CODE });
}
const newHash = await hasher.hash(newPassword);
```
And in `changePasswordProblems`, after the rule check:
`else if (values.newPassword === values.currentPassword) found.newPassword = NEW_PASSWORD_SAME_MESSAGE;`
Tests: the service refuses same-as-current with no hash and the flag stays set. E2E "Set a new password": typing the temporary password again keeps the person on `/account`.

### QLT-02
**Current**
```ts
return COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(withoutNonLettersAtEnds(lower));
```
**Suggested**
```ts
const NON_ALPHANUMERIC_AT_ENDS = /^[^\p{L}\p{Nd}]+|[^\p{L}\p{Nd}]+$/gu;
const candidates = [lower, withoutNonLettersAtEnds(lower), lower.replace(NON_ALPHANUMERIC_AT_ENDS, '')];
return candidates.some((candidate) => COMMON_PASSWORDS.has(candidate));
```
Probe evidence (c4517e6): `1234567890!` null, `!1234567890` null, `123456789!` null, `11111111111!` null, `1qaz2wsx!!` null, `P@ssw0rd123` null, `P@ssword123` null. `Password1!`, `Welcome@123`, `qwerty123!`, `iloveyou1!`, `Abcdefgh1!` all `TOO_COMMON`.

### QLT-03
```ts
await throttles.clear(accountThrottleKey(keySecret, email));
await throttles.clear(passwordChangeThrottleKey(keySecret, asked.id));
```

### QLT-06
```ts
it('STORY-01.05 AC-5: only the account page and the change are open to a person who must set a new password', () => {
  expect(ROUTE_MANIFEST.filter((row) => row.mustChangeAllowed === true).map((row) => row.path)).toEqual(['/account', '/api/v1/account/password']);
});
```
</details>

## Reviewer-specific tables

### AC conformance
| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 | `password-rule.ts` (length in code points before hashing, digit `\p{Nd}`, symbol = not letter or digit, e-mail ignoring case, common via `isCommon`); `common-passwords.ts` (SecLists 10k, stripped ends, product words) | `tests/unit/auth/password-rule.test.ts` (whole case table plus 10 and 128, emoji, Unicode letters; 100 % branches threshold in `vitest.config.ts:55`) | **Met as written**; intent gap QLT-02 (Major); "zod" wording QLT-05 |
| AC-2 | `assertPasswordRule` → 422 `PASSWORD_RULE` under the field; the UX §6.0 words in one table; self or other sentence for the e-mail | `password-rule.test.ts` (words), `account-route.test.ts`, `user-service-password-rule.test.ts`, `users-routes.test.ts`, `account.spec.ts`, `users.spec.ts` | Met. A body above the 1,024 ceiling is a 422 from the schema with the same words but not the code `PASSWORD_RULE` (edge, Info only) |
| AC-3 | `account-service.ts` (current check, CAS, `session_version` +1), `route.ts` + `session-cookie.ts` (fresh cookie), form texts | `account-service.test.ts`, `account-route.test.ts` (decoded cookie at new `sv`, `/me` 200), `account-password.test.ts` (argon2id, old token refused, race 409), `account.spec.ts` (old refused, new signs in, other device 401) | Met. Deviation from A-3 accepted (QLT-07); 409 shown wrongly on the page (QLT-04) |
| AC-4 | `user-service.ts` create and reset, `bootstrap-admin-service.ts` (rule before `hasAnyAdmin`), `scripts/bootstrap-admin.ts` (exit 1); sign-in unchanged (`options.ts` ceiling only) | `user-service-password-rule.test.ts`, `bootstrap-admin-service.test.ts`, `bootstrap-admin-script.test.ts`, `users-database.test.ts` (weak stored password still signs in) | Met |
| AC-5 | `withRoute` 403 `PASSWORD_CHANGE_REQUIRED`, `authorizePage` redirect before role, manifest `mustChangeAllowed` on 2 rows, frame without menu, form goes home | `http-with-route-must-change.test.ts`, `http-page-access.test.ts`, `account-route.test.ts`, `portal-frame-props.test.ts`, `account.spec.ts` (Admin add and reset) | **Met as written; purpose defeated by QLT-01 (Major)**; allow-list not pinned (QLT-06); reset leaves the change block (QLT-03) |
| AC-6 | `password-change` key, `CHANGE_POLICY` = sign-in numbers, reserve before verify, clear on success | `account-service.test.ts` (6th refused even if right, after 15 min free, run reset, own key, fault releases), `account-password.test.ts` (real SQL, sign-in still works), `account-route.test.ts` (429, no cookie), `account.spec.ts` | Met |
| AC-7 | SCR-23 page and form with shared `FormField`, `PasswordInput`, `Notice`, shadcn `Card` and `Button`; error summary linking to fields | `account.spec.ts` at 360, 768, 1366 (overflow, 44 px, axe, autocomplete, paste, toggle, `aria-invalid`, `aria-describedby`, keyboard) | Met |
| T7 | SCR-14 hints start with the rule; four states; own phone-card line | `users-texts.test.ts`, `users.spec.ts` | Met |

### Developer's open questions: judgement
| # | Question | Judgement | Finding |
|---|----------|-----------|---------|
| 1 | SCR-23 blocked wording | Correct and true; ux-expert to adopt | QLT-08 |
| 2 | No audit event for an own change | Correct reading of FR-011; product decision for a follow-up | QLT-09 (STD-07) |
| 3 | Product words as substrings | Sound and stricter; confirm `quotation` | QLT-10 |
| 4 | Route-issued fresh cookie, 12 hours restart | Correct and safer than `update`; architect records it | QLT-07 |
| 5 | Wording the spec does not give | Acceptable, except the failed sentence used for a 409 | QLT-04, QLT-11 |

## Issues for other roles
- **ux-expert:** wording for QLT-01 (new equals current); adopt the words of questions 1 and 5 in SCR-23.
- **solution-architect:** §8 "One zod schema" → "one rule" (QLT-05); ADR-009 / §8 meaning of `signedAt` after an own change, A-3 replaced (QLT-07); §8 "Common" could name the symbols-only stripped candidate (QLT-02).
- **product-manager / product-owner:** audit follow-up (QLT-09); `quotation` as a product word (QLT-10).

## Previous Findings (re-review only)
n/a (round 1)
