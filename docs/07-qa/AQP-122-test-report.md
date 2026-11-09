# Test Report — AQP-122 (STORY-02.03): Material Master

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `b02955bb07e176f834477aeb08dc3713d563bd37` on `feat/AQP-122-material-master` (PR #120, `sankumar76/Accucut-Quotation`), checked out detached in a scratchpad worktree. The head did not change during the run. The QA commit adds tests and documents only; it changes nothing under `src/` |
| CI | Run 42506525720 on `b02955b` (event `pull_request`, attempt 3): success on all four jobs (Stages 1 to 11, Stages 1 to 11b, E2E shard 1, E2E shard 2). This is the reference run. The run on the QA commit is recorded in the PR comment |
| Environment | Windows 11; Node v24.19.0 (CI uses Node 22); Docker 29; PostgreSQL 17 (the digest-pinned image of `compose.dev.yml`) as a throwaway container `qa122-db` on host port 55522 with invented passwords, all 7 migrations applied, drift check clean, configuration version 1 created by `scripts/ensure-seed-version.ts` as CI does; Chromium by Playwright 1.64.1, 2 workers. No shared or production environment was used. `AMADA-20261006.xlsx` and `.env*` were not opened |
| Date | 2026-11-09 |
| **Recommendation** | **ACCEPT.** All 8 ACs pass with evidence on the corrected AC-5 text and the ux-expert's final words. 13 of 13 planted faults are caught. The DL-115 and DL-116 evidence list is complete. No open Sev-1 or Sev-2. Two new defects, both open: **DEF-021 (AQP-234, Sev-3)** and **DEF-020 (AQP-235, Sev-4)**. Open by severity: Sev-1 0, Sev-2 0, Sev-3 1, Sev-4 1. Master decides whether DEF-021 is routed to the ux-expert before or after the merge (see Defects) |

## Summary

Every AC holds, tested through the real route handlers over real PostgreSQL, then in the browser at 360, 768 and 1366 px. A material change writes exactly one `master.created` or `master.edited` entry with `object_type` `material`, in the change's own transaction, and nothing for any refusal. A specific gravity of 0 or below is refused with 422 on `POST` and `PATCH` by the schema, by the service and by the table's CHECK. `GET /api/v1/options/materials` answers exactly `id`, `name` and `materialConsidered` to all three roles, with no number in any spelling. The cost scan finds the canary materials for the Admin and none for an Engineer. The canary loader passed under `--repeat-each=5 --retries=0` at three widths with 0 failures (363 of 363).

I planted 13 deliberate faults, one at a time, in `src` of a scratchpad worktree (never committed, restored with `git checkout -- src` after each). Every one made at least one QA test fail. Two of them, a second transaction **inside** the change for the create's entry and for the edit's entry, pass the developer's focused suites (1,080 tests) and are caught only by the QA file (OBS-1).

The full regression is green apart from one known load-sensitive file that passes alone (DEF-018). Two things the developer's tests could not see were found in the browser: the Edit button is outside the visible table from 768 to about 1270 px (DEF-021), and after a save followed by a failed list read, focus ends on the page heading and not on the error title (DEF-020). Neither breaks an AC as worded. Both have a committed test marked `test.fail` that flips to a failure the day the fault is fixed.

## AC Verification Matrix

Test IDs are titles beginning `[AQP-122 AC-n]`. QA files: `tests/acceptance/aqp-122-materials-rules.test.ts` (AC-1 to AC-3), `-requests.test.ts` (AC-2, AC-3), `-audit.test.ts` (AC-5), `-access.test.ts` (AC-4, AC-6), together **112 tests**; `tests/e2e/aqp-122-qa.spec.ts` (**20 tests at 3 widths = 60**; 56 pass outright and 4 are the expected failures marked `test.fail` for DEF-020 and DEF-021, which Playwright reports as passed). Developer files are named where used. Techniques: EP equivalence partitioning, BVA boundary-value analysis, DT decision table, EG error guessing, ST state analysis.

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 list; default filter `is_hidden = false` | QA `rules` "AC-1" (4 tests), `page words` browser test at 3 widths; developer integration "AC-1 (T1)", `materials.spec.ts` list and search tests | EP, ST | ✅ Pass (see DEF-021) | The table starts empty. A created material is listed with the five fields as decimal text, strict keys, `Cache-Control: no-store`, in the order added. A hidden row and a deleted row (put in by SQL as the owner) are never listed, never offered as an option and are 404 by ID, and a write to them changes nothing and writes no entry. A hidden or deleted name still holds the name (adding it is refused as taken). Browser: title "Materials and lists", description, meta description, one tab "Materials" in the tab list "Lists", search label and placeholder, and the five headings (table) or labels (cards). **Observation:** from 768 to 1022 px and from 1024 to about 1270 px the Edit button is outside the visible table area (DEF-021) |
| AC-2 add and edit rules | QA `rules` (AC-2 blocks, with tables of cases), `requests`; developer `materials-lib`, `materials-routes`, `masters-service-materials`, integration "AC-2" | EP, BVA, EG | ✅ Pass | Name unique ignoring letter case and spaces (case variants, leading and trailing spaces), the race (4 requests at once: one 201, three 422 `NAME_TAKEN`, one row), the database index as backstop (the runtime role cannot store a case variant). A rename onto another name is refused; a change of letter case of its own name is accepted. 100 characters accepted, 101 refused. Price and Material-Scrap-Rate: valid shapes returned with two decimals; negative, three decimals, no number, a JSON number and 13 digits refused 422 with the SCR-13 sentence. Columns are `numeric(18,4)`. Specific gravity: `0`, `0.00`, `-1`, `-0.01` refused with "Enter a value above 0." on both `POST` and `PATCH`; `0.01` accepted; bad shapes with the shape sentence. **The server refuses it by itself**: the service refuses without the schema, and the table CHECK refuses even the owner, except for a hidden row. Markup, quotes, SQL words and accents are stored as text |
| AC-3 (negative) | QA `requests` "AC-3" (4 tests), `rules` 422 tables | DT, EG | ✅ Pass | The example of the AC (blank name, negative price, gravity 0, three decimals together): one 422 naming each failing field, nothing stored. Missing field, unknown key and `id`, `isHidden`, `isSystem`, `deletedAt`: 422. Empty `PATCH` 422; bad JSON and empty body 400; ID not a UUID 422; unknown ID 404 (capital letters in the ID still find the row). A 1 MB name: 422 and not 500, and no 422 echoes the typed value |
| AC-4 safe options | QA `access` "AC-4" (5 tests and a table over the 3 roles), browser Admin, Lead and Engineer; developer `materials-routes` (options), `strict-schema`, `canary-scan.spec.ts` | EP, DT | ✅ Pass | Admin, Lead and Engineer get entries with exactly `id`, `materialConsidered`, `name`; the three bodies are identical; none of the canary numbers appears in any spelling and no rate-like key or word; `no-store`; hidden and deleted rows absent; signed out 401. Static check: the route imports the options schema and no Admin schema with a rate field. In the browser the Lead and the Engineer get the same shape. Planted leak (S2): 5 QA tests fail |
| AC-5 (corrected text, Jira 11187): `master.created` / `master.edited`, `object_type` `material` | QA `audit` (10 tests); developer `masters-service-materials`, `materials-audit-events`, integration "AC-5 (DEF-017)" | EP, ST, EG | ✅ Pass | Read with plain SQL: one entry per success with the object ID and label, actor, the `X-Request-Id` of the response, create `before` null and `after` the whole state, edit both whole states; a multi-field edit is one entry; the label is the new name after a rename; three edits make a chain (each `before` is the previous `after`). The only events are the two (no `master.material.*`). A change of letter case alone is a change; a save that changes nothing is a 200 with no entry. **No entry for any refusal** (validation, name taken, gravity 0, not found, hidden, bad ID, bad JSON, foreign or missing Origin, Lead, Engineer, signed out). **Atomicity:** with the unit of work failing after its last step, and with the audit service refusing the entry, create and edit answer 500 with the generic words, change nothing and keep no entry; the same create then succeeds. **Planted bypasses:** table below |
| AC-6 roles, scan, invented data | QA `access` "AC-6" (6 tests and a table of routes and callers), browser Lead and Engineer, `canary-scan.spec.ts` x 5 repeats; developer `role-matrix`, `engineer-refused-before-lookup` | DT, EG | ✅ Pass | Lead and Engineer: 403 on `GET` and `POST /materials` and `PATCH /materials/{id}` (real and invented ID give the same body), signed out 401; the page is SCR-26 with status 403 for Lead and Engineer (and holds no number) and sign-in for a signed-out visitor. The Admin is sent the canary numbers and nobody else is. A refusal to the Admin never echoes a number. CSRF: a foreign and a missing Origin give 403 `ORIGIN_REFUSED`. A deactivated Admin and a raised session version get 401 at the next request. The runtime role has SELECT, INSERT, UPDATE only. Cost scan: finds the canary materials in the Admin's responses and 0 in an Engineer's; `canary-scan.spec.ts` passed 5 repeats at three widths (0 failures); with the options leak planted (S2) the scan fails 6 of 27 tests |
| AC-7 three widths, 44 px, axe, keyboard | developer `materials.spec.ts` (x 3), QA browser spec (x 3) | EP | ✅ Pass (see DEF-021) | No sideways scroll of the page, also with a 100-letter name with no space in the list, the Edit dialog title, the added notice and the saved notice (the table scrolls inside its own region from 768 px, as UX 6.0 says). Inputs and buttons of the dialogs are 44 px high; the search, the tab, Add material and the Edit control reach their sizes (36 px icon row in the table). Tab order in the Add dialog: five fields, Cancel, Add material. Add and edit end to end with the keyboard only. Axe (`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`) 0 violations on every state scanned. Long unbroken search text (120 letters, 400 capitals, 300 digits, an address, markup) wraps inside the No match state at every width |
| AC-8 states and wording | QA browser spec; developer `materials.spec.ts` | ST | ✅ Pass (see DEF-020) | The strings are written out in the QA spec from ux-spec v0.18 and not imported: "Enter the Material in Drawing." (and not "Enter a name."), "Enter the Material Considered.", "Use 100 characters or fewer.", the duplicate sentence, the number sentence, "Enter a value above 0." with the hint "Must be above 0.", "Enter a number above 0, with up to 2 decimals.", the placeholder "Material in Drawing or Considered", the description "Material prices, specific gravity and scrap rates.", the meta "Manage the materials used in estimates.", "No materials yet" with the new text, "Check the spelling, or clear the search.", "Loading the materials", "We could not load the materials", the failed Add and failed Edit notices, "<name> was added." and "<name> saved. The change is in the audit log.". Each message clears when its own field is edited; focus goes to the first message; an edit that changes nothing closes the dialog and sends nothing; the Edit title does not change while typing. **Observation:** in the load error after a save, focus is not on the title (DEF-020) |

### AC-5: planted audit bypasses (DL-107 rule, G7 evidence)

Each fault was planted alone in `src/server/services/masters-service.ts`; QA's four files were run (112 tests), then the developer's focused suites (`materials-lib`, `materials-routes`, `materials-audit-events`, `masters-service-materials`, `masters-audit-events`, `http-route-manifest`, integration `materials`, `tests/security`: 1,080 tests), then `git checkout -- src`. Control with no fault: 112 of 112 and 1,080 of 1,080.

| Event | Fault | QA file: failing | Developer's focused suites: failing |
|-------|-------|------------------|-------------------------------------|
| `master.created` | entry omitted (A1) | 7 | 5 |
| `master.created` | entry written in a second transaction **inside** the change (A3) | 1 | **0** |
| `master.created` | entry written in its own transaction **after the commit** (A5) | 2 | 1 |
| `master.edited` | entry omitted (A2) | 6 | 7 |
| `master.edited` | second transaction **inside** the change (A4) | 1 | **0** |
| `master.edited` | entry written in its own transaction after the commit, **P3u** (A6) | 1 | 1 |
| both | wrong `object_type` (`process_item`) (A7) | 3 | 6 |
| `master.edited` | a save that changes nothing still writes an entry (A8) | 2 | 3 |

### Other planted faults

| Fault | What it removes | QA: failing | Developer: failing |
|-------|-----------------|-------------|--------------------|
| R1: specific gravity 0 accepted by the schema **and** the service (only the table CHECK is left) | AC-2, AC-3 (UX-37) | 40 | 17 |
| R2: the name is no longer trimmed | AC-2 | 11 | 3 |
| L1 (P4): hidden and deleted rows listed and reachable by ID | AC-1 | 9 | 1 |
| S1: a Lead may list and add materials | AC-6 | 3 | 11 |
| S2: the options route returns every number (loose schema) | AC-4 | 5 | 6 |
| S2 again, seen by the browser cost scan (`canary-scan.spec.ts`, 3 widths) | AC-4, AC-6 | 6 of 27 scan tests fail (2 tests x 3 widths: "an Engineer is sent no Restricted value" and "the options list an Engineer is sent ... carries no rate") | n/a |

## DL-115 / DL-116 evidence list

| Required evidence | Result | Where |
|-------------------|--------|-------|
| Each AC; AC-5 on the corrected text, AC-8 on the ux-expert's words | ✅ | The matrix |
| Audit per event, a planted bypass for each including P3u, no entry for a refusal | ✅ | AC-5 and the bypass table |
| Specific gravity 0 and below, 422 on `POST` and `PATCH` through the API; the hidden-row exemption holds | ✅ | AC-2 row (`rules`: the gravity block and the CHECK test) |
| `/options/materials` exactly three keys for the three roles, no number | ✅ | AC-4 row |
| Cost scan: canary materials for the Admin, 0 for an Engineer, at three widths | ✅ | AC-6 row |
| Canary loader under concurrency: `canary-scan` and `materials` with `--repeat-each=5 --retries=0` at three widths, 0 failures | ✅ | `npx playwright test canary-scan materials --repeat-each=5 --retries=0 --workers=2`: **363 passed, 0 failed, 0 retried** (5 x 72 tests at 360, 768 and 1366 px, plus 3 set-up tests), 15.8 min, on a database emptied of materials first |
| The five ux-expert strings and the one-tab description test | ✅ | AC-8 row (strings written out in the QA spec); developer's "no exchange or treatment" test is in the regression |
| Long-search overflow test at three widths | ✅ | AC-7 row: 5 kinds of long text x 3 widths, all pass |
| Screens at three widths, axe, keyboard, 44 px | ✅ | AC-7 row |
| Stage 11b: every route under 200,000 B | ✅ (CI) | CI run 42506525720 log: `PASS /masters/materials gzip 186,497 (186.5 KB) limit 200,000 headroom 13,503`. A local run was not made (the measurement user cannot be added to this kind of database; as at AQP-113) |
| Regression green | ✅ with one known exception | Below |
| Closure only after the posted G7 (DL-098) | n/a yet | QA moves the story only after master's decision is relayed |

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| QA acceptance (API) | `npx vitest run tests/acceptance/aqp-122-materials-*.test.ts` | 112 | 112 | 0 | 0 | about 17 s |
| Lint | `npx eslint .` on the head with the QA files | | exit 0 | | | |
| Type-check | `npx tsc --noEmit` on the head with the QA files | | exit 0 | | | |
| Migrations, drift | `npx prisma migrate deploy` (7 applied); `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | | "No difference detected" | | | |
| Full Vitest | `npx vitest run` (186 files) | 4,564 | 4,539 | 1 file (the hook of `playwright-system-deps.test.ts`, 120 s, DEF-018) | 25 (that file's tests, skipped because its hook failed) | 242 s |
| The one failing file alone | `npx vitest run tests/unit/playwright-system-deps.test.ts` | 25 | 25 | 0 | 0 | 46 s |
| QA browser spec (inside the full run below) | `tests/e2e/aqp-122-qa.spec.ts` | 60 | 60 (4 are `test.fail` expected failures) | 0 | 0 | |
| Loader repeat | `npx playwright test canary-scan materials --repeat-each=5 --retries=0` | 363 | 363 | 0 | 0 | 15.8 min |
| Full browser regression, 3 widths | `npx playwright test --retries=0` (the config default is one retry; I turned it off) | 584 | **563** | 0 | 21 (viewport-conditional shell and drawer tests that skip themselves at the wrong width, none of them Materials) | 21.6 min |

Notes. The unit-test failure is the DEF-018 class (Windows, load) and is not in this PR. CI runs the same file on Linux and it is green. `server-only-build.test.ts`, which runs a real Next build, passed here. No limit was raised and nothing was retried. Along the way I fixed four faults of my own spec (below, "Test defects"); none was in the product.

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Cost confidentiality | NFR-002, BR-003, BR-004 | Canary numbers in the database; every route and the page as Admin, Lead, Engineer and signed out; strict schemas; the repository for the options reads no number; static import check; planted leak S2 | ✅ No price, gravity or scrap rate reaches anyone but the Admin; the Admin's own refusals do not echo a number |
| Role, session, CSRF | NFR-001, NFR-003 | Role first (same body for a real and an invented ID), deactivation and session version at the next request, foreign and missing Origin | ✅ |
| Input validation and error leakage | NFR-003 | Boundaries (0, 0.01, 100 and 101 characters, 13 digits), JSON numbers, `null`, extra keys, injection-style names, a 1 MB name, bad JSON; generic 500 for late failures, the failure text not leaked | ✅ |
| Data integrity | NFR-006, NFR-007 | `numeric(18,4)`, the CHECK for gravity (owner included), the unique index on `lower(name)`, no DELETE or TRUNCATE for the runtime role, atomic audit | ✅ |
| Accessibility | NFR-018 | axe with `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` on every state, keyboard dialogs, focus returns to the row's button, targets at 44 px and 36 px | ✅ 0 violations, with DEF-020 (focus in one rare state) |
| Responsive | NFR-016, NFR-017 | 360, 768, 1366 px, and a probe of 768 to 1440 px | ✅ for the page; DEF-021 for the Edit button between 768 and about 1270 px |
| First-load JavaScript | NFR-009 | CI stage 11b | ✅ 186,497 B gzip for `/masters/materials` (limit 200,000) |
| Performance of the list | NFR-008/011 | Not measured as a timing. With about 140 materials in the throwaway database (the list is not paged) the page rendered, but single browser tests that scan or edit in that list took 20 to 30 s on this PC, and one probe on the last row of 140 timed out at 30 s. I emptied the table between runs. The master-data volume of NFR-011 is the product-manager's open item (PRF-06) | Not judged |

## Exploratory Session

Charter: *Explore the Materials tab and its API as the Admin who adds forty materials in a sitting, as a Lead who tries to reach the numbers, and as a person on an iPad, looking for lost input, wrong focus, hidden controls and any number reaching a non-Admin.*

| Area | What I tried | Finding |
|------|--------------|---------|
| Wide screens vs tablets | Table at 768, 900, 1000, 1023, 1024, 1180, 1257, 1280, 1366, 1440 px; SCR-11 as a control | **DEF-021.** The table needs 968 px; Edit is out of view at 768 to 1022 and 1024 to about 1270 px |
| Failure paths | 503 on the list read after a save, 503 on `POST` and `PATCH`, the held read for the Loading state, an empty list after "Try again" | Notices and wording as specified; typed values stay; **DEF-020** (focus after a failed re-read) |
| Long and strange text | 100-letter names with no space in the list, dialog title, notices; five kinds of long search text; markup in names | No sideways page scroll; text shown as text |
| Long list (140 rows) | Edit and save a row far down the list, at 1366 px | Focus returns to the row's button, inside the visible area. **OBS-3:** axe can report a row's Edit button as a target problem when a scan is made with the list scrolled so that the button is half behind the sticky top bar; a scan from the top is clean. Not a product fault on its own |
| Concurrency | Four creates of one name in four cases; two edits of one row at once; three loaders at once | One winner, no 500, the entries match the successes; loader 0 failures in the repeat run |
| Roles | Lead and Engineer on the page and the three routes, with a real and an invented ID | Same refusal, no number |
| Not done | A real phone, a screen reader, Windows high contrast (test plan 12) | Not part of this story's G7; planned for G8 |

## Defects

| ID | Jira / GitHub | Sev | Type | Title | Status |
|----|---------------|-----|------|-------|--------|
| DEF-021 | [AQP-234](https://sankumar76.atlassian.net/browse/AQP-234) / [#127](https://github.com/sankumar76/Accucut-Quotation/issues/127) | Sev-3 Moderate | Product (design) | The Edit button of every material is outside the visible table area from 768 to 1022 px and from 1024 to about 1270 px | New |
| DEF-020 | [AQP-235](https://sankumar76.atlassian.net/browse/AQP-235) / [#128](https://github.com/sankumar76/Accucut-Quotation/issues/128) | Sev-4 Minor | Product | When the list cannot be read right after a successful save, focus ends on the page heading and not on the load error title | New |

Records: `docs/07-qa/defects/DEF-021-edit-button-outside-visible-table-768-to-1270.md`, `DEF-020-focus-ends-on-page-heading-after-failed-reread.md`. Both have a committed test marked `test.fail`. Neither is an AC failure as worded, so neither holds ACCEPT under the G7 rule (no open Sev-1 or Sev-2). **DEF-021 is the one master may want to hold or time:** the primary row action is hidden on iPad and on 1024 to 1270 px laptops, and stories 02.04 and 02.05 will copy the tab shell. A fix needs the ux-expert first.

**Test defects (mine, fixed, none in the product):** the page-words test read column headings with `innerText`, which returns the capitals drawn by CSS; the states test assumed a held request would obey a later change of mode and that a page reload re-reads the list (the list arrives with the page and is re-read only after a change); the 100-letter test asserted the table row inside the viewport at 768 px, which UX 6.0 does not promise (the table scrolls inside its region); and its axe scan ran with a long list scrolled so that a button was half behind the sticky bar (OBS-3). Each is fixed in the committed spec.

## Observations for master to route

- **OBS-1 (test gap, closed by QA's file if it is committed).** A second transaction inside the change, for the create and for the edit, passes the developer's 1,080 focused tests; only QA's tests catch it. The same class as AQP-113 OBS-1 and DEF-017.
- **OBS-2 (CI time).** The committed QA browser spec adds **60** E2E tests (20 x 3 widths) to the Playwright path. RISK-023 (the path was 5:57, 6:17 and 5:05 on this head) makes that a cost: I have not measured it. The PR run on the QA commit will show it. If it passes 6:00 the options are the three-shard enabler (merged first), or a ruling in test strategy 10.5 to tag some of these tests `@one-width` (for example the Lead, Engineer and signed-out test, which reads no layout), which is the solution-architect's to rule.
- **OBS-3 (axe and the sticky bar).** See the exploratory table. A future scan of a long scrolled list may flag a half-hidden Edit button. Scans are taken from the top of the page.
- **OBS-4 (DEF-020 on SCR-11).** `use-process-master.ts` has the same shape and probably the same fault; I did not test it.
- **OBS-5 (data volume).** The materials list has no paging. With about 140 rows the page renders but browser tests become slow (20 to 30 s each on this PC; the DEF-019 class of data growth). The NFR-011 master-data volume (PRF-06) is still open and is needed before the page is judged for size.

## Residual risks

- G7 evidence was gathered on a Windows machine with Node 24; CI is Linux with Node 22 and was green on the same commit.
- No real phone, tablet or screen reader was used for this story. DEF-021 was found by measurement, not on a device.
- The specific-gravity limit of 2 decimals is accepted as built (QLT-07, with the business-analyst).

## Artefacts

- `docs/07-qa/AQP-122-test-report.md` (this file); `docs/07-qa/defects/DEF-020-*.md`, `DEF-021-*.md`.
- `tests/acceptance/aqp-122-materials-access.test.ts`, `-audit.test.ts`, `-requests.test.ts`, `-rules.test.ts`; `tests/support/material-master-qa-api.ts`; `tests/e2e/aqp-122-qa.spec.ts`.
- Not committed: the plant script and the scratch probes of the session.
