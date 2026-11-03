# Accucut Quotation Portal

A role-based web portal that replaces the Accucut Lasers manufacturing cost-estimate worksheet.
Admin, Leads and Engineers assign, enter, calculate, approve and export estimates; Engineers never see a cost.

This repository is **public**. Never commit a secret, a real rate, a price or any master data
(NFR-006, ADR-014). Design documents are in [`docs/`](docs/); the stack and rules are in
[`docs/04-architecture/architecture.md`](docs/04-architecture/architecture.md).

## Stack

TypeScript (strict), Node.js 22 LTS, Next.js 16 (App Router), React 19, Tailwind CSS 4,
PostgreSQL 17 with Prisma 7, next-auth 4, ExcelJS, Nodemailer. Versions are pinned exactly in
`package.json` (architecture section 11).

## Set up a development machine

You need Node.js 22.12 or later, npm 11.17 or later (`npm install --global npm@11.17.0`) and Docker.

```sh
npm ci                                   # lockfile only; never `npm install` to set up
cp .env.example .env                     # then replace every CHANGE_ME value (letters and digits only)
docker compose -f compose.dev.yml up -d db
npx prisma generate
npx prisma migrate deploy
node --conditions=react-server --import tsx scripts/ensure-seed-version.ts   # the field registry, once; see below
npx next dev
```

**The field registry (configuration version 1).** `scripts/ensure-seed-version.ts` stores the SPEC section 7
field registry (`prisma/seed/config/seed-config.ts`) as configuration version 1 with the owner role
(`MIGRATE_DATABASE_URL`). It runs after `prisma migrate deploy` and **only if no version exists**, so running it
again, or after the seed module has changed, changes nothing. It holds structure, never master data. The
runtime role has no UPDATE or DELETE grant on `config_versions`, and a trigger refuses every update, delete
and truncate, the owner's included. The owner role can still disable that trigger with DDL, so protection
against the owner depends on every migration being reviewed. If the step fails it exits with an
error. Column letters are derived from field position (`src/lib/columns.ts`) and are never stored.

**The formula engine (`src/lib/formula`).** A tokenizer, a Pratt parser and a tree-walking evaluator over
decimal.js (`src/lib/decimal.ts`, 34 digits, half-up). It is pure and **server-only**: every file starts with
`import 'server-only'`, so a client component that imports it fails the build. The `server-only` package throws
under plain Node and loads under the `react-server` export condition, so anything outside Next.js that imports the
engine runs with `node --conditions=react-server --import tsx` (the registry seed step above is one); Vitest maps
the package to an empty module (`vitest.config.ts`), and `tests/unit/formula/server-only.test.ts` shows the real
package's behaviour. `src/lib/formula/internal-form.ts` is the one converter between display form (`P * Foam
Cost`) and the stored form (`{{f:<id>}}`, `{{rate:<id>}}`, `{{mat:<key>}}`, `{{fx:USD}}`). Formula error messages
state a rule and a character number and never repeat text from the formula.

The development database listens on `127.0.0.1:55432` only. It has two roles, created by
`docker/postgres-init/01-create-roles.sh` on first start:

| Role | Used by | Rights |
|------|---------|--------|
| `accucut_owner` | migrations (`MIGRATE_DATABASE_URL`) | owns the schema; runs DDL |
| `accucut_app` | the app and worker (`DATABASE_URL`) | read and write rows; **no DDL** |

To start again from an empty database: `docker compose -f compose.dev.yml down -v`.

The app refuses to start if a required variable in `.env` is missing or still a `CHANGE_ME`
placeholder; the message names the variable and never prints a value.

## Checks (the same ones CI runs)

| Check | Command |
|-------|---------|
| Lint, including the layer rules | `npx eslint .` |
| Type-check | `npx tsc --noEmit` |
| Unit tests, coverage of pure code (CI stage 6) | `npx vitest run tests/unit --coverage --coverage.include='src/lib/**/*.{ts,tsx}' --coverage.include='scripts/lib/**/*.ts'` |
| Every test level with combined coverage (CI stage 11; needs the database above) | `npx vitest run tests/unit tests/integration tests/security tests/acceptance --coverage` |
| Coverage of the lines a pull request adds (CI stage 11, pull requests only) | `npx tsx scripts/check-changed-coverage.ts --base origin/master` (after the line above) |
| Integration tests only (needs the database above) | `npx vitest run tests/integration` |
| All tests | `npx vitest run` |
| Build | `npx prisma generate && npx next build` |
| End-to-end, three screen sizes | `npx playwright install chromium` once, then `npx playwright test` |
| Data-file allow-list | `npx tsx scripts/check-data-files.ts` |
| Licence allow-list | `npx tsx scripts/check-licences.ts` |
| Dependency audit | `npm audit --omit=dev --audit-level=high` |
| Secret scan (full history) | `gitleaks git --redact --config .gitleaks.toml --baseline-path .gitleaks-baseline.json .` (Gitleaks 8.30.1) |
| Secret-scan control | `GITLEAKS_BIN=<path> npx tsx scripts/secret-scan-control.ts` |

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build` and `npm run test:e2e` are aliases.

Tests refuse to start against a database that is not local, CI or staging, and refuse
`NODE_ENV=production` (`tests/support/db-guard.ts`). For a staging database, set `STAGING_DB_HOST`.
The test run loads `.env` first (`tests/support/global-setup.ts`), without overriding a variable that is
already set, so the guard and the integration tests see the same settings as Prisma. You do not need to
export anything by hand after `cp .env.example .env`.

**Where coverage is decided.** Stage 6 has no database, so it measures only pure code (`src/lib`,
`scripts/lib`) on unit tests, with the 80 % gate and the 95 % and 100 % gates for the formula engine and
the other pure modules. Stage 11 runs every test level in one run, so a service or repository tested by an
integration test counts as covered; it decides the whole-package gate and the changed-code gate. The files
coverage measures are listed once, in `scripts/lib/coverage-scope.ts`: `src/server` is always measured, while
`src/app`, `src/components` and `src/worker/main.ts` (covered by end-to-end tests) are not.

## Continuous integration

`.github/workflows/ci.yml` runs stages 1 to 11 of the test strategy (install, secret scan,
data-file check, lint, type-check, unit with coverage of pure code, audit, licences, build, migrations,
integration with combined coverage) on every pull request, in order; stages 12 (end-to-end) and 13 (image) are present and disabled until
the stories that give them something to run. The workflow uses no secret and no production setting.

## Secret scan and its baseline

**What the scan reads.** `gitleaks git` reads every ref the checkout holds, and CI fetches every branch, so
"the whole history" means all branches on `origin`, not only `master`. One stray pushed branch with a finding
fails every pull request until it is deleted or accepted.

**What is accepted.** The first scan reported six findings on history that existed before it, all
documentation text about passwords (a sentence in the requirements file that names the hashing algorithms,
and the BR-049 wording in the requirements catalogue), not credentials. The flagged text is deliberately not
quoted here: quoting it makes the scan flag this file. On 2026-11-02 the delivery lead decided to accept
exactly those six, then a seventh (an early commit of this README quoted the sentence), through
`.gitleaks-baseline.json`, which CI stage 2 passes with `--baseline-path`. It is not an allow-list: no path
or pattern is exempt, no rule is changed, and nothing was removed from history.

**What the baseline holds.** Locations and commit metadata only (rule, file, line and column range, commit,
author, e-mail, date, message, entropy), never the matched text; the scan must use `--redact`. Gitleaks
recognises an entry by those fields, the commit among them, so an accepted finding is accepted only in that
commit and at that line. The same text on another line or in a new commit has no entry and fails the scan
(this is Gitleaks' matching rule, confirmed by scanning with an edited copy of the baseline). The unit test
`tests/unit/gitleaks-baseline.test.ts` pins the seven by fingerprint, which names the commit, and checks that
each entry is consistent with its own fingerprint. What `scripts/secret-scan-control.ts` shows is narrower:
with the baseline in use, a commit holding a fake GitHub-token-shaped string, built at run time, fails the
scan, and a clean commit passes.

**Merging: squash only, never rebase.** This repository squash-merges. After a squash the branch commits are
unreachable from `master`, so their entries stay in the file only as a record (the scan still reads them while
the branch exists). A rebase gives the same text a new commit, which no entry matches, so it fails the scan:
rebase merging is switched off, and a branch that is behind is updated with a merge.

**Editing an accepted line.** Editing one of the accepted documentation lines can move its finding. Try this
first: reword the line so it no longer matches the rule. A reworded line adds no finding, and the old entry
remains harmless. If the line has to keep text the rule flags, a new entry is needed, and a squash merge gives
the text a new commit that no entry names, so it takes two steps and two agreements:

1. In the pull request, regenerate the baseline (below) so the branch commit has an entry. CI passes. The
   delivery lead agrees this entry on the pull request in their own words, as for the first seven.
2. After the squash, `master` fails stage 2 until a second, baseline-only pull request adds an entry for the
   squash commit, which cannot be known before the merge. The delivery lead agrees that too. Until it merges,
   `master` is red and every other pull request fails the same stage, so do the second step the same day.

```sh
gitleaks git --redact --config .gitleaks.toml --report-format json --report-path report.json .
npx tsx scripts/make-gitleaks-baseline.ts --report report.json   # then delete report.json
```

Review the diff of `.gitleaks-baseline.json` line by line before committing: the script accepts every
finding in the report, a real secret included. A per-line `gitleaks:allow` marker would avoid the second
step; whether to allow it is the delivery lead's decision and has not been taken.

## Repository rules enforced by the checks

- **Exact versions only**; `package-lock.json` committed; install scripts run only for the packages
  listed in `allowScripts` in `package.json`. Never run `npm i prisma` without a version: the `latest`
  tag points to a release candidate.
- **No data files** (`.csv`, `.xlsx`, `.json` and similar) except the exact paths in
  `scripts/lib/data-files.ts`. Placeholder numbers in `prisma/seed/placeholders/` must end in `.37`.
- **Layering** (ESLint, static imports and `import()`): `src/lib` is pure; only `src/server/repositories`
  imports Prisma; `src/app` and `src/components` import no repository and no formula engine (pages are shared
  by role, so every page and component is covered, not only an "Engineer" folder); Engineer views
  (`src/server/views/engineer-*`) import no cost repository; no `eval`, `new Function`, computed dynamic
  `import` or `'use server'`.
- `.env` is never committed; `.env.example` is, with placeholders only.
