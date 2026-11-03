# Test Report — AQP-27 (STORY-10.01): Scaffold, CI and repository hygiene

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `5390559` on `feat/AQP-27-scaffold-ci` (PR #16, `sankumar76/Accucut-Quotation`) |
| CI | Run 41583743245, event `pull_request`, job "Stages 1 to 11" success; stages 12 and 13 skipped by design (`if: ${{ false }}`) |
| Environment | Windows 11; Node v24.19.0, npm 11.17.0 (CI uses Node 22); Docker 29.8.0; PostgreSQL 17.11 from `compose.dev.yml` (see "Database used"); Chromium via Playwright 1.64.1 |
| Date | 2026-11-03 |
| **Recommendation** | **ACCEPT**, with two open Sev-3 defects (DEF-001, DEF-002) that do not block G7. One reading of AC-3 would turn DEF-001 into Sev-2; the master should confirm the reading (see "Decision for master") |

## Summary

All ten acceptance criteria were verified with evidence, by the existing suite, by new QA acceptance tests and by exploratory attacks on every negative control (secret scan, data-file check, lint layer rules, coverage gates, pending-test scanner, database guard, role privileges). The full regression is green: eslint, tsc, build, Vitest (377 tests, 21 files, 0 failed, 0 skipped) with the dev database, Playwright 3 of 3 on mobile, tablet and desktop. No secret, real rate, master datum or workbook value is added by the branch (ADR-014). Two Sev-3 defects were found; neither is a Sev-1 or Sev-2 under the reading stated below.

## Decision for master (read this first)

1. **DEF-001 (AQP-166, GitHub #21), AC-3 "fails fast".** With an invalid environment the log names the variables and prints no value, but the server process stays up and answers HTTP 500 to every request, instead of exiting. It fails closed. I read "fails fast" as "fails at start-up, not at first use", so AC-3 passes and the defect is Sev-3. If you read "fails fast" as "the process exits", AC-3 fails with a workaround and DEF-001 becomes Sev-2, which blocks G7 until fixed. The fix is small (`src/instrumentation.ts`).
2. **DEF-002 (AQP-167, GitHub #22), type Test.** One unit test fails on a Windows clone with default Git line endings (CRLF). CI is Linux, so it is green. The delivery lead works on Windows.
3. **Uncommitted QA files.** Per the brief, only this report is committed. My acceptance tests (126 tests) and the two defect records are in the working tree, untracked and not pushed (list in "Artefacts"). Once committed they run in CI stage 11.

## AC Verification Matrix

Test IDs are titles of the form `[AQP-27 AC-n]` in `tests/acceptance/aqp-27-scaffold.test.ts` and `tests/acceptance/aqp-27-database-roles.test.ts` (QA, new), or the developer's tests named in the table. Techniques: BVA = boundary-value analysis, EP = equivalence partitioning, DT = decision table, EG = error guessing.

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 | QA: 5 tests `[AQP-27 AC-1]`; manual clean-clone install and build | EP, EG | Pass | Fresh clone of `5390559` in a scratch folder: `npm ci` exit 0, `npx prisma generate && npx next build` exit 0 (routes `/` and `/_not-found`). All 32 dependencies match `^\d+\.\d+\.\d+$` (0 with `^`, `~`, range or tag). `prisma` and `@prisma/client` both 7.10.1. `overrides` equals `{"next-auth":{"nodemailer":"$nodemailer"}}`; `npm ls` shows next-auth resolving `nodemailer@10.3.1` (deduped). `package-lock.json` tracked. `.npmrc` has `legacy-peer-deps=false`; no `--legacy-peer-deps` or `--force` in the workflow. Installed versions agree with architecture section 11 (see OBS-6 for what section 11 names that is not installed) |
| AC-2 | QA: 5 tests `[AQP-27 AC-2]`; `npx tsc --noEmit` | EP | Pass | tsc exit 0. `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` all true. `next.config.ts`: `output 'standalone'`, `images.unoptimized true`, `serverExternalPackages ['exceljs','@node-rs/argon2']`, `poweredByHeader false`. The built server sends no `X-Powered-By` header |
| AC-3 | QA: 7 tests `[AQP-27 AC-3]`; developer `env.test`, `env-example.test`, `dotenv-loading.test`, `instrumentation.test`; manual start-up of the built server | EP, EG | Pass, with DEF-001 on "fails fast" | `git check-ignore -v .env.example` prints nothing and exits 1 (not ignored). `.env`, `.env.local`, `.env.production`, `.env.staging` are ignored. The only tracked env file is `.env.example`. Invalid start-up: the log lists `DATABASE_URL (invalid), AUTH_SECRET (invalid), APP_ORIGIN (missing), SMTP_AUTH_MODE (missing)`; three sentinel values I placed in the variables occur 0 times in the log. The process then stays up and returns 500 (DEF-001). I did not open `.env.example`; the tests that read it pass |
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
| QA acceptance tests (new, uncommitted) | `npx vitest run tests/acceptance` with the QA database | 126 | 126 | 0 | 0 | 22 s |
| Full regression (branch as pushed) | `npx vitest run --coverage` with the QA database | 377 (21 files) | 377 | 0 | 0 | 32 s |
| Full regression (branch plus QA tests) | `npx vitest run --coverage` | 503 (23 files) | 503 | 0 | 0 | 44 s |
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
| DEF-001 ([AQP-166](https://sankumar76.atlassian.net/browse/AQP-166), [#21](https://github.com/sankumar76/Accucut-Quotation/issues/21)) | Invalid environment at start-up leaves the server running and answering HTTP 500 | Sev-3 (Sev-2 under the strict reading of "fails fast") | New | AC-3 |
| DEF-002 ([AQP-167](https://sankumar76.atlassian.net/browse/AQP-167), [#22](https://github.com/sankumar76/Accucut-Quotation/issues/22)) | `ci-workflow.test.ts` fails on a Windows clone with default Git line endings | Sev-3, type Test | New | AC-4 (regression) |

Open by severity: Sev-1 0, Sev-2 0, Sev-3 2, Sev-4 0. Both Jira Bugs are linked to AQP-27 ("relates to") with labels `ai-delivery`, `aiid-DEF-nnn`, `agent-qa-engineer`, `sev-3`; both GitHub issues carry `bug`, `sev-3`, `ai-delivery`. Records: `docs/07-qa/defects/DEF-001-env-validation-does-not-stop-the-server.md` and `docs/07-qa/defects/DEF-002-ci-workflow-test-fails-on-crlf-checkout.md` (uncommitted, see below).

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

- DEF-001 and DEF-002 are open. Both are cheap to fix and neither touches a price, a role or a secret.
- The QA acceptance tests are not in the PR. When they are committed, CI stage 11 runs them (they need the Postgres service, which stage 11 has) and the changed-code figure becomes 100 percent. They were written after I read the implementation tests, so they add independent negative cases rather than independent first-pass coverage; I say so rather than claim otherwise.
- `npx prisma migrate deploy` has no migration to apply, so "the migration command succeeds" is proven for connection and permissions only.
- AC-5 was not exercised as a pull request from a throwaway branch on GitHub.
- RISK-006 (real data in a public repository) is reduced by these controls, not removed: the data-file list is by extension (OBS-1) and the baseline accepts 7 documentation sentences by commit.
- Test plan updates owed by QA (not made, to keep this commit to one file): section 17 commands are now verified for 10.01 (Playwright project names are `mobile`, `tablet`, `desktop`, answering QA-A2; `tests/acceptance/` now exists); add the CRLF clean-clone check and the built-server start-up check to the 10.01 row.

## Artefacts

Committed with this report: `docs/07-qa/AQP-27-test-report.md`.

Written by QA and left untracked in the working tree (not staged, not pushed), to be committed on the master's or orchestrator's word:
- `tests/acceptance/aqp-27-scaffold.test.ts`
- `tests/acceptance/aqp-27-database-roles.test.ts`
- `docs/07-qa/defects/DEF-001-env-validation-does-not-stop-the-server.md`
- `docs/07-qa/defects/DEF-002-ci-workflow-test-fails-on-crlf-checkout.md`

## Hand-off
- Status: COMPLETE
- Recommendation: ACCEPT (Sev-1 0, Sev-2 0, Sev-3 2, Sev-4 0; DEF-001 would be Sev-2 under the strict reading of AC-3)
- Jira / GitHub: AQP-166 and #21; AQP-167 and #22; summary comments on AQP-27 and PR #16
- Story status: not changed by QA
