# Technical Test Strategy — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.31 (section 10.5, item 9: AQP-244's result. The measured per-shard reading governs AC-3 (c), and the modelled figure is reported, not judged. The cut is kept, shard-balance changes are judged on measured step times, and AC-3 (c) wording is proposed to the product-owner; listed in the change log). Earlier, 0.30 (section 10.5, item 9: AQP-244's stop-and-decide ruling. The cut is the own-width files listed in `desktop` only (about 12 s, public API, with a guard), and internal Playwright variables are refused. AC-3's lines become absolute ceilings, with AC wording proposed to the product-owner. The reading rule is the median of five full hit runs, and the fourth-shard gate and cost limit are set; listed in the change log). Earlier, 0.29 (section 10.5, G6 of AQP-243, DL-128: item 3, a run with a `miss` or `fallback` is replaced before it is read; item 7, the `node-modules-v<N>` format number and when N is raised, the AC-2 window named step by step without `Use the pinned npm`, `setup-node`'s `cache: npm` to be removed in a later story with its pass line, a bad entry deleted only with the delivery lead's approval, and the RISK-023 reading rule; listed in the change log). Earlier, 0.28 (section 10.5, item 7: the `node_modules` cache key adds the pinned npm version and hashes `package.json` and `.npmrc` with the lockfile, AQP-243 A-2; item 8: past per-test durations come from the `list` reporter lines in the job logs, because no JSON or blob report was kept, AQP-244 AC-1). Earlier, 0.27 (section 10.5, items 6 to 8: the RISK-023 trigger fired early at 7b1cf7f, median 5:53 (5:53, 4:53, 6:14; run 42733858791), with the per-job evidence: host speed outside the repository's control and shard 3 imbalance inside it; STORY-10.19 (AQP-243) confirmed at 3 points, with the `node_modules` cache, AC-2 defined, AC-4 corrected to a pooled median of 12 job runs plus no job worse, AC-3 (c) confirmed and a host line added to AC-5; STORY-10.20 (AQP-244) confirmed at 3 points, with 5:00 and 5:30 confirmed, the cut named conditionally and the 2.5 times guard restated as 1.30 times billed against the three-shard base). Earlier, 0.26 (section 10.5, corrections for G6 of AQP-227, DL-117 condition 7: the balance guard asserts `fullyParallel: true` and counts that differ by at most one, and the 10 % backstop is stated as not catching a per-file split; the AC-1 pin anchors the whole `strategy` block; the result of PR #124 with the slowest shard as the planning figure; headroom to the 5:30 trigger 53 s, about two stories; the fourth-shard figures, 15 to 25 s for about 22 % more runner time). Earlier, 0.25 (section 10.5: three shards for the enabler story, presumed STORY-10.17: the sharding rule, the guards, the measure (three full runs of the head, median at most 4:45), the runner-minutes guard with the 2.2 times estimate corrected, the next trigger and what follows; `@one-width` rulings on the canary scan (stays at three widths), three `process-master.spec.ts` tests and two `materials.spec.ts` tests; section 10: the G12 review rule, DL-114; DL-116, PRD v0.20 13.15, release plan v0.20 3.13). Earlier, 0.24 (section 10.6: `apt-get update --error-on=any` against an apt view holding only the Ubuntu mirror being tried, QLT-95). Earlier, 0.23 (section 10.6: the AQP-216 bounds, 90 s, 4 minutes and 8 minutes with their assumptions, and the DL-105 evidence rule; CR-49, CR-50). Earlier, 0.22 (section 10.5: the AQP-74 one-width ruling and the rule on counting `:visible` entries; section 10.6: a failed `apt-get update` skips its download, and a parser fallback, for AQP-216). Earlier, 0.21 (section 10.6: #93 and #99 as one fix, a master-side warm job on the CI runner label and a bounded download-only install with a mirror fallback). Earlier, 0.20 (section 10.5: `aqp-65-qa.spec.ts` joins the one-width allow-list for one test; the definition takes in a client rule with the same result at every width). Earlier, 0.19 (sections 10.3 and 10.5: the shard step's jobs, order, names and test split; the measure across jobs; a proposed lasting wording for the 9-minute line; what to do if the pull request misses 6:00; AQP-208, CR-44 to CR-46). Earlier, 0.18 (section 10.5: the AQP-199 result, three workers not better than four, the order DEF-015 first and then the shard step as its own story, and the one-width ruling for AQP-65's two specs). Earlier, 0.17 (section 10.6: browser system packages cached by runner image and Playwright version, a bounded download on a miss, the browser cache kept and re-keyed, stage 12a split out; DEF-015, DL-100). Earlier, 0.16 (section 10.5: stage 12 time, four CI workers and `@one-width` for tests that read no layout, AQP-199, DL-095). Earlier, 0.15 (the production check of `/design-system` moves to stage 12, `tests/e2e/production-routes.spec.ts`, and that spec is never quarantined, section 10; architecture v0.16). Earlier, 0.14 (master's rule on tests and machine load, DL-057, GitHub #24, section 10; the not-found row of the JS budget check, section 10.1; the path-limited pull-request trigger of the Lighthouse run, section 10.2, AQP-169 A-2. Earlier, 0.13: PRD NFR-009: the office Wi-Fi pass/fail profile, Slow 4G as report only, 200 KB gzip first-load JS per route, and CI feedback time, PROPOSED; AQP-1 comments 10712, 10713; GitHub #36; RISK-020; sections 2, 8 and 10. Earlier, 0.12: SPEC v1.13, D-38 to D-40: 15 seed Process Master items and the Material-Scrap-Rate name, sections 6 and 9; G6 of AQP-27, QLT-05: where the coverage gates sit, sections 10 and 11; CR-33, seed items, `clear-copies.sh`, AQP-1 comments 10546 to 10560, the quantity rule, Q-35 (b), Q-41, Q-37) |
| Owner | solution-architect |
| Status | Accepted at G3 as CONDITIONAL GO. Version 0.7 replaces the every-level rule and the parent figures on the delivery lead's answers (AQP-26 comment 10537; AQP-1 comment 10542; AQP-15 comment 10543), which changes what G3 accepted. Versions 0.8 and 0.9 add the tests for their later answers. For `master` to record and check at G4 |
| Date | 2026-11-10 |
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

**An assertion removed or weakened in the scan or the security tests (the G12 review rule; master, AQP-57 G7, DL-114).** The quarantine gate (`tests/unit/canary-scan-gate.test.ts`) catches a test that is skipped, narrowed or dropped from the list. It cannot see an assertion taken out of a test that has several, or one made weaker. No static gate can, so this is a stated limit with a review rule, in the pattern of DL-107.
- **Scope:** `tests/e2e/canary-scan.spec.ts` (the scan spec), `tests/e2e/support/canary-scan.ts` (the scan helper), `tests/unit/canary-scan-gate.test.ts` (the scan gate test) and every file under `tests/security/**`.
- **What counts as weakening:** removing an `expect`; widening a matcher (for example `toEqual` to `toContain`, an exact count to "at least"); lowering a count or a minimum the scan must see; dropping an entry from the forbidden list, a route from a recipe or a width from the scan; adding an exemption; or tagging any of these tests `@one-width`.
- **The rule.** A pull request that does any of this says so in its body, naming each assertion and the reason. At G6, reviewer-quality shows with a planted fault that the behaviour the assertion guarded still makes a test fail, and records the plant and the failing test in the review.
- **An unstated removal or weakening is a Major at G6.** A stated one without the planted-fault proof is not reviewed as complete.
- Moving an assertion to another test or file, unchanged, is not a weakening, but the body still says where it went, so reviewer-quality can check it.

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

### 10.5 Stage 12 time (AQP-199, STORY-10.14; DL-095; RISK-023; ruling 2026-11-05; three shards, DL-116, ruling 2026-11-08; corrected for DL-117, 2026-11-09; trigger fired and two enablers, v0.27, 2026-11-09)

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
| `canary-scan.spec.ts` (AQP-57 PRF-06; AQP-122; ruling 2026-11-08) | **Three widths, whole file, no tag.** Eight tests at b02955b (six when PRF-06 was raised) | **The open question was whether one width still sees every response once browser-fetched bodies are recorded. The answer is no, not as a guarantee.** The server gives the same answer at every width: no code in `src` branches on viewport or user agent (PRF-06). But the scan also records every response the browser itself fetches, and that set depends on client code at each width. Today `nav.tsx` uses `next/link`, which prefetches a link when it enters the viewport, so the desktop side menu prefetches routes that the phone's closed drawer does not. `app-shell.tsx` loads the drawer on first open, and #121 will load each masters tab panel and its data on first activation. Desktop probably sees a superset today, but nothing in the gate would notice the day a phone-only variant fetches something desktop does not. The browser recording is the net for calls the manifest recipes miss, so it is exactly the part that becomes width-dependent. The gain is small: about 16 runs and roughly 30 s of worker time, about 2 to 4 s of path at three shards (estimate from PRF-06 round 2). That does not buy a gap in the confidentiality gate. `canary-scan-gate.test.ts` keeps its three-width assertion. Revisit only if the scan exceeds 10 % of E2E worker time. The proposal would then keep the Engineer journey at three widths and move only tests that use `request` with no page (the AC-5 403s, the absent test-only route), under the review rule of section 10 |
| `process-master.spec.ts` (AQP-113 PRF-02; ruling 2026-11-08) | One width: "adds a rate, shows it in the list with the saved notice, and refuses a second one that differs only in letter case or reads as a column letter"; "changes the name and the default value; the saved notice names the new name; an edit that changes nothing closes without a request"; "filters by name ignoring letter case, says "No rate matches" with Clear filters, and Clear filters brings the list back and focuses the search". **Three widths:** every other test in the file (the list with scroll and axe, 44 px, the keyboard dialog, the empty form, both delete tests, both "deleted elsewhere" tests, the skeleton, "No rates yet", the error state) | Server rules (a name in any letter case, a column letter), message text and a client rule with the same result at every width (no request sent), as for the AQP-65 rulings. Each uses `[data-item-id]:visible`, but its subject is a result that the table and the cards do not change (one row for the name, the filter's result). The representations are covered at three widths by "the list…" and the 44 px test, which meets the AQP-74 condition. The search box is one component at every width (`master-search-box.tsx`), so the focus check names one element. The Edit dialog's presentation is covered at three widths by the "deleted elsewhere" Edit test, and the Add dialog's by the keyboard test |
| `materials.spec.ts` (AQP-122 PRF-03; ruling 2026-11-08) | One width: "an edit that changes nothing closes without a request" and "filters by Material in Drawing or Material Considered ignoring letter case, says "No material matches" with Clear filters, and Clear filters brings the list back and focuses the search". **Three widths:** every other test, including "state "Duplicate name"…" | The no-change edit is the AQP-65 client rule. The filter test is the same shape as the process-master filter test above; nobody proposed it, but it is ruled now so that the pin list changes once. "Duplicate name" stays because it runs axe on the error state, which is judged at every width. The representations are covered at three widths by "AC-1, AC-7: a tab bar…" and the 44 px test, and the Edit dialog's presentation by the keyboard Edit test |

**Where these rulings are applied (2026-11-08).** The five new tests are tagged in **one test-only commit**, not in the three-shard story: its AC keeps the pins unchanged, and its measurement must not move with them. The commit changes three things together:
- the tags;
- `tests/unit/one-width-tag.test.ts`, which goes from 47 to 52 tests and from nine to eleven files, with the titles copied exactly;
- the header comments of both specs, so they point here (AQP-113 STD-10).

It goes in the next pull request that touches either spec after the three-shard story merges (AQP-123 expected; the scrum-master names it in that story's Dev Context). That PR's G6 path figure states that the commit is in it. The saving is about 2 to 3 s of path at three shards (estimate). It is taken because it costs nothing, not as an answer to CI time.

**Guard against silent loss.** A unit test fails if `@one-width` appears in any file outside those named above (four from AQP-199, the two `users` specs that AQP-65 adds to its allow-list, and `aqp-65-qa.spec.ts` for its one ruled test, the two AQP-74 `audit` specs, and, once the commit above lands, `process-master.spec.ts` and `materials.spec.ts`; never `canary-scan.spec.ts`). Tagging a test in another file needs a ruling here first. AQP-199's pull request lists the tests before and after by spec and project, from `npx playwright test --list`.

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
- **A third shard:** brings it back under 5:00, at about 2.2 times today's minutes. That is above AC-6's 2x guard, so it is the product-manager's call. **Corrected in v0.25** (see "Three shards" below): about 1.6 times raw and 1.9 times billed, from measured figures.
- **DEF-015 alone:** should bring the p95 down to about the slowest test-time runs, around 7 to 8 minutes.

**The shard step (AQP-208, STORY-10.15; ruling 2026-11-05, CR-44 to CR-46).**
- **Jobs and names.** The existing job is renamed `Stages 1 to 11b` and runs stages 1 to 11b as today. The shard jobs are one matrix job named `Stage 12: E2E (shard <i> of <N>)`. **There is no `needs` between the renamed job and the shards: they start together.** Each shard installs, builds with `next build`, migrates its own throwaway database, installs the browser and its system packages (section 10.6), and runs `npx playwright test --shard=<i>/<N>` with 4 workers. N is one constant, 2 to start. A final job **named `Stages 1 to 11`** has `needs` on the renamed job and every shard, runs with `if: always()`, and fails unless every needed job's result is `success`, so a failed, cancelled or skipped job fails it. The required check keeps its name, and the delivery lead changes no setting. Running the shards after the first job instead would put stages 1 to 11b and a shard in series, about 7:17 against today's 6:51 (product-owner's arithmetic), so they run alongside.
- **What runs where.** With `fullyParallel: true`, `--shard` divides the tests themselves, not the files. Project dependencies run in every shard that needs them, so the `setup` project runs **once per shard**, against that shard's own database. The union of the shards' lists of `mobile`, `tablet` and `desktop` tests equals the single-job list, with no test missing and none in two shards. `setup` is counted per shard and is outside that comparison.
- **If the pull request misses 6:00.** If the median required path of the head and its two re-runs is over 6:00 (AQP-208 AC-2), the developer sets N to 3 on the same pull request and measures the head again, plus two re-runs. The resource guard is then 2.5 times. If three shards also miss, the developer reports BLOCKED with the figures per job to the solution-architect, who reports to the product-manager. No test is dropped or moved to one width, and no timeout is widened.
- **The next step after this one** (named by the 9-minute line of section 10.3): three shards, pre-authorised by the product-manager (AQP-208 AC-1), as a one-line change of N. Beyond three shards the solution-architect proposes again. *Superseded on 2026-11-08 by "Three shards" below: N = 3 is taken now as its own story, and the next step after it is named there.*

**Three shards (the enabler story, presumed STORY-10.17, EPIC-10; DL-116; PRD v0.20 13.15; release plan v0.20 3.13; ruling 2026-11-08).**

*Why now.* The head `b02955b` of PR #120 ran 5:57, 6:17 and 5:05 on unchanged code. The margin to the 6:00 warning is therefore inside the spread between runs. Path also grows by about 33 s per story, because at two shards no slack is left (performance.md for AQP-122, PRF-02 and PRF-08). No NFR-009 limit is breached: the last 20 runs give a median of 5:13 and a p95 of 6:33. The runner cost is pre-authorised (AQP-208 AC-1). **Points: 2, confirmed.** AQP-208 built the constant, the matrix and the fan-in, so this story is the constant, two guard edits, the measure and the controls.

**1. The sharding rule.**
- **N = 3**, set in one place: `matrix.shard: [1, 2, 3]` in `ci.yml`, with nothing else in the job's `strategy` block but `fail-fast: false` (no `include`, `exclude` or `max-parallel`; DL-117). The command reads N from `strategy.job-total`, so nothing else changes. `fail-fast` stays off. Each shard still builds for itself, migrates its own throwaway database, runs stage 12a and uses 4 workers. The fan-in job keeps the name `Stages 1 to 11` and stays the only job with `needs`. The `ci.yml` comments that say "two" are updated.
- **How shards are assigned:** by Playwright's own `--shard=<i>/3`, unchanged. With `fullyParallel: true` it divides the listed `mobile`, `tablet` and `desktop` tests into three contiguous groups of near-equal count, in list order. `setup` runs in every shard as a dependency, against that shard's own database. In practice shard 1 is mostly `mobile`, shard 2 `tablet` and shard 3 `desktop`, which also holds the `@one-width` tests.
- **No custom split and no duration weighting** (#116, AQP-57 PRF-02): the gain is about 15 s (estimate), for a script someone would have to maintain. Shard 1 ran about 40 s longer at two shards, and the path target below takes that in. **Confirmed on PR #124 (AQP-227 PRF-02):** replaying five runs with every shard's test step set to the run's mean gains 17.5 s at best, about 10 to 12 s in practice, because `Stages 1 to 11b` caps it. A project-aware split is today's split. Revisit only if, after the set-up cut, the slowest shard ends more than 45 s after `Stages 1 to 11b` in a median of three. *Corrected in v0.30 (item 9): the split balances listed tests, not tests that run, and this revisit line is superseded by the shard excess over the mean, read on hit runs.*
- **Not in this story:** a shard change inside a feature PR. The earlier trigger proposed for DL-115 ruling 6 (a first attempt of 5:45 or more sets N = 3 in that PR) is met by this story and is withdrawn (DL-116: a CI change in a feature PR distorts its measures). Also out: any `@one-width` tag or pin change, any test dropped or moved to one width, and any timeout widened.

**2. The guards.**

| Guard | Change |
|-------|--------|
| `tests/unit/e2e-shards.test.ts` | **No existing assertion changes.** It reads N from the matrix, so it lists three shards and checks three things: the union of the width lists equals the whole list, none is in two shards, and `setup` is the same in each. **Add three assertions (AC-2; DL-117 (1); corrected in v0.26).** **The cause:** `playwright.config.ts` sets `fullyParallel: true`, read in this file (`one-width-tag.test.ts` is not touched). **The effect:** the shards' width-test counts differ by at most one (156 / 156 / 155 at the head of PR #124). A per-file split, made by switching `fullyParallel` off, gives 163 / 156 / 148 and fails it. A looser bound is acceptable only if it still fails that plant. If a later change, such as a serial group, makes the counts differ by more than one, the bound is not widened without a ruling here. **The backstop, as AC-2 asks:** each count is within 10 % of the mean over the shards. It catches a gross imbalance only, such as one large serial group. **It does not catch a per-file split on this suite:** 163 / 156 / 148 is 4.9 % from the mean and passes (the developer's measure, reproduced by reviewer-quality and by master). v0.25 said it did, which was wrong. It also counts listed tests, not executed ones: 157 / 157 / 141 passed at the head, because shard 3 holds 17 skipped tests. The test comments say what each assertion catches |
| `tests/unit/ci-workflow.test.ts`, the AC-1 test | From "two to start, three at most" to **exactly `[1, 2, 3]`**, **with the whole `strategy` block of the `e2e` job anchored** (DL-117 (2); added in v0.26): the test fails if `include`, `exclude` or `max-parallel` appears anywhere in that block. Without the anchor, `exclude: - shard: 3` ran two shards and `include: - shard: 4` added a fourth, with every guard test green (QLT-02). A silent return to two, or a silent fourth shard, then fails, and a fourth shard needs this section first. The assertions that no literal N appears in `--shard` or `SHARD_TOTAL` stay as they are |
| `tests/unit/ci-fan-in.test.ts` | **No change.** The matrix is one needed job: `needs.e2e.result` is `success` only when every shard succeeded, so the script still has two results. The proof at three shards is the live controls below |
| `scripts/lib/ci-feedback-time.ts` and its tests | **No change.** The measure takes the earliest job start of an attempt, whatever the number of jobs |
| `canary-scan-gate.test.ts`, `one-width-tag.test.ts` | Not touched. The scan stays in every shard's list at three widths |
| Branch protection | Read back with `gh api`, read-only: the required checks are exactly `Stages 1 to 11`. Shard job names change from "of 2" to "of 3", so a shard job required by name would hold every PR. Agents change no setting |

**Live controls** run on a throwaway pull request, closed unmerged, never as temporary commits on the story branch (DL-091, DL-105). They are the AQP-208 AC-4 controls with the fault placed in shard 3: a test that fails only in shard 3, and shard 3 cancelled while it runs. Each must turn the fan-in red, naming the job and the result.

**3. The measure.**
- **Span:** as in section 10.3. A run is timed from the start of the first job of the attempt to the end of `Stages 1 to 11` in that attempt, with queue wait excluded.
- **Samples: three full runs of the head commit.** That is attempt 1 of the push plus two "Re-run all jobs" attempts: master's "head plus two re-runs" (#116) and the AQP-208 method. "First-attempt runs" in PRD 13.15 item 6(b) is read this way, because one head cannot have three first attempts without extra commits. A "Re-run failed jobs" attempt is not a sample. The nightly of section 10.3 keeps counting first attempts only, over the same span.
- **Cache state:** stage 12a hit or miss is reported per shard. A run with a miss in any shard is reported and replaced by one more full re-run, at most twice. A miss is bounded by section 10.6, not by this story. **The same applies to the `node_modules` cache from AQP-243 on (DL-128 (4); v0.29):** a run whose summary or install steps show `miss` or `fallback` in any job is replaced by one more full re-run before it is read, for every reading against 5:30 (item 5's pull-request and fall-back readings, and DL-123 (d)'s first-attempt rule). See item 7.
- **Target: yes, the median of the three is at most 4:45, as the product-manager proposed.** Expected 4:05 to 4:30 (estimate): 6.5 to 7.4 minutes of test time over three shards, plus 1:45 of set-up and about 10 s of teardown. The first job, at 2:47 to 3:43, does not bind. The PR also gives the spread, the E2E instance count, each job's time and each job's queue wait.
- **Result (PR #124, AQP-227; added in v0.26).** Median **4:37** of 4:37, 4:26 and 4:39, so the target is met with 8 s to spare. The estimate described the average shard, and held (3:54 measured). The path is the **slowest** shard (mean 4:26 over five runs) plus about 7 s of start offset and fan-in. **Planning figures from here use the slowest shard, not the average.** `Stages 1 to 11b` took 2:47 to 4:08 (median 4:00 over five runs), so it no longer has the slack stated above. At N = 3 the path is steadier, not much shorter: a standard deviation of about 10 s against about 79 s at N = 2, over short windows. The base was too noisy to credit a 59 s saving (mean gain 46 s, AQP-227 PRF-05).
- **Base:** the same measure on the base commit at N = 2, using its `master` push run plus two full re-runs, or a first PR commit that changes nothing in the workflow. If a test-adding PR merges in between, both are measured again (the AQP-208 rule).
- **Flaky:** 0 flaky tests in five full runs of the head (the three samples plus two more), as Playwright reports them.
- **Balance:** the three new unit assertions of item 2 are pass or fail (`fullyParallel: true`, counts that differ by at most one, and the 10 % backstop). The time spread between shards is reported per shard and per project, and is not a pass line: the 4:45 median already prices an imbalance. A spread over 45 s with the median met is input to the next trigger. This changes PRD 13.15 item 6(d).
- **If the median misses 4:45:** the developer reports BLOCKED with the per-job figures to the solution-architect, who reports to the product-manager. No fourth shard is added in this story.

**4. The cost guard, with the 2.2 times estimate corrected.**
- **Correction.** The v0.18 figure of about 2.2 times assumed 2.5 minutes of set-up per shard and my 1.7 times for two shards. Measured set-up is 1:43 to 1:45 per shard. AQP-208 measured two shards at 1.36 times raw and 1.56 times billed against the one-job layout. reviewer-performance measured three shards at +15 % raw against two (14:05 to about 16:08) and +19 % billed (16 to 19 minutes; run 42506525720). **Three shards are therefore about 1.6 times raw and 1.9 times billed against the one-job figure (1.36 × 1.15; 1.56 × 1.19; estimate).** That is under the 2.5 times guard and under the original 2 times as well. The product-manager's "about 2.0" rested on my 1.7 and is replaced by these figures.
- **How the PR shows it.** The one-job layout no longer exists, so the guard is measured against the two-shard base. **The billed minutes of the head (median of the three) are at most 1.60 times the base's**, with raw minutes shown too. With AQP-208's measured 1.56 billed, that keeps three shards within 2.5 times the one-job figure (1.56 × 1.60 = 2.5). Expected about 1.19. The chain assumes the two-shard ratio has not grown since AQP-208. That is a conservative reading, since the fixed set-up becomes a smaller share as the tests grow.

**5. The next trigger, and what follows three shards.**
- **The trigger.** reviewer-performance applies it at each G6:
  - **Pull request:** a story's first-attempt path is 5:30 or more. The orchestrator re-runs the head twice (full re-runs), and if the median of the three is 5:30 or more, the next step is due. *Superseded in v0.30 (item 9, AC-5 of AQP-244): four full re-runs, and the median of five decides.*
  - **Nightly:** the median of the last 20 is over 5:30, read from the section 10.3 report. This is a reading rule; the nightly code does not change.
  - **When due:** the next step is its own EPIC-10 enabler story, through the DL-084 and DL-116 route, placed by the product-manager. No hold: 6:00 stays a warning (DL-102, DL-103).
- **Why 5:30.** Unchanged code varies by about 30 s, and at three shards a story that adds 45 E2E instances costs about 21 s (the product-manager's 0.47 s per instance). A line at 5:30 leaves about one standard deviation plus one story before 6:00, which is enough to build a 2-point enabler while one more story runs. DL-116's lesson is that a margin of 3 s is already inside the spread.
- **Headroom, corrected in v0.26 (AQP-227 PRF-01; DL-117).** v0.25 said that from about 4:15 the line was three to four such stories away. Measured, the median path is **4:37**, so the headroom to the 5:30 trigger (RISK-023) is **53 s**, or 46 s from the worst of five runs (4:44). That is **about two stories** of the size ahead, at about 21 s each (estimate). reviewer-performance's ledger, at 0.47 s of path per added instance (estimate): AQP-123 (02.04) lands at about 4:48 to 4:56, AQP-130 (02.05) at about 5:04 to 5:17, and AQP-142 (02.02) at about 5:32 to 5:59. **The trigger is therefore expected at or after AQP-142.** *Overtaken in v0.27: it fired at 7b1cf7f, before STORY-02.04 (AQP-123) merged; see item 6.* At half that slope the three stories end at about 5:03 to 5:17. One slow cache restore on a hit adds 40 to 47 s to a single run; the median of three absorbs it. AQP-123's G6 is measured against a fresh N = 3 base, not this 4:37 (DL-117 (8)).
- **What follows, in this order.**
  1. **Cut the set-up per shard.** The 1:45 is paid once on the path and N times in runner minutes. The story first times each set-up step from the job logs (install, build, roles and migrations, stage 12a), then cuts the largest; a cache of `node_modules` keyed on the lockfile is the first candidate (AQP-57). A 30 s cut takes 30 s off the path and 1:30 off runner time at three shards. Passing a build artefact between jobs stays rejected, because it puts the build in series. **Measured at N = 3 (PR #124, AQP-227 PRF-03):** `npm ci` plus `prisma generate` take 38 to 66 s in each of the four jobs, about a quarter of raw runner time. This is the only step that shortens `Stages 1 to 11b` and every shard at once. Halving the install is worth about 20 to 30 s of path and 1.5 to 2 runner minutes per run (estimate). The story first times `npm ci` against a restored `node_modules`. `npm ci` deletes `node_modules`, so a restore must replace the install step, not precede it. The same story adds to the job summary the slowest shard, its set-up and test split, and the gap to `Stages 1 to 11b` (PRF-04), so the trigger can be read without pulling the jobs by hand. It is Ready before AQP-142 starts (DL-117 (8)).
  2. **A fourth shard,** only if step 1 does not bring the median of three under 5:00 (*gate and cost limit restated in v0.30, item 9: a median of five on a `master` head and the next nightly median both over 5:00, and at most 1.30 times the base's minutes*). **Figures corrected in v0.26 (AQP-227 PRF-03; DL-117).** v0.25 estimated a shard of about 3:46 against a first job of 2:47 to 3:43, so a gain of 40 s at most. Measured at N = 3, `Stages 1 to 11b` takes 2:47 to 4:08 (median 4:00 over five runs) and ends within 7 to 36 s of the slowest shard in four of five, so it nearly binds already. The test step fits `f + W/N`, with `f` about 68 s per shard (the `setup` project, route warm-ups and the server, repeated in every shard) and `W` about 188 s of shared work: a mean of 162 s at N = 2 and 130 s at N = 3 (measured), about 115 s at N = 4 (estimate). **A fourth shard would save about 15 to 25 s of path, for about 22 % more runner time (3 to 4 runner minutes per run; estimate).** That is less than step 1 gives, at a higher cost. It needs a new guard figure here first, and the `ci-workflow` pin changes with it. **Beyond four shards, nothing:** `Stages 1 to 11b` binds, and the work moves to step 3.
  3. **The cost per test**, as standing practice reviewed at each G6 and not as a story. New specs plan the one-width split from the start, as in the rulings above. They make data through the API wherever the screen is not the subject.
- **Queue wait (the product-manager's question in 3.13).** At N = 3 a run holds four jobs at once (`Stages 1 to 11b` and three shards), then the fan-in. At N = 4 it would hold five. GitHub-hosted runners on the Free plan allow 20 concurrent jobs per account (documentation-based and not checked on this account, as for A-3), so about five runs can be under way before a job waits. Queue wait is excluded from the NFR-009 measure but is a real wait for the delivery lead. This PR records each job's queue wait. If a wait over 60 s appears in more than one of the five runs, the developer reports it. The cause of the 3,702 s run (42463553178) is not established.

**6. The trigger fired early (recorded in v0.27, 2026-11-09; AQP-1 comment 11259; DL-123 (d); PRD v0.21 13.16; release plan v0.21 3.14).**
- **The reading.** Head 7b1cf7f (PR #139, tech-debt #130, which added no E2E test), run 42733858791, three full attempts: **5:53, 4:53 and 6:14, median 5:53**, a spread of 81 s. That is over the 5:30 trigger, so the next step is due. Item 5 expected the trigger at or after AQP-142 (5:32 to 5:59). It fired before STORY-02.04 (AQP-123) and STORY-02.05 (AQP-130), the two stories the ledger placed ahead of AQP-142. Since the 4:37 base of PR #124, the E2E-adding merges were #120 (AQP-122, Material Master) and #135 (AQP-234 and AQP-235, with QA's 30 tests). No NFR-009 limit is breached, and 6:00 stays a warning.
- **What the run shows (read-only, `gh api …/attempts/<n>/jobs` and the job logs; the evidence for STORY-10.20 AC-1 to confirm, not to replace).**

| Attempt | Path | `Stages 1 to 11b` | Shard 1 | Shard 2 | Shard 3 | Shard 3 end after 11b | Shard 3 test step against the shard mean |
|---|---|---|---|---|---|---|---|
| 1 | 5:53 | 4:24 | 3:44 | 5:23 | 5:46 | 82 s | +45 s (232 s) |
| 2 | 4:53 | 3:44 | 3:39 | 3:38 | 4:48 | 64 s | +35 s (182 s) |
| 3 | 6:14 | 2:55 | 5:13 | 5:07 | 6:08 | 194 s | +29 s (234 s) |

  - **Host speed, outside the repository's control.** All sampled jobs ran the same image (`ubuntu-26.04`, version 20261101.186.1) with the same 1,242 packages. `npm ci` plus `prisma generate` still took 41 to 74 s, and `prisma generate` itself took 37 to 73 ms, in two clusters. Jobs in the fast cluster (37 to 46 ms) ran the same shard's tests 30 to 50 % faster than jobs in the slow cluster (69 to 73 ms): shard 1 128 against 196 s, shard 2 132 against 199 s, shard 3 182 against 232 to 234 s. Attempt 2 drew fast hosts for every shard, and that explains most of its 4:53.
  - **Shard imbalance, inside the repository's control.** Shard 3 (mostly `desktop`, which also holds the `@one-width` tests) ended last in all three attempts, 22 to 69 s after the next shard. Its test step was 29 to 45 s above the mean of the three shards in the same attempt. `Stages 1 to 11b` no longer caps the path at this head: shard 3 ended 64 to 194 s after it (median 82 s). That is over the 45 s line at which item 1 said a time-aware split would be revisited. On PR #124 the gain from balancing was 10 to 12 s, because the first job capped it. The same figure is now about 30 to 45 s (estimate from this run).
  - **Set-up before the first test step** (s, three attempts): `Stages 1 to 11b` 94, 86, 64; shard 1 89, 87, 113; shard 2 119, 82, 116; shard 3 111, 102, 128. Per-job medians: 86, 89, 116 and 111. The 1:45 per shard in item 5 is a mid value. Host speed moves one job's set-up by up to 37 s on the same commit.
- **RISK-023:** master re-scores it. The likelihood is no longer "expected at or after AQP-142". It has happened, and a single reading of three runs is partly a draw of hosts.

**7. STORY-10.19 (AQP-243): the set-up cut, confirmed (v0.27).**
- **Points: 3, confirmed.** The work covers the cache in two job definitions, the integrity fallback, the summary script with unit tests, two live controls, and the base and head measurements.
- **Mechanism (the architect's; the developer may propose a better one in AC-1 with figures).** Cache `node_modules` with `actions/cache/restore` and `actions/cache/save`, split so that the steps are explicit. **Key** (completed in v0.28, AQP-243 A-2): runner OS, architecture, `ImageOS`, Node version, the pinned npm version (`env.NPM_VERSION`) and `hashFiles('package-lock.json', 'package.json', '.npmrc')`. The npm version is in the key because npm 11.17 enforces the install-script allow-list, so a bump can change what `npm ci` builds; it costs one miss per bump. `package.json` and `.npmrc` are hashed because that allow-list (`allowScripts`, `strict-allow-scripts`) lives there and not in the lockfile: an approval or a revocation with no lockfile change must never restore a `node_modules` built under the old list. It costs a miss on the first run after any `package.json` edit. **No `restore-keys`**: only an exact match restores, so a changed lockfile is always a miss and installs exactly that lockfile (AC-3 (a) holds by construction, and the live control proves it). **On a miss:** `npm ci`, then save only if `npm ci` succeeded. Four jobs may race to save one key; a lost race is a warning in the log, never a failure. **On a hit:** no `npm ci`. An integrity check of at most 5 s, which the developer chooses and shows failing on the AC-3 (b) plant, must fail on a missing or truncated package. If it fails, the job deletes `node_modules` and runs `npm ci` with no save, and the summary marks the job as fallback. `prisma generate` still runs every time, because it writes to `src/generated`, outside `node_modules`. `setup-node`'s `cache: npm` stays in this story (*overtaken in v0.29: it is removed by a later story; see "AC-8 record", PRF-04*). Keys are immutable, so a corrupt entry falls back on every run until it is evicted or deleted. The summary makes that visible, and the orchestrator lists the key for the delivery lead (*corrected in v0.29: deleting a cache entry is irreversible, so it happens only on the delivery lead's explicit approval, DL-128 (5); raising N starts a new key without deleting anything*).
- **AC-2, confirmed with a definition.** "Install plus generate" means every step from the end of `Set up Node.js` to the start of the build: the restore, the integrity check, any `npm ci`, any save, and `prisma generate`. On a hit, its median in each of the four jobs is at most 50 % of that job's base median (per-job base medians from run 42733858791: 58, 46, 69 and 72 s). Expected about 10 to 20 s (estimate), about 25 % of base. That margin is wider than host noise, so the line stays per job.
- **AC-4, corrected.** "Set-up median at least 20 s lower **in each of the four jobs**" would pass or fail by host draw. A median of three per job moves by up to about 20 s on unchanged code (shard 2's set-up: 82 to 119 s). **Pass line:** the median set-up over the 12 job runs of the head (4 jobs times 3 runs) is at least 20 s lower than the same median over the base's 12, **and** every job's median is lower than its base median, by any amount. The path is reported, with the expected saving (20 to 30 s, estimate, unchanged) stated before the measure. A head path median more than 30 s above the base still goes to the architect.
- **AC-3 (c), confirmed (documentation-based).** GitHub scopes caches by ref. A run restores caches from its own ref, from the base branch of its pull request, and from the default branch. A `master` push run restores only caches written on `master`, and a cache written on `refs/pull/<n>/merge` is visible only to that pull request. A PR-written cache therefore cannot reach a `master` or release build. A fork's pull request is scoped the same way. The live controls do not need to prove this. The PR quotes the documentation page and its date.
- **AC-5, an addition for the scrum-master to place.** Each job writes one line to its own job summary: `nproc` and the CPU model from `/proc/cpuinfo`. The run summary does not have to collect it, because the API does not expose it. Without it, the host-speed cause in item 6 can only be inferred from `prisma generate` times. It needs no permission.
- **AC-5 mechanics.** The summary step runs in the fan-in job with `if: always()` and `actions: read` at job level only. The verdict step still decides the job's result. The script exits 0 on any API or data problem and prints "n/a". The fan-in job cannot read its own end, so "path" in the summary is up to the summary's own time, which runs a few seconds short. The summary says so.
- **AC-8, after the merge:** this section records the result and whether a fourth shard is still due (item 5 (2)).
- **AC-8 record, part 1: the G6 rulings (v0.29, 2026-11-10; DL-128 (7); PR #152 at c24fe22).** Written before the merge so that AQP-244 starts from them. Part 2 (the measured result on `master` and the fourth-shard question) follows the merge, before AQP-244's G6.
  - **The key's format number (STD-07 = QLT-05; accepted by master).** The key as built is `node-modules-v<N>-<runner OS>-<arch>-<ImageOS>-node<NODE_VERSION>-npm<NPM_VERSION>-<hash of package-lock.json, package.json, .npmrc>`, with N = 1 today. N is the format of the integrity record `node_modules/.ci-integrity`, which `scripts/ci/node-modules-integrity.sh record` writes inside the entry (a file count and one SHA-256 over the sorted list of every file and link with its size). **N is raised** (a) with any change to what `record` writes, or to how `check` compares, such that an entry written before the change would fail the new check (for example a new field, another hash, a changed listing rule or excluded path, or a renamed record file); (b) to start a new key when an entry is bad and is not deleted. **N is not raised** for a comment edit, or for a change that old records still pass (for example the 5 s limit). **If someone forgets,** it fails safe: every hit fails its check and falls back to a clean `npm ci` with no save, so the cost is time, never a stale install, and the summary shows `fallback` in every job. Each raise costs one miss per ref, which item 3's rule replaces before reading. N is written once in `ci.yml` (DL-128 (2), STD-05: one `env` entry; the resolved key string stays byte-identical) and the guard `ci-setup-cut.test.ts` pins it; a raise changes the pin in the same PR. Rejected: hashing the script into the key, which would miss after any edit, comments included.
  - **The AC-2 window (QLT-06): the definition changes to match what was measured; no pass line or code changes.** v0.27 said "every step from the end of `Set up Node.js` to the start of the build". That takes in `Use the pinned npm`, which the cut does not touch. The window is now named by its steps: in `verify` the `Stage 1: install, …` steps, and in each shard the `Shard: install, …` steps, that is the key, the restore, the check, the miss `npm ci`, the fallback `npm ci`, the save and `prisma generate` (`INSTALL_WINDOW_STEPS` in `scripts/lib/ci-run-summary.ts`). `Use the pinned npm` is left out **on both sides**: the base medians of item 7 (58, 46, 69 and 72 s, run 42733858791) were read from the base's one step `Stage 1: install (npm ci, prisma generate)`, which also left it out, so head and base are like for like. The result holds either way (head 10, 10, 11 and 10 s against 61, 75, 74 and 75 s). **Rule for later changes:** a new step inside the install window takes the `Stage 1: install, ` or `Shard: install, ` prefix and is added to `INSTALL_WINDOW_STEPS`, or the summary will not count it.
  - **`setup-node`'s `cache: npm` (PRF-04): removed, in a later story.** **Why:** on a hit nothing reads the npm cache, yet every job restores it: about 258 MiB per entry, 9 entries, about 2,310 MiB, 22 % of a repository cache already over its 10 GB, where least-recently-accessed entries are evicted first. Its key is the lockfile hash, so on a lockfile change it misses together with the `node_modules` key. It helps only on a miss caused by `package.json`, `.npmrc`, npm, Node, `ImageOS` or N, and on a fallback, and item 3 replaces those runs before reading. The v0.27 figure "about 4 s on a hit" is an estimate: `Set up Node.js` takes 3 to 5 s per job and the cache part cannot be timed apart from it. **Where:** its own small enabler story (1 point, estimate; GitHub tech-debt issue #156, placed by the product-manager through the DL-084 and DL-116 route), **after AQP-244 merges**. Not in AQP-244: its AC-3 compares head and base paths and its AC-1 attributes the spread, and a set-up change in the same PR would mix a second cause into both (the DL-116 lesson). Not in AQP-243: G6 scope, and the guard pins `cache: npm`. **The change:** drop `cache: npm` from `Set up Node.js` in both install jobs, and turn the `ci-setup-cut.test.ts` assertion that keeps it into one that forbids it, declared in the PR (G12). **Pass line:** over three full runs of the head and of the same-day base (12 job runs each), no job's median `Set up Node.js` time is higher than its base median, and no other step is slower by more than host noise (stated per job). The PR also gives the time of one miss `npm ci` without the npm cache, on a throwaway PR (DL-091, DL-105), for the record only: miss runs are not read against 5:30. **Exit:** if any job's `Set up Node.js` median rises, the line stays and the figures are recorded here.
  - **Miss and fallback runs (PRF-05; RISK-023 reading rule, DL-128 (4), effective 2026-11-10).** For the RISK-023 fall-back reading (median of three full runs on a `master` head at most 5:30) and for the DL-123 (d) first-attempt rule, a run whose summary or install steps show `miss` or `fallback` in any job is replaced by one more full re-run before it is read. A re-run of a miss run normally hits, because the miss run saved the entry once its `npm ci` and record succeeded. At most two replacements; if the third run still shows `miss` or `fallback`, the reading is reported with the states and the cause, and not counted. **Expected misses:** the first `master` run after AQP-243 merges (a PR's entry cannot reach `master`, and there are no `restore-keys`; that run read 5:23 as a miss, run 42761884488), the first run on any ref after a change to the lockfile, `package.json`, `.npmrc`, `NPM_VERSION`, `NODE_VERSION`, `ImageOS` or N, and any run after its entry was evicted. **A `fallback` in every job of two runs in a row** means a bad entry: the orchestrator lists its key for the delivery lead, or N is raised. **No `ci.yml` change follows from PRF-05:** the summary already shows each job's state, `restore-keys` stays out by AC-3 (a), and pre-warming `master` cannot help, because the first `master` run after a key change is the one that writes the entry. The PR-ref paths of PR #152 (median 4:53 of five) do not meet AQP-244 AC-3 for RISK-023's "falls to 3" rule; that rule reads AQP-244's own measurement or a nightly window (DL-128 (4)).

**8. STORY-10.20 (AQP-244): path variance, confirmed (v0.27).**
- **Points: 3, confirmed.** The attribution is read-only and is partly done in item 6. The likely cut (below) is a test-placement change, with its guards and five full runs. If the AC-4 exit is taken, the story is smaller.
- **AC-1, sharpened.** Besides what the AC lists, the PR gives each test's duration grouped by shard and project. **Source (corrected in v0.28):** `ci.yml` uploads no artifact and `playwright.config.ts` sets the reporters to `list` and `html`, so no JSON or blob report of a past run exists. For past runs the source is the `list` reporter's line per test in the raw job log (`gh api .../actions/jobs/<job_id>/logs`; each attempt's jobs have their own IDs and logs). That line carries the project in brackets, the file, line and title, and the test's duration; the shard comes from the job name. Three limits are stated in the PR: (1) a test's duration covers the test and its test-scoped hooks and fixtures, not worker start-up, the web server or worker-scoped fixtures, so the shard's test-step time times its four workers, minus the sum of its test durations, is reported as its own "not attributed" line; (2) with four workers, a shard's step time is not the sum of its tests, and the line has no worker index, so shards are compared by summed test time and by wall time; (3) logs are kept only for the repository's log-retention period, so they are read now. The developer confirms the format on one log before parsing the rest, and the throwaway-PR run of the base stays the fallback. Item 6 cannot say why shard 3's tests are slower: `desktop` per-test cost, the `@one-width` tests, or the tail of the list. It also splits the 76 s rise of the median since PR #124 (4:37 to 5:53) between tests added by #120 and #135 and host speed.
- **AC-2, the cut, named conditionally.** *Ruled in v0.30, item 9: the condition is not met on the hit runs, option (1) is withdrawn, and the cut is the own-width files listed in `desktop` only.* The ruling is still written here after AC-1. If AC-1 confirms that shard 3 carries 25 s or more above the shard mean in a median of the runs, **the cut is to even out the shards' time**. It is chosen from these, in this order:
  1. Move some whole `@one-width` files from `desktop` to `mobile` (the `grepInvert` and `grep` of the projects). By the section 10.5 definition, these tests read no layout, so the width that runs them does not matter. Each still runs once. The allow-list and `one-width-tag.test.ts` change with it, under the review rule of section 10.
  2. A time-aware assignment of tests to shards, rejected at PRF-02 only because the first job capped the gain. That is no longer true. The count-balance guard of item 2 (counts that differ by at most one) would then be replaced here by a time-balance guard before the build.
  3. A fourth shard, only through item 5 (2)'s gate.

  No test is dropped, skipped, retried or given a wider timeout (DL-057). If AC-1 shows that shard 3's excess is mostly host draw, the AC-4 exit applies.
- **AC-3, confirmed: median at most 5:00 and the slowest of five at most 5:30.** Arithmetic (estimate): from 5:53, the set-up cut gives 20 to 30 s and balancing gives 30 to 45 s, so a median of about 4:40 to 5:00. The slowest, a run where every shard draws a slow host (6:14 here), lands at about 5:00 to 5:25. Both are reachable without a fourth shard, but **only if the imbalance is the repository's**. The 5:30 slowest-run line is the part host speed can break. If it fails while the median passes and AC-1 shows host draw, that is the AC-4 exit for the slowest-run line alone, reported with the figures, not a failed story.
- **AC-5:** the reading rule is stated here after AC-1. On this run's figures, a median of three is decided mostly by how many fast hosts were drawn (attempt 2). The likely answer is a median of five, or a median of three read together with the host line of item 7. It is decided on AC-1's numbers, not now. *Decided in v0.30, item 9: the median of five full hit runs.*
- **AC-6, the cost guard restated against the current base.** The 2.5 times guard (AQP-208 AC-6) is against the one-job layout. Measured links: two shards 1.56 times billed against one job (AQP-208), and three shards 1.20 times billed against two (PR #124). Three shards are therefore about **1.87 times** the one-job figure. Against today's three-shard base, the guard is **billed minutes at most 1.30 times the same-day base** (2.5 / 1.87 = 1.34, rounded down), with raw minutes shown. Base figures from run 42733858791: raw 1,161, 952 and 1,165 job-seconds (median 19.4 minutes); billed 22, 18 and 23 minutes (median 22), counting each job rounded up to a whole minute (documentation-based). A fourth shard (about 22 % more raw time) fits inside 1.30. STORY-10.19's own AC-7 is stricter (not above base) and is unchanged. Runner minutes are not billed on a public repository (A-3). The guard is about resource discipline, not cost.

**9. STORY-10.20 (AQP-244): the stop-and-decide ruling and the reading rule (v0.30, 2026-11-10; developer's AC-1, AQP-244 comment 11338).** This replaces item 8's conditional AC-2 list and its AC-5 note.
- **What AC-1 found.**
  - **The largest cause of spread is host speed, in the shard test step, outside the repository.** On 7b1cf7f the same 235 tests in shard 3 ran 29 % slower on one attempt: 52 of the 81 s between 4:53 and 6:14. Most of the other 26 s was the install, which AQP-243 removed (set-up on a hit is 6 to 11 s). Queue wait was 2 to 3 s in every job.
  - **The path on unchanged code after AQP-243:** 8 hit runs, median 4:32, mean 4:37, standard deviation 26 s, range 4:03 to 5:09. The runs fall into two groups, five at 4:03 to 4:33 and three at 5:05 to 5:09. The pooled median fell 62 s from the no-cache era (5:34 over 10 runs), not the 20 to 30 s that item 5 estimated. So the 5:53 that fired the trigger read a true level of about 5:34, not only a draw.
  - **The imbalance is ours but small.** The count split balances *listed* tests (249 / 249 / 248), but 131 listed tests skip at run time. 108 of them come from two files that set their own widths and skip unless the project is `desktop`: `aqp-234-qa.spec.ts` and `masters-table-actions.spec.ts`. Shard 3's test step above the shard mean has a median of 28.7 s over 17 runs and 6 s over the 8 hit runs. The model gives 75 s of test work, about 19 s at four workers. An active test costs the same at every width (2.6 to 2.8 s).
  - **The 76 s rise since PR #124 is the added tests** (about 49 s from 279 added instances), not host speed: the tests common to both samples ran at 99.4 %.
- **The AC-2 condition is not met on the base the cut lands on.** It is read on the runs that share that base, the 8 hit runs, where the excess is 6 s, below 25 s; the model's 19 s is below it too. The 17-run figure of 28.7 s includes the no-cache era, whose install variance is gone. Item 8's ordered list therefore does not bind. **Its option (1) is withdrawn on the evidence:** moving `@one-width` tests from `desktop` to `mobile` or `tablet` makes the imbalance worse, at 104 to 126 s of test work against 75 s, because shard 3 keeps the whole `desktop` block and loses only cheap tests.
- **The cut (AC-2): the own-width files are listed in `desktop` only.**
  - **Mechanism.** `playwright.config.ts` gets one constant, `OWN_WIDTH_FILES`, naming the two files. `mobile` and `tablet` add it to their `testIgnore`, beside `**/auth.setup.ts`. `desktop` is unchanged. The `test.skip(testInfo.project.name !== 'desktop', …)` line in each file stays: it is the marker the guard reads, and it keeps the file at one project under any other configuration.
  - **Not a width change.** Each of these tests runs once today, in `desktop`, at the widths it sets itself. After the cut it runs the same way. No test is dropped, skipped, retried, moved to another width or given a wider timeout (DL-057). The 108 entries leave the `mobile` and `tablet` lists, so the count split balances tests that run.
  - **Expected effect.** Summed test work per shard becomes 604 / 575 / 549 s, so max minus mean falls from 75 s to 28 s. That is about 12 s of path, in a range of 0 to 18 s (the upper bound uses the measured ratio of wall time to summed time, about 1.5). Runner minutes do not change. 12 s is below the standard error of a median of five (about 15 s), so time cannot show it; AC-3 (c) shows it by count instead.
  - **Why take a cut worth less than the noise.** It costs one constant and one guard, and uses public API only. It also fixes two guards that measure the wrong thing. Item 2's count-balance assertion counts listed tests, and every new own-width file would widen the gap between listed and run. Separately, a third file that skips by project name escapes the `@one-width` allow-list guard today, so it escapes the section 10 review rule.
  - **Guards, written first: red on a plant, then green.** In `tests/unit/e2e-shards.test.ts` or a sibling unit test:
    - (a) A source scan: every spec under `tests/e2e` that calls `test.skip` on `project.name` is in `OWN_WIDTH_FILES`, and every entry names such a file. A planted third file fails it.
    - (b) From `npx playwright test --list`, read as the union test already does: `mobile` and `tablet` list no test from those files, and `desktop` lists all of them.
    - (c) The union test (every test runs once) and item 2's count-balance assertions are unchanged, and they pass.
    
    A file is added to `OWN_WIDTH_FILES` only after a ruling here, as for the `@one-width` allow-list (section 10 review rule).
  - **Rejected:**
    - `PWTEST_SHARD_WEIGHTS=6:6:5`, because it is an internal variable (see the next point). Its weights would also compensate for the listing artefact that this cut removes, and they would need retuning whenever a spec is added.
    - A custom time-aware split (item 8 (2)). After this cut, 28 s of test work remains above the mean, about 7 s of path, which does not pay for a script plus a time guard.
    - A fourth shard now: its gate below is not met.
- **Internal Playwright variables are not acceptable** (architecture v0.34 section 8). CI and `playwright.config.ts` use documented Playwright options only. The `PWTEST_*` variables are Playwright's own test switches and carry no compatibility promise. The dependency is pinned exactly and Dependabot proposes bumps (1.65.0 is open as #149). Playwright ignores a removed or renamed variable without an error, so the gain would vanish on a bump that every check passes. The only exception route is TD-06's (architecture section 6, `forbidden()`): no public alternative, a ruling, a guard that fails when the behaviour changes, and a tech-debt issue. Here a public alternative exists.
- **AC-3: what the lines mean now.** The post-AQP-243 base already sits inside both lines (pooled median 4:32, slowest 5:09), so the lines can no longer show the cut. They stay as absolute ceilings that the head must not break, and as the reading behind RISK-023's fall to 3. **AC wording proposed for the product-owner** (I change no AC):
  - (a) **Head:** five full runs, each with `hit` in every job (DL-128 (4) replacements). The median is at most 5:00 and the slowest at most 5:30, as now.
  - (b) **Base:** five full runs on the same-day `master` head **after DEF-023 (AQP-268, PR #160) merges**, so that neither side carries DEF-023's retry on shard 3 (DL-132 (2)). The head-against-base difference is reported, not judged. The standard error of a difference between two medians of five is about 20 s, above the expected 12 s.
  - (c) **The cut's effect is shown by count and modelled time, not by wall time.** For each shard: the listed and active test counts, and the summed test seconds using AC-1's pooled medians, before and after the cut. Max minus mean must be at most 35 s of test work (the model gives 28 s).
  - (d) **A host-draw exit for the 5:00 line**, as AC-3 already has for the 5:30 line. If the head's median of five is over 5:00 but at most 5:15, and the same-day base's median of five is also over 5:00, that line takes the AC-4 exit, with the figures. Any other miss is reported BLOCKED to the architect. **Why:** three of the eight hit runs sit at 5:05 to 5:09, so even with a pooled median of 4:32, a median of five reads over 5:00 in 10 of the 56 five-run draws (18 %).
- **AC-4 is recorded and partly taken.** The largest cause, host speed in the test step, is outside the repository and no step removes it. That part takes the AC-4 exit, and the reading rule below is its answer. The part inside the repository is cut as above. The estimate stays at 3 points: the cut is small, but the ten measured runs and the guards remain.
- **AC-5: the reading rule** (effective once master records it).
  - **Is a median of three reliable against 5:30?** Against a false trigger at today's level, yes. At a standard deviation of 26 s and a pooled median of 4:32, 5:30 is about 2.2 standard deviations away, and none of the 56 triples from the 8 hit runs reads above 5:09. **Near a line, no.** A median of three has a standard error of about 19 to 30 s (standard deviation 26 to 42 s), so when the level is within about 30 s of a line, which hosts were drawn decides the reading. On 7b1cf7f one commit ran 4:53 to 6:14, and 29 % of triples read 5:00 or more against a median of 4:32. Both lines in use, 5:00 and 5:30, are within that reach of the level now, or will be as tests are added.
  - **The statistic is the median of five full runs of one commit, with `hit` in every job.** It applies to every single-commit reading against 5:00 or 5:30:
    - item 5's pull-request trigger: a first attempt of 5:30 or more starts it, with four full re-runs, not two;
    - DL-123 (d)'s first-attempt rule;
    - RISK-023's fall-back and fall-to-3 readings;
    - AQP-244 AC-3;
    - the fourth-shard gate below.
    
    Its standard error is about 15 to 24 s. "Full" means "Re-run all jobs". A `miss` or `fallback` run is replaced under DL-128 (4), with at most two replacements. Each reading posts the five paths, each run's slowest shard, and that shard's host line (the CPU model from AQP-243's job summary). The host line is posted for the record only; no run is excluded for its host.
  - **Not changed:** the nightly reading (the median of the last 20 first attempts, at least 13 runs, with a standard error under 10 s), the 6:00 warning, and the 9- and 10-minute lines of section 10.3.
  - **Cost:** two more full runs per reading, and only when a reading is due. Runner minutes are not billed on this public repository (A-3).
- **The RISK-023 trigger, as ruled.** The next CI-time step is due when (a) a median of five on a pull-request head or a `master` head is 5:30 or more, or (b) a nightly median is over 5:30. Master re-scores RISK-023 by the register's rules, reading "median of three" there as this median of five from now on. The fall to 6, read as 5:05 on run 42819300261 under the old rule, stands.
- **The fourth shard: gate and cost limit.** It is not due, because the post-AQP-243 level is 4:32. It becomes due only when, after AQP-244 merges, **both** of these hold, so that one draw of slow hosts cannot buy a lasting cost:
  - (a) a median of five full hit runs on a `master` head is over 5:00;
  - (b) the next nightly median, over at least 13 runs, is also over 5:00.
  
  It is then its own EPIC-10 enabler, by the DL-084 and DL-116 route, with the own-width cut already in place. Expected gain: about 35 to 50 s of path (modelled shard sums with the cut: 446 / 444 / 440 / 399 s). **Cost limit:** billed and raw runner minutes, each a median of five, at most **1.30 times** the same-day three-shard base. That keeps the 2.5 times one-job guard (1.87 × 1.30 = 2.43); the developer's estimate is +25 %. A run holds at most five jobs before the fan-in. The `ci-workflow` pin changes to exactly `[1, 2, 3, 4]` in the same PR. A fifth shard is not pre-ruled: item 5's "beyond four shards, nothing" rested on `Stages 1 to 11b` at 4:00, and its hit-era median is now 3:13, so the architect proposes again with figures if it is ever needed.
- **Corrections to earlier items.**
  - Item 1 says the count split gives near-equal groups. It balances listed tests, not tests that run: 131 listed tests skipped at run time at ce9c02c, and the own-width cut removes 108 of them.
  - Item 1's "revisit if the slowest shard ends more than 45 s after `Stages 1 to 11b`" is superseded. AQP-243 shortened that job, and the shards now end after it in nearly every run, so the gap no longer measures imbalance. The shard's excess over the shard mean, read on hit runs, does.
- **Order.**
  1. DEF-023 merges (PR #160).
  2. On `feat/AQP-244-ci-path-variance`, from that `master`: the guards, then the config change.
  3. The base's five runs on that `master` head, then the head's five.
  
  AQP-245 does not merge between the base and head runs (orchestrator). A test-adding merge in between restarts both (AC-3).
- **Result and the AC-3 (c) ruling (v0.31, 2026-11-10; PR #166 at 953b8ca, developer AQP-244 comment 11364).**
  - **Measured.** Each side has five full runs, hit in every job, with 0 flaky and 0 retries.
    - The base, `master` 322cd8e (run 42850365032), has a median of 4:41, a slowest run of 5:17 and an sd of 21 s.
    - The head (run 42852486467) has a median of 4:37, a slowest run of 4:52 and an sd of 16 s. Billed minutes are 0.95 times the base's.
    - Per shard, each figure the median of five runs, base then head:
      - Active tests went from 207 / 204 / 245 to 225 / 222 / 209.
      - Summed test seconds went from 671 / 673 / 597 to 598 / 562 / 588; max minus mean fell from 26 s to 16 s.
      - Test-step times went from 206 / 206 / 181 s to 180 / 172 / 185 s; max minus mean fell from 8 s to 6 s.
  - **Modelled.** The model re-run on today's 787-instance suite gives 20 s before the cut and 68 s after it (705 / 666 / 541). The cause is AQP-123's heavy tests, which landed in `mobile` and `tablet`.
  - **The measured reading governs AC-3 (c); the modelled figure is reported, not judged.** The model was a stand-in for a split nobody had run yet. It assumes that a test's duration does not depend on its shard, its position in the list or the tests running beside it on four workers sharing 4 vCPU. The head's own step times refute it on this suite. For the model's 68 s to be real, shard 1's step would run about 17 s longer than the others. Measured, it is 180 s against 172 and 185 s. Even when the model is scaled to the head's faster hosts (× 0.91), it puts shard 3's summed work about 90 s below what was measured (495 s against 588 s). A model error of that size is above the 35 s line, so the model cannot judge a cut of this size.
  - **Limits of the measured reading, stated and accepted.** The head drew faster hosts (summed work 1,748 s against 1,941 s on the same tests), and a single shard's sum varies by 100 s or more between runs. The median of five per shard is what makes the reading usable. Both readings agree on one point: the cut's effect on wall time is below what this sample can resolve (path -4 s, as item 9 expected).
  - **The cut is kept.** The active-test counts now differ by at most 16, against 41 before (deterministic, from `--list` and the skip marks). The count guard of item 2 now balances tests that run. Guard (a) closes the blind spot of the section 10 review rule. Neither the path nor the step times show any harm. Dropping it would take AQP-244 to the AC-4 exit, keep a balancing guard that counts 108 tests that never run, and save nothing.
  - **For later cuts:** a shard-balance change is judged on measured per-shard test-step times and summed test seconds, each the median of five, and never on modelled sums alone. A model may size an option before it is built; it carries an error of about 50 s of summed work (about 12 s of wall time). The fourth-shard estimate of 35 to 50 s above is a modelled figure and is read that way.
  - **AC-3 (c) wording, proposed for the product-owner:** "(c) The cut is shown by test count and measured time, not by the wall path: per shard, the listed and active test counts, the summed test seconds and the test-step time, each the median of the five runs, for the base and for the head. The largest shard's summed test seconds minus the shard mean is at most 35 s. The modelled sum from pooled per-test medians is reported, not judged (test strategy 10.5 item 9, v0.31)." PR #166 meets it (16 s; steps 180 / 172 / 185 s).

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
| 0.31 | 2026-11-10 | Section 10.5 item 9, AQP-244's result and the AC-3 (c) ruling (PR #166 at 953b8ca; developer comment 11364). Five hit runs per side: the base median is 4:41 (slowest 5:17) and the head's 4:37 (slowest 4:52), with billed minutes 0.95 times the base's. Per shard, active tests went from 207 / 204 / 245 to 225 / 222 / 209. Summed test time max minus mean fell from 26 s to 16 s, and step times from 8 s to 6 s. The modelled sum on today's suite is 68 s. **The measured reading governs.** The model assumes a test's time is independent of its shard and position, which the head's step times refute, so it is reported, not judged. **The cut is kept.** Later shard-balance changes are judged on measured step times and summed seconds (medians of five). AC-3 (c) wording is proposed to the product-owner. No NFR, dependency or code change |
| 0.30 | 2026-11-10 | Section 10.5, new item 9, AQP-244's stop-and-decide ruling on the developer's AC-1 (comment 11338). **AC-2:** the condition is not met on the hit runs (6 s; model 19 s), and item 8's option (1) is withdrawn because it makes shard 3 worse. The cut is `OWN_WIDTH_FILES` (`aqp-234-qa.spec.ts`, `masters-table-actions.spec.ts`), added to `testIgnore` in `mobile` and `tablet`; each test still runs once in `desktop`. Expected about 12 s (0 to 18 s), with source-scan and list guards and a ruling needed to add a file. Rejected: `PWTEST_SHARD_WEIGHTS` (internal variable, refused; architecture v0.34 section 8), a custom time-aware split, and a fourth shard now. **AC-3:** 5:00 and 5:30 become absolute ceilings. AC wording is proposed to the product-owner: a base read after DEF-023 merges; the head-against-base difference reported, not judged; the cut shown by count and modelled time (at most 35 s); a host-draw exit for the 5:00 line. **AC-4:** host speed is recorded as outside the repository. **AC-5:** the median of five full hit runs for every single-commit reading against 5:00 or 5:30, with the nightly unchanged. **RISK-023:** the trigger restated. **Fourth shard:** due only on a median of five on `master` and a nightly median both over 5:00; at most 1.30 times billed and raw minutes; a fifth is not pre-ruled. Items 1, 5 and 8 carry pointers. No NFR, dependency or code change |
| 0.29 | 2026-11-10 | Section 10.5, G6 of AQP-243 (DL-128 (7)), AC-8 record part 1. Item 3: the miss rule of stage 12a extended to the `node_modules` cache (DL-128 (4)). Item 7: the key's `node-modules-v<N>` format number, when N is raised and why forgetting fails safe (STD-07, QLT-05, accepted); the AC-2 window named by its steps, without `Use the pinned npm` on both sides, matching the base it was measured against (QLT-06; no pass line or code change); `setup-node`'s `cache: npm` removed by its own story after AQP-244 merges, with the change, pass line and exit (PRF-04); the RISK-023 reading rule for `miss` and `fallback` runs, the expected misses and no `ci.yml` change (PRF-05); a bad entry is deleted only with the delivery lead's approval, or N is raised (DL-128 (5)). Part 2 (result and fourth shard) after the merge. No NFR or dependency change |
| 0.28 | 2026-11-09 | Section 10.5, two DoR follow-ups from the product-owner (AQP-243 11268, AQP-244 11270). Item 7 (AQP-243 A-2, default confirmed and extended): the `node_modules` cache key adds `NPM_VERSION` and hashes `package.json` and `.npmrc` with `package-lock.json`, because the install-script allow-list is outside the lockfile. Item 8 (AQP-244 AC-1, confirmed): past per-test durations come from the `list` reporter lines in the raw job logs, with three stated limits (not-attributed time, parallel workers, log retention); the throwaway-PR run stays the fallback. No AC, figure or estimate changes. Architecture v0.32 |
| 0.27 | 2026-11-09 | Section 10.5, items 6 to 8 (PRD v0.21 13.16, release plan v0.21 3.14, DL-123 (d)). The RISK-023 trigger fired early: run 42733858791 on 7b1cf7f gave 5:53, 4:53 and 6:14 (median 5:53), with per-job figures from `gh api` and the job logs. Host speed varies on one image (`npm ci` 41 to 74 s; the same shard 30 to 50 % slower on a slow host), and shard 3 ends last in 3 of 3, 29 to 45 s above the shard mean. STORY-10.19 (AQP-243): 3 points; the `node_modules` cache mechanism (exact key, no `restore-keys`, integrity fallback); AC-2 "install plus generate" defined; AC-4 corrected from "20 s in each job" to a pooled median of 12 job runs at least 20 s lower with no job worse; AC-3 (c) confirmed by GitHub's ref scoping; a per-job host line proposed for AC-5. STORY-10.20 (AQP-244): 3 points; median at most 5:00 and slowest at most 5:30 confirmed; per-test durations added to AC-1; the cut named conditionally (re-home `@one-width` files, then a time-aware split, then a fourth shard); the AC-5 reading rule deferred to AC-1's numbers; the 2.5 times guard restated as 1.30 times billed against the same-day three-shard base |
| 0.26 | 2026-11-09 | Section 10.5, G6 of AQP-227 (PR #124), DL-117 condition 7; AQP-227 QLT-01, QLT-02, STD-01, PRF-01 to PRF-05. **Balance guard corrected:** `e2e-shards.test.ts` asserts the cause (`fullyParallel: true`) and the effect (width-test counts differ by at most one, or a looser bound that still fails the 163 / 156 / 148 plant); the 10 % assertion stays as a gross-imbalance backstop, and v0.25's claim that it catches a per-file split is withdrawn (4.9 % passes). **AC-1 pin:** the whole `strategy` block is anchored, so `include`, `exclude` or `max-parallel` fails it. **Result:** median path 4:37; the path is the slowest shard (mean 4:26) plus about 7 s, so planning uses the slowest shard; steadier at N = 3 (about 10 s against 79 s), not 1:30 shorter. **Headroom:** 53 s to the 5:30 trigger (46 s from the worst run), about two stories, expected to fire at or after AQP-142, replacing "three to four stories from about 4:15". **Fourth shard:** `Stages 1 to 11b` at 2:47 to 4:08 (median 4:00) nearly binds; a fourth shard saves about 15 to 25 s for about 22 % more runner time, replacing "40 s at most"; the set-up cut stays first, with the install measured at 38 to 66 s per job and the PRF-04 job-summary line. Duration weighting confirmed not worth it (PRF-02). No NFR, AC or pin count changes |
| 0.25 | 2026-11-08 | Section 10.5, three shards for the enabler story, presumed STORY-10.17 (DL-116; PRD v0.20 13.15; release plan v0.20 3.13; AQP-122 PRF-02, PRF-08). **N = 3** in the matrix only, with Playwright's count split and no duration weighting. **Guards:** `e2e-shards` unchanged plus a count-balance assertion; the `ci-workflow` AC-1 pin goes to exactly `[1, 2, 3]`; `ci-fan-in` and the measure code unchanged; branch protection read back; live controls with the fault in shard 3. **Measure:** three full runs of the head (attempt 1 plus two full re-runs; "first-attempt" read this way), median at most 4:45, confirmed; expected 4:05 to 4:30. **Guard:** billed minutes at most 1.60 times the two-shard base (2.5 times the one-job figure); the 2.2 times estimate is corrected to about 1.6 times raw and 1.9 times billed. **Next trigger:** a first attempt of 5:30 or more confirmed by a median of three, or a nightly median over 5:30; then cut the set-up, then a fourth shard, then nothing more. **Points:** 2, confirmed; the DL-115 earlier trigger is withdrawn. **`@one-width` rulings:** `canary-scan.spec.ts` stays at three widths, because the browser-fetched set depends on width (#116 PRF-06); three `process-master.spec.ts` tests (AQP-113) and two `materials.spec.ts` tests (AQP-122 PRF-03, plus the filter test) go to one width, in one test-only commit after the shard story, with the pins going from 47 to 52 tests and from 9 to 11 files. **Section 10:** the G12 review rule (DL-114) |
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
