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
npx next dev
```

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
| Unit tests with coverage | `npx vitest run tests/unit --coverage` |
| Integration tests (needs the database above) | `npx vitest run tests/integration` |
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

## Continuous integration

`.github/workflows/ci.yml` runs stages 1 to 11 of the test strategy (install, secret scan,
data-file check, lint, type-check, unit with coverage, audit, licences, build, migrations, integration)
on every pull request, in order; stages 12 (end-to-end) and 13 (image) are present and disabled until
the stories that give them something to run. The workflow uses no secret and no production setting.

## Secret scan and its baseline

Gitleaks reads the whole history on every pull request. It reported six findings on the history that
existed before the scan, all documentation text about passwords (a sentence in the requirements file that
names the hashing algorithms, and the BR-049 wording in the requirements catalogue), not credentials. The
flagged text is deliberately not quoted here: quoting it makes the scan flag this file. On 2026-11-02 the
delivery lead decided to accept exactly those six through `.gitleaks-baseline.json`, which CI stage 2 passes
with `--baseline-path`. It is not an allow-list: no path or pattern is exempt, no rule is changed, and
nothing was removed from history. A new finding, or the same text on a different line or in a new commit,
still fails the scan; `scripts/secret-scan-control.ts` proves this with the baseline in use.

The baseline holds locations and commit metadata only (rule, file, line and column range, commit, author,
e-mail, date and message, entropy), never the matched text; the scan must use `--redact`. Because an entry
includes the line number, editing one of those three lines of text moves its finding and CI fails. In that case
regenerate the baseline, review the diff, and get the delivery lead's agreement:

```sh
gitleaks git --redact --config .gitleaks.toml --report-format json --report-path report.json .
npx tsx scripts/make-gitleaks-baseline.ts --report report.json   # then delete report.json
```

## Repository rules enforced by the checks

- **Exact versions only**; `package-lock.json` committed; install scripts run only for the packages
  listed in `allowScripts` in `package.json`. Never run `npm i prisma` without a version: the `latest`
  tag points to a release candidate.
- **No data files** (`.csv`, `.xlsx`, `.json` and similar) except the exact paths in
  `scripts/lib/data-files.ts`. Placeholder numbers in `prisma/seed/placeholders/` must end in `.37`.
- **Layering** (ESLint): `src/lib` is pure; only `src/server/repositories` imports Prisma; Engineer code
  never imports a cost repository or the formula engine; no `eval`, `new Function`, computed dynamic
  `import` or `'use server'`.
- `.env` is never committed; `.env.example` is, with placeholders only.
