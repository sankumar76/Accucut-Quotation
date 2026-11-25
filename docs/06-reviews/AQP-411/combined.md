# Review Report — AQP-411 (DEF-069) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review of CLAUDE.md section 9 item 2, ordered by master's DL-329 (B), (3)) |
| Review round | 1 |
| Base…branch | Code already on `master`; no PR, so no inline comments (DL-329 (3)) |
| Commit reviewed | `origin/master` **06d5d56a6193f6ca934d6b6d3399dd61ed00a449** |
| Date | 2026-11-23 |
| **Verdict** | **APPROVE WITH COMMENTS.** **Outcome stated: C1** (route: C1 without qualification; page: C1, with the layout's bell count recorded under QLT-02 for master) |

**No C3 sign.** No estimate, node, cost or master data is read, computed, logged or returned on the refusal path of the route or the page. The only database reads on either refusal are the session's own `users` row and, on the page only, the portal frame's viewer-scoped overdue-task COUNT (QLT-02).

## Summary
On the forbidden cost route, an Engineer's request reaches the role check after exactly one I/O: the session read, which is a JWT decode plus one `SELECT` on `users` by primary key. Nothing from the URL is parsed, read or logged before the fixed 403. On the cost page, `authorizePage` is the page's first statement, and the page reads nothing of its own before `forbidden()`. The `(portal)` layout runs its bell COUNT for every portal page, the 403 card included. That count is scoped to the viewer, does not depend on the URL, returns one number and carries no cost data. The design requires it (architecture `:2168`: an Engineer's screens are "SCR-01, 02, 03 (Engineer), 05, 23, 24, 26 and the bell"). The code path cannot explain a 5 s refusal: the route does one indexed row read and one log line. The developer's code-facts note is accurate in every point that bears on the outcome. It has one small error (QLT-04), which does not change anything.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 5 |

## Checks Run
| Check | Command / source | Result |
|-------|------------------|--------|
| Code read at the reviewed commit | `git show origin/master:<path>` for every file cited below (06d5d56a) | Done; line numbers below are on 06d5d56a |
| Developer's note verified against the code | GitHub #638 comment 7093879091 (= Jira AQP-411 comment 12821), items (i) to (vi) | Items (i), (ii), (iii) and (v) checked line by line. One error found (QLT-04). (iv) checked for the files on the refusal path only. (vi) is a log reading and was not re-derived |
| Next.js behaviour, from the installed source (Next 16.4.5, `node_modules` of the `aqp-398` worktree, read-only) | `server/app-render/create-error-handler.js:48-53, :192-194`; `client/components/is-next-router-error.js`; `server/config-shared.js:120`; `server/dev/on-demand-entry-handler.js:231-259, :359, :479-482`; `server/dev/hot-reloader-turbopack.js:37, :1612`; `server/dev/hot-reloader-webpack.js:1198`; `docs/01-app/01-getting-started/06-fetching-data.md:460` | `forbidden()` is filtered before `onRequestError` (no log line). Idle disposal is wired in the webpack reloader only. Layouts and pages render in parallel |
| AC-8 text | Jira AQP-320 (STORY-06.03), description, AC table | Read; see QLT-03 |
| CI on the reviewed commit | `gh run view 45125449394` (push, 06d5d56a) | `Stages 1 to 11b` **success** (lint, type-check, unit and integration tests). Stage 12 shard 2 red on `estimate-review.spec.ts:210` [tablet] on both attempts, plus a flaky `approve.spec.ts:101` [tablet]. Neither case calls a cost route. This is not this review's defect; it is reported for the orchestrator's daily update |
| Local test run | not run | Not run: the brief allows no re-runs, the code is unchanged `master`, and its unit stages are green in CI (row above). The tests that pin the order are cited under QLT-06 |

## 1. The route: an Engineer's `GET /api/v1/estimates/[id]/nodes/[nodeId]/costs`

| # | Step | file:line (06d5d56a) | What is read |
|---|------|----------------------|--------------|
| 1 | `proxy`: `isPublicPath`, `isApiPath`, `hasSessionCookie` (cookie **names** only) | `src/proxy.ts:86-90` | nothing (synchronous, no I/O) |
| 2 | API branch: return-path and cookie-present headers set; nonce header deleted; security headers; `Cache-Control: private, no-store` | `src/proxy.ts:91-105`, `:62-77` | nothing |
| 3 | Module load of the route: `withRoute({...})` runs `findRoute` over the frozen manifest and throws if the row is missing or public | `route.ts:12-18`; `with-route.ts:206-211`; `route-manifest.ts:392, :402-404` | nothing from the database; runs once per module load, not per request |
| 4 | `handle`: request ID from `randomBytes`, never from the request | `with-route.ts:254-256`; `problem.ts:46-48` | nothing |
| 5 | Origin check skipped: `GET` is not state-changing, so `loadOriginEnv()` is not called (short-circuit `&&`) | `with-route.ts:214`; `route-manifest.ts:395-399` | nothing |
| 6 | **Session read:** `requireUser()` → `readSessionState()` (React `cache`) → `connection()`, `getServerSession(getAuthOptions())` (JWT cookie decode, `strategy: 'jwt'`, no adapter) → `resolveSession`: 12-hour checks in-process, then `users.findAccountById(claims.userId)` | `with-route.ts:217`; `session.ts:51-65, :77-81`; `resolve-session-user.ts:49-59` | **one `SELECT` on `users` by primary key**, seven columns `id name email role isActive sessionVersion mustChangePassword` (`user-repository.ts:204-218`) |
| 7 | `who.userId = user.id` (kept only for a later 5xx log line) | `with-route.ts:218` | nothing |
| 8 | `mustChangePassword` from the same row of step 6. The cost row is not `mustChangeAllowed` | `with-route.ts:219-221`; `route-manifest.ts:329` | nothing new |
| 9 | **Role check:** `allowsRole(row, 'ENGINEER')` is false for `ADMIN_AND_LEAD` → `throw new ForbiddenError()` | `with-route.ts:222`; `route-manifest.ts:329, :412-414`; `errors.ts:57-60` | nothing |
| 10 | `catch`: `problemFromAppError` → `forbiddenProblem(requestId)`: fixed words, fixed code `FORBIDDEN`, only `requestId` varies | `with-route.ts:259-262`; `problem.ts:151-153` | nothing |
| 11 | One `warn` log line: `requestId`, `route` (the **manifest pattern**, `options.route`, not the URL), `method`, `status`, `code`. No user ID, no URL, no path ID, no body | `with-route.ts:265` | stdout (pino) |
| 12 | `problemResponse`: `no-store`, request ID header | `with-route.ts:266`; `problem.ts:201-206` | nothing |

**Never reached on the refusal:** `queryOf`/`params` (`await context?.params`)/body (`with-route.ts:224-231`), upload (`:233`), the handler (`:237`), and therefore `getCostDetailsService()` (`route.ts:17`). The service's own second guard (`cost-details-service.ts:79-87`) refuses an Engineer before `findFigureBasis` (`:88`) and `listNodes` (`:90`), and is also never reached.

**Does anything except the session read run before the role check?** **No.** Between `requireUser()` (`:217`) and `allowsRole` (`:222`), the only step is a flag test on the session's own row. The session read has to come first, because the role is read from `users` on every request by design (`session.ts:24-27`; `with-route.ts:31-37`; architecture `:963`, "`withRoute` checks the role first, before any lookup").

## 2. The page: an Engineer's `GET /estimates/[code]/costs/[slNo]`

| # | Step | file:line | What is read |
|---|------|-----------|--------------|
| 1 | `proxy`, page branch: CSP nonce (`createNonce`) and policy set on the request | `src/proxy.ts:97-103` | nothing |
| 2 | Root layout: `await headers()` for the nonce | `src/app/layout.tsx:33-36` | nothing |
| 3a | `(portal)` layout: `requireUserOrRedirect()` (the **same** `cache()`-d session read as in section 1, step 6), `portalFrameProps(user)` (menu from the manifest; imports only manifest, navigation and role helpers) | `(portal)/layout.tsx:40-41`; `portal-frame-props.tsx:18-24` | the session read (shared, one per render) |
| 3b | `(portal)` layout: **`bellCount(user)`** → `getTaskService().countOverdue(user)` → `tasks.countOverdue(bellScopeOf(viewer), now)` → `db.task.count({ where: AND[scopeFilter, tabFilter('overdue')] })` | `(portal)/layout.tsx:20-27, :42`; `task-service.ts:228-231, :406`; `task-repository.ts:271-274, :255-263, :437-442` | **one `COUNT(*)` on `tasks`** with `engineer_id = <viewer>`, `deadline_at < now`, and a join filter on the task's estimate `status NOT IN LOCKED` and `ignored_at IS NULL`. Returns one integer. Takes nothing from the URL |
| 3c | Page: **`authorizePage('/estimates/[code]/costs/[slNo]')` is the first statement** → `findPage` (manifest scan), `requireUserOrRedirect()` (cached session), `mustChangePassword` redirect, **role check → `forbidden()`** | `page.tsx:32`; `page-access.ts:22-29` | the session read only (cache hit) |
| 4 | Not reached: `await params`, the Sl. No test, `getEstimateService().getWorkspace`, `getCostDetailsService().getNodeCostsBySlNo` | `page.tsx:33-38, :46` | — |
| 5 | `forbidden()` renders `(portal)/forbidden.tsx` inside the `(portal)` layout: `readViewerRole()` → `getCurrentUser()` (cached session); the card is the same for every address | `forbidden.tsx:13-15`; `viewer-role.ts:21-31` | the session read only (cache hit) |
| 6 | Logging: none by the app. `forbidden()` throws an HTTP-access-fallback error, which `isNextRouterError` matches, and Next does not report it as an error (`create-error-handler.js:52`, `:193`), so `onRequestError` (`src/instrumentation.ts:40-49`) writes no line | as cited | nothing |

No `layout.tsx`, `template.tsx` or `loading.tsx` sits between `(portal)` and the page (`git ls-tree` of `src/app/(portal)/estimates/**`). The two `error.tsx` files there do not render for `forbidden()`. `page.tsx:29` records that the missing `loading.tsx` is deliberate (TD-06).

**Order on the page.** Inside the page, the session read comes first and the role check second. The page reads nothing else before refusing. The layout's count (3b) is **not ordered** against the page's role check. Next renders layouts and pages in parallel (`06-fetching-data.md:460`), and the layout neither waits for the page nor is gated by it. So the count can start before, with or after `forbidden()`, and it runs on every portal response, allowed or refused. This is the one read besides the session read. It is discussed under QLT-02 and in section 5.

## 3. Is any estimate or cost data read, logged or returned on the refusal path?

| Channel | Route | Page |
|---------|-------|------|
| Database reads | `users` row of the viewer only (section 1, step 6) | the same, plus the bell COUNT (section 2, 3b): one integer about the viewer's own overdue tasks. It filters on two columns of those tasks' estimates (`status`, `ignored_at`), which return no row and are not cost, node, rate, input or output data |
| Computation | none on estimate data | none on estimate data |
| Response body | fixed `problem+json` (`problem.ts:151-153`); the E2E case asserts no `state`, `details`, `stages`, `formula`, `working` or rate word (`cost-details.spec.ts:297-298`) | SCR-26 card, identical for every address (`forbidden.tsx:8-15`); the frame carries the viewer's own bell badge |
| App log | one `warn` line with no URL, no ID and no user ID (`with-route.ts:265`) | none (section 2, step 6). The bell count's failure branch logs only `errorName`/`errorCode` (`layout.tsx:24`) |
| Error objects | `ForbiddenError()` with the default message and code (`errors.ts:57-60`); the message never reaches the body (`problem.ts:153`) or the log (`with-route.ts:265`) | Next's control-flow error; not logged |
| Telemetry | `onRequestError` is not called for a handled `AppError` (`withRoute` catches it) | not called for `forbidden()` (above) |
| Audit | no audit write on either path (none in `with-route.ts`, `page-access.ts`, `session.ts`) | none |
| Database query log | Prisma client has no `log` option (`prisma-client.ts`, no match for `log`/`$on`), so statements and parameters are not logged | same |
| Safety net | the logger redacts `inputs`, `outputs`, `rate`, `rates` and personal fields by name (`logger.ts:31-73`) | same |

**Does the answer time depend on a real or an invented ID, by code path?** **No**, for both. The route parses `params` only after the role check (`with-route.ts:225`). The page awaits `params` only after `authorizePage` (`page.tsx:33`). The bell count does not use the URL.

**Does item (v) explain the readings?** **Not from a source, and I agree with the developer.** `maxInactiveAge` (60 s, `config-shared.js:120`) is used by `disposeInactiveEntries` (`on-demand-entry-handler.js:231-259`) on a timer started in `onDemandEntryHandler` (`:479-482`). Only the webpack hot reloader calls `onDemandEntryHandler` (`hot-reloader-webpack.js:1198`). The Turbopack reloader imports the module but uses only `findPagePathData` (`hot-reloader-turbopack.js:37, :1612`). CI runs Turbopack (the note cites log line 441). Whether Turbopack's native code evicts idle routes cannot be read from `node_modules`. The probe the note proposes is the way to settle it. That is DL-329 (5)'s concern, not this review's.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Minor | `src/app/(portal)/estimates/[code]/costs/[slNo]/page.tsx:25-26` (same wording at `src/app/(portal)/estimates/[code]/export/page.tsx:23`) | NFR-002, CR-33; coding standards section 1 (clarity of intent) | The comment says `authorizePage` answers an Engineer "with SCR-26 and HTTP 403 **before anything is read**". On the whole response that is not literally true: the `(portal)` layout's bell COUNT runs in parallel on the same response (section 2, 3b). `page-access.ts:18-19` words it correctly ("before the page reads anything"). | The wording has now been quoted as AC-8's own words (QLT-03) and used as the test of a G8 blocker. A reader who takes it literally will either miss the frame read or call a designed read a defect. No runtime effect. | Align the two comments with `page-access.ts:19`: `... answers an Engineer with SCR-26 and HTTP 403 before the page reads anything (CR-33); the portal frame's own reads (the session and the viewer's bell count) do not depend on the address.` Caught by: none needed (comment only). Lane: hardening window, with any later touch of the file; it is not worth a PR on its own. |
| QLT-02 | Info | `src/app/(portal)/layout.tsx:42` (`task-repository.ts:437-442`) | AC-8 / NFR-002 / CR-33; architecture `:2168`, STORY-04.03 AC-2 | The frame's overdue COUNT runs on the SCR-26 403 card, not ordered against the page's role check. It is scoped to the viewer, URL-independent, returns one integer and touches no cost, node, rate or master data. It joins to the viewer's own tasks' estimates for `status`/`ignored_at`, which the Engineer may see on their own queue. | None for confidentiality: nothing about the requested estimate is read, and the answer cannot differ by address. It adds one indexed COUNT to every portal page's time, 403 included (a timing note for reviewer-performance, not a finding here). | None required; designed behaviour (the bell is on every Engineer screen, SCR-26 included). If master wants the 403 card to read only the session, the change is to render the bell count in a client island or skip it on system pages. That is a product and UX decision and outside this review. |
| QLT-03 | Info | Jira AQP-320 AC-8; `docs/07-qa/defects/DEF-069-…md` "Story / AC" row; `tests/e2e/cost-details.spec.ts:286` | AC-8 traceability | AC-8 as written in Jira reads: "No button anywhere; the route is 403 with the fixed body; a node of another estimate is 404; canary scan green". The words "before anything is read" are not in it. They come from the E2E test title (`:286`), the page comment (QLT-01) and the DEF-069 file's quotation of AC-8. The architecture's control is "before any lookup" (`architecture.md:963, :976, :983`). | The test DL-327 (6)(b) and DL-329 apply is stricter than the AC. That is legitimate as a ruling, but the DEF-069 file should not present it as the AC's own words. | QA: in the DEF-069 file, quote AQP-320 AC-8 verbatim and cite architecture `:963`/`:976` for "before any lookup". Issue for qa-engineer. |
| QLT-04 | Info | developer's note (iii); `src/server/composition.ts:98-105` | Note accuracy | The note says `loadAppEnv()` runs "once per request here (composition.ts:98-100 via `getUserRepository`)". In fact `getUserRepository` calls `runtimeClient()` (and so `loadAppEnv()`) only when `userRepository` is undefined (`:103`, `??=`), and `getAuthOptions` builds once (`:531-543`). So it runs once per module instance, not per request. | None on the outcome. It removes a per-request zod parse from the list of things that might cost time on the refusal path. | Note only; no change. |
| QLT-05 | Info | `src/server/repositories/prisma-client.ts:41-50` | DL-329 (5) | The `app` pool has `max: 10` and `connectionTimeoutMillis: 5 s`. A refusal still needs one pooled connection for the session `SELECT`. A wait for that connection is bounded: past 5 s the read fails and the answer is an error, not a 403. Every slow reading was a 403, so any wait was under 5 s. | A pointer for the developer's cause statement under DL-329 (5), not a finding against the order of checks. The note's "does not settle" list already covers it ("pool acquisition"). | None here; cross-reference to reviewer-performance and the DL-329 (5) probe. |
| QLT-06 | Info (good practice) | `tests/unit/http-with-route.test.ts:122-137`; `tests/unit/http-page-access.test.ts:48-54`; `tests/unit/cost-details-service.test.ts:166-211`; `tests/e2e/cost-details.spec.ts:295-313` | AC-8, CR-33 | The order is pinned by tests. An unlisted role gets 403 with the params refinement and the handler never called. `authorizePage` calls `forbidden()` for an unlisted role. The service refuses an Engineer and an unknown role before any read. The E2E case checks the 403 body for cost words, the page's 403 with no stages, and a foreign Engineer's 403. | A regression in the order of checks would fail CI's unit stage before E2E. | Keep. |

## Reviewer-specific tables

**AC conformance (AC-8 only; the scope of DL-329):**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-8: no "View cost details" for an Engineer | estimate page (not in scope of this review) | `cost-details.spec.ts:293` | Not reviewed (out of scope) |
| AC-8: route is 403 with the fixed body | `route-manifest.ts:329`; `with-route.ts:217-222, :259-266`; `problem.ts:151-153` | `http-with-route.test.ts:122-137`; `cost-details.spec.ts:295-298, :312-313` | **Met**; role refused before any lookup |
| AC-8: page is no access (403) | `route-manifest.ts:330`; `page-access.ts:22-29`; `page.tsx:32`; `forbidden.tsx` | `http-page-access.test.ts:48-54`; `cost-details.spec.ts:300-305, :310-311` | **Met**; page reads nothing before `forbidden()`; frame bell count per QLT-02 |
| AC-8: second guard in the service | `cost-details-service.ts:79-87` | `cost-details-service.test.ts:166-211` | **Met** |
| AC-8: node of another estimate is 404 | `cost-details-service.ts:70-73, :90` | `cost-details-service.test.ts:166+` | Not re-reviewed (Lead path, not the refusal) |

## 4. Outcome under DL-329 (4)

**C1.**

- **Order correct.** Route: session read, then the role check, with nothing else in between (section 1, steps 6 to 9). Page: `authorizePage` is the first statement, with the session read and then the role check (section 2, 3c).
- **Nothing but the session read before the refusal, in code order.** True for the route without qualification. For the page, it is true of everything the page and its access check do. The frame's bell COUNT runs in parallel on the same response (QLT-02).
- **Nothing read on the refusal path in DL-329's sense.** No estimate, node, cost or master data is read, computed or logged on either path (section 3). The bell COUNT returns one integer about the viewer's own tasks, and its estimate join only filters on status. It reads nothing about the requested estimate, and its result does not depend on the URL.
- **No Blocker or Critical.** No Major either.
- **The trigger reading was the route.** DL-327 (6)(b) was met by the route's `fetch` (5,472 ms and 5,104 ms), and the route has no layout. QLT-02 has no bearing on the route's outcome.

**If master reads C2 literally.** If master counts any concurrent read on the same response as "anything except the session read", the page alone would be C2: a read runs alongside the role check, but no data is read. It would not be C3, and the route would still be C1. I do not recommend that reading, for three reasons. The count is the designed portal frame, present on every Engineer screen (architecture `:2168`). It is unrelated to the requested resource. And it is the same on every refusal of every route in the portal, so a C2 here would be a C2 for every page 403 in the product, not a DEF-069 finding. Master rules.

## 5. Opinion (marked as opinion): does the layout's overdue COUNT on the 403 card break AC-8's "before anything is read"?

*Opinion, not a ruling.* No. First, AC-8 as written in Jira does not contain those words (QLT-03). The controlling design text is CR-33's "before any lookup" (architecture `:963, :976, :983`), and the stated purpose is that the answer "cannot depend on what the page holds" (`page-access.ts:18-19`) and is "the same 403 for a real ID and an invented one" (architecture `:983`). The bell COUNT meets both: it looks up nothing named by the request, and its result is the same for every address. Second, on a literal reading the phrase would forbid the session read too, which reads `users` on every request by design. So the phrase already means "nothing about the requested resource", and the count fits that meaning. Third, the count is required on SCR-26 by design (architecture `:2168`, STORY-04.03 AC-2). Removing it would change a UX decision, not fix a fault. The honest correction is to the wording (QLT-01, QLT-03), not to the code.

## Previous Findings (re-review only)
n/a (round 1).

## Issues for other roles
- **qa-engineer:** QLT-03 (quote AC-8 verbatim in the DEF-069 file). Under C1, DL-329 (4) has QA return DEF-069 to Sev-3, type Test, once master has read this report.
- **developer:** QLT-04 (a correction to the note); QLT-05 (a pointer for the DL-329 (5) cause statement); QLT-01 in the hardening window.
- **orchestrator:** `master` push run 45125449394 (06d5d56a) is red on Stage 12 shard 2, `estimate-review.spec.ts:210` [tablet] on both attempts, which is outside this review's scope.
