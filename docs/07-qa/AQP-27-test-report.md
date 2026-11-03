# Test Report — AQP-27 (STORY-10.01): Scaffold, CI and repository hygiene

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | G7 attempt 2: `60eeb67` on `feat/AQP-27-scaffold-ci` (PR #16, `sankumar76/Accucut-Quotation`). Attempt 1 was run on `5390559`; its evidence is kept below and was not repeated where `60eeb67` did not change the code it covers (the fix touches `src/instrumentation.ts` and two unit-test files only) |
| CI | Attempt 1: run 41583743245 on `5390559`. Attempt 2: run 41591216308 on `60eeb67`, job "Stages 1 to 11" success, only stages 12 and 13 skipped by design (`if: ${{ false }}`) |
| Environment | Windows 11; Node v24.19.0, npm 11.17.0 (CI uses Node 22); Docker 29.8.0; PostgreSQL 17.11 from `compose.dev.yml` (see "Database used"); Chromium via Playwright 1.64.1 |
| Date | 2026-11-03 |
| **Recommendation (attempt 2)** | **ACCEPT.** DEF-001 (Sev-2) and DEF-002 (Sev-3) are fixed and verified, and closed. One new Sev-3 defect, DEF-003 (type Test, a timing failure under machine load), is open and does not block G7. Open Sev-1 0, Sev-2 0, Sev-3 1, Sev-4 0 |
| History | Attempt 1 (on `5390559`): recommendation ACCEPT with DEF-001 as Sev-3. Master's G7 attempt 1 was NO-GO (Jira 10671): "fails fast" in AC-3 means the process exits, so DEF-001 is Sev-2 |

## Summary

**Attempt 2.** The developer's fix `60eeb67` changes `src/instrumentation.ts` (exit code 1 on an invalid environment) and two unit-test files. On the built standalone server an invalid environment now exits 1 with one line that names the variables and no value, and a complete invented environment serves HTTP 200, so DEF-001 is verified (see "Attempt 2 re-test"). A CRLF checkout of the workflow test now passes, so DEF-002 is verified. The full regression on `60eeb67` is green: eslint, tsc and build exit 0; Vitest 23 files, 506 tests, 0 failed, 0 skipped (with the 126 QA acceptance tests the coordinator committed in `6ea8497`); Playwright 3 of 3; Gitleaks 97 commits, no leaks, baseline still exactly 7. While re-running the suite I found a load-sensitive failure of the developer's first lint test (DEF-003).

**Attempt 1 (unchanged below).** All ten acceptance criteria were verified with evidence on `5390559`, by the existing suite, by QA acceptance tests and by exploratory attacks on every negative control. No secret, real rate, master datum or workbook value is added by the branch (ADR-014); re-checked on `60eeb67`: the new commit adds no file outside `src/instrumentation.ts` and two test files.

## Decision for master (read this first)

1. **DEF-001 (AQP-166, GitHub #21): Sev-2 as you ruled, fixed in `60eeb67`, verified and closed.** AC-3 now passes in full.
2. **DEF-002 (AQP-167, GitHub #22): fixed in `60eeb67`, verified on a CRLF checkout, closed.**
3. **DEF-003 (AQP-168, GitHub #24), new, Sev-3, type Test.** The first test of `tests/unit/lint/layer-rules.test.ts` times out at 30 s when the machine is busy (it loads the ESLint configuration inside its own budget). It passed on an idle machine twice and on CI. The test plan says a test that fails and then passes is a defect of type Test, so I raised it; I do not count it against G7 because no retry was used and the suite is green on an idle machine and on CI. If you read "green only when idle" as not green, say so and I will hold the recommendation.
4. **Uncommitted file.** Per the brief, this commit holds the report and the two DEF records only. The new record `docs/07-qa/defects/DEF-003-layer-rules-test-times-out-under-load.md` is in the working tree, untracked; the Jira Bug and the GitHub issue name it. Commit it on your word.

## AC Verification Matrix

Test IDs are titles of the form `[AQP-27 AC-n]` in `tests/acceptance/aqp-27-scaffold.test.ts` and `tests/acceptance/aqp-27-database-roles.test.ts` (QA, new), or the developer's tests named in the table. Techniques: BVA = boundary-value analysis, EP = equivalence partitioning, DT = decision table, EG = error guessing.

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 | QA: 5 tests `[AQP-27 AC-1]`; manual clean-clone install and build | EP, EG | Pass | Fresh clone of `5390559` in a scratch folder: `npm ci` exit 0, `npx prisma generate && npx next build` exit 0 (routes `/` and `/_not-found`). All 32 dependencies match `^\d+\.\d+\.\d+$` (0 with `^`, `~`, range or tag). `prisma` and `@prisma/client` both 7.10.1. `overrides` equals `{"next-auth":{"nodemailer":"$nodemailer"}}`; `npm ls` shows next-auth resolving `nodemailer@10.3.1` (deduped). `package-lock.json` tracked. `.npmrc` has `legacy-peer-deps=false`; no `--legacy-peer-deps` or `--force` in the workflow. Installed versions agree with architecture section 11 (see OBS-6 for what section 11 names that is not installed) |
| AC-2 | QA: 5 tests `[AQP-27 AC-2]`; `npx tsc --noEmit` | EP | Pass | tsc exit 0. `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` all true. `next.config.ts`: `output 'standalone'`, `images.unoptimized true`, `serverExternalPackages ['exceljs','@node-rs/argon2']`, `poweredByHeader false`. The built server sends no `X-Powered-By` header |
| AC-3 | QA: 7 tests `[AQP-27 AC-3]`; developer `env.test`, `env-example.test`, `dotenv-loading.test`, `instrumentation.test`; manual start-up of the built server | EP, EG | Pass on `60eeb67` (attempt 1: fail on "fails fast", DEF-001) | `git check-ignore -v .env.example` prints nothing and exits 1 (not ignored). `.env`, `.env.local`, `.env.production`, `.env.staging` are ignored. The only tracked env file is `.env.example`. Invalid start-up: the log lists `DATABASE_URL (invalid), AUTH_SECRET (invalid), APP_ORIGIN (missing), SMTP_AUTH_MODE (missing)`; three sentinel values I placed in the variables occur 0 times in the log. On `5390559` the process then stayed up and returned 500 (DEF-001, Sev-2 by the master's ruling). On `60eeb67` it exits 1 after the same one-line message, with no value, and serves nothing (attempt 2 re-test below). I did not open `.env.example`; the tests that read it pass |
| AC-4 | QA: 7 tests `[AQP-27 AC-4]`; developer `ci-workflow.test`; CI run 41583743245 | DT, EP | Pass | Read from the GitHub API: steps 6 to 18 are stages 1 to 11 in order, all success; stages 12 and 13 skipped. Trigger `pull_request` (plus `push` to `master`), no `pull_request_target`, no `secrets.` reference, `permissions: contents: read`, both actions pinned to 40-character SHAs, no `continue-on-error`, audit at `--audit-level=high`. Branch protection read back (read-only): required check "Stages 1 to 11", strict, admins enforced, force-push and deletion off |
| AC-5 (negative) | QA: 6 tests `[AQP-27 AC-5]`; developer `data-files.test`, `gitleaks-baseline.test`; manual Gitleaks attacks | DT, EG | Pass | Data-file check: exit 0 on the repository; in throwaway repositories it exits 1 and names a new `.csv`, `.xlsx`, `.json`, `.tsv`, `.xls`, `.ods`, `.parquet`, `.dump`, `.sql` (outside `prisma/migrations/<one folder>/migration.sql`), upper-case and mixed-case extensions, a non-ASCII name, and look-alikes of the two named exceptions (`sub/AMADA-20261006.xlsx`, `amada-20261006.xlsx`, a copy-named file). The two exceptions pass only at their exact root paths. Secret scan: Gitleaks 8.30.1 (Windows build; its SHA-256 matches the release checksum file, whose Linux entry equals the value pinned in `ci.yml`). Full history with the baseline: 94 commits, no leaks. Without the baseline: exactly 7 findings, all rule `generic-api-key`, at the locations the 7 baseline entries record. A fake token assembled at run time and never committed was detected (exit 1) in a new `.md` file, after being removed in a later commit, on a side branch, as an AWS-shaped key pair and as a PEM block. A clean commit passed. The repository's own `scripts/secret-scan-control.ts` passed. Not run: a planted secret on a GitHub throwaway branch (I did not push a fake secret to a public repository; the local run uses the same pinned binary and config) |
| AC-6 | QA: 29 tests `[AQP-27 AC-6]` (26 must fail, 3 must pass); developer `layer-rules.test`; 42 manual stdin probes | DT, EG | Pass | `npx eslint .` exit 0 (the repository lints clean). Every rule fires: src/lib importing src/server (alias, relative, nested relative), src/app, src/components, `next/*`, Prisma, generated Prisma, `pg`, `export ... from`, literal `import()`; a service importing Prisma; a page or component importing a repository or the formula engine; an Engineer view importing a cost, calculation or rate repository or lib/formula; `eval`, indirect `eval`, `globalThis.eval`, `new Function`, `Function()`, string `setTimeout`; `import(variable)` and `import(template)`; `'use server'` at top, double-quoted, inside a function, and in `tests/`; `console.log`, `any`, non-null assertion. Allowed cases pass (repository importing Prisma, Lead view importing a cost repository, clean file). 42 of 42 manual probes matched expectation; 0 unexpected |
| AC-7 | QA: 10 tests `[AQP-27 AC-7]`; developer `placeholder-pattern.test`, `seed-guard.test` | BVA, EP | Pass | Planted `100`, `12.5`, `12.38`, `'12.370'`, `'1,250.00'`, `-3.37` and a nested `4.4` are all reported by path; `1.37`, `'104.37'`, `0.37` pass. The committed `placeholderMasters` conform. `NODE_ENV=production npx tsx prisma/seed/index.ts` exits 1 with the refusal; with `NODE_ENV=development` it prints "nothing to load yet" |
| AC-8 | QA: 10 tests `[AQP-27 AC-8]`; developer `coverage-scope.test`, `changed-coverage.test`, `pending-tests.test`; manual threshold attacks | BVA, EG | Pass | Config thresholds 80 for package; 95 for `src/lib/formula/**`; provider v8; retries 0. The thresholds bite: `vitest run tests/unit/errors.test.ts --coverage` exits 1 (lines 5.21 percent, below 80). In a scratch clone I added an untracked `src/lib/formula/` file with one covered and one uncovered function: stage 6's command exits 1 on both the package gate and the `src/lib/formula/**` gate (16.66 percent, below 95). Changed-code gate: 99.5 percent (210 of 211) as CI reports; fails at `--threshold 100` naming `src/lib/env.ts:66`; fails closed on a missing lcov file. Pending-test scanner: all of `todo`, `skip`, `only`, `fails`, `skipIf`, `runIf`, bracket forms, option objects, `ctx.skip()`, destructured `skip()`, alias and chained forms flagged (25-case probe, 0 missed); clean test not flagged. Limits are in OBS-7 |
| AC-9 | Developer `database-roles.test` (10 tests); QA: 24 tests `[AQP-27 AC-9]`; manual compose run | DT, EG | Pass | `docker compose -p qa27 -f compose.dev.yml -f <port override> up -d db` healthy; `npx prisma migrate deploy` exit 0 ("No migration found in prisma/migrations": nothing to apply, so the migrate path is proven to connect, not to migrate). Image `postgres:17@sha256:3b0cda93...84e1` (digest read back from the running container and the compose config), port bound to `127.0.0.1` only, `docker compose config` refuses to run without `DB_OWNER_PASSWORD` and `DB_APP_PASSWORD`. Roles: `accucut_owner` (not superuser, no create-role, owns the database) and `accucut_app` (member of no role). The runtime role is refused: `SET ROLE` to owner or `postgres`, create table in `public`, temporary tables, `CREATE EXTENSION`, `pg_authid`, `pg_read_file`, `COPY ... PROGRAM`, create role, create database, drop database, alter/drop/truncate on the owner's table. It can read and write rows of a table the owner created later; it can create in no schema. Granting itself rights has no effect |
| AC-10 (negative) | Developer `db-guard.test` and `global-setup-wiring.test`; QA: 23 tests `[AQP-27 AC-10]`; 29-case manual probe | DT, BVA, EG | Pass | Refused with a plain message that never contains the password or the URL: remote host; `localhost.<remote>`; `127.0.0.1.<remote>`; loopback-in-userinfo trick; second `@` in the password; `?host=` override, two overrides (last remote), socket path; no host; percent-encoded `localhost`; `0.0.0.0`; `127.1`; non-PostgreSQL scheme; unreadable text; a remote `MIGRATE_DATABASE_URL` with a local `DATABASE_URL`; `NODE_ENV=production` with a local database. Accepted: `localhost`, `127.0.0.1`, `[::1]`, upper-case `LOCALHOST`, `db`, `postgres`, and the staging host only when `STAGING_DB_HOST` names it (blank refused). `?hostaddr=` is not checked, but the Node driver ignores it (connected to the local database with `hostaddr` set to a documentation address). Variants of `NODE_ENV` other than lower-case `production` are not refused (OBS-2) |

All 10 ACs pass: AC coverage 10 of 10.

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| **Attempt 2, `60eeb67`:** full regression, idle machine | `npx vitest run --coverage` with the throwaway database (project `qa28`) | 506 (23 files) | 506 | 0 | 0 | about 45 s |
| Attempt 2: same command, a second time | as above | 506 | 506 | 0 | 0 | 26 to 45 s |
| Attempt 2: same command with `npm ci` running in the background, and again with `tsc`, `eslint` and `next build` running | as above | 506 | 505 | 1 | 0 | n/a |
| Attempt 2: CRLF checkout, unit suite | `npx vitest run tests/unit` in a fresh `core.autocrlf=true` clone of `60eeb67` | 369 (19 files) | 369 | 0 | 0 | n/a |
| Attempt 1: QA acceptance tests | `npx vitest run tests/acceptance` with the QA database | 126 | 126 | 0 | 0 | 22 s |
| Attempt 1: full regression on `5390559` | `npx vitest run --coverage` with the QA database | 377 (21 files) | 377 | 0 | 0 | 32 s |
| Attempt 1: full regression plus QA tests | `npx vitest run --coverage` | 503 (23 files) | 503 | 0 | 0 | 44 s |
| Stage 6 command | `npx vitest run tests/unit --coverage --coverage.include='src/lib/**/*.{ts,tsx}' --coverage.include='scripts/lib/**/*.ts'` | 366 | 366 | 0 | 0 | n/a |
| End to end, three widths | `npx playwright test` (projects mobile 360, tablet 768, desktop 1366) | 3 | 3 | 0 | 0 | 22 s |
| Lint | `npx eslint .` | n/a | exit 0 | | | |
| Type-check | `npx tsc --noEmit` | n/a | exit 0 | | | |
| Build | `npx prisma generate && npx next build` | n/a | exit 0 | | | |
| Migrations | `npx prisma migrate deploy` (QA database) | n/a | exit 0, none to apply | | | |
| Dependency audit | `npm audit --omit=dev --audit-level=high` | n/a | exit 0 | | | |
| Licence check | `npx tsx scripts/check-licences.ts` | n/a | pass | | | |
| Data-file check | `npx tsx scripts/check-data-files.ts` | n/a | pass | | | |
| Secret scan | Gitleaks 8.30.1 `git --redact --config .gitleaks.toml --baseline-path .gitleaks-baseline.json .` | 94 commits | no leaks | | | |

Coverage on the branch as pushed: statements 99.17, branches 96.73, functions 100, lines 99.52 percent; changed-code gate 99.5 percent (210 of 211). With the QA tests it is lines 100 and changed-code 100 percent (211 of 211). No test was skipped, weakened or removed. Retries are 0 in Vitest; Playwright allows one retry and none was used (3 passed first time). The Vite config loader prints a warning on every run (OBS-5).

**Database used.** `.env` does not exist in this tree, and the dev database already running on port 55432 belongs to the developer, so I did not use it. I started an isolated project from the unchanged `compose.dev.yml` (`-p qa27`, with an override that only moves the host port to 55433) and throwaway passwords generated for the session and kept outside the repository. Connection hosts were loopback; the guard accepted them. The QA project is left running for the master's re-checks; remove it with `docker compose -p qa27 -f compose.dev.yml down -v` (needs the two password variables set to any value).

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| No secret, real rate, master data or workbook value in the branch | NFR-006, ADR-014 | Diff `origin/master...HEAD` is 72 files, 0 binary, 0 non-ASCII added lines, no `docs/`, `CLAUDE.md`, `.claude/` or workbook file touched. Every decimal in the added lines is either a version number, an invented `n.37` value, or a deliberately non-conforming planted example in a test (`12.5`, `100`, `1,250.00`). Gitleaks over full history with the baseline: no leaks; baseline is exactly 7 entries holding locations and metadata only (keys checked: no `Match`, no `Secret`). I did not open `AMADA-20261006.xlsx`, and so I could not compare any value with it; the check is by reading the added lines | Pass |
| Gitleaks baseline unchanged and not quoted | NFR-006 | 7 entries before and after; this report names no accepted text | Pass |
| Lint, type-check, coverage gates | NFR-025 | See table above; thresholds proven to fail | Pass |
| No horizontal scroll at three widths | NFR-016 | Playwright smoke at 360, 768 and 1366 px | Pass (home page only; no other page exists) |
| Accessibility | NFR-018 | Not applicable: no screen beyond the placeholder home page; axe arrives with 10.08, stage 12 is disabled | Not run |
| Security smoke: error leakage | NFR-002 family | Invalid-environment start-up prints names, never values (3 sentinels, 0 hits); database guard and test setup never print the password | Pass |
| Security smoke: header | architecture 8 | Built server, valid invented environment: `200`, no `X-Powered-By` | Pass |
| Security smoke: database privileges | NFR-001 family | 15 escalation attempts by the runtime role, all refused (AC-9) | Pass |
| Performance timing | NFR-008 to 011 | No performance NFR applies to a scaffold. CI job took 119 seconds (05:24:36 to 05:26:35 UTC) | Informational |
| Node 22 | engines | Not run locally (Node 24). CI runs Node 22 and is green | Not run locally |

## Exploratory Testing

**Charter (test plan 16, adapted to this story).** Mission: break the negative controls, so that a fake secret, a data file, a layer violation, a pending quantity test, a pending-coverage gap or a wrong database could get through. Time-box set by the plan: 60 minutes; elapsed time was not clocked. Areas, in risk order:

1. **Secret scan (Tier A).** 7 attacks on a throwaway repository with the project's config and baseline: the accepted sentence copied into a new file and commit (still fails, so the baseline is not a path or pattern allow-list); a planted token in a Markdown file; removed in a later commit; on a side branch; AWS-shaped pair; PEM block. All detected. Observation: a PostgreSQL URL with a generated password in a plain file was **not** detected by the default rules (OBS-3).
2. **Data-file check.** 44 index-only entries in a throwaway repository (index-only so Windows case-insensitivity and trailing-space names could be tried). Findings in OBS-1.
3. **Lint layer rules.** 42 stdin probes plus the 29 acceptance cases; no bypass found, including relative paths, aliases, type-only imports, `export *`, `require`, `.mjs` and `.tsx` variants.
4. **Database guard.** 29 URL and `NODE_ENV` variants, compared with how `pg-connection-string` reads the same URL; the userinfo and second-`@` tricks resolve to the remote host in both readers and are refused. Findings OBS-2 (and `hostaddr`, safe).
5. **Database roles.** 15 privilege-escalation statements as the runtime role; none worked.
6. **Start-up.** Built server with invalid, partial and valid environments: DEF-001.
7. **Clean clone.** CRLF checkout: DEF-002.
8. **Coverage gates.** Partial run, planted `src/lib/formula` file, changed-code gate at 100 percent and with a missing lcov file.

Not covered: Firefox and WebKit; a real phone; screen reader and high-contrast checks (test plan 12; no UI yet, they are due at 10.02); Linux locally; the CI runner's own logs line by line (I read each step's conclusion through the API and reproduced the secret scan, data-file check, lint, type-check, build, unit and integration stages locally).

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-001 ([AQP-166](https://sankumar76.atlassian.net/browse/AQP-166), [#21](https://github.com/sankumar76/Accucut-Quotation/issues/21)) | Invalid environment at start-up leaves the server running and answering HTTP 500 | Sev-2 (master's ruling, Jira 10671; QA first rated it Sev-3) | **Closed**, verified on `60eeb67` | AC-3 |
| DEF-002 ([AQP-167](https://sankumar76.atlassian.net/browse/AQP-167), [#22](https://github.com/sankumar76/Accucut-Quotation/issues/22)) | `ci-workflow.test.ts` fails on a Windows clone with default Git line endings | Sev-3, type Test | **Closed**, verified on `60eeb67` | AC-4 (regression) |
| DEF-003 ([AQP-168](https://sankumar76.atlassian.net/browse/AQP-168), [#24](https://github.com/sankumar76/Accucut-Quotation/issues/24)) | `layer-rules.test.ts` first test times out at 30 s when the machine is busy | Sev-3, type Test | New (open) | AC-6 (regression) |

Open by severity: Sev-1 0, Sev-2 0, Sev-3 1, Sev-4 0. The Jira Bugs are linked to AQP-27 ("relates to") with labels `ai-delivery`, `aiid-DEF-nnn`, `agent-qa-engineer` and the severity label; the GitHub issues carry `bug`, a severity label and `ai-delivery`. Records are in `docs/07-qa/defects/`: DEF-001 and DEF-002 (updated in this commit) and DEF-003 (written, untracked, see "Artefacts").

## Attempt 2 re-test (on `60eeb67`)

**DEF-001, built standalone server** (`npx prisma generate && npx next build` exit 0 with no environment; then `node server.js` in `.next/standalone` with a cleaned environment; all values invented; sentinel strings placed in the invalid variables):

| Scenario | Result |
|---|---|
| One invalid variable, the rest unset | Exit 1. One stderr line: `Invalid environment: DATABASE_URL (missing), AUTH_SECRET (invalid), APP_ORIGIN (missing), SMTP_AUTH_MODE (missing). Check .env against .env.example.` Port not listening afterwards |
| Empty environment | Exit 1; four names missing |
| Three variables invalid, each holding a sentinel | Exit 1; names only; sentinels occur 0 times in the log |
| `/` polled every 0.3 s during an invalid start | Never answered (connection failures only); server exit 1 |
| `next start`, invalid environment | Exit 1, same line, 0 occurrences of the sentinel |
| Complete invented environment | `GET /` 200; no `X-Powered-By`; no error line; still running 4 s later |

**DEF-002:** fresh `git -c core.autocrlf=true clone` of `60eeb67` (269 files `w/crlf`, including the workflow and its test): `tests/unit/ci-workflow.test.ts` 8 of 8; whole unit suite 369 of 369. On `5390559` the same kind of checkout failed 1 test.

**Regression on `60eeb67`:**

| Check | Result |
|---|---|
| `npx eslint .` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npx prisma generate && npx next build` | exit 0; routes `/` and `/_not-found` |
| `npx prisma migrate deploy` (throwaway project `qa28` from the unchanged `compose.dev.yml`, host port moved to 55433) | exit 0, nothing to apply |
| `npx vitest run --coverage` | 23 files, 506 of 506, twice on an idle machine; statements 99.59, branches 96.77, functions 100, lines 100 percent; changed-code coverage 100 percent (215 of 215) |
| `npx playwright test` | 3 of 3 (mobile, tablet, desktop), 21.5 s |
| `npx tsx scripts/check-data-files.ts`, `check-licences.ts` | pass, pass |
| `npm audit --omit=dev --audit-level=high` | exit 0 |
| Gitleaks 8.30.1, full history, baseline | 97 commits, no leaks; baseline exactly 7 entries; `scripts/secret-scan-control.ts` passes |
| CI run 41591216308 on `60eeb67` | all stages success, 12 and 13 skipped by design |
| Scope of `60eeb67` | `src/instrumentation.ts`, `tests/unit/ci-workflow.test.ts`, `tests/unit/instrumentation.test.ts` only |

**DEF-003 (new).** The same suite run while `npm ci` was running, and again while `tsc`, `eslint` and `next build` ran in another checkout, failed one test both times: the first case of `tests/unit/lint/layer-rules.test.ts` ("static import fails lint: src/lib imports src/server (alias)"), `Test timed out in 30000ms`. The file passes alone (67 of 67) and the whole suite passes twice when idle. Cause: the first case loads the ESLint configuration inside its own 30 s limit. Raised as a defect of type Test (test plan section 7). QA's own acceptance cases did not fail under the same load (180 s limit each).

## Observations (not defects; for the master to route)

| ID | Observation | Suggested home |
|----|-------------|----------------|
| OBS-1 | The data-file extension list does not cover `.xml`, `.zip`, `.gz`, `.tar.gz`, `.sqlite`, `.sqlite3`, `.db`, `.mdb`, `.numbers`, `.txt`, `.pdf`, `.bak`, `.yaml`, `.yml`: a zip of a workbook passes stage 3. The script reads `git ls-files`, so it judges the checked-out tree, not history: a data file added in one commit of a PR and removed in the next passes while staying public in history. AC-5 names only `.csv`, `.xlsx`, `.json`, so this is not a failure | Extend follow-up #19 (it already defers `.yaml`) |
| OBS-2 | `NODE_ENV` is matched as exactly `production`. `Production`, `PRODUCTION` and `production ` are not refused. Next.js also treats only lower-case `production` as production, so the practical risk is small; the host rule is the real protection | Developer, hardening |
| OBS-3 | Gitleaks default rules did not flag a PostgreSQL URL holding a generated password in a plain text file. `.env.example` is protected by its own test (QLT-19), but a README or doc line would not be | Standards reviewer, README rule |
| OBS-4 | The repository still allows merge commits (`allow_merge_commit: true`; squash on, rebase off). Master's condition 4 (squash only) depends on the person merging | Master, condition 4 |
| OBS-5 | Every Vitest run prints a Vite warning: the config imports `./scripts/lib/coverage-scope` without a file extension, unsupported by Vite's future default loader | Developer, Sev-4 backlog |
| OBS-6 | Architecture section 11 names `sonner`, `cmdk`, `react-day-picker`, `react-resizable-panels` ("pinned at scaffold"), axe 4.14.0 and Lighthouse CI 0.15.1, none of which is installed. Every installed version matches section 11 | Already tracked: follow-up #13 |
| OBS-7 | The pending-test scanner is text-based. It misses a computed property name (`it[k]`) and cannot see a vacuous test (empty body, early `return`). For story 03.04 the control is `quantity-cases-complete` plus QA reading every CE case, as the test plan 5 requires | QA, story 03.04 |

## Residual Risks / Notes

- DEF-001 and DEF-002 are closed. DEF-003 is open (Sev-3, type Test): green on an idle machine and on CI, red when the machine is busy.
- The QA acceptance tests are in the PR (commit `6ea8497`, made by the coordinator) and run in CI stage 11, which has the Postgres service; changed-code coverage is 100 percent. They were written after I read the implementation tests, so they add independent negative cases rather than independent first-pass coverage; I say so rather than claim otherwise.
- The QA throwaway database project `qa28` was removed after the re-test (project `qa27` from attempt 1 was removed before it). Scratch clones and logs sit in the session's temporary folder, outside the repository.
- `npx prisma migrate deploy` has no migration to apply, so "the migration command succeeds" is proven for connection and permissions only.
- AC-5 was not exercised as a pull request from a throwaway branch on GitHub.
- RISK-006 (real data in a public repository) is reduced by these controls, not removed: the data-file list is by extension (OBS-1) and the baseline accepts 7 documentation sentences by commit.
- Test plan updates owed by QA (not made, to keep this commit to one file): section 17 commands are now verified for 10.01 (Playwright project names are `mobile`, `tablet`, `desktop`, answering QA-A2; `tests/acceptance/` now exists); add the CRLF clean-clone check and the built-server start-up check to the 10.01 row.

## Artefacts

Committed by the coordinator in `6ea8497`: `tests/acceptance/aqp-27-scaffold.test.ts`, `tests/acceptance/aqp-27-database-roles.test.ts`, the first versions of the DEF-001 and DEF-002 records.

Committed with this update: `docs/07-qa/AQP-27-test-report.md`, `docs/07-qa/defects/DEF-001-env-validation-does-not-stop-the-server.md`, `docs/07-qa/defects/DEF-002-ci-workflow-test-fails-on-crlf-checkout.md`.

Written by QA and left untracked (not staged, not pushed), to be committed on the master's or coordinator's word: `docs/07-qa/defects/DEF-003-layer-rules-test-times-out-under-load.md`.

## Hand-off
- Status: COMPLETE
- Recommendation (G7 attempt 2): ACCEPT (Sev-1 0, Sev-2 0, Sev-3 1, Sev-4 0)
- Jira / GitHub: AQP-166 and #21 and AQP-167 and #22 closed after verification; AQP-168 and #24 opened; summary comments on AQP-27 and PR #16
- Story status: not changed by QA
