# Review Report — AQP-57 (STORY-01.03) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...feat/AQP-57-engineer-projection-scan` (PR #115, sankumar76/Accucut-Quotation) |
| Commit reviewed | `ff9d9a3d71b4dae191ad5dba00aefdaf36d634e4` |
| Date | 2026-11-08 |
| **Verdict** | **REQUEST CHANGES** (2 Major, 0 Blocker, 0 Critical) |

## Summary

The change meets its goal and is, on the whole, well built. The planted-fault import-rule tests, the self-testing strict-schema walker, the exhaustive repository classification test and the invented, credential-free sentinels are good practice. Tooling gates are clean (lint 0 problems, `tsc --noEmit` 0 errors).

Two things should be fixed before merge. First, the widened Engineer-view lint rule still treats modules that carry Restricted data as importable, and it can be bypassed through `@/server/composition` (STD-01). Second, the production-exclusion rationale for the test-only route is stated wrongly in four places, and the mechanism that actually keeps the route dead is neither named nor pinned by any check (STD-02). The conclusion holds: the route cannot be on in any Next.js server built from this tree. The stated reason does not.

The rest are Minor consistency and documentation items.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 |
| Minor | 9 |
| Info | 5 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx eslint . --max-warnings=0` (worktree at `ff9d9a3`) | Exit 0, no output (0 problems) |
| Type-check | `npx tsc --noEmit` (same worktree) | Exit 0, no output (0 errors) |
| Format check | none configured (no Prettier or equivalent in `package.json`; `CLAUDE.md` lists none) | n/a, see STD-10 |
| CI | PR check runs, run 42463553178 | "Stages 1 to 11", "Stages 1 to 11b", "Stage 12 shard 1 of 2", "Stage 12 shard 2 of 2": all `success` |
| Added-line sweep (2,265 lines) | grep for TODO/FIXME, `console.`, `debugger`, `eslint-disable`, `@ts-ignore`, `any`, secret-like words, URLs | No hits that matter. URLs are `*.example.test`. "secret" hits are comments. `E2E_PASSWORD` is referenced, not defined, in this diff |
| Build-output inspection | read the local `.next/server` chunk for the test-only route; grep `.next/server` and `.next/static` for the negative-control sentinel and several canary values | Gate default is inlined as `"production"`; sentinel and canary values are absent from the build |
| Next.js CLI source | read `node_modules/next/dist/bin/next` (16.4.3) | `process.env.NODE_ENV = process.env.NODE_ENV \|\| defaultEnv` (line 80), see STD-02 |
| Secret scan | not run by me; CI stage 2 (Gitleaks, full history) is reported green in the PR | Dependent on CI result |
| Vitest / Playwright | not run by me (not in this lane); CI green | n/a |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | **Major** | `eslint.config.mjs:78-100`; `tests/security/engineer-import-rule.test.ts:109-117` | Coding Standards §5 (deny by default), §3 (layering); ADR-008 layer 2; AC-1; NFR-002 | The widened rule is still a prefix deny-list with gaps. (a) `audit-repository` and `audit-service` are classed "not cost" (test line 112), but Process Master audit entries keep `defaultValue` (the rate) before and after (`audit-events.ts:72-80`, `161-178`) and render it as text. (b) `config-repository` and `config-service` are classed "not cost", but the config snapshot holds each field's `formula` (the text `readFormulaTexts` in `tests/e2e/support/auth.ts` reads and the scan forbids). (c) `@/server/composition` exports `getMastersService()` and `getAuditService()` (`composition.ts:57,82`) and is not restricted, so an `engineer-*` view importing it passes lint. (d) Services have no exhaustive classification test (only repositories do), so `customers-service`, `materials-service` or `exchange-rate-service` would slip past the `services` entry. The comment (`eslint.config.mjs:72-77`) and the test title (line 109, "covers every repository file ... that holds Restricted data") say more than the rule delivers. | The story exists so that "a careless later change" cannot carry a rate or formula to an Engineer. A view that reads an audit entry's "Before to after" text or the config snapshot, or that calls a service through `composition`, passes lint, passes the import-rule test and is only caught later, if at all, by the live scan. No Engineer view imports these today, so this is a coverage gap rather than a leak. | Add `audit-*` and `config-*` to both the repository and service patterns (and to `COST_IMPORTS`). Add `**/server/composition` (regex `/server/composition`) to `ENGINEER_VIEW_IMPORTS` with a planted-fault case. If a future Engineer form needs the field registry, give it a narrow, differently named reader, as the PR proposes for masters. Add the same exhaustive "every file in `src/server/services` is classed" test beside lines 109-117, and move `audit-repository` and `config-repository` out of `NOT_COST`. If the team decides audit and config are deliberately allowed, record that in ADR-008 and rename the test; the current wording is wrong either way. |
| STD-02 | **Major** | `src/lib/negative-control-gate.ts:4-5`; `src/app/api/test-only/leak/route.ts:7-10`; `README.md:167-168`; `playwright.config.ts:46-48`; PR description decision 3 | Coding Standards §8 (comments explain *why*, correctly), §5 (deny by default); AC-4 | The documented reason the route is absent is "`next dev` forces `development` and `next start` forces `production`, whatever the environment says". The installed Next.js 16.4.3 CLI does not do that: `node_modules/next/dist/bin/next:80` is `process.env.NODE_ENV = process.env.NODE_ENV \|\| defaultEnv`, so `NODE_ENV=test next start` keeps `test` (it only warns for non-standard values). What actually keeps the route dead is the bundler: the local production chunk shows the default parameter inlined as `function(e="production"){return"test"===e}()`. That works only because the code reads dot-access `process.env.NODE_ENV` as a default expression (the same rule `src/instrumentation.ts:10` documents for `NEXT_RUNTIME`). No test or build check pins it. The live spec (`canary-scan.spec.ts:216-221`) runs with `NODE_ENV` unset and only the sentinel supplied, so it shows the 404, not that `NODE_ENV=test` cannot enable the route. | Conclusion holds today: in a build from this tree the route cannot be on, and the sentinel and canary values are not in the build. But a plausible refactor (destructuring `process.env`, `process.env['NODE_ENV']`, passing `nodeEnv` explicitly, or moving the gate out of a literal default) silently turns the control into an environment-dependent one, and a deployment with `NODE_ENV=test` plus the second variable would serve the sentinel. The exposure is one invented string, so impact is low, but the next maintainer is told the wrong reason for a security control. | (1) Correct the four comments to say: the route is on only under `NODE_ENV=test`; Next.js inlines `process.env.NODE_ENV` at build time, so a `next dev` or `next build` bundle sees `development` or `production` whatever the environment says; keep the read as a dot-access default. (2) Pin it with one cheap check, for example a stage-9 assertion in `scripts/check-production-routes.ts` that the compiled chunk holding `CANARY_NEGATIVE_CONTROL` contains no runtime `process.env.NODE_ENV` read, or a test that fails if the gate reads `NODE_ENV` any other way. (3) Consider adding the route to the production-routes check beside `/design-system`. This answers the developer's request to confirm the AC-4 reading: confirmed as to outcome, not as to reason. |
| STD-03 | Minor | `src/lib/negative-control-gate.ts:21` | Coding Standards §10 (validate env vars with zod), §8 (config docs) | `CANARY_NEGATIVE_CONTROL` is read straight from `process.env[...]` in `src/lib`, outside `src/lib/env.ts`, and is not named in the README section that describes the scan. The exception is reasonable (test-only, must not fail start-up, must not appear in `.env.example`), but it is not stated. | A new, undocumented environment variable. A reader of `env.ts` ("Every variable of architecture section 8") will not find it. | Add a two-line note in `env.ts` or the gate saying why it is deliberately outside `ENV_VARIABLE_NAMES`, and name the variable in the README "Cost confidentiality scan" section. |
| STD-04 | Minor | `src/lib/negative-control-gate.ts:6` | Coding Standards §8 | The comment cites `tests/security/negative-control.test.ts`, which does not exist. The tests are the "negative control" `describe` in `tests/security/scanner.test.ts:137-191`. | A broken pointer on a security control. | Replace with `tests/security/scanner.test.ts`. |
| STD-05 | Minor | `src/server/views/schemas/index.ts:10-13`; `tests/security/engineer-import-rule.test.ts:69`; `src/server/views/engineer-me.ts:4` | Coding Standards §3 (module boundaries); architecture §6 | The barrel `export *`s the audit, me, process-items and users schemas, so the Engineer-reachable `/me` schema and the Admin-only ones share one import point. The import-rule test lists the barrel as an allowed import for Engineer views, and `schemas/audit.ts:6-7` imports `services/audit-events` and `audit-cursor`. An Engineer view that imports the barrel therefore pulls the audit service module, which formats Process Master rates, into its module graph, and the lint rule is not transitive. `engineer-me.ts` imports `./schemas/me` directly while the route imports the barrel: two styles for one thing. | Weakens the "Engineer views import only Engineer-safe modules" reading of AC-1. | Make the barrel the import point for routes. Have `engineer-*` views import the specific file (as `engineer-me.ts` does), drop the barrel from `ALLOWED_IMPORTS`, and add a restricted-import pattern for the barrel in `engineer-*` with a planted-fault case. Or replace `export *` with explicit named re-exports of the Engineer-reachable schemas only. |
| STD-06 | Minor | `src/app/api/v1/me/route.ts:3` (renamed file `src/server/views/engineer-me.ts`, no diff hunk) | Coding Standards §2 (names reveal intent) | `engineer-me.ts` serves `/api/v1/me` for every role (route comment "Every role"; `tests/unit/engineer-me.test.ts` builds it for ADMIN, LEAD and ENGINEER and gives each its own menu). The prefix names the lint scope, not the audience, and nothing says so. | A maintainer may read it as Engineer-only and treat a Lead or Admin branch as out of place, or avoid sharing it. The rename itself is a sound way to bring the projection under the rule. | Add one sentence at the top of `engineer-me.ts`: `engineer-*` means "an Engineer can reach this view, so the import rule applies". Mirror it in architecture §10 (cross-reference for solution-architect). |
| STD-07 | Minor | `tests/e2e/support/canary-scan.ts:38, 71-73` | Coding Standards §1 (fail fast), §10 (never swallow errors) | `ScanRecorder.capture` catches a failed header or body read and appends it to `unreadable`, described as "Informational". Nothing in the repo asserts it is empty (`grep unreadable tests` finds only the push). A response that could not be read is silently left out of what is scanned. | The scan's value is that it cannot miss a response. With default settings only the header read can fail here, so the risk is small, but the failure is invisible. | In the AC-3 and AC-5 tests add `expect(recorder.unreadable).toEqual([])` before the scan assertion (and in the control test if the planted response must be readable). |
| STD-08 | Minor | `tests/e2e/canary-scan.spec.ts:127, 178, 189`; `tests/security/strict-schema.test.ts:46`; `tests/support/canary-masters.ts:143, 166` | Coding Standards §1 (DRY at three, readability over cleverness), §2 | (a) Spec line 127 declares a local `withoutRequestId` with a different meaning from the exported `withoutRequestId` in `tests/support/scanner.ts:124`, and re-states the request-ID regex that `scanner.ts:135` already holds (`REQUEST_ID_FORM`). (b) Line 178 hard-codes `'Cutting-Rate-per-Sec'` instead of taking a name from `SEED_PROCESS_ITEMS`, a second copy of a seed name. (c) Line 189 empties the recorder from outside with `recorder.responses.length = 0`. (d) `SchemaHandler` (strict-schema line 46) re-declares the shape of the now-exported `RouteHandler` (`with-route.ts:80`). (e) `canary-masters.ts:143` and `:166` repeat the `seen.has(x) ? false : Boolean(seen.add(x))` filter, which hides a side effect inside a predicate. | Same name with two meanings, duplicate literals and a trick used twice make the next edit riskier. None changes behaviour. | (a) Rename the local helper `maskRequestId` and reuse the exported pattern. (b) Take the name from the seed list. (c) Add `ScanRecorder.reset()`. (d) `type SchemaHandler = RouteHandler`. (e) Extract one `uniqueBy(list, key)` helper. |
| STD-09 | Minor | `tests/e2e/canary-scan.spec.ts:65-114`; `tests/e2e/auth.setup.ts:20, 49, 73` | Coding Standards §1 (functions ≤ 40 lines; no magic numbers) | The AC-3 test callback is 50 lines with no inline justification for exceeding the limit. `setup.setTimeout(180_000)` now appears three times (one new, line 49) while `COMPILE_TIMEOUT` is already a named constant on line 15. | Small, but this file is the model later stories copy. | Split the AC-3 body into `openEngineerPages`, `callEngineerRoutes` and `assertNotVacuous` helpers, or add a one-line justification. Extract `SETUP_TIMEOUT = 180_000` next to `COMPILE_TIMEOUT`. |
| STD-10 | Minor | `tests/security/scanner.test.ts:40, 90, 104, 197, 240, 250, 261`; `tests/e2e/canary-scan.spec.ts:27, 47, 105, 116, 133`; `tests/security/engineer-import-rule.test.ts:112, 124` | Coding Standards §1 (readability); Version Control hygiene | There is no formatter or format-check in the repo (the PR table says so). New files carry lines of 165-222 characters (worst: `scanner.test.ts:250`, 222), against a maximum of about 160 in `src`. | Hard-to-review diffs and drift. A format gate would have caught this. | Wrap the longest lines now. Separately, raise a format-check gate (Prettier or equivalent) with the architect; this is not a story-level fix. |
| STD-11 | Minor | commit `7ce8b1c` | Coding Standards §9 (one logical change per commit) | One commit bundles strict schemas plus `withRoute.responseSchema`, the `me-view` to `engineer-me` rename, the ESLint widening, two new security test files and the deletion of the 168-line AQP-113 interim test. | Hard to revert or bisect the rule widening apart from the retirement of an existing security test. | No change needed if the PR is squash-merged; list the retirement of `process-master-confidential.test.ts` explicitly in the squash message. Prefer one commit per logical change next time. |
| STD-12 | Info | `src/app/api/test-only/leak/route.ts:17-18`; `tests/support/route-files.ts:30`; `tests/security/manifest-completeness.test.ts` | Coding Standards §3 (shared modules) | The route hand-builds its responses outside `withRoute`, and the "only the ones named here" guard grew from one to two entries. Accepted: the route is public, has no input or session, and an empty 404 body is intended to look absent. The exception is documented where it is made. | None. | Keep the guard's list at exactly the two named routes; any third entry should need an explicit decision. |
| STD-13 | Info | `tests/support/canary-masters.ts:24-81` | Coding Standards §5 (no secrets); AC-3; Dev Context "invented sentinels" | Sentinels are invented, follow the rare pattern `\d{3,}.(37\|73)` (`SENTINEL_PATTERN`), and are none of them a rate or workbook value. The negative-control sentinel is supplied through the environment and is absent from the local build output. The sweep of all 2,265 added lines found no credential, token or key. No workbook or `.env*` file was opened for this review. | Positive. | None. |
| STD-14 | Info | Story Files list vs `tests/e2e/canary-scan.spec.ts`; `tests/e2e/auth.setup.ts:49` | Process | Departures reviewed and accepted from a standards view: the scan spec lives in `tests/e2e` (Playwright `testDir`; the Jira Files list and test-strategy §12 still say `tests/security`, so scrum-master or architect should align them). The new warm-up `setTimeout` follows the existing set-up precedent and is justified in its comment (DL-057 concerns test timeouts, not set-up). The `@one-width` proposal has no standards objection, but it needs a test-strategy 10.5 ruling and the allow-list edit; that is the architect's call. | None. | See "Issues for other roles". |
| STD-15 | Info | `engineer-import-rule.test.ts:88-118`; `strict-schema.test.ts:173-178`; `with-route.ts:75-83` | Coding Standards §6 | Good practice worth keeping: a planted fault for each prefix as a static import and as `import()`, plus control cases; a walker that proves it can fail; an exhaustive repository classification test; and `responseSchema` exposed on the handler so tests read the schema from the route itself, with no list to keep in step. | Positive. | Extend the classification idea to services and to `composition` (STD-01). |
| STD-16 | Info | `docs/standards/coding-standards.md:95` | Governance | The rule-book ends mid-sentence in §10 SQL ("Cost, rate and formula fields must never be"). Any rule that follows is not enforceable by reviewers. | Gap in the standards, not in this PR. | master / solution-architect to complete the file. |

<details><summary>Detailed notes and code suggestions</summary>

### STD-01

**Current** (`eslint.config.mjs:93-97`; `tests/security/engineer-import-rule.test.ts:112`)
```js
{
  group: ['**/services/masters-service', '**/services/calculation-*', '**/services/approval-*'],
  regex: `${SLASH}services${SLASH}(masters-service|calculation-|approval-)`,
  ...
}
const NOT_COST = ['audit-repository', 'config-repository', 'database-errors', 'prisma-client', 'throttle-repository', 'transaction', 'user-repository'];
```
**Suggested**
```js
// repositories group + regex: add '**/repositories/audit-*', '**/repositories/config-*' and 'audit-|config-' in the regex
// services entry: '**/services/audit-*', '**/services/config-*', plus the composition root
{
  group: ['**/server/composition', '@/server/composition'],
  regex: `${SLASH}server${SLASH}composition`,
  message: 'Engineer views receive data from their caller; they do not reach the service container (ADR-008 layer 2).',
},
```
```ts
const NOT_COST = ['database-errors', 'prisma-client', 'throttle-repository', 'transaction', 'user-repository'];
const COST = ['master-repository', 'audit-repository', 'config-repository'];
// and a twin test over readdirSync('src/server/services'), with its own NOT_COST / COST lists
```
Evidence: `audit-events.ts:72-80` (`defaultValue` in `processItemState`, rendered by `describeProcessItem`); `composition.ts:57,82` (`getAuditService`, `getMastersService`); `tests/e2e/support/auth.ts` `readFormulaTexts` (reads `snapshot.fields[].formula` from `config_versions`).

### STD-02

**Current** (`src/lib/negative-control-gate.ts:4-5`)
```
 *   - it is on only when `NODE_ENV` is `test`, which is Vitest's value. No Next.js server has it: `next dev` forces
 *     `development` and `next start` forces `production`, whatever the environment says (checked on Next.js 16.4.3), ...
```
**Evidence**
- `node_modules/next/dist/bin/next:80`: `process.env.NODE_ENV = process.env.NODE_ENV || defaultEnv;` (the `preAction` hook, every command). `test` is a standard value, so there is not even a warning.
- Local production chunk for the route: `function(e="production"){return"test"===e}()`. The bundler replaced the dot-access `process.env.NODE_ENV` in the default parameter.

**Suggested wording**
```
 *   - it is on only when `NODE_ENV` is `test`, which is Vitest's value. Next.js replaces `process.env.NODE_ENV` at build time
 *     (`development` for `next dev`, `production` for `next build`), so the default argument below is a constant in every
 *     server bundle and the route is off there whatever the runtime environment says. Keep the read as a dot-access default:
 *     a computed or destructured read is not replaced and would make the gate depend on the environment.
```
Pin: a build-output assertion, or a unit test that the gate's default parameter is the literal `process.env.NODE_ENV` expression.

### STD-07

**Suggested** (in the AC-3 and AC-5 tests, after `recorder.settled()`)
```ts
expect(recorder.unreadable, 'responses the scan could not read').toEqual([]);
```
</details>

## Reviewer-specific tables

Not applicable to the standards lens (AC conformance belongs to reviewer-quality; NFR impact to reviewer-performance).

Cross-references only: reviewer-quality should confirm that the assertions of the retired `process-master-confidential.test.ts` (including the Lead's answers) are all carried by `engineer-refused-before-lookup.test.ts` and the live scan. reviewer-performance owns the scan's CI time (5:18 to 5:44 against the 6:00 early warning, RISK-023).

## Issues for other roles

- **solution-architect / QA:** the AC-4 reading ("absent from a production build" shown as a 404 on the production server, and live negative controls through request interception). Confirmed as to outcome, with the reason corrected (STD-02). Align test-strategy §12 and the Jira Files list with `tests/e2e/canary-scan.spec.ts`. Rule on the `@one-width` proposal (test strategy 10.5).
- **solution-architect:** decide whether audit and config modules are Engineer-importable (STD-01); consider a format-check gate (STD-10); note the `engineer-*` naming convention in architecture §10 (STD-06).
- **master:** complete `docs/standards/coding-standards.md` §10 SQL (STD-16).

## Previous Findings (re-review only)

Not applicable (round 1).

## Consolidated variant (orchestrator only)

Not applicable.

## Hand-off

- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-57/standards.md` (not committed)
- Jira / GitHub updates: PR #115 COMMENT review with inline `STD-NN` comments and label `review:standards-changes-requested`; Jira summary comment on AQP-57 "🤖 reviewer-standards — G6"
- Open questions: none
- Risks raised: none new; STD-01 and STD-02 refine ARCH-R2 handling
- Recommended next agent: developer — fix STD-01 and STD-02 (and the cheap Minors), then reviewer-standards re-reviews the new diff only

---

# Round 2 — Standards re-review of ff9d9a3..c162eee

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 2 (follows master's G6 attempt-1 NO-GO, DL-112, Jira 11166) |
| Range reviewed | `ff9d9a3..c162eee` (`8dcb4c2`, `e617f6d`, `d9f50aa`, `539bded` from the developer, hand-off 11168; `c162eee` docs-only, added by the orchestrator) |
| Date | 2026-11-08 |
| **Verdict** | **APPROVE WITH COMMENTS** (no Blocker, Critical or Major open) |

## Summary

All eleven round-1 findings (STD-01 to STD-11) are resolved, including both Majors. STD-01 is now a default-deny allow-list with an exhaustive classification test for both directories; I planted 22 import specifiers against it and every real STD-01 case was refused. STD-02 gives the correct reason in all four places and is pinned by a build-output check that failed on the un-inlined, destructured and bracketed-literal variants I planted in the real compiled chunk; two harder variants evade it (STD-18, Info). Both template lines are verbatim from master's record. One new Minor (a wrong test pointer in the gate comment, the same class as STD-04) and three Info items remain; none blocks merge.

| Severity (new in round 2) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 (STD-17) |
| Info | 3 (STD-18, STD-19, STD-20) |

## Checks Run (round 2)

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx eslint . --max-warnings=0` at `c162eee` | Exit 0, no output |
| Type-check | `npx tsc --noEmit` at `c162eee` | Exit 0, no output |
| CI | developer-reported run 42473467530 on `539bded`, all four jobs green, stage 9 printed "Production route check passed" | Not re-fetched by me for `c162eee` (docs-only commit); master verifies CI on the final head |
| PR-template line | compared the added line in `.github/pull_request_template.md` with gate-log ruling 1a, character by character (the log escapes backticks with a backslash; unescaped before comparing) | **Verbatim.** One file, one insertion, no existing line changed (`8dcb4c2`) |
| Story-template line | same for `docs/templates/story.md` against ruling 1b | **Verbatim.** One file, one insertion directly under the "Testing Notes" description line, no existing line changed (`c162eee`) |
| Added-line sweep (1,258 lines) | grep for TODO/FIXME, `console.`, `debugger`, `eslint-disable`, `@ts-ignore`, `any`, key/token patterns | No hits that matter (TODO/FIXME matches are the quarantine-marker regex and its fixtures) |
| Dependencies | `git diff --stat ff9d9a3..HEAD -- package.json package-lock.json` | No change |
| File size | changed `.ts`/`.mjs` files over 400 lines | None (largest: `tests/e2e/support/canary-scan.ts`, 369) |
| Gitleaks / Vitest / Playwright | not run by me (Vitest: only the classification tests of the import-rule file, 2 passed) | Developer reports Gitleaks 8.30.1 clean on each commit tree and CI green |

## Planted faults (scratch only; nothing committed, no repository file changed)

STD-01, 22 specifiers planted through the ESLint API into a virtual `src/server/views/engineer-me.ts` (no file written):

| Result | Cases |
|--------|-------|
| 18 refused | audit and config repository and service; `getAuditService` and `getMastersService` from `@/server/composition` (static and `import()`); relative paths; type-only import; `export *` and named re-export; `.ts`-suffixed audit path; `zz-planted-service` and `zz-planted-repository` (files that do not exist); the schemas barrel as a named import; a relative path into `prisma/seed` |
| 4 passed (probes outside the STD-01 cases) | bare `@/server/repositories`, bare `@/server/services` (static and `import()`), and `@/lib/fields/registry`. The first three are STD-19; the last only holds pure functions over a passed-in document, so I do not count it |
| 4 allowed imports clean | `user-repository`, `auth-service`, `schemas/me`, `import()` of `user-service` |

Unclassified-file plant: I tried to write a stray `zz-planted-service.ts` and `zz-planted-repository.ts` into a worktree's `src/` twice (the review worktree and a separate scratchpad worktree). **The permission system denied both commands, and I did not work around it.** What I verified instead: the classification test passes at the unmodified head (ran `-t "is on exactly one list"`: 2 passed); its logic is a two-way set difference between the directory listing and the two lists; and the lint refuses an import of a not-yet-existing file (above). So "a new file fails the test until classed" is verified by reading and by the green control, not by a real plant.

STD-02, `findNegativeControlGateProblems` run in memory against the real local build output (204 compiled `.js` files; the route's chunk contains the inlined gate `function(e="production"){return"test"===e}()`), with the chunk text edited per case. This local build predates round 2 but has the same gate form.

| Case | Expected | Result |
|------|----------|--------|
| S0 unmodified real build output | pass | pass |
| S1 default parameter reads `process.env.NODE_ENV` at run time (what an un-replaced build looks like) | fail | fail |
| S2 destructured read | fail | fail |
| S3b bracketed literal read `process.env["NODE_ENV"]` | fail | fail |
| S5 variable absent from every file | fail closed | fail |
| S3 computed key with no `NODE_ENV` text (`"NODE_"+"ENV"`) | not detectable by text | pass (see STD-18) |
| S4 run-time `NODE_ENV` read 1,500 characters before the variable | beyond the 800-character window | pass (see STD-18) |

This was an edit of compiled text, not a rebuild. The developer reports a real planted runtime read, `next build` and exit 1 naming the chunk (PR description), which I did not repeat.

## Previous Findings

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| STD-01 | Major | **Fixed** | `allowOnly` default-deny for `repositories/*` and `services/*` (allow-list: `user-repository`, `database-errors`, `transaction`, `user-service`, `auth-service`); `composition` and the schemas barrel refused; both directories classed exhaustively; comment and title say only what the rule does. Residual Info: STD-19 |
| STD-02 | Major | **Fixed** | Four comments plus the PR description corrected; `findNegativeControlGateProblems` wired into stage 9 (`scripts/check-production-routes.ts`), fails closed; source-form unit test in `tests/unit/production-routes.test.ts`. Limits: STD-18. New wrong pointer: STD-17 |
| STD-03 | Minor | **Fixed** | Gate comment explains the exception; README names `CANARY_NEGATIVE_CONTROL` and says it is not in `env.ts` or `.env.example` (I did not open that file) |
| STD-04 | Minor | **Fixed, replacement has the same defect** | The nonexistent `negative-control.test.ts` is gone; the new sentence points to the wrong file: STD-17 |
| STD-05 | Minor | **Fixed** | `/api/v1/me` and `engineer-me.ts` import `schemas/me`; barrel refused for Engineer views, has `import 'server-only'`; no `src` importer remains |
| STD-06 | Minor | **Fixed** | Sentence at the top of `engineer-me.ts`. The architecture §10 mirror is the architect's (ruling 5) |
| STD-07 | Minor | **Fixed** | `unreadable` asserted in the AC-5 test, both controls that read their pages, and inside `expectScanSawEnough` (AC-3). The chunk control does not assert it directly: STD-20 |
| STD-08 | Minor | **Fixed** | (a) `maskRequestId` exported and reused, shadow removed; (b) rate name from `SEED_PROCESS_ITEMS`; (c) `ScanRecorder.reset()`; (d) `SchemaHandler = RouteHandler`; (e) `uniqueBy`. Residual nit in STD-20 |
| STD-09 | Minor | **Fixed** | Scan tests 18 to 34 lines through helpers; `SETUP_TIMEOUT` named once, used three times |
| STD-10 | Minor | **Fixed as scoped** | No line added by the PR in `.ts`/`.mjs` exceeds 160 characters; pre-existing long lines untouched; format gate deferred to #116. The 311-character PR-template line is the mandated verbatim text |
| STD-11 | Minor | **Fixed** | Squash message in the PR description, naming the retirement of `process-master-confidential.test.ts` |
| STD-12 to STD-15 | Info | No change required | Guard still at exactly two entries (files untouched in round 2) |
| STD-16 | Info | **Open, not a PR item** | `docs/standards/coding-standards.md` still ends mid-sentence (gate log: owed by the orchestrator with the STD-13 wording, DL-109 condition 8). I did not re-read that file in round 2 |

## New findings (round 2)

| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-17 | Minor | `src/lib/negative-control-gate.ts:12` | Coding Standards §8 | The comment says `tests/security/scanner.test.ts` pins the source form. It does not; the source-form pin is the last test of "the gate of the test-only route in the build output (STD-02)" in `tests/unit/production-routes.test.ts:101-110`. Same class of defect as STD-04, on the same security control. | A reader looking for the pin to understand what keeps the route off will not find it | Change the pointer to `tests/unit/production-routes.test.ts` |
| STD-18 | Info | `tests/unit/production-routes.test.ts:83`; `scripts/lib/production-routes.ts` (`GATE_WINDOW`) | Coding Standards §6, §8 | The build pin is a text check within 800 characters of the variable name. (a) A read built without the literal `NODE_ENV` (S3) is invisible to it, and the "a computed read" unit case only fails because its fixture carries a `/* NODE_ENV */` comment, so the case name overstates. (b) A run-time read in another module more than 800 characters away (S4) passes. The source-form test covers (b) for the gate file itself, because it requires the dot-access default there. | Small. Two independent pins plus the gate's own comment make an accidental regression unlikely | Rename the fixture ("a read that leaves NODE_ENV in the text") or drop the comment from it, and add one line to the check's doc that it cannot see a key built at run time |
| STD-19 | Info | `tests/security/engineer-import-rule.test.ts:87-95`; `eslint.config.mjs` (`allowOnly`) | Coding Standards §5 | A bare directory import (`@/server/repositories`, `@/server/services`) is not refused. No `index.ts` exists in either directory today, so nothing can be reached. If one is ever added, the classification test makes someone class `index`, but the planted specifier would be `.../index`, not the bare directory. | Hypothetical | Add the two bare specifiers to `BLOCKED_IMPORTS` and let the glob and regex also match the directory itself, or note that a barrel in those directories is not allowed |
| STD-20 | Info | `tests/support/scanner.ts:154`; `tests/support/route-calls.ts:53,59`; `tests/e2e/canary-scan.spec.ts:67-68, 209-242` | Coding Standards §1, §2 | Four nits. `maskRequestId` repeats the request-ID regex literal instead of sharing a source with `REQUEST_ID_FORM`. `PAGE_RECIPES` is declared after `validPageAddress`, which uses it. The `signIn` doc comment wraps to a stray ` * */` line. The chunk and fetched-response control does not assert `recorder.unreadable` directly (a failed read there would fail its own finding assertions). | None | Fix when next touched |

## Corrections made during this round

Two of my PR thread replies overstated what I personally ran and were corrected in follow-up replies: STD-01 (22 planted, 18 refused, 4 probes passed, not "all refused") and STD-05 (I planted one barrel form myself; the rest are in the developer's test, which I read but did not run in full).

## Cross-references (not mine to rule)

- reviewer-quality owns the scan behaviour (QLT-02 to QLT-10) and the planted-fault matrix of ruling 7. I read those files for conventions only (recipe loops, `scanAsEngineer`, interception) and found nothing needing a standards finding beyond STD-20.
- reviewer-performance owns CI time (developer reports 5:11 on `539bded`) and PRF-03 batching (`CRAWL_BATCH = 8`, a named constant).
- solution-architect: ADR-008 and architecture §10 wording (audit and config not Engineer-importable, narrow reader, `engineer-*`, "build" meaning the CI build) is due before the sprint 1 review (ruling 5); STD-18 may inform the CI-build wording.

## Hand-off (round 2)

- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-57/standards.md` (Round 2 appended; not committed)
- Jira / GitHub updates: PR #115 COMMENT review (round 2) with replies in the 17 round-1 threads and 4 new inline comments; label `review:standards-changes-requested` replaced by `review:standards-approved`; Jira comment "🤖 reviewer-standards — G6 round 2"
- Open questions: none
- Risks raised: none new
- Recommended next agent: master — G6 attempt 2 on the final head once reviewer-quality and reviewer-performance have re-reviewed; the developer may fold in STD-17 (one-line pointer) at any time, not a condition
