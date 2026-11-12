# Test Report — AQP-130 (STORY-02.05): Treatment / Color list

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | Story code `6dd89b7577312f5b26fcea0036a47b95f44776c2` on `feat/AQP-130-treatment-color-list` (PR #195, `sankumar76/Accucut-Quotation`). The head did not change during the run. QA commit `195eecf` adds one acceptance test file and text evidence under `docs/07-qa/` and nothing under `src/`; the report commit that follows adds only `docs/07-qa/**`. PR #195 is BEHIND `master` (`225a1c9`); QA did not update it (the orchestrator does, by merge commit, after G7 GO) |
| CI | Reference run **42976748978** on `6dd89b7` (event `pull_request`, attempt 1): 5 of 5 green, path **4:46**, no `flaky` and no `failed` line. QA's own runs are listed under "CI runs". The run on the final report head is posted on PR #195 and in the Jira hand-off |
| Environment | Windows 11; Node v24.19.0 (CI uses Node 22); Docker; PostgreSQL 17 as a throwaway container `qa130-db` on 127.0.0.1:55530 (invented passwords), all 9 migrations applied by the test harness to a scratch database per file, including `20261110120000_treatments`. **Browsers do not run on this machine, so every browser result below is from CI**: the development server and the production build on `ubuntu-latest`, Chromium by Playwright 1.64.1 at 360x800, 768x1024 and 1366x768. No shared or production environment was used. `.env*` and `AMADA-20261006.xlsx` were not opened. The container was removed at the end |
| Date | 2026-11-11 |
| **Recommendation** | **ACCEPT.** AC-1 to AC-8 all pass with evidence (AC-6 on the amended text). Every DL-144 (5) item is done: the AC-6 audit rules, the five AC-2 spellings and the near-duplicate, the AC-3 refusal order, the same 403 for a real and an invented ID, AC-8 at three widths with axe 0, 44 px, keyboard and the ux-spec v0.22 words. QA's four controls from the final code each fail exactly their own tests. The counts of the commits after G6 are unchanged. **No defect was raised against AQP-130** (open: Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0 for this story). Two QA test defects of my own were found and fixed during the run (below). The one thing the merge route must change: QA's acceptance file adds 106 Vitest tests to the integration run (see "Counts and the merge invariant") |

## Summary

The Treatment / Color tab of SCR-13 and the routes `GET` / `POST /api/v1/treatments`, `PATCH` / `DELETE /api/v1/treatments/{id}` and `GET /api/v1/options/treatments` do what the eight ACs say. I tested through the real route handlers, the real service and the real audit service over PostgreSQL (106 new tests), and in a real browser at three widths through a throwaway QA probe pull request (11 tests per width). A name is stored in one form (inner white space folded to one space, full-width letters folded, surrounding spaces off); the duplicate rule and the reserved-name rule both read that form, so the five spellings of "Other" and "Not applicable" and the near-duplicates are all refused (422 `NAME_RESERVED` with "That name cannot be used.", which names neither entry, and 422 `NAME_TAKEN`). "Other" cannot be renamed or deleted: 409 `TREATMENT_LOCKED`, in the architecture v0.35 order (shape 422, then 404, then 409, then the name 422), with nothing changed and no audit entry. A Lead, an Engineer and a signed-out caller get the same 403 / 403 / 401 for a real and an invented ID, byte for byte apart from the request ID. Each successful add, rename and delete writes exactly one entry in the change's own transaction; a refusal, a read, a refused caller, a rename to the same canonical name and a late failure write none.

## AC Verification Matrix

Test IDs. `[AQP-130 AC-n]` is the title prefix of the 106 tests in `tests/acceptance/aqp-130-treatments.test.ts` (committed, CI). `Q-n` are the 11 browser tests of the QA probe `aqp-130-qa.spec.ts` (source `docs/07-qa/AQP-130-evidence/aqp-130-qa.spec.ts.txt`; run in throwaway PR #232, not added to the suite). Developer files are named where used. Techniques: EP equivalence partitioning, BVA boundary values, DT decision table, ST state analysis, EG error guessing.

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 list: "Other" first, locked, visible reason, no control on it; no hidden entry | QA `AC-1` (3 tests); probe Q1 (tab), Q9 (long name); developer `treatments.spec.ts` AC-1 x 3 widths | EP, ST | ✅ Pass | New database lists exactly `{id 00000000-0000-4000-8000-000700000001, name "Other", locked true}`, `no-store`. After three adds: "Other", then the three in the order added; a row holds `id`, `locked`, `name` and nothing else. A hidden row written by the owner (`Not applicable`, `is_system`, `is_hidden`) is on neither the Admin's list nor the options list, and the word "applicable" is in neither body. In the browser at 360, 768 and 1366 px: the row holds "Other" then "Always offered; the Engineer types the text" in reading order, has no button, no `disabled`, no `aria-disabled`, and its lock icon is `aria-hidden`; tab `Treatment / Color` in the tablist `Lists`; column `Name` from 768 px, the list `Treatment / Color` on a phone |
| AC-2 name required, unique ignoring case, reserved names refused | QA `AC-2` (64 tests: 7 bad bodies, the message, boundaries, canonical form, 8 spellings x add and rename, 16 reserved spellings x add and rename, the whole-name rule, rename, case change, race, strict keys, 1 MB and `__proto__`); probe Q5 (the four messages); developer integration "AC-2" | EP, BVA, DT, EG | ✅ Pass | See the AC-2 table below |
| AC-3 (negative) "Other" refused by service and API; nothing changes | QA `AC-3` (14 tests); developer integration "AC-3", `treatments.spec.ts` AC-3 | DT, EG | ✅ Pass | See the AC-3 table below |
| AC-4 any Admin deletes an unused treatment | QA `AC-4` (2 tests); probe Q4 (sentences), Q6 (keyboard) | ST | ✅ Pass | `DELETE` is 204 with an empty body; the row is gone from the table, the list and the options; a second `DELETE` is 404; the name can be added again and is a new treatment with a new ID (ux-spec v0.22: "To bring it back, add it again."). In the browser the status reads exactly "`<name>` was deleted. The change is in the audit log." and focus goes to the page heading |
| AC-5 options list: IDs and names, "Other" included, no rate; open to Admin, Lead, Engineer | QA `AC-5` (4 tests); probe Q11; developer `canary-scan.spec.ts` x 3 widths, `treatments.spec.ts` AC-5 | DT | ✅ Pass | Admin, Lead and Engineer each get 200 with `{ options: [...] }`, "Other" first with the fixed ID, every row exactly `id` and `name`; the text holds none of rate, price, cost, usd, eur, inr, currency, locked, isSystem, isHidden. Signed out is 401. The route module exports `GET` and no other method. In CI the Engineer scan (9 tests at each width, 27 of 27, never quarantined) names `/api/v1/options/treatments` in its signed-in route list and passed; the probe's Engineer got 200 with IDs and names only and no number-like word |
| AC-6 (amended) one entry per add, rename, delete; none for a refusal or an unchanged rename | QA `AC-6` (12 tests); developer integration "AC-6 (DEF-017)", `treatments-serialisation.test.ts` | ST, DT, EG | ✅ Pass | See the AC-6 table below. Plants: 3 events x own tests, below |
| AC-7 role check first: 403 / 403 / 401; SCR-26 on the page; options open | QA `AC-7` (7 tests); probe Q10 (Lead), Q11 (Engineer, signed out); developer `role-matrix`, `engineer-refused-before-lookup`, `canary-scan.spec.ts` | DT, EG | ✅ Pass | See the AC-7 table below |
| AC-8 360 / 768 / 1366, no sideways scroll, 44 px, axe 0, keyboard add / rename / delete (alertdialog) | Probe Q1 to Q9 x 3 widths = 27 of 27 (run 42982426395); developer `treatments.spec.ts` and `treatments-focus.spec.ts` x 3 widths | EP, EG | ✅ Pass | See the AC-8 table below |

### AC-2: spellings and refusals (QA tests, API)

Existing treatment `Qa130 powder coat`; each row below was tried as an **add** and as a **rename of another treatment**.

| Typed | Result |
|-------|--------|
| `QA130 POWDER COAT`, `qa130 powder coat`, `  Qa130 powder coat  ` | 422 `NAME_TAKEN`, field `name`, "A treatment with this name already exists."; nothing added or renamed; no entry |
| `Qa130 powder  coat` (two inner spaces: the near-duplicate), `Qa130 powder<TAB>coat`, `Qa130 powder<NBSP>coat` | the same 422 `NAME_TAKEN` |
| full-width `Ｑａ１３０ ｐｏｗｄｅｒ ｃｏａｔ`, and with full-width spaces | the same 422 `NAME_TAKEN` |
| `Other`, `OTHER`, `other`, ` other `, `oTHER`, `Not applicable`, `NOT APPLICABLE`, `not applicable`, `Not  applicable`, ` Not   Applicable `, `Not<TAB>applicable`, `Not<NBSP>applicable`, `Ｏｔｈｅｒ`, `ＯＴＨＥＲ`, full-width `Ｎｏｔ　ａｐｐｌｉｃａｂｌｅ` (16 spellings) | 422 `NAME_RESERVED`, field `name`, exactly "That name cannot be used."; the errors hold neither "other" nor "applicable" and the body never contains "applicable"; stored rows and audit log unchanged |
| `Other finish`, `Not applicable paint` | accepted: the rule is on the whole name |
| empty object, `""`, spaces, tab and new line, `null`, number 5, an array | 422 on field `name` (blank: "Enter a name.") |
| 1 character, 100 characters (also with spaces around), 101 characters | first two accepted; 101 is 422 "Use 100 characters or fewer." |
| `  Qa130   brushed <TAB> finish  ` and `Ｑａ１３０ matt black` | 201, stored as `Qa130 brushed finish` and `Qa130 matt black` |
| two requests at once for `Qa130 race name` and `QA130  RACE NAME` | one 201, one 422; one row; one `master.created` entry |
| extra key `isSystem` / `locked`, bad JSON, a 1 MB name, a `__proto__` key | 422 / 422 / 400 / 422 (not 500); the 1 MB name is not echoed (answer under 2,000 characters); nothing stored |
| a change of letter case on its own (`QA130 POWDER COAT` for its own `Qa130 powder coat`) | 200: it is a rename and not a duplicate of itself |

In the browser (Q5, 3 widths): "Enter a name." (focus in the field, `aria-invalid`, then `xyz` typed lands entirely in the field and focus stays), "Use 100 characters or fewer.", "A treatment with this name already exists." (typed text and focus stay), and "That name cannot be used." for `Other`, ` oTHER `, `Not applicable`, `NOT  APPLICABLE` and full-width `Ｏｔｈｅｒ`; each message clears when the field is edited; the dialog text never contains "applicable".

### AC-3: refusal order (architecture v0.35 section 6) and "nothing changes"

| Call | Expected | Result |
|------|----------|--------|
| `PATCH` "Other" with a new name / `Other` / `OTHER` / `Not applicable` / another treatment's name | 409 `TREATMENT_LOCKED`, "This entry is always offered and cannot be renamed or deleted." (not a 422 about the name) | ✅ 5 of 5; table and audit log byte-identical before and after |
| `DELETE` "Other" (also the ID in capitals) | 409 `TREATMENT_LOCKED`; still listed, locked | ✅ |
| `PATCH` "Other" with a blank or a 101-character name | 422 (shape first) | ✅ |
| `PATCH` an **unknown** ID with the name `Other` | 404, not 422 and not 409 | ✅ 404 `NOT_FOUND`; the body is identical (minus request ID) to an unknown ID with an ordinary name and to `DELETE` of an unknown ID |
| `PATCH` and `DELETE` a hidden row's ID | 404, the same words as an unknown ID | ✅ identical bodies; the hidden row untouched |
| ID not a UUID (`invented-id`, `123`, `1; DROP TABLE treatments`, a UUID with a `g`) | refused as invalid before any lookup, never 500 | ✅ 4xx, nothing changes |
| Developer's server-side checks | | ✅ `treatments.spec.ts` AC-3: the real server answers 409 `TREATMENT_LOCKED` to rename and delete and the list is unchanged, x 3 widths |

### AC-6: the audit entry (amended text)

Read with plain SQL from `audit_log` (`object_type = 'treatment'`), entries written after each test's own start.

| Event | Rule | Result |
|-------|------|--------|
| Add | one `master.created`; `object_type` `treatment`; `object_id` the new ID; `object_label` the stored name; `actor_id` the Admin; `actor_label` "Invented Admin"; `request_id` equal to the answer's `X-Request-Id`; `created_at` within a minute; `before` **null**; `after` `{ name }` | ✅ |
| Rename | one `master.edited`; `before` `{ name: old }`, `after` `{ name: new }` | ✅ |
| Delete | one `master.deleted`; `before` `{ name }`, `after` **null**; the entry stays after the row is gone | ✅ |
| Sequence | add, rename, rename, delete = exactly four entries in order, each rename's `before` the previous `after`, one object ID | ✅ |
| Rename to the **same canonical name** (exact repeat, `Qa130 powder  coat`, `  Qa130   powder coat `, full-width `Ｑａ１３０ ｐｏｗｄｅｒ ｃｏａｔ`, tab and no-break space) | 200 with the treatment as it is, no change, **no entry** | ✅ 5 of 5 forms |
| Refused change: blank, 101 chars, taken, reserved (4 spellings), locked, unknown ID, bad ID, foreign Origin, missing Origin, bad JSON, extra key, empty body | status 4xx (never 5xx), table unchanged, **no entry of any kind** | ✅ 20 calls |
| A read (list, options as Admin, Lead, Engineer); a refused caller (Lead, Engineer, signed out; five calls each) | no entry; table unchanged | ✅ |
| Atomic (DEF-017): the unit of work fails after the entry was written, for an add, a rename and a delete | 500 with the generic words, no internal word in the body, **neither the change nor the entry** | ✅ 3 of 3 |
| Six renames of one treatment at once | six entries forming one chain (each `before` the previous `after`, walked from the start name through all six targets); one name left | ✅ |

### AC-7: who may call

| Caller | Routes tried | Result |
|--------|--------------|--------|
| Lead | `GET` list, `POST`, `PATCH` real ID, `PATCH` invented ID, `DELETE` real, `DELETE` invented, `DELETE` "Other" | ✅ 403 on all 7, and no `Qa130`, `Other` or the real ID in any body |
| Engineer | the same 7 | ✅ 403 on all 7, same |
| Signed out | the same 7 | ✅ 401 on all 7 |
| Real ID versus invented ID (Lead and Engineer) | `PATCH` real vs unknown vs "Other" with the name `Other` vs `invented-id` with a blank name vs `invented-id` with bad JSON; `DELETE` real vs unknown vs "Other" vs `invented-id` | ✅ **the same 403, byte for byte apart from `requestId`**, whatever the ID or the body; keys exactly `code`, `requestId`, `status`, `title`, `type` |
| Page `/masters/materials` (holds the tab) | Lead, Engineer, signed out, Admin | ✅ forbidden screen (SCR-26) for Lead and Engineer, redirect to `/sign-in` signed out, the Admin gets the page. In the browser (Q10, Q11): status **403**, heading "You do not have access to this page", no `Treatment / Color` tab, none of the tab's words in the page; axe 0, no sideways scroll |
| Options route | Admin, Lead, Engineer 200; signed out 401 | ✅ |
| CSRF | foreign Origin and missing Origin on `POST`, `PATCH`, `DELETE` | ✅ 403, nothing changed |
| Browser (Q10) | Lead: `GET`, `POST`, `PATCH` real, `PATCH` invented, `DELETE` real, `DELETE` invented | ✅ 403 each; the five refusal bodies collapse to one text apart from the request ID |

### AC-8: measured in CI at the three widths (probe run 42982426395; developer run 42976748978)

| Check | 360 x 800 | 768 x 1024 | 1366 x 768 |
|-------|-----------|------------|------------|
| Sideways page scroll in the tab, and with each dialog open | 0 px | 0 px | 0 px |
| Sideways page scroll at 320 px (reflow) | 0 px | 0 px | 0 px |
| A 100-character name with no space, through the row, the notice, the Rename title and the Delete title | no scroll at any step | no scroll | no scroll |
| axe (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa): list, Add, Rename and Delete dialogs, the four messages, the failed-write alerts, the Lead's SCR-26 | 0 violations | 0 | 0 |
| Add button, tab, every dialog field and dialog button | 44 px | 44 px | 44 px |
| Row action buttons | 44 px (card buttons) | 36 px (icon buttons, ROW_TARGET) | 36 px |
| Each dialog inside the viewport (left and right edge) | yes | yes | yes |
| Keyboard only, add (Enter on "Add treatment", type, Enter), rename (Enter on "Rename `<name>`", Ctrl+A, type, Enter), delete (Enter on "Delete `<name>`") | pass | pass | pass |
| Delete dialog (alertdialog): first focus "Keep treatment"; Tab cycles Delete treatment, Keep treatment, Delete treatment, Keep treatment (focus stays inside); Escape closes, sends no request, and focus returns to the row's Delete; Add returns focus to "Add treatment"; Rename returns it to "Rename `<new name>`"; a confirmed delete puts focus on the page heading | pass | pass | pass |
| Requests sent by the keyboard journey | exactly `POST`, `PATCH`, then `DELETE` after the cancelled one sent nothing | same | same |

**The words (ux-spec v0.22), asserted exactly in the probe (Q4 to Q8) at the three widths:** tab `Treatment / Color`; heading `Materials and lists`; "Always offered; the Engineer types the text"; dialogs `Add treatment` / `Rename <name>` (the title keeps the old name while the field changes) / `Delete <name>?`; buttons `Cancel`, `Add treatment`, `Save`, `Keep treatment`, `Delete treatment`; notices "`<name>` was added. The change is in the audit log.", "`<old>` was renamed to `<new>`." (no "audit"), "`<name>` was deleted. The change is in the audit log."; one notice at a time; the Delete text exactly "`<name>` is removed from the Treatment / Color list. Estimates that are already calculated keep the treatment they show. To bring it back, add it again." with neither "figures" nor "undo"; failed writes (`alert`): "We could not add the treatment." / "We could not save the changes." with "Check your connection and try again. What you typed is still in the form.", and "We could not delete the treatment." with "Check your connection and try again.", the typed name kept, the Delete dialog open with both buttons enabled, and "Nothing was changed" **absent** from the page; Loading "Loading the treatments" with an `aria-busy` region; load error "We could not load the treatments" with "Check your connection and try again. Nothing was changed.", focus on the title, and `Try again` brings the list back.

## DL-144 (5) checklist

| # | Required | Result | Where |
|---|----------|--------|-------|
| 1 | All ACs AC-1 to AC-8 with evidence | ✅ | the matrix above |
| 2 | AC-6 as amended: one entry per add, rename, delete; events; `object_type`; actor, time, object; add `before` null, delete `after` null, rename `{ name }` both; refused change and same-canonical rename write none | ✅ | AC-6 table |
| 3 | AC-2: "OTHER", " other ", "Not  applicable", full-width letters, inner-space near-duplicate | ✅ | AC-2 table (all on add and rename) |
| 4 | AC-3 in the v0.35 order: "Other" changed is 409 `TREATMENT_LOCKED`; an unknown ID with the name "Other" is 404; nothing changes | ✅ | AC-3 table |
| 5 | AC-7: a real and an invented ID get the same 403 | ✅ | AC-7 table |
| 6 | AC-8: 3 widths, axe 0, 44 px, keyboard, ux-spec v0.22 words | ✅ | AC-8 table |
| 7 | QA control: latest-read guard removed (reproduces #211), fails at 3 widths | ✅ | PR #228, run 42981020973: one test fails at mobile, tablet and desktop (see "Controls") |
| 8 | QA control: audit write removed for each of the three events, each fails its own test | ✅ | PRs #229, #230, #231 (see "Controls") |
| 9 | Commit A's counts unchanged | ✅ | "Counts and the merge invariant" |
| 10 | `/masters/materials` first-load JS against 200 KB | ✅ | **187,566 B gzip** of the 200,000 B limit, headroom 12,434 B (run 42976748978, stage 11b) |
| 11 | DEF-028 | not applicable to this head: its merge ref carries #216 (Vitest 2,908 and 5,125), and no DEF-028 failure occurred in the 7 CI runs read for this report | CI runs below |

## Controls: QA's own plants (throwaway PRs, each plant's diff printed in the PR body, all closed unmerged)

Each branch is QA commit `195eecf` (the final story code plus QA's acceptance file and evidence; the report commit adds only documents) plus **one** plant commit. The controls hold the 105-test version of QA's file; the 106th test (a 1 MB name and a `__proto__` key) was added afterwards, changes nothing under `src/`, and the report head carries all 106. Each plant passes lint and type-check, so tests and not stage 4 or 5 must catch it (the audit plants use `if (Date.now() < 0) await audit.record(...)`, because deleting the call would leave an unused variable).

| Plant | PR / run | Result |
|-------|----------|--------|
| P1: `if (mine !== newest.current) return;` removed from `use-treatments.ts` (the latest-read guard; the same diff as developer control #211) | #228 / 42981020973 | ✅ red as expected: `treatments-focus.spec.ts:213 "the latest read wins (AC-1, AC-8) > a first read that answers after the list was read again does not bring the older list back"` fails at **mobile, tablet and desktop** (each also fails its retry); shards 264 / 262 / 249 passed with 1 failed each (775 + 3 = 778); `Stages 1 to 11b` green |
| P2: the `master.created` write skipped (`add`) | #229 / 42981131907 | ✅ red: exactly 2 unit tests, both about the add (`masters-service-treatments` "createTreatment ... exactly one master.created entry" and `treatments-routes` "POST ... exactly one master.created entry"); 2 failed, 2,906 passed of 2,908; E2E green |
| P3: the `master.edited` write skipped (`change`) | #230 / 42981145319 | ✅ red: exactly 3 unit tests, all about the rename; 3 failed, 2,905 passed |
| P4: the `master.deleted` write skipped (`remove`) | #231 / 42981162381 | ✅ red: exactly 3 unit tests, all about the delete; 3 failed, 2,905 passed |

The three audit plants stop at Stage 6 (unit tests) in CI, before Stage 11, so QA's acceptance file did not run there. I ran the same three plants locally against the real database with the developer's integration and unit files and QA's file together (173 tests; control without a plant 173 of 173): P2 fails 9 (3 QA tests: the add entry, the four-entry sequence, the race; 6 developer), P3 fails 8 (3 QA: the rename entry, the sequence, the six-renames chain; 5 developer), P4 fails 7 (2 QA: the delete entry, the sequence; 5 developer). A plant in one event does not fail the other events' own tests (QA's rename and delete tests make their row as the database owner, not through the route that is planted). Diffs and outputs: `docs/07-qa/AQP-130-evidence/plant-audit-{created,edited,deleted}.diff` and `-output.txt`, `control-no-plant-output.txt`, `control-ci-output.txt`.

## Counts and the merge invariant

| Item | At commit A (`6dd89b7`, run 42976748978) | Master's number | |
|------|------------------------------------------|-----------------|--|
| E2E passed, shards 1 / 2 / 3 | 265 / 263 / 250 = **778** | 778 (DL-144 (2) and DL-145 (4)) | ✅ unchanged |
| E2E skipped | 3 / 4 / 17 = 24 | 3 / 4 / 17 | ✅ |
| Vitest, stage 6 (unit) | **2,908** passed, 150 files | 2,908 (DL-145 (4)) | ✅ |
| Vitest, stage 11 (unit + integration + security + acceptance) | **5,125** passed, 208 files | 5,125 | ✅ |
| `flaky` / `failed` lines | none | none | ✅ |

The two commits after G6 changed no count: `eb61fa0` (STD-15 titles, STD-16) and `6dd89b7` (the `(e)` sticky-column test moved unchanged into `masters-table-actions.spec.ts`, 34 passing there at desktop). The shard split moved (243 / 241 / 294 became 265 / 263 / 250) and the total did not.

**QA's commit changes the stage-11 count and nothing else:** `tests/acceptance/aqp-130-treatments.test.ts` adds **106** Vitest tests (the probe run, with the first 105, read 5,230 passed in 209 files; the final file reads 5,231 expected). So the DL-144 (6)(e) and DL-145 (4) invariant for the update of PR #195 is, for the stage-11 Vitest run, **5,125 + 106 = 5,231 on the report head**, plus whatever `master` has added since `225a1c9`; the stage-6 count (2,908) and the E2E count (778) do not change. The 106 tests run in about 4 s in CI (`aqp-130-treatments.test.ts (105 tests) 3837ms` in the probe run), so the path is not expected to move.

## CI runs (read by QA)

| Run | Head | What | Result |
|-----|------|------|--------|
| 42976748978 | `6dd89b7` (PR #195) | reference run of commit A | 5 of 5, path 4:46 (07:03:48 to 07:08:34 UTC); `Stages 1 to 11b` 2:35, shards 3:55, 4:09, 4:35 |
| 42981020973 | `143538c` (#228) | plant P1 | E2E red as planned (above) |
| 42981131907 / 42981145319 / 42981162381 | `d3a4557` / `9fc8c85` / `951e3aa` (#229, #230, #231) | plants P2 to P4 | unit red as planned (above) |
| 42981182824 | `43dc48b` (#232) | probe, first run | red: 10 probe tests at mobile and the 320 px test at tablet and desktop failed, **a defect of my probe** (TD-1); `Stages 1 to 11b` green with 5,230 Vitest tests, which shows QA's acceptance file passes in CI |
| 42982426395 | `3939829` (#232) | probe, fixed | 5 of 5 green, no flaky or failed line; probe 33 of 33; E2E 261 / 274 / 276 passed = 811 = 778 + 33 |
| (report head) | posted on PR #195 | QA commit with the report | see the PR comment and the Jira hand-off |

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| QA acceptance (API, new) | `npx vitest run tests/acceptance/aqp-130-treatments.test.ts` (local) | 106 | 106 | 0 | 0 | about 22 s |
| Story files with QA's file (control for the plants) | `npx vitest run` on QA's file, `integration/masters/treatments.test.ts`, `unit/masters-service-treatments.test.ts` (local) | 173 | 173 | 0 | 0 | about 35 s |
| Lint, type-check | `npx eslint` on QA's file and on the probe copy; `npx tsc --noEmit` | | clean, exit 0 | | | |
| Full regression | CI run 42976748978 (the reference, as DL-142 (5)); stage 6 and stage 11 as above; E2E 778 | 2,908 + 5,125 Vitest, 778 E2E | all | 0 | 24 E2E (by their own width tags) | path 4:46 |
| QA browser probe | throwaway PR #232, run 42982426395 | 33 (11 x 3 widths) | 33 | 0 | 0 | 2.9 to 4.9 min per shard |
| Engineer scan, production build | in the shards (`canary-scan.spec.ts`) | 27 (9 x 3) | 27 | 0 | 0 | part of the shards |
| Secret scan | Gitleaks 8.30.1 (Docker) on `docs/07-qa/` and `tests/acceptance/aqp-130-treatments.test.ts` | | no leaks found | | | |

No full local Vitest or browser suite was run: the machine cannot run the browser suites, and CI is the reference (DL-057, DL-142 (5)).

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| Cost confidentiality | NFR-002, BR-003, BR-004 | The options route as Admin, Lead, Engineer; refusals read for names and numbers; the CI Engineer scan (27 of 27, it lists `/api/v1/options/treatments` and every admin route for a real and an invented ID) | ✅ no rate anywhere (the table has none); no other row's name in a refusal |
| Role, session, CSRF | NFR-001, NFR-003 | Role check before the ID and the body; foreign and missing Origin | ✅ |
| Input validation, error leakage | NFR-003 | 7 bad bodies, 16 reserved and 8 duplicate spellings, bad IDs, extra keys, `__proto__`, 1 MB, bad JSON; generic 500 on a late failure | ✅ no value echoed, no internal word in a body |
| Data integrity | NFR-007 | One entry per change in the change's transaction; late failure; six renames at once; two adds of one name at once | ✅ |
| Accessibility | NFR-018 | axe wcag2a to wcag22aa in every state, three widths; keyboard-only journey; focus after each dialog and notice | ✅ 0 violations |
| Responsive | NFR-016, NFR-017 | 360, 768, 1366 and 320 px; a 100-character name through every step | ✅ 0 px sideways scroll |
| First-load JavaScript | NFR-009 | CI stage 11b | ✅ `/masters/materials` **187,566 B** gzip, limit 200,000 B, headroom **12,434 B** (AQP-123: 187,115 B; the tab adds 451 B). The page still has the +1,500 B tripwire of DL-131 |
| CI time | RISK-023 | Path of the reference run | 4:46, under the 5:30 line; QA's file adds about 4 s of Vitest |

## Exploratory Testing

Charter: *Explore the Treatment / Color list as the Admin who keeps it, and as the three callers who must not, looking for a name that gets past the duplicate or reserved rule, a change that leaves no entry or two, a refusal that tells too much, a lost keystroke, and a screen that scrolls sideways or hides a control.* About 90 minutes, API first, then the probe in CI.

| Area | What I tried | Finding |
|------|--------------|---------|
| Odd spellings | no-break space, tab, full-width letters and spaces, mixed case, 101 characters, 1 MB, `__proto__`, markup-free invented names | all handled by one stored form; NBSP is trimmed like a space. `Other finish` and `Not applicable paint` are valid names |
| Order of refusals | blank name on "Other"; "Other" renamed to "Other", "OTHER", "Not applicable"; unknown ID with "Other"; hidden ID | exactly the v0.35 order (OBS-1) |
| IDs | upper-case UUID of "Other"; non-UUIDs; SQL text | upper case is the same ID (409); the rest are refused before any lookup |
| Races | two adds of one name in two cases; six renames of one row | one winner; one entry each; one chain |
| Failures | late failure after the entry; 503 on `POST`, `PATCH`, `DELETE` and `GET` in the browser | atomic; the words and focus as ux-spec v0.22 |
| Roles | Lead, Engineer, signed out, foreign Origin | as AC-7 |
| Small screens | 320 px; a 100-character name in the notice and in both dialog titles | no scroll, no clipped control |
| Not done | A real phone, a screen reader, Windows high contrast, browser zoom (test plan section 12); a direct SQL attempt by the runtime role against "Other" | planned for G8; see OBS-2 |

## Defects

**None against AQP-130.** No Jira Bug or GitHub issue was raised for this story.

Test defects of mine, found and fixed during the run (not product defects):

- **TD-1.** The probe looked for the "Other" reason with a text locator and `.first()`. The text is in the table and in the card layout and one of the two is hidden, so on the phone layout (and at 320 px) it found the hidden copy and timed out: 10 probe tests at mobile and the 320 px test at the other two widths failed on run 42981182824. The developer's support file already warns about this. Fixed with a locator on `[data-item-id]:visible` (commit `3939829`); the rerun is 33 of 33.
- **TD-2.** My first plant (a skipped `master.created` write) also failed my rename and delete tests, because they made their row through the route being planted. They now make it as the database owner, so each plant fails only its own event's tests (control 173 of 173; plants 9, 8 and 7).

## Observations for master to route

- **OBS-1 (options route and the hidden entry).** Architecture v0.35 section 6 says `GET /options/treatments` is the only list route that returns the hidden entries, for the drop-down (A-17), but AC-1 and AC-5 of this story, the route's code comment and the story's own test say the opposite for now ("Not applicable" joins in story 02.06). The build does what this story's ACs say and the options list holds only "Other" and the Admin's treatments. Story 02.06 must change the options query, and its test must expect "Not applicable" there. For the scrum-master's Dev Context of 02.06; not a defect of AQP-130.
- **OBS-2 (database guard of "Other").** The migration `20261110120000_treatments` has no trigger (the one `trigger` in the file is a comment); architecture v0.35 gives "Other" its database guard in story 02.06 (GitHub #202). Until then only the service and the API refuse a change of "Other", which is what AC-3 asks ("the service and the API, not only the UI") and what the tests cover. I read this from the migration and did not attempt a direct SQL change as the runtime role.
- **OBS-3 (audit writer shape, QLT-11, tech-debt #218).** The audit writer does not check the shape of `before` and `after` against the entry's `object_type`; QA's tests pin the exact shapes (`{ name }`), so a drift in this story would be caught here, but the writer would not refuse it. Already routed by DL-144 (3).
- **OBS-4 (a rename that changes nothing).** A rename to the same canonical name answers 200 and writes no entry, as the ux-spec v0.22 Renamed notice assumes ("`<old>` was renamed to `<new>`." without the audit clause). A change of letter case alone is a rename and does write an entry. Both are as the code comment, the ux-spec and AC-6 say.
- **OBS-5 (merge invariant).** See "Counts and the merge invariant": QA's file adds 106 to the stage-11 Vitest count. Master or the orchestrator should use 5,231 plus `master`'s additions, not 5,125, for the update of PR #195.
- **OBS-6 (probe not in CI).** The 11 browser probe tests are not added to the suite (RISK-023; the developer's `treatments*.spec.ts` already run at three widths and the words are asserted there too). Their source is evidence.

## Residual risks

- Browser evidence is from CI on Linux with Chromium only; no real phone, tablet, screen reader or Windows high-contrast theme was used (planned for G8).
- First-load JavaScript of `/masters/materials` is 187,566 B of 200,000 B (headroom 12,434 B). Each further tab on that page spends part of it.
- RISK-023: the reference path is 4:46; DL-144 (2) expects the next E2E-adding story to start an item-9 median of five.
- QLT-09 (deleting a treatment an estimate uses) is the architect's, before story 05.06; AC-4 of this story does not depend on it.

## Artefacts

- `docs/07-qa/AQP-130-test-report.md` (this file); `docs/07-qa/test-plan.md` (change log 0.2.4, section 12 evidence path aligned).
- `tests/acceptance/aqp-130-treatments.test.ts` (106 tests, committed, run by CI stage 11).
- `docs/07-qa/AQP-130-evidence/`: `aqp-130-qa.spec.ts.txt` (the probe, as fixed in `3939829`), `plant-audit-{created,edited,deleted}.diff` and `-output.txt`, `control-no-plant-output.txt`, `acceptance-local-output.txt`, `control-ci-output.txt` (P1 to P4 from CI), `probe-ci-output.txt` (the measurements and the 33 results), `ci-6dd89b7-summary.txt` (counts, JS budget, path).
- Throwaway PRs, all closed unmerged: #228 (P1), #229 (P2), #230 (P3), #231 (P4), #232 (probe). Their branches `control/AQP-130-g7-*` remain on the remote for the orchestrator to delete after G7.
- Not committed: the log extraction scripts of the session.
