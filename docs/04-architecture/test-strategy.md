# Technical Test Strategy — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.5 (the delivery lead's answers: Warn, AQP-15 comment 10511; Q-35 (a) 1000, AQP-14 comment 10510) |
| Owner | solution-architect |
| Status | Accepted at G3 as CONDITIONAL GO. Version 0.4 answers condition 14. Version 0.5 replaces CE-9 and marks CE-2 and CE-12 confirmed, for `master` to check at G4 |
| Date | 2026-11-01 |
| Inputs | SPEC v1.4 §14, §18.5; PRD v0.7; `architecture.md` v0.5; DL-012, DL-013; AQP-14 comment 10510; AQP-15 comment 10511; `coding-standards.md` |
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
| Unit | Formula engine, roll-up, tree, state machine, validation, time, columns | developer | Vitest 5 | `tests/unit/` | Every PR |
| Integration | Services and routes against Postgres; migrations, triggers, grants | developer | Vitest, Postgres service | `tests/integration/` | Every PR |
| Contract | Route output schemas, strict keys | developer | zod, Vitest | `tests/integration/contract/` | Every PR |
| Security | Role matrix, canary scan, CSRF, cookies, uploads | developer, qa-engineer | Vitest, Playwright | `tests/security/` | Every PR |
| Acceptance | SPEC §14 items 1 to 14 | qa-engineer | Vitest, Playwright | `tests/acceptance/` | Every PR |
| E2E | Critical journeys at all viewports | qa-engineer | Playwright 1.64 | `tests/e2e/` | Every PR (Chromium at 3 widths); nightly (full matrix) |
| Accessibility | WCAG 2.2 AA (PROPOSED, PRD v0.6) | qa-engineer | axe, keyboard run | `tests/e2e/a11y/` | Every PR; manual per release |
| Performance | NFR-008 to 011 | qa-engineer | Vitest timing, k6, Lighthouse CI | `tests/perf/` | Timing and Lighthouse nightly; load before release |
| Export | File fidelity | qa-engineer | ExcelJS read-back, Excel desktop | `tests/integration/export/` | Every PR; manual open per release |
| Operational | Install, backup, restore | qa-engineer, IT contact | Scripts, stopwatch | Rehearsal log | Before go-live |

## 3. Risk-Based Priorities

| Area | Impact | Likelihood | Depth |
|------|--------|-----------|-------|
| Cost confidentiality (NFR-002) | Critical | Medium | Layers plus canary scan on every build |
| Roll-up and quantity (FR-029, 030) | Critical | Medium | Constructed examples, property tests, single-place tests, own-H-once test; no pending case at G7 (section 5.6) |
| Quantity warning (OQ-ARCH-10, RISK-013) | High | Medium | CE-9 at every level; no cost in the warning on any route; a stale acknowledgement never passes (section 5.2) |
| Cleared totals (D-20) | Critical | Medium | Every read through `figure-state`; approval and export refusal; autosave does not clear |
| Row formulas (FR-024) | Critical | Low | One test per formula; end-to-end tree |
| Approved immutability (NFR-026) | High | Low | Regression test, DB refusal tests |
| Role enforcement (NFR-001) | High | Medium | Full matrix |
| Configuration edits (FR-074 to 078) | High | Medium | Property tests, SPEC §14 items 6 to 8 |
| Export fidelity (NFR-027) | High | Medium | Read-back, checklist, manual open |
| E-mail (NFR-014) | Medium | **High** until the account is known | Controlled-clock tests; a real send once OQ-ARCH-11 is answered |
| Backup (NFR-013) | High | Medium | Missed-run alert test; restore rehearsal |
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
| `quantityCases` | The constructed examples (section 5) | Roll-up |
| `hiddenEntries` | The two "Not applicable" rows from the migration, fixed IDs | Section 9, added for SPEC v1.4 |
| `acceptanceTree` | Nodes 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5 with invented inputs and hand-calculated outputs in a table reviewed before the test runs | SPEC §14.2 |
| `tree500` | Generated 500 nodes, depth up to 6 | Performance |
| `images` | PNG, JPG, GIF, WebP; 199 × 1024 and 201 × 1024 bytes; a text file renamed `.png`; a polyglot | Uploads |

Builders in `tests/support/` construct data; tests never depend on each other's rows. A test checks that every number in `placeholderMasters` matches the pattern, so a pasted real value fails (ADR-014). Parallel-run data (TR-004) stays outside the repository and its results are not committed.

---

## 5. Roll-up and the Quantity Step (G2 condition 5)

### 5.1 Oracle

SPEC §7.4 BL, §18 D-08 and D-12 as revised in v1.4, §18.5. Expected values are worked by hand here, before any code exists, and were re-run through a throwaway script on 2026-11-01 (architecture section 4.3). The sample has quantity 1 on every row and cannot test quantities, so these constructed cases are the test.

**The rule.** `T(row) = BG(row) + H(row) x sum of T(child)`, and BL is the sum of T over the top-level items.

**What this does not prove.** These cases encode D-12. Q-32 (a) is in the delivery lead's own words: their definition of QTY per Assy (AQP-13 comment 10487) and their count of 24 lids (AQP-1 comment 10490). Q-35 (a) is answered: 1000 for quantity 5 at 200 a piece (AQP-14 comment 10510), so a row's own quantity counts once and ASSUMPTION-51 is **confirmed**. Three limits stay. Their example had nothing below the item, so an item with both its own cost and rows below it (CE-2) joins two answers that were given apart. Their working reads 500 x 2 where the example has 5 and 200: the number is what section 5.6 takes, and it fits this rule. ASSUMPTION-52 is still a working assumption (Q-35 (b)). A parallel run against a worksheet calculated the same way would pass on a wrong rule too (RISK-002).

### 5.2 Constructed cases (`tests/unit/rollup/quantity-cases.ts`)

"Per-piece cost" is a row's cost before its own quantity. So stored BG = per-piece cost x H.

**CE-1: the nested example (SPEC §18.5).** 2 frames, 3 pipes per frame, 4 lids per pipe.

| Row | H | Per-piece cost | Stored BG, export | T(row), screen | Multiplier above | Pieces |
|-----|---|----------------|-------------------|----------------|------------------|--------|
| Item I, frames | 2 | 0 | 0 | 30 | 1 | 2 |
| Part P, pipes | 3 | 1 | 3 | 15 | 2 | 6 |
| Sub-part S, lids | 4 | 1 | 4 | 4 | 6 | **24** |

**Expected:** BL = **30**. S counts 24 times, P counts 6 times. With cost on S alone, BL = **24**, the delivery lead's count. BL also equals the sum of BG x multiplier above: 0 x 1 + 3 x 2 + 4 x 6.

Each wrong answer below names a specific defect, so the failure message tells the developer which.

| Wrong BL | Means |
|----------|-------|
| 14 | The withdrawn version 1.3 rule: the quantity multiplied once, at the top item (S counted 8 times) |
| 7 | No quantity applied in the roll-up |
| 15 | The item's quantity not applied |
| 49 | Displayed figures were summed: parents counted twice |
| 114 | A row's own H applied twice: `H x (BG + sum of T)` at every row |

**CE-2: an item row with its own values. Confirmed by Q-35 (a) (AQP-14 comment 10510; SPEC §14.2; DL-012). Asserted at 316.** cI = 5, cP = 7, cS = 11. Item 2, part 3, sub-part 4. Stored BG 10, 21, 44; T(S) = 44; T(P) = 21 + 3 x 44 = 153.

| Reading | Working | BL |
|---------|---------|----|
| **The rule (ASSUMPTION-51, confirmed):** own row counts its H once | 10 + 2 x 153 = 2 cI + 6 cP + 24 cS | **316** |
| Wrong: the item quantity applied to its own row a second time | 2 x (10 + 153) = 4 cI + 6 cP + 24 cS | 326 |

A BL of 326 names that defect. The gap looks small only because this item row is small next to what is below it (DL-012). CE-12 shows the full effect.

**CE-3: two top-level items (D-12 (d)).** Item A quantity 2 and item B quantity 3, each with 0 on its row and one child of quantity 1 and per-piece cost 1. **BL = 2 + 3 = 5.** A single multiplier over the whole sum would give 4 or 6.

**CE-4: a parent's own cost counts (D-12 (b1), (b2)).** Item quantity 1. Parent P quantity 1, per-piece cost 10. Child S quantity 1, per-piece cost 5. **BL = 15.** Displayed P = 15, export row P = 10, export row S = 5. A children-only reading gives 5. No warning is raised for the non-zero parent. With P at quantity 2: BG(P) = 20, T(P) = 20 + 2 x 5 = **30**, BL = 30.

**CE-5: all quantities 1.** BL equals a plain `SUM(BG)` over the rows, for a random tree. This is the worksheet's result at quantity 1 (SPEC §18.5).

**CE-6: a deep chain.** Item quantity 2, per-piece cost 0. Below it A quantity 3, B quantity 5, C quantity 7, one under the other, each with per-piece cost 1. Stored BG 3, 5, 7. T(C) = 7, T(B) = 40, T(A) = 123. **BL = 2 x 123 = 246** (6 + 30 + 210 pieces). The withdrawn rule gave 30.

**CE-7: BN (FR-025, D-12 (e2)).** The CE-1 tree. Tool Cost 2 on P and 3 on S, typed entries. Total Tool Cost = **5**, not multiplied by any quantity even though S counts 24 times. **BN = 30 / 5 = 6.** With no Tool Cost, BN is `null`, shown as "—", with an empty export cell, and the total Tool Cost shows 0.

**CE-8: divide by zero (A-07).** Exchange rate USD 0: BJ is "—" on the row and on any parent, BG and BL are unaffected, no error. A formula that makes a row's BG `null` gives a BL of "—", never a lower number.

**CE-9: quantity 0 on a part with parts below it, the Warn design (OQ-ARCH-10, OQ-PM-07; "Warn", AQP-15 comment 10511; architecture section 4.3).** The delivery lead chose Warn, so the DL-013 block fallback no longer applies, and nothing here refuses a 0 for good. Item 2, part 0 with per-piece cost 1, sub-part 4 with per-piece cost 1. BG 0, 0, 4; T(S) = 4; T(P) = 0. All numbers are invented. Asserted from the first commit, never pending. The part's own cost goes too: stored BG holds its own H, so the warning says the part and everything under it count as 0.

| Variant | Tree | BL | Warnings today |
|---------|------|----|----------------|
| A | As above | **0** (30 with the part at H 3, which is CE-1) | 1.1 |
| B | A plus a second part under the item: H 1, cost 1 | **2**: the other part still counts | 1.1 |
| C | Item 2; part H 0; below it H 0; below that H 4 | **0** | 1.1 and 1.1.1: every zero is listed, so fixing one does not raise a new surprise |
| D | Top-level item H 0, cost 3, one child H 4, cost 1 | **0** | 1: a top-level item counts |
| E | Item 2; part H 0, cost 1, nothing below it; part H 1, cost 1 | **2** | None: outside the rule until the open point below is answered |
| F | Top-level item H 0, cost 5, nothing below it | **0** | None, the same |

| Level | Assertion |
|-------|-----------|
| Unit, `rollUp` | The BL column. The pure function is unchanged, and this pins the arithmetic |
| Unit, `quantityWarnings` | The Warnings column. `0.00` is the same as 0, and 0.01 gives no warning. It is found through `systemRole: 'quantity'`, so a re-lettered H still warns. The function takes the tree and inputs only: a `@ts-expect-error` test shows a `RowOutputs` cannot be passed to it |
| Integration, no acknowledgement | `POST /calculate` as an Engineer and `POST /recalculate` as a Lead each give 409 `CALCULATE_ACK_REQUIRED`, with `inputsRevision` and one warning per row. No `calculations` row, no audit row, status and `inputs_revision` unchanged |
| Integration, acknowledged | The same request with `acknowledge.inputsRevision` succeeds. The Engineer's body is exactly `{status, message}`. The `calculations` row holds `warnings` with the code, node, Sl. No and label, and `created_by` is the person who pressed. One `calculation.warning_acknowledged` audit row, in the same transaction, naming the rows and holding no figure |
| Integration, stale | Acknowledge, but change any input first: 409 again with the new revision and the current list, and nothing written. Includes two concurrent requests, an input save and an acknowledged Calculate: the Calculate never succeeds on a list older than the save |
| Integration, nothing to warn | An `acknowledge` with no warning due is ignored: the calculation goes through with `warnings` empty and no audit row. A body that is not the stated shape, such as `{"acknowledge": true}`, is 400 |
| Integration, order | A blank input with an H of 0 gives 422 `CALCULATE_BLOCKED`, not the 409, so nobody acknowledges and is then refused |
| Integration, tree | A move that puts parts under a row with H = 0 is warned at the next press. Moving them out removes the warning |
| Integration, each press | A Lead's Recalculate of an estimate the Engineer acknowledged is asked again. The Engineer's calculation keeps the Engineer's name, and the Lead's new one has the Lead's |
| Integration, Lead data | `/costs` and `/export-summary` give the warnings, with who and when, while `current`, none while `out-of-date` or `none`. Approve succeeds at `current` with warnings on the calculation: Warn never stops approval |
| Security | Section 6, the warning path |
| E2E, 3 widths | SCR-05: "Go back" leaves the estimate Draft and "Calculate anyway" gives Submitted with the one message. SCR-06: the same dialog, then the notice. SCR-10: the notice. Keyboard only, and focus starts on the safe choice |

**The open point.** Whether Warn covers a part with nothing below it is unanswered (AQP-15 comment 10511). Variants E and F pin today's behaviour. If they extend it, their Warnings cells change to 1.1 and 1, each with the code `QTY_ZERO_NO_PARTS_BELOW`, and every other line stands (architecture section 4.3).

**CE-10: a fractional quantity.** Item 2 with cost 0, part 0.5 with cost 2, sub-part 1.25 with cost 4. BG 0, 1, 5; T(P) = 3.5; **BL = 7.**

**CE-11: changing the tree (section 4.8).** From CE-1, reordering siblings leaves BL at 30. Moving S directly under the item gives 2 x (3 + 4) = **14**, so a move changes the price. Each change clears the totals until Recalculate.

**CE-12: a childless top-level item at quantity above 1, a single-piece product (DL-012). Confirmed by Q-35 (a): their number is 1000 for quantity 5 at 200 a piece (AQP-14 comment 10510). Asserted at the values below.** One top-level item, no rows below it, H = 3, per-piece cost 5. Stored BG 15. All invented.

| Variant | Tree | **The rule (ASSUMPTION-51, confirmed)** | Wrong: the item quantity applied to its own row a second time |
|---------|------|-----------------------------------------|---------------------------------------------------------------|
| A | The item alone | T(item) = 15, **BL = 15**, 3 pieces | 3 x 15 = 45, 9 pieces |
| B | The same item at H = 1, stored BG 5 | **BL = 5** | 5: the two agree, which is why a sample with quantity 1 on every row cannot catch this |
| C | Item X: H 2, cost 0, one child of H 1 and cost 1. Item Y: as variant A | 2 + 15 = **17** | 2 + 45 = 47, so only the row with its own cost moves |
| **D** | **Their own example:** the item alone, H = 5, per-piece cost 200, invented for the question | **BL = 1000**, their number | 5000 |

Each variant also checks:

- the stored row BG is the same in the export either way (15 in variant A), so row BG is never where the difference shows;
- BL with no parent and no child does not divide by zero or give an empty sum;
- at `current`, `/costs` gives the row's own BG, H and multiplier above, which SCR-06's one box and "How the total is built" use.

Variant A's cleared state is in section 9.

### 5.3 Through the real evaluator

Each case above runs twice:
1. **Unit:** `rollUp` directly, with stated BG.
2. **Integration:** a real estimate through `calculation-service` with the seed configuration. Machining Cost (AP) carries the per-piece cost, all other inputs are 0, all percent rates 0. Then AY = AP, BA = AP, BB = AP x H, BG = BB, so a per-piece cost travels through every stage, and the result is read from `calculations` and `calculation_rows`.

Also on the integration path: the export of CE-1 shows row BG of 0, 3, 4 and BL2 = 30, and the Lead's screen data shows 30, 15, 4 with multipliers 1, 2, 6.

### 5.4 Holding the step to one place

| Test | Assertion |
|------|-----------|
| `quantity-step-single-importer` | Only `src/lib/rollup/roll-up.ts` imports `quantity-step.ts` |
| `quantity-step-unit` | Direct table test: a sum, `null`, and quantities of 0, 1 and a fraction. 100 % branch coverage |
| `own-quantity-once` | A row's own BG is never inside the value passed to the step for that row. Spy on the step in CE-1: S's BG reaches a step only with H(P), never with H(S). This is the test for the 114 defect |
| `no-rollup-of-rollup` | `RolledUpFigures` does not type-check as a `RowOutputs` input (a `@ts-expect-error` test) |
| `export-reads-outputs` | Export model built from a record whose `rollup` holds a marker value contains no marker |
| `no-recursion` | A chain of 500 nodes rolls up without a stack error |
| `quantity-cases-complete` | Section 5.6: every CE case has a numeric expected value, and no roll-up test is skipped or pending |

`rule-change-rehearsal` from v0.2 is retired. It proved one branch could carry the change, which turned out true only for an item row of 0 (architecture section 4.3). Q-35 (a) confirmed the rule, so `own-quantity-once` and the properties in section 5.5 stand as written.

### 5.5 Properties

Fast generated trees, in Vitest, with no extra library needed. Compare at 2 decimals: decimal.js rounds at 34 digits, so the two forms can differ far below a paisa (Evidence: worst relative difference 8.7e-33 over 300 trees).

- BL = the sum over all rows of BG x the product of H over the rows above it. This closed form is the test oracle: it is O(n x depth), and is not used in the product.
- BL = the sum over all rows of BG x the row's stored multiplier above.
- T(row) = BG(row) + H(row) x the sum of the children's T.
- With every H = 1, BL = a plain `SUM(BG)`.
- Reordering siblings leaves BL unchanged. Moving a node to another parent changes BL unless the multipliers above happen to match, so moves are not a property of invariance.

The generator must make top-level items with their own cost, with no children and at H above 1, or these properties never reach the Q-35 (a) case. The first two properties and the third at a top-level row hold under ASSUMPTION-51, which Q-35 (a) confirmed.

### 5.6 No pending quantity case at G7 (G3 condition 14, DL-012)

**The rule.** The roll-up story cannot pass G7 with CE-2 or CE-12 pending. A test cannot show that the rule is right, so these two carry the delivery lead's number into the build.

| # | Control | Owner | When | Stops it how |
|---|---------|-------|------|--------------|
| 1 | **Met.** Q-35 (a) answered with a number: 1000 (AQP-14 comment 10510). Silence would not have closed it (DL-012) | Santhosh; business-analyst records it in SPEC §18 | Before the story reaches Ready | The story stays out of Ready until SPEC §18 records it |
| 2 | The story's acceptance criteria cite CE-2 at 316, CE-9 as the Warn design and CE-12 at 15, 5, 17 and 1000 | product-owner, scrum-master | G4 | Definition of Ready check |
| 3 | The cases are written asserted from the first commit. **No `it.todo` is used**: the story cannot start before the answer exists, so no pending form is needed | developer | G5 | Review; control 4 |
| 4 | `quantity-cases-complete` fails if any CE case from 1 to 12 is missing or has no numeric expected value, or if a roll-up test file uses `.todo`, `.skip`, `.skipIf`, `.fails` or `.only`. It covers `tests/unit/rollup/**` and the integration roll-up tests | developer | Every PR, CI stage 6, which blocks merge | The build fails. Negative control (principle 5): the scanner is run on a planted string holding `it.todo` and must report it |
| 5 | The G7 report lists CE-1 to CE-12 and the roll-up properties by result. Pending, skipped or "not applicable" on any of them is an unverified AC | qa-engineer | G7 | G7 needs every AC verified, so `master` returns NO-GO |

**Where the expected values come from.** From their number and nothing else. Their 1000 for quantity 5 at 200 a piece fits the rule in section 5.1 and not the other reading (5000), so CE-2 and CE-12 take the values marked as the rule, and CE-12 variant D carries their own example into the build. The developer does not choose.

---

## 6. Cost Confidentiality (NFR-002, SPEC §14.1)

**Canary method.** `canaryMasters` gives every process rate, customer rate, material price, specific gravity, scrap rate and exchange rate a unique invented value with a rare digit pattern. The test calculates and approves an estimate, so every Restricted output exists in the database with a known value.

**Forbidden list.**
- Each sentinel, and each calculated output, as plain digits, in Indian grouping, in 2-decimal form.
- Rate names, `Material-Price`, `{{f:`, `{{rate:`, formula text.

**Scan.** Signed in as an Engineer, Playwright runs the journeys (queue, open task, tree, form, images, Calculate, after submit, after approve) while recording every response. It also calls every Engineer-reachable route in the manifest directly. Scanned: HTML, RSC flight payloads, JSON, headers, and the JS chunks the Engineer's pages load. Plus direct requests to all Lead and Admin routes as an Engineer, which must give 403 or 404 with no body data.

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
- **The warning path (CE-9).** The journeys include an estimate with an H of 0 on a part with parts below it, so the 409 body and the dialog are scanned. The 409 has one strict schema, with the same keys for Engineer, Lead and Admin. The same estimate, calculated under two different sets of `canaryMasters`, gives the same 409 body except `requestId`, which shows the warning depends on nothing Restricted. After an acknowledged Calculate, no Engineer response holds `warnings`, and no `engineer-*.ts` view reads `calculations.warnings` (the ESLint rule on cost repositories holds).
- `Cache-Control: no-store` on every authenticated response.

## 7. Authorisation and Security Tests

| Test | Requirement | Method |
|------|-------------|--------|
| Role matrix | FR-007, NFR-001 | Every manifest row, as each role and signed out; expected result from SPEC §3 |
| Manifest completeness | NFR-001 | Every `route.ts` and `page.tsx` appears; every handler uses `withRoute` |
| CSRF | NFR-003 | POST with a foreign `Origin` is refused on every state-changing route |
| Cookies | NFR-003 | HttpOnly, Secure, SameSite on staging over TLS |
| Lock-out | NFR-003 | 5 failures, 6th blocked for 15 minutes with a controlled clock; unknown e-mail takes the same path |
| Password rule | FR-098, BR-049 | One table, on the zod schema and on each of the five entry points: 9 and 129 characters; no number; no symbol; a space as the only symbol (accepted, ASSUMPTION-56); the user's e-mail in other letter case; `Password1!` and `Welcome@123` (refused after stripping). `bootstrap:admin` refuses a weak password. Sign-in with an existing password never runs the rule |
| Session | FR-099, A-23 | With a controlled clock, a request just before 12 hours after sign-in is accepted and one just after is refused, for a session used every minute, so activity does not extend it |
| Revocation | FR-004 | Deactivated user refused at the next request; role change effective at once |
| One Admin | FR-005 | Service refusal and direct SQL refusal |
| Step-up | NFR-004 | Three actions, four once FR-006 is built, refused without the password and with a wrong one (422 `STEP_UP_FAILED`, not 401); a wrong step-up does not block sign-in |
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

**Device definition for NFR-009.** Lighthouse CI mobile preset: simulated slow 4G (about 1.6 Mbps down, 150 ms round trip) with 4 times CPU slowdown. "Interactive" is measured as **LCP ≤ 2 s and Total Blocking Time ≤ 200 ms**, because Lighthouse no longer scores Time to Interactive. The five key screens are queue, workspace, cost view, masters and assign, signed in, on a production build.

| NFR | Scenario | Target | Tool | Where |
|-----|----------|--------|------|-------|
| NFR-008 | Recalculate `tree500`, 20 runs | p95 < 2 s | Timed integration test; record the machine | Nightly, staging |
| NFR-009 | Five screens | Above | Lighthouse CI | Nightly |
| NFR-010 | 25 virtual users, mixed page-data and save | p95 ≤ 500 ms | k6 | Staging, before release |
| NFR-010 | Export of 50 nodes with 50 images | p95 ≤ 10 s | k6 | Staging, before release |
| NFR-010 | Page latency while a 500-node export runs | p95 ≤ 500 ms | k6 | Staging, before release |
| NFR-011 | 25 and 50 virtual users | No errors; targets hold at 25 | k6 | Staging, before release |

The pre-design benchmark (architecture section 4.6, ADR-005, ADR-012) only shows feasibility. It does not replace these tests. Those numbers came from a laptop on Node 24, with no database.

## 9. Other Non-Functional Verification

| NFR | Method |
|-----|--------|
| NFR-012 | External monitor at 5-minute intervals; monthly reading |
| NFR-013 | Restore rehearsal on staging, including images, from an encrypted copy using the private key and the manifest; log time and result. The target is RPO ≤ 7 days under D-15. Retention with controlled dates: a copy just under 2 years old stays, one just over goes, and a good copy is never removed by a failed run. `backup-watch` with a controlled clock: a good run 7 days ago raises nothing, none in 8 days logs `error` and writes one outbox row, and a re-run writes no second row |
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
| FR-029, UX-06 | A parent's Σ BG, BJ and BK appear in the Lead data; the Engineer's data has none |
| UX spec §4 | A Lead's bell count equals their Overdue tab |
| NFR-018, UX-14 | At 360 px on SCR-05 and SCR-06, every field reached by Tab or Enter is fully visible above the action bar, also with the bar wrapped. Repeat on one real phone with the keyboard open |
| NFR-020, UX-13 | Every money value renders ₹ from a project font: check the glyph in each shipped font file |

**Added for SPEC v1.4.**

| Requirement | Test |
|-------------|------|
| FR-100, cleared totals | For each kind of input change (a number, Remarks, customer, image, add, delete, move, reorder): `/costs` returns no BL, BN, item totals, Tool Cost total or Σ figures, and a row's own values stay, flagged. Recalculate restores them |
| FR-100, no false clear | Autosave and a repeated PATCH with the same values, including `1.50` against `1.5`, do not bump `inputs_revision`. Change and change back stays cleared |
| FR-100, record kept | After clearing, the `calculations` row is unchanged, and the approved calculation is untouched by an unlock |
| FR-101, approval | Approve is refused with `NOT_CALCULATED` and `TOTALS_OUT_OF_DATE` by direct API call, not only from the screen. Two concurrent requests, an input save and an approve: the approve never succeeds on figures older than the save |
| FR-063, FR-100, unlock | Unlock with no input change keeps figures `current`, shows no current price, and needs a Recalculate before approval |
| FR-069, FR-070, Q-37, export | While `out-of-date`: `GET /export` without `allowOutOfDate` is 409. With it, read-back shows BL2, BN2, BO2 and the footer empty, the `_OUT-OF-DATE` file name, the `OUT OF DATE` tab and the notice row. While `current`, none of those appear. A change between `export-summary` and `export` still gives the 409 |
| FR-069, D-16, export | Read-back: BL2, BN2, BO2 once, no per-item totals, and the footer value equals the sum of the node rows in BM. BM2 still holds the first node's own value. Inserting a field before BM moves the footer with the column |
| FR-103, reason | Reason is stored and audited on an override, absent without one, dropped when the price is not an override, and refused over 500 characters. Script text renders as text |
| FR-018, hidden | `GET /materials`, `GET /treatments`, search and Admin pages hold no such entry; "Other" stays on the Admin's list. `GET /options/*` returns it. `PATCH` and `DELETE` on the fixed ID return 404, the same as a random ID. Creating that name in any letter case gives 422 `NAME_RESERVED`. The rows exist after `prisma migrate deploy` on an empty database, with no seed |
| FR-018, scrap | With "Not applicable" and N above 0: O = 0, M = 0, AK = 0, and AO, AQ and AS still calculate from N, so labour counts. On SCR-07's data, F and I are blank with no material operands. The export shows the words in E and blank F and I |
| A-21, no change elsewhere | For generated rows with a real material, O equals `M - N` exactly, including N above M, and every other output matches its formula in SPEC §7.4 |
| FR-022, formula language | `ROLLUP` is valid only in product-scope fields. `IF` accepts the six comparisons in its condition, and a comparison anywhere else is a validation error |

**Added at the UX v0.3 reconciliation (architecture section 16.9).**

| Requirement | Test |
|-------------|------|
| FR-100, A-18, single-piece product | CE-12 variant A, after an input change: `/costs` and `/nodes/{id}/costs` hold no BG, BJ or BK for that row, and BL is withheld, so the old total appears in no response. A part below an item keeps its own figures, flagged. Variant C: both items' totals are withheld. Recalculate restores them. The out-of-date file keeps the row, with its markers |
| FR-029, FR-100, Lead data | At `current` and `out-of-date`, `/costs` gives H and own BG, BJ and BK by node, except the row above. `/export-summary` gives H, BG and BM by row at both; the screen figure, multiplier and total Tool Cost only at `current`. At `none`, neither gives a row figure |
| FR-069, footer position | With 10 nodes in rows 2 to 11, row 12 is empty and row 13 holds the value in the Tool Cost column and the label in the cell to its left, in every state, value empty while `none` or `out-of-date`. Repeat with 1 node: the footer is row 4. With no Tool Cost, a `current` file shows 0 and BN2 is empty. While `out-of-date` the notice is in column A of row 14. Inserting a field before BM moves the value and label together |
| FR-103, reason | The reason appears in no cell of the exported file, in `/costs` and `/export-summary` for Lead and Admin, and in no Engineer response |
| FR-015, UX-37 | `POST` and `PATCH /materials` refuse Specific Gravity of 0 or below with 422. The hidden row stays at 0 |
| FR-063, FR-100 | `/costs` gives the unlock's who, when and reason, in Draft after unlock and in Unlocked and changed |
| FR-019, sender | A stubbed 5.7.60 refusal gives `SENDER_NOT_ALLOWED`, with no secret in the response or the log |

## 10. CI Pipeline Stages

No workflow exists yet; the scaffold story adds `.github/workflows/ci.yml`. The repository is public, so logs are public. CI holds no production secret, and fork pull requests get none.

| # | Stage | Command or tool | Blocks merge |
|---|-------|-----------------|--------------|
| 1 | Install | `npm ci` | Yes |
| 2 | Secret scan | Gitleaks, full history | Yes |
| 3 | Data-file check | Allow-list script | Yes |
| 4 | Lint | `npm run lint` | Yes |
| 5 | Type-check | `npm run typecheck` | Yes |
| 6 | Unit, with coverage | `npm test` | Yes |
| 7 | Dependency audit | `npm audit --omit=dev --audit-level=high` | Yes, at high or above |
| 8 | Licence check | Allow-list with the named exceptions (architecture section 11) | Yes |
| 9 | Build | `npm run build` | Yes |
| 10 | Migrations | `prisma migrate deploy` on an empty database; drift check | Yes |
| 11 | Integration, contract, security, export | Vitest with Postgres | Yes |
| 12 | E2E | `npm run test:e2e` (Chromium, 3 widths, axe, canary scan) | Yes |
| 13 | Image | Docker build; run and check `/api/health` | Yes, on `master` |
| Nightly | Full browser matrix, Lighthouse, 500-node timing | Scheduled | Reported; failure raises a bug |
| Pre-release | k6, restore rehearsal, manual Excel, one real mail send | Manual | G8 evidence |

Flaky test policy: quarantine with a ticket within a day; never delete to make a build pass. Retries are off in unit and integration tests. Playwright allows 1 retry and reports it. Canary and role-matrix tests are never quarantined.

## 11. Coverage Targets

| Scope | Target | Source |
|-------|--------|--------|
| Changed code in a PR | ≥ 80 % | Coding standards |
| Whole package | ≥ 80 % | Coding standards |
| `src/lib/formula/**` | ≥ 95 % | FR-022, NFR-025 |
| `src/lib/rollup/**` | ≥ 95 %; `quantity-step.ts` 100 % of branches | This strategy, condition 5 |
| `src/lib/estimate/figure-state.ts`, `src/lib/auth/password-rule.ts` | 100 % of branches | FR-098, 100, 101 |
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

**Acceptance test 2 and BL.** BL is checked with the rule in SPEC §7.4 (each BG times the H of every row above it), per SPEC §14.2, which equals `SUM(BG)` when every quantity is 1. The item's own row with values and an item quantity above 1 is asserted through CE-2 and CE-12, from their Q-35 (a) number, and the roll-up story cannot pass G7 with either pending (section 5.6). FR-056's fit is tested with the item quantity at 1 and 2, on a tree whose parent has H above 0 (CE-9 covers H = 0).

## 13. Change Log

| Version | Date | Change |
|---------|------|--------|
| 0.1 | 2026-11-01 | First draft for G3 |
| 0.2 | 2026-11-01 | UX reconciliation: tests for one route one schema, uniform not-found, typed values in the canary scan, Admin guards, system fields, open redirect, reset page, override rounding, renames after approval, undo of a revert, printed workings, sticky offsets and the ₹ glyph. PRD reference and FR-056 note updated |
| 0.3 | 2026-11-01 | SPEC v1.4 and PRD v0.6. Section 5 rewritten for every level's quantity: CE-1 is now 30 (24 lids), CE-6 246, CE-7 BN 6; CE-2 pending Q-35; CE-9 to CE-11 added; own-quantity-once test; property tests compare at 2 decimals; rule-change rehearsal retired. Added tests for cleared totals, the export markers and footer, optional reason, hidden entries, Scrap Weight, password rule, session, backup retention and watch, mail sign-in modes. Accessibility gate moves to WCAG 2.2 AA with PRD v0.6 |
| 0.5 | 2026-11-01 | The delivery lead's answers. CE-9 rewritten for Warn (AQP-15 comment 10511), with six tree variants and levels for the acknowledgement, a stale acknowledgement, what is recorded and what the Lead sees; the DL-013 block is gone. Warning path added to the canary scan (section 6). Variants E and F pin a part with nothing below it, which stays unanswered. Q-35 (a) answered 1000 (AQP-14 comment 10510): ASSUMPTION-51 confirmed, CE-2 asserted at 316, CE-12 at 15, 5 and 17, with new variant D carrying their example at 1000. The other reading is now a named wrong answer. Section 5.6 control 1 met. Values re-run through a throwaway script on 2026-11-01 |
| 0.4 | 2026-11-01 | G3 condition 14. CE-12 added: a childless top-level item at quantity above 1. CE-9 rewritten for DL-013: never pending, block as fallback. CE-2 no longer `it.todo`; new section 5.6 and test `quantity-cases-complete` stop it, or CE-12, staying pending at G7. Tests added from the UX v0.3 reconciliation: single-piece product while cleared, Lead data by state, footer and notice row by number, reason in no cell, Specific Gravity on the server, sender refusal. PRD v0.7: temporary password, four step-up actions, sign-in `noindex`. BM added to the system fields |
