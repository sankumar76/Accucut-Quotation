# Technical Test Strategy — Accucut Quotation Portal

| Field | Value |
|-------|-------|
| Version | 0.1 (G3 draft) |
| Owner | solution-architect |
| Status | In Review (G3) |
| Date | 2026-11-01 |
| Inputs | PRD v0.4; SPEC v1.3 §14, §18.5; `architecture.md` v0.1; `coding-standards.md` |
| Used by | `qa-engineer`, whose test plan builds on this; `developer` |

**Rule for all test data.** Every value here and in every fixture is invented. No cell value from the sample workbook is used, here or anywhere, and no real master data (NFR-006, ADR-014). Sample structure may be read for headers, widths and formats only.

---

## 1. Principles

1. The risks decide the depth. The three that matter most are a cost leak, a wrong price and a changed approved estimate.
2. Real PostgreSQL in integration tests. No mocked database: triggers, partial indexes, locks and JSONB are part of the design.
3. Mock only at external boundaries: SMTP (Mailpit) and the clock (`Clock` argument).
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
| Accessibility | WCAG AA | qa-engineer | axe, keyboard run | `tests/e2e/a11y/` | Every PR; manual per release |
| Performance | NFR-008 to 011 | qa-engineer | Vitest timing, k6, Lighthouse CI | `tests/perf/` | Timing and Lighthouse nightly; load before release |
| Export | File fidelity | qa-engineer | ExcelJS read-back, Excel desktop | `tests/integration/export/` | Every PR; manual open per release |
| Operational | Install, backup, restore | qa-engineer, IT contact | Scripts, stopwatch | Rehearsal log | Before go-live |

## 3. Risk-Based Priorities

| Area | Impact | Likelihood | Depth |
|------|--------|-----------|-------|
| Cost confidentiality (NFR-002) | Critical | Medium | Layers plus canary scan on every build |
| Roll-up and quantity (FR-029, 030) | Critical | Medium | Constructed examples, property tests, single-place tests |
| Row formulas (FR-024) | Critical | Low | One test per formula; end-to-end tree |
| Approved immutability (NFR-026) | High | Low | Regression test, DB refusal tests |
| Role enforcement (NFR-001) | High | Medium | Full matrix |
| Configuration edits (FR-074 to 078) | High | Medium | Property tests, SPEC §14 items 6 to 8 |
| Export fidelity (NFR-027) | High | Medium | Read-back, checklist, manual open |
| E-mail (NFR-014) | Medium | Medium | Controlled-clock tests |
| Responsive, accessibility | Medium | Medium | Automated at each width |

## 4. Environments and Test Data

| Environment | Database | Mail | Data |
|-------------|----------|------|------|
| Local | Docker Postgres 17 | Mailpit | Invented placeholders |
| CI | Postgres 17 service, one schema per Vitest worker | Mailpit service | Invented placeholders |
| Staging | Same Compose file | Mailpit, then a real SMTP test once Q-18 is answered | Invented placeholders |

**Fixtures.**

| Fixture | Contents | Used for |
|---------|----------|----------|
| `seedConfig` | SPEC §7 registry; the same module production seeds from | All |
| `placeholderMasters` | Invented rates, materials and exchange rates; each number follows the fixed pattern `n.37` | Dev, CI |
| `canaryMasters` | Every Restricted value set to a unique sentinel (section 6) | Security |
| `quantityCases` | The constructed examples (section 5) | Roll-up |
| `acceptanceTree` | Nodes 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5 with invented inputs and hand-calculated outputs in a table reviewed before the test runs | SPEC §14.2 |
| `tree500` | Generated 500 nodes, depth up to 6 | Performance |
| `images` | PNG, JPG, GIF, WebP; 199 × 1024 and 201 × 1024 bytes; a text file renamed `.png`; a polyglot | Uploads |

Builders in `tests/support/` construct data; tests never depend on each other's rows. A test checks that every number in `placeholderMasters` matches the pattern, so a pasted real value fails (ADR-014). Parallel-run data (TR-004) stays outside the repository and its results are not committed.

---

## 5. Roll-up and the Quantity Step (G2 condition 5)

### 5.1 Oracle

SPEC §7.4 BL, §18 D-08 and D-12, §18.5. Expected values are worked by hand here, before any code exists. The sample has quantity 1 on every row and cannot test quantities, so these constructed cases are the test.

**What this does not prove.** These cases encode D-12. If Q-32 (a) is wrong, they pass on a wrong rule, as does a parallel run against a worksheet calculated the same way (RISK-002). Only the delivery lead's own-words confirmation (DL-006) covers that.

### 5.2 Constructed cases (`tests/unit/rollup/quantity-cases.ts`)

"Per-unit cost" is a row's cost before its own quantity. So stored BG = per-unit cost x H.

**CE-1: the FR-030 example (SPEC §18.5).**

| Row | H | Per-unit cost | Stored BG (row) | Displayed figure | Export row BG |
|-----|---|---------------|-----------------|------------------|---------------|
| Item I | 2 | 0 | 0 | 7 | 0 |
| Part P | 3 | 1 | 3 | 7 | 3 |
| Sub-part S | 4 | 1 | 4 | 4 | 4 |

**Expected:** item total = 2 x (0 + 3 + 4) = **14**. BL = **14**. S counts 2 x 4 = 8 times, P counts 2 x 3 = 6 times. P shows 3 + 4 = 7, not multiplied again by 3.

Each wrong answer below names a specific defect, so the failure message tells the developer which.

| Wrong BL | Means |
|----------|-------|
| 30 | Multiplied at every level (S counted 24 times) |
| 36 | Displayed figures were summed: parents counted twice |
| 7 | Item quantity not applied |
| 42 | P's sum multiplied again by its own quantity, against D-12 (b3): 2 x (3 x 7) |

**CE-2: SPEC §18.5 algebra, with an item row that has its own values.** cI = 5, cP = 7, cS = 11. Item 2, part 3, sub-part 4.

| Check | Working | Expected |
|-------|---------|----------|
| Stored BG | 2 x 5; 3 x 7; 4 x 11 | 10; 21; 44 |
| Item total | 2 x (10 + 21 + 44) | **150** |
| Same by the formula | 4 cI + 6 cP + 8 cS = 20 + 42 + 88 | **150** |
| Displayed P | 21 + 44 | 65 |
| Displayed I | 10 + 21 + 44 | 75 |

This covers D-12 (c): the item's own row counts the item quantity twice, 4 times its per-unit cost.

**CE-3: two top-level items (D-12 (d)).** Item A quantity 2 and item B quantity 3, each with 0 on its row and one child of quantity 1 and per-unit cost 1. **BL = 2 + 3 = 5.** A single multiplier over the whole sum would give 4 or 6.

**CE-4: a parent's own cost counts (D-12 (b1), (b2)).** Item quantity 1. Parent P quantity 1, per-unit cost 10. Child S quantity 1, per-unit cost 5. **BL = 15.** Displayed P = 15, export row P = 10, export row S = 5. A children-only reading gives 5. No warning is raised for the non-zero parent.

**CE-5: all quantities 1.** BL equals a plain `SUM(BG)` over the rows, for a random tree. This is the worksheet's result at quantity 1 (SPEC §18.5).

**CE-6: a deep chain.** Item quantity 2, per-unit cost 0. Below it A quantity 3, B quantity 5, C quantity 7, one under the other, each with per-unit cost 1. Stored BG 3, 5, 7. **BL = 2 x 15 = 30.** Multiply-at-every-level would give 2 x (3 + 3 x 5 + 3 x 5 x 7) = 246.

**CE-7: BN (FR-025).** BL 14; Tool Cost 2 on one node and 3 on another: **BN = 14 / 5 = 2.8**. With no Tool Cost, BN is `null`, shown as "—", with an empty export cell.

**CE-8: divide by zero (A-07).** Exchange rate USD 0: BJ is "—" on the row and on any parent, BG and BL are unaffected, no error. A formula that makes a row's BG `null` gives a BL of "—", never a lower number.

### 5.3 Through the real evaluator

Each case above runs twice:
1. **Unit:** `rollUp` directly, with stated BG.
2. **Integration:** a real estimate through `calculation-service` with the seed configuration. Machining Cost (AP) carries the per-unit cost, all other inputs are 0, all percent rates 0. Then AY = AP, BA = AP, BB = AP x H, BG = BB, so a per-unit cost travels through every stage, and the result is read from `calculations` and `calculation_rows`.

Also on the integration path: the export of CE-1 shows row BG of 0, 3, 4 and BL2 = 14, and the screen DTO shows 7, 7, 4.

### 5.4 Holding the step to one place

| Test | Assertion |
|------|-----------|
| `quantity-step-single-importer` | Only `src/lib/rollup/roll-up.ts` imports `quantity-step.ts` |
| `quantity-step-unit` | Direct table test of both levels, `null` and 0 quantity. 100 % branch coverage |
| `no-rollup-of-rollup` | `RolledUpFigures` does not type-check as a `RowOutputs` input (a `@ts-expect-error` test) |
| `export-reads-outputs` | Export model built from a record whose `rollup` holds a marker value contains no marker |
| `rule-change-rehearsal` | In a test only, a copy of the step with `'into-parent'` multiplying gives CE-1 = 30 and CE-6 = 246. This proves the seam: changing one branch changes the results as predicted |

If the delivery lead's Q-32 (a) reply differs from D-12: change the branch and the "Expected" values above, and nothing else in code. SPEC §7.4 BL, BR-047, FR-030 and GOAL-03 change through their owners (G2 condition 1).

### 5.5 Properties

Fast generated trees, in Vitest, with no extra library needed:

- BL = Σ over items of H(item) x Σ of row BG in that item's subtree.
- The displayed figure of a node = its row BG + the sum of its children's displayed figures.
- Renumbering, reordering or moving a node within its item leaves BL unchanged.

---

## 6. Cost Confidentiality (NFR-002, SPEC §14.1)

**Canary method.** `canaryMasters` gives every process rate, customer rate, material price, specific gravity, scrap rate and exchange rate a unique invented value with a rare digit pattern. The test calculates and approves an estimate, so every Restricted output exists in the database with a known value.

**Forbidden list.**
- Each sentinel, and each calculated output, as plain digits, in Indian grouping, in 2-decimal form.
- Rate names, `Material-Price`, `{{f:`, `{{rate:`, formula text.

**Scan.** Signed in as an Engineer, Playwright runs the journeys (queue, open task, tree, form, images, Calculate, after submit, after approve) while recording every response. It also calls every Engineer-reachable route in the manifest directly. Scanned: HTML, RSC flight payloads, JSON, headers, and the JS chunks the Engineer's pages load. Plus direct requests to all Lead and Admin routes as an Engineer, which must give 403 or 404 with no body data.

**Negative control.** A test-only route returns one sentinel, and the scanner must report it. If the scanner cannot find a planted leak, the suite fails.

**Also asserted.**
- Calculate's Engineer response equals exactly `{status, message}`.
- No `calculation_rows` import reachable from Engineer views (ESLint; a test confirms that the rule fires).
- E-mail bodies contain no forbidden string.
- `Cache-Control: no-store` on every authenticated response.

## 7. Authorisation and Security Tests

| Test | Requirement | Method |
|------|-------------|--------|
| Role matrix | FR-007, NFR-001 | Every manifest row, as each role and signed out; expected result from SPEC §3 |
| Manifest completeness | NFR-001 | Every `route.ts` and `page.tsx` appears; every handler uses `withRoute` |
| CSRF | NFR-003 | POST with a foreign `Origin` is refused on every state-changing route |
| Cookies | NFR-003 | HttpOnly, Secure, SameSite on staging over TLS |
| Lock-out | NFR-003 | 5 failures, 6th blocked for 15 minutes with a controlled clock; unknown e-mail takes the same path |
| Revocation | FR-004 | Deactivated user refused at the next request; role change effective at once |
| One Admin | FR-005 | Service refusal and direct SQL refusal |
| Step-up | NFR-004 | Three actions refused without the password, and with a wrong one |
| Uploads | NFR-005 | 199 × 1024 accepted; 201 × 1024, renamed text, polyglot refused |
| Stored XSS | NFR-005 | Script payload in every text field renders as text |
| Export text | Section 8 of `architecture.md` | A value starting `=` is a string cell, not a formula |
| Audit | NFR-007 | One test per event type; direct `UPDATE` and `DELETE` refused |
| Immutability | NFR-026 | Direct `UPDATE` on `calculations`, `calculation_rows`, `config_versions` refused |
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
| NFR-013 | Restore rehearsal on staging, including images; log time and result |
| NFR-014 | Controlled clock with Mailpit: To and Cc correct, alerts OFF sends none, 11:00 IST digest, re-run sends 0, failures retried 3 times, catch-up after a restart |
| NFR-015 | Deadlines at 23:30 IST and at 03:00 IST (the previous date in UTC) show the right IST date; overdue flips at the right moment; year boundary for task IDs taken in IST |
| NFR-016 | Playwright at 360×800, 768×1024, 1024×768, 1366×768, 1920×1080, portrait and landscape: `scrollWidth ≤ clientWidth`; primary actions in view |
| NFR-017 | Bounding box of every interactive control ≥ 44 px on touch projects |
| NFR-018 | axe with tags `wcag2a`, `wcag2aa`, `wcag21aa` at 3 widths as the gate; `wcag22aa` reported only, until the PRD decides (UX C-4); manual keyboard run of key flows |
| NFR-019 | Playwright chromium, firefox, webkit nightly; one real phone per release |
| NFR-020, 021 | Design checklist; search for raw colours; hash of the logo file; contrast checks |
| NFR-022 | Each route: title ≤ 60, description ≤ 160, Open Graph tags, `noindex` behind sign-in, no forbidden strings |
| NFR-023 | UX review |
| NFR-024 | Injected fault in a route and a job: logged with time, request ID and user ID, and no secret |
| NFR-025 | CI thresholds, section 11 |
| NFR-026 | Approve, change masters and configuration, compare screen DTO and export values |
| NFR-027 | SPEC §14.12 by read-back; manual open in Excel desktop per release |
| NFR-028 | Repository scan; Q-26 answer |
| NFR-029 | Inspection |
| NFR-030 | Timed walk-through on a clean VM by someone who did not write the README |

**Regression for FR-047:** paste, drag and file choice; the phone camera path once on a real device.

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
| Pre-release | k6, restore rehearsal, manual Excel | Manual | G8 evidence |

Flaky test policy: quarantine with a ticket within a day; never delete to make a build pass. Retries are off in unit and integration tests. Playwright allows 1 retry and reports it. Canary and role-matrix tests are never quarantined.

## 11. Coverage Targets

| Scope | Target | Source |
|-------|--------|--------|
| Changed code in a PR | ≥ 80 % | Coding standards |
| Whole package | ≥ 80 % | Coding standards |
| `src/lib/formula/**` | ≥ 95 % | FR-022, NFR-025 |
| `src/lib/rollup/**` | ≥ 95 %; `quantity-step.ts` 100 % of branches | This strategy, condition 5 |
| Route manifest | 100 % of routes in the role matrix | NFR-001 |
| Engineer-reachable routes | 100 % in the canary scan | NFR-002 |
| SPEC §14 items | 14 of 14 automated, except the Excel-desktop open | GOAL-03, 04 |

## 12. SPEC §14 Acceptance Map

| Item | Covered by |
|------|------------|
| 1 Engineer sees no cost | Section 6 |
| 2 Outputs match to 2 decimals | One unit test per formula; `acceptanceTree`; section 5 for BL |
| 3 Sl. No renumbers | Unit (`lib/estimate/tree`), E2E |
| 4 Calculate validation | Integration, E2E |
| 5 Hidden treatment lines | View test, export read-back |
| 6 Insert after AX | Integration, property test, export read-back (R2) |
| 7 Delete referenced field | Integration (R2) |
| 8 Revert | Integration, including approved estimate unchanged (R2) |
| 9 Step-up, invalid formula | Integration (R2) |
| 10 Master sync | Integration (R1+) |
| 11 E-mails | Controlled-clock tests (R2) |
| 12 Export | Read-back; manual Excel |
| 13 No horizontal scroll | Playwright |
| 14 One Admin | Integration; direct SQL |

**Acceptance test 2 and BL.** BL is checked against `H(item) x SUM(BG)` over the item's rows, per SPEC §14.2. `FR-056`'s fit ("BL equals the sum of the children") holds only at item quantity 1; the test uses that or times the item quantity, as G2 condition 3 notes.

## 13. Change Log

| Version | Date | Change |
|---------|------|--------|
| 0.1 | 2026-11-01 | First draft for G3 |
