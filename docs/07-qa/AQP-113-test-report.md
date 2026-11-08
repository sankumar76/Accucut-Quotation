# Test Report — AQP-113 (STORY-02.01): Process master list and edit, with the DEF-006 verification

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `c2628534d431a76fb1ba830659fd515f934c3afc` on `feat/AQP-113-process-master` (PR #107, `sankumar76/Accucut-Quotation`), checked out detached from `origin/feat/AQP-113-process-master` in a scratchpad worktree. The head did not change during the run |
| CI | Run 42330556486 on `c262853` (event `pull_request`): success, all four jobs (Stages 1 to 11, Stages 1 to 11b, E2E shard 1, E2E shard 2). This is the reference run. The run on the QA commit is recorded in the PR comment |
| Environment | Windows 11; Node v24.19.0 (CI uses Node 22); Docker 29.8.0; PostgreSQL 17 (the digest-pinned image of `compose.dev.yml`) as a throwaway container `qa113-db` on host port 55513 with invented passwords, removed afterwards; Chromium by Playwright 1.64.1. The machine was busy for part of the run (see the load notes). No shared or production environment was used. `AMADA-20261006.xlsx` and `.env*` were not opened |
| Date | 2026-11-07 |
| **Recommendation** | **ACCEPT.** All 9 ACs pass with evidence. No new defect. Open by severity: Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0. **DEF-006 (AQP-181, GitHub #49) is verified for Release 1** and closes only after master's G7 decision is posted (DL-098). Seven observations (OBS-1 to OBS-7) are for master to route; OBS-1 is a test gap that this report's QA test file would close if it is committed |

## Summary

Every AC holds, tested through the real route handlers over real PostgreSQL with the stored configuration read from `config_versions`, then in the browser at 360, 768 and 1366 px. The three audit events each write exactly one entry in the change's own transaction, and none for any kind of refusal. DEF-006 is closed in every case I could build: compound then parts, parts then compound, the rename path, the two QLT-15 probes (a) and (b), a column letter plus a hyphen, spaced operators, and the renamed rate inside the formula. Each is refused at the step that would break a stored formula, and no refusal names a rate, a formula or a value.

I planted 21 deliberate faults, one at a time, in `src` of a scratchpad worktree (never committed, restored with `git checkout -- src` after each). Every one made at least one of my tests fail, including a bypass for each of the three audit events in three different ways. The same three bypass faults on `master.deleted` (nested transaction) and on `master.edited` and `master.deleted` (entry written after the commit) pass the developer's whole unit, integration and security suites. That is a gap in the tests, not in the code (OBS-1).

The full regression is green apart from two load-sensitive files that pass alone (the Windows environment note below). The Jira connector was unreachable, so the AC wording below is taken from the PR's AC table, the three reviewers' AC-conformance tables and the product-owner's and ux-expert's rulings in the gate log, not from the Jira text itself (Residual risks).

## AC Verification Matrix

Test IDs are titles beginning `[AQP-113 AC-n]` in `tests/acceptance/aqp-113-process-master.test.ts` (169 tests; QA's file, see Artefacts), the QA browser spec `tests/e2e/zz-qa-aqp113.spec.ts` (3 tests at 3 widths), and the developer's files named. Techniques: EP equivalence partitioning, BVA boundary-value analysis, DT decision table, EG error guessing, ST state analysis.

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 list, Used in, 15 seed rates at 0 | 3 QA tests; developer `process-items.test.ts` (rows equal `seed-ids.ts`), `rate-usage.test.ts`, E2E list test | EP, DT | ✅ Pass | `GET /api/v1/process-items` as the Admin returns 15 rates, each name found in SPEC 4.1 (names only; no value was read), each default `0.00`, strict keys `id, name, unit, defaultValue, usedBy`, `Cache-Control: private, no-store`. "Used in" equals the formulas recomputed from the seed text with my own regular expression and my own column-letter function, for all 15; 14 rates are used and only `Plating-rate-per-sqin` is used by none ("None yet" in the screen) |
| AC-2 add | 64 QA tests; developer route, lib and name tests; E2E add | EP, BVA, EG | ✅ Pass | 201 with stored decimal text and a new ID. All 7 units accepted; an unknown, empty or non-text unit gives "Choose a unit.". Default value: `0`, `0.00`, `0.5`, `12.34`, `003.37` (stored `3.37`), `" 2.5 "`, and `999999999999.99` (12 digits) accepted; `-1`, `-0`, `1.005`, `1.`, `.5`, `1e3`, `1,000`, 13 digits, letters, empty, `NaN`, `Infinity`, `+5`, `0x10` and a JSON number all refused 422 with "Enter a number, 0 or more, with up to 2 decimals.". Name: 100 characters accepted, 101 refused "Use 100 characters or fewer.", empty and spaces "Enter a name.". Unique ignoring letter case and surrounding spaces (4 variants and 2 seed names) 422 `NAME_TAKEN` "A rate with this name already exists.". Column letters `A B Z AA AB AL BO ZZZ XFD`, numbers, `SUM IF ROUND`, operators, braces and `Material-*` / `ExchangeRate-*` names refused `RATE_NAME_REFUSED`. Extra key, missing value, array body: 422; invalid JSON and empty body: 400. Names holding quotes, SQL words, `&lt;script&gt;`, accents or a trailing `%` are stored as text and nothing runs |
| AC-3 edit; the formula holds the ID | 19 QA tests; developer `masters-service-set.test.ts`, integration, E2E edit | EP, DT | ✅ Pass | Name, unit and value changed together and one at a time; the ID never changes. Renaming a used seed rate keeps its ID and its "Used in", writes no new `config_versions` row, and the stored formula, shown with the new names by `toDisplayForm`, carries the new name; renamed back. A change of letter case only is accepted; a change that changes nothing is a 200 with no entry. A rename onto another rate's name (any case) is `NAME_TAKEN`. Empty change, unknown key, bad value, bad unit: 422, nothing changes. ID not a UUID: 422; a UUID nobody has: 404; capital letters in the ID still find the rate. The 15 seed names are accepted with the seed configuration (each renamed with its first letter in the other case and back) |
| AC-4 delete; used rate refused; plain text, no link (PO) | 23 QA tests; 1 QA browser test at 3 widths; developer integration, E2E delete and blocked tests | EP, DT, ST | ✅ Pass | An unused rate: 204 with no body, row gone, absent from the list. The 14 used seed rates: 409 `PROCESS_ITEM_IN_USE`, `usedBy` equal to my recomputed list, each item only `{letter, label}`, no URL, no `href`, no `/config/fields` in the body; row kept and no entry. `Plating-rate-per-sqin` (no formula) deleted 204 with one `master.deleted`. A second delete and an invented ID: 404; invalid ID: 422. In the browser the refusal dialog has no `a` and no `[href]` element, exactly one button (Close, focused), the formula table, 0 axe violations, no sideways scroll, Escape returns focus to the row |
| AC-5 one audit entry per change: `master.created`, `master.edited`, `master.deleted` | 25 QA tests; developer `masters-audit-events.test.ts`, `audit-database.test.ts`, integration DEF-017 block | EP, ST, EG | ✅ Pass | Read with plain SQL, one entry per change with `object_type` `process_item`, the object ID, the actor's ID and label, the `X-Request-Id` of the response, and the right `before`/`after` (created: before null; edited: both; deleted: after null; label is the new name after a rename). The only events are those three (no `master.process_item.*`). **Refusals write nothing:** validation, name taken, name refused, in use, not found (PATCH and DELETE), empty change, bad unit, and a foreign or missing Origin: 11 calls, statuses as expected, entry count and rate names unchanged. **Atomicity through the API**, for each of the three events, with the unit of work failing after its last step and with the audit service refusing the entry: 500 with the generic words, no row change, no entry. **Planted audit bypasses:** see the table below |
| AC-6 Admin only, role first, no rate to anyone else | 8 QA tests; developer `role-matrix.test.ts`, `csrf.test.ts`, `process-master-confidential.test.ts` (interim scan, accepted at G6) | DT, EG | ✅ Pass (interim canary scan as accepted at G6 and G7) | A Lead gets 403 and an Engineer 403 and signed-out 401 on all six calls (GET, POST, PATCH and DELETE with a real and an invented ID); the six bodies are identical apart from the request ID, so the role check comes before any lookup; no response holds the canary name or value (`7777.77`); nothing changes. The page `/masters/process`: Lead and Engineer get the forbidden screen, signed-out is sent to sign-in. CSRF: a foreign Origin and no Origin both give 403 `ORIGIN_REFUSED` on POST, PATCH and DELETE; `Sec-Fetch-Site: same-origin` is accepted. A deactivated Admin and a raised session version get 401 at the next request. The `canaryMasters` part moves to AQP-57 (master's ruling 5) and is not judged here |
| AC-7 three widths, 44 px, axe, keyboard | developer `process-master.spec.ts` (14 tests × 3), QA browser spec (3 × 3) | EP | ✅ Pass | `npx playwright test tests/e2e/process-master.spec.ts tests/e2e/zz-qa-aqp113.spec.ts --retries=0`: **53 passed** (the 2 set-up tests and 17 at each of mobile 360, tablet 768, desktop 1366). Axe with the project's tags (`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`) 0 violations; targets 44 px and 36 px for row icons; no sideways scroll, also with a 100-character name with no space in the list, the edit dialog and the delete dialog; a name that looks like markup (`&lt;b&gt;`, `"`, `&amp;`) is shown as text in the list, the edit dialog and the delete dialog (no `<b>` in the page) |
| AC-8 skeleton after 300 ms, empty with Add, no match with Clear filters, error with Try again | developer E2E (search, skeleton, empty, error tests × 3 widths); QA 169-test file for the API side | ST | ✅ Pass | The four states pass at all three widths in the 53-test run, the skeleton test held on a promise and not on a fixed delay (QLT-16): no timeout raised, no retry |
| AC-9 README "First use" | 1 QA test; developer `readme-first-use.test.ts` | EP | ✅ Pass | The section says: enter all 15 rates before any estimate is calculated, on Masters, Process master, because a rate left at 0 prices that process at 0 with no message; a rate ending in `%` is typed as a whole percentage |

### AC-5: planted audit bypasses (G7 evidence, AQP-74 rule)

Each fault was planted in `src/server/services/masters-service.ts` alone, my QA file run (169 tests), then `git checkout -- src`. "Developer's suites" is `tests/unit tests/integration tests/security` (2,909 tests), run with the three faults that no focused developer test caught.

| Event | Fault | QA file: tests failing | Developer's suites |
|-------|-------|------------------------|--------------------|
| `master.created` | entry omitted | 17 | focused set (166 tests): 5 fail |
| `master.created` | entry written in a second transaction inside the change | 1 (late failure: a rate-less entry would survive) | 1 fails |
| `master.created` | entry written in its own transaction after the commit | 1 (the audit service refuses: the rate would survive) | 1 fails |
| `master.edited` | entry omitted | 7 | 7 fail |
| `master.edited` | second transaction inside the change | 2 | 1 fails |
| `master.edited` | after the commit | 1 | **0 fail (2,909 tests green)** |
| `master.deleted` | entry omitted | 22 | 3 fail |
| `master.deleted` | second transaction inside the change | 1 | **0 fail** (the only red file is the unrelated timeout of OBS-7) |
| `master.deleted` | after the commit | 1 | **0 fail** (same) |

The limit stated in `late-failure.ts` still holds: an entry committed in a separate transaction before the change cannot be caught by a later failure.

### DEF-006 and the other planted faults

| Fault | What it removes | QA tests failing |
|-------|-----------------|------------------|
| Round-1 rule only | the set check and the round trip | 23 |
| Set ambiguity guard removed | reverse order and renames of parts | 8 |
| Round trip removed (add and rename) | probes (a), (b), `AL-Waste`, spaced operators | 11 |
| Round trip on add only (rename path skipped) | rename probes | 7 |
| Round trip on rename only (add skipped) | add probes | 6 |
| Round-trip before/after comparison removed (QLT-17) | the "already broken" control | 1 |
| Ambiguity before/after comparison removed (QLT-17) | the "already unsafe set" control | 2 |
| Round-trip message that names the rate | the "no name in a refusal" rule | 11 |
| Delete takes no table lock first | delete versus update | 11 (three runs of three: the same 11 each time) |
| In-use check removed from delete | AC-4 | 3 |
| Lead allowed on the list and add routes | AC-6 | 1 |
| CSRF origin check switched off | AC-6 | 3 |

## Round-1 and round-2 evidence list (gate log, G6 records of 2026-11-06 and 2026-11-07)

| Required evidence | Result | Where |
|-------------------|--------|-------|
| Each AC | ✅ | The matrix above. AC-4 is plain text and no link (PO 11142); AC-5 uses `master.created/edited/deleted` |
| DEF-006: compound then parts, parts then compound, rename, each refused through the API, a planted fault for each | ✅ | `DEF-006 round-1 cases through the API` (7 name-order tests and 16 for the seed names) and the fault table: "round-1 rule only" 23 tests, "set guard removed" 8, "round trip on rename only" 6 |
| Audit trail: one entry per event in the change's transaction; a planted bypass for each of the three events fails a test; a refused change writes no entry | ✅ | AC-5 and the bypass table (9 bypasses, all caught by QA's file) |
| Locks: a delete and an update of one rate raced end without a 500 | ✅ | 12 rounds through the API: the DELETE is always 204, the PATCH 200 or 404, one `master.deleted` entry, and `master.edited` exactly when the PATCH succeeded. Two DELETEs at once: 6 rounds, one 204 and one 404. Four POSTs of one name in different case: 6 rounds, one 201 and three `NAME_TAKEN`. The two parts and their compound at once: 6 rounds, exactly two succeed and one is `RATE_NAME_REFUSED`. The lock fault makes 11 tests fail |
| QLT-05: a failed configuration read writes nothing | ✅ | POST, PATCH, DELETE and GET answer 500 (generic words, the failure text not leaked); no row, value or entry changes; after the read works again, the same POST succeeds (no "already exists") |
| QLT-06: a rate deleted elsewhere | ✅ | Edit then Save and Delete then Delete rate, each after the rate was deleted by a second request: the dialog closes with no error inside it, one `role="status"` notice, no `alert` in `main`, the list is read again, the row is gone, and the `h1` has focus. The strings in the developer's E2E equal the table in ux-spec v0.17, SCR-11 (which records Jira 11143): "`<name>` no longer exists." with "It was deleted after you opened this list, so your changes were not saved. If you still need it, press Add rate." (warning tone), and "`<name>` was already deleted." with "It was deleted after you opened this list, so there was nothing to delete." (information tone). The Jira comment itself was not readable |
| Skeleton and empty state (AC-8) | ✅ | In the 53-test run, at 3 widths |
| Three widths, axe `wcag21a` 0, keyboard, 44 px | ✅ | AC-7 |
| Stage 11b: every route under 190,000 B | ✅ (CI) | CI run 42330556486 reads `/masters/process` 173,446 B gzip (limit 200,000; the story target 190,000), all 8 rows pass. A local re-run was not possible (the measurement user cannot be added to a database that already holds the E2E Admin); the one row that needed no sign-in, `/sign-in`, read 166,336 B locally, the same as CI |
| Regression green | ✅ | Below |
| Round-2 add-ons: probes (a) and (b) through the API | ✅ | Below |
| One of quality's extra shapes (a column letter plus hyphen) through the API | ✅ | Below |
| Every refusal message names no rate and no formula | ✅ | Below |
| The seed set and the seed configuration still accepted; QLT-17 | ✅ | Below |

### QLT-15 probes through the API (names invented, the formula stored as a `config_versions` row)

The formula sits on the row-level leaf field "Unit Production Price (USD)" (position 62), so the stored document is valid (`parseConfigDocument` runs when the version is read) and no seed use of a rate changes. A first attempt with the formula on the Approved Quote Price was rightly refused as a document ("The approved price is entered at approval and has no formula."), so the developer's injected-document tests and my stored-version tests agree on the outcome but I used a field the real parser accepts.

| Set | Stored formula | Step | Result |
|-----|----------------|------|--------|
| (a) `Cost`, `Waste-Fee`, `Cost-Waste`, `Cost-Waste-Fee` | `{{Cost}}-{{Waste-Fee}}` | add `Cost-Waste`, then `Cost-Waste-Fee` | `Cost-Waste` refused by the round trip (`ROUND_TRIP_MESSAGE`); `Cost-Waste-Fee` refused by the name guard (it reads as the formula's own two rates); no row, no entry |
| (a) other order | same | add `Cost-Waste-Fee`, then `Cost-Waste` | Both refused |
| (a) by rename | same | a spare rate renamed into `Cost-Waste`, then into `Cost-Waste-Fee` | Both refused, the spare keeps its name, no entry; a harmless rename of it is accepted |
| (b) `Cost`, `Waste-Fee`, `Cost-Waste`, `Fee` | same | add `Fee`, then `Cost-Waste` | `Fee` accepted; `Cost-Waste` refused by the round trip, no row, no entry |
| (b) other order | same | add `Cost-Waste`, then `Fee` | `Cost-Waste` refused; `Fee` accepted |
| (b) by rename | same | spare to `Fee` (accepted), another spare to `Cost-Waste` (refused); and the other order | As stated |
| Column letter plus hyphen | `{{AL}}-{{Waste-Fee}}` (AL is the field "Cutting Cost") | add and rename to `AL-Waste`, with and without a rate `Fee` | Refused by the round trip only (the name guards pass this name) |
| Spaced operator | `{{Cost}} - {{Waste-Fee}}` | add `Cost - Waste` | Refused; `Harmless-Rate` accepted |
| Renamed rate inside the formula | `{{Xq}}-{{Fee}}`, `Waste-Fee` exists | rename `Xq` to `Waste` | Refused, `Xq` keeps its name |
| Control | same family | add a name that touches no stored formula; rename `Cost` to `Cost2` | Both accepted |

### QLT-17 (only what the change introduces counts)

A stored set that was ambiguous already (three rows put in by SQL, as a loader would) does not refuse an unrelated add, an unrelated rename of a seed rate or an edit of a value, and an add that makes another name ambiguous is still refused. A formula that already did not round-trip (`Pa`, `Qb-Rc` and a stored `Pa-Qb-Rc`) does not refuse an unrelated add or a rename of a seed rate. Faults for both comparisons are caught (1 and 2 tests).

### No refusal names a rate or a formula

Read across every 422 the run saw: 55 `RATE_NAME_REFUSED` and 28 `NAME_TAKEN` bodies. Each has exactly one error, on the field `name`, the fixed title "Check the values and try again.", no `{{`, `rate:` or field reference, and none of the names this file invented (nor the short probe words `Cost`, `Waste`, `Fee`, `Pa`, `Qb`, `Alpha`, `Beta`, `Gamma`, `Delta` outside the sentences' own vocabulary). There are six distinct sentences:

1. "A rate with this name already exists."
2. "A rate cannot be named like a Material-* or ExchangeRate-* operand."
3. "A rate name cannot hold braces, brackets, commas, arithmetic or comparison signs, or control characters."
4. "A rate name cannot read as column letters, numbers, operators or other rate names: a formula would take it for those."
5. "This set of names would make a rate name read as column letters, numbers, operators or other rate names: a formula would take it for those."
6. "This name would change how an existing formula reads, so it cannot be used." (the ruled sentence, checked for equality)

The 409 for a used rate is a different refusal: its title names the rate the Admin chose to delete and its body lists the formulas by column letter and label, as AC-4 and the dialog require (OBS-6). A fault that puts the rate name into the round-trip message makes 11 tests fail.

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| QA acceptance (API) | `npx vitest run tests/acceptance/aqp-113-process-master.test.ts` | 169 | 169 | 0 | 0 | 15 to 40 s |
| QA and developer Process master E2E, 3 widths | `npx playwright test tests/e2e/process-master.spec.ts tests/e2e/zz-qa-aqp113.spec.ts --retries=0` | 53 | 53 | 0 | 0 | 5.7 min |
| Lint | `npx eslint .` on the clean head | | exit 0 | | | |
| Type-check | `npx tsc --noEmit` on the clean head | | exit 0 | | | |
| Full regression, run 1, clean head, before any QA file | `npx vitest run` | 3,415 (162 files) | 3,415 | 0 | 0 | 146 s |
| Full regression, run 2, with QA's file | `npx vitest run` | 3,585 (164 files) | 3,559 | 1 (load, passes alone) | 25 (the same file) | 168 s |
| The two load-sensitive files alone | `npx vitest run tests/acceptance/aqp-38-sign-in.test.ts`; `npx vitest run tests/unit/playwright-system-deps.test.ts` | 42; 25 | 42; 25 | 0 | 0 | 6.5 s; 34 s |
| Full browser regression, 3 widths | `npx playwright test --retries=0` (config default is one retry; I turned it off) | 460 | **439** | 0 | 21 (viewport-conditional shell and drawer tests that skip themselves at the wrong width, none of them Process master) | 18.0 min |
| Migrations | `npx prisma migrate deploy` on an empty database | | all 6 applied | | | |
| Stage 11b | CI, run 42330556486 | 8 rows | 8 | 0 | | |

Notes on load. In run 2 two files failed on this PC and passed alone: `aqp-38-sign-in` (a 5 s test timeout, the one the Dev Record names) and `playwright-system-deps` (a 120 s hook timeout; it runs Linux shell scenarios, failed on its 120 s hook limit in four of the six local runs that included it, at 126 to 159 s, and took 34 s alone). Neither file is in the PR. They are the load-sensitive class of DL-057; no limit was raised and nothing was retried. Along the way one test of my own timed out at 5 s under load (31 sequential API calls in one test) and I split it into one test per rate instead of widening the limit.

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Cost confidentiality | NFR-002, BR-004 | Canary name and value on a rate; every route as Lead, Engineer and signed out; strict output schemas; `process-master-confidential.test.ts` in the regression | ✅ No rate, name or value reaches anyone but the Admin (AC-6) |
| Role, session, CSRF | NFR-001, NFR-003 | Role first (identical bodies for a real and an invented ID), deactivation and session version at the next request, foreign and missing Origin | ✅ |
| Input validation and error leakage | NFR-003 | Boundaries, injection-style names, a 1 MB name (422, not 500), empty and invalid JSON (400), generic 500 for late failures and a failed configuration read | ✅ |
| Accessibility | NFR-018 | axe with `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`, keyboard dialogs, focus returns, in the 53-test run at 3 widths | ✅ 0 violations |
| Responsive | NFR-016, NFR-017 | 360, 768, 1366 px; no sideways scroll including a 100-character name; 44 px and 36 px targets | ✅ |
| First-load JavaScript | NFR-009 | CI stage 11b | ✅ 173,446 B gzip for `/masters/process` |
| Performance smoke | NFR-010 (feasibility) | In-process, local PostgreSQL: 25 simultaneous list reads and 25 simultaneous edits of 25 different rates | Reads p95 88 to 262 ms. Edits p95 386 ms on a quiet machine, 1,026 to 1,153 ms when the machine was busy, because every change takes the table lock and so edits queue (OBS-5). No 500. In Release 1 there is one active Admin, so the figures describe a load that cannot occur; NFR-010 itself is a staging load test |
| Secret scan | | Gitleaks per DL-108 on the commit's tree before the push | See the PR comment |

## Exploratory Testing

**Charter 1 (45 min): break the name rules through the API.** Areas: sets of names that read as other names, in every add and rename order; stored formulas from the configuration; lookalike and control characters. **Found:** nothing against the ACs. The two probe families of the round-2 ruling and my own three (column letter plus hyphen, spaced operator, renamed rate inside the formula) are all refused. Observations OBS-2 and OBS-4.

**Charter 2 (30 min): races and failures.** Areas: delete versus update, delete versus delete, same name in four letter cases, parts and compound at once, a configuration that cannot be read, a transaction that fails after its last step, an audit service that refuses. **Found:** no 500 in any ordering; one gap in the developer's tests (OBS-1).

**Charter 3 (25 min): hostile input and the browser.** Areas: names that look like markup, a 100-character name, a 1 MB name, content types, the refusal dialog's markup. **Found:** a `text/plain` body is accepted (OBS-3); nothing else.

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-006 ([AQP-181](https://sankumar76.atlassian.net/browse/AQP-181), [#49](https://github.com/sankumar76/Accucut-Quotation/issues/49)) | Rate-name guard accepts a name that reads as other rate names and an operator | Sev-3, type Product | **Verified for R1 on `c262853`; closes after the posted G7 (DL-098)** | AQP-106 AC-6; AQP-113 AC-2, AC-3 |

No new defect. Open by severity: Sev-1 0, Sev-2 0, Sev-3 0 (DEF-006 is verified, not open for a fix), Sev-4 0. The R2 write paths are #112 and RISK-024, as new work, not DEF-006 (DL-110).

## Observations (not defects; for master to route)

| ID | Observation | Suggested home |
|----|-------------|----------------|
| OBS-1 | **Test gap (type Test, Sev-3 if master counts it).** The developer's late-failure runner makes every transaction fail, nested ones too, so a bypass that writes the entry in a second transaction inside the change is not caught for `master.deleted`; and no developer test catches an entry written after the commit for `master.edited` or `master.deleted`. The code is correct today. QA's file catches all nine bypasses (table above). **It is not committed**, because this run was told to commit only the report and the DEF-006 record. Committing `tests/acceptance/aqp-113-process-master.test.ts` closes the gap (QA files after G6 need no peer review, DL-050 and DL-060), or the developer can use `late-failure.ts`'s outermost-only runner for masters | master: commit QA's file, or log a Test defect |
| OBS-2 | A name with a zero-width space after it, a composed and a decomposed accent, or a Cyrillic lookalike letter is accepted as a second rate that looks identical to the first (the unique index compares `lower(name)` as bytes). A non-breaking space is trimmed and gives `NAME_TAKEN`. Sev-4, copy-paste is the realistic cause | product-owner: normalise to NFC and strip zero-width characters, or accept |
| OBS-3 | A `POST` with `Content-Type: text/plain` and a JSON body is accepted (201). The Origin check stops a cross-site form, so this is not exploitable; requiring `application/json` would be one more layer | solution-architect |
| OBS-4 | An all-capitals name is refused with the column-letter sentence, because a short capital word such as `PER` or `SEC` reads as column letters (so `FOAM COST` cannot replace `Foam Cost`). Lower-case `a`, `ab`, `bo`, `sum` are accepted because column letters and functions are upper case. Both are by design (AQP-106 OBS-4); only the Admin's surprise is a concern | ux-expert: a line in the hint |
| OBS-5 | Every change takes the table lock (`SHARE ROW EXCLUSIVE`), including an edit of one value, so edits queue: 25 at once took p95 386 ms quiet and 1,026 to 1,153 ms busy. One active Admin makes this academic; the performance lens already accepted the design | solution-architect, with PRF-04 |
| OBS-6 | The 409 for a used rate names the rate being deleted in its title and lists the formulas by letter and label. This is what AC-4 and the dialog ask for; it is stated so nobody reads "no refusal names a rate" as covering it | none |
| OBS-7 | `playwright-system-deps.test.ts` hit its 120 s hook limit in four of the six local runs of this session that included it (126 to 159 s) and took 34 s alone. A Linux script test on Windows under load; not in the PR. DL-057 class | master: DEF-003 class, or exclude on Windows |

## Residual Risks / Notes

- **The AC text came from the PR, not Jira.** The Atlassian connector was unreachable. The AC wording, the ux-expert's QLT-06 comment (11143) and the product-owner's comments (11141, 11142) were read through the PR's AC table, the three review reports, ux-spec v0.17 and the gate log, which quote them. If Jira's AC text differs in a detail (a decimal rule, a button label), this report does not show it.
- **AC-6 is the interim scan.** `canaryMasters` and `PROCESS_MASTER_CANARIES` are AQP-57's (ruling 5).
- **R2 write paths.** The round-trip invariant holds at create and rename only. A formula editor, re-lettering, publish and revert are #112 and RISK-024; older versions and a version published during a rename (QLT-19) are not checked here.
- **Independence.** I wrote the QA file after reading the service and the developer's tests, as the test plan allows; the independence is in the oracles (SPEC 4.1 names, a used-by list recomputed from the seed text, plain SQL for audit rows, the ruled sentences, a stored configuration read the way production reads it).
- **Not done.** No real-device or screen-reader check (this story has no such AC); no staging load test; Lighthouse not run (stage 11b is the NFR-009 measure); the local JS-budget run failed to start for the reason given above; the Jira and GitHub MCP servers were unreachable, so GitHub was read and written with `gh` and the Jira comment text is handed to the orchestrator.
- **Clean-up.** The throwaway container `qa113-db` (host port 55513) and its volume are left for removal by the orchestrator if this session could not remove them. `tests/acceptance/zz-probe.test.ts` (an untracked scratch probe) is in the QA worktree only; this session could not delete files. Neither is committed.

## Artefacts

Committed with this report: `docs/07-qa/AQP-113-test-report.md`, `docs/07-qa/defects/DEF-006-rate-name-guard-ignores-other-rate-names.md`.
Not committed (per the brief): `tests/acceptance/aqp-113-process-master.test.ts` (169 tests) and `tests/e2e/zz-qa-aqp113.spec.ts` (3 tests), in the scratchpad worktree `qa113`.

## Hand-off
- Status: COMPLETE
- Recommendation (G7): ACCEPT (Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0 new; DEF-006 verified)
- Jira / GitHub: PR comment on #107 posted with `gh`; the Jira comment text is handed to the orchestrator (connector unreachable). No transition done; AQP-113 and AQP-181 go to Done only after master's posted G7 decision (DL-098)
- Story status: not changed by QA
