# Review Report — AQP-89 (STORY-01.06: 12-hour session) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...feat/AQP-89-twelve-hour-session` (PR #253; PR base b3403e3, master now 8ae01ef) |
| Commit reviewed | c4055f7461f0fa4d5ce116fede6c4264556b1afc |
| Date | 2026-11-11 |
| **Verdict** | **REQUEST CHANGES** (one Major, a missing decision record; no code change is required if the delivery lead approves the 7 days) |

## Summary
The change is small in shape and well kept to the layering rules. The 12-hour rule lives in one constant and one check, the new browser-and-server shared module is a clean leaf, the server-only link keeps `Button` out of the client boundary, no token or secret is logged, and the return address still goes through the existing same-origin allow-list. One thing blocks: the cookie now outlives the token by 7 days (`SESSION_ENDED_NOTICE_DAYS`), which the Accepted ADR-009 and architecture section 8 contradict ("a cookie that lasts 12 hours from sign-in"), and no ruling or amendment exists yet (STD-01). The other findings are Minor or Info. The developer's four open decisions are assessed below.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 7 |
| Info | 6 |

## Checks Run
Local disk was nearly full (about 4.4 GB free), so `npm ci` was not run and no tool was run locally. The tooling gates were taken from CI and checked against the diff.

| Check | Command / source | Result |
|-------|------------------|--------|
| Lint, format | CI run 43039133074, `Stages 1 to 11b` and `Stages 1 to 11` (stage 4, `eslint .`; ESLint is the formatter, no separate format check) | green on c4055f7 |
| Type-check | same run, stage 5 (`tsc --noEmit`) | green |
| Build | same run, stage 9 (`next build`) | green |
| Tests | same run: 5 of 5 checks green, including E2E shards 1 to 3 (per the Dev Record: unit 3,005, full 5,337, E2E 787) | green; counts not re-derived by me |
| Secrets (manual) | read the full `src` diff and a `grep` over the `tests` diff for secret, password, key, token and e-mail patterns | only invented values: `E2E_AUTH_SECRET` (the existing invented string, moved into one constant) and an invented key in `session-expiry.test.ts`; nothing real |
| gitleaks / Semgrep | not re-run (needs Docker and disk); the Dev Record states `gitleaks dir` over 32 paths: clean | not verified by me |
| Plant control | PR #254, run 43039914936 red at stage 6 (33 tests), as stated in the brief | not re-run; consistent with the Dev Record |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Major | `src/server/auth/session-token.ts:26` (also `options.ts:90`) | Coding Standards §8 (ADR for significant decisions), §5; ADR-009 line 42; architecture §8 line 997, A-23 | The cookie lives `SESSION_ENDED_NOTICE_DAYS = 7` days longer than the token. ADR-009 (Accepted) and section 8 say the cookie "lasts 12 hours from sign-in". No ADR amendment, decision-log entry or delivery-lead ruling records the change. | The Accepted design and the code disagree on a security-relevant property (cookie lifetime). The code is sound: the token is refused at 12 h whatever the cookie says, and the constant is named and explained. | The delivery lead rules on the 7 days. If kept: solution-architect adds ADR-009 amendment 2 and updates section 8 and A-23 in a docs PR that merges first (CLAUDE.md section 8). If not: delete the constant (one line); SCR-26 then shows only for a token that is still readable. |
| STD-02 | Minor | `src/server/http/problem.ts:57`; `src/components/features/system-pages/system-page.tsx:29` | Coding Standards §2, §1 | `SESSION_ENDED_TITLE` is exported from two modules with two different words ('Your session ended. Sign in again.' and 'Your session ended'). | An import picks the wrong one; the two drift apart. | Rename the problem one `SESSION_ENDED_PROBLEM_TITLE`. |
| STD-03 | Minor | `src/lib/auth/session-ended.ts:43`; `src/lib/audit/audit-client.ts:71` | Coding Standards §1 (no magic numbers) | Literal `401` in two places in `src/lib`. The names `UNAUTHORIZED_STATUS` (`with-route.ts:88`) and `STATUS_UNAUTHORIZED` (`problem.ts:71`) exist but are private to `src/server`, which `lib` cannot import. | Third and fourth copy of one status. | `export const HTTP_UNAUTHORIZED = 401;` in `session-ended.ts`; use it in both places. |
| STD-04 | Minor | `src/server/auth/resolve-session-user.ts:66` | Coding Standards §10 / checklist 11 (dead code) | `resolveSessionUser` has no production caller now (`session.ts` calls `resolveSession`); five test files still import it. | A second public entry point beside "the one check" invites use of the lossy `null` form. | Doc line "kept for tests that need only the user; production uses `resolveSession`", or move the tests to `resolveSession` and delete it in a follow-up. |
| STD-05 | Minor | `src/server/auth/options.ts:90` | Coding Standards §4 (log levels) | Because the dead-token cookie is kept 7 days, next-auth logs `JWT_SESSION_ERROR` at error level on each request carrying it (the Dev Record's #255). No token or secret is in this PR's logging. | Error-level lines that nobody can act on will bury real errors. | next-auth's `logger` option can map that code to `debug`/`warn`; or keep #255 as the fix and have master label it `tech-debt` with an owner before G7. Not blocking by itself. |
| STD-06 | Minor | `src/server/auth/session.ts:37`; `src/lib/auth/session-ended.ts:38` | Coding Standards §5, §8 | The `x-session-cookie` header is called "the proxy's word", but the proxy matcher excludes `/sign-in`, `/api/auth/*` and static paths, where the browser's own header passes through. Harmless today (the only caller there is `getCurrentUser()`, where "ended" and "signed-out" both give `null`). | A future public page that calls `requireUserOrRedirect` would take a forged header and show SCR-26 (wording only, no access). | Add one sentence to both comments naming the matcher as the condition for trusting the header. |
| STD-07 | Minor | `src/server/auth/options.ts:98` | Coding Standards §8 (comments say why), §1 (fail fast) | The `: SESSION_MAX_AGE_SECONDS` fallback in `encode` gives a token that fails the schema a fresh 12 hours, with no comment. It is safe (such a token has no `signedAt`, so `resolveSession` returns `unreadable`), but the reason is not written. | A later reader sees "renew on the unhappy path". | One line: "A token without the three claims is never honoured (`resolveSession`: unreadable), so the default lifetime grants nothing." |
| STD-14 | Minor | `tests/unit/auth-session.test.ts:270` (also `auth-session.test.ts:30`, `tests/unit/http-problem.test.ts:67`, `tests/unit/system-pages.test.ts:29`) | Coding Standards §10 (no `as` casts to silence the compiler; validate external data) | Four new `as` casts in tests: `mocks.users.current as FakeUserRepository`, `(await response.json()) as object`, and two `null as string \| null` initialisers (one has a precedent on master). | A cast hides a wrong shape until it fails at run time with a poor message. | Narrow with `instanceof` and throw; parse the body with zod (`z.record(z.string(), z.unknown())`); give the hoisted mocks a typed interface instead of a cast. |
| STD-08 | Info | ADR-009 amendment 1 (line 111); architecture line 26; `session.ts` (`refused` path) | ADR-009; Coding Standards §8 | The second SCR-26 wording (sign-out elsewhere, password change) was due "before AQP-89 reaches G5" (ux-expert). It does not exist in ux-spec v0.22. The developer correctly did not invent it; those people get the plain sign-in redirect as before. | The ADR's own condition is unmet and G5 has passed; no regression in behaviour. | Not a code defect. Master to record the waiver or the date in the gate log; confirm #256 names the ux-expert as owner with a needed-by date. |
| STD-09 | Info | `system-page.tsx:29-31`; `src/app/unauthorized.tsx`; `sign-in/page.tsx` | AC-3, AC-6; ux-spec lines 513 and 1052 | "Sign in again" (AC) against "Sign in" (spec), and `role="alert"` on the SCR-01 notice (AC) against `status` (mock-up). The AC wording wins, as the Dev Record says; the words of the title, text and notice match ux-spec lines 513 and 1052 exactly. `Notice` already took a `role` override, so no new component was needed (good reuse). | None. | Accepted. #256 should carry both to the ux-expert so ux-spec v0.23 and `SCR-26.html` / `SCR-01.html` agree with the build. |
| STD-10 | Info | Jira AQP-89 Dev Context; architecture lines 286, 997 and A-23 (line 1730); ADR-009 line 42 | Coding Standards §8 (documentation) | Stale statements: `requireUser()` is "the one place" (it is `resolveSession`), `SESSION_LIFETIME_HOURS` (it is `SESSION_HOURS`), `system-pages/session-ended.tsx` (does not exist), "one check in `session.ts`" (it is in `resolve-session-user.ts`). The developer listed them and left design documents to their owners. | The architecture text will mislead the next change to sessions. | Confirm #256 lists each of these places, including the Session helper row (line 286) and A-23, not only section 8 and ADR-009. |
| STD-11 | Info | `src/lib/auth/session-ended.ts:127-132` | Architecture section 10 (`lib` is "pure code: no I/O") | `goToSessionEndedSignIn` touches `window.location` inside `src/lib`. The ESLint rule bans only imports from `next/*`, `server` and Prisma, and `lib` already holds browser clients (`api-client.ts`, `audit-client.ts`, `users-client.ts`). No violation. | None. | When the architecture is next revised, describe the `lib` browser clients so the "pure" label is accurate. |
| STD-12 | Info | `tests/e2e/session-ended.spec.ts`; `tests/unit/*`; `tests/integration/auth/session-expiry.test.ts` | Coding Standards §6 | Titles carry AC IDs in the `describe` and follow the project's sentence style, not `should_…` (consistent with the existing suite). Data is invented; clock is controlled; no sleeps. The E2E tests 1 and 3 hold several checks each, against "one behaviour per test", on purpose: RISK-023 prices every E2E instance, and the spec header says so. `auth-session-ended.test.ts` first `describe` (line 20) has no AC ID. | None. | Accepted. Optionally add the AC ID to that `describe`. |
| STD-13 | Info | PR #253 | Coding Standards §9; CLAUDE.md §7.3 | Branch `feat/AQP-89-twelve-hour-session`, three Conventional Commits each with `[AQP-89]`, PR title `AQP-89: STORY-01.06: 12-hour session`, 32 files all in scope, nothing generated or secret. The branch is 2 commits behind master (c6b9074 docs, 8ae01ef #235 masters screens; neither touches auth), and the remote branch `control/AQP-89-plants` was left behind. | Housekeeping only. | Orchestrator: update-branch before merge (CI must re-run on the result) and delete `control/AQP-89-plants`. |

<details><summary>Detailed notes and the four decisions to check</summary>

### Decision 1: `SESSION_ENDED_NOTICE_DAYS` (STD-01)
A browser deletes an expired cookie, and a request with no cookie cannot be told from a stranger's, so without a longer cookie SCR-26 could show only in the last second of the session. The mechanism is correct and conservative: `hasSessionEnded` and `isWithinSession` refuse the token at 12 hours independent of the cookie, and `jwt.encode` caps the token's own expiry at sign-in plus 12 hours. Cookie flags (HttpOnly, Secure, SameSite=Lax, the `__Secure-` prefix) are untouched; only `maxAge` changes. The finding is only that the decision is unrecorded while the Accepted ADR says otherwise. It is the delivery lead's call (per the brief). Standards position: either outcome is fine once it is written down.

### Decision 2: the second wording (STD-08)
Right call not to invent copy. Behaviour for a deactivated user, a role change and a `session_version` mismatch is unchanged and tested (AC-5). The `refused` state is kept distinct from `ended` precisely so the wrong words are never shown.

### Decisions 3 and 4 (STD-09, STD-10)
Where the AC and the UX spec differ, the AC is the contract. The developer recorded each difference. The stale Dev Context is correctly handled by describing it in the PR, not by editing the story.

### Layering, error handling, logging, security hygiene (no finding)
- `app/unauthorized.tsx` is thin: it reads the proxy's return-address header and renders. No business logic in `app` or `components`.
- `lib/auth/session-ended.ts` imports only `./return-path`; `server/http/problem.ts` and `server/auth/*` import from `lib`, never the other way. Direction is inward.
- `SignInAgainAction` is `server-only`, keeping `Button` and `next/link` out of the client error boundary (PRF-01), the same pattern as `home-action.tsx`.
- `UnauthorizedError('Your session ended.', { code })` carries a fixed message; `problemFromAppError` replaces it with fixed words, so no detail leaks. The 401 stays at `debug` in `with-route.ts:184`.
- The open-redirect rule is reused (`safeReturnPath`, `signInPathFor`), the `reason` query value is matched against one exact string, and no new dependency was added (`next-auth/jwt` is part of the pinned next-auth).
- Function and file sizes: all new functions are under 40 lines; `session.ts` is 97 lines; the largest test file is 362 lines (limit 400). Line widths follow the existing code (up to about 150 characters in untouched files); no formatter rule exists.
- No `any`, no non-null assertions, no `console`, no TODO, no commented-out code in the diff. `src` has no `as` casts; the four in tests are STD-14.
</details>

## Previous Findings (re-review only)
Not applicable (round 1).
