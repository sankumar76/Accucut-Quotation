# Test Report — AQP-38 (STORY-01.01): Sign in and sign out

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `ea8dc6b` (the developer's last commit) on `feat/AQP-38-sign-in`, the branch of the PR that supersedes PR #58 (see "CI and a secret-scan finding QA introduced"), plus QA's tests and this report in one commit |
| CI | Run 41845931376 on `ea8dc6b`: success on stages 1 to 12 (2,039 unit and integration tests, changed-code coverage 95.2 %, 125 E2E tests at three widths with axe). This is the regression reference |
| Environment | Windows 11; Node v24.19.0 (CI uses Node 22); Docker 29.8.0; PostgreSQL 17 from `compose.dev.yml` as a throwaway Compose project `qa38` on host port 55538 with invented passwords; Chromium (Playwright 1.64.1) against the **production build** (`next build && next start`, port 3101) and the development server (3100) |
| Date | 2026-11-04 |
| **Recommendation** | **ACCEPT.** All 8 ACs verified with evidence, and no product defect found. One observation for a real-phone check (OBS-1, the iPhone may zoom on the 14 px fields); it is not an AC and does not hold G7. **CI note:** the new PR's stage 2 stays red until PR #58's branch, which still holds QA's flagged commit, leaves origin (see below) |

## Summary

Sign-in, the one generic failure message, the lock-out and its release, sign-out on every device, the 12-hour limit, the open-redirect guard, the first-Admin script and SCR-01's accessibility all do what the eight ACs say.

I tested them independently:
- **Over real PostgreSQL through next-auth's own handler:** 42 QA acceptance tests in `tests/acceptance/aqp-38-sign-in.test.ts`.
- **In the browser against the production build at all three widths:** 30 QA E2E tests in `tests/e2e/aqp-38-qa.spec.ts`.
- **Alongside the developer's suites:** run locally with no retries.

AC-3 is tested one attempt at a time, as written, to the millisecond on a controlled clock. The developer's parallel tests are extra evidence. Ten deliberate faults put into the code, one at a time, were each caught except one that turned out to be a redundant guard (see "Mutation checks").

## AC Verification Matrix

Test IDs: `[AQP-38 AC-n]` titles in `tests/acceptance/aqp-38-sign-in.test.ts` (A) and `tests/e2e/aqp-38-qa.spec.ts` (E), plus the developer's tests named. Techniques: BVA boundary-value analysis, EP equivalence partitioning, DT decision table, ST state transition, EG error guessing.

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 | Developer E2E "AC-1" (Engineer "My tasks", Lead "Task queue", account menu); E keyboard test | EP | ✅ Pass | Locally on the production build at three widths: an Engineer lands on `/queue` "My tasks" and a Lead on "Task queue", with the SCR-03 empty-state text. Sign-in by Enter and by the button both work (E: a keyboard-only sign-in ends on "My tasks") |
| AC-2 (negative) | A: 3 tests; developer handler and E2E AC-2 tests | EP, DT, EG | ✅ Pass | **Same answer:** five kinds of failure all give 401 at the handler and at the route (after `withSignInStatus`), the same address (`?error=CredentialsSignin`), the same set of cookie names, and no session cookie. The five: wrong password; unknown e-mail; deactivated with the correct password; deactivated with a wrong one; a known e-mail in another case with a wrong password. **Same work:** each case checks exactly one argon2id hash, a dummy one for an unknown e-mail (counted). **Same time, stated tolerance:** with the production cost (64 MiB, 3 passes), 7 interleaved rounds give medians for the three failures within 50 % of each other. **In the browser** (developer E2E, run here): the same message for all three, the e-mail stays in its field and focus moves to the notice |
| AC-3 (negative) | A: 10 tests, one attempt at a time; E locked-state test; developer handler and parallel tests | BVA, ST, DT, EG | ✅ Pass | **Account key:** five failures one minute apart are each answered; the sixth is `locked`, which the route sends as **429**. A correct password at 15 min minus 1 ms after the fifth failure is still `locked`, with no session; at exactly 15 min it signs in. **During a block:** 14 refused attempts, one a minute, do not lengthen the block; afterwards a new run again needs five failures. **"Consecutive":** four failures, a correct sign-in, then five failures are all answered and only the sixth is locked. **Spellings:** upper case, leading or trailing spaces and a capitalised first letter are one key, so they buy no extra guesses. **Unknown e-mail:** the same path, the same code and 429. **Scope:** a blocked account does not block a colleague on the same address. **Per address:** 30 failures on 30 accounts in about 10 minutes block the 31st attempt, even with a correct password, until exactly 15 min after the 30th (refused at minus 1 ms, accepted at 0); another address is not affected. 29 failures followed by a window that runs out start the count again. **Forged header:** a forged first `X-Forwarded-For` entry buys nothing, because only the proxy's last entry counts. **Storage:** the table holds only 64-character keyed hashes, with no e-mail and no address. **In the browser:** six attempts show exactly "Too many attempts. Try again in 15 minutes, or ask the Admin to reset your password.", as a `role="alert"`, focus moves to it, the e-mail is kept, and axe finds 0 violations |
| AC-4 | A: 1 test; E stale-cookie test; developer E2E AC-4 and handler tests | ST, EG | ✅ Pass | **Sign-out on every device:** two devices signed in; sign-out on the phone clears its cookie (empty value, `maxAge 0`) and ends the desk's session too. A fresh sign-in works while both old cookies stay dead. The stale desk cookie signing out cannot end the fresh session (compare-and-increment). **In the browser:** a copied cookie on a second browser context reaches `/queue` before sign-out. After sign-out on the first, the proxy lets it through and the page sends it to `/sign-in`, which renders (no loop), and it can sign in again. The developer's E2E (run here) shows `Cache-Control: private, no-store` on `/queue`, and the back button shows nothing protected |
| AC-5 | A: 3 tests; developer handler and E2E AC-5 tests | BVA, EG | ✅ Pass | **Cookie:** `__Secure-next-auth.session-token`, HttpOnly, Secure, SameSite=Lax, path `/`, lifetime 12 h, in production mode at the handler and in the production build in the browser. **Token:** it holds only `sub`, `sv` and `signedAt` (plus next-auth's `iat`, `exp`, `jti`), and no role, name or e-mail. A tampered cookie, or one read with another secret, is not a session. **12 hours:** honoured at 12 h minus 1 ms, refused at exactly 12 h and later, and refused for a sign-in time in the future. **Per request** (developer test): a deactivation or a role change takes effect at the next request |
| AC-6 (negative) | A: 23 tests; E 2 tests (×3 widths); developer E2E AC-6 | EP, EG | ✅ Pass | `safeReturnPath` sends 19 hostile inputs home: `//evil.example`, https and http absolute addresses, `/\evil`, `\\evil`, `///evil`, `/.//evil`, `/..//evil`, a tab or a newline inside, a leading space, the `javascript:` and `data:` schemes, no leading slash, `/sign-in`, `/api/auth/...`, 2,100 characters, and empty. `%2F%2F`, `%5C` and full-width solidus inputs stay paths on this portal. A same-origin path with a query round-trips through the sign-in link. **In the browser:** signing in from links carrying `/.//evil.example`, `/%2F%2Fevil.example` and `javascript:alert(1)` lands on this site. A signed-in visitor sent to `/sign-in?callbackUrl=` with five hostile addresses is taken to `/queue` by the server |
| AC-7 | Developer `bootstrap-admin-script.test.ts` (in CI); QA manual run | DT, EG | ✅ Pass | `npx tsx scripts/bootstrap-admin.ts` against the empty qa38 database, with invented `ADMIN_EMAIL` (mixed case) and `ADMIN_INITIAL_PASSWORD`. **First run:** exit 0, "the first Admin was created"; the row is lower-case e-mail, `ADMIN`, active, `must_change_password` true, `session_version` 0, hash `$argon2id$v=19$m=65536,t=3,p=1`. **Second run:** exit 1, "an Admin already exists; nothing was changed". The password appears **0 times** in either run's output |
| AC-8 (NFR-016 to 018) | E: 7 tests (×3 widths); developer E2E AC-8 (×3 widths) | EP, EG | ✅ Pass | At 360×800, 768×1024 and 1366×768 on the production build: no horizontal scroll and every control at least 44 px (developer tests). **axe** (wcag2a, 2aa, 21aa, 22aa) finds 0 violations in the default, error, field-error, locked and "could not be checked" states. **Keyboard only, no scripted focus:** Tab goes skip link, then the e-mail field, then password, then the show/hide toggle (Space toggles it; `aria-pressed` and its name change; the value is kept; focus stays on it), then Sign in, and Enter signs in. Every stop shows a visible focus indicator. The skip link, used with Enter, moves focus to `main`, and the next Tab is the e-mail field. **Screen-reader tree** (ARIA snapshot): heading "Sign in", form "Sign in", textboxes "E-mail" and "Password", button "Show password" [pressed=false], button "Sign in". **Field errors:** "Enter your e-mail address.", "Enter your password." and "Enter an e-mail address like name@company.com." are the fields' accessible descriptions, with `aria-invalid` set and focus on the field. **Helpers:** `autocomplete` is `username` and `current-password`; the e-mail field is `type=email`; paste is not blocked (developer test). The notice is `role="alert"` |

## Exploratory checks named in the brief

| Area | Result | Evidence |
|------|--------|----------|
| Generic error: wrong password, unknown e-mail, deactivated user | ✅ | AC-2 row: the same status, address, cookies, work and time (within tolerance), in the browser and at the handler |
| Lock-out and its release | ✅ | AC-3 row, to the millisecond at both the account and the address level |
| 12-hour expiry | ✅ | AC-5 row: refused at exactly 12 h, a future sign-in time refused, cookie lifetime 12 h |
| Sign-out on every device, and a stale cookie | ✅ | AC-4 row: two devices at the handler, a copied cookie in a second browser |
| A busy database (503) | ✅ | **A real busy database, not a stub:** another session holds `LOCK TABLE login_throttles IN ACCESS EXCLUSIVE MODE`, and the client has a 700 ms statement limit. Sign-in answers `unavailable`, which the route sends as **503**, with no session and no SQLSTATE, lock or table name in the answer. Nothing was counted: five wrong passwords afterwards are still each answered, and the sixth is the one locked. **A fault after the reservation:** five failed user lookups (`DatabaseBusyError`) give five 503s and cost the person nothing. **In the browser:** a 503 answer, and a network failure, show "We could not sign you in.", not the wrong-password text; axe finds 0 violations and the form stays usable |
| Open-redirect guard | ✅ | AC-6 row |
| `/design-system` 404 in the production build | ✅ | `tests/e2e/production-routes.spec.ts` on the local production build at three widths (6 of 6): 404 for a signed-in Lead with no design-system heading, and a signed-out visitor is sent to sign in without the route being named |
| Keyboard, screen reader, axe on `/sign-in` at three widths | ✅ | AC-8 row. There was no human screen-reader session (NVDA or VoiceOver); the accessibility tree was checked instead |

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Retries |
|-------|---------|-------|--------|--------|---------|
| QA acceptance | `npx vitest run tests/acceptance/aqp-38-sign-in.test.ts` (own Postgres, port 55538) | 42 | 42 | 0 | 0 |
| Auth suites with QA acceptance | `npx vitest run tests/integration/auth tests/unit/auth-*.test.ts tests/unit/bootstrap-admin-service.test.ts tests/unit/prisma-singleton.test.ts tests/unit/production-routes.test.ts tests/acceptance/aqp-38-sign-in.test.ts` | 312 (17 files) | 312 | 0 | 0 |
| E2E, production build, three widths | `npx playwright test tests/e2e/sign-in.spec.ts tests/e2e/production-routes.spec.ts tests/e2e/aqp-38-qa.spec.ts --retries=0` | 94 (set-up 1, `sign-in` 57, `production-routes` 6, QA 30) | 94 | 0 | 0 |
| Lint, type-check | `npx eslint .`; `npx tsc --noEmit` | | exit 0, exit 0 | | |
| Full regression | CI run 41845931376 on `ea8dc6b` (stages 1 to 12) | 2,039 + 125 E2E | all | 0 | |

The PC was shared, so the full unit and integration suite was not run locally; CI is the reference, as briefed.

## Mutation checks

Each fault was made in `src`, the QA acceptance file was run, and the file was restored with `git checkout -- src`.

| # | Fault | QA tests failing |
|---|-------|------------------|
| M1 | Account limit 5 → 6 | 6 |
| M2 | E-mail not trimmed before it is keyed | 1 (the spellings test) |
| M3 | First `X-Forwarded-For` entry trusted instead of the last | 1 (the forged-header test) |
| M4 | Block end made exclusive (`<` for `<=`) | 1 (the 15-minute boundary) |
| M5 | No dummy hash for an unknown e-mail | 2 (verify count; status) |
| M6 | The backslash check removed from `safeReturnPath` | 0. **Explained, not a gap:** the WHATWG URL parser reads `\` as `/`, so the origin check behind it still sends `/\evil` home. The explicit check is a redundant first guard |
| M7 | Session limit made inclusive (`<=` 12 h) | 1 (the 12-hour boundary) |
| M8 | No give-back of reservations after a fault | 1, after QA added the "fault after reservation" test (the first busy-database test failed before any reservation) |
| M9 | `session_version` not checked per request | 1 (sign-out on every device) |

## CI and a secret-scan finding QA introduced

QA's first commit for this report, `67daf05` on PR #58's branch `feat/AQP-38-sign-in-sign-out`, set `const SECRET = '...'` in `tests/acceptance/aqp-38-sign-in.test.ts:30` to an invented key. Its trailing digits raised its entropy, and Gitleaks' `generic-api-key` rule flagged it. CI run 41851301661 failed at stage 2. The value was a made-up test key, never a credential.

**What was done (option C, the coordinator's decision: no force-push, no baseline entry).** A new branch, `feat/AQP-38-sign-in`, starts from the developer's `ea8dc6b`. QA's three files, with the reworded key, are added in **one** commit, and a new PR supersedes PR #58. A local Gitleaks 8.30.1 scan, run with `--redact` and the seven-entry baseline over that branch's full history (`--log-opts=feat/AQP-38-sign-in`), finds **0** new findings.

**What this does not fix by itself.** CI checks out with `fetch-depth: 0`, which fetches every branch, and `gitleaks git` reads every ref (README, "Secret scan and its baseline"). QA reproduced this: a scan from a checkout at `a13f194`, whose history does not contain `67daf05`, still reports it, because `origin/feat/AQP-38-sign-in-sign-out` holds it. While PR #58's branch exists on origin, stage 2 fails on the new PR, and on every other PR's next run. **The decision needed:** delete `feat/AQP-38-sign-in-sign-out` from origin (closing PR #58), which the README names as the way out ("until it is deleted or accepted"). The coordinator asked that PR #58's branch be kept for now, so QA has not deleted it.


## Defects

None found. Open: Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0 (for this story).

## Observations (not defects)

| ID | Observation | Suggested home |
|----|-------------|----------------|
| OBS-1 | The text fields use the 14 px body size (`--fs-body: 14px`). iOS WebKit (Safari and Chrome on iPhone) zooms the page in when a field under 16 px gets focus, so on the delivery lead's iPhone the sign-in page may zoom when the e-mail field is tapped. This is not an AQP-38 AC, and the 14 px value is a UX decision. To be confirmed on the phone (checklist item 2 in the hand-off); if confirmed, it goes to the ux-expert as a product defect for all forms | ux-expert, after the phone check |
| OBS-2 | The show/hide toggle changes both `aria-pressed` and its name ("Show password" / "Hide password"), as AC-8 requires. ARIA practice for a toggle keeps the name fixed and lets `aria-pressed` carry the state, so a screen reader announces "Hide password, toggle button, pressed", a double signal. This follows the AC as written | ux-expert, for the UX spec (no change in this story) |
| OBS-3 | The developer's keyboard E2E test focuses `main` with a script after the skip link. QA's spec now covers a keyboard-only run with no scripted focus, and the skip link used with Enter | None (covered) |
| OBS-4 | The QA E2E spec creates its own invented people (`qa38.stale.<size>@example.test`) in the E2E database, so its sign-outs never touch the developer's E2E people | None |

## Residual Risks / Notes

- These tests were written after reading the implementation and the developer's tests. The independence is in the oracles: hand-set clocks and boundaries, counted hash checks, a real database lock, and real browser contexts.
- Not tested here: TLS on a staging host (the cookie flags are checked in production mode over http, as the test strategy allows), the reverse proxy's `X-Forwarded-For` (#59), and the argon2id cost on the production host (#59).
- Throttle semantics as built (QLT-37, QLT-38, STD-12, master's note) are for the solution-architect to state in architecture section 6 before G8.
- **Optional device check:** the delivery lead's iPhone and password manager (checklist in the hand-off). No AC needs it; it would confirm OBS-1.
- The qa38 database stays up only for that device check, and is removed afterwards.

## Artefacts

Committed in one commit on `feat/AQP-38-sign-in`: `docs/07-qa/AQP-38-test-report.md`, `tests/acceptance/aqp-38-sign-in.test.ts`, `tests/e2e/aqp-38-qa.spec.ts`.

## Hand-off
- Status: COMPLETE for the verification. CI stage 2 stays red until PR #58's branch leaves origin. The optional device check is outstanding and does not hold G7
- Recommendation (G7): ACCEPT (Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0)
- Jira / GitHub: summary on AQP-38, PR #58 and the new PR; no Bug created
- Story status: not changed by QA
