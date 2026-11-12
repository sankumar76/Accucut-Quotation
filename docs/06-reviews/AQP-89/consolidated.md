# Consolidated review: AQP-89 (STORY-01.06 12-hour session), PR #253 (head c4055f7)

Orchestrator, 2026-11-11. Three reviews, per the story's Dev Context. G5 passed on CI 43039133074 (unit 3,005, full Vitest 5,337, E2E 787). The head is behind `master` (2891457 and cdb5dec not taken; neither touches auth).

**Delivery lead's ruling (2026-11-11, in chat, recorded as a decision-log entry and on AQP-89):** **KEEP** the 7-day cookie (`SESSION_ENDED_NOTICE_DAYS = 7`, `src/server/auth/session-token.ts:26`). STD-01 and QLT-01 are therefore resolved by documentation, not by a code change: the solution-architect adds ADR-009 amendment 2 and updates architecture §8 (and the stale lines STD-10 lists, A-23) in a docs PR that merges before #253 is squashed.

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info | Review |
|---|---|---|---|---|---|---|---|
| standards | REQUEST CHANGES | 0 | 0 | 1 | 7 | 6 | `standards.md`, Jira 11517 |
| quality | REQUEST CHANGES | 0 | 0 | 1 | 2 | 7 | `quality.md`, Jira 11522 |
| performance | APPROVE WITH COMMENTS | 0 | 0 | 1 | 0 | 1 | `performance.md`, Jira 11518 |

## Findings, by severity

| ID | Severity | Finding | Raised by | Proposed route |
|----|----------|---------|-----------|----------------|
| STD-01 = QLT-01 | Major | The cookie lives 12 h + 7 days (`session-token.ts:26`, `options.ts:90`); ADR-009 (Accepted) and architecture §8 / A-23 say 12 h. No recorded decision. The token is still refused at 12 h whatever the cookie says; no replay or disclosure risk found by either reviewer | standards, quality (duplicate) | **Resolved by documentation** (delivery lead KEEP): solution-architect, ADR-009 amendment 2 + §8 + A-23, docs PR merged before the squash. No code change |
| SEC-01 | Major | **Added 2026-11-11 after G6 (DL-160), from the automated commit security review, confirmed by the main session and the orchestrator.** The DL-160 fix round's commit 9b1df51 sets `logger: buildNextAuthLogger()` in `src/server/auth/options.ts:143` (the #255 quieting). In next-auth 4.24.15, a set `authOptions.logger` switches on the unauthenticated `POST /api/auth/_log` (`node_modules/next-auth/core/index.js:285-297`), which passes `{code, level, ...metadata}` from the body straight to the logger. Anyone, without signing in, can write error, warn or debug lines (forged `JWT_SESSION_ERROR` or "next-auth reported an error.") and flood the log; `loggable()` limits characters, not forgery or volume. New attack surface: on `master` `logger` is unset, so `_log` is inert | security review (via the delivery lead's session) | Developer, same fix push: the `[...nextauth]` route handler answers 404 for the `_log` action before NextAuth, plus a test that `POST /api/auth/_log` returns 404 and writes nothing to the log (or keep the quieting without setting `authOptions.logger`); one control plant. reviewer-standards and reviewer-quality check it in the condition-R re-review. Must be closed before G7 |
| PRF-01 | Major | First-load JS +4,551 to +5,006 B gzip on seven of eight routes, -4,052 B on `/sign-in`; the step is in the shared shell (routes that import none of the changed clients rose by the same amount). Not attributed. Budget not breached; `/masters/materials` headroom 12,434 B → 7,481 B | performance | Developer: attribute it (chunk diff of the head against `master` in a local `next build`), fix if one small module drags a chunk, otherwise record the new baseline in the Dev Record. Before G7 |
| QLT-02 | Minor | No test gives `session.ts` a session with `userId` and `sessionVersion` but no `signedAt`; plant P2 (`signedAt ?? now`, #261) survived | quality | Developer: the `it` case in `auth-session.test.ts` (plus optional `session`-callback case) |
| QLT-03 | Minor | No test runs the AC-4 chain end to end (proxy header → `readSessionState` → `requireUser` → `withRoute` → 401 → client navigation); E2E test 2 opens the notice URL directly | quality | Developer: API-level E2E with an expired token (reviewer's snippet) |
| STD-02 | Minor | `SESSION_ENDED_TITLE` exported from two modules with two different strings | standards | Developer: rename the problem one `SESSION_ENDED_PROBLEM_TITLE` |
| STD-03 | Minor | Literal `401` twice in `src/lib` | standards | Developer: one exported `HTTP_UNAUTHORIZED` |
| STD-04 | Minor | `resolveSessionUser` has no production caller | standards | Developer: doc line, or move tests to `resolveSession` |
| STD-05 | Minor | `JWT_SESSION_ERROR` logged at error level for each request carrying a dead cookie (the 7-day KEEP makes this live for 7 days) | standards (also PRF-02, QLT-08 Info) | Developer: map the code to `warn`/`debug` via next-auth `logger`, or master assigns #255 an owner and due point before G7 |
| STD-06 | Minor | `x-session-cookie` comment does not name the proxy matcher as the trust condition | standards | Developer: one sentence in both comments |
| STD-07 | Minor | Unexplained `: SESSION_MAX_AGE_SECONDS` fallback in `encode` | standards | Developer: one comment line |
| STD-14 | Minor | Four new `as` casts in tests | standards | Developer: narrow / parse instead |
| STD-08 | Info | ADR-009 amendment 1's second SCR-26 wording (sign-out elsewhere, reset) does not exist; due "before G5" | standards (also QLT-07) | Master: waiver or date; #256 to the ux-expert with a needed-by |
| STD-09, STD-11, STD-12, STD-13 | Info | AC wording wins over the spec ("Sign in again", `role="alert"`); `lib` holds browser clients; one `describe` lacks an AC ID; branch behind `master` and control branches left | standards | #256 (ux-expert); architect at next revision; optional; orchestrator update by merge commit before the squash |
| STD-10 | Info | Stale architecture / ADR / Dev Context lines (`requireUser()` "the one place", `SESSION_LIFETIME_HOURS`, `session-ended.tsx`) | standards | Solution-architect, in the same docs PR as amendment 2 |
| QLT-04 to QLT-09 | Info | Unreadable cookie reads as "ended" after a secret rotation; two load-bearing predicates; zero clock-skew tolerance; no second wording; log noise for 7.5 days; `role="alert"` at first render may not be announced | quality | Runbook note (QLT-04); QA checks a real screen reader at G7 (QLT-09); others noted |
| PRF-02 | Info | Dead cookie decrypted on every request for up to 7 days; about 0.2 to 0.5 ms CPU and one log line | performance | None for performance; see STD-05 |
| QLT-10 | Info (praise) | `jwt.encode` override closes next-auth's renewal path; explicit `SessionResolution` states | quality | n/a |

## Plant evidence

- reviewer-quality: P1 (boundary, red), P2 (no `signedAt`, **green**: QLT-02), P3 (SCR-26 return, red). Control branches `control/AQP-89-qlt-p1-boundary`, `-p2-no-signedat`, `-p3-scr26-return` and the developer's `control/AQP-89-plants` remain on the remote (delete refused for agents; the delivery lead deletes them).

## Questions for master

- With KEEP recorded, may G6 be a CONDITIONAL GO with the conditions: (A) architect docs PR (ADR-009 amendment 2, §8, A-23, STD-10 lines) merged before the squash; (B) one developer push with STD-02 to STD-07, STD-14, QLT-02 and QLT-03, and the PRF-01 attribution in the Dev Record; and which re-review route (narrow, standards + quality on the new diff only; performance only if the attribution leads to a code change)?
- STD-05 / #255: fix in this round, or tech-debt with an owner and due point?
- STD-08: waiver for amendment 1's second wording, or a date for the ux-expert (#256)?
- G7 route: qa-engineer, with QLT-09 (screen reader) and, if QLT-03 is not automated, the AC-4 chain by hand.
