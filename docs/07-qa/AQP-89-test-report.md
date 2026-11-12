# Test Report — AQP-89 (STORY-01.06): 12-hour session

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | G7 head `cbbb61b` on `feat/AQP-89-twelve-hour-session` (PR #253, `sankumar76/Accucut-Quotation`) = `81ba5ec` (condition S) + the merge commit from `master` `abdac01` (the AQP-237 squash). The 34 PR files are unchanged by that merge (`git diff 81ba5ec cbbb61b` over the 34 paths: 0 lines). This report is added on top as a docs-only commit; the CI run on that commit is posted on the PR |
| CI | Run **43150655651**, attempt 1, the only run on `cbbb61b`, 5 of 5 jobs `success`; merge ref **b1d9c22** (parents `abdac01` and `cbbb61b`). Base: push run **43148695027** on `abdac01`, 5 of 5 `success` |
| Environment | CI for the regression, the plants and the browser journeys. Local, read-only previews only (two source mutations and `tsc`/`eslint` of my own spec) on a worktree whose `node_modules` predates the Dependabot bumps (no `npm install`, no `npm ci`; free disk was 13 GB, under the 15 GB of DL-163 (4)(d)). No local database, so no local E2E. Local runs are labelled and are not the evidence for any pass |
| Date | 2026-11-11 (CI times are UTC, 2026-11-12) |
| **Recommendation** | **ACCEPT.** AC-1 to AC-6 pass against their text and the product-owner's change note (condition Q). The AC-4 hop works in a real browser at three widths, for both kinds of ended session. A deliberate sign-out never shows "Session ended". SEC-01 is closed and its three guards are live: the removal plant turns the unit test and E2E test 2 red at three widths, and a second plant shows the `_log/x` request of condition S catches what the unit test cannot. The count invariant is exact. No defect found. Open defects: Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0 (the two open Bugs in project AQP are Low and outside this story). **QLT-09 is not closed by tools** (see below): the real screen-reader check is for the delivery lead's device before G8, with the steps in this report, and per DL-166 (7) it does not hold G7. One observation needs master's attention: the log-line half of DL-166 (7) cannot be shown with the CI configuration as it is (OBS-1) |

## Summary

The story ends a session 12 hours after sign-in, tells the person so, and leaves the 01.01 rules (deactivation, role change, sign-out) as they were. I read the code at the head (`session-token.ts`, `resolve-session-user.ts`, `session.ts`, `options.ts`, `proxy.ts`, `lib/auth/session-ended.ts`, the sign-in page, `unauthorized.tsx`, `system-page.tsx`, the nextauth route) and did not take the Dev Record on trust. I added what the story's own tests do not run: four control PRs on `master`, each closed unmerged. One has a QA spec that drives a real browser through the AC-4 hop and the sign-out cases and measures the alerts; three plant the SEC-01 guard in three ways. CI counts on the head equal the target exactly: 3,185 / 5,557 / 268 / 266 / 253 / 24.

## AC Verification Matrix

AC-2 is read with the product-owner's change note of 2026-11-11 (Jira description, condition Q): "one place" means one check (`resolveSession`) reached only through `session.ts`, and one constant (`SESSION_HOURS`). The AC text is unchanged.

| AC | Method | Result | Evidence |
|----|--------|--------|----------|
| AC-1 Boundary, activity does not extend | `tests/unit/auth-session.test.ts` ("AC-1: a session used every minute is accepted at 11 h 59 m 59 s and refused at 12 h 00 m 01 s"; "a request just before 12 hours … accepted and one at 12 hours is refused"); `tests/integration/auth/session-expiry.test.ts` AC-1 block (4 tests, real PostgreSQL, controlled clock, 9 tests in the file, 2,441 ms in stage 11); `auth-small-modules.test.ts`; local mutation preview | ✅ Pass | CI stage 6 (3,185) and stage 11 (5,557) green. `session-token.ts:49-51` `hasSessionEnded` is `age >= 12 h`; `:43-46` `isWithinSession` is `0 <= age < 12 h`; both count from `signedAt`, never from a request. **QA mutation (local preview, unit tests only):** `>=` changed to `>` in `hasSessionEnded` makes `auth-session.test.ts` "a token 12 hours old or more has ended…" fail (1 failed, 95 passed of 96); restored, `git status` clean. The reviewers' plants (DL-160 (5), P1 boundary) are the CI-level proof |
| AC-2 Sign-in time in the token, 12 h, not renewed; one check, one constant | Integration AC-2 block (3 tests); `auth-options.test.ts` ("the same token written again 6 hours later lives only the 6 hours that are left"); `git grep` at `cbbb61b`; local mutation preview | ✅ Pass | **Read with Q's note.** `git grep` over `src` at `cbbb61b`: `hasSessionEnded` and `isWithinSession` are called only in `resolve-session-user.ts:51,53`; `resolveSession` is called in production once, `session.ts:60` (the other call, `:69`, is `resolveSessionUser`, which no file under `src` calls); `SESSION_HOURS` is defined once (`session-token.ts:17`) and every other 12-hour value derives from it (`SESSION_MAX_AGE_SECONDS`, `options.ts:149,156`); no `43200`, `12 * 60` or `updateAge` in `src`; `SESSION_LIFETIME_HOURS` is not in `src`. `requireUser()`, `requireUserOrRedirect()` and `getCurrentUser()` all read the one cached state (`session.ts:51-66`). `options.ts:152-158` writes the token again with `sessionSecondsLeft` only, so a script calling the session route does not push the expiry out. **QA mutation (local preview):** making `sessionSecondsLeft` return a fresh 12 hours makes `auth-options.test.ts` "the same token written again 6 hours later lives only the 6 hours that are left" fail (1 failed). The cookie's extra 7 days (DL-157, ADR-009 amendment 2) is a second constant that decides when the cookie goes, not when the session ends; the token and the check still end at 12 h |
| AC-3 Page request after the end shows SCR-26 with its words, action and return | E2E `session-ended.spec.ts` tests 1 and 3 at three widths (CI); QA browser spec; unit `auth-session.test.ts`, `auth-session-ended.test.ts`, `system-pages.test.ts` | ✅ Pass | Status 401, heading "Your session ended", the exact sentence of the AC in `main [role="alert"]`, action "Sign in again" leading to `/sign-in?callbackUrl=<path>`; keyboard-only journey returns to `/` after signing in. **QA hop test** also returns to a non-home path: after the hop to SCR-01 and a sign-in, the browser is at `/audit` (all three widths). Hostile return addresses (`https://evil.example/x`, `//evil.example/x`, `/\evil.example`, `/api/v1/me`, `/sign-in`, empty, `/a\r\nb`) all become home (`auth-session-ended.test.ts`, 7 cases) |
| AC-4 (negative) API call or background fetch after the end: 401 problem+json, code, no data, no-store; client goes to SCR-01 "Session ended" | E2E test 2 (CI, three widths); **own browser run, below**; unit `session-ended-clients.test.ts` (three clients), `http-problem.test.ts`, `http-with-route.test.ts`, `auth-proxy.test.ts`, `sign-in-page.test.ts` | ✅ Pass | **Own run, control #292, run 43155026763, 18 of 18 first-attempt passes, 0 retries.** A person signs in for real (E2E Admin), opens `/audit`, the cookie is swapped for an ended session, and a filter is changed. The page's own request goes to the real production server: **401, `application/problem+json`, `private, no-store`, body exactly `{type, title: "Your session ended. Sign in again.", status: 401, code: "SESSION_ENDED", requestId}`**, no record or person in it. The browser then lands at **`/sign-in?reason=session-ended&callbackUrl=%2Faudit`**, SCR-01 shows "Your session ended. Sign in again to continue where you left off." as `[data-slot="alert"]`, the `h1` "Sign in" has focus, and signing in again returns to `/audit`. Both kinds of ended session, at mobile, tablet and desktop: an expired token (`expired-token`, the cookie outliving the token) and a readable token signed 13 hours ago (`old-sign-in`, the 12-hour check). Details in "AC-4 browser hop" |
| AC-5 (negative) Inside 12 h a deactivation or role change is effective at the next request | Unit `auth-session.test.ts` (four AC-5 cases); integration AC-5 block (2 tests: role change and deactivation with the same cookie 6 h in; version mismatch at 1 h and 6 h); QA browser spec | ✅ Pass | `resolveSession` returns `refused`, not `ended`, for no such user, deactivated, or a `session_version` mismatch (`resolve-session-user.ts:54-55`), so these are sent to sign in as in 01.01. **QA, real browser:** after a real sign-out the old cookie (still inside 12 h) gets **401 `UNAUTHORIZED`** for the API and a redirect to plain `/sign-in` for a page, never `SESSION_ENDED`, at three widths. 01.01's own sign-in and sign-out E2E tests stay green in the same run |
| AC-6 (NFR-016, 017, 018) Both screens at 360×800, 768×1024, 1366×768: no sideways scroll, 44 px, axe 0, announced, focus to heading, keyboard only | E2E `session-ended.spec.ts` tests 1 to 3 at three widths (CI); QA browser spec (accessibility tree) | ✅ Pass for what automation can show | `horizontalOverflow ≤ 0`; the action and the four SCR-01 controls ≥ 44 × 44; `expectNoAxeViolations` (WCAG 2.0, 2.1 and 2.2 A and AA tags); `role="alert"` with the AC's words; `h1` focused; Tab reaches "Sign in again" and Enter leaves for SCR-01, all by keyboard. **The announcement itself is QLT-09:** the browser exposes both notices as live regions (`live=assertive`, `atomic=true`), but no tool here says what a screen reader speaks. See "QLT-09" |

## Count invariant (reading rule of DL-161 (7)(c), DL-163 (4)(a); target of DL-166 (7))

| | Unit (stage 6) | Full (stage 11) | E2E shards 1 / 2 / 3 | Skipped 1 / 2 / 3 |
|--|---------------|-----------------|----------------------|-------------------|
| Base: push run 43148695027 on `abdac01` (the `master` commit in the merge ref), read by me from the job logs | 153 files, 3,081 | 212 files, 5,444 | 265 / 263 / 250 = 778 | 3 / 4 / 17 = 24 |
| G7 head: run 43150655651 (merge ref b1d9c22) | 157 files, **3,185** | 217 files, **5,557** | 268 / 266 / 253 = **787** | 3 / 4 / 17 = **24** |
| Difference | +104 (+4 files) | +113 (+5 files) | +3 / +3 / +3 = +9 | +0 |

**Equal to the target 3,185 / 5,557 / 268 / 266 / 253 / 24.** The +104 / +113 / +9 / +0 of DL-166 (7) holds exactly, per shard +3. The condition S commit added no test (E2E +0): its two requests sit inside test 2.

## Regression

| Item | Result |
|------|--------|
| CI on the G7 head | Run 43150655651, attempt 1: `Stages 1 to 11b`, E2E shard 1, 2, 3 and `Stages 1 to 11`, **5 of 5 `success`** (jobs API). Stage 4 lint, 5 type-check, 6 unit (3,185), 11 full (5,557), 11b JS budget, 12 E2E (787) all green |
| Cache | 18 "Cache restored successfully", 0 "Cache not found" |
| Secrets | Gitleaks: 726 commits scanned, no leaks found |
| Log lines | `JWT_SESSION_ERROR` **0**; `[next-auth][` **0**; `SEC01_E2E_PROBE` **0**; `retry #` 0. `flaky` matches only the two branch names `fix/AQP-268-flaky-g7-7` and `fix/AQP-272-flaky-aqp-122-qa-tablet` in the fetch output. One `FATAL: password authentication failed for user "accucut_owner"` line in the container log, the same line as in the base runs of AQP-237. **What these zeros mean is in OBS-1** |
| JS budget (stage 11b, gzip B, head against the `abdac01` push run) | `/` 162,817 (+499); `/audit` 172,853 (+970); `/masters/materials` 187,424 (+923, headroom 12,576); `/masters/process` 175,061 (+908); `/queue` 163,971 (+499); `/sign-in` 162,184 (-3,959); `/users` 170,879 (+936); `not-found` 155,962 (+334). All within the 200,000 limit, and inside the +334 to +970 B per route that DL-166 (6) accepted as the new baseline |
| Open Sev-1 / Sev-2 | JQL `project = AQP AND issuetype = Bug AND statusCategory != Done AND priority in (Highest, High)`: **0 issues**. JQL `project = AQP AND issuetype = Bug AND resolution = Unresolved`: AQP-225 (priority Low, label `sev-3`) and AQP-226 (Low, `sev-4`), neither in this story's area (a Windows-only hook timeout; a long-lived local database) |
| Path (reported, not held, DL-151) | First job start 03:48:43Z to the end of `Stages 1 to 11` 03:53:20Z = **4:37** (277 s). The slowest shard (3) ended 265 s after the first start. `Stages 1 to 11` **waited 3 s** in the runner queue and ran for 9 s. **Slack** (slowest shard minus `Stages 1 to 11b`): 265 s minus 229 s = **+36 s**. Under the 5:30 line. This is one run; the median of five on `e84c073` (5:16) is the orchestrator's item and is posted on the PR |

## AC-4 browser hop and sign-out, by my own run (control #292, `control/AQP-89-qa-browser`, run 43155026763)

Branch = the G7 head plus `tests/e2e/aqp-89-qa.spec.ts` (copy: `docs/07-qa/AQP-89-evidence/aqp-89-qa.spec.ts.txt`) and `stdout: 'pipe'` on the production server in `playwright.config.ts` (so the portal's own log lines show in the CI log). No `src/` change: the product code is exactly the head's. Run on the production build with a real database at three widths. 6 tests × 3 widths = 18 passes, 0 retries; shards 274 / 272 / 259 passed (the head's 268 / 266 / 253 plus 6 / 6 / 6), skipped 3 / 4 / 17, 0 failed.

| Check | Result (lines the spec printed, in `qa-browser-output.txt`) |
|-------|--------------|
| AC-4 hop, `expired-token`, three widths | `api=401` `code":"SESSION_ENDED"`; landed `/sign-in?reason=session-ended&callbackUrl=%2Faudit`; notice text exact; `h1` focused; signing in again returns to `/audit` |
| AC-4 hop, `old-sign-in` (token readable, 13 h old), three widths | The same 401 body and the same landing address |
| A deliberate sign-out never shows "Session ended" (disposable user, account menu → Sign out, three widths) | Landed `/sign-in` with **no query**; no `[data-slot="alert"]` on the page; no text matching /session ended/i |
| A stale copy of the cookie from before the sign-out (a second tab, a copied profile) | Page: redirect to `/sign-in`, `reason` absent, no "Your session ended" heading or text. API: **401 `UNAUTHORIZED`**, not `SESSION_ENDED` |
| A visit with no session at all | Redirect to sign-in without `reason`; API 401 `UNAUTHORIZED` |

**A test defect of mine, found and fixed on the control branch (no product defect).** The first version (c07a50f, run 43154019321) read the response body after the page had already left for SCR-01 and failed with "No resource with given identifier found" in the AC-4 hop tests; the status assertions before it passed and one desktop retry passed in full. The second version (a12872d) reads the answer in a route handler before handing it on. The other 12 tests passed in the first run. No DEF raised: it is a defect in a throwaway control spec, not in the product or in a committed test.

## SEC-01 plants (DL-166 (7)); control PRs #289, #290, #298, all closed unmerged; diffs printed in each PR body before its run

Base `master` `abdac01`; each branch = the G7 head `cbbb61b` plus one commit (they do not stack). A script (`plant-script.mjs.txt`) applied each edit and fails unless its anchor occurs exactly once. For plant 1 the two constants that only the guard used are removed with it: otherwise ESLint (stage 4) stops the main job before the unit stage and the unit test could not be seen red.

| Plant | Commit, run, diff | Result in CI |
|-------|-------------------|--------------|
| **1. The guard line removed** (the plant DL-166 (7) asks for). `if ((await context.params).nextauth[0] === LOG_RELAY_ACTION) return new Response(null, { status: NOT_FOUND_STATUS });` plus the constants `LOG_RELAY_ACTION` and `NOT_FOUND_STATUS`; 3 lines deleted in `src/app/api/auth/[...nextauth]/route.ts` | #289, 94b3ee9, run 43152934264, `plant-sec01.diff` | ✅ **Stage 4 and 5 green; stage 6 red:** `tests/unit/auth-log-route.test.ts`, 1 file failed, **4 tests failed** (the three POST cases, "expected 200 to be 404", and the GET case, "expected 400 to be 404"), 3,181 of 3,185 passed. ✅ **E2E test 2 of `session-ended.spec.ts` red at mobile (shard 1), tablet (shard 2) and desktop (shard 3)**, each on its first attempt and on retry #1: `Expected: 404 / Received: 200` at `session-ended.spec.ts:94:28`, the first relay request. Passed per shard 267 / 265 / 252, one failed in each. `SEC01_E2E_PROBE` in the log: **0** (see OBS-1) |
| **2. The same plant with the server's stdout piped** (`stdout: 'pipe'` added to the production server entry in `playwright.config.ts`) | #290, e783b2b, run 43153090153, `plant-sec01-logs.diff` | ✅ The same reds: stage 6 red, E2E test 2 red at all three widths. **`SEC01_E2E_PROBE` appears in the plant's log: 6 lines**, two per shard (the attempt and the retry), each `{"level":50,…,"authCode":"SEC01_E2E_PROBE","msg":"next-auth reported an error."}` from `[WebServer]`. This is the line DL-166 (7) expects, and it needs the piped stdout |
| **3. The guard matches only the exact path** (`nextauth.join('/') === LOG_RELAY_ACTION`: `_log` is refused, `_log/x` reaches next-auth) | #298, 827c0f2, run 43155581613, `plant-sec01-segment.diff` | ✅ **Stage 6 green** (3,185 pass: the unit test asks only for `['_log']`) and ✅ **E2E test 2 red at all three widths** on the second request, `Expected: 404 / Received: 200` at `session-ended.spec.ts:96:39`. So the `_log/x` request that condition S added closes a gap the unit test leaves, and it is live |
| **Clean control for the log line:** the head with the same one `stdout: 'pipe'` line and no plant | #292, run 43155026763 | `SEC01_E2E_PROBE` **0**, `JWT_SESSION_ERROR` **0**, `[next-auth][` **0**, pino level-50 (error) lines **0**; 121 level-40 lines, all `route refused` with `status 403 / FORBIDDEN` from other specs; no `SESSION_ENDED` line is logged as a warning or error |

So on the head: S's two requests pass at three widths; with the guard removed E2E test 2 and `auth-log-route` go red, and the probe code reaches a log line when the log can be seen. Sign-in and sign-out E2E tests were green in every run that reached them.

## QLT-09: is the alert announced? (checked with the tools I have; the real check is for the device session)

**What I could measure.** Playwright 1.65 with Chromium: the raw first response, the DOM events from the first parsed byte, and the browser's accessibility tree through the DevTools Protocol (`Accessibility.getFullAXTree`). Run at three widths, identical in substance (`qa-browser-output.txt`).

| | SCR-01 "Session ended" notice | SCR-26 "Session ended" page |
|---|---|---|
| Exposed as | `role=alert`, AX `live=assertive`, `atomic=true`, `relevant="additions text"`, `main` > after the `h1` | The same properties, `main` > after the `h1`, before the "Sign in again" link |
| In the first response? | **Yes**, as markup: `role="alert"` is in the HTML, after the `h1` | **No as markup.** The first response (401) holds the words only inside the Next.js flight data string; no `role="alert"` attribute exists in the HTML |
| When the alert enters the DOM | During parsing, `readyState "loading"`, 30 to 100 ms | After parsing, by script, `readyState "interactive"` or `"complete"`, 216 to 793 ms (CI host speed) |
| Focus to the `h1` | 170 to 650 ms later, at `complete` | **10 to 34 ms after the alert is inserted** |
| Other live regions | Next.js's route announcer (an empty `alert`) is also in the tree | The same |

**What this says, and does not say.** The markup is what the AC and the ARIA authoring guidance ask for, and the browser maps it to an assertive, atomic live region on both screens. The two screens differ in how they get there, which is the point of QLT-09 and its likely trouble:

* SCR-01 is QLT-09's case: an alert that is already in the page at first render. Some screen reader and browser pairs do not speak such an alert at load. Focus then moves to the `h1`, so the person would hear "Sign in, heading level 1" and not the notice unless they read on.
* SCR-26 inserts its alert by script and moves focus to the `h1` within about 30 ms. Insertion is the case live regions announce best, but the focus move is close behind it, and some screen readers cut a live-region announcement short or drop it when focus moves. The person would then hear the heading "Your session ended" and perhaps not the sentence.

Neither can be confirmed or ruled out without a screen reader. Both pages keep the person able to act: the `h1` text is the message, the sentence follows it in reading order, and the one action is the next Tab stop. By the test plan (§6, §12) a silent alert would be **Sev-3** if the heading is spoken and only the sentence is not (the task is not blocked), **Sev-2** only if the page says nothing at all. It would be a Product defect bound to AQP-89 and does not hold G7 (DL-166 (7)).

**Steps for the delivery lead's device session, before G8** (test plan §12.2). Use invented data only. Record, for each step: the screen reader and its version, the browser, **what was spoken, word for word** (NVDA: Tools → Speech Viewer, copy the text), and the verdict.

*Setting up the two screens (no code change needed):*

* **SCR-01 state:** open `<portal address>/sign-in?reason=session-ended` directly. This is the same page the browser reaches after the hop.
* **SCR-26 on a computer:** sign in as any user and open the home page. Press F12 → Application (Chrome) → Cookies → the portal address → `__Secure-next-auth.session-token` → double-click the Value and change one character. Close the tools, click into the page, and press F5. The server finds a cookie it cannot read and shows SCR-26 (this is the same case as a tab left open overnight).
* **SCR-26 on a phone:** the cookie is HttpOnly, so it cannot be edited on the phone. Use Chrome's remote debugging (`chrome://inspect`) for Android, or Safari's Web Inspector from a Mac for iPhone, and make the same edit. If neither is possible, run SCR-01 on the phone and SCR-26 on the computer, and write "SCR-26 not run on phone" in the report.

*NVDA with Chrome on Windows:*

1. Start NVDA with the Speech Viewer open. Open a new tab with the SCR-01 address above and wait 5 seconds without touching a key. Expect: "Sign in, heading level 1" and the sentence "Your session ended. Sign in again to continue where you left off." spoken by itself. **Pass:** both are spoken, once, without a key press. **Fail (Sev-3):** only the heading is spoken, or nothing. Write down the exact text.
2. Press NVDA+Down Arrow (say all) from the top. Expect the notice to be read between the heading text and the form. **Pass:** it is read.
3. Make SCR-26 as above and press F5. Wait 5 seconds. Expect "Your session ended, heading level 1" and "Sessions last 12 hours from the time you sign in, so you were signed out. Sign in again. Anything you had saved is still there." Note the order, and whether the sentence is cut off or missing.
4. Press Tab once. Expect "Sign in again, link". Press Enter. Expect the sign-in page with the return address kept, and the focus on "Sign in, heading level 1".
5. The hop: sign in as the Admin, open `/audit`, edit the cookie as above, then change the "Event" filter. The page should go to the sign-in page by itself. **Pass:** the notice is spoken after the page change, as in step 1.
6. Control: on the sign-in page, enter a wrong password. The error should be spoken. This shows what a working alert sounds like on this computer, so a silent notice can be told apart from a screen reader that is not announcing alerts at all.

*VoiceOver with Safari on iPhone:* turn VoiceOver on, open the SCR-01 address and wait 5 seconds. Record what is spoken. Then swipe right from the top: heading, then the notice, in that order. Repeat step 6 as the control. SCR-26 if the remote edit is possible.

*TalkBack with Chrome on Android:* the same as VoiceOver.

*Result form:* one row per screen reader × screen: spoken at load (yes / no), words, order, anything cut off or repeated, verdict. A notice that is read when the user swipes to it but not at load is "not announced" for this purpose; record it as such.

## Non-Functional Checks

| Check | Method | Result |
|-------|--------|--------|
| Security smoke: SEC-01 | Three plants above; route read (`route.ts`, one handler for GET and POST, guard first, reads the same `nextauth[0]` next-auth reads) | ✅ Closed. The unit test and the two E2E requests are live (plants 1 and 3) |
| Security smoke: no data in the 401 | Body compared with `toEqual` to five members; no cookie value, name or record in it | ✅ |
| Security smoke: open redirect | Seven hostile return addresses fall back to home (unit); in the browser the return address was `/audit` only for a same-origin path | ✅ |
| Error leakage | Piped server log of the browser run: no stack, token or claim; 0 level-50 lines; no `SESSION_ENDED` warning | ✅ |
| #255 logger | An expired-token cookie produced no warn or error line in the piped log (it goes to debug, below the `info` level the logger runs at); no `JWT_SESSION_ERROR` anywhere | ✅ |
| Performance | JS budget table above; path 4:37 | ✅ within the budget; reported |
| Accessibility | axe (WCAG 2.0 to 2.2 A and AA) 0 violations, 44 px, no sideways scroll, keyboard-only journey, at three widths (story's own E2E, green in CI) | ✅; the announcement is QLT-09 |

## Exploratory Testing

Charter (45 minutes): break the claim "a person is told their session ended when it did, and is never told so when it did not". Areas: the two kinds of ended cookie; a sign-out followed by a stale cookie; a visit with no cookie; the API and the page path; the log relay under three guards.

* **OBS-1 (Info, for master and the architect), the log-line check of DL-166 (7) and the "0 lines" readings cannot show a pino line with the CI configuration as it is.** Playwright ignores a web server's stdout unless the config says `stdout: 'pipe'`, and the portal's logger writes to stdout. So `SEC01_E2E_PROBE` is absent from the plant's log in plant 1 (0 lines, same as the head), and appears (6 lines) only when stdout is piped (plant 2). The "0 `SEC01_E2E_PROBE`" and "0 `JWT_SESSION_ERROR`" readings in the head's logs therefore say nothing about pino lines; they do cover stderr, where next-auth's old `[next-auth][error]` line was. I do not think the story needs a change: the red tests are the real signal, and with the stdout piped on the clean head I read 0 probe lines, 0 `JWT_SESSION_ERROR` and 0 error-level lines. A one-line `stdout: 'pipe'` in `playwright.config.ts` would make a future log assertion meaningful; it is a follow-up for the developer or the architect, not part of AQP-89.
* **OBS-2 (Info, for the developer and ux-expert), SCR-26 is drawn by script.** The first 401 response has the card only inside the flight data; the DOM is built after parsing. AC-3 is met in a real browser, and the E2E tests wait for it. It matters for QLT-09 (above) and means the page shows nothing without scripts. No change asked.
* **OBS-3 (Info), SCR-26 and SCR-01 are two mechanisms.** One alert is in the server HTML and one is inserted by script (above). If the device session finds one announced and the other not, that is the likely reason.
* **OBS-4 (Info), dev-server noise.** The piped stdout of the development server (the other web server entry, port 3100) holds React hydration warnings about the Materials panel (`MaterialsPanel`, 4 times) and a "script tag" message (33). Neither is in AQP-89's files. I did not compare them with `master`.
* **OBS-5 (Info), every 401 `SESSION_ENDED` is silent in the log.** Only 403s appear as `route refused` warnings in the piped log. That is consistent with the logger design (DL-160 (4)); noted so nobody expects a line when looking for one.

## Defects

None. No DEF-NNN, Jira Bug or GitHub issue was created. The one failure I met (the first version of my own control spec) was a test defect in a throwaway control spec and was fixed on its branch.

## Issues for other roles

* **master / orchestrator:** OBS-1 changes how DL-166 (7)'s log-line item reads: it holds only with piped stdout. I have shown it that way (plant 2 against the clean control).
* **ux-expert (#256, due G8):** OBS-2 and OBS-3 for the SCR-26 and SCR-01 alert design, after the device session.
* **solution-architect:** STD-15 (one sentence on the `_log` closure in architecture §6 or §8 and ADR-009's consequences) is still due before G8 (DL-166 (6)). Not a G7 item.
* **developer or solution-architect (follow-up, optional):** `stdout: 'pipe'` on the production server (OBS-1).
* **delivery lead (H, DL-166 (8)):** delete the four QA control branches with the others before G8: `control/AQP-89-qa-sec01` (#289), `control/AQP-89-qa-sec01-logs` (#290), `control/AQP-89-qa-browser` (#292), `control/AQP-89-qa-sec01-segment` (#298).

## Residual Risks / Notes

* **QLT-09 stays open until the device session** (steps above). If a notice is silent there, I raise it as a Product defect bound to AQP-89, graded by §6 of the test plan; it does not hold G7 and must be settled before G8.
* **Merge:** DL-160 (11) and DL-166 (8) apply. Any further update is by merge commit only, with the PR's files unchanged, the counts recomputed against the push run of the `master` commit in the new merge ref (on `abdac01`: 3,185 / 5,557 / 268 / 266 / 253 / 24), 5 of 5, and the head and counts posted before the squash. "Closes #255" stays; nothing closes #256.
* **Local runs:** the two source mutations and the `tsc` and `eslint` of my spec ran on a worktree whose `node_modules` predates the Dependabot bumps. They are previews; the verdicts above rest on CI.
* **Evidence:** `docs/07-qa/AQP-89-evidence/` holds the QA spec, the plant script, the three plant diffs, and the CI log excerpts of each run. All data is invented.
* This report is committed to the PR branch; the commit changes no test, source, workflow or dependency.
