# Test Report — AQP-123 (STORY-02.04): Exchange Rate Master

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `e72e8f2681b9f6136d1db40e5b5fab82412bc76c` on `feat/AQP-123-exchange-rate-master` (PR #151, `sankumar76/Accucut-Quotation`), checked out in a scratchpad worktree. The head did not change during the run. The QA commit adds one test file and documents only; it changes nothing under `src/`. PR #151 is BEHIND `master` by docs-only changes (not merged into the branch, as ruled) |
| CI | Reference run 42780235188 on `e72e8f2` (attempt 1): 5 of 5 green, path 6:10. Run on the QA commit: @@CI@@ |
| Environment | Windows 11; Node v24.19.0 (CI uses Node 22); Docker 29; PostgreSQL 17 as a throwaway container `qa123-db` on host port 55523 (invented passwords, bound to 127.0.0.1), all 8 migrations applied (including `20261110040000_exchange_rates`), drift check "No difference detected", configuration version 1 created by `scripts/ensure-seed-version.ts` as CI does; Chromium by Playwright 1.64.1; development server for the browser work, production build (`next build`, `next start` on 3101) for the Engineer scan. No shared or production environment was used. `.env*` and `AMADA-20261006.xlsx` were not opened. The container, both servers and the worktree changes were removed at the end |
| Date | 2026-11-10 |
| **Recommendation** | **ACCEPT.** All 7 ACs pass with evidence at 360, 768 and 1366 px, AC-4 read on the amended text (`master.edited` / `exchange_rate`). All ten D3 items are done. Every planted fault is caught (11 plants, table below). QLT-11 was run by QA in its own run and the canary pair was restored. No open Sev-1 or Sev-2 defect against AQP-123. Condition F found **three** confirmed focus-jump faults in the delivered Add dialogs, all on `master`: **DEF-024 (Material, AQP-122, Sev-2)**, **DEF-025 (Process, AQP-113, Sev-2)** and **DEF-026 (Users, AQP-65, Sev-3)**. They do not bind this PR (DL-129 (8), DL-131 (3)); they bind the stories that delivered those screens, with owner developer and due before G8. Open by severity, all stories: Sev-1 0, Sev-2 2 (DEF-024, DEF-025), Sev-3 3 (DEF-026, and DEF-022 and DEF-023 from earlier reports), Sev-4 0 |

## Summary

The Exchange rates tab and `GET` / `PUT /api/v1/exchange-rates` do what the seven ACs say. I tested through the real route handlers, the real service and the real audit service over PostgreSQL (60 new tests), then in a real browser at three widths on stored data, with the keyboard only wherever the story names it. The two rates are saved together with one stamp (person and instant, stored in UTC, shown in IST), a value of 0 to 99 999 999 999.99 with up to two decimals is accepted, 28 kinds of bad value are refused with 422 naming the field and change nothing, and a save that changes a rate writes exactly one `master.edited` entry with `object_type` `exchange_rate` and the fixed `object_id` `00000000-0000-4000-8000-000600000001`, in the change's own transaction. A save that changes nothing, a refusal, a refused caller and a `GET` write no entry. A Lead, an Engineer and a signed-out caller get 403 / 403 / 401 with no rate in the body; the Engineer scan on the production build finds nothing and its end-of-scan check fails when the stored pair is not the canary pair.

QLT-01 is fixed on the screen: after a refusal of both fields, fixing USD first or EUR first keeps the focus and every typed letter in the field being typed in, by keyboard only, at all three widths, and also after a server 422 that names both. The test that proves it fails 9 of 9 when the old behaviour is planted back.

The one new problem is outside this story's diff and was found by the condition-F check the master asked for: the same focus effect, keyed on the `errors` object, is on `master` in the Material, Process and Users Add dialogs and moves focus while a person types (below). It was reproduced at all three widths in all three dialogs.

## AC Verification Matrix

Test IDs: `[AQP-123 AC-n]` is the title prefix of the 60 tests in `tests/acceptance/aqp-123-exchange-rates.test.ts` (committed, CI). `D3-n`, `E-n` and `F-a/F-b` are the QA browser probes (not committed as CI specs, see "Why the browser probes are not in CI"); their source and output are in `docs/07-qa/AQP-123-evidence/`. Developer files named where used. Techniques: EP equivalence partitioning, BVA boundary values, DT decision table, ST state analysis, EG error guessing.

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 two fields, stored values or "Not set yet", "Last updated by ... IST." | QA `AC-1` (5 tests: empty, after a save, three IST cases); probe `D3-7`, `D3-9`; developer `exchange-rates.spec.ts`, integration "AC-1" | EP, BVA, ST | ✅ Pass | Empty database: `usd` and `eur` null, no stamp, the four columns BH, BI, BJ, BK with the registry labels, `no-store`. After a save: values with two decimals ("90.5" is "90.50"), the saver's name, the instant as ISO UTC, and the same instant in both rows. Midnight IST written by hand: 18:29:59 UTC is "09 Nov 2026, 23:59", 18:30:00 UTC is "10 Nov 2026, 00:00", 20:00 UTC on 31 Dec is "01 Jan 2027, 01:30"; `formatIst` agrees. In the browser (`D3-7`) the stamp line is the DB instant plus 5 h 30 min worked out in the test, as text, and the two fields are labelled "1 USD in ₹" and "1 EUR in ₹" |
| AC-2 both saved together, idempotent, `updated_by` / `updated_at` (UTC), values 0 or more, up to 2 decimals | QA `AC-2` (10 valid forms, one-stamp, change-of-one, idempotent, privileges); probe `D3-7`, `E-2`; developer integration "AC-2, AC-4" | EP, BVA, ST | ✅ Pass | Accepted and stored: `0`, `0.00`, `0.01`, `83`, `83.3`, `83.37`, `083.50` (as 83.50), `0000.5`, ` 83.37 ` (trimmed), `999999999999.99` (12 digits). The first save inserts both rows with one person and one instant; a change of one rate stamps both rows again; the same body (or "083.50" for "83.5") gives the same answer, stamp included, and one entry. The runtime role cannot `DELETE` or `TRUNCATE` (the database says no). Browser: the keyboard save stores both with one stamp (`D3-7`); a double click on Save sends one request and writes one entry (`E-2`) |
| AC-3 (negative) 422 naming the field; neither rate changes | QA `AC-3` (28 bad forms x 2 fields = 56 requests, words, missing / unknown keys, bad JSON, 1 MB); probes `D3-1a/b/c`; developer `exchange-rates-routes` | EP, EG | ✅ Pass | Refused with 422 naming the field, the stored rows and stamp unchanged, no entry: blank, spaces, `-1`, `-0`, `-0.01`, `83.371`, `83.370`, `83.`, `.5`, `abc`, `83.37abc`, `1e2`, `1,000`, `83,37`, `8 3`, `+5`, `0x10`, `NaN`, `Infinity`, 13 digits, an Arabic-Indic digit, markup, a SQL string, and a JSON number, `null`, an array, an object and a boolean. Both wrong: both named, with the UX words "Enter a number, 0 or more, with up to 2 decimals.". A missing field, `updatedBy`, `updatedAt`, `currency`, `__proto__` are 422; bad JSON and an empty body are 400; a 1 MB value is refused (not 500) and not echoed |
| AC-4 (amended, `master.edited` / `exchange_rate`) one entry per changing save, before and after for each currency, none when nothing changes | QA `AC-4` (5 tests); probe `D3-7`, `E-1`; developer integration "AC-4 (DEF-017)" | ST, DT, EG | ✅ Pass | Read with plain SQL: first save: one entry, `event` `master.edited`, `object_type` `exchange_rate`, `object_id` the fixed literal (written in the test, not imported), `object_label` "Exchange rates", the actor, the `X-Request-Id` of the response, `before` `{usd: null, eur: null}`, `after` both rates. A change of one currency is one entry holding both before and after; three saves make a chain (each `before` is the previous `after`). No entry for: a save that changes nothing, "081.370" for "81.37", every refusal, a `GET`, a foreign or missing Origin, a Lead, an Engineer, a signed-out caller. Atomic: with the unit of work failing after its last step the save answers 500 with the generic words, stores nothing and keeps no entry, for the first save and a later save. Six saves at once leave one request's pair entire, one stamp and a chain of 7 entries. In the browser (`D3-7`) the entry for the keyboard save has `before` the canary pair and `after` the other pair, and the restore has the reverse. A stale second tab that saves values already stored gets 200, "Exchange rates saved.", and no second entry (`E-1`, UX QLT-06 a) |
| AC-5 (UX-23) hints name the columns by the registry's letters | QA `AC-5` (2 tests); probe `D3-9`; developer `exchange-rates-lib`, `masters-service-exchange-rates` (re-lettered registry), spec | EP, EG | ✅ Pass | The answer carries BH / BJ for USD and BI / BK for EUR with their labels; the screen shows "Converts prices to US dollars. The rate (BH) feeds Unit Production Price (USD), BJ." and the euro sentence with BI and BK, taken from the answer. A damaged registry (no field for `exchange-rate-usd`) makes `GET` and `PUT` answer 500 and a save writes and audits nothing (the registry is read before the transaction) |
| AC-6 (NFR-001, 002, 006; BR-003, BR-004) Admin only; scan finds 0 | QA `AC-6` (3 tests); probe `D3-9 AC-6`; developer `role-matrix`, `strict-schema`, `csrf`, `engineer-refused-before-lookup`, `canary-scan.spec.ts` | DT, EG | ✅ Pass | Lead 403, Engineer 403, signed out 401 on `GET` and on `PUT`; the Lead and Engineer bodies are identical apart from the request ID and hold neither canary, nor "usd", "eur", "inr"; `no-store`; the stored pair is untouched. The Admin's own refusal does not echo a rate. A foreign or missing Origin on `PUT` is 403. A deactivated Admin and a raised session version are 401 at the next request. Browser: a Lead and an Engineer get status 403 on `/masters/materials`, no "Exchange rates" tab, and no canary or rate key in the page or the two route answers; an anonymous context gets 401. Production build: `canary-scan.spec.ts` 12 of 12 (desktop), the Admin control finds both canary rates in the Admin's answer. Plants: Q5 (Lead allowed) fails 2 of 60 QA tests and 6 of 1,080 developer tests |
| AC-7 (NFR-016 to 018) 360 / 768 / 1366, 44 px, axe 0, keyboard, `inputmode` | probe `D3-9`, `D3-1a/b/c`, `D3-7`; developer `exchange-rates.spec.ts` x 3 | EP | ✅ Pass | On the real server with stored data, at 360, 768 and 1366 px: no horizontal page scroll in the default, refused, "nothing to save" and 300-digit states; axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) 0 violations in each; both fields, Save and the tab at least 44 px high; both fields `inputmode="decimal"`. Keyboard only: the tab opens with the arrow key, Tab goes USD, EUR, Save, Enter saves, focus is back on Save, and the notice is a `status` |

## DL-131 evidence list (gate-record D3, ten items, on `e72e8f2`)

| # | Required evidence | Result | Where |
|---|-------------------|--------|-------|
| 1 | Keyboard-only run at 360, 768, 1366 px: two-field refusal; fixing USD first; EUR first; a server 422 naming both; focus and text stay in the field typed | ✅ | Probes `D3-1a`, `D3-1b`, `D3-1c`: 9 of 9 (3 x 3 widths). 1a: after "abc" / "-1" refused, focus is on USD; typing `81.37` keeps focus and text in USD, EUR keeps `-1` and its message. 1b: Tab to EUR, `88.37` stays in EUR, USD keeps `abc`; Shift+Tab and fixing USD clears both messages. 1c: the body of a real 422 (taken from the live route) served for the `PUT`; typing `84.37` stays in USD, Tab and `85.73` stay in EUR |
| 2 | QLT-01 tests failing with the old focus behaviour planted back, diff posted | ✅ | Control 9 of 9 pass; plant (setField also asks for focus on the first other field with a message) 9 of 9 fail. Diff `plant-QLT01.diff`, output `plant-QLT01-output.txt` |
| 3 | A3 and A4 re-planted on the final head | ✅ | A3 (entry in a second transaction on the first save): developer integration 1 failed ("first save (create): no rate is left and no entry is kept"), QA 1 failed ("atomic ...") of 86. A4 (same on a later save): developer 1 failed ("a later save (edit) ..."), QA 1 failed. Diffs `plant-A3.diff`, `plant-A4.diff` |
| 4 | DEF-020 guard plant on the final head | ✅ | Control 3 of 3 pass (3 widths); with `focusOpener(SAVE_BUTTON)` in place of `focusOpener(SAVE_BUTTON, status === 'error')` 3 of 3 fail. Diff `plant-DEF020.diff`. My own `D3-8b` (real save, then the read fails) also holds focus on the error title for 500 ms after it |
| 5 | QLT-02 post-scan check fails when the stored pair is not the canary pair | ✅ | Production build, `canary-scan.spec.ts`, desktop: control 12 of 12 pass. Plant (i), the expected `USD` in the check is `838.3701`: 3 scan tests fail with "the canary exchange rates were in the database when the scan ended" (`Expected 838.3701`, `Received 838.3700`). Plant (ii), the loader stores USD `1.00`: the same 3 fail (`Expected 838.3700`, `Received 1.0000`). Diffs `plant-QLT02-*.diff` |
| 6 | QLT-10 retry: a second pass of the saving tests on the same database | ✅ | The two saving tests ("by keyboard only", "DEF-020") at 3 widths: pass 1 6 of 6, pass 2 6 of 6 (no test dependent on the database starting empty) |
| 7 | **QLT-11:** QA's own run, no Engineer scan running, keyboard-only save of another pair; one stamp; one `master.edited` / `exchange_rate` entry with the fixed `object_id`; then the canary pair restored | ✅ | Probe `D3-7` at 360, 768 and 1366 px. With the canary pair stored, Tab-only entry of `91.37` / `92.73`, Enter: 200, "Exchange rates saved.", focus back on Save. Rows: EUR `92.7300` and USD `91.3700`, same `updated_by`, same `updated_at` `2026-11-10T13:44:24.284Z` (equal to the answer's `updatedAt`). Audit: one new entry, `master.edited`, `exchange_rate`, `00000000-0000-4000-8000-000600000001`, `before` `{usd 838.37, eur 839.73}`, `after` `{usd 91.37, eur 92.73}`, actor "E2E Admin". Save with nothing changed: "You have not changed either rate, so there is nothing to save." and no request. Restore by keyboard: second entry (`before` the other pair, `after` the canary pair), and the database holds `838.3700` / `839.7300` (checked by SQL at the end of the probe and again before the scan). The stamp line on screen equals the stored instant in IST |
| 8 | The five sentences match ux-spec v0.21 | ✅ | Probe `D3-8` and `D3-8b`, strings written out from ux-spec v0.21: Saved "Exchange rates saved." (`status`); Nothing to save "You have not changed either rate, so there is nothing to save."; Failed title "We could not save the exchange rates." with "Check your connection and try again. What you typed is still in the form." (`alert`, typed value stays, "Nothing was changed." absent); Loading "Loading the exchange rates" (shown while the read is held); Error "We could not load the exchange rates" with "Check your connection and try again. Nothing was changed." and focus on the title, and, with the Saved notice on the page, "The exchange rates were saved, but we could not show them. Check your connection and try again." |
| 9 | AC-1 to AC-7 at three widths, axe 0, 44 px, AC-4 on the amended text | ✅ | The matrix above |
| 10 | CI 5 of 5 and the path | @@CI10@@ | Below |

## Planted faults (G7 evidence; each planted alone, the file restored with `git checkout`, nothing committed)

| Plant | Fault | QA tests failing | Developer tests failing |
|-------|-------|------------------|-------------------------|
| A3 | audit entry in a second transaction inside the change, first save | 1 of 60 | 1 (integration) |
| A4 | the same, later saves | 1 of 60 | 1 (integration) |
| Q1 | a negative rate is accepted by the shared check | 25 of 60 | 46 of 1,082 |
| Q2 | a save that changes nothing still writes a stamp and an entry | 2 of 60 | 3 |
| Q3 | `object_type` `exchange_rates` | 5 of 60 | 4 |
| Q4 | the fixed `object_id` changed to `...000600000002` | 2 of 60 | 1 (the pin of the architect's ruling) |
| Q5 | a Lead may call the route (manifest row) | 2 of 60 | 6 of 1,080 |
| QLT01 | focus moves to another refused field while typing | 9 of 9 browser (developer spec); my probes `D3-1a/b/c` assert the same | n/a |
| DEF020 | the guard of the error title removed | 3 of 3 (3 widths) | n/a |
| QLT02 (i), (ii) | the post-scan check expects another pair / another pair is stored | 3 of 12 scan tests each | n/a |

Control (no fault): 60 of 60 QA tests; developer focused set 1,082 of 1,082; the scan 12 of 12.

## Condition F: the `[errors]`-keyed focus effect in the delivered dialogs (DL-129 (8), DL-131 (3))

Method (probe `aqp-123-focus-jump.spec.ts.txt`): as the Admin, open each Add dialog, press its submit button empty (every required field is refused and focus goes to the first message, as UX 6.0 "Forms" says), then by keyboard (a) type `xyz` into the field that has focus, and (b) put focus on the second refused text field and type `xyz`. Right behaviour: every letter lands in the field the person is in and focus stays. The files of the three dialogs are byte-identical on this head and on `origin/master` (ce9c02c). Same result at 360, 768 and 1366 px (`focus-jump-results.txt`, 18 runs).

| Dialog (story) | Refused by an empty submit | (a) `xyz` in the first field | (b) `xyz` in the second field | Defect |
|----------------|---------------------------|-------------------------------|--------------------------------|--------|
| Add material (SCR-13, AQP-122) | 5 fields | `x` in Material in Drawing, `y` in Material Considered, `z` in Price per kg; focus ends on Specific gravity | `x` in Material Considered, then `y` in Material in Drawing, `z` in Price per kg | **DEF-024, Sev-2** |
| Add rate (SCR-11, AQP-113) | 3 fields | `x` in Name; focus moves to the Unit list, which takes no letters, so `yz` are lost | `x` in Default value, `y` in Name (`z` lost on the list) | **DEF-025, Sev-2** |
| Add user (SCR-14, AQP-65) | 3 fields | `x` in Name, `y` in E-mail, `z` in the masked password field | `x` in E-mail, `y` in Name, `z` in the password field | **DEF-026, Sev-3** |

Grading (test plan section 6): DEF-024 and DEF-025 are Sev-2 because a number meant for one cost field (a price, a specific gravity, a scrap rate, a rate's default value) can end in another or be cut ("83.37" typed in the default value becomes a default of 8 and a name "3.37", both valid), and AC-7 / UX 6.0 name keyboard-only use; the master graded the same fault on this story's rates as Major (QLT-01, DL-129 (1)). DEF-026 is Sev-3: no cost value is involved and names and addresses are shown; the masked password field is the reason the master may raise it. Each is "an AC fails with a workaround" (the person can retype after the refusal is cleared, or fill one field at a time before pressing the button). Each is on `master` now and affects every Admin who adds a record with two or more fields wrong. Owner developer, due before G8, with the `follow-up` for ux-spec v0.21 section 6.0 (AQP-1 11307) as one fix: ask for focus only when a refusal is shown, as `use-exchange-rates.ts` now does. The probe's F-a and F-b cases are the regression test.

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| QA acceptance (API, new) | `npx vitest run tests/acceptance/aqp-123-exchange-rates.test.ts` | 60 | 60 | 0 | 0 | about 21 s |
| Story files (developer) | `npx vitest run` on the exchange-rate integration, unit and security files | 117 (5 files) | 117 | 0 | 0 | 9 s |
| Lint | `npx eslint .` on the committed files | | clean | | | |
| Type-check | `npx tsc --noEmit` | | exit 0 | | | |
| Migrations, drift | `prisma migrate deploy` (8 applied); `prisma migrate diff ... --exit-code` | | "No difference detected" | | | |
| Full Vitest | `npx vitest run` (196 files, with the QA file) | 4,825 | 4,793 | 7 in 4 files (see note) | 25 | 396 s |
| The three load-sensitive files alone | `npx vitest run` on `aqp-122-materials-rules`, `aqp-38-sign-in`, `playwright-system-deps` | 145 | 145 | 0 | 0 | 97 s |
| Developer browser spec (baseline) | `playwright test --config playwright.local.config.ts exchange-rates` | 50 | 50 | 0 | 0 | 5.3 min |
| QA browser probes | `aqp-123-qa` at 360, 768, 1366 px (not committed) | 30 (10 per width) | 30 | 0 | 0 | 2 to 4 min per width |
| Condition F probe | `aqp-123-focus-jump` at three widths | 6 per width | the cases fail as defects | | | |
| Engineer scan, production build | `playwright test --config playwright.config.ts --project=desktop canary-scan` | 12 | 12 | 0 | 0 | 2.0 min |
| Masters screens regression, browser | `playwright test --config playwright.local.config.ts <materials, process-master, aqp-122-qa, aqp-234-qa, users, exchange-rates specs>` | see the paragraph below | | | | |

Notes. The 7 Vitest failures in the full run were: `e2e-shards.test.ts` (it counts every spec under `tests/e2e`, and my two uncommitted probe specs were in the folder when it ran; with the probes removed it passes, together with `one-width-tag` and the QA file: 76 of 76), and `aqp-122-materials-rules` (4), `aqp-38-sign-in` (2) and `playwright-system-deps` (the hook), which time out under full-suite load on this Windows machine and pass alone (the DEF-018 class, as in the AQP-122 and AQP-243 reports; CI runs them green on Linux). Nothing was retried, no limit was raised and no test was weakened.

**Browser regression on this PC (development server, retries off, 2 workers).** (1) The `exchange-rates.spec.ts` baseline of the developer: 50 of 50 (16 tests x 3 widths and the 2 set-up tests). (2) A filter that matched the path of the user folder ("Users") started the whole suite (837 tests) once; I stopped it after the mobile project finished: 197 passed and 8 failed, of which 6 are my condition-F probe cases (they fail while DEF-024 to DEF-026 exist) and 2 were 30 s timeouts of `navigation.spec` AC-8 and `users.spec` reset-password, which pass rerun alone (`mobile-failures-rerun-output.txt`). (3) The six masters spec files at tablet: 67 passed, 3 failed (`users.spec`, 30 s timeouts); at desktop: 105 passed, 7 failed (`aqp-234-qa` x 3, `materials.spec` x 1, `users.spec` x 3, the same timeouts). By then my throwaway database held 90 users, 125 materials and 89 process rates from the runs, and the lists are not paged (AQP-122 OBS-5, DEF-019). I emptied the materials and the disposable users and reran `materials`, `aqp-234-qa` and `users`: tablet 22 passed, 0 failed (32 skipped by their own width tags); desktop 60 passed, 1 failed: `aqp-234-qa` "G7-3 QLT-06 SCR-11: pixels at each row boundary" (the row line at y=3769 of a 1024 px page that the 89 process rates made 3,800 px tall). It passes on the fresh database of CI, and the PR changes no file of the Process screen (`git diff 023e17d e72e8f2 -- src` touches only the Materials page, `masters-screen.tsx` and `material-texts.ts` among the masters files, and the materials page words); I record it as the data-volume sensitivity of the AQP-234 pixel test, not as a defect of this story, and not as a new defect, because it does not fail on an empty database.

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Cost confidentiality | NFR-002, BR-003, BR-004 | Canary pair in the database; the Engineer scan on a production build; Lead, Engineer and signed-out callers on both methods; strict answer; refusals read for echoed numbers | ✅ No rate reaches anyone but the Admin; 12 of 12 scan tests; the post-scan check is shown to fail |
| Role, session, CSRF | NFR-001, NFR-003 | Role first, deactivation and session version at the next request, foreign and missing Origin | ✅ |
| Input validation and error leakage | NFR-003 | 28 bad forms, JSON types, extra keys, `__proto__`, 1 MB value, bad JSON; generic 500 for a late failure and a damaged registry | ✅ no value echoed, no internal word in a body |
| Data integrity | NFR-006, NFR-007 | Fixed `object_id`, one entry per change in the change's transaction, chain of before / after, six saves at once, the runtime role cannot delete | ✅ |
| Accessibility | NFR-018 | axe (wcag2a to wcag22aa) on default, refused, nothing-to-save and 300-digit states at three widths; keyboard-only run; focus after each notice | ✅ 0 violations; 44 px |
| Responsive | NFR-016, NFR-017 | 360, 768, 1366 px, no sideways page scroll in four states | ✅ |
| First-load JavaScript | NFR-009 | CI stage 11b (not measured locally, as at AQP-122) | ✅ per CI: `/masters/materials` 187,115 B, +384 B against base, under the +1,500 B tripwire (DL-131) |

## Exploratory Session

Charter: *Explore the Exchange rates tab and its route as the Admin who keeps two rates, looking for lost input, a rate in the wrong field, a stamp that lies, and anything that lets a second save, a stale tab or an odd value leave the pair or the log in a state nobody asked for.* About 40 minutes.

| Area | What I tried | Finding |
|------|--------------|---------|
| Stale second tab | Tab A saves another pair; tab B (still showing the old pair) types the pair A saved and saves | 200, "Exchange rates saved." (true), no second audit entry: as UX v0.21 QLT-06 a says. Last write wins when B types a different pair; there is one Admin, so this is by design (OBS-3) |
| Double click on Save | `dblclick` | One PUT, 200, one entry |
| Odd values | Leading zeros, padded spaces, `-0`, 12 and 13 digits, other-script digits, markup, SQL text, 1 MB | See AC-2 and AC-3. `-0` is refused; `0000.5` is accepted as 0.50; the padded value is trimmed (OBS-4) |
| Failure paths | `PUT` 503; `GET` 503 first and after a save; a held read for Loading | The five sentences hold in each; focus on the error title and it stays |
| Roles | Lead, Engineer, anonymous, deactivated Admin, raised session version | As AC-6 |
| Dialogs of other masters | Condition F | Three defects above |
| Not done | A real phone, a screen reader, Windows high contrast (test plan section 12) | Not part of this story's G7; planned for G8 |

## Defects

| ID | Jira / GitHub | Sev | Type | Title | Status |
|----|---------------|-----|------|-------|--------|
| DEF-024 | [AQP-269](https://sankumar76.atlassian.net/browse/AQP-269) / [#161](https://github.com/sankumar76/Accucut-Quotation/issues/161) | Sev-2 Major | Product | Add material dialog: after a refusal of several fields, each key typed moves focus to the next refused field | New (bound to AQP-122, not to this PR) |
| DEF-025 | [AQP-270](https://sankumar76.atlassian.net/browse/AQP-270) / [#162](https://github.com/sankumar76/Accucut-Quotation/issues/162) | Sev-2 Major | Product | Add rate dialog: the same, and the third refused field is a list that takes no letters | New (bound to AQP-113, not to this PR) |
| DEF-026 | [AQP-271](https://sankumar76.atlassian.net/browse/AQP-271) / [#163](https://github.com/sankumar76/Accucut-Quotation/issues/163) | Sev-3 Moderate | Product | Add user dialog: the same, ending in the masked password field | New (bound to AQP-65, not to this PR) |

Records: `docs/07-qa/defects/DEF-024-material-dialog-focus-jumps-while-typing.md`, `DEF-025-process-dialog-focus-jumps-while-typing.md`, `DEF-026-users-dialog-focus-jumps-while-typing.md`. No defect was raised against AQP-123.

**Test defects (mine, fixed, none in the product):** a Playwright `browser.newContext()` inherits the project's saved Admin state, so my first "signed-out" and "Engineer" contexts were the Admin (an anonymous `GET` answered 200, and a sign-in page opened on an Admin session never showed its form and timed out); the contexts now pass an empty state. The "Saved notice, then the read fails" probe let the development server's double read hit the planned 503; it now fails the reads only after the `PUT`. The AC-6 probe needed a longer timeout for two password hashes.

## Observations for master to route

- **OBS-1 (Why the browser probes are not in CI).** The probes really save rows. A CI test that saves another pair would race the never-quarantined Engineer scan, which is the race QLT-02 closed (DL-131 (2)). They are run locally with `playwright.local.config.ts`, one width at a time; their source is `docs/07-qa/AQP-123-evidence/*.spec.ts.txt`. The committed QA file is Vitest only.
- **OBS-2 (CI time).** The QA commit adds 60 Vitest tests (about 21 s on this PC: one throwaway database for the file). They run in Stage 11 of the `verify` job, which is not the longest job (4:20 against the slowest shard 6:04 in the reference run), so the path is not expected to move; the run on the QA commit is recorded above. No Playwright test is added.
- **OBS-3 (two tabs, last write wins).** No version or conflict check on `PUT`. With one active Admin the exposure is one person with two tabs. Stated, not a defect.
- **OBS-4 (accepted forms).** Leading zeros ("0000.5") and surrounding spaces are accepted and stored normalised. The AC says "numbers of 0 or more with up to 2 decimals"; the code comment says the same. No change asked.
- **OBS-5 (K, the follow-up of ux-spec v0.21 section 6.0).** The failed-write rule applies to SCR-11, the Materials tab and SCR-14 and may share the fix of DEF-024 to DEF-026.
- **OBS-6 (DEF-023).** `aqp-234-qa.spec.ts` "G7-7 SCR-13 at 768 px: keyboard" is known to fail its first attempt in shard 3 and pass on retry (AQP-268). A "flaky" line in the CI log for it is that known defect.

## Residual risks

- G7 evidence was gathered on a Windows machine with Node 24 and the development server; CI is Linux with Node 22 on a production build. The Engineer scan was also run here on a production build (desktop only) and is run by CI at three widths.
- No real phone, tablet or screen reader was used; focus and labels were judged with Playwright and axe.
- The path margin: the reference path is 6:10; RISK-023's line is 5:30 (reported, not held, DL-131 (4e)).

## Artefacts

- `docs/07-qa/AQP-123-test-report.md` (this file); `docs/07-qa/defects/DEF-024-*.md`, `DEF-025-*.md`, `DEF-026-*.md`; `docs/07-qa/test-plan.md` (change log 0.2.3).
- `tests/acceptance/aqp-123-exchange-rates.test.ts` (60 tests, committed).
- `docs/07-qa/AQP-123-evidence/`: plant diffs and outputs, probe sources (`aqp-123-qa.spec.ts.txt`, `aqp-123-focus-jump.spec.ts.txt`), probe and regression outputs, `focus-jump-results.txt`.
- Not committed: the plant script and scratch scripts of the session.
