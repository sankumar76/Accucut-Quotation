# Technical Test Strategy — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.24 (section 10.6: `apt-get update --error-on=any` against an apt view holding only the Ubuntu mirror being tried, QLT-95). Earlier, 0.23 (section 10.6: the AQP-216 bounds, 90 s, 4 minutes and 8 minutes with their assumptions, and the DL-105 evidence rule; CR-49, CR-50). Earlier, 0.22 (section 10.5: the AQP-74 one-width ruling and the rule on counting `:visible` entries; section 10.6: a failed `apt-get update` skips its download, and a parser fallback, for AQP-216). Earlier, 0.21 (section 10.6: #93 and #99 as one fix, a master-side warm job on the CI runner label and a bounded download-only install with a mirror fallback). Earlier, 0.20 (section 10.5: `aqp-65-qa.spec.ts` joins the one-width allow-list for one test; the definition takes in a client rule with the same result at every width). Earlier, 0.19 (sections 10.3 and 10.5: the shard step's jobs, order, names and test split; the measure across jobs; a proposed lasting wording for the 9-minute line; what to do if the pull request misses 6:00; AQP-208, CR-44 to CR-46). Earlier, 0.18 (section 10.5: the AQP-199 result, three workers not better than four, the order DEF-015 first and then the shard step as its own story, and the one-width ruling for AQP-65's two specs). Earlier, 0.17 (section 10.6: browser system packages cached by runner image and Playwright version, a bounded download on a miss, the browser cache kept and re-keyed, stage 12a split out; DEF-015, DL-100). Earlier, 0.16 (section 10.5: stage 12 time, four CI workers and `@one-width` for tests that read no layout, AQP-199, DL-095). Earlier, 0.15 (the production check of `/design-system` moves to stage 12, `tests/e2e/production-routes.spec.ts`, and that spec is never quarantined, section 10; architecture v0.16). Earlier, 0.14 (master's rule on tests and machine load, DL-057, GitHub #24, section 10; the not-found row of the JS budget check, section 10.1; the path-limited pull-request trigger of the Lighthouse run, section 10.2, AQP-169 A-2. Earlier, 0.13: PRD NFR-009: the office Wi-Fi pass/fail profile, Slow 4G as report only, 200 KB gzip first-load JS per route, and CI feedback time, PROPOSED; AQP-1 comments 10712, 10713; GitHub #36; RISK-020; sections 2, 8 and 10. Earlier, 0.12: SPEC v1.13, D-38 to D-40: 15 seed Process Master items and the Material-Scrap-Rate name, sections 6 and 9; G6 of AQP-27, QLT-05: where the coverage gates sit, sections 10 and 11; CR-33, seed items, `clear-copies.sh`, AQP-1 comments 10546 to 10560, the quantity rule, Q-35 (b), Q-41, Q-37) |
| Owner | solution-architect |
| Status | Accepted at G3 as CONDITIONAL GO. Version 0.7 replaces the every-level rule and the parent figures on the delivery lead's answers (AQP-26 comment 10537; AQP-1 comment 10542; AQP-15 comment 10543), which changes what G3 accepted. Versions 0.8 and 0.9 add the tests for their later answers. For `master` to record and check at G4 |
| Date | 2026-11-05 |
| Inputs | SPEC v1.13 §4.1, §4.3, §14, §18 D-38 to D-40, §18.5; PRD v0.11; `architecture.md` v0.14; PRD NFR-009 (AQP-1 comments 10712, 10713; GitHub #36); gate log G6 AQP-27 attempt 1 and review 5746060549 (QLT-05); DL-012, DL-021, DL-022, DL-024; AQP-1 comment 10542; AQP-14 comment 10510; AQP-15 comments 10511, 10527, 10543; AQP-26 comments 10530 to 10537; `coding-standards.md` |
| Used by | `qa-engineer`, whose test plan builds on this; `developer` |

**Rule for all test data.** Every value here and in every fixture is invented. No cell value from the sample workbook is used, here or anywhere, and no real master data (NFR-006, ADR-014). Sample structure may be read for headers, widths and formats only.

---

## 1. Principles

1. The risks decide the depth. The three that matter most are a cost leak, a wrong price and a changed approved estimate.
2. Real PostgreSQL in integration tests. No mocked database: triggers, partial indexes, locks and JSONB are part of the design.
3. Mock only at external boundaries: SMTP (Mailpit), Microsoft's token endpoint (a local stub) and the clock (`Clock` argument).
4. Tests are deterministic. No sleeps; no network in unit tests.
5. A check that can pass for the wrong reason needs a negative control. The canary scanner must be shown to fail on a deliberate leak.

## 2. Test Levels

| Level | Purpose | Owner | Tooling | Location | Runs |
|-------|---------|-------|---------|----------|------|
| Unit | Formula engine, tree, state machine, validation, time, columns | developer | Vitest 5 | `tests/unit/` | Every PR |
| Integration | Services and routes against Postgres; migrations, triggers, grants | developer | Vitest, Postgres service | `tests/integration/` | Every PR |
| Contract | Route output schemas, strict keys | developer | zod, Vitest | `tests/integration/contract/` | Every PR |
| Security | Role matrix, canary scan, CSRF, cookies, uploads | developer, qa-engineer | Vitest, Playwright | `tests/security/` | Every PR |
| Acceptance | SPEC §14 items 1 to 14 | qa-engineer | Vitest, Playwright | `tests/acceptance/` | Every PR |
| E2E | Critical journeys at all viewports | qa-engineer | Playwright 1.64 | `tests/e2e/` | Every PR (Chromium at 3 widths, except the tests tagged `@one-width` that section 10.5 rules, which run at 1366 px only); nightly (full matrix) |
| Accessibility | WCAG 2.2 AA (PROPOSED, PRD v0.6) | qa-engineer | axe, keyboard run | `tests/e2e/a11y/` | Every PR; manual per release |
| Performance | NFR-008 to 011 | qa-engineer | Vitest timing, k6, Lighthouse CI, JS budget check | `tests/perf/`, `scripts/check-js-budget.ts` | JS budget on every pull request; timing and Lighthouse nightly; Lighthouse before a key screen's G6; load before release |
| Export | File fidelity | qa-engineer | ExcelJS read-back, Excel desktop | `tests/integration/export/` | Every PR; manual open per release |
| Operational | Install, backup, restore | qa-engineer, IT contact, the Admin for the restore | Scripts, stopwatch | Rehearsal log | Before go-live |

## 3. Risk-Based Priorities

| Area | Impact | Likelihood | Depth |
|------|--------|-----------|-------|
| Cost confidentiality (NFR-002) | Critical | Medium | Layers plus canary scan on every build |
| Quantity rule and BL (FR-029, 030) | Critical | Low | Constructed examples with their numbers, property tests, a test that holds H to BB; a parallel run against the worksheet; no pending case at G7 (section 5.6) |
| Count typed on each row (ARCH-R6) | Critical | Medium | **Cannot be tested:** a wrong count is a valid estimate. CE-2 variant C pins that the count is taken as typed. The hint on the field and H beside each row are checked in E2E |
| Quantity warning (OQ-ARCH-10, Q-41, RISK-013) | High | Medium | CE-9 at every level; no cost in the warning on any route beyond the 0 typed; a stale acknowledgement never passes (section 5.2) |
| Cleared totals (D-20) | Critical | Medium | Every read through `figure-state`; approval and export refusal; autosave does not clear |
| Row formulas (FR-024) | Critical | Low | One test per formula; end-to-end tree |
| Approved immutability (NFR-026) | High | Low | Regression test, DB refusal tests |
| Role enforcement (NFR-001) | High | Medium | Full matrix |
| Configuration edits (FR-074 to 078) | High | Medium | Property tests, SPEC §14 items 6 to 8 |
| Export fidelity (NFR-027) | High | Medium | Read-back, checklist, manual open |
| E-mail (NFR-014) | Medium | **High** until the account is known | Controlled-clock tests; a real send once OQ-ARCH-11 is answered |
| Backup (NFR-013) | High | Medium | Missed-run alert test; free-space test; restore rehearsal. **A server or disk failure cannot be tested for, as nothing survives it** |
| Responsive, accessibility | Medium | Medium | Automated at each width |

## 4. Environments and Test Data

| Environment | Database | Mail | Data |
|-------------|----------|------|------|
| Local | Docker Postgres 17 | Mailpit | Invented placeholders |
| CI | Postgres 17 service, one schema per Vitest worker | Mailpit service | Invented placeholders |
| Staging | Same Compose file | Mailpit, then a real send through the actual mailbox once OQ-ARCH-11 is answered | Invented placeholders |

**Fixtures.**

| Fixture | Contents | Used for |
|---------|----------|----------|
| `seedConfig` | SPEC §7 registry; the same module production seeds from | All |
| `placeholderMasters` | Invented rates, materials and exchange rates; each number follows the fixed pattern `n.37` | Dev, CI |
| `canaryMasters` | Every Restricted value set to a unique sentinel (section 6) | Security |
| `quantityCases` | The constructed examples (section 5) | BL |
| `hiddenEntries` | The two "Not applicable" rows from the migration, fixed IDs | Section 9, added for SPEC v1.4 |
| `acceptanceTree` | Nodes 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5 with invented inputs and hand-calculated outputs in a table reviewed before the test runs | SPEC §14.2 |
| `tree500` | Generated 500 nodes, depth up to 6 | Performance |
| `images` | PNG, JPG, GIF, WebP; 199 × 1024 and 201 × 1024 bytes; a text file renamed `.png`; a polyglot | Uploads |

Builders in `tests/support/` construct data; tests never depend on each other's rows. A test checks that every number in `placeholderMasters` matches the pattern, so a pasted real value fails (ADR-014). Parallel-run data (TR-004) stays outside the repository and its results are not committed.

---

## 5. The Quantity Rule and BL (G2 condition 5)

### 5.1 Oracle

SPEC v1.9 §7.1 H, §7.4 BL and §18.5, from the rule settled on AQP-26 (comments 10535, 10537). Expected values are worked by hand here, before any code exists, and were re-run through a throwaway script on 2026-11-02. All numbers are invented.

**The rule.** H is the count for the whole order, typed on every row. A row's cost is that count times the cost of one piece, `BB = BA x H`. **BL = `SUM(BG)` over all rows, with no multiplying down the tree.** A parent shows only its own row's figures (AQP-1 comment 10542).

**What this proves now.** The rule is the worksheet's, `SUM(BG2:BG11)` (SPEC §18.5), so a parallel run against the worksheet is a real test of BL at any quantity, which it was not under the old rule. Three cases carry the delivery lead's own numbers: the typed 2, 6, 24 (CE-1), 840 (CE-2) and 1000 (CE-12 variant D).

**What this does not prove.** A test cannot show that the count typed was the right count (ARCH-R6): 3 typed for 12 gives 660, and that is a valid estimate as far as the code can tell.

### 5.2 Constructed cases (`tests/unit/quantity/quantity-cases.ts`)

"Per-piece cost" is a row's cost before its own quantity. So stored BG = per-piece cost x H typed. Every H below is the count for the whole order. Every row's figure on screen is the figure in the file.

**CE-1: the frames example, typed 2, 6, 24 (AQP-26 comment 10537).** 2 frames, 3 pipes on each frame, 4 lids on each pipe.

| Row | H typed | Per-piece cost | BG, screen and export |
|-----|---------|----------------|-----------------------|
| Item I, frames | 2 | 0 | 0 |
| Part P, pipes | 6 | 1 | 6 |
| Sub-part S, lids | 24 | 1 | 24 |

**Expected:** BL = **30**, and the BG column adds up to it. With cost on S alone, BL = **24**.

Each wrong answer below names a specific defect, so the failure message tells the developer which.

| Wrong BL | Means |
|----------|-------|
| 300 | The withdrawn rule: typed counts multiplied down the tree again |
| 612 | A row's own H applied twice |
| 2 | H not applied at all |

**CE-2: an item with its own cost and a part below it. Their own sums (AQP-26 comment 10535).** Item 4 at 150, its part 12 at 20. Stored BG 600, 240. **BL = 840.**

| Variant | Tree | BL | Why it is here |
|---------|------|----|----------------|
| A | As above | **840** | Their number |
| B | Item 2 at 5, part 6 at 7, sub-part 24 at 11 | 10 + 42 + 264 = **316** | Three levels, each row with its own cost |
| C | As A, with 3 typed on the part | **660** | A valid estimate. It pins that the portal takes the count as typed, and that no check can catch it (ARCH-R6) |

A BL of 1560 for variant A means typed counts were multiplied down the tree.

**CE-3: two top-level items (D-12).** Item A quantity 2 and item B quantity 3, each with 0 on its row and one child typed 2 and 3, per-piece cost 1. **BL = 2 + 3 = 5.** No per-item figure exists in any response.

**CE-4: a parent's own cost counts, and it shows only its own (D-12; AQP-1 comment 10542).** Item quantity 1. Parent P quantity 1, per-piece cost 10. Child S quantity 1, per-piece cost 5. **BL = 15.** P shows 10 on screen and in the file, and S shows 5. A children-only reading gives 5. With P at quantity 2 and S still 1: BG(P) = 20, **BL = 25**: the parent's count does not reach its child. With S typed 2 as well, **BL = 30.**

**CE-5: all quantities 1.** BL equals the sum of the per-piece costs, for a random tree. This is the worksheet's result at quantity 1 (SPEC §18.5).

**CE-6: a deep chain.** Item 2, per-piece cost 0. Below it A 6, B 30, C 210, one under the other, each with per-piece cost 1. Stored BG 6, 30, 210. **BL = 246.**

**CE-7: BN (FR-025, D-12).** The CE-1 tree. Tool Cost 2 on P and 3 on S, typed entries. Total Tool Cost = **5**, with no quantity applied. **BN = 30 / 5 = 6.** With no Tool Cost, BN is `null`, shown as "—", with an empty export cell, and the total Tool Cost shows 0.

**CE-8: divide by zero (A-07).** Exchange rate USD 0: BJ is "—" on each row, BG and BL are unaffected, no error. A formula that makes a row's BG `null` gives a BL of "—", never a lower number.

**CE-9: a QTY per Assy of 0 (OQ-ARCH-10, Q-38, Q-41; "Keep warning", AQP-15 comment 10543; architecture section 4.3).** **A 0 affects only its own row, and every 0 warns,** wherever the row sits in the tree. Asserted from the first commit, never pending.

| Variant | Tree | BL | Warnings, code `QTY_ZERO` |
|---------|------|----|---------------------------|
| A | Item 2, cost 0; part H 0, cost 1; sub-part 24, cost 1 | **24**: the sub-part still counts. The withdrawn rule gave 0 | 1.1 |
| B | A plus a second part under the item: H 6, cost 1 | **30** | 1.1 |
| C | Item 2; part H 0; below it H 0; below that H 24, each cost 1 | **24** | 1.1 and 1.1.1 |
| D | Top-level item H 0, cost 3, one child H 4, cost 1 | **4**: the item's own cost goes, and the child stays | 1: a top-level item's own 0 warns |
| E | Item 2, cost 0; part H 0, cost 1, nothing below it; part H 2, cost 1 | **2** | 1.1 |
| F | Top-level item H 0, cost 5, nothing below it, a single-piece product | **0** | 1 |
| G | Item 2, cost 0; part H 0, cost 1; below it H 0, cost 1, nothing below that | **0** | 1.1 and 1.1.1 |

| Level | Assertion |
|-------|-----------|
| Unit, `SUM` through the evaluator | The BL column |
| Unit, `quantityWarnings` | The Warnings column. `0.00` is the same as 0, and 0.01 gives no warning. H is found through `systemRole: 'quantity'`, so a re-lettered H still warns. Moving a row with H = 0 leaves its warning as it was. The function takes rows and inputs only: a `@ts-expect-error` test shows a `RowOutputs` cannot be passed to it |
| Integration, no acknowledgement | `POST /calculate` as an Engineer and `POST /recalculate` as a Lead each give 409 `CALCULATE_ACK_REQUIRED`, with `inputsRevision` and one warning per row. No `calculations` row, no audit row, status and `inputs_revision` unchanged |
| Integration, acknowledged | The same request with `acknowledge.inputsRevision` succeeds. The Engineer's body is exactly `{status, message}`. The `calculations` row holds `warnings` with the code, node, Sl. No and label, and `created_by` is the person who pressed. One `calculation.warning_acknowledged` audit row, in the same transaction, naming the rows and holding no figure |
| Integration, stale | Acknowledge, but change any input first: 409 again with the new revision and the current list, and nothing written. Includes two concurrent requests, an input save and an acknowledged Calculate: the Calculate never succeeds on a list older than the save |
| Integration, nothing to warn | An `acknowledge` with no warning due is ignored: the calculation goes through with `warnings` empty and no audit row. A body that is not the stated shape, such as `{"acknowledge": true}`, is 400 |
| Integration, order | A blank input with an H of 0 gives 422 `CALCULATE_BLOCKED`, not the 409, so nobody acknowledges and is then refused |
| Integration, each press | A Lead's Recalculate of an estimate the Engineer acknowledged is asked again. The Engineer's calculation keeps the Engineer's name, and the Lead's new one has the Lead's |
| Integration, Lead data | `/costs` and `/export-summary` give the warnings, with who and when, while `current`, none while `out-of-date` or `none`. Approve succeeds at `current` with warnings on the calculation: Warn never stops approval |
| Security | Section 6, the warning path |
| E2E, 3 widths | SCR-05: the dialog says the row will cost 0. "Go back" leaves the estimate Draft and "Calculate anyway" gives Submitted with the one message. SCR-06: the same dialog, then the notice and the row mark. SCR-10: the notice. Keyboard only, and focus starts on the safe choice |

**CE-10: a fractional quantity.** Item 2 with cost 0, part 0.5 with cost 2, sub-part 1.25 with cost 4. BG 0, 1, 5. **BL = 6.**

**CE-11: changing the tree (architecture section 4.8).** From CE-1, reordering siblings leaves BL at 30. **Moving S directly under the item also leaves BL at 30**: a move no longer changes the price. It changes Sl. No in the record, so each change still clears the totals until Recalculate (A-29).

**CE-12: a childless top-level item, a single-piece product (DL-012).** Their number is 1000 for quantity 5 at 200 a piece (AQP-14 comment 10510).

| Variant | Tree | BL | Wrong: the item quantity applied to its own row a second time |
|---------|------|----|---------------------------------------------------------------|
| A | The item alone: H 3, per-piece cost 5, stored BG 15 | **15** | 45 |
| B | The same item at H 1, stored BG 5 | **5** | 5: the two agree, which is why a sample with quantity 1 on every row cannot catch this |
| C | Item X: H 2, cost 0, one child typed 2, cost 1. Item Y: as variant A | 2 + 15 = **17** | 47 |
| **D** | **Their own example:** the item alone, H 5, per-piece cost 200 | **1000** | 5000 |

Each variant also checks that BL with no parent and no child does not divide by zero or give an empty sum. Variant A's cleared state is in section 9.

### 5.3 Through the real evaluator

Each case above runs twice:
1. **Unit:** `SUM` through the evaluator, with stated BG.
2. **Integration:** a real estimate through `calculation-service` with the seed configuration. Machining Cost (AP) carries the per-piece cost, all other inputs are 0, all percent rates 0. Then AY = AP, BA = AP, BB = AP x H, BG = BB, so a per-piece cost travels through every stage, and the result is read from `calculations` and `calculation_rows`.

Also on the integration path: the export of CE-1 shows row BG of 0, 6, 24 and BL2 = 30, and the Lead's screen data shows the same three figures.

### 5.4 Holding the rule in place

| Test | Assertion |
|------|-----------|
| `quantity-in-one-formula` | In the seed configuration, H appears as an operand only in BB (SPEC §7.4), so a new use in a seed formula fails the test |
| `bl-is-sum-bg` | Seed BL is `SUM` over the field with `systemRole: 'unit-price'`, and it re-letters with it |
| `no-rolled-up-figure` | `/costs`, `/nodes/{id}/costs` and `/export-summary` strict schemas hold no sum over rows other than BL, BN and the total Tool Cost. A parent's figures equal its own row in the file (CE-4) |
| `quantity-cases-complete` | Section 5.6: every CE case has a numeric expected value, and no quantity test is skipped or pending |

Retired with the code they tested: `own-quantity-once`, `quantity-step-single-importer`, `quantity-step-unit`, `no-rollup-of-rollup`, `export-reads-outputs`, `no-recursion` and the closed-form oracle.

### 5.5 Properties

Fast generated trees, in Vitest, with no extra library needed. Compare at 2 decimals.

- BL = the sum over all rows of BG, which is the seed formula checked against a plain loop.
- Reordering siblings or moving a node to another parent leaves BL unchanged.
- Setting one row's H to 0 lowers BL by that row's own BG, and by nothing else.

The generator must make top-level items with their own cost, with no children and with children, and H of 0, above 1 and fractional.

### 5.6 No pending quantity case at G7 (G3 condition 14, DL-012)

**The rule.** The roll-up story, now the BL story, cannot pass G7 with any CE case pending. A test cannot show that a rule is right, so the delivery lead's numbers have to reach the build.

| # | Control | Owner | When | Stops it how |
|---|---------|-------|------|--------------|
| 1 | **Met.** The rule is settled with numbers: 840, 1000 and 2, 6, 24 (AQP-26 comments 10535, 10537; AQP-14 comment 10510), in SPEC v1.9. `master` records it | `master`; business-analyst | Before the story reaches Ready | The story stays out of Ready until the record and SPEC say the same |
| 2 | The story's acceptance criteria cite CE-1 at 30, CE-2 at 840, 316 and 660, CE-9 with variants A to G, and CE-12 at 15, 5, 17 and 1000 | product-owner, scrum-master | G4 | Definition of Ready check |
| 3 | The cases are written asserted from the first commit. **No `it.todo` is used** | developer | G5 | Review; control 4 |
| 4 | `quantity-cases-complete` fails if any CE case from 1 to 12 is missing or has no numeric expected value, or if a quantity test file uses `.todo`, `.skip`, `.skipIf`, `.fails` or `.only`. It covers `tests/unit/quantity/**` and the integration quantity tests | developer | Every PR, CI stage 6, which blocks merge | The build fails. Negative control (principle 5): the scanner is run on a planted string holding `it.todo` and must report it |
| 5 | The G7 report lists CE-1 to CE-12 and the properties by result. Pending, skipped or "not applicable" on any of them is an unverified AC | qa-engineer | G7 | G7 needs every AC verified, so `master` returns NO-GO |

**Where the expected values come from.** From their numbers and the rule they settle, and the developer does not choose. The history of how the rule was reached, including 660 and "Lids = 12", is on AQP-26. CE-2 variant C keeps 660 only as a mistyped count.

## 6. Cost Confidentiality (NFR-002, SPEC §14.1)

**Canary method.** `canaryMasters` gives every process rate (all 15 seed items, `Plating-rate-per-sqin` included), customer rate, material price, specific gravity, Material-Scrap-Rate (`materials.scrap_rate`, per kg) and exchange rate a unique invented value with a rare digit pattern. The test calculates and approves an estimate, so every Restricted output exists in the database with a known value.

**Forbidden list.**
- Each sentinel, and each calculated output, as plain digits, in Indian grouping, in 2-decimal form.
- Rate names, `Material-Price`, `Material-Specific-Gravity`, `Material-Scrap-Rate`, `{{f:`, `{{rate:`, `{{mat:`, formula text.

**Scan.** Signed in as an Engineer, Playwright runs the journeys (queue, open task, tree, form, images, Calculate, after submit, after approve) while recording every response. It also calls every Engineer-reachable route in the manifest directly. Scanned: HTML, RSC flight payloads, JSON, headers, and the JS chunks the Engineer's pages load. Plus direct requests to all Lead and Admin routes as an Engineer, which must give 403 with the fixed body and no data, for a real ID and an invented one alike (architecture section 6, CR-33).

**Negative control.** A test-only route returns one sentinel, and the scanner must report it. If the scanner cannot find a planted leak, the suite fails.

**Typed values are allowed.** An Engineer sees what they typed, including Machining, Plating, Tool and Fasteners Cost (FR-008). So the canary estimate's inputs must be chosen so that no output equals a typed value: an estimate with only AP set would make AY equal AP and give a false alarm.

**Also asserted.**
- Calculate's Engineer response equals exactly `{status, message}`.
- `GET /tree` and `GET /form` give the same keys to an Engineer and to a Lead (one route, one schema).
- For an Engineer, a missing estimate and another Engineer's estimate give byte-identical responses, on the API and the page.
- The export file, the export summary and the export page all refuse an Engineer, with no data in the body.
- No `calculation_rows` import reachable from Engineer views (ESLint; a test confirms that the rule fires).
- E-mail bodies contain no forbidden string.
- The Engineer's data carries no figure state and no `override_reason`, and `GET /options/*` for an Engineer holds no rate for the "Not applicable" entries.
- **The warning path (CE-9).** The journeys include an estimate with an H of 0, so the 409 body and the dialog are scanned. "That row will cost 0" is expected and is not a leak: the 0 is the typed value. The 409 has one strict schema, with the same keys for Engineer, Lead and Admin. The same estimate, calculated under two different sets of `canaryMasters`, gives the same 409 body except `requestId`, which shows the warning depends on nothing Restricted. After an acknowledged Calculate, no Engineer response holds `warnings`, and no `engineer-*.ts` view reads `calculations.warnings` (the ESLint rule on cost repositories holds).
- `Cache-Control: no-store` on every authenticated response.

## 7. Authorisation and Security Tests

| Test | Requirement | Method |
|------|-------------|--------|
| Role matrix | FR-007, NFR-001 | Every manifest row, as each role and signed out; expected result from SPEC §3. A refused role gets 403, signed out 401. The 403 body is identical on every route apart from `requestId`, and the same for a real ID and an invented one, so a refusal cannot show that a record exists |
| Manifest completeness | NFR-001 | Every `route.ts` and `page.tsx` appears; every handler uses `withRoute` |
| CSRF | NFR-003 | POST with a foreign `Origin` is refused on every state-changing route |
| Cookies | NFR-003 | HttpOnly, Secure, SameSite on staging over TLS |
| Lock-out | NFR-003 | 5 failures, 6th blocked for 15 minutes with a controlled clock; unknown e-mail takes the same path |
| Password rule | FR-098, BR-049 | One table, on the zod schema and on each of the five entry points: 9 and 129 characters; no number; no symbol; a space as the only symbol (accepted, ASSUMPTION-56); the user's e-mail in other letter case; `Password1!` and `Welcome@123` (refused after stripping). `bootstrap:admin` refuses a weak password. Sign-in with an existing password never runs the rule |
| Session | FR-099, A-23 | With a controlled clock, a request just before 12 hours after sign-in is accepted and one just after is refused, for a session used every minute, so activity does not extend it |
| Revocation | FR-004 | Deactivated user refused at the next request; role change effective at once |
| One Admin | FR-005 | Service refusal and direct SQL refusal |
| Step-up | NFR-004 | Three actions, four once FR-006 is built, six with cancel approval and remove price, refused without the password and with a wrong one (422 `STEP_UP_FAILED`, not 401); a wrong step-up does not block sign-in |
| Temporary password | FR-004 | A password set by the Admin, on add or reset, sends that user to SCR-23, with every other page and API route refused until they set one that meets FR-098 |
| Admin guards | FR-005 | The Admin cannot change their own role or deactivate themselves, by direct API call; an Admin reset clears a sign-in block |
| Open redirect | NFR-001 | A sign-in return address to another origin is ignored |
| System fields | FR-076 | Deleting A, H, BG, BL, BM or BO is refused; deleting a field used only by `hideWhenZero`, `visibleWhen` or a stage total is refused |
| Reset and sign-in pages | NFR-022, FR-089 | The reset page, the sign-in page and signed-out redirects carry `noindex`; the reset page sends `no-referrer`; no page has an image tag for sharing |
| Uploads | NFR-005 | 199 × 1024 accepted; 201 × 1024, renamed text, polyglot refused |
| Stored XSS | NFR-005 | Script payload in every text field renders as text |
| Export text | Section 8 of `architecture.md` | A value starting `=` is a string cell, not a formula |
| Audit | NFR-007 | One test per event type, including the override reason when given; direct `UPDATE` and `DELETE` refused |
| Immutability | NFR-026 | Direct `UPDATE` on `calculations`, `calculation_rows`, `config_versions` refused |
| Hidden entries | D-17 | Direct SQL `UPDATE` and `DELETE` on an `is_hidden` row refused |
| No `eval` | CONSTRAINT-02 | Code search; ESLint |
| No Server Actions | ADR-010 | Code search; ESLint |
| Secrets | NFR-006 | Gitleaks over the full history; env validation test |
| Data files | NFR-006 | Allow-list check |

## 8. Performance

**Device definition for NFR-009 (PRD NFR-009; v0.13).** The pass/fail profile is office Wi-Fi on a recent phone. It uses the Lighthouse mobile form factor at 360 × 800, with simulated throttling at `rttMs` 40, `throughputKbps` 10,240 and `cpuSlowdownMultiplier` 4. These values are PROPOSED by the product-manager. Slow 4G (`rttMs` 150, `throughputKbps` 1,638.4, `cpuSlowdownMultiplier` 4) runs nightly and is reported only. "Interactive" is measured as **LCP ≤ 2 s and Total Blocking Time ≤ 200 ms**, taking the median of 5 runs, because Lighthouse no longer scores Time to Interactive. The five key screens are queue, workspace, cost view, masters and assign, measured signed in on a production build. Section 10.2 gives the reference hardware, browser and settings. Every route's first load also has a JavaScript budget of 200 KB gzip, checked on every pull request (section 10.1). Numbers taken anywhere else, such as the laptop figures in the AQP-28 review, are relative evidence only.

| NFR | Scenario | Target | Tool | Where |
|-----|----------|--------|------|-------|
| NFR-008 | Recalculate `tree500`, 20 runs | p95 < 2 s | Timed integration test; record the machine | Nightly, staging |
| NFR-009 | Five key screens, Wi-Fi profile | LCP ≤ 2 s and TBT ≤ 200 ms, median of 5 | Lighthouse CI on the reference hardware (10.2) | Nightly; on demand before the G6 of a key-screen story; pre-release |
| NFR-009 | Five key screens, Slow 4G | Reported, not judged | Lighthouse CI (10.2) | Nightly |
| NFR-009 | Every route's first load | ≤ 200 KB gzip JavaScript | `scripts/check-js-budget.ts` (10.1) | Every pull request, step 11b |
| NFR-010 | 25 virtual users, mixed page-data and save | p95 ≤ 500 ms | k6 | Staging, before release |
| NFR-010 | Export of 50 nodes with 50 images | p95 ≤ 10 s | k6 | Staging, before release |
| NFR-010 | Page latency while a 500-node export runs | p95 ≤ 500 ms | k6 | Staging, before release |
| NFR-011 | 25 and 50 virtual users | No errors; targets hold at 25 | k6 | Staging, before release |

The pre-design benchmark (architecture section 4.6, ADR-005, ADR-012) only shows feasibility. It does not replace these tests. Those numbers came from a laptop on Node 24, with no database.

## 9. Other Non-Functional Verification

| NFR | Method |
|-----|--------|
| NFR-012 | External monitor at 5-minute intervals; monthly reading |
| NFR-013 | Restore rehearsal on staging, including images, from an encrypted copy using the private key and the manifest; log time and result. **The Admin runs it, from the README alone**, as the person who will do it for real, with the IT person on hand and not helping unless it stops. The target is RPO ≤ 7 days under D-15, on a healthy server. With too little free space, `backup.sh` makes no copy, records a failed run and removes no copy. `backup-watch` alerts below 20 % free. Retention with controlled dates: a copy just under 2 years old stays, one just over goes, and a good copy is never removed by a failed run. `backup-watch` with a controlled clock: a good run 7 days ago raises nothing, none in 8 days logs `error` and writes one outbox row, and a re-run writes no second row |
| NFR-014 | Controlled clock with Mailpit: To and Cc correct, alerts OFF sends none, 11:00 IST digest, re-run sends 0, failures retried 3 times, catch-up after a restart, at most 25 claimed per run. Mail sign-in: each `SMTP_AUTH_MODE` builds the expected Nodemailer options; a local stub token endpoint gives a token, a renewal after a refused token, and an expired-secret failure that ends in `failed` with no secret in `last_error` or the log. **A real send through the actual mailbox is the only proof, and is needed before alerts go live** (OQ-ARCH-11): Mailpit cannot test XOAUTH2 |
| NFR-015 | Deadlines at 23:30 IST and at 03:00 IST (the previous date in UTC) show the right IST date; overdue flips at the right moment; year boundary for task IDs taken in IST |
| NFR-016 | Playwright at 360×800, 768×1024, 1024×768, 1366×768, 1920×1080, portrait and landscape: `scrollWidth ≤ clientWidth`; primary actions in view |
| NFR-017 | Bounding box of every interactive control ≥ 44 px on touch projects |
| NFR-018 | axe with tags `wcag2a`, `wcag2aa`, `wcag21aa` and `wcag22aa` at 3 widths as the gate (2.2 AA is PROPOSED in PRD v0.6, and the delivery lead may revert it); manual keyboard run of key flows |
| NFR-019 | Playwright chromium, firefox, webkit nightly; one real phone per release |
| NFR-020, 021 | Design checklist; search for raw colours; hash of the logo file; contrast checks |
| NFR-022 | Each route: title ≤ 60, description ≤ 160, Open Graph tags, `noindex` behind sign-in, no forbidden strings |
| NFR-023 | UX review |
| NFR-024 | Injected fault in a route and a job: logged with time, request ID and user ID, and no secret |
| NFR-025 | CI thresholds, section 11 |
| NFR-026 | Approve, change masters and configuration, compare screen data and export values |
| NFR-027 | SPEC §14.12 by read-back; manual open in Excel desktop per release |
| NFR-028 | Repository scan; Q-26 answer |
| NFR-029 | Inspection |
| NFR-030 | Timed walk-through on a clean VM by someone who did not write the README |

**Regression for FR-047:** paste, drag and file choice; the phone camera path once on a real device.

**Added at the UX reconciliation.**

| Requirement | Test |
|-------------|------|
| FR-062, A-12 | With BL of 100.004, a price of 100.00 is not an override, and 100.01 is. The override entry is written once |
| FR-065, ADR-007 | Approve, rename the material and treatment, delete an unused rate: screen and export values are unchanged |
| FR-058, UX-01 | Taking the operands printed on SCR-07, the worked line reproduces the printed result |
| FR-078 | Revert to a checkpoint, then revert to the version before it, which has no checkpoint |
| FR-029, Q-35 (b) | A parent's BG, BJ and BK in the Lead data are its own row's, equal to its row in the file. No Σ figure or item total exists in any response. The Engineer's data has none of these |
| UX spec §4 | A Lead's bell count equals their Overdue tab |
| NFR-018, UX-14 | At 360 px on SCR-05 and SCR-06, every field reached by Tab or Enter is fully visible above the action bar, also with the bar wrapped. Repeat on one real phone with the keyboard open |
| NFR-020, UX-13 | Every money value renders ₹ from a project font: check the glyph in each shipped font file |

**Added for SPEC v1.4.**

| Requirement | Test |
|-------------|------|
| FR-100, cleared figures | For each kind of input change (a number, Remarks, customer, image, add, delete, move, reorder): `/costs` returns no BL, BN or Tool Cost total and no calculated value on any row, and `/nodes/{id}/costs` returns the state alone. Inputs, H included, stay. Recalculate restores them |
| FR-100, no false clear | Autosave and a repeated PATCH with the same values, including `1.50` against `1.5`, do not bump `inputs_revision`. Change and change back stays cleared |
| FR-100, record kept | After clearing, the `calculations` row is unchanged, and the approved calculation is untouched by an unlock |
| FR-101, approval | Approve is refused with `NOT_CALCULATED` and `TOTALS_OUT_OF_DATE` by direct API call, not only from the screen. Two concurrent requests, an input save and an approve: the approve never succeeds on figures older than the save |
| FR-063, FR-100, unlock | Unlock with no input change keeps figures `current`, shows the earlier price labelled as approved earlier, and needs a Recalculate before approval |
| FR-069, FR-070, Q-37, A-32, export | `GET /export` is 409 `NOT_CALCULATED` at `none` and 409 `EXPORT_OUT_OF_DATE` at `out-of-date`, and `allowOutOfDate=true` changes nothing. At `current` the file downloads. A change between `export-summary` and `export` still gives the 409. While figures are not current, every other route works as usual: only the download is refused (AQP-1 comment 10560) |
| FR-069, D-16, export | Read-back: BL2, BN2, BO2 once, no per-item totals, and the footer value equals the sum of the node rows in BM. BM2 still holds the first node's own value. Inserting a field before BM moves the footer with the column |
| FR-103, reason | Reason is stored and audited on an override, absent without one, dropped when the price is not an override, and refused over 500 characters. Script text renders as text |
| FR-018, hidden | `GET /materials`, `GET /treatments`, search and Admin pages hold no such entry; "Other" stays on the Admin's list. `GET /options/*` returns it. `PATCH` and `DELETE` on the fixed ID return 404, the same as a random ID. Creating that name in any letter case gives 422 `NAME_RESERVED`. The rows exist after `prisma migrate deploy` on an empty database, with no seed |
| FR-018, scrap | With "Not applicable" and N above 0: O = 0, M = 0, AK = 0, and AO, AQ and AS still calculate from N, so labour counts. On SCR-07's data, F and I are blank with no material operands. The export shows the words in E and blank F and I |
| A-21, no change elsewhere | For generated rows with a real material, O equals `M - N` exactly, including N above M, and every other output matches its formula in SPEC §7.4 |
| FR-022, formula language | `ROLLUP` is not a function, so a formula using it is a validation error. `IF` accepts the six comparisons in its condition, and a comparison anywhere else is a validation error |

**Added at the UX v0.3 reconciliation (architecture section 16.9).**

| Requirement | Test |
|-------------|------|
| FR-100, Q-37 (a), single-piece product | CE-12 variant A, after an input change: `/costs` and `/nodes/{id}/costs` hold no calculated value, so the old total appears in no response. Variant C the same, on every row |
| FR-062, Q-37 (c), approved price | After an unlock, and after a later input change, `/costs` still gives the latest approved price. A new approval replaces it, and the earlier row stays on record. BO2 in a file holds the latest approved price |
| A-30, cancel and remove | As a Lead or an Engineer: 403 on both routes. Without the password or with a wrong one: 422 `STEP_UP_FAILED`. Remove before cancel: 409. A stale `approvalId`: 409 `APPROVAL_CHANGED`. Cancel on APPROVED gives DRAFT and reopens the task; on DRAFT or SUBMITTED the status stays. After cancel: `/costs` labels the price and BO2 is empty. After remove: no route returns the price, BO reads as not set, and a new approval works. One audit row each, in the same transaction, holding the price. The `calculations` row is unchanged. Direct SQL `UPDATE` of `approved_price` as the runtime role is refused |
| OQ-ARCH-06, rate notice | Change a rate used by a `current` SUBMITTED estimate: `/costs` gives `ratesChanged` with counts and no value, and approve still succeeds. A rate the calculation did not use gives nothing. An APPROVED estimate gives nothing. The Engineer's data holds nothing. `rate-diff` has one table test, used by `/unlock-preview` as well |
| OQ-ARCH-04, picture optional | Calculate succeeds with no picture on any part, and the completeness count ignores Part Model. The export has an empty cell for such a part |
| FR-105, Last backup line | With a controlled clock: a good run 7 days old shows its time with no notice; 9 days old adds "Backup late"; below 20 % free adds "Disk nearly full". Admin only: 403 for a Lead. The line has no control that starts, restores or deletes a backup |
| A-35, `restore.sh` | On staging. Each failure stops with a plain message and leaves the portal running on the old database: a changed copy (SHA-256), a newer PostgreSQL in the manifest, too little free space, a wrong key, a typed date that does not match, and a restore that fails half way. A good run swaps the database, passes `/api/health` and writes the host log line. The key and the decrypted dump are on no disk afterwards. The limited account can run `restore.sh`, and cannot read `.env` or use Docker |
| DL-034, `clear-copies.sh` | With a controlled set of copies: it removes the oldest first, each with its manifest, never one of the newest 4, and only after the typed date matches. With 4 copies or fewer it removes nothing and says the disk is too small. It writes one `job_runs` row and a host log line, and the Last backup line reflects the new free space. The limited account can run it, and it takes no arguments, so it cannot be pointed at any other path. The weekly script still removes nothing under 2 years old |
| A-1, seed items | After `prisma migrate deploy` on an empty database, with no seed: 15 `process_items` rows with the IDs in `seed-ids.ts`, the names and units of SPEC §4.1 (D-38; `Plating-rate-per-sqin` and `Soft-Anodize-rate-per-sqin` per sq in) and 0, and "Other" in `treatments`, `is_system` true, `is_hidden` false. `ensure-seed-version` creates version 1 once. Run again, or with a changed seed module on a database that has a version, it changes nothing. If it fails, `migrate` exits non-zero. Placeholders update the 15 rows by ID and add none. Every `{{rate:<id>}}` in the seed exists in `process_items`, and no seed formula references `Plating-rate-per-sqin` (D-40). Every `{{mat:<key>}}` in the seed is one of `pricePerKg`, `specificGravity`, `scrapRate`, and AK reads `{{mat:scrapRate}}` (architecture section 4.5) |
| FR-029, FR-100, Lead data | Only at `current`, `/costs` gives H and own BG, BJ and BK by node, and `/export-summary` gives H, BG and BM by row with the total Tool Cost. At `none` and `out-of-date`, neither gives a row figure |
| FR-069, footer position | With 10 nodes in rows 2 to 11, row 12 is empty and row 13 holds the value in the Tool Cost column and the label in the cell to its left, in every file. Repeat with 1 node: the footer is row 4. With no Tool Cost, a `current` file shows 0 and BN2 is empty. Inserting a field before BM moves the value and label together |
| FR-103, reason | The reason appears in no cell of the exported file, in `/costs` and `/export-summary` for Lead and Admin, and in no Engineer response |
| FR-015, UX-37 | `POST` and `PATCH /materials` refuse Specific Gravity of 0 or below with 422. The hidden row stays at 0 |
| FR-063, FR-100 | `/costs` gives the unlock's who, when and reason, in Draft after unlock and in Unlocked and changed |
| FR-019, sender | A stubbed 5.7.60 refusal gives `SENDER_NOT_ALLOWED`, with no secret in the response or the log |

## 10. CI Pipeline Stages

No workflow exists yet; the scaffold story, STORY-10.01, adds `.github/workflows/ci.yml` with stages 1 to 11, and the story that first gives a stage something to run turns it on: stage 12 with the first page and the canary scan with the first Engineer route, stage 13 with the Dockerfile (architecture section 9.2, CR-11). The repository is public, so logs are public. CI holds no production secret, and fork pull requests get none.

| # | Stage | Command or tool | Blocks merge |
|---|-------|-----------------|--------------|
| 1 | Install | `npm ci` | Yes |
| 2 | Secret scan | Gitleaks, full history | Yes |
| 3 | Data-file check | Allow-list script | Yes |
| 4 | Lint | `npm run lint` | Yes |
| 5 | Type-check | `npm run typecheck` | Yes |
| 6 | Unit, with coverage of pure code | `npx vitest run tests/unit --coverage --coverage.include='src/lib/**/*.{ts,tsx}' --coverage.include='scripts/lib/**/*.ts'` | Yes |
| 7 | Dependency audit | `npm audit --omit=dev --audit-level=high` | Yes, at high or above |
| 8 | Licence check | Allow-list with the named exceptions (architecture section 11) | Yes |
| 9 | Build | `npm run build` | Yes |
| 10 | Migrations | `prisma migrate deploy` on an empty database; drift check | Yes |
| 11 | Integration, contract, security, acceptance, export, then the combined coverage gates | `npx vitest run tests/unit tests/integration tests/security tests/acceptance --coverage`; then, on a pull request, `npx tsx scripts/check-changed-coverage.ts --base "origin/${BASE_REF}"` | Yes |
| 11b | JS budget (NFR-009) | `npx next start` on the stage 9 build, then `npx tsx scripts/check-js-budget.ts` (section 10.1) | Yes |
| 12 | E2E | `npm run test:e2e` (Chromium, 3 widths, axe, canary scan; tests tagged `@one-width` run at 1366 px only, section 10.5) | Yes |
| 13 | Image | Docker build; run and check `/api/health` | Yes, on `master` |
| Nightly | Full browser matrix, Lighthouse on both profiles (section 10.2), 500-node timing, CI feedback time (section 10.3) | Scheduled (`.github/workflows/nightly.yml`) | Reported. A Wi-Fi Lighthouse or timing failure raises a bug; a CI-time breach raises a `tech-debt` issue |
| Pre-release | k6, restore rehearsal, manual Excel, one real mail send, Lighthouse Wi-Fi run on the release build | Manual | G8 evidence |

**`/design-system` is absent from a production build (STORY-10.02 AC-7; G6 STD-05 of AQP-28; ruling on AQP-38, architecture v0.16).** Since AQP-38 every portal page asks who is signed in, so it is rendered per request, and the build writes no 404 record for `/design-system`. The proof therefore has two parts:
- Stage 9, `scripts/check-production-routes.ts`, fails if the route is prerendered with any status but 404, or if the build output has a shape it cannot read.
- Stage 12, `tests/e2e/production-routes.spec.ts`, is the proof. It asks the stage 9 build, served by `next start`, for the page as a signed-in Lead, and expects 404 with no design-system content. Signed out, the visitor is sent to the sign-in page.

Stage 12 runs inside the required job, so a failure blocks the merge. The gate reads `NODE_ENV`, which is `production` under `next start` and in the image, so staging is covered too. The image of STORY-10.04 runs the same `next build` of the same commit, and that story's review checks it does.

**Where the coverage gates sit (QLT-05).** Coverage runs twice from one Vitest configuration, and the stage order does not change. Stage 6 has no database, so it can only judge pure code. Stage 11 has the database, so it judges the whole package.

- **Stage 6** narrows `coverage.include` on the command line to `src/lib/**` and `scripts/lib/**`. Only unit tests count, so the 95 % gates cannot be met by engine lines a service happens to run. It fails fast, before the build.
- **Stage 11** runs the unit tests again with every other Vitest level, in one run and one coverage report, under the configuration's full `coverage.include`. So unit and integration lines count together for `src/server/**`. The changed-code check reads that report and moves here from stage 6.
- **Why one run, not a merge:** a single run gives one `lcov.info` with no reporter, artefact or merge step to maintain. The repeat of the unit tests costs about 13 seconds today (section 11 evidence).
- **What stays:** the job name `Stages 1 to 11`, which is the required check on `master`, and no new stage number. The story's AC-4 ("unit with coverage") and AC-8 hold as written. `quantity-cases-complete` stays a stage 6 unit test (section 5.6, control 4).
- `tests/acceptance` joins stage 11 because section 2 runs it on every PR and no stage named it.

Flaky test policy: quarantine with a ticket within a day; never delete to make a build pass. Retries are off in unit and integration tests. Playwright allows 1 retry and reports it. Canary and role-matrix tests are never quarantined, and neither is `tests/e2e/production-routes.spec.ts`, the only proof that `/design-system` is absent from a production build.

**Tests do not depend on machine load (master's rule, DL-057, GitHub #24).**
- Heavy set-up warms up in its own `beforeAll` hook, with its own hook timeout, and never inside a test's time limit. Examples are the first ESLint run of the layer-rule tests and the creation of a scratch database.
- The hook timeout for the database levels is set once, in `vitest.config.ts` (`hookTimeout`), and not per file.
- A unit test carries no wall-clock limit. It counts the work instead (for example, the lookups made), and timing belongs to a performance check (section 8).
- Raising a per-test limit or quarantining the test is not the fix for a test that fails only under load.
- CI is the reference run. A timeout seen only on a loaded local machine is fixed under this rule and holds no gate.

### 10.1 JS budget check (NFR-009)

The PRD sets the budget and what it counts. This section says how the check counts it. The entry point is `scripts/check-js-budget.ts`, with its logic in `scripts/lib/js-budget.ts` so that stage 6 unit-tests it.

| Item | Rule |
|------|------|
| Routes | Every page route of the stage 9 build, served by `npx next start` on a free port. The list comes from the route manifest (STORY-01.02); until that exists, it comes from the build's app path list. A dynamic segment is filled with an id the script creates from invented data through `tests/support/builders`. Any other route that does not answer 200 fails the check: nothing is skipped silently. The not-found page is measured too. The script requests an unused path the same way as the other routes, expects status 404, and reports it as the row `not-found` against the default limit. Any other status fails that row |
| Sign-in | Each route is fetched as every role the route manifest allows on it, and the largest total counts. The CI users are created with `bootstrap-admin` and the user service from invented values set in the workflow. They are not secrets, because the database is thrown away after the run |
| What counts | The distinct URLs in the HTML's `<script src>` elements without a `nomodule` attribute, and in `<link rel="preload">` or `<link rel="modulepreload">` with `as="script"`. Each file is read from `.next/static`, not over HTTP, so the server's own compression does not matter. Each is compressed with Node's `zlib.gzipSync(buffer, { level: 9 })`, the same as the `gzip -9` of the AQP-28 review, and 1 KB is 1,000 bytes. Inline scripts (the RSC payload) and chunks requested after the first load do not count |
| Limit | 200,000 bytes per route. Per-route limits live in one table in `scripts/lib/js-budget.ts`. A raised limit names the product-manager decision (decision-log ID) and the Lighthouse run that met the targets. A lowered limit names the Lighthouse run that missed them |
| Output | One table row per route: file count, raw bytes, gzip bytes, limit and headroom, written to the job summary. The script exits 1 if any route is over its limit or cannot be measured |
| Calibration, once, when the check is added | Run the script against commit `6f66b97`, the build the AQP-28 review measured. It must report `/` at 184.6 KB and the not-found page at 135.1 KB, each within 1 KB. The developer records the result in the pull request. If either figure differs, the developer reports the difference and its cause to the solution-architect, who reports it to the product-manager before the check merges |
| Where | Step 11b of the required job, after stage 11, because sign-in needs the migrated database, and before stage 12. It blocks merge and should add under a minute |
| Tests | Unit tests: a `nomodule` script is excluded, a preload is counted, a duplicate counts once, plus the gzip sum and the limit table. Integration tests: a route over a lowered test limit fails, a route answering 500 fails, and the `not-found` row passes on 404 and fails on 200 |

**Expected headroom.** After the AQP-28 fix round adds `tailwind-merge`, `clsx` and `class-variance-authority` to the shell, `/` is expected near 194 KB (184.6 + 9.0 + 0.6; an estimate from a scratch bundle, see architecture section 11). The first key screen will probably need `next/dynamic` for its heavier parts, or a recorded decision for its route.

### 10.2 Lighthouse reference run (NFR-009)

| Item | Rule |
|------|------|
| Reference hardware | A GitHub-hosted `ubuntu-24.04` runner, standard size for a public repository (4 vCPU, 16 GB RAM). A run anywhere else is evidence only and is labelled with its `benchmarkIndex` |
| Browser | The Chromium that Playwright 1.64.1 installs (`npx playwright install chromium`), passed to Lighthouse as `chromePath`, so the browser changes only when Playwright is upgraded. Its version is recorded with each run |
| Tool | `@lhci/cli` 0.15.1, which runs Lighthouse 12.6.1, as an exact dev dependency. Configuration lives in `lighthouserc.cjs` |
| Server | `next start` on the CI production build, with the database migrated and invented data from `tests/support/builders`. Each screen is loaded signed in as the role it is for, through a `puppeteerScript` with `disableStorageReset` |
| Wi-Fi profile (pass/fail) | `formFactor: 'mobile'`, `screenEmulation: { mobile: true, width: 360, height: 800, deviceScaleFactor: 1.75, disabled: false }`, `throttlingMethod: 'simulate'`, `throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 4 }`, `onlyCategories: ['performance']`, `numberOfRuns: 5` |
| Assertions | `largest-contentful-paint` ≤ 2,000 ms and `total-blocking-time` ≤ 200 ms, each with `aggregationMethod: 'median'` (the median of the 5 runs). They apply to the five key screens as each comes into being: masters, assign, queue, workspace and cost view. Other routes, `/` included, are reported without assertions |
| Slow 4G profile (report only) | The same settings with `throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 }` and no assertions |
| `benchmarkIndex` | Each run's `environment.benchmarkIndex` goes into the summary with LCP and TBT. The baseline run records the median index as B0. A later run whose median index is more than 25 % away from B0 is marked "not comparable" and re-run. If that happens again, a new baseline is taken and noted in the summary |
| Results | Lighthouse reports are kept as a workflow artefact for 30 days (`upload.target: 'filesystem'`), and the summary table goes in the job summary. Nothing is uploaded to a public server |
| When | Nightly, on both profiles. On demand (`workflow_dispatch` on the branch) for the G6 of any story that builds or changes a key screen; its pull request links the run. Pre-release, at G8. Not in the required pull-request job, because of the CI time limit (10.3) |
| Pull-request trigger (AQP-169 A-2) | `nightly.yml` also has a `pull_request` trigger limited by `paths` to the files that define the run: `.github/workflows/nightly.yml`, `lighthouserc.cjs`, and the scripts and `scripts/lib` modules that the workflow calls. GitHub dispatches only workflows that are on the default branch, so this is how the baseline runs before STORY-10.10 merges. It stays after the merge, so any change to the measuring setup is measured on its own pull request. The trigger is `pull_request`, never `pull_request_target`. The token stays read-only and no secret is used, and a `concurrency` group cancels a superseded run. It is never a required check, so a red run reports and never blocks a merge |
| Results at the gates | At G6, reviewer-performance reads the on-demand run. A miss on the Wi-Fi profile is a finding against NFR-009. The product-manager then decides whether to lower that route's budget or record a decision. The targets change only by the delivery lead's decision (PRD NFR-009) |
| Baseline | The first reference run on the shell, `/`, which is what AQP-28 builds (`/design-system` is not in a production build). It decides RISK-020 and the review of the 200 KB budget |

### 10.3 CI feedback time (NFR-009, PROPOSED)

The nightly workflow reads the GitHub API. It measures the duration of the required job, `Stages 1 to 11`, from start to finish, excluding queue wait. It uses first attempts of the last 20 pull-request runs and reports the p95 and the median. The target is a p95 of at most 10 minutes, with an early warning when the median passes 6 minutes. Both figures are PROPOSED, for Santhosh to confirm. A breach fails that nightly step with a message, and the orchestrator raises a `tech-debt` issue. A breach never blocks a merge. The nightly workflow has `contents: read` and `actions: read` only.

**The measure once jobs are split (AQP-208; ruling 2026-11-05, CR-46).** A run's duration is the time from the start of its first job to the end of the job named `Stages 1 to 11`, queue wait excluded. For a one-job run that is the same job, so runs from before and after AQP-208 are measured alike. Only runs whose `Stages 1 to 11` job succeeded count, and a re-run attempt is excluded.

**The line's wording from AQP-208 on (decided by master, DL-103; proposed by the solution-architect).** "Before AQP-199 merges" and "the shard step is due" both go stale once AQP-208 merges. The line states the fact and points to the current step, exactly: `p95 over 9 minutes (DL-095, DL-102): CI feedback is too slow; the next step is named in test strategy 10.5.` Section 10.5 keeps that step up to date. AQP-208 changes the text and its unit tests to match; the rest of the rule below is unchanged.

**The 9-minute line (DL-095; AQP-199 AC-7; ruling 2026-11-05, CR-42).** When the p95 is over 540 seconds, the step writes one line to the job summary, **whatever has been merged**: "p95 over 9 minutes (DL-095): before AQP-199 merges, stories that add E2E specs are held at G6; after it, the shard step of test strategy 10.5 is due." At exactly 540 seconds it writes nothing. The step does not try to detect a merge; master and the orchestrator know whether AQP-199 is in `master`. It fails nothing, and the 10-minute and 6-minute failures above are unchanged. **The step also reports which runs it used:** the count, and the start time and head commit of the oldest and the newest. A reader can then see whether a report covers only runs made after a given merge, such as AQP-199 AC-1.

### 10.4 Who builds it, and by when

- **A new enabler story**, proposed as STORY-10.10 "NFR-009 guards: JS budget check and Lighthouse reference run", for the scrum-master to write (about 3 points, my estimate). It is carved out of STORY-10.09, which keeps NFR-010 to 012 and NFR-024. It covers sections 10.1 to 10.3, `@lhci/cli`, `lighthouserc.cjs`, `nightly.yml`, the calibration and the baseline.
- **Order:** it can start once 01.01 has given sign-in, and it uses the route manifest once 01.02 is merged. **It must be Done before 02.01 (AQP-113), the first of the five key screens, reaches G6.** It touches only `scripts/`, `.github/workflows/`, `lighthouserc.cjs` and tests, so it can run in a second stream beside 01.04 and 01.07.
- **The baseline** is taken at that story's G7 on `/`. That is the shell AQP-28 builds, measured on the reference hardware; AQP-28's own G7 has no reference run to use (master, DL-058).
- **Every key-screen story** (02.01 masters, 04.01 assign, 04.02 queue, the workspace stories of EPIC-05, 06.03 cost view) links an on-demand Wi-Fi run at its G6.

### 10.5 Stage 12 time (AQP-199, STORY-10.14; DL-095; RISK-023; ruling 2026-11-05)

Stage 12 grew from about 1.5 to between 3.6 and 5.2 minutes in two days, and the median of the required job passed 6 minutes. **The approach is two changes inside the one required job.**

**1. Four workers in CI.** `workers` becomes 4 in CI and stays 2 on a developer's machine (`IN_CI ? 4 : 2`). The set-up project also warms each development-server route the specs use (`/`, `/queue`, `/design-system`) before the width projects start, so four workers do not compile the same page at once. A public repository's `ubuntu-latest` runner has 4 vCPU and 16 GB, which the developer confirms from the run log at T1. Four Chromium workers, two Next.js servers and PostgreSQL fit in that memory. CPU is the risk, and AQP-199 AC-5 is the control: if 4 workers give a flaky test, the developer tries 3 and reports. A timeout is never widened.

**2. Tests that read no layout run at one width.** Such a test asserts only server behaviour (HTTP status, headers, cookies, redirects, throttle counts, message text) or the logic of a test helper, or a client rule whose result is the same at every width (for example, that no request is sent). It reads no size, position, viewport, breakpoint, focus order, touch input or responsive arrangement. "Focus order" means a sequence of Tab stops, which can change with the arrangement. A check that the code moved focus to one named element, such as the notice in `sign-in.spec.ts` AC-2, reads no layout, provided that element is the same at every width. It carries the Playwright tag `@one-width`. The `mobile` and `tablet` projects set `grepInvert: /@one-width/`, and `desktop` runs everything. Nothing is deleted or skipped: each test still runs once on every pull request.

| Spec | Ruling | Why |
|------|--------|-----|
| `production-routes.spec.ts` | Whole file at one width | HTTP 404 and a redirect |
| `axe-helper.spec.ts` | Whole file at one width | Tests the helper's wait for transitions; colours and timing do not change with width |
| `sign-in.spec.ts` | One width: "the form checks before it sends", AC-2, AC-3, AC-4, AC-5, AC-6, and AC-1's two landing tests. **Three widths:** "SCR-01 at this width (AC-8)" and AC-1's account-menu test | Messages, the lock-out count, the session, the cookie flags and the return address are server rules. The account menu and the AC-8 block read layout |
| `aqp-38-qa.spec.ts` | One width: "sessions and return addresses in the browser" (AC-4, AC-6). **Three widths:** the AC-8 keyboard and screen-reader block, and the locked and "could not be checked" states (they run axe, which is stated at every width) | Server rules, against keyboard order and axe per width |
| `scaffold-smoke`, `design-system`, `navigation`, `shell`, `shell-first-open`, `shell-lazy-load`, `button-pressed` | Three widths, no change | Breakpoints, the drawer against the side menu, focus, touch, sizes |
| `users-production.spec.ts` (AQP-65; ruling 2026-11-05) | Whole file at one width | HTTP 403 with the "no access" page, the API's fixed 403, and a redirect: all server rules |
| `users.spec.ts` (AQP-65; ruling 2026-11-05) | One width: "adds a person…", "refuses an e-mail that is already used…", "AC-3: a second Admin is refused…", "changes the name and the role…", "AC-4: the Admin cannot change their own role…", and both "own row cannot be…" tests. **Three widths:** "the list…" (scroll and axe), "AC-7: controls are at least 44 px…", "by keyboard: the dialog opens…", "refuses a wrong e-mail…" (the message under the field), "reset a password…" and "deactivate and activate…" (the dialogs) | Server rules and the disabled state with its name, against sizes, axe, the position of a message, and dialogs whose presentation changes with width |
| `aqp-65-qa.spec.ts` (QA, AQP-65 G7; ruling 2026-11-06, master 11045) | One width: the top-level test "[AQP-65 AC-1] edit with no change closes the dialog and sends no request". **Three widths:** "an off-screen failure notice is scrolled into view" (master's ruling) and every other test in the file | No PATCH is sent and the dialog is closed: a client rule with the same result at every width, as for "changes the name and the role…". The dialog's presentation is covered at three widths by `users.spec.ts`. Scrolling a notice into view depends on the viewport |
| `audit-production.spec.ts` (AQP-74; ruling 2026-11-06) | Whole file at one width | HTTP 403 and 401, the API's fixed 403, a redirect: server rules |
| `audit.spec.ts` (AQP-74; ruling 2026-11-06) | One width: the 405 test, the From-after-To message, whole days in IST, the empty kind with "Clear filters", the error with "Try again", and the broken answer. **Three widths:** both "Show more entries" tests, and every other test in the file | **Counting `[data-entry-id]:visible`** finds the table rows at 768 px and wider and the cards below that, so the test runs a different render path at each width. **Such a test stays at one width only when its subject is a rule the representation does not change:** a filter's result, a retry, an error state. The representations must also be covered at three widths by other tests; here "the list…", "a table from 768 px and cards below it…" and "filters by who and by event; the list, the cards and the total follow" do that. "Show more entries" is about how each representation adds and keeps entries, so it stays at three widths. The From-after-To test reads the message's text, `aria-invalid` and the request count, not where the message is |

**Guard against silent loss.** A unit test fails if `@one-width` appears in any file outside those named above (four from AQP-199, the two `users` specs that AQP-65 adds to its allow-list, and `aqp-65-qa.spec.ts` for its one ruled test). Tagging a test in another file needs a ruling here first. AQP-199's pull request lists the tests before and after by spec and project, from `npx playwright test --list`.

**Kept:** one job, still named `Stages 1 to 11`, so branch protection does not change. `retries` stays 1 and `forbidOnly` stays on. Section 10.3 measures the same job, unchanged.

**Rejected for now:** a job per width, and `--shard`. Each job repeats the install, build and database set-up (about 2 minutes, an estimate), which roughly doubles the runner minutes. It also needs care with the required check.

**Result of AQP-199 (PR #86, head 03ad852; developer, AQP-199 comment 11003; ruling 2026-11-05).**
- **Measured:** the required job went from 468 s to 411 s (6:51), down 12 %, and stage 12 from 313 s to 249 s, down 20 %, with 0 flaky tests. The runner has 4 vCPU and 16 GB.
- **Why the gain is small:** the time per test rose from 1.65 s at 2 workers to 2.80 s at 4, so throughput went from about 1.21 to 1.43 tests per second. One 4-vCPU runner is saturated.
- **Three workers:** not expected to beat four. The machine is CPU-bound, so throughput should land at or below 1.43 tests per second. Four stays, since it gave 0 flaky tests.
- **The p95 of 15:05:** it comes mostly from the apt stalls of section 10.6 (3 of 10 runs added 7 to 10 minutes), not from test time.

**Order from here:**
1. **AQP-199 merges as built.** The product-manager restates its targets.
2. **The DEF-015 fix (section 10.6, AQP-206, 2 points)** is next, because it removes the tail that sets the p95.
3. **Then the shard step, as its own story** (estimate 3 points). It comes after the DEF-015 fix so that its measurements are not distorted by stalls. Details:
   - Two shard jobs, each building for itself with no artefact passed between jobs, and each with 4 workers.
   - The shard count is one constant.
   - A fan-in job named `Stages 1 to 11`.
   - Section 10.3 measures from the first job's start to the fan-in job's end.

**Expected effect** (estimates, not measured):
- **Shards:** each pays about 2.5 minutes of set-up. Two shards bring the required path to about 4:40 today, and about 5:25 once AQP-65 adds its tests under the one-width ruling above. Runner minutes rise to about 1.7 times today's.
- **A third shard:** brings it back under 5:00, at about 2.2 times today's minutes. That is above AC-6's 2x guard, so it is the product-manager's call.
- **DEF-015 alone:** should bring the p95 down to about the slowest test-time runs, around 7 to 8 minutes.

**The shard step (AQP-208, STORY-10.15; ruling 2026-11-05, CR-44 to CR-46).**
- **Jobs and names.** The existing job is renamed `Stages 1 to 11b` and runs stages 1 to 11b as today. The shard jobs are one matrix job named `Stage 12: E2E (shard <i> of <N>)`. **There is no `needs` between the renamed job and the shards: they start together.** Each shard installs, builds with `next build`, migrates its own throwaway database, installs the browser and its system packages (section 10.6), and runs `npx playwright test --shard=<i>/<N>` with 4 workers. N is one constant, 2 to start. A final job **named `Stages 1 to 11`** has `needs` on the renamed job and every shard, runs with `if: always()`, and fails unless every needed job's result is `success`, so a failed, cancelled or skipped job fails it. The required check keeps its name, and the delivery lead changes no setting. Running the shards after the first job instead would put stages 1 to 11b and a shard in series, about 7:17 against today's 6:51 (product-owner's arithmetic), so they run alongside.
- **What runs where.** With `fullyParallel: true`, `--shard` divides the tests themselves, not the files. Project dependencies run in every shard that needs them, so the `setup` project runs **once per shard**, against that shard's own database. The union of the shards' lists of `mobile`, `tablet` and `desktop` tests equals the single-job list, with no test missing and none in two shards. `setup` is counted per shard and is outside that comparison.
- **If the pull request misses 6:00.** If the median required path of the head and its two re-runs is over 6:00 (AQP-208 AC-2), the developer sets N to 3 on the same pull request and measures the head again, plus two re-runs. The resource guard is then 2.5 times. If three shards also miss, the developer reports BLOCKED with the figures per job to the solution-architect, who reports to the product-manager. No test is dropped or moved to one width, and no timeout is widened.
- **The next step after this one** (named by the 9-minute line of section 10.3): three shards, pre-authorised by the product-manager (AQP-208 AC-1), as a one-line change of N. Beyond three shards the solution-architect proposes again.

### 10.6 Browser system packages (DEF-015; DL-100; ruling 2026-11-05)

**The fault.** `npx playwright install --with-deps chromium` runs `apt-get` against the runner's Ubuntu mirror on every run. The browser itself is cached already; its system packages are not. In run 42061753504 (attempt 3) the mirror served 20.5 MB at 35.9 kB/s, single packages stalled for up to 170 s, and stage 12 spent about 9.5 minutes installing, with no bound on how long that could take.

**The approach: cache the system packages, bound the download on a miss, and split the step.**

1. **Cache the downloaded `.deb` files** with the `actions/cache` already pinned in `ci.yml`.
   - **Key:** the runner image (`ImageOS`, `ImageVersion`, both set on GitHub-hosted runners) plus the installed Playwright version.
   - **On a hit,** `sudo dpkg -i` installs them with no network. On the same image version they are exactly the packages that were missing.
   - **On a miss** (a new runner image or a Playwright update, about weekly), `npx playwright install-deps chromium` runs normally. The `.deb` files it downloaded are then copied from `/var/cache/apt/archives` into the cached directory, which the runner user owns. If `dpkg -i` fails on a hit, the step falls back to the miss path, so a bad cache costs time, never a red run.
2. **Bound the download on a miss.** Before `install-deps`, a step writes `/etc/apt/apt.conf.d/99-ci-bounds` with `Acquire::http::Timeout "20";` and `Acquire::Retries "3";`, so a stalled package is retried after 20 s instead of waiting. The step has `timeout-minutes: 8`, so a mirror outage fails a named step quickly and a re-run is the remedy. It cannot use up the job's 30 minutes.
3. **Keep the browser cache, re-keyed** on the Playwright version rather than the whole lockfile, so an unrelated dependency change no longer downloads the browser again. This replaces the 2026-11-03 note that the cache would come out; master superseded that note (DL-100).
4. **Split the step** into "Stage 12a: Playwright browser and system packages" and "Stage 12: E2E", so the Actions API reports install time apart from test time. `tests/unit/ci-workflow.test.ts` follows.

**Supply chain.** The `.deb` files are checked by apt's signatures when downloaded. The cache is written only by runs on this repository: a pull request's cache is visible to that branch alone, so a branch cannot plant packages for `master`. That is the same trust as the existing browser and Next.js caches. No new action and no new dependency.

**Rejected:**
- **The Playwright container image, pinned by digest.** It is a cleaner supply-chain story, but as a job container it cannot run Docker for stage 13 (STORY-10.04). Run with `docker run` for stage 12 only, it pulls about 1 GB on every run (there is no layer cache on hosted runners), brings its own Node.js version against the Node 22 pin, and needs the servers and PostgreSQL wired across host networking.
- **A timeout alone.** It turns a slow mirror into a red run, and a re-run usually meets the same mirror. It is kept only as the bound on a miss (point 2).

**Follow-ups #93 and #99: one fix (ruling 2026-11-06; AQP-208 G6, master 11071; PRF-03 on PR #96).**
- **What happened.** On a cache miss, stage 12a can still lose up to 8 minutes. Run 42166426901, attempt 1, met a new runner image, and single packages took 90 to 160 s each. `Acquire::http::Timeout` bounds a connection, not a slow stream that is still alive, and apt has no minimum-speed setting. A pull request's own cache save is visible to that branch only, so after an image change every pull request misses, in each shard, until something on `master` saves the new key. `nightly.yml` still runs an unbounded `playwright install --with-deps` (#93).
- **Decision: both (c), in one fix, because #93 is the warming half of #99.**
  1. **Warm the keys on `master` (a).** `nightly.yml` gets a small job that runs only stage 12a: the same two cache steps, the same key formula and `scripts/ci/playwright-system-deps.sh`. It must run on the **same runner label as the CI jobs that run stage 12a** (`ubuntu-latest` today), because the key holds `ImageOS` and `ImageVersion`. A key warmed on another image would not match. The Lighthouse job stays on `ubuntu-24.04`, its reference image (section 10.2), and uses the same script and key formula, which gives it its own key. A scheduled run belongs to `master`, so what it saves every branch can read. A merge to `master` saves it as well. **The nightly job shares the CI key (the question in #93): yes, the same formula.**
  2. **Bound the download, not the connection (b).** On a miss the script reads the package list from `npx playwright install-deps --dry-run chromium` (a small parser, unit-tested) and downloads with `apt-get install --download-only`. Each try runs under `timeout` (`apt-get update` 45 s, the download 90 s; a healthy miss of about 22 MB needs a few seconds). A try that times out is safe to stop, because a download-only run changes no installed package, and a part-done download resumes. **If `apt-get update` fails or times out, that try ends at once and the next try starts, without spending 90 s downloading from a mirror that has already failed (AQP-216).** If the parser finds no install command in the dry-run output, the script warns and falls back to the bounded AQP-206 path (`npx playwright install-deps chromium` within the 8-minute cap). A Playwright update always causes a miss, because the key holds the Playwright version, so a change in the output format shows on the pull request that brings it, and that pull request is not turned red. The second and third tries switch the sources from the runner's mirror to `archive.ubuntu.com`. apt still checks the signed Release files, so changing mirror does not weaken integrity. Then `apt-get install --no-download` installs offline, and the new `.deb` files are cached as today. After three failed tries the step fails with a message naming the mirrors. The step keeps `timeout-minutes: 8` as the last bound; the tries fit inside it (about 6.75 minutes at worst).
- **What remains.** During a runner-image rollout a pull request can meet an image the nightly has not warmed yet. Point 2 bounds that miss.
- **A dead mirror must fail at `apt-get update` (QLT-95, master 11114; ruling 2026-11-06).** On the runner, `apt-get update` against a dead mirror exits 0 after 17 to 18 s. apt only warns, so the rule that a failed update ends the try never fired. **Adopted: `apt-get update --error-on=any`, but only against an apt view that holds nothing except the Ubuntu mirror being tried.** On the runner's full source list, the flag would also turn a transient failure of a third-party source carried by the image into a failed try, and then into a red run (master's concern).
  - **The isolated view.** Each try writes, in a temporary directory, a deb822 copy of the image's `ubuntu.sources` whose `URIs` is the mirror for that try: the runner's own on try 1, `archive.ubuntu.com` on tries 2 and 3. `Signed-By` is kept, so signatures are still checked. All three apt commands get the same options: `apt-get update --error-on=any`, `install --download-only` and `install --no-download`. The options are `-o Dir::Etc::SourceList=/dev/null -o Dir::Etc::SourceParts=<tmp>/sources.list.d -o Dir::State::Lists=<tmp>/lists`. Third-party sources are never read, and the runner's own source files and package lists are not changed. This replaces editing the system sources for the fallback. The `.deb` files still land in `/var/cache/apt/archives` and are cached as before. The playwright packages all come from Ubuntu's archive.
  - **Tests (`tests/unit/playwright-system-deps.test.ts`, with a stubbed `apt-get`):**
    1. An update that prints a `W:` warning and exits 0 does not end the try; the download runs.
    2. An update that exits non-zero ends the try at once. No download is attempted in that try, and the next try uses `archive.ubuntu.com`.
    3. `--error-on=any` is on the update only, and all three commands carry the same three `-o` options.
    4. The written source file names only the mirror of that try and keeps `Signed-By`.
    5. No file under the runner's `/etc/apt/sources.list.d` is changed.
    6. Three failed updates end with the message naming both mirrors.
  - **Evidence:** the mirror control on the throwaway pull request (AQP-216 AC-4, AC-7) shows try 1 ending at the update step in seconds, not after the download's 90 s.
- **Bounds and evidence (AQP-216 AC-3 to AC-8; DL-105; CR-49, CR-50; ruling 2026-11-06).**
  - **A healthy miss: stage 12a takes 90 s or less.** That is about 2 s for the dry run, 10 to 20 s for `apt-get update`, a few seconds for the download, 20 to 40 s for the offline install, and the copy (an estimate). **It assumes a browser-cache hit.** Raising `CACHE_EPOCH`, the way to force a miss on a throwaway pull request, changes only the `.deb` key. The browser key is the Playwright version, so a run with a browser miss as well is outside this figure.
  - **The fallback: 4 minutes or less, when the first mirror is unreachable or too slow.** A failed or timed-out `apt-get update` ends that try at once. **It assumes a healthy fallback mirror** (`archive.ubuntu.com`); if that mirror is slow too, the next bound applies.
  - **Three failed tries fail inside 8 minutes,** naming the mirrors: at most 45 s + 90 s per try, about 6.75 minutes, under the step's `timeout-minutes: 8`.
  - **Evidence (DL-105, DL-091).** On a throwaway pull request (closed unmerged) or by `workflow_dispatch`, never as temporary commits on the story branch: **(i)** a branch run saves under the key, then a second run hits it in every shard; **(ii)** a mirror control (an unreachable first mirror) stays within the bound and falls back or fails as designed. Stage 12a times for each go in the pull request. **The master-scope proof** (the first nightly warm-up after the merge saves the key, and the next pull request run restores it in every shard) is recorded by QA after the merge and **does not hold Done**. If it fails, QA raises a Sev-3 defect, fixed before G8, and RISK-023 is restated. A branch run cannot show master scope, because its cache is branch-scoped.
- **Estimate: 3 points for #93 and #99 together.** That covers:
  - the warm job;
  - #93's nightly step;
  - the script change and the parser test;
  - the workflow tests (`ci-workflow`, `nightly-workflow`);
  - evidence: a nightly or `workflow_dispatch` run on `master` that saves the key, then a pull request that hits it; and a negative control, never merged, with an unreachable first mirror, showing the fallback.

**Fits AQP-199's single job.** Every change is a step inside the one job named `Stages 1 to 11`, so the required check and branch protection do not change. **Estimate: 2 points.** That covers the steps and one small script (`scripts/ci/playwright-system-deps.sh`, a suggested name), the workflow test, and evidence: one miss run and two hit runs, with the times of steps 12a and 12. Expected on a hit: stage 12a in well under a minute (an estimate, not measured).

## 11. Coverage Targets

**Line gates.** Each target is checked once, at the stage named, against the lines named. The percentages are the coding standards' and NFR-025's; only where they are decided has changed.

| Scope | Target | Lines counted | Decided at | Source |
|-------|--------|---------------|------------|--------|
| Pure code: `src/lib/**`, `scripts/lib/**` | ≥ 80 % | Unit only | Stage 6, Vitest thresholds | Coding standards |
| `src/lib/formula/**` | ≥ 95 % | Unit only | Stage 6, Vitest thresholds | FR-022, NFR-025 |
| Quantity warnings: `src/lib/estimate/validation.ts` | ≥ 95 % | Unit only | Stage 6, Vitest thresholds | This strategy |
| `src/lib/estimate/figure-state.ts`, `src/lib/auth/password-rule.ts` | 100 % of branches | Unit only | Stage 6, Vitest thresholds | FR-098, 100, 101 |
| Whole package: the measured set below | ≥ 80 % | All Vitest levels together | Stage 11, Vitest thresholds | Coding standards |
| Changed code in a PR, lines of the measured set | ≥ 80 % | All Vitest levels together | Stage 11, `check-changed-coverage` | Coding standards |

The seed configuration is data with no lines to measure, so its 95 % target is dropped as a line gate. `quantity-in-one-formula` and `bl-is-sum-bg` hold it instead (section 5.4).

**How it is configured.** One `vitest.config.ts`. Its `thresholds` hold the global 80 % and one glob entry per row above, and the same numbers apply in both runs. Stage 6's narrower `include` makes the global 80 % mean pure code there and the whole package at stage 11. The glob entries can only rise at stage 11, because the same unit tests run again, so stage 6 is the run that decides them.

**The measured set.** `coverage.include`: `src/**/*.{ts,tsx}` and `scripts/lib/**/*.ts`. `coverage.exclude`, in full:

| Not measured | Why | What checks it instead |
|--------------|-----|------------------------|
| `src/app/**` | Thin route files with no logic (architecture section 10) | Role matrix, manifest completeness, E2E |
| `src/components/**`, including `ui` | Vitest runs in `node` with no component test library, so these files can only ever show 0 %. No business logic is allowed here (architecture section 10) | E2E, axe |
| `src/worker/main.ts` | A process entry point that starts cron. Job logic is in `src/server/jobs`, which is measured | Heartbeat in `/api/health`, image check |
| `src/generated/**`, `**/*.d.ts` | Generated code and types | Compiler |

**`src/server/**` is never excluded.** Adding to this table is a change to this strategy, made by the solution-architect. A helper with logic moves to `src/lib`, which is measured, and does not get an exclusion. `vitest.config.ts` and `check-changed-coverage` import one list, so they cannot drift.

**Code outside the test's own thread.** The v8 provider reads coverage through an inspector session in the Vitest worker, so code run by `new Worker()` or a child process is expected to show 0 %. The export thread's entry file therefore holds no logic, tests call the build functions in process, and the story that adds that file adds it to the table above.

**Limit.** A threshold glob that matches no file passes in silence: `src/lib/formula/**` passes today with no such file. A rename can therefore drop a gate with no error. The story that adds one of these paths shows it in the coverage output in its Dev Record, and a move of one is a review item.

**Evidence, 2026-11-02, real configuration at head 11c57e6.** Stage 6's command: 153 of 153 tests, 8 files measured, `src/instrumentation.ts` out of scope, lines 99.33 %, exit 0, 11.95 s of Vitest time. The same tests with invented local database URLs set, as at stage 11: all passed, exit 0, 13 s elapsed. Two test files named on one command give one report holding the hits of both. **Not run:** a real service file covered only by an integration test, and a real worker thread, because the throwaway project for them was refused by the session's permission system. The developer's proof covers the first.

**Other targets.**

| Scope | Target | Source |
|-------|--------|--------|
| Route manifest | 100 % of routes in the role matrix | NFR-001 |
| Engineer-reachable routes | 100 % in the canary scan | NFR-002 |
| SPEC §14 items | 14 of 14 automated, except the Excel-desktop open | GOAL-03, 04 |

## 12. SPEC §14 Acceptance Map

| Item | Covered by |
|------|------------|
| 1 Engineer sees no cost | Section 6 |
| 2 Outputs match to 2 decimals | One unit test per formula; `acceptanceTree`; section 5 for BL. O is checked against the guarded seed formula (A-21) |
| 3 Sl. No renumbers | Unit (`lib/estimate/tree`), E2E |
| 4 Calculate validation | Integration, E2E |
| 5 Hidden treatment lines | View test, export read-back |
| 6 Insert after AX | Integration, property test, export read-back (R2) |
| 7 Delete referenced field | Integration (R2) |
| 8 Revert | Integration, including approved estimate unchanged (R2) |
| 9 Step-up, invalid formula | Integration (R2) |
| 10 Master sync | Integration (R1+) |
| 11 E-mails | Controlled-clock tests (R2) |
| 12 Export | Read-back; manual Excel. Read with the D-16 exception: one total only, with the total Tool Cost in the footer row |
| 13 No horizontal scroll | Playwright |
| 14 One Admin | Integration; direct SQL |

**Acceptance test 2 and BL.** BL is checked as `SUM(BG)` over all rows, the worksheet's formula, at any quantity (SPEC §14.2). An item's own row with values is asserted through CE-2 and CE-12, and the BL story cannot pass G7 with any case pending (section 5.6). FR-056's fit is tested with the item quantity at 1 and 2 (CE-9 covers H = 0).

## 13. Change Log

| Version | Date | Change |
|---------|------|--------|
| 0.1 | 2026-11-01 | First draft for G3 |
| 0.2 | 2026-11-01 | UX reconciliation: tests for one route one schema, uniform not-found, typed values in the canary scan, Admin guards, system fields, open redirect, reset page, override rounding, renames after approval, undo of a revert, printed workings, sticky offsets and the ₹ glyph. PRD reference and FR-056 note updated |
| 0.3 | 2026-11-01 | SPEC v1.4 and PRD v0.6. Section 5 rewritten for every level's quantity: CE-1 is now 30 (24 lids), CE-6 246, CE-7 BN 6; CE-2 pending Q-35; CE-9 to CE-11 added; own-quantity-once test; property tests compare at 2 decimals; rule-change rehearsal retired. Added tests for cleared totals, the export markers and footer, optional reason, hidden entries, Scrap Weight, password rule, session, backup retention and watch, mail sign-in modes. Accessibility gate moves to WCAG 2.2 AA with PRD v0.6 |
| 0.24 | 2026-11-06 | Section 10.6 (QLT-95, master 11114): a dead mirror fails at `apt-get update`. `--error-on=any` is adopted only against an isolated apt view (a temporary sources directory with the one Ubuntu mirror being tried, `Signed-By` kept, a private lists directory), used by all three apt commands. Third-party sources are never read and the system sources are not edited. Six unit tests named |
| 0.23 | 2026-11-06 | Section 10.6 (CR-49, CR-50; AQP-216). A healthy miss in 90 s or less, assuming a browser-cache hit (`CACHE_EPOCH` forces only a `.deb` miss); the fallback in 4 minutes or less, assuming a healthy fallback mirror; three failed tries inside 8 minutes. Evidence per DL-105: a branch save then hit and a mirror control on a throwaway pull request; the master-scope proof recorded after the merge without holding Done |
| 0.22 | 2026-11-06 | Section 10.5 (AQP-74): `audit-production.spec.ts` at one width; six `audit.spec.ts` tests at one width, both "Show more entries" tests at three; a test counting `:visible` entries stays at one width only if its subject is a rule the representation does not change and the representations are covered at three widths elsewhere. Section 10.6 (AQP-216): a failed `apt-get update` ends the try at once; if the parser finds no command, fall back to the bounded AQP-206 path |
| 0.21 | 2026-11-06 | Section 10.6: follow-ups #93 and #99 (AQP-208 G6, master 11071). A nightly job on `master`, on the same runner label as CI, warms the stage 12a keys every branch can read; the Lighthouse job uses the same script and key formula on its own image. On a miss, the download is bounded with `timeout` on `apt-get install --download-only` (90 s; update 45 s), with up to three tries, the second and third on `archive.ubuntu.com`, then an offline install. One fix, 3 points |
| 0.20 | 2026-11-06 | Section 10.5: the one-width definition takes in a client rule with the same result at every width. `aqp-65-qa.spec.ts` joins the allow-list for one test, "[AQP-65 AC-1] edit with no change closes the dialog and sends no request"; the off-screen notice test stays at three widths (AQP-65 G7, master 11045) |
| 0.19 | 2026-11-05 | AQP-208 (CR-44 to CR-46). Section 10.3: a run is measured from its first job's start to the end of the job named `Stages 1 to 11`; the 9-minute line's lasting wording, as decided by master in DL-103. Section 10.5: the renamed job `Stages 1 to 11b` and the shards start together (no `needs`); the fan-in needs all and fails unless all succeeded; `setup` runs once per shard and the union check covers the width projects; three shards on the same pull request if its median misses 6:00, then BLOCKED; the next step after this one |
| 0.18 | 2026-11-05 | Section 10.5: AQP-199 result (job -12 %, stage 12 -20 %, CPU-bound at 4 workers; 3 workers not expected to do better). Order: AQP-199 merges as built with its targets restated, then the DEF-015 fix (the main p95 driver), then the shard step as its own story (3 points; two self-building shards; fan-in `Stages 1 to 11`). Estimated effects stated. `users-production.spec.ts` at one width and `users.spec.ts` split, for AQP-65 |
| 0.17 | 2026-11-05 | New section 10.6 (DEF-015, DL-100). The `.deb` system packages are cached by runner image and Playwright version and installed with `dpkg -i` on a hit. On a miss, apt is bounded (20 s timeout, 3 retries) and the step has `timeout-minutes: 8`. The browser cache is kept, keyed on the Playwright version, replacing the 2026-11-03 removal note. Stage 12a is split from stage 12. The container image and a timeout alone are rejected. One job, name unchanged; 2 points |
| 0.16 | 2026-11-05 | CR-43: section 10.3 quotes the AC-7 line exactly ("the shard step of test strategy 10.5"); the section 2 E2E row and the stage 12 row point to the `@one-width` exceptions of section 10.5. Section 10.3: the 9-minute line is written whenever the p95 is over 540 s, with no merge detection, and the step reports the oldest and newest runs it used (CR-42). Section 10.5: "focus order" defined; a programmatic focus move to one element reads no layout. New section 10.5 (AQP-199, DL-095, RISK-023). Stage 12 runs with 4 workers in CI, with dev-server routes warmed in set-up. Tests that read no layout are tagged `@one-width` and run in `desktop` only; the per-spec ruling covers four files, guarded by a unit test. One required job, name unchanged; section 10.3 unchanged. Shard jobs with a fan-in job named `Stages 1 to 11` are the next step if the p95 stays over 9 minutes |
| 0.15 | 2026-11-04 | Ruling on AQP-38 (PR #58; architecture v0.16). Section 10: the production check of `/design-system` moves to stage 12, `tests/e2e/production-routes.spec.ts`, with stage 9 kept for a wrong prerendered status or an unreadable build. That spec joins the canary and role-matrix tests as never quarantined |
| 0.14 | 2026-11-03 | Section 10: master's rule that tests do not depend on machine load (DL-057, GitHub #24): heavy set-up in its own hook, the hook timeout set once in `vitest.config.ts`, no wall-clock limit in a unit test, and CI as the reference run. Section 10.1: the not-found page is measured at an unused path, must answer 404 and is the row `not-found` (product-owner, AQP-169). Section 10.2: the path-limited `pull_request` trigger of `nightly.yml` (AQP-169 A-2). Section 10.4: the baseline at STORY-10.10's G7 (DL-058) |
| 0.13 | 2026-11-03 | PRD NFR-009 (AQP-1 comments 10712, 10713; GitHub #36; RISK-020). Section 8: the office Wi-Fi pass/fail profile, Slow 4G as report only, the median of 5 runs, and three NFR-009 rows. Section 2: the JS budget on every pull request. Section 10: step 11b (the JS budget), nightly and pre-release rows, and new sections 10.1 (JS budget check, with its calibration on `6f66b97`), 10.2 (the Lighthouse reference run: hardware, browser, settings, assertions, `benchmarkIndex`), 10.3 (CI feedback time, PROPOSED) and 10.4 (who builds it: proposed STORY-10.10, done before 02.01 reaches G6) |
| 0.12 | 2026-11-03 | SPEC v1.13, D-38 to D-40. Section 9, A-1 seed items: 15 rows with their units; `Plating-rate-per-sqin` referenced by no seed formula; the `{{mat:<key>}}` set checked. Section 6: the canary covers all 15 rates and Material-Scrap-Rate, and the forbidden list adds the two other `Material-*` operand names and `{{mat:`. No value recorded |
| 0.11 | 2026-11-02 | G6 of AQP-27, QLT-05. Stage 6 measures pure code on unit tests and keeps the 95 % and 100 % gates. Stage 11 runs every Vitest level with coverage in one run and decides the whole-package and changed-code gates. `src/server/**` stays measured. `src/components/**` and `src/worker/main.ts` join the exclusions, with what checks them. `tests/acceptance` joins stage 11. The seed configuration's line target goes, and `src/lib/estimate/validation` is named as `validation.ts` |
| 0.10 | 2026-11-02 | G4 attempt 1, remediations 5, 6, 8. Engineer on a Lead or Admin route: 403, not "403 or 404"; the cancel and remove row follows. `clear-copies.sh` and the seed items added to section 9 |
| 0.9 | 2026-11-02 | AQP-1 comments 10559, 10560. The Admin runs the restore rehearsal from the README alone. `restore.sh` failure paths and the limited account added. The export test also shows only the download is refused |
| 0.8 | 2026-11-02 | AQP-1 comments 10546 to 10554. Export refused at `none` as well. Tests added for cancel and remove, the rate notice, picture optional and the Last backup line. NFR-013: free-space check, a named restorer, and stated as holding on a healthy server only. Step-up: six actions |
| 0.7 | 2026-11-02 | The quantity rule (AQP-26), Q-35 (b) and Q-41. Section 5 rewritten: H is typed for the whole order, BL is `SUM(BG)`, and a parent shows only its own row. CE-1 typed 2, 6, 24 gives 30. CE-2 is their 840, with 316 on three levels and 660 as a mistyped count. CE-9: a 0 affects only its own row and every 0 warns, with one code. CE-11: a move leaves BL alone. CE-12 keeps 15, 5, 17 and 1000. The other cases are retyped as whole-order counts. The quantity-step tests, `own-quantity-once`, `no-rollup-of-rollup`, `export-reads-outputs`, `no-recursion` and the closed-form oracle are retired; `quantity-in-one-formula`, `bl-is-sum-bg` and `no-rolled-up-figure` are new. Section 5.6: the Q-39 controls go. Section 9 follows: no Σ figure or item total; for Q-37, every calculated value clears, the download is refused while cleared, and the approved price stays. Values re-run through a throwaway script on 2026-11-02 |
| 0.6 | 2026-11-02 | Q-38 "Yes" (AQP-15 comment 10527): CE-9 covers every 0, variants E and F now warn with `QTY_ZERO_NO_PARTS_BELOW`, variant G added, the open point removed. A top-level item's own 0 warns (A-27). **Correction to v0.5 (DL-024):** CE-2 no longer says "Confirmed by Q-35 (a)", and only CE-12 variants A, B and D carry their number. ASSUMPTION-51 is retired (D-21), so no case cites it. **Q-39 unresolved (660, then a count of 12 brackets; rupee total being confirmed):** the rule is frozen, and CE-1 and CE-2 are marked unconfirmed with 30 and 316 kept. Section 5.6: control 1 met for CE-12 only, control 1a for Q-39, a `basis` on CE-1 and CE-2, G7 refuses them while unconfirmed, and a list of the cases that hang on the same answer. Section 10 names STORY-10.01 (CR-11). Values re-run through a throwaway script on 2026-11-02 |
| 0.5 | 2026-11-01 | The delivery lead's answers. CE-9 rewritten for Warn (AQP-15 comment 10511), with six tree variants and levels for the acknowledgement, a stale acknowledgement, what is recorded and what the Lead sees; the DL-013 block is gone. Warning path added to the canary scan (section 6). Variants E and F pin a part with nothing below it, which stays unanswered. Q-35 (a) answered 1000 (AQP-14 comment 10510): ASSUMPTION-51 confirmed, CE-2 asserted at 316, CE-12 at 15, 5 and 17, with new variant D carrying their example at 1000. The other reading is now a named wrong answer. Section 5.6 control 1 met. Values re-run through a throwaway script on 2026-11-01 |
| 0.4 | 2026-11-01 | G3 condition 14. CE-12 added: a childless top-level item at quantity above 1. CE-9 rewritten for DL-013: never pending, block as fallback. CE-2 no longer `it.todo`; new section 5.6 and test `quantity-cases-complete` stop it, or CE-12, staying pending at G7. Tests added from the UX v0.3 reconciliation: single-piece product while cleared, Lead data by state, footer and notice row by number, reason in no cell, Specific Gravity on the server, sender refusal. PRD v0.7: temporary password, four step-up actions, sign-in `noindex`. BM added to the system fields |
