# Review Report — AQP-57 (STORY-01.03) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master (e466c3b)...feat/AQP-57-engineer-projection-scan` (PR #115) |
| Commit reviewed | ff9d9a3 |
| Date | 2026-11-08 |
| **Verdict** | **REQUEST CHANGES** (1 Critical, 3 Major) |

## Summary
The five-layer design of ADR-008 is built with care. Routes expose their one response schema, the strict-schema walker and planted-key test can fail, the role check comes first in `withRoute`, the loops throw when empty, and the scan is held in the list at three widths. I planted 14 faults in a scratch worktree. Twelve were caught; two got through (F10, F14). AC-1, AC-2, AC-4 (with one gap), AC-5, AC-7 and AC-8 are met.

The scan is weakest exactly where the story makes its long-term promise (AC-3, AC-6):
- Dynamic Engineer routes and pages would be "scanned" on their 404 or "no access" answer.
- Bodies the browser itself fetches are never read.
- The check that the scan saw scripts passes even when no script body was scanned.

One clause of AC-6, the story-template checklist rule, is not in any template.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 1 |
| Major | 3 |
| Minor | 6 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Security + related unit suites | `npx vitest run tests/security tests/unit/canary-scan-gate.test.ts tests/unit/http-route-manifest.test.ts tests/unit/engineer-me.test.ts` | 15 files, 658 tests passed |
| Unit + security | `npx vitest run tests/unit tests/security` | 140 files, 3,093 tests passed |
| CI evidence | `gh run view 42463553178 --log` | All 4 jobs success; the 5 scan tests passed at mobile, tablet and desktop (shard 1: 233 passed; shard 2: 216 passed); stage 6 statements 99.22 %, stage 11 combined 98.28 % |
| E2E scan locally | — | **Not run.** It needs the E2E database settings from `.env*`, which I may not open. I relied on the CI log above. |
| Planted faults | scratch worktree `qlt-faults` (detached at ff9d9a3), each fault reverted with `git checkout` after its run; nothing committed or pushed | 14 faults, 12 caught, 2 got through (table below) |

### Planted faults
| # | Fault | Target test | Result |
|---|-------|-------------|--------|
| F1 | `withRoute` checks the role **after** the handler | `engineer-refused-before-lookup.test.ts` | Caught (lookups counted on every refused call) |
| F2 | `withRoute` checks the role after the input is parsed, before the handler | same + `role-matrix.test.ts` | Caught by `role-matrix` only (malformed-body / `invented-id` cases), not by the new file |
| F3 | Gate enabled whenever `NODE_ENV !== 'development'` | `scanner.test.ts` | Caught (2 failed) |
| F4 | Flight decoder drops a multi-push payload | `scanner.test.ts` | Caught |
| F5 | Scanner stops reading headers | `scanner.test.ts` | Caught |
| F6 | Indian-grouping form removed from `variantsOf` | `scanner` + `canary-masters` | Caught (3 failed) |
| F7 | `meResponseSchema` turned into `z.object` (non-strict) | `strict-schema.test.ts` | Caught (3 failed) |
| F8 | `buildMe` puts a canary rate into `name` | `engineer-refused-before-lookup.test.ts` | Caught |
| F10 | `engineer-me.ts` imports `getMastersService` from `@/server/composition` | `npx eslint` | **Got through**: exit 0 (QLT-12, = STD-01) |
| F11 | `engineer-me.ts` imports `../services/masters-service` | `npx eslint` | Caught (`no-restricted-imports`) |
| F12 | `testInfo.skip(Boolean(process.env.CI))` in the AC-3 scan test | `canary-scan-gate.test.ts` | Caught |
| F13 | `grepInvert: /AC-5/` in `playwright.config.ts` | `canary-scan-gate.test.ts` | Caught (the list check) |
| F14 | `if (process.env.CI) return;` at the top of the AC-3 scan test | `canary-scan-gate.test.ts` | **Got through**: 7/7 pass (QLT-10) |
| — | `fetchReferencedFiles` fetches nothing | E2E only | Not run. By reading the code, the AC-3 guard still passes (QLT-04) |

## AC conformance
| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 | `eslint.config.mjs:72-100` (widened Engineer-view groups); `src/lib/formula/**` `server-only` (03.02) | `tests/security/engineer-import-rule.test.ts` (static and `import()`, views and manifest pages, exhaustive repository classification); `tests/integration/formula/server-only-build.test.ts` | **Met**, with the composition bypass (QLT-12 = STD-01). "Build fails" means CI stage 4, not `next build` (QLT-13) |
| AC-2 | `with-route.ts:80-83,195` (`responseSchema`); `views/schemas/index.ts` | `tests/security/strict-schema.test.ts` (walker, planted key at every object level, fail-closed 500) | **Met**; the walker has a blind spot (QLT-06) |
| AC-3 | `tests/support/canary-masters.ts`, `tests/support/scanner.ts`, `tests/e2e/support/canary-scan.ts`, `tests/e2e/canary-scan.spec.ts:65-114` | `scanner.test.ts`, `canary-masters.test.ts`, the E2E AC-3 test (CI green at 3 widths) | **Met for the routes that exist.** It is not proven able to fail for dynamic routes (QLT-02), browser fetch bodies (QLT-03) or the chunk crawler (QLT-04). Formula text is internal form only (QLT-05) |
| AC-4 | `src/app/api/test-only/leak/route.ts`, `src/lib/negative-control-gate.ts`, manifest `testOnly` row | `scanner.test.ts:137-191` (in process), E2E `:157`, `:175`, `:216` | **Met under the developer's reading, which I accept (QLT-11).** Condition: the live control must drive the same pipeline as the Engineer scan (QLT-04) |
| AC-5 | `with-route.ts:156-161` (role before params/body/handler); `page-access.ts` | `engineer-refused-before-lookup.test.ts` (lookups counted; F1 caught), `role-matrix.test.ts` (F2 caught), E2E `:116-155` | **Met.** Real ID ≠ invented ID was verified for `users/[id]` (canary user) and `process-items/[id]` (Plating seed ID). The real-ID check is trivial or invented for some rows (QLT-08); `Cache-Control` exempts public rows (QLT-09) |
| AC-6 | Manifest iteration in `canary-scan.ts:186-203`, `strict-schema`, `engineer-refused-before-lookup`, `engineer-import-rule`; README §"Cost confidentiality scan" | Manifest-driven loops with `nonEmpty` | **Partially met:** (a) the story-template checklist rule is missing (QLT-01, Critical); (b) the "no change to the scanner" coverage of a future dynamic route is nominal (QLT-02) |
| AC-7 | `tests/support/canary-estimate-builder.ts` | `tests/security/canary-estimate-builder.test.ts` (real seed registry and engine, can-fail case) | **Met** as worded (exact equality); false alarms from rounding or substrings remain possible (QLT-07) |
| AC-8 | `ci.yml:366-370` (comment), stage 12 unnarrowed, stage 11 runs `tests/security` | `tests/unit/canary-scan-gate.test.ts` (markers, Playwright list, 3 widths, command shape; F12 and F13 caught) | **Met**; an early-return bypass is possible (QLT-10) |
| AQP-113 AC-6 retirement | `process-master-confidential.test.ts` deleted; `canaryMasters` imports `PROCESS_MASTER_CANARIES` | `engineer-refused-before-lookup.test.ts` + E2E | **Verified** (QLT-14): every assertion of the interim file is kept or widened |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Critical | `README.md:163` (no template line exists) | AC-6 clause 3; sprint plan cross-cutting rule 3 | "A rule in the story template checklist states this" is not done. Neither `docs/templates/story.md` nor the DoD checklist in `.github/pull_request_template.md` holds the rule; it is only in the README and the sprint plan. | A story author or reviewer working from the template is never prompted to add their Restricted values to `canaryMasters`, so the scan's depth stops growing silently (ARCH-R2) | Append one DoD line to `.github/pull_request_template.md` (append-only) and to the story template's DoD block: "Adds every new Restricted value to `tests/support/canary-masters.ts` with a loader, and every new route to the manifest (and a real-ID recipe in `route-calls.ts` for a dynamic one); the canary scan still finds 0." The owner of `docs/templates/` (master or scrum-master) makes the story-template edit; the developer can append the PR-template line |
| QLT-02 | Major | `tests/e2e/canary-scan.spec.ts:77-91` | AC-3, AC-6; test-strategy §6, §11 (100 % of Engineer-reachable routes) | Pages use `fillPath(row.path, 'invented-code')` and APIs use `validCall(call, INVENTED_ID)`; only `status < 500` is checked, and the recipe's expected `status` is thrown away (`canary-scan.ts:209-212`). The final URL is not checked either. | When `/estimates/[code]` (planned, ALL_ROLES) or an Engineer `[id]` API is implemented, the scan "covers" it with no edit, but sees only SCR-26 / a 404 and stays green. A session lost mid-test would scan the sign-in page instead of `/queue` and still pass | Assert the recipe status for every Engineer API (`expect(answer.status).toBe(recipe.status)`). For pages, require 200 and `new URL(document.url).pathname === path` for every implemented, non-hidden Engineer page, and fail with "no real-value recipe for <route>" when a dynamic segment has none. Then a later story must add a real ID, which is what AC-6 needs |
| QLT-03 | Major | `tests/e2e/support/canary-scan.ts:69`, `:154` | AC-3 "records every response" | With `readBodies = false`, the browser's own `fetch`/`xhr`/RSC-prefetch responses are kept as headers only. Only scripts and style sheets are fetched again; the scan's direct calls stand in for the rest, with canonical URLs and recipe bodies. | Today no Engineer page makes such a call with data. The later journeys (Calculate, form save, `?tab=overdue`, Link prefetch payloads) will be recorded but their bodies never scanned, so a leak in the response a real journey gets is missed | Record bodies by interception: `context.route('**/*', async (route) => { const r = await route.fetch(); record(route.request(), r, await r.text()); await route.fulfill({ response: r }); })`. The negative control already uses this pattern; it reads the body before the page sees it, so it cannot hang on an abandoned page. At minimum, re-issue GET `fetch` responses with their request headers in `fetchReferencedFiles` |
| QLT-04 | Major | `tests/e2e/canary-scan.spec.ts:105-106`, `:181`, `:198-213` | AC-3 (JS chunks), AC-4 (suite fails if a planted leak is missed) | The "not vacuous" guard counts chunk responses by URL and content type. Header-only records (`body: null`) from the listener satisfy it, so a `fetchReferencedFiles` that fetched nothing leaves AC-3 green with zero script bodies scanned. The planted-script control uses `new ScanRecorder(true)` and never calls `fetchReferencedFiles`, so no live control drives the chunk path the Engineer scan relies on. | The JS-chunk part of AC-3 can regress (a Turbopack name the regex misses, a crawl bug) with no red build. This is the one place the AC-4 negative control does not cover the real pipeline | Count `response.body !== null` in the guard (and `referenced > 0`). In the negative control, use the default `ScanRecorder()`, plant the rate name into a chunk by `context.route`, then run the same `fetchReferencedFiles(...)` and scan as AC-3. Best: move the AC-3 procedure into one `scanAsEngineer(page, recorder)` helper that both the scan and the planted control call |
| QLT-05 | Minor | `tests/support/canary-masters.ts:163` | AC-3 "formula text"; test-strategy §6 | Stored formulas are kept only when they contain `{{f:`. Any such text is already caught by the `{{f:` marker, so the "formula text" entries add no detection; formulas with only `{{rate:`/`{{mat:` are dropped. The display form (what a careless view would print) is never forbidden. | "Formula text" in AC-3 is, in effect, only the markers; a formula rendered for people (`toDisplayForm`) that uses only field names would pass | Filter on `includes('{{')` and also add `toDisplayForm(text, context)` of each stored formula (`src/lib/formula/internal-form.ts:97`), skipping one-token forms |
| QLT-06 | Minor | `tests/security/strict-schema.test.ts:85` | AC-2 | `openObjects` flags only `type: object` nodes **with** `properties`. A `z.record(...)` (no `properties`, `additionalProperties` is a schema) and `z.unknown()`/`z.any()` (`{}`) are not flagged; the planted-key test reaches them only if the sample answer holds that object | A later Engineer schema with `extras: z.record(z.string(), z.unknown()).optional()` passes the walker and lets arbitrary keys through | Flag `type: object` whenever `additionalProperties !== false` (records included), and flag empty `{}` schemas; add both to the "walker can fail" control |
| QLT-07 | Minor | `tests/support/canary-estimate-builder.ts:96` | AC-7; test-strategy §6 | Collisions are found by exact `Decimal.equals`. The scan forbids outputs in 2-decimal and grouped forms and matches **substrings**, so an output that prints the same as a typed value (1234.499 → "1234.50" against 1234.5), or whose text sits inside a typed value, still raises a false alarm | Later calculation stories may get false alarms that the builder says cannot happen | Compare `variantsOf(output)` texts with the printed forms of each typed value, both ways with `includes`; add a can-fail case |
| QLT-08 | Minor | `tests/e2e/canary-scan.spec.ts:129-140`; `tests/security/engineer-refused-before-lookup.test.ts:138-139` | AC-5 "a real and an invented ID give the same answer" | For rows without a path parameter both calls hit the same URL, so the comparison is trivial. For a future `[id]` row with no recipe, `validCallFor` returns `'invented-id'` as the "real" ID, so both IDs are invented and the check passes vacuously | The CR-33 property is not proven for a new Lead/Admin `[id]` route until someone remembers a recipe | For rows with a dynamic segment, assert `real.id !== 'invented-id'` (fail: "add a real-ID recipe for <route>"); skip the pairwise comparison for rows without one |
| QLT-09 | Minor | `tests/support/scanner.ts:126-129` | AC-5 "`Cache-Control: private, no-store` on every authenticated response seen by the scan"; ADR-008 layer 4 | Every response under a `public` row is exempt, including next-auth's `/api/auth/session`, which carries the signed-in person | An authenticated answer could be cached by a proxy with no failing check | Hold every response to a request that carried the session cookie, except `/_next/static/**`; or record the next-auth exemption as an ADR-008 note |
| QLT-10 | Minor | `tests/unit/canary-scan-gate.test.ts:30` | AC-8 "never quarantined" | F14: `if (process.env.CI) return;` at the top of a scan test passes the gate (7/7) and makes the scan vacuous in CI | A soft quarantine survives review if missed | Also reject `process.env` reads and a bare `return` before the first `expect` in `canary-scan.spec.ts`, or make each scan test end with a count the gate can see |
| QLT-11 | Info | `src/lib/negative-control-gate.ts:4-8,17`; `README.md:168-169`; `playwright.config.ts:46-48` | AC-4 ruling | **I judge the developer's reading as satisfying AC-4.** The route is on only when `NODE_ENV === 'test'`, and the E2E test shows the production build answers 404 with the sentinel supplied. A route switched on by a runtime flag inside the shipped build would be worse. The leak is found in process; the live controls (Admin real data; planted header and RSC payload) prove the recorder and the forbidden list. The remaining gap is QLT-04. The stated **reason** is wrong (= STD-02): `next start` keeps an existing `NODE_ENV` (`node_modules/next/dist/bin/next:80`). The real guard is the build-time define (`node_modules/next/dist/build/define-env.js:76`), which compiles the check to `"production" === 'test'` | No defect today; a later change made on the stated reason could be unsafe | Correct the four comments (STD-02), and ask the solution-architect to record the AC-4 reading in test-strategy §6 |
| QLT-12 | Info (concur with STD-01, Major; not counted again) | `eslint.config.mjs:94` | AC-1; ADR-008 layer 2 | F10: an Engineer view importing `getMastersService` from `@/server/composition` passes lint (exit 0). That is the project's standard path to every service | Layer 2 can be bypassed in one line; layers 3 and 5 remain | Forbid `@/server/composition` in `engineer-*` views (views take data, they do not fetch), and add it to `COST_IMPORTS` in the import-rule test |
| QLT-13 | Info | `tests/security/engineer-import-rule.test.ts:88-147` | AC-1 "Lint and build fail" | Next.js 16 `next build` does not run ESLint; "build" is met by CI stage 4 blocking the pipeline, as in 10.01 | None | Note in the story or test-strategy that "build" means the CI build |
| QLT-14 | Info | `tests/security/engineer-refused-before-lookup.test.ts` | AQP-113 AC-6; PO comment 11141 | Retirement verified. Refused API calls: every masters, audit and users repository method is spied on, against three masters methods before; all routes, not two. Refused page: every lookup, against `listProcessItems` only. Signed-out 401 is kept. The Admin control is kept and adds the 15 seed sentinels. Engineer routes: all methods, against GET only. The values are imported from one definition; no second copy | AQP-113 AC-6 can be ticked fully when this PR merges | — |
| QLT-15 | Info | — | — | Good practice: planted-fault tests that prove each guard can fail; `nonEmpty` on every manifest loop; `responseSchema` on the handler, so there is no list to keep in step; the wrapper's fail-closed 500 test; Playwright-list check at three widths. Note: the live DB holds only the 3 STORY-02.01 canary rates, so 23 of the 26 value sentinels can be found only in process today (documented in `canary-masters.ts:51-55`) | — | — |

<details><summary>Detailed notes and code suggestions</summary>

### QLT-02
**Current** (`tests/e2e/canary-scan.spec.ts:86-92`)
```ts
for (const call of calls) {
  const { id, body } = validCall(call, INVENTED_ID);
  ...
  expect(answer.status, call.name).toBeLessThan(500);
}
```
**Suggested**
```ts
for (const call of calls) {
  const recipe = validCallFor(call.method, call.row.path, { targetId: engineerId });
  if (/\[/.test(call.row.path) && recipe.id === 'invented-id') throw new Error(`${call.name}: add a real-ID recipe (AC-6)`);
  const answer = await callInBrowser(recorder, page, ..., fillPath(call.row.path, recipe.id), { method: call.method, ...(call.method === 'GET' ? {} : { body: recipe.body }) });
  expect(answer.status, call.name).toBe(recipe.status);
}
// pages
expect(document.status, path).toBe(200);
expect(new URL(document.url).pathname, `${path} was not redirected`).toBe(path);
```

### QLT-04
**Current** (`tests/e2e/canary-scan.spec.ts:105`)
```ts
const scripts = recorder.responses.filter((r) => r.url.includes('/_next/static/chunks/') && /javascript/.test(r.headers['content-type'] ?? ''));
```
**Suggested**
```ts
const scripts = recorder.responses.filter((r) => r.body !== null && r.url.includes('/_next/static/chunks/') && /javascript/.test(r.headers['content-type'] ?? ''));
expect(referenced, 'chunks fetched by the crawler').toBeGreaterThan(0);
```
and in the negative control: `new ScanRecorder()` (default), plant into a chunk, then `await fetchReferencedFiles(recorder, page, PRODUCTION_URL)` before scanning.

### QLT-05
**Current** (`tests/support/canary-masters.ts:163`)
```ts
...formulaTexts.filter((text) => text.includes(FORMULA_MARKERS[0] ?? '{{')).map(...)
```
**Suggested**
```ts
...formulaTexts.filter((text) => text.includes('{{')).flatMap((text) => [text, toDisplayForm(text, context)]).map(...)
```
</details>

## Issues for other roles
- **solution-architect:** record the AC-4 reading (in-process route + live controls) in test-strategy §6 (QLT-11). Rule on the `@one-width` proposal (developer item 5); it does not affect correctness.
- **master / scrum-master:** the story-template checklist line for QLT-01 (`docs/templates/` is outside the developer's area).
- **reviewer-standards:** QLT-11 and QLT-12 confirm STD-02 and STD-01 with planted-fault and source evidence.

## Hand-off
- Status: COMPLETE
- Verdict: REQUEST CHANGES — Blocker 0, Critical 1, Major 3, Minor 6, Info 5
- Recommended next agent: developer (QLT-01 PR-template line, QLT-02 to QLT-04), then reviewer-quality re-review of the new diff

---

# Round 2

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 2 (after master's G6 attempt-1 NO-GO, DL-112, Jira 11166) |
| Range reviewed | `ff9d9a3..c162eee` only (developer push `539bded`, Jira 11168; orchestrator's docs-only `c162eee`) |
| Date | 2026-11-08 |
| **Verdict** | **APPROVE WITH COMMENTS** (Blocker 0 · Critical 0 · Major 0 · Minor 2 new · Info 1 new) |

## Summary
Every round-1 finding is fixed. QLT-01 to QLT-10 are verified, each with a fault that makes a test fail. QLT-11 to QLT-15 were Info with no change required.

The scan can now go red in every place that round 1 doubted:
- a lost session;
- a dynamic route with no real-value recipe;
- a crawler that fetches nothing;
- interception switched off;
- a rate name in a **lazily loaded** chunk that the browser never asked for.

Two probes outside master's list still got through, and they are the two new Minors (QLT-16, QLT-17). Neither is a leak path today; both let the scan's "not vacuous" guard be weakened without a red build.

## Checks run
| Check | Command | Result |
|-------|---------|--------|
| Template lines (QLT-01) | Node comparison of `c162eee:.github/pull_request_template.md` and `c162eee:docs/templates/story.md` against gate-log rulings 1a and 1b | **Both verbatim.** The PR template has it at line 45, after the "Migrations" item; the story template at line 50, directly under the Testing Notes line. Each is 1 insertion and 0 deletions |
| Unit + security at `c162eee` | `npx vitest run tests/unit tests/security` | 142 files, 3,317 tests passed |
| Stage-9 pin at `c162eee` | `npx tsx scripts/check-production-routes.ts` after `npx next build` | "Production route check passed" |
| **E2E scan, locally** (new this round) | Own throwaway `postgres:17` container with invented passwords (no `.env*` opened, nothing printed); `prisma migrate deploy`, `ensure-seed-version`, `next build` of `c162eee`; `CI=1 npx playwright test canary-scan --project=desktop` | **Baseline: 9 passed** (6 scan tests + 3 set-up), 0 flaky. Desktop width only; CI runs all three |
| Clean-up | — | Container removed, scratch worktree removed, every fault reverted, nothing committed or pushed |

## Planted faults (scratch worktree at `c162eee`; each reverted after its run)
| # | Aimed at | Fault | Result |
|---|----------|-------|--------|
| F10 (re-plant) | STD-01 / QLT-12 | `engineer-me.ts` imports `getMastersService` from `@/server/composition` | **Caught:** `npx eslint` exit 1, "Engineer views receive their data; they do not reach the service container" |
| F14 (re-plant) | QLT-10 | `if (process.env.CI) return;` at the top of the AC-3 scan test | **Caught:** `canary-scan-gate.test.ts` "the scan spec has no early exit" fails |
| N1 | QLT-02 / AC-6 | `/estimates/[code]` (Engineer page with a dynamic segment) set to `implemented`, no recipe | **Caught:** `route-recipes.test.ts`, 2 failed, naming the route |
| N2 | QLT-02 | `page.context().clearCookies()` before the second Engineer page (session lost mid-scan) | **Caught (E2E):** AC-3 and the chunk control fail with "/ was redirected", Expected "/", Received "/sign-in" |
| N3 | QLT-03 | Interception switched off (`intercept` falls back for every request) | **Caught (E2E):** the chunk control fails: "the crawl fetched a chunk through the browser, so it could be planted". AC-3 alone stays green, as expected; the control is what proves interception |
| N4 | QLT-04 | `fetchReferencedFiles` returns 0 without fetching | **Caught (E2E):** AC-3 fails "build files fetched … Expected > 0, Received 0"; the chunk control fails too |
| N5 | QLT-04, AC-3 (chunk through the shared helper) | **Product** leak: the rate name `Cutting-Rate-per-Sec` added to a string in `portal-account-panel.tsx`, the account panel that loads only on first open; rebuilt | **Caught (E2E):** AC-3 reports `GET /_next/static/chunks/0uj3nakcbb5e5.js (referenced file): rate or operand name found as "Cutting-Rate-per-Sec"`. The crawler found a chunk the browser never asked for |
| N6 | QLT-06 | `extras: z.record(z.string(), z.string()).optional()` added to `meResponseSchema` | **Caught:** `strict-schema.test.ts`, 2 failed |
| N7 | QLT-05 | Formula-text rule back to "only `{{f:`" (display forms dropped) | **Caught:** `formula-display.test.ts` + `canary-masters.test.ts`, 2 failed |
| N8 | QLT-07 | Builder back to exact equality of printed forms (no substring) | **Caught:** `canary-estimate-builder.test.ts`, 1 failed |
| N9 | QLT-09 | `/api/auth/*` exempted from the no-store check again | **Caught:** `scanner.test.ts`, 1 failed |
| N10 | QLT-08 | `PATCH /api/v1/process-items/[id]` recipe ID back to `invented-id` | **Caught:** `route-recipes.test.ts` (2) and `engineer-refused-before-lookup.test.ts` (2, as LEAD and ENGINEER) |
| N11 (probe) | — | `recordNavigation` stops reading the body of `GET / (page)` | **Got through:** 9 passed → QLT-16 |
| N12 (probe) | — | `if (process.env.CI) return;` at the top of `expectScanSawEnough` in the helper | **Got through:** gate 9/9 → QLT-17 |

## Previous findings
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-01 | Critical | **Fixed** | Both lines present, verbatim to rulings 1a and 1b (`8dcb4c2`, `c162eee`) |
| QLT-02 | Major | **Fixed** | Recipe status asserted (`canary-scan.ts:336`); 200 and final path for non-hidden pages (`:315-317`); `recipeProblem` and `validPageAddress` throw by route name; `route-recipes.test.ts`. N1, N2 caught |
| QLT-03 | Major | **Fixed** | `context.route('**/*')` reads every `fetch`/XHR body before the page gets it (`canary-scan.ts:106-122`); the control plants into `/api/v1/me` and a chunk through it. N3 caught |
| QLT-04 | Major | **Fixed** | `scriptBodies()` counts read bodies only, `referenced > 0` asserted, and one `scanAsEngineer` drives both the scan and the planted-chunk control. N4 and N5 caught. Condition of the AC-4 reading (ruling 4) **met** |
| QLT-05 | Minor | **Fixed** | `isWorthFinding` keeps `{{` and multi-token display forms; `displayFormOf` is pinned to the engine's `toDisplayForm` for all 31 seed formulas. N7 caught |
| QLT-06 | Minor | **Fixed** | The walker flags records and `{}` in schema position only; can-fail cases added. N6 caught |
| QLT-07 | Minor | **Fixed** | Printed forms compared both ways by substring, with a 4-character floor. N8 caught |
| QLT-08 | Minor | **Fixed** | Dynamic refused rows need a real-value recipe (E2E and in-process); rows without a parameter make one call. N10 caught |
| QLT-09 | Minor | **Fixed** | Every response after sign-in is held, except `/_next/static/**` and the files of `public/`; next-auth's session route passes with no exemption. N9 caught |
| QLT-10 | Minor | **Fixed** for the spec | `earlyExits` and `testsWithoutAssertions`; F14 caught. The helper is not covered (QLT-17) |
| QLT-11 to QLT-15 | Info | No change needed | QLT-11: the stated reason is now correct and pinned (STD-02, confirmed by reviewer-standards) |

## New findings
| ID | Severity | File:line | Rule / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------|-------|--------|---------------|
| QLT-16 | Minor | `tests/e2e/support/canary-scan.ts:360-363` | AC-3 (non-vacuity), same class as QLT-04 | `expectScanSawEnough` counts HTML, RSC and JSON responses by content type, so the listener's header-only records (`body: null`) count too. Probe N11: with the body of `GET / (page)` never read, the whole scan stays green (9 passed). Only `/queue` is checked for a body | A page's HTML could stop being scanned with no red build | Count `response.body !== null` in `withType`, and require a read body for every label `GET <address> (page)` that `openEngineerPages` opened (return the addresses from it) |
| QLT-17 | Minor | `tests/unit/canary-scan-gate.test.ts:85` | AC-8, QLT-10 | `earlyExits` reads only `canary-scan.spec.ts`. The procedure now lives in `tests/e2e/support/canary-scan.ts`: probe N12 (`if (process.env.CI) return;` at the top of `expectScanSawEnough`) passes the gate 9/9 | The non-vacuity guard can be turned off in CI by one line outside the file the gate reads | Also apply `earlyExits` to the bodies of `scanAsEngineer`, `openEngineerPages`, `callEngineerRoutes` and `expectScanSawEnough`. The helper has one legitimate bare `return;` at `:73`, in the response listener, so check those function bodies, not the whole file |
| QLT-18 | Info | `tests/e2e/canary-scan.spec.ts:133` | AC-5 | Refused pages are opened with `invented-code` only, so "a real ID and an invented one" is proven for API rows but not for a dynamic refused page. No such page is implemented yet (`/estimates/[code]/costs/[slNo]` and `/export` are planned) | None today | When the first dynamic Lead/Admin page is implemented, open it with its `PAGE_RECIPES` value and with an invented one, and compare the two answers |

## AC conformance (round 2)
| AC | Result |
|----|--------|
| AC-1 | Met; F10 now caught |
| AC-2 | Met; N6 caught |
| AC-3 | Met; N2 to N5 caught; QLT-16 Minor |
| AC-4 | **Met under the accepted reading:** ruling-4 conditions QLT-04 (verified here) and STD-02 (verified by reviewer-standards) are both met |
| AC-5 | Met; N9, N10 caught; QLT-18 Info |
| AC-6 | **Met:** both template lines are verbatim, and N1 caught |
| AC-7 | Met; N8 caught |
| AC-8 | Met; F14 caught; QLT-17 Minor |

## Hand-off (round 2)
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS. Blocker 0 · Critical 0 · Major 0 · Minor 2 (QLT-16, QLT-17) · Info 1 (QLT-18)
- Recommended next agent: master, for G6 attempt 2. QLT-16 and QLT-17 are cheap and not conditions; master may route them to a follow-up or take them in this PR
