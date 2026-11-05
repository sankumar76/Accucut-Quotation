# Review Report — AQP-48 (STORY-01.02: role enforcement and navigation per role) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards (security included) |
| Review round | 1 |
| Base…branch | `master (2c941c1)...feat/AQP-48-role-enforcement-nav` (PR #79); head 5208f6e = b72ab88 plus the docs-only master merge #78 |
| Commit reviewed | 5208f6eeac30c1be6798fd1452a00d479ef8f751 (code diff against master) |
| Date | 2026-11-05 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
Role enforcement is built on one route manifest that feeds:
- `withRoute` (API) and `authorizePage` (pages);
- the menu and `GET /api/v1/me`;
- the role-matrix, completeness and CSRF tests.

The role is checked before any lookup, with a fixed 403 body. State-changing requests pass an origin check before the session. Output schemas are strict, and problem bodies carry nothing technical. The security design conforms.

There is one Minor finding: `withRoute` logs the full error object, so message text, the stack and the cause chain (possibly PII from a driver message) reach the log, against the name-and-code-only policy set on PR #58.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Code diff | `git fetch origin pull/79/head` (no checkout, no merge), then `git diff 2c941c1 5208f6e` | 46 files; all `src/server/http/*`, the proxy, the session, `/api/v1/me`, the system pages and `next.config.ts` read in full |
| Commits | `git log 2c941c1..5208f6e` | 8 Conventional Commits with `[AQP-48]` and one default merge commit (#78, docs only) |
| Hygiene | Reading the added lines | No `console.*`, TODO, `eslint-disable`, `any`, type assertion or secret; test data invented |
| Dependencies | `package.json` / lockfile | Not in the diff |
| CI | per the PR, run 42013778084 on b72ab88 | Green, stages 1 to 12 |
| Local lint / type-check | not run | The main folder holds another branch; CI covers them |

## Security checklist
| Area | Result |
|------|--------|
| Role enforcement | One manifest; role checked before input parsing or lookup (CR-33); fixed 403; pages call `authorizePage` (closes STD-09 of PR #58); the completeness test fails an unguarded route |
| CSRF | `Sec-Fetch-Site: same-origin` or exact `APP_ORIGIN`, else 403; checked before the session; tested over every state-changing row plus a control; SameSite=Lax and no Server Actions as further layers |
| Output | `z.strictObject` answers; `/api/v1/me` copies fields one by one (no id, no `mustChangePassword`, no cost, rate or formula field) |
| Errors | `problem+json`; 5xx bodies carry generic words; no stack, cause or query; server-generated request ID; `no-store` on every answer |
| Signed-out API | 401 from `withRoute`, not a redirect; `/api/auth` stays excluded from the proxy |
| Return address | `x-return-path` overwritten by the proxy and read only through `signInPathFor` (open-redirect guard) |
| Logging | Full error objects logged for 5xx and unexpected errors (STD-01) |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `src/server/http/with-route.ts:153-162` (log calls at :155 and :161) | §4 (no secrets or PII in logs); the PR #58 STD-19 policy | `err: error` serializes message, stack and cause; key-based redaction cannot scrub message text (a Prisma message can print query arguments such as an e-mail) | PII can reach the log, for every API route | Log `name`, `code` (`isAppError(error) ? error.code : undefined`, no cast) and the stack frames without the message line; add a test that an e-mail in an error message never reaches the log |
| STD-02 | Info | `src/server/http/origin-check.ts:15-18` | §5 | CSRF check reviewed: deny by default, unforgeable from a page, before the session, tested | — | — (note: `loadOriginEnv()` per request; start-up already refuses a missing origin) |
| STD-03 | Info | `src/proxy.ts:56-66` | §5 | Proxy change reviewed: the header is overwritten and read only through the redirect guard; API routes must use `withRoute` (enforced by test) | — | — |
| STD-04 | Info | `next.config.ts:40` | §8 ADR | `experimental.authInterrupts` underpins page authorisation | Behaviour may change on a Next.js upgrade | Architect records it (ADR note, fallback, upgrade check via the role matrix) |
| STD-05 | Info | `src/server/views/me-view.ts:24-32` | §5, NFR-002 | Good practice: projection, strict schema, role-first, one manifest | — | Keep the `errors.ts` "safe to show" contract for every 4xx `AppError` |
| STD-06 | Info | `tests/support/session-harness.ts:63` | §6, test strategy principle 3 | `signedAt: Date.now() / 1_000` reads the real clock and is fractional | Not deterministic; differs from the integer token | A fixed instant and `Math.floor` |

## Notes
- **Merge:** squash-merge, so the default merge commit (#78) does not reach `master`'s history.
- **Open decisions for other roles:** the architect to record `authInterrupts` (STD-04); the ux-expert to confirm the neutral "Go to your tasks" label (raised in the PR).

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-48/standards.md` (main folder, uncommitted)
- Jira / GitHub updates: PR #79 COMMENT review (6 inline comments plus the summary); label `review:standards-approved` added (other labels kept); hand-off comment on Jira AQP-48
- Open questions: none (`authInterrupts` ADR is for the architect)
- Risks raised: none new
- Recommended next agent: master, for the G6 decision; the developer can fix STD-01 with a small change and a log test

---

## Round 2 (narrow re-review: 5208f6e..561f48e, head 561f48eba8d80fbef474e747db86fb7001bca811)

| Field | Value |
|-------|-------|
| Scope | Master's G6 CONDITIONAL GO (DL-093): verify STD-01 and STD-06; check the new diff for new standards or security issues |
| CI | run 42019269128, green |
| Method | `git fetch origin pull/79/head`, then `git diff 5208f6e 561f48e` (no checkout, no merge) |
| **Verdict** | APPROVE (both items fixed; no new finding) |

### Previous findings
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| STD-01 | Minor | Fixed | `describeFailure()` in `src/server/http/with-route.ts` logs `errorName`, `errorCode` (`isAppError(error) ? error.code : undefined`, no cast) and, for a response-schema failure, field paths only. Both error log calls use it; there is no message, stack or cause. Tests in `tests/unit/http-with-route.test.ts` put an invented e-mail in the message and the cause (unexpected error, `ConfigurationError`, schema failure, refusal), walk everything logged and assert the address never appears and no `Error` instance is logged. Thread resolved |
| STD-06 | Info | Fixed | `tests/support/session-harness.ts`: fixed `SESSION_NOW` with `Math.floor(SESSION_NOW.getTime() / MILLISECONDS_PER_SECOND)`; `holdSessionClock()` fakes only `Date` at the same instant. Thread resolved |
| STD-02, STD-03, STD-05 | Info | Unchanged | No action was requested |
| STD-04 | Info | Open (architect) | ADR note for `experimental.authInterrupts`; `tests/unit/next-config.test.ts` now pins the flag (also QLT-62) |

### New code in round 2: no finding
| Area | Result |
|------|--------|
| `src/server/auth/viewer-role.ts` | Role read only to word the system-page button, never for access; no input, so the card does not depend on the address (UX-22). A failure gives the neutral label and a name-and-code warning (STD-01 rule), tested. `unstable_rethrow` is an unstable Next API on a pinned version: keep it in mind with STD-04 on upgrades |
| `src/components/features/system-pages/home-action.tsx` | `server-only`, so `Button` and `next/link` stay out of the client error boundary; `homeActionLabel` has an exhaustive switch with `assertNever` |
| `src/app/error.tsx`, `retry-button-classes.ts` | A deliberate copy of the secondary button classes for NFR-009, guarded by `tests/unit/system-pages.test.ts` (each class must belong to the shared secondary variant); acceptable under §1 |
| Hygiene | No `console.*`, TODO, `eslint-disable`, `any`, assertion or secret in the added lines; one Conventional Commit with `[AQP-48]` |

### Counts (round 2, new code)
| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 0 |

### Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-48/standards.md` (round 2 appended; main folder, uncommitted)
- Jira / GitHub updates: PR #79 COMMENT re-review; STD-01 and STD-06 threads replied to and resolved; label `review:standards-approved` kept; short comment on Jira AQP-48
- Open questions: none
- Risks raised: none new
- Recommended next agent: master, to close the CONDITIONAL GO (DL-093) for the standards items
