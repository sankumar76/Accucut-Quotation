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

## First use: see the portal on your computer

Each screen is reviewed by running the portal on your own computer. There is no hosted preview. You need
Node.js 22.12 or later, npm 11.17 or later and Docker Desktop (running), on Windows, macOS or Linux. Run these
from the repository folder, one line at a time. They are direct commands, not `npm run` aliases.

```sh
npm ci
docker compose -f compose.dev.yml up -d db     # wait about 10 seconds the first time
cp .env.example .env                           # PowerShell or Command Prompt: copy .env.example .env
npx prisma generate
npx prisma migrate deploy
node --conditions=react-server --import tsx scripts/ensure-seed-version.ts   # the field registry, once
npx next dev
```

Every page now needs a signed-in person, so create the first Admin once (after filling in `.env`, below). Put an
e-mail address and a password of your choice in `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` in `.env`, then run:

```sh
npx tsx scripts/bootstrap-admin.ts
```

It creates one Admin who must choose a new password at first sign-in, stores only a hash of the password, and
never prints it. It refuses, and changes nothing, if any Admin already exists. Remove the password from `.env`
afterwards.

**Enter all 15 rates before any estimate is calculated.** The portal starts with the 15 named rates of the Process master
(cutting, bending, drilling, welding, galvanizing, primer, shot blasting, polishing, plating, powder coating, foam,
soft anodize, overhead profit, transport and inspection and packing), each with its name and unit and a value of 0. The
Admin types the real values on **Masters, Process master** (http://localhost:3000/masters/process) before anyone calculates
an estimate. Do this first because a rate left at 0 is a valid value: an estimate calculated before it is entered prices
that process at 0, and the portal shows no message. A rate whose name ends in % is typed as a whole percentage (12 means
12%). The values stay in your own database; they are never put in this repository (ADR-014).

Then open **http://localhost:3000/sign-in** in a browser and sign in. You land on the task queue ("Task queue"
for a Lead or an Admin, "My tasks" for an Engineer; a placeholder until the task list is built). **Sign out** is in
the account menu at the top right. Five wrong passwords for one e-mail block it for 15 minutes; the same happens
for 30 failures from one address. The design system page, **http://localhost:3000/design-system**, is the
colours, type, spacing, buttons, form controls, notices and states inside the page frame every screen will use
(top bar, side menu, and a menu button that opens the same menu as a drawer on a narrow window). The home page,
http://localhost:3000, links to it. Resize the window to see it at phone, tablet and desktop widths. The design
system is served only outside a production build; a production build answers "not found".

**Fill in `.env` first.** After copying, open `.env` in a text editor and replace every `CHANGE_ME` value. Use
letters and digits only for the two database passwords (they go into connection addresses). For `AUTH_SECRET`,
generate a long random value:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Every value in `.env` is a local placeholder for this one computer. None of them is a real password, and `.env`
is never committed. Sign-in reads the database, so the database lines must be right and `npx prisma migrate deploy`
must have run. If `next dev` stops at start with a message that names a
variable, that variable in `.env` is missing or still says `CHANGE_ME`; the message never prints a value.

**On a phone on the same Wi-Fi.** Start the server so that it listens on the network, with
`npx next dev -H 0.0.0.0`. Find the computer's address (`ipconfig` on Windows, the "IPv4 Address" line; it looks
like `192.168.1.20`), allow Node.js through the Windows firewall for private networks if asked, and open
`http://<that address>:3000/design-system` on the phone. Use this only on your own home or office network, never
on public Wi-Fi, and stop the server (Ctrl+C) when you are done: while it runs, anyone on that network can open
the portal and its development tools.

**To stop.** Press Ctrl+C in the window running `npx next dev`, then `docker compose -f compose.dev.yml down`.
That keeps the database for next time; `docker compose -f compose.dev.yml down -v` also erases it.

This section grows as screens arrive (the Dockerfile and a hosted copy in STORY-10.04). The next sections explain the same commands in more detail.

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

## Adding a page or an API route (who may open it)

Every page and every API route has one row in the route manifest, `src/server/http/route-manifest.ts`: its address, its
methods, the roles allowed (`'public'` for sign-in only), whether it is a menu entry, and whether it is `implemented` or
`planned`. Three things read that row, so a role is never allowed in one place and refused in another: the access check,
the menu (and `GET /api/v1/me`), and the tests.

- **An API route** is declared only with `withRoute` (`src/server/http/with-route.ts`):
  `export const GET = withRoute({ route: '/api/v1/…', method: 'GET', output: aStrictSchema, handler })`. It checks the origin
  of a state-changing request, the session, then the role from the row, before it reads any input; its answer must fit a
  strict schema; every failure is `application/problem+json` with a `req-…` reference.
- **A page** starts with `const user = await authorizePage('<its address>')` (`src/server/http/page-access.ts`). The layout
  only checks that someone is signed in. A signed-out visitor goes to sign-in and comes back; a role the row does not list
  sees "You do not have access to this page" (HTTP 403).
- **In the same change** add the row (set `status: 'implemented'`), the loader in `tests/support/route-loaders.ts`, and, for a
  state-changing route, nothing more: `tests/security` calls it as an Admin, a Lead, an Engineer and a signed-out visitor,
  compares the answers with the SPEC table, and fails a route file with no row, a handler without `withRoute` and a page
  without `authorizePage`.
- A route an Engineer may open is a decision: `tests/unit/http-route-manifest.test.ts` names every one. Its answer is parsed with
  one strict schema from `src/server/views/schemas`, whoever calls it, and an Engineer view (`src/server/views/engineer-*.ts`) may import only
  the repositories and services on the allow-list in `eslint.config.mjs` (everything else is refused, files that do not exist yet included),
  never `@/server/composition` or the schemas barrel, and no formula engine (lint). The scan below covers the route with no edit; a route or page
  with a dynamic segment also needs a real-value recipe in `tests/support/route-calls.ts`, so the scan opens a record that really exists.

## Cost confidentiality scan (NFR-002, SPEC section 14.1)

An Engineer must never be sent a rate, a calculated value or a formula. `tests/e2e/canary-scan.spec.ts` proves it on every pull request
(CI stage 12; it is never quarantined). It signs in as an Engineer on the production build, opens every page and calls every API route that the
route manifest lists for an Engineer, and looks in everything that came back (HTML, RSC payloads, JSON, headers, and the JavaScript chunks the
pages load) for the invented sentinels of `tests/support/canary-masters.ts`, in plain digits, Indian grouping and two decimals, and for rate names,
`{{f:`, `{{rate:`, `{{mat:` and the stored formula text. It also calls every Lead and Admin route as an Engineer (403 with the fixed body, no data) and
shows that it can fail: the Admin is sent the canary rates by the same routes and the scan finds them, a planted leak is reported, and
`/api/test-only/leak` is absent from the production build. Run it with `npx playwright test canary-scan` (needs the database above).

- **A story that adds an Engineer route** adds its manifest row and nothing to the scan. **A story that adds a Restricted table** adds its
  sentinels to `canaryMasters` and a loader that writes them into its table, in the same change.
- **The canary estimate** (`tests/support/canary-estimate-builder.ts`) types a value into every input field and is chosen so that no output
  equals a typed value, which an Engineer is allowed to see. A new input field fails `tests/security/canary-estimate-builder.test.ts` until it is added.
- `NODE_ENV=test` belongs to Vitest alone, and the reason is the bundler: Next.js replaces the dot-access `process.env.NODE_ENV` at build time, so
  the negative-control route's gate is a constant in every server bundle, whatever the runtime environment says. The route is exercised in process
  (`tests/security/scanner.test.ts`), shown absent from the production server (the scan spec, with its sentinel supplied), and the build is checked
  after `next build` (`scripts/check-production-routes.ts`, CI stage 9): it fails if the compiled route reads `NODE_ENV` at run time. Keep the read a
  dot-access default. The sentinel comes from the environment variable `CANARY_NEGATIVE_CONTROL`, which only the test servers set; it is deliberately
  not in `src/lib/env.ts` or `.env.example`, because it must never fail a start-up check.
- **Responses the browser fetches** (fetch, XHR, RSC prefetch) are recorded by interception, so the scan reads the body the page really received;
  a response type that cannot be intercepted would be named in the pull request, never skipped silently.

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
| Hidden routes in the build (CI stage 9, after the build) | `npx tsx scripts/check-production-routes.ts` |
| First-load JavaScript budget (CI stage 11b; needs the build and the database above; see "Performance checks") | `npx tsx scripts/check-js-budget.ts` |
| End-to-end, three screen sizes (needs the database above; builds and serves the production build for the sign-in spec) | `npx playwright install chromium` once, then `npx playwright test` |
| Cost confidentiality scan (CI stage 12; see "Cost confidentiality scan") | `npx playwright test canary-scan`; its Vitest parts are in `tests/security` (`npx vitest run tests/security`) |
| First Admin (AC-7 of STORY-01.01) | `npx tsx scripts/bootstrap-admin.ts` (reads `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD`) |
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

`.github/workflows/ci.yml` runs stages 1 to 12 of the test strategy (install, secret scan,
data-file check, lint, type-check, unit with coverage of pure code, audit, licences, build with a check that
`/design-system` is a 404 in it, migrations, integration with combined coverage, and end-to-end with axe on
Chromium at three widths) on every pull request. **Stage 12 is on since STORY-10.02 and blocks merge.** Since AQP-208
(STORY-10.15) the workflow has three kinds of job: `Stages 1 to 11b` (stages 1 to 11b, in order); a matrix of shard jobs,
`Stage 12: E2E (shard <i> of <N>)`, each of which builds for itself, migrates its own throwaway database, runs stage 12a
and runs its share of the E2E tests (`playwright test --shard=<i>/<N>`, four workers); and a final job named
`Stages 1 to 11`, which waits for all of them and fails unless every one succeeded. That last job is the required check
on `master` (the name was kept so the check keeps reporting and no repository setting changes). The first two kinds start
together. The shard count is the length of `matrix.shard` in `ci.yml`: one line to change (test strategy 10.5).
Stage 13 (image) is present and disabled until the Dockerfile story, STORY-10.04. The
Next.js build cache and the Playwright browsers are cached between runs. The workflow uses no secret and no
production setting. **Stage 11b, the first-load JavaScript budget, also blocks merge** (next section). A second workflow,
`.github/workflows/nightly.yml`, runs the Lighthouse reference run and the CI feedback-time report every night; it is
never a required check.

### Playwright install cache

Stage 12a (`scripts/ci/playwright-system-deps.sh`) installs the browser and the system packages it needs. The browser is
cached by Playwright version. The system packages (`.deb` files) are cached under the key
`playwright-debs-e<CACHE_EPOCH>-<runner image>-<Playwright version>`. On a hit they are installed with `dpkg` and no
network. On a miss, or when the cached install fails, the script reads the package list from
`npx playwright install-deps --dry-run chromium` (`scripts/ci/playwright-deps-packages.sh`), downloads the packages with
`apt-get install --download-only` (45 s for `apt-get update`, 90 s for the download), installs them offline and saves
what it downloaded. It makes up to three tries; tries 2 and 3 use `archive.ubuntu.com`, and after the third the step
fails and names the mirrors. Each try has a temporary apt view (a copy of the image's `ubuntu.sources` that names only that
try's mirror, with `Signed-By` kept, and its own package-list directory), so `apt-get update --error-on=any` fails exactly
when that mirror is dead and the runner's own apt sources and lists are never changed. If the dry run cannot be read, it warns and takes the older bounded install (`apt` with a
20 s stall timeout and 3 retries). The step stops after 8 minutes in every case. The nightly workflow
(`warm-playwright-cache`) runs this stage on `master` with the same keys, so every branch can restore them after a runner
image change; `CACHE_EPOCH` in `nightly.yml` must be raised together with the one in `ci.yml`. A bad cache entry never turns a run red, but it costs the bounded
`apt` install on every run: a cache key never changes after it is saved, and a hit is not saved again. When that happens
the job prints a warning that names the key. There are two ways to replace the entry:

- **Delete it.** A maintainer runs `gh cache delete <key>` with the key from the warning (it needs a token with
  `actions: write`, so the pipeline cannot do it), or removes it under Actions, Caches. The next run misses and saves a
  good entry.
- **Start a new key.** Raise `CACHE_EPOCH` (a quoted number in the `env:` block at the top of `ci.yml`) by one, in a reviewed
  pull request. Do this only when the entry cannot be deleted, or to retire entries on every branch at once. The old
  entries are left to expire.

Caches are scoped by ref: a pull request restores entries from its own ref or from `master`, and what it saves is visible
to that pull request only. The entries every branch reads are written only by `push` runs on `master`.

### node_modules cache

The install in each CI job (`Stages 1 to 11b` and the three E2E shards) does not run `npm ci` on every run (AQP-243, test strategy 10.5
item 7). `node_modules` is restored from a cache whose key is the runner OS, architecture and image (`ImageOS`), a format number for the integrity record (`v1`), the Node and
npm versions of `ci.yml`, and a hash of `package-lock.json`, `package.json` and `.npmrc`. There is no `restore-keys`: only an exact
match restores, so a changed lockfile, a changed install-script allow-list (`allowScripts`, `strict-allow-scripts`) or a new npm is
always a miss and installs exactly what the files say. A hit runs `scripts/ci/node-modules-integrity.sh check`, which compares the
restored files and sizes with the record made when the entry was saved. If the check fails, the job deletes `node_modules`, runs a
clean `npm ci` and saves nothing (the **fallback**), so a bad cache costs time and never a red run or a stale install. On a miss
`npm ci` runs, the record is written, and the entry is saved only if all of that succeeded; four jobs may race to save one key, and a
lost race is only a warning. `prisma generate` runs every time. The job summary of each run shows, for each job, its install time
and whether it was a hit, a miss or a fallback, and the slowest shard (`scripts/lib/ci-run-summary.ts`).

A key never changes after it is saved, so a bad entry falls back on every run until it is deleted. The warning in the log names the
key. A maintainer deletes it with `gh cache delete <key>` (a token with `actions: write`; the pipeline cannot do it) or under
Actions, Caches; the next run misses and saves a good entry. Caches are scoped by ref, as for the Playwright caches above: a pull
request restores entries from its own ref or from `master` and saves for itself only, and a `master` run restores only what a
`master` run saved. The entries every branch reads are written by `push` runs on `master`. Each entry is the size of
`node_modules` (several hundred megabytes before compression); GitHub keeps 10 GB per repository and evicts the least recently used.

## Performance checks (NFR-009)

**First-load JavaScript budget (CI stage 11b, every pull request).** Each route's first load may download at most
200,000 bytes of JavaScript, gzip. The check starts `next start` on a free port for the production build, asks for every
implemented page of the route manifest (`src/server/http/route-manifest.ts`) and for the not-found page, and counts the
scripts each page names. A page that sends a visitor to sign-in is requested as a role the manifest allows on it; the check
signs in as the invented Admin, who may open every page, so today every page is measured as the Admin. A page that the
build serves and the manifest does not list fails the check. It counts `<script src>` without `nomodule`, and `<link rel="preload">` or
`rel="modulepreload"` with `as="script"`, each URL once. It reads those files from `.next/static`, compresses each with
gzip level 9, adds them up (1 KB is 1,000 bytes) and writes one row per route (file count, raw bytes, gzip bytes,
limit, headroom) to the job summary. It exits 1 if a route is over its limit, does not answer as it should (200 for a
page, 404 for the not-found page and for `/design-system`), or cannot be measured. Nothing is skipped silently.

To run it on your computer, build first and make sure the database is migrated. The pages that ask for sign-in need an
Admin to sign in as, and the portal allows **one active Admin**, so there are two ways, depending on your database:

- **A fresh throwaway database** (for example the one from "First use", before you run `bootstrap-admin`): let the script make an
  invented Admin. It refuses any database that is not on this machine, the Compose service `db` or the CI service `postgres`
  (never staging), and the password is never printed.

  ```sh
  npx next build
  # bash; in PowerShell set the two variables with $env:NAME = "value"
  export MEASUREMENT_ADMIN_EMAIL=perf-admin@example.test MEASUREMENT_ADMIN_PASSWORD=<an invented password of your choice>
  npx tsx scripts/ensure-measurement-user.ts
  npx tsx scripts/check-js-budget.ts
  ```

- **A database that already has the Admin from `bootstrap-admin`**: do not run `ensure-measurement-user.ts`. It stops with a message
  ("another Admin already exists") because a second active Admin is not allowed. Set `MEASUREMENT_ADMIN_EMAIL` and
  `MEASUREMENT_ADMIN_PASSWORD` to that Admin's own sign-in and run `npx tsx scripts/check-js-budget.ts`. That Admin must have
  chosen its own password already, or the pages would send it to a password change instead of the page being measured.

`--build-dir <folder>` measures a build made elsewhere (the folder that holds `.next`), and `--base-url <url>` uses a
server that is already running. The limit is 200,000 bytes unless the one table in `scripts/lib/js-budget.ts` says
otherwise. An entry in that table needs a product-manager decision ID and the Lighthouse run behind it, or a unit test
fails it. A route over its limit is fixed by loading the heavy part on first use (`next/dynamic`), not by raising the
limit.

**Lighthouse reference run and CI feedback time (nightly).** `.github/workflows/nightly.yml` builds and serves the app
on a GitHub-hosted `ubuntu-24.04` runner, signs in as an invented Admin, and runs Lighthouse (`lighthouserc.cjs`, with
the Chromium that Playwright installs) five times per page on the Wi-Fi profile (pass or fail, on the key screens listed
in `KEY_SCREENS` as each is built) and on the Slow 4G profile (report only). The summary shows median LCP and TBT,
`benchmarkIndex` and the Chromium version; the reports are kept for 30 days as the `lighthouse-reports` artefact. The
first baseline run's median `benchmarkIndex` is **B0**: set it as the repository variable `LIGHTHOUSE_B0`; a later run more
than 25 % away from it is marked "not comparable". The same workflow reports the p95 and the median duration of the
required job over the last 20 pull-request runs (p95 at most 10 minutes, median at most 6). To run it before a key
screen's review, open a pull request that touches `lighthouserc.cjs` or the workflow (it starts on its own), or, once the
workflow is on `master`, use Actions, Nightly, Run workflow on the branch.

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
