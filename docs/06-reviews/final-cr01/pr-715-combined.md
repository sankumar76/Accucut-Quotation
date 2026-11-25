# Review Report — PR #715 (AQP-428, STORY-01.10 emergency Admin password reset; AQP-427 / DEF-083 forgot-password page) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review, CLAUDE.md §9 item 2: authentication and passwords) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-428-admin-password-command` (PR [#715](https://github.com/sankumar76/Accucut-Quotation/pull/715)), 0 behind `master`, 9 commits ahead |
| Commit reviewed | `30ec8087` |
| Date | 2026-11-25 |
| Reviewed against | Jira AQP-428 (13 ACs, PO validation); architecture v0.71 §8 "Emergency Admin password reset" and §4.7 D-1 amendment (`origin/master`); DL-379 to DL-382 and DL-386 (records-u); UX ruling `docs/03-ux/rulings/forgot-password-email-off-2026-11-24.md`; `docs/standards/coding-standards.md` |
| **Verdict** | **APPROVE WITH COMMENTS**: no Blocker, Critical or Major finding. CI run 45557600259 and Windows package run 45557600222 are green at the head |

## Summary

The command matches the architecture's shape and the binding terms of DL-380 (2), DL-381 and DL-382. The password comes only from the hidden prompt. The TTY check runs first. The rule is checked and the password hashed before the transaction. One transaction locks the Admin rows, checks them again, then sets the password, the flag and the session version, clears the three blocks and writes the audit entry. There is no HTTP route. The forgot-password page tells the truth while e-mail is off, the same for every visitor.

The service reuses `assertPasswordRule`, `users.setPassword`, the audit service and the throttle-key helpers. It adds no dependency, schema change or migration. Tests were written first: commit `37479fcd` adds only the seven failing test files. Every AC except AC-13 (which is the rehearsal) has a named test (see the AC table).

I accept both of the developer's stated deviations: `loadServerCommandEnv` instead of `loadAppEnv`, and the lazy wiring (QLT-715-03 and QLT-715-04). I also accept the reading that deactivated Admin rows beside the one active Admin do not block the reset. Otherwise an Admin hand-over (FR-006) would leave the command refusing for good.

I found two Minors. **QLT-715-01:** the Admin the operator confirms is not passed to the reset, so a change to the Admin rows between the confirmation and the lock would reset a different account. That needs an Admin acting in the web at that same moment, so the chance is very low. **QLT-715-02:** the README's exit-code table points a non-elevated window to exit 1. In fact such a window never reaches the command: PowerShell cannot open `C:\Accucut`, and Node exits 9 when it cannot read `.env`.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 6 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Diff | `gh pr diff 715`; `git diff origin/master...origin/feat/AQP-428-admin-password-command`; full files read at `30ec8087` in worktree `aqp-398` (read-only) | 27 files. Matches the PR file list. Not touched: `route-manifest.ts`, the forgot route, `password-reset-service.ts`, `audit-events.ts`, packaging, install scripts, Pester |
| CI | `gh run view 45557600259` | **success** at `30ec8087`: Stages 1 to 11, 1 to 11b, E2E shards 1 to 4. PR rollup: 7/7 SUCCESS, merge state CLEAN |
| Windows package | `gh run view 45557600222` | **success** at `30ec8087`. The bundle builds with `--conditions=react-server` |
| New and touched unit and security tests at head | `npx vitest run` over the 7 new or changed unit files, the guard test, `password-reset-enumeration.test.ts` and `uptime-monitor-readme.test.ts` (aqp-398, `--testTimeout=60000`) | **10 files, 140 tests passed** |
| Integration (real PostgreSQL) | not run locally (the PC is short of memory, §9 item 5) | Green in CI Stages 1 to 11b. The developer's local run: 41 files, 1,233 passed |
| Test-first evidence | `git show --stat 37479fcd` | The first commit holds only the 7 test files (+1,228). The code follows in `2b16a31d` |
| Node `--env-file` behaviour | scratch probe, Node 24: `node --env-file=does-not-exist.env -e …`; and a file setting `USERDOMAIN` | A missing file gives `node: …: not found` and **exit 9** before any script runs (QLT-715-02). A value in the file **does not override** `USERDOMAIN` already in the environment |
| Other `.env` loaders or logging on the reset path | `grep` for `dotenv`, `loadEnvFile`, `console.*`, `process.title` in `src` and the 4 script files; Prisma client options | none. Prisma is built with no `log` option, so no query or parameter is logged |
| DL-386 count statement | PR body; `createDisposableUser` count in `tests/e2e/password-reset.spec.ts` on `master` and at the head | Statement present: net **−1** person before `users.spec.ts:58` [desktop] in shard 4, and no new call (5 = 5 matches in the file). Accepted under DL-386 (3) |
| Secrets | read the diff and the PR body | none. Test passwords are invented literals (`Short-7!` and the like), and the tests assert that they are never printed |
| Lint, type-check, build, E2E locally | not run locally | CI is the record (Stages 1 to 11b) |

## Findings

| ID | Severity | File:line | Rule / AC | Issue | Why (impact) | Fix |
|----|----------|-----------|-----------|-------|--------------|-----|
| QLT-715-01 | Minor | `src/server/services/user-service.ts:274-285`; `scripts/lib/admin-password-reset-cli.ts:133` | AC-2, AC-3 (the operator confirms *this* Admin); architecture §8 step 5 | **The reset is not bound to the Admin the operator confirmed.** `findAdminForServerReset` shows Admin X, and the operator types `RESET` and the password twice, which can take minutes. Then `resetAdminPasswordOnServer` looks at the rows again twice: once unlocked, for the e-mail the rule uses, and once under the lock. It resets whichever single active Admin it finds then. If an Admin changes the Admin rows in that window (for example a hand-over: a new Admin added and X deactivated), the command resets a different account than the one shown and confirmed. In the same way, the FR-098 e-mail-similarity check uses the e-mail from the unlocked read, not the locked row. | Very unlikely: it needs a live Admin session acting on Users at that moment, while the Admin is the one who forgot their password. If it happens, a temporary password is set for a person the operator did not confirm. The Done line prints the locked name, so the operator may notice, but only afterwards. The audit record is still correct. | Pass the confirmed ID through and refuse when the locked Admin differs: `resetAdminPasswordOnServer({ actorLabel, requestId, expectedAdminId: found.id }, first)`. In the transaction: `if (admin.id !== expectedAdminId \|\| admin.email !== firstLook.email) return { status: 'refused', refusal: 'ADMIN_CHANGED' };`. Map that refusal to exit 2 with, for example, "The Admin account changed while this ran. Nothing was changed. Run it again." (new words, so tell the product-owner). **Test that catches it:** in `user-service-server-reset.test.ts`, a fake whose locked listing returns a different active Admin ID than the first look. It must refuse, make no `setPassword` call and write no entry. **When:** in this PR if the developer has the half hour (preferred); otherwise in the hardening window. Minor, so it does not block the merge |
| QLT-715-02 | Minor | `deploy/windows/README.md:659`, `:662` | AC-9 (README accuracy); coding standards (docs match behaviour) | **The exit-code table sends a non-elevated window to exit 1, which that case never produces.** A window that is not elevated cannot open `C:\Accucut` (README "Folders", `:125`). So `Select-Xml` and `cd` fail in PowerShell, and Node cannot read `.env`: `node: …: not found`, **exit 9** (scratch probe), before the command runs. Exit 1 means the file was read but `DATABASE_URL`/`AUTH_SECRET` are missing or invalid, or the database cannot be reached. Row 4 also leaves out "an unknown argument", and row 3 leaves out "empty". | An operator in an emergency who gets a PowerShell or Node error finds no row for it. The row that mentions elevation is tied to a code the case never gives. | Row 1: "The settings were read but are missing or invalid, or PostgreSQL cannot be reached: check `Get-Service postgresql-x64-17`". Add a line below the table: "If PowerShell cannot open `C:\Accucut`, or Node says the `.env` file is not found (exit code 9), the window is not elevated: open it with Run as administrator." Row 3: "(empty, the two entries differ, or the rule)". Row 4: add "an unknown argument". **Test:** extend `admin-password-reset-readme.test.ts` to pin the elevation line. **When:** this PR (docs only, about 10 minutes) |
| SEC-715-01 | Info | `scripts/lib/admin-password-reset-cli.ts:79-82`; `scripts/bootstrap-admin.ts:80` | DL-381 (3)(b); AC-6 | **The domain part of the label comes from `USERDOMAIN`, which the operator can set** (`$env:USERDOMAIN='…'` in the same window). Control characters become spaces, the fixed prefix and the closing bracket stay, and the label is cut to 200, so the text cannot break the entry or the screen. It can only be untrue. `.env` cannot override it: Node's `--env-file` never replaces a variable already in the environment (probe), and Windows always sets `USERDOMAIN`. | None beyond what DL-381 (3)(b) already accepts: the name is "not proof". The operator is a server administrator (RISK-018), and the README's operations-record note is the control | None needed. If wanted later: take the domain from the process token (`whoami`), not the environment |
| SEC-715-02 | Info | `scripts/lib/admin-password-reset-cli.ts:65-67` | coding standards (output encoding) | `printable` replaces only `\p{Cc}`. A user name may hold format characters (bidirectional overrides such as U+202E, zero-width characters): `nameProblem` in `src/lib/users/validation.ts` checks only length. Such a name could make the operator's confirmation line look different from what is stored. | Negligible: only an Admin sets names, and the target is the Admin. | Use the project's own set, as in `src/lib/estimate/validation.ts:45`: `/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/gu`. One line, plus one case in the label unit test |
| QLT-715-03 | Info | `src/lib/env.ts:144-147`; `scripts/lib/admin-password-reset-wiring.ts:19` | architecture §8 step 1 says `loadAppEnv` | **Deviation accepted.** `loadServerCommandEnv` reads only `DATABASE_URL` and `AUTH_SECRET`, with the same `postgresUrl` and `secret(AUTH_SECRET_MIN_LENGTH)` rules as the app. So the key is checked the same way, and an unrelated mail or origin setting cannot stop the emergency command. Same file, same role, same `--env-file`. `env.test.ts` covers it. | Better than the architecture: least coupling, no loss of checking | Solution-architect: record the change in §8 step 1 (issue for other roles) |
| QLT-715-04 | Info | `scripts/bootstrap-admin.ts:63-67` | AC-1 (a) install path unchanged | **Lazy wiring accepted.** The static imports added to the install path are the runner and the prompt (no side effects) plus type-only imports. The audit service, which reaches `server-only`, is loaded only in reset mode. The packaged bundle is built with `--conditions=react-server` as before (`package-windows.ps1:126`, unchanged), and the Windows package run is green. The unchanged `bootstrap-admin-script.test.ts` proves the install path still works. | none | none |
| QLT-715-05 | Info | `src/lib/auth/password-reset.ts:62` | DRY | `RESET_LINK_INVALID_TITLE` repeats the first sentence of `RESET_LINK_INVALID_MESSAGE` (`:32`). The API text must not change (AC-12), so the two can drift apart only if someone edits one by hand. | Readability only | Optional: one shared `RESET_LINK_INVALID_SENTENCE` that both are built from, or leave as is. Cross-reference for reviewer-standards |
| QLT-715-06 | Info | `tests/e2e/password-reset.spec.ts:54` | AC-10b (flag on) | With the E2E servers running with e-mail off, the request form (flag on) no longer has a browser or axe test. The unit test covers its render. Follow-up #716 is open. | Known and tracked; the route's integration, enumeration and security tests are unchanged and green | Keep #716 for the hardening window or R2 |

## Security notes (the §9 item 2 focus in the brief)

| Check | Result | Evidence |
|-------|--------|----------|
| Password only from the hidden prompt: never argv, env, file, log, audit, error, process title, crash dump | **Yes** | `bootstrapMode` takes exactly one argument and no value (`cli.ts:34-37`). The password exists only as the return value of `readHiddenLine` (`cli.ts:123-124`), and it is passed once, to the service (`:133-136`). No `console.*`, no `process.title`, no Prisma `log`. Rule messages are the rule's own words (`FieldValidationError` joins the field messages, `errors.ts:47`), with no input text. Any other error prints the generic line (`cli.ts:107-109`). The audit entry carries only `mustChangePassword`. Tests: `admin-password-reset-cli.test.ts` "AC-4" (success and every refusal), `admin-password-reset-command.test.ts:138` and the valid-run case. Crash dump: no `--report-on-*` flag is used, and a Node report holds no heap strings |
| No echo; terminal mode restored on every path | **Yes** | `hidden-prompt.ts`: nothing is written per key in hidden mode. `finish` restores `setRawMode(wasRaw)` and `pause()` in a `try/finally` on answer, cancel, end and error. A console that will not go raw restores the mode and removes the listeners (`:134-144`). 1,024 cap (`:119`). 16 unit cases |
| TTY refusal on stdin and stdout, before settings | **Yes** | `bootstrap-admin.ts:74` and `cli.ts:149-152` run before `open()`. `admin-password-reset-script.test.ts`: the real script with no console exits 4, even with no settings at all (not 1) |
| Exactly one active Admin; checked again under the lock; no reactivation | **Yes**, see QLT-715-01 for the binding | `judgeAdmins` (`user-service.ts:119-125`). `listAdminAccounts(tx)` uses `FOR UPDATE ORDER BY id` (`user-repository.ts:254-267`). `setPassword` does not touch `is_active`. Unit and integration refusal cases, plus "recheck under the lock" |
| FR-098, including e-mail similarity, before any hash | **Yes** | `assertPasswordRule(password, { email, subject: 'other', field: 'password' })` (`:277`) is the same call as the web Admin reset (`:241`). Unit: `admin@example.test` and others are refused with no hash. QLT-715-01 notes the e-mail comes from the unlocked read |
| Hash before the lock | **Yes** | `hasher.hash` (`:279`) runs before `transactions.run` |
| One transaction: `setPassword` (flag, `session_version + 1`), three throttle clears, audit; rollback on any failure | **Yes** | `:280-301`. `clear(keyHash, tx)` uses `clientFor(db, tx)` (`throttle-repository.ts:102-107`). Integration: a failing third clear, a refused audit entry and a late failure each undo everything, including the two keys already cleared |
| Audit `user.password_reset`; `actor_id` = Admin; label prefix; how the Windows account is obtained | **Yes** (SEC-715-01 Info) | `:292-300`. Integration pins `actor_id` and the prefix (`on-server.test.ts:152-155`, `command.test.ts:182-183`). The label is `os.userInfo().username` plus `USERDOMAIN`, with control characters replaced and a 200 cut that never splits a surrogate pair (`cli.ts:70-76`); the audit service refuses more than 200 (`audit-service.ts:153`). Injection: free text only, no control characters (SEC-715-01) |
| No HTTP route; guard real and effective | **Yes** | `tests/security/admin-password-reset-no-web-route.test.ts` scans every source under `src` and `scripts` for both method names (allowed only in the definition and the runner), checks `src/app` for any import of the command, checks `src` for any import from `scripts`, pins the one importer of the runner, and lists the six password routes in the manifest. A new route that called the method would have to name it and would fail. `inApp.length > 0` keeps the scan from passing on an empty set |
| `.env` only through `--env-file` | **Yes** | no `dotenv` or `loadEnvFile` in `src` or `scripts`. The wiring reads `process.env` only |
| Exit codes 0 to 4 | **Yes** (QLT-715-02 for the README) | `cli.ts:22-26`. The unit test pins the table. Node's own exit 9 for an unreadable `.env` is outside the command |
| No secrets in tests or fixtures | **Yes** | invented names, `example.test` addresses, literal test passwords. Secret scan green in CI |
| Forgot page: `force-dynamic`, per-request `loadEmailFeature()`, identical for every visitor, route byte-identical, a11y | **Yes** | `page.tsx:14`, `:23`. No session, no `searchParams`, no fetch. `EmailOffExplanation` has no form and no live region. The route and service are not in the diff. Unit tests "flag flips between renders" and `dynamic`. E2E: `?mail=on` and a signed-in visitor get the same page, the route answers 202, axe passes at three widths, one h1, the 44 px link, no sideways scroll at 320 px (CI shard green) |
| README accuracy | **Mostly** | The architect's text word for word, plus the operations-record note and the "never in chat, Jira or GitHub" sentence (AC-9, DL-381 (3)(b)). The exit-1 row is QLT-715-02 |

## Reviewer-specific tables

### AC conformance (AC → code → test)

| AC | Code | Test(s) | Status |
|----|------|---------|--------|
| AC-1 (a) install path unchanged | `bootstrap-admin.ts:93-99`, `run()` unchanged | `bootstrap-admin-script.test.ts` (unchanged, green); `cli.test.ts` mode table | Met |
| AC-1 (b), (c), (d) | `bootstrapMode`; TTY check `cli.ts:149` | `cli.test.ts` "(c)"; `admin-password-reset-script.test.ts` (real script: no console → 4, before settings; other arguments → 4) | Met |
| AC-1 (e) settings or database → exit 1, no DB text | `cli.ts:154-159`, `failureLine`; `loadServerCommandEnv` | `cli.test.ts` "(e)" ×2; `command.test.ts` "AC-1 (e)" ×2; `env.test.ts` | Met |
| AC-2 one active Admin, recheck under lock | `judgeAdmins`, `listAdminAccounts(tx)` | `user-service-server-reset.test.ts`; `on-server.test.ts` (none, deactivated, lock order); `command.test.ts` "AC-2" | Met (QLT-715-01: binding to the confirmed Admin) |
| AC-3 confirm, prompts, rule, hash first | `converse`, `cli.ts:117-136`; service `:277-279` | `cli.test.ts` "AC-3" (7 non-RESET inputs, Ctrl+C, empty, differ, rule); service unit "before any hash"; `command.test.ts:131-142` | Met |
| AC-4 secrecy, echo, cap, mode restore, only hash stored | `hidden-prompt.ts`; runner | `hidden-prompt.test.ts` (16); `cli.test.ts` "AC-4"; `on-server.test.ts` (argon2id hash verified) | Met |
| AC-5 one transaction, rollback | `user-service.ts:280-301`; `clear(keyHash, tx)` | `on-server.test.ts` "AC-5" ×3 | Met |
| AC-6 audit, system actor, label pinned, two runs two rows | `:292-300`; `serverCommandActorLabel` | `on-server.test.ts:152-155`; `command.test.ts:182-183`; `cli.test.ts` "AC-6" (label, 200 cut, control characters) | Met (SEC-715-01 Info) |
| AC-7 effect and Done sentence | `setPassword`; `cli.ts:141-143` | `command.test.ts` valid run (old password refused, temporary one signs in, old session refused, no block); `cli.test.ts` "AC-7" | Met |
| AC-8 no web route | none added | `admin-password-reset-no-web-route.test.ts` (6) | Met |
| AC-9 README | `deploy/windows/README.md:637-663` | `admin-password-reset-readme.test.ts` (5); `uptime-monitor-readme.test.ts` green | Met (QLT-715-02 Minor) |
| AC-10 a, b, c | `forgot-password/page.tsx`; `email-off-explanation.tsx`; constants | `forgot-password-page.test.ts` (off, empty, absent, on; `dynamic`; flip); E2E | Met |
| AC-11 a, b | as above | unit (identical, no session, no fetch); E2E (route unchanged, `?mail=on`, signed-in, axe ×3, h1, no live region, 44 px, 320 px) | Met |
| AC-12 (optional) | `invalid-link-notice.tsx`; `reset-password/page.tsx:28` | `reset-password-page.test.ts`; E2E expired/unknown case | Met |
| AC-13 rehearsal | not code | QA at the install rehearsal | Not in scope of the merge |

### Finding → code → test

| Finding | Code | Test that would catch it |
|---------|------|--------------------------|
| QLT-715-01 | `user-service.ts:274-285`; `cli.ts:133` | service unit: the locked listing returns a different active Admin ID → refused, no `setPassword`, no entry |
| QLT-715-02 | `README.md:659-662` | README unit: pin the elevation / exit 9 line |
| SEC-715-01 | `cli.ts:79-82` | n/a (accepted) |
| SEC-715-02 | `cli.ts:65-67` | label unit: U+202E becomes a space |
| QLT-715-03..06 | as listed | n/a |

## Issues for other roles

- **developer:** QLT-715-02 is a docs fix of about 10 minutes, and I recommend it in this PR. QLT-715-01 is about half an hour with one unit test; it is preferred in this PR, or else the hardening window. SEC-715-02 is one line if you are in the file anyway. None of them blocks the merge.
- **solution-architect:** record `loadServerCommandEnv` in §8 step 1 (QLT-715-03), and record that deactivated Admin rows beside the one active Admin do not refuse (the developer's deviation 4, which I agree with: after an FR-006 hand-over there is such a row).
- **product-owner:** if QLT-715-01 is fixed, the new exit-2 sentence ("The Admin account changed while this ran. Nothing was changed. Run it again.") adds to AC-2's word list.
- **reviewer-standards:** QLT-715-05 (constant duplication) is in your area if you want it.
- **qa-engineer:** AC-13 at the rehearsal. Also try one non-elevated window, to confirm the README line from QLT-715-02.

## Previous Findings (re-review only)

n/a (round 1).

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 2, Info 6). CI and the Windows package are green at `30ec8087`.
- Recommended next agent: developer (optional: QLT-715-02 now, QLT-715-01 now or in the hardening window), then orchestrator: merge per CLAUDE.md §9 on fully green CI at 0 behind (DL-361), by the end of Wed 2 Dec (DL-380 (4)).
