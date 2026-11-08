# Test Report — AQP-57 (STORY-01.03): Engineer sees no cost: projection and scan

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `64a16780dde9e30609fe350d39c63115b8bda53d` on `feat/AQP-57-engineer-projection-scan` (PR #115, `sankumar76/Accucut-Quotation`), checked out detached from `origin/feat/AQP-57-engineer-projection-scan` in two scratchpad worktrees: a clean one for every "clean head" result and a second one for the planted faults. The head did not move during the run (checked again before the push). Labels on the PR: `gate:g6-pass`, three `review:*-approved` |
| CI | Run 42484736523 on `64a1678` (first attempt, event `pull_request`): success on all four jobs. Required path 5:34 (13:23:32 to 13:29:06), under the 6:00 early warning (RISK-023). Stage 12 shard 1 ran 237 tests (235 passed, 2 skipped), shard 2 ran 236 (217 passed, 19 skipped); 0 flaky |
| Environment | Windows 11; Node v24.19.0 (CI uses Node 22); Next.js 16.4.3 production build; Vitest 5.0.5; Playwright 1.64.1 with Chromium at 360x800, 768x1024 and 1366x768; PostgreSQL 17 as a throwaway container `aqp57-qa-db` on host port 55457 with invented credentials, removed afterwards. No `.env*` file and no workbook was opened |
| Date | 2026-11-08 |
| **Recommendation** | **ACCEPT.** All 8 ACs pass with evidence on the final head. No product defect. Two test or environment defects filed, both pre-existing and not caused by this story: DEF-018 (Sev-3) and DEF-019 (Sev-4). Open by severity: Sev-1 0, Sev-2 0, Sev-3 1, Sev-4 1. Neither holds G7. AQP-57 stays In QA until master's G7 decision is posted (DL-098) |

## Summary

Every AC holds on the production build, with a real database and a real browser at the three widths. The scan finds nothing in what an Engineer is sent today, and it finds a leak everywhere I planted one. I planted a sentinel on each of the six surfaces the story names (HTML, RSC payload, JSON, response header, JS chunk, and a body the browser itself fetches) in product code of a scratchpad worktree, rebuilt, and the scan reported each one by place and value at all three widths. I also planted faults of every other class, one at a time (forbidden imports, a non-strict schema, a new route, a route with no role check, a dynamic route with no recipe, twelve ways to quarantine the scan, a run-time `NODE_ENV` read, two builder mutations). Each one made a named test or check fail, except one probe that no static gate can see (G12 below). Nothing planted was committed.

Because the developer's scan iterates the manifest, I also ran an independent pass (test plan 11.2) that builds its route list from the file system and the build output, follows every link and presses every button as an Engineer, and looks for transformed values (rounded, regrouped, in words, converted, summed). It found nothing, it fires on every transformed form of a planted value, and when I added two routes that the manifest does not list, it found both.

The full regression has one local failure that is not about this story (DEF-018, a load-sensitive Windows timeout; it passes alone) and four tablet-width Users and Audit E2E problems caused by 198 disposable users that had piled up in my long-lived throwaway database (DEF-019; 67 of 67 pass once the users are cleared). CI is green on the same head.

## AC Verification Matrix

Test IDs are the titles beginning `AC-n` in `tests/e2e/canary-scan.spec.ts` (6 tests, run at 3 widths), the Vitest files named, and my planted faults (P-, S-, C-, D-, G-, V- codes in the tables below). "Technique": EP equivalence partitioning, BVA boundary values, DT decision table, EG error guessing, MUT planted-fault (mutation) testing.

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 import rule, `server-only` | `engineer-import-rule.test.ts` (554), `server-only-build.test.ts` (2), `formula/server-only.test.ts` (24); D1, D2, D3 | EP, MUT | Pass | ESLint fires on the exact paths: an Engineer view and an Engineer page importing `master-repository`, `calculation-repository`, `approval-repository`, `@/server/composition`, `@/lib/formula`, and `import('@/lib/formula')` gave 8 errors in 2 files (D1, D2). A client component importing `@/lib/formula` made `next build` exit 1 with "importing a module that depends on server-only" and 26 errors (D3). All 13 modules of `src/lib/formula` start with `import 'server-only'` (checked file by file). `next build` runs no ESLint (QLT-13), so the lint gate is CI stage 4 |
| AC-2 strict schema, one schema per route | `strict-schema.test.ts` (8); S-AC2 | EP, MUT | Pass | The only Engineer-reachable API route, `/api/v1/me`, answers through `meResponseSchema` (`z.strictObject`). With the schema made non-strict, 3 tests failed, including "a handler that returns a key the schema does not name gets 500 with a generic body, and the key does not leave". A mandatory field added to the schema and the view broke the type-check of `strict-schema.test.ts` inside `next build` (a third layer) |
| AC-3 scan finds 0, all surfaces | `canary-scan.spec.ts` "AC-3: an Engineer is sent no Restricted value..." x3 widths; `scanner.test.ts` (35), `canary-masters.test.ts` (15), `formula-display.test.ts` (36); P1 to P6 | EP, BVA, MUT | Pass | Clean head: 21 of 21 passed at 360/768/1366 in 1.3 min locally (the Engineer scan test took 3.2 to 4.4 s per width; 2.2 to 2.6 s in CI); in CI 18 scan tests passed, 0 skipped. Every non-vacuity count is met with read bodies (QLT-04, QLT-16). Planted: all six surfaces reported (table below) |
| AC-4 negative control | `canary-scan.spec.ts` "AC-4" x4 per width; `scanner.test.ts` "the negative control" (6); `production-routes.test.ts` (18); V1 to V3 | EP, MUT | Pass, on master's accepted reading | See "AC-4 on master's accepted reading" |
| AC-5 403, fixed body, no-store | `canary-scan.spec.ts` "AC-5" x3; `engineer-refused-before-lookup.test.ts` (28); `role-matrix.test.ts` (134); QA-AC5; C2 | DT, EG, MUT | Pass | See "AC-5 in detail". Every Lead and Admin route called as an Engineer is the same 403 `application/problem+json` body (apart from `requestId`), for a real ID, an invented one, a valid body and an invalid one; `private, no-store` on every authenticated response |
| AC-6 later stories covered, template rule | `route-recipes.test.ts` (7); both template lines; C1, C2, C3 | EP, MUT | Pass | Both template lines are character for character the text of master's rulings 1a and 1b, one insertion each and no deletion. A new manifest route is scanned with no change to the scanner or the spec. See "AC-6 in detail" |
| AC-7 canary estimate builder | `canary-estimate-builder.test.ts` (7); A1, A2 | BVA, MUT | Pass | The shipped inputs give 0 collisions through the real formula engine and the canary masters. Two QA mutations are caught (typing an output's value into another input; only Plating Cost set). The 7 developer tests include "an estimate with only Machining Cost set makes the process total equal it, and the rule says so" |
| AC-8 scan in CI, never quarantined | `canary-scan-gate.test.ts` (16); G1 to G12; CI log | DT, MUT | Pass | Stage 12 ran the scan at 3 widths in CI (12 + 6 tests, 0 skipped). `master` requires the check `Stages 1 to 11`, which needs the E2E job. 11 of 12 quarantine attempts fail a named gate test; the twelfth is a probe no static gate can see (see "AC-8 in detail") |

## AC-4 on master's accepted reading

Master accepted the reading in gate-log ruling 4 (attempt 1) on three things, on condition that STD-02 and QLT-04 are met. Both are met (reviewers, round 2) and I re-checked each:

| Part of the reading | What I did | Result |
|---------------------|-----------|--------|
| The in-process route is on only under `NODE_ENV=test` | `scanner.test.ts` "the negative control: a route that leaks one sentinel..." (6 tests: runs under NODE_ENV=test and returns the sentinel; answers 404 with no body when no sentinel is supplied or `NODE_ENV` is not `test`) all pass under Vitest, which sets `NODE_ENV=test` | Pass |
| The production build answers 404 with the sentinel supplied | CI/local scan test "AC-4: the test-only route ... is absent from the production build, even when the sentinel is supplied" passes at 3 widths (404, empty body, no sentinel in any header). My own probe (V1): the clean production build started with `NODE_ENV=test` **and** `CANARY_NEGATIVE_CONTROL=9393.37` answers `GET /api/test-only/leak` with 404 and an empty body | Pass |
| The STD-02 pin shows the gate is a constant in the build | Clean build: `npx tsx scripts/check-production-routes.ts` prints "Production route check passed." V2: I planted a run-time read (`const { NODE_ENV } = process.env;`) in `src/lib/negative-control-gate.ts`. `next build` still **exits 0**, so nothing else catches it, and the pin **exits 1** naming `.next\server\chunks\_1umu60a12fs9l._.js`. V3: that planted build, started with `NODE_ENV=test` and the sentinel, answers `GET /api/test-only/leak` with **200 `{"leaked":"9393.37"}`**; started the normal way it answers 404. That is the exact hazard the pin exists for, and it only appears if a test variable reaches a production start | Pass |
| Live negative controls through the same pipeline as the Engineer scan (QLT-04) | "AC-3, AC-4 (control with real data)" finds all three Process Master canary rates and the canary name in what the Admin is sent; "AC-4 (negative control)" plants a sentinel in a header and an RSC payload (found in each place), and a rate name in a script chunk and a sentinel in a response the browser fetches (found by `scanAsEngineer` itself). All pass at 3 widths. P1 to P6 below are my own controls, planted in product code instead of in the network | Pass |

The stated reason "`next start` forces production" is wrong (STD-02, QLT-11, ruling 4); the code, comments and PR now give the right one (the bundler replaces the dot-access `process.env.NODE_ENV` at build time), and V3 shows that the reason is the true one.

## Negative controls: a planted leak on each surface (P1 to P6)

One sentinel per surface, each a different Restricted kind, planted in product code of the planted-fault worktree (`src/app/(portal)/queue/page.tsx`, a new client component, a new route, `src/server/views/engineer-me.ts` with its schema, `src/proxy.ts`), `npx next build` (exit 0), then `npx playwright test canary-scan` at mobile, tablet and desktop. Result: the AC-3 and AC-5 tests failed at all three widths (6 failed, 15 passed, the one retry failed the same way) and named every plant:

| # | Surface | Plant | What the scan reported (label, value, place) |
|---|---------|-------|----------------------------------------------|
| P1 | HTML | `<p>Rate card 881.37</p>` in the queue page (customer rate) | `GET /queue (page)`: Customer rate 1 (plain digits) "881.37" in the body |
| P2 | RSC payload | a prop `rate="882.37"` passed to a client component that renders nothing (customer rate) | `GET /queue (RSC)`: "882.37" in the body (fetched with `RSC: 1`), and in `GET /queue (page)` "in the decoded RSC payload" |
| P3 | JSON | `qaRate: '838.37'` added to `meResponseSchema` (optional) and to `buildMe` (exchange rate) | `GET /api/v1/me (API)`: Exchange rate 1 (plain digits) "838.37" in the body |
| P4 | Header | `X-Qa-Plant: Rs 9,17,373.37` on every authenticated response (material price, **Indian grouping** of 917373.37) | `GET /queue (document)`, `GET /api/v1/me (API)` and every other authenticated response: Material price 1 (Indian grouping) "9,17,373.37" in the headers |
| P5 | JS chunk | `Reflect.set(window, '__qa_chunk', '737.37')` in a client bundle (specific gravity) | `GET /_next/static/chunks/1iik9c3zj97ag.js (referenced file)`: Specific gravity 1 "737.37" in the body |
| P6 | Body fetched by the browser | the client component calls `fetch('/api/qa-plant')` and the route returns `{"v":"717.37"}` (scrap rate); the route is in no manifest row | `GET /api/qa-plant (fetch, intercepted)`: Material scrap rate 1 "717.37" in the body |

My first try at P3 used `883.37`. The scan did not report it, correctly: it is in no list of `canaryMasters`, and the scan finds only the values it knows. I changed it to the exchange-rate sentinel and it was reported. This is the residual limit of ARCH-R2 that the story names, and it is why AC-6's rule (every new Restricted value goes into `canaryMasters` in the same change) matters; see OBS-1.

Fuller coverage of the detector itself: `scanner.test.ts` (35 tests) plants a leak in HTML, JSON, a header and a `Set-Cookie`, the URL, an RSC payload fetched with `RSC: 1`, one split across two pushes, a chunk (as a number and as a rate name), a formula marker and an operand name, and every sentinel of `canaryMasters` in every form.

## AC-5 in detail

| Check | Evidence |
|-------|----------|
| All Lead and Admin routes of the manifest, called as an Engineer, return 403 with the fixed body | Developer test, 3 widths in CI and locally: 9 method-calls on 6 API routes (`/api/v1/audit`, `/process-items`, `/process-items/[id]`, `/users`, `/users/[id]`, `/users/[id]/password-reset`) plus 3 pages (`/users`, `/audit`, `/masters/process`: HTTP 403 and the "You do not have access to this page" card). Each answer is `application/problem+json`, `{type: "about:blank", title: "You do not have access to this.", status: 403, code: "FORBIDDEN", requestId}`, and `Cache-Control: private, no-store` |
| Same answer for a real and an invented ID | Developer test calls each dynamic route with a real ID and `00000000-0000-4000-8000-0000000000fe` and compares the bodies with the request ID masked. My QA-AC5 (route list from the file system, not the manifest) called the same 6 routes with four IDs (the Engineer's own, a seed rate ID that exists, an invented UUID, `invented-id`) and three body kinds (valid, `{}`, not JSON): **49 calls, all 403, all `application/problem+json`, all `private, no-store`, one single body once the request ID is masked, five keys exactly (`code, requestId, status, title, type`)**, at 3 widths. A state-changing call carried the portal's own `Origin`, so the CSRF check (which runs before the role check) did not mask what is being tested |
| The role check runs before validation and lookup | The same 49 calls: an invalid body and a valid body to `POST /api/v1/users` and `/api/v1/process-items` give the same 403, never a 422 or a 404. `engineer-refused-before-lookup.test.ts` (28) asserts that no repository is called before the 403 |
| `private, no-store` on every authenticated response seen by the scan | The AC-3 and AC-5 tests assert it on every response that carried the session, with `/_next/static/**` and the files of `public/` exempt (accepted by master at attempt 2: static, the same for every viewer, no session data). My QA-JOURNEY asserted it on 77 to 80 responses per width: 0 exceptions |
| A route that forgets the role check is caught | C2: a route listed for Lead and Admin in the manifest whose handler is a plain function returns 200. The live scan fails: `GET /api/qa-plant (API): status 200, not 403`. At Vitest level `manifest-completeness.test.ts` fails first: "GET is not declared with withRoute" |
| Signed out | 401 with a problem body (role matrix, 134 tests, and the navigation spec) |

## AC-6 in detail

1. **Both template lines.** `.github/pull_request_template.md` line 45 and `docs/templates/story.md` line 50 equal rulings 1a and 1b of the G6 attempt-1 record character for character (compared by script: 1 match each, 311 and 482 characters after removing the log's backslash escapes). `git diff origin/master...HEAD` for the two files: 2 insertions, 0 deletions.
2. **A new Engineer route is covered with no change to the scanner (C1).** I added a manifest row `GET /api/v1/qa-new` (all roles) and a route file through `withRoute` with a strict schema returning the exchange-rate sentinel `839.73`, and touched nothing else. The live scan failed at once and named it: `GET /api/v1/qa-new (API): Exchange rate 2 (plain digits) found as "839.73" in the body`. The in-process tests fail first with "no loader for /api/v1/qa-new" (a deliberate prompt to add the route's recipe and loader) and `role-matrix.test.ts` fails until the SPEC table has the row.
3. **A route that is not in the manifest cannot be built through `withRoute`.** A route file that calls `withRoute` for a path with no manifest row made `next build` fail: "withRoute: GET /api/v1/qa-new is not in the route manifest". A plain handler with no row is caught by `manifest-completeness.test.ts` (Vitest, CI stage 11) and by my independent pass (below).
4. **A dynamic route with no real-value recipe is named (C3).** With `GET /api/v1/qa-dyn/[id]` and the page `/qa-page/[code]` added to the manifest, `route-recipes.test.ts` fails 3 tests and prints: "add a real-value recipe for /api/v1/qa-dyn/[id] to tests/support/route-calls.ts (AC-6)" and the same for the page.
5. **`canaryMasters` single-sourced.** `tests/support/process-master-canary.ts` is the one definition of the Process Master canary values (`771.37`, `772.37`, `773.37`, name `Canary-Process-Rate-per-Mark`); `canaryMasters` imports it. `tests/security/process-master-confidential.test.ts` is gone, so **AQP-113 AC-6 is met** by this PR (its checks run for every manifest route and in the live scan; the real-data control finds all three rates). Master's reading of QLT-14 stands.

## AC-7 and AC-8 in detail

**AC-7.** `canary-estimate-builder.test.ts` (7 tests) runs the seed registry's formulas through the real engine with the canary masters and finds 0 outputs equal to a typed value; it has no zero and no repeated number among the typed inputs. My probe (A1, A2) copied its set-up and mutated the builder: (A1) typing the value of `total-process-cost` into `tool-cost` is reported as a collision; (A2) an estimate with only `plating-cost` set (the AC-7 example, on a field other than Machining) is reported. The shipped inputs raise none. All 4 probe tests and the 7 developer tests passed (11 of 11).

**AC-8.** Wiring: `ci.yml` stage 12 runs `npx playwright test --shard=...` with no path, `--grep` or `--project`; the `required` job (`Stages 1 to 11`) has `needs: [verify, e2e]`; `master` protection requires exactly that check, strict, with admins enforced. CI run 42484736523: the scan ran as 12 tests in shard 1 (mobile, tablet) and 6 in shard 2 (desktop), all passed, none skipped, no retry. Quarantine attempts, each applied to the worktree and run against `tests/unit/canary-scan-gate.test.ts` (the test CI stage 11 runs), then reverted:

| # | Attempt | Result |
|---|---------|--------|
| G1 | `test.skip` on the AC-3 scan test | fails 2 gate tests (no skip/fixme/...; no early exit and every test asserts) |
| G2 | `test.fixme` on the AC-5 test | fails "has no skip, fixme, fail, slow, only or todo..." |
| G3 | `it.skip` in `tests/security/role-matrix.test.ts` | fails the same test (role matrix is never quarantined) |
| G4 | `--project=desktop` added to the stage 12 command | fails "stage 12 runs the whole suite: no path, no --grep and no --project" |
| G5 | `--grep-invert canary` added to the stage 12 command | fails the same test |
| G6 | `if (process.env.CI) return;` at the top of the AC-3 test (F14) | fails "the scan spec has no early exit..." |
| G7 | the same line at the top of `expectScanSawEnough` (N12) | fails "the scan helper function expectScanSawEnough has no early exit..." |
| G8 | the same idea in `fetchReferencedFiles` | fails the matching helper test |
| G9 | `testIgnore` of the scan spec in the mobile project | fails "the Playwright configuration does not ignore the scan..." |
| G10 | the AC-3 test tagged `@one-width` (desktop only) | fails "runs every one of them in the mobile, tablet and desktop projects" |
| G11 | `retries: 3` in `playwright.config.ts` (DL-057) | fails the same configuration test |
| G12 | one `expect` removed from a scan test that has several | **not caught**: the gate rejects a test with no assertion, not a weakened one (OBS-2) |

I did not run a quarantine on a throwaway pull request: that would put a planted fault into a commit on the remote, and the gate test is the same code CI runs in stage 11. If master wants the real red check shown, it needs a throwaway PR (DL-091, DL-105).

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| Lint | `npx eslint . --max-warnings=0` | | exit 0, no output | 0 | | 25 s |
| Type-check | `npx tsc --noEmit` | | exit 0 | 0 | | |
| Build | `npx next build` (clean head) | | exit 0, 17 routes | | | 39 s |
| Stage 9 pin | `npx tsx scripts/check-production-routes.ts` | | "Production route check passed." | | | |
| Story set | `npx vitest run tests/security tests/unit/canary-scan-gate.test.ts tests/unit/production-routes.test.ts tests/unit/formula/server-only.test.ts tests/integration/formula/server-only-build.test.ts tests/unit/http-route-manifest.test.ts` | 953 | 953 | 0 | 0 | |
| Full Vitest (regression) | `npx vitest run` | 4,280 | 4,255 | **1 suite**: `playwright-system-deps.test.ts`, hook timeout 120 s (DEF-018; alone: 25 of 25 in 42.7 s) | 25 (that suite) | 198 s, 177 files, 176 passed |
| Scan, clean head, 3 widths | `npx playwright test canary-scan --workers=2` | 21 (18 scan + 3 set-up) | 21 | 0 | 0 | 79 s |
| Full E2E (regression), 3 widths | `npx playwright test --workers=2` (CI mode, 1 retry as configured) | 470 | 445 | 2 failed, 2 flaky (all Users or Audit at tablet; DEF-019) | 21 | 26.4 min |
| Re-run after clearing 193 disposable users | `npx playwright test users.spec.ts audit.spec.ts --workers=2 --retries=0` | 67 (incl. 3 set-up) | 67 | 0 | 0 | 4.0 min |
| QA independent pass | `npx playwright test qa-independent --workers=1 --retries=0` | 21 (18 + 3 set-up) | 21 | 0 | 0 | 2.2 min |
| QA response-size check | `... --grep QA-C1` | 6 (3 + 3 set-up) | 6 | 0 | 0 | 47 s |
| QA AC-7 probe | `npx vitest run tests/security/qa-ac7-probe.test.ts tests/security/canary-estimate-builder.test.ts` | 11 | 11 | 0 | 0 | |
| CI (reference) | run 42484736523 | 4 jobs | 4 | 0 | | 5:34 required path |

The scan in the full E2E run: all 18 scan tests passed, none flaky. No timeout was raised and no retry added (DL-057). The only retries are the configured one.

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Cost confidentiality | NFR-002, SPEC 14.1 | The scan, 6 planted surfaces, the independent pass, transformed values | Pass: 0 found; every planted leak found |
| Authorisation | NFR-001, BR-004 | 49 calls to the Lead and Admin API routes as an Engineer; 3 refused pages; IDOR by real versus invented ID | Pass: one 403, no data, role check first |
| Cache headers | ADR-008 layer 4 | `private, no-store` on all authenticated responses (77 to 80 per width) | Pass: 0 exceptions |
| Error leakage | CR-33 | Refused pages and two unknown addresses opened as an Engineer: 403 card and 404 card, no value in any; the two unknown addresses give one title | Pass |
| Source maps | NFR-002 | `.next/static` holds no `.map` file; a request for `<chunk>.js.map` is 404 | Pass |
| Size does not depend on the rates (charter C1) | NFR-002 | Engineer `GET /queue`, `/`, `/api/v1/me` measured 3 times, then every stored rate raised by 77,777.3737, measured again, rates restored | Pass: byte-identical at all 3 widths (queue 31,135 B, `/` 29,228 B, `/api/v1/me` 236 B at mobile and tablet; +4 B at desktop from the width of the test person's e-mail, the same before and after) |
| Performance | NFR-009 | CI required path from the run log: 5:34. Reviewers measured the strict parse at 4.9 us and stage 11b unchanged (173,446 B worst route). I did not re-measure | Pass (not re-measured); RISK-023 stays at 6 |
| Accessibility | NFR-016 | The story adds no screen (UX n/a, stated in the story). The existing E2E suite, which includes axe on the shell at 3 widths, ran in full | n/a for this story; see DEF-019 for the only E2E problem |

## Independent pass (test plan 11.2)

`qa-independent.spec.ts` lives in my scratchpad and is not committed. It imports nothing from `tests/support/scanner.ts` or `tests/e2e/support/canary-scan.ts`.

1. **Route list from the file system and the build.** QA-INV compares the routes found under `src/app` (`route.ts`, `page.tsx`), the routes in `.next/server/app-paths-manifest.json`, and the manifest's implemented rows: identical, 16 routes (7 pages, 9 route handlers). Negative control (planted-fault worktree with two extra route files and no manifest rows): QA-INV fails on the manifest comparison and names `/api/qa-plant` and `/api/v1/qa-new`.
2. **Through the UI, every link and every button.** Signed in through the sign-in page as a fresh Engineer, the pass opens `/queue` and `/` (the only pages an Engineer's menu leads to), presses up to 6 visible buttons per page (the account trigger and the menu), then asks every file-system route directly. 77 to 80 responses per width, with the body of each page and script read. Nothing found.
3. **Transformed values.** The detector looks for each sentinel as plain digits, 2 decimals, Indian and western grouping; rounded to a whole rupee and to one decimal; whole rupees in both groupings; converted at the exchange-rate sentinel; the sum and the ratio of every pair of sentinels; and the integer part in English words on the western and Indian scales. A derived number with fewer than five significant digits is dropped as not distinctive, and a short number must stand alone (not inside a longer number or a word). Self-test (QA-DET): fires on 9 planted forms, including a value only inside the flight payload; does not fire on `18819` or on `var a=881;` in a script. **Positive control (QA-POSITIVE):** the same detector, pointed at the Admin's `/masters/process` and `/api/v1/process-items`, finds all three canary rates, so a clean Engineer run means something.
4. **Routes the manifest does not list.** With the two stray routes, QA-AC5 failed: `GET /api/qa-plant body=none: 200` and `GET /api/v1/qa-new body=none: 200`. The developer's live scan iterates the manifest and cannot see such a route; `manifest-completeness.test.ts` (stage 11) does, and so does this pass. The two layers agree.

My first runs of this pass failed on my own mistakes (a framework route `/_global-error`, a count of 7 where the manifest has 6 refused API routes, a ratio of `0.0001` that matched a chunk, `content-length: 601` matching a short needle, and an unbounded wait on a response body). I fixed the pass, not the product, and the clean results above are from the final version. Reading bodies after the page has moved on is why the developer's scan records by interception (QLT-03); my pass is a supplement, not a replacement.

## Exploratory Testing

**Charter C1** (test plan 16): "Find a way for an Engineer to learn a cost". Time-box 90 minutes; the session was not timed separately from the other work, and the ideas below are what it covered.

| Idea | Tried | Observation |
|------|-------|-------------|
| Transformed values | yes, 12 forms (above) | none |
| Error pages, 403 and 404 cards | yes | no value; the three refused pages are 21,746, 21,787 and 22,396 bytes (they differ by up to 650 B between routes, not by data: OBS-4) |
| `_next/data` and RSC responses | yes (`RSC: 1` for each page; flight payload decoded) | none |
| Source maps | yes | none shipped |
| Response size differs when rates change | yes | identical |
| An Engineer using a Lead's bookmarked URL | yes (`/users`, `/audit`, `/masters/process`) | 403 card, same title |
| Redirect after sign-out; browser history and cache after sign-out | not run | no cost view exists to leak; the cache header is asserted on every response |
| Print view, copied text | not run | no print view or cost text exists |
| Warn dialog and its 409; e-mail bodies; the timing of a response | not run | the Warn path, e-mails and calculations do not exist yet |

Findings: no leak. Four observations (OBS-1 to OBS-4 below).

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-018 ([AQP-225](https://sankumar76.atlassian.net/browse/AQP-225), [#117](https://github.com/sankumar76/Accucut-Quotation/issues/117)) | `playwright-system-deps.test.ts` hook times out at 120 s in the full Vitest run on Windows; passes alone in 43 s | Sev-3 Moderate (Test, load-sensitive; pre-existing, also red on `master` in the developer's baseline) | New | Regression only |
| DEF-019 ([AQP-226](https://sankumar76.atlassian.net/browse/AQP-226), [#118](https://github.com/sankumar76/Accucut-Quotation/issues/118)) | Users and Audit E2E specs time out at tablet width once a long-lived local database holds about 200 disposable E2E users | Sev-4 Minor (Test / Environment; CI unaffected) | New | Regression only |

No product defect. Neither defect is caused by PR #115 and neither holds G7: CI is green on the same head, and both tests pass in a clean setting. Records: `docs/07-qa/defects/DEF-018-system-deps-test-hook-times-out-in-full-run.md` and `DEF-019-users-spec-times-out-with-many-disposable-users.md`. Both Jira bugs are linked to AQP-57 ("relates to").

## Residual Risks / Notes

**Observations** (none is a defect against this story):

- **OBS-1 The scan finds only values it knows.** The scan found nothing when I planted `883.37` because that number is in no list. This is the residual of ARCH-R2 that the story states. The control is AC-6's rule and the two template lines: a story that adds a Restricted value must add its sentinel in the same change. Seven later stories carry that as an AC (CR-34). Today the Engineer-reachable surface is two pages (`/`, `/queue`) and one API route (`/api/v1/me`), so the scan proves the mechanism, not the product.
- **OBS-2 The AC-8 gate stops a test with no assertion, not a weakened assertion (G12).** Removing one `expect` from a test that has several is invisible to a static check. The reviewers' and my planted-fault tables are the control for each assertion; the pattern to keep is "every new assertion comes with a fault that fails it".
- **OBS-3 Three build-time layers beyond the scan.** A mandatory field added to an Engineer schema breaks the type-check of a test inside `next build`; `withRoute` refuses a path that is not in the manifest at build; and a run-time `NODE_ENV` read in the test-only gate builds cleanly (V2: `next build` exits 0), so it is the stage 9 pin (and the unit test of the gate's source form) that stops it. `next build` runs no ESLint (QLT-13), so a forbidden import is stopped by CI stage 4, not by the build.
- **OBS-4 A refused page echoes its route.** The three refused pages differ in size by up to 650 B. I did not diff them; the likely cause is the requested route name in the RSC payload. Nothing Restricted is in any of them. QLT-18 (open, routed by master to the first dynamic Lead or Admin page story) must compare a real and an invented ID on such a page, because that is the first place a size or word difference could show that a record exists.

**Conditions of master's record, status at G7**

- G6 round-1 condition 6 / A2-3 (scrum-master: spec path in the Jira description): done. The Jira description now lists `tests/e2e/canary-scan.spec.ts` and `npx playwright test canary-scan`.
- Open, holding nothing (master, attempt 2): the solution-architect's documents (test strategy section 6 still lacks the AC-4 reading of ruling 4 and the spec path; ADR-008 / architecture section 10 wording), #116, and the STD-13 and STD-16 wording in the governance PR.
- RISK-023: required path 5:34 on this head (under 6:00 by 26 s). It will be reached within a few stories (performance report); the three-shard trigger is with the architect in #116.

**Not done**

- No quarantine or planted fault on a throwaway PR or `workflow_dispatch` (see AC-8). Everything planted ran locally and was never committed (DL-091, DL-105).
- Performance of the strict parse and the JS budget were taken from the reviewers and CI, not re-measured.
- No real phone, screen reader or usability run: the story has no screen.
- The Jira connector and GitHub worked; nothing was unreachable.

**Issues for other roles**

| To | Issue |
|----|-------|
| developer | DEF-018 and DEF-019 (test hygiene, DEF-003 family) |
| solution-architect | OBS-2 and OBS-3 for test strategy section 10 (what the quarantine gate can and cannot see); the AC-4 reading and spec path in section 6 are still owed |
| scrum-master | QLT-18 line in the first dynamic Lead or Admin page story; OBS-4 |
| master | Decide whether the real-CI red for a quarantine (G1) is wanted on a throwaway PR; G7 decision, then Done (DL-098) |

## How to reproduce

From a clean checkout of `64a1678`, with a throwaway PostgreSQL 17 (invented credentials), `npm ci`, `npx prisma generate`, `npx prisma migrate deploy`, `node --conditions=react-server --import tsx scripts/ensure-seed-version.ts`:

```
npx eslint . --max-warnings=0 && npx tsc --noEmit
npx next build && npx tsx scripts/check-production-routes.ts
npx vitest run tests/security tests/unit/canary-scan-gate.test.ts tests/unit/production-routes.test.ts
CI=true npx playwright test canary-scan --workers=2
```

Planted faults need a worktree you can throw away; `git checkout -- <files>` reverts the tracked ones.
