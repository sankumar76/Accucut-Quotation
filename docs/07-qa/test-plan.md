# Test Plan: Accucut Quotation Portal (scope A, one hand-over)

| Field | Value |
|-------|-------|
| Owner | qa-engineer |
| Version | 0.3 (2026-11-21: final-regression scope, section 7.1, and the commands of section 17 checked against `package.json` and the CI stages; the change log has the detail). 0.2.1 (AQP-169 renumbering applied to sections 4, 8 and 15; 0.2 was G4 remediation 10: AQP-1 comments 10573 and 10574 and DL-035 applied to sections 4, 5, 9, 12, 13, 14 and 18; v0.1 was the first issue, for G4, answering G3 condition 15 and CR-20) |
| Date | 2026-11-21 (version 0.3; first issue 2026-11-02) |
| Status | Live. The product is built (all stories merged; hardening window under CLAUDE.md section 9 item 3, before G8). The commands in section 17 are the ones the CI runs, read from `package.json` and `.github/workflows/ci.yml`. The final regression has **not** been run yet: it starts after the hardening merges listed in section 7.1 land, on the delivery lead's word |
| Based on | PRD v0.10 (FR-001 to FR-108, NFR-001 to NFR-030, 12.2); `test-strategy.md` v0.9; SPEC v1.12 (section 14, section 18.5); `architecture.md` v0.9 (9.5, 16.14); `ux-spec.md` v0.6 (8, 10); `backlog.md` v0.2 (88 candidate stories); DL-017, DL-026; consistency report v0.2 (CR-20) |
| Used by | master (G4 check of condition 15), scrum-master and product-owner (testability of story ACs), developer, the delivery lead (usability test and restore rehearsal need Accucut people) |

**Rule for all test data.** Every value in this plan, in every fixture and in every session script is invented. No cell value from the sample workbook is used, here or anywhere (NFR-006, ADR-014). Sample structure may be read for headers, widths and formats only.

**What this plan is, and is not.** `test-strategy.md` is the architect's technical design: the levels, the fixtures, the oracle for the quantity rule, the CI stages. This plan is QA's: what is verified for each story, by whom, with what evidence, at which gate; the human checks the strategy cannot automate; and the commands. Where the two overlap this plan points to the strategy section and does not copy its tables, except the expected values of the CE cases (section 10), which G7 checks. If a number here and in the strategy differ, the strategy wins and this plan is corrected.

---

## 1. Objectives and Scope

### 1.1 Objectives

1. Give the master independent, evidence-based grounds at each G7 that a story does what its acceptance criteria say and nothing harmful that they do not.
2. Protect the three risks that matter most (strategy section 3): an Engineer receiving any cost, a wrong price, and a changed approved estimate.
3. Verify the things automation cannot: the portal on a real phone, with a screen reader and in Windows high-contrast mode; whether Accucut staff read the figures correctly; whether the Admin can restore a backup from the README alone.
4. Keep one regression suite that is cheap enough to run on every story and strong enough to be trusted at G8.

### 1.2 In scope

- Scope A: EPIC-01 to EPIC-10, 101 FRs, the 88 candidate stories of `backlog.md` v0.2, and SPEC section 14 items 1 to 17.
- NFR-001 to NFR-030 as the strategy assigns them (sections 8 and 9 of the strategy); this plan adds when each is checked (section 15).
- Human checks: device and assistive-technology checks (section 12), the usability test (section 13), the restore rehearsal (section 14).

### 1.3 Out of scope

- Offline use (FR-092), dark mode (FR-090), the UI-sample extras (FR-097), import of past estimates (FR-096), drawing input (FR-093). Absent features get one check: they are not present.
- The loss of the server or its disk. It loses the live data and every backup together; nothing can be recovered and nothing can be tested (strategy section 3; NFR-013). The plan does not claim otherwise.
- Whether an Engineer types the right count for the whole order (ARCH-R6). A wrong count is a valid estimate. Only the usability test (section 13) looks at this, and only for the people in the room.
- Whether the hosting, mail account and network are correct at Accucut. Those are checked once, at the real send and the first deployment (section 15), not tested.
- Production. QA never runs a test against a production or shared environment (section 4).

### 1.4 Assumptions (labelled; none is a decision)

| ID | Assumption | If wrong |
|----|------------|----------|
| QA-A1 | Test folders follow the strategy: `tests/unit`, `tests/integration`, `tests/security`, `tests/acceptance`, `tests/e2e` (with `tests/e2e/a11y`), `tests/perf`. The QA role definition mentions `e2e/`; the project's own convention wins | Move the files; no test changes |
| QA-A2 | Playwright has three projects for mobile, tablet and desktop widths, as `CLAUDE.md` describes. Their names are not known; this plan writes `--project=<name>` | Edit section 17 |
| QA-A3 | A story's acceptance criteria are written in Jira with IDs `AC-1`, `AC-2` and so on. None exists yet | The AC matrix in each test report uses whatever IDs Jira shows |
| QA-A4 | Until Jira keys exist, a test is named with the provisional story ID (`STORY-03.04`); the Jira key is added when the scrum-master creates the story | Rename only |
| QA-A5 | **Answered (10573, 10574, DL-035).** The delivery lead provides the devices, sits with the testers at the usability test, and acts as both Admin and IT for the validation rehearsal. The actual Admin repeats the rehearsal at hand-over. QA supplies the scripts, data, forms and analysis, and does not sit in the room | Sections 13 and 14 |
| QA-A6 | **Answered in part (10573).** The picture limit is **204,800 bytes** (200 x 1024). Whether a file of exactly 204,800 bytes is accepted is unanswered; the labelled assumption is that "under" means it is **refused**. Boundary tests: 204,799 accepted, 204,800 refused, 204,801 refused, plus the strategy's 199 x 1024 and 201 x 1024 | If the delivery lead says exactly 204,800 is accepted, one expected value flips |

---

## 2. Test Approach

| Level | Purpose | Owner | Tooling | Location | Entry / exit |
|-------|---------|-------|---------|----------|--------------|
| Unit | Formula engine, tree, state machine, validation, time, columns | developer | Vitest | `tests/unit/` | Entry: code written. Exit: green, coverage targets (strategy 11) |
| Integration and contract | Services and routes against real PostgreSQL; migrations, triggers, grants; strict route schemas | developer; QA reviews and adds negative cases | Vitest, Postgres 17 | `tests/integration/` | As above. No mocked database |
| Security | Role matrix, canary scan, CSRF, cookies, uploads, step-up | developer writes the base; **QA owns the independent pass** (section 11) | Vitest, Playwright | `tests/security/` | Never quarantined (strategy 10) |
| Acceptance | Each story's ACs and SPEC section 14 | **qa-engineer** | Vitest, Playwright | `tests/acceptance/` | Entry: G6 passed. Exit: G7 |
| E2E | Critical journeys at three widths | qa-engineer | Playwright (Chromium every PR; three browsers nightly) | `tests/e2e/` | As above |
| Accessibility | WCAG 2.2 AA, automated and manual | qa-engineer | axe via Playwright; keyboard run; section 12 | `tests/e2e/a11y/` | 0 AA violations on every delivered screen |
| Export | File fidelity | qa-engineer | ExcelJS read-back; Excel desktop by hand | `tests/integration/export/` | Read-back every PR; manual open per release |
| Performance | NFR-008 to 011 | qa-engineer | Vitest timing, Lighthouse CI, k6 | `tests/perf/` | Nightly and pre-release (section 15) |
| Operational | Install, backup, restore | qa-engineer with the IT person and the Admin | Scripts, stopwatch | Rehearsal log (section 14) | Before go-live; G8 evidence |
| Usability | Do people read the figures correctly | qa-engineer plans and analyses; Accucut staff take part | Script, observation form | Section 13 | After hand-over, during acceptance |
| Exploratory | Risk discovery | qa-engineer | Charters (section 16) | In the test report | Time-boxed, once per story at G7 on the charters its risk area matches |

**Independence.** The developer writes unit and integration tests for their own code. QA does not repeat them. QA writes the acceptance test for each AC from the AC text and the oracle (the strategy, the PRD fit criterion), without reading the implementation first; reads the developer's tests for gaps afterwards; and adds negative and boundary cases the developer did not. QA never edits production code, and never weakens or deletes an existing test to get green (a flaky test is a defect of type Test).

**Techniques, named per area** (applied explicitly in each report): equivalence partitioning and boundary-value analysis for every typed input (password length, decimals, picture size, comment length, quantity of 0 and fractions); decision tables for the business rules (who may do what, section 9 epic 06; the Warn cases CE-9); state transitions for the estimate status flow and the approval, cancel and remove sequence; error guessing from the review findings and from the charters in section 16.

**AC traceability.** A test title begins `[STORY-nn.mm AC-n]` (later `[AQP-nnn AC-n]`). The test report's AC matrix is built from those titles. A test that cites no AC is infrastructure and says so.

**Testability review at Definition of Ready.** QA reads each story's ACs before it reaches Ready and returns to the product-owner any AC that cannot be tested as written (no number, no observable result, two readings). QA does not interpret it. No story has ACs yet, so this has not started.

---

## 3. Risk-Based Prioritisation

Tier A gets the deepest checks and the earliest independent pass; B gets the standard set; C gets automation only. Risk is impact times likelihood, from the strategy (section 3), the review findings once G6 reports exist, and the risk register.

| Tier | Area | Impact | Likelihood | Depth (this plan) |
|------|------|--------|-----------|-------------------|
| A | Cost confidentiality (NFR-002, FR-008) | Critical | Medium | Strategy layers plus the canary scan on every build, a QA-owned second scan, a negative control (section 11). Every Engineer-reachable change reruns it |
| A | Product total and the quantity rule (FR-029, 030, 104) | Critical | Low | CE-1 to CE-12 asserted from the first commit, properties, no case pending at G7 (section 10); the parallel run against the worksheet (TR-004) is outside the repository |
| A | Cleared totals and approval (FR-100, 101, 062) | Critical | Medium | Server-side refusal by direct API call, concurrency cases, every input-change kind (section 9, epics 05 and 06) |
| A | Approved immutability, cancel and remove (NFR-026, FR-107, 108) | High | Low | Approve, change masters, compare screen and export; direct SQL refusals |
| A | Backup and restore (NFR-013, FR-091, 105) | High | Medium | Scripted failure paths at 10.11's G7; the Admin's rehearsal before G8 (section 14) |
| B | Role enforcement (NFR-001) | High | Medium | Every manifest row as every role; completeness test |
| B | Export fidelity (NFR-027) | High | Medium | Read-back, checklist, manual open in Excel |
| B | Count typed on each row (ARCH-R6) | Critical | Medium | **Cannot be tested.** CE-2 variant C pins that the count is taken as typed. The hint and H beside each row are checked in E2E; people reading it are checked in the usability test |
| B | Configuration edits (FR-074 to 078, Release 2) | High | Medium | Property tests, SPEC items 6 to 9 |
| B | Responsive and accessibility (NFR-016 to 018) | Medium | Medium | Automated at three widths plus section 12 by hand |
| C | E-mail (NFR-014) | Medium | High until the account is known | Controlled clock with Mailpit; **a real send is the only proof** (OQ-ARCH-11) |
| C | Metadata, About, loading states | Low | Low | Automated tag check; inspection |

**Risk signals to add as they appear.** Each G6 `consolidated.md` is read before that story's test design; a finding in a Tier A area raises that story's depth by one level. No review exists yet.

---

## 4. Environments, Test Data and Tools

### 4.1 Environments

| Environment | Database | Mail | Data | Who may run what |
|-------------|----------|------|------|------------------|
| Local | Docker Postgres 17 | Mailpit | Invented placeholders | Everything except the human checks |
| CI | Postgres 17 service, one schema per Vitest worker | Mailpit service | Invented placeholders | Everything automated. No production secret; forks get none |
| Staging | The same Compose file, a separate project (A-01) | Mailpit; one real send once OQ-ARCH-11 is answered | Invented placeholders | k6, the rehearsal, the usability test, the real-send check |
| Production | Not a test environment | | | **QA runs nothing here.** The `/api/health` check after a deployment is the IT person's |

**Guard against the wrong database.** Before any suite touches a database, a global setup must refuse to run unless the connection is local, CI or the staging project, and must refuse when `NODE_ENV` is production. QA asks STORY-10.01 for this guard and tests that it refuses (a deliberate bad URL). Until it exists, QA confirms the connection string by eye before every run.

### 4.2 Test data

Fixtures are the strategy's (section 4): `seedConfig`, `placeholderMasters` (every number follows the pattern `n.37`), `canaryMasters`, `quantityCases`, `hiddenEntries`, `acceptanceTree`, `tree500`, `images`. QA adds, in `tests/support/`:

| Fixture | Contents | Used for |
|---------|----------|----------|
| `usabilitySheet` | A printed-sheet version of one typical part with 25 invented inputs, and a second sheet for the frame, pipes and lids example. Values follow the `n.37` pattern | Section 13, task 1 |
| `usabilityEstimates` | Three invented estimates: one calculated and current, one with a changed input (cleared), one with a quantity warning on record. Customer names are invented | Section 13, tasks 4 and 7 |
| `rehearsalMarkers` | An invented user, an invented customer and one estimate created after the last good copy, so a restore visibly removes them | Section 14 |
| `qaCanaryRoutes` | The list of Engineer-reachable routes taken independently from the file system, not from the developer's manifest | Section 11 |

A test checks that every number in `placeholderMasters` and the usability fixtures matches the pattern, so a pasted real value fails (ADR-014). QA does not open the sample workbook for values. Parallel-run data (TR-004) stays outside the repository and its results are not committed.

### 4.3 Tools and gaps

None of these exists yet. Each is a dependency, owned by the story named.

| Need | Tool | Arrives with | Gap if absent |
|------|------|--------------|---------------|
| Test runner, coverage | Vitest and its coverage provider | 10.01 | No gate |
| Browser tests, three widths, trace | Playwright | 10.01 (config), 10.08 (suites) | No E2E |
| Accessibility scan | axe through Playwright | 10.08 | No automated a11y gate |
| Secret scan | Gitleaks | 10.01 | A public repository without a scan (RISK-006) |
| Mail capture | Mailpit | 10.01 (Compose) | No e-mail tests |
| Load and page timing | k6, Lighthouse CI | 10.09, 10.10, 07.05 | No NFR-009 to 011 evidence |
| Excel read-back | ExcelJS | 07.01 | No file checks |
| A real phone, ideally low end, Android with Chrome and an iPhone with Safari | Hardware | **Provided by the delivery lead (10573).** One phone was offered, so one platform is covered; each report names the phone, system and browser used, and the other platform goes on the list of checks not run that G8 shows (DL-035) | One platform unchecked |
| A Windows PC with a screen reader, and a Windows contrast theme | Hardware, software | **Provided by the delivery lead (10573).** Each report names the screen reader and its version (NVDA is the plan's assumption) | Section 12 cannot start |
| Excel desktop | Software | **Provided by the delivery lead (10573)** | No manual open of the export |
| A staging host with the Admin's limited account | Hosting, Accucut IT | A-35, OQ-ARCH-03 | No rehearsal |

---

## 5. Entry and Exit Criteria

**Story entry (QA starts the acceptance run).** G6 passed; the branch builds; `npx eslint .`, `npx tsc --noEmit` and `npx vitest run` are green on the branch; the test environment is up; the story's ACs were reviewed for testability at Ready.

**Story exit (the recommendation is ACCEPT).** All of:
- every AC has at least one test or a recorded manual check, with evidence, and passes;
- the full regression (section 7) is green, with the commands and counts in the report;
- the non-functional checks that apply to the story (accessibility for any UI change; the canary scan for any Engineer-reachable change; timing where the story names a number) pass;
- at least one exploratory session on the charter that matches the story's risk (section 16) is recorded;
- no open Sev-1 or Sev-2 defect against the story;
- for the BL story (03.04), and for any story that cites CE cases, **every CE case is asserted and passes, with none pending, skipped or "not applicable"** (strategy 5.6, control 5). Such a result is an unverified AC and the recommendation is REJECT.

**Extra exit items for named stories.**

| Story | Added exit item |
|-------|-----------------|
| 01.03 | Canary scan runs in CI with its negative control; ESLint rule on cost repositories shown to fire |
| 10.01 | Gate stages 1 to 11 exist and block; the database guard (4.1) refuses a bad connection; Gitleaks proven on a string built at test time and never committed |
| 10.02 | The device and assistive-technology checks of section 12, recorded (DL-017) |
| 10.11 | The scripted failure-path tests of section 14.4 pass on staging. The Admin's rehearsal is a separate, later item |
| The last UI story of each epic | The axe and keyboard run covers every screen delivered so far |

**Release entry (G8 support, `release-<version>-qa-summary.md`).** All stories Done or deferred in writing; full regression and nightly matrix green on the release candidate; k6 and Lighthouse results on staging; one manual open of the export in Excel desktop; the real mail send done or the e-mail alerts marked not live; the validation rehearsal passed and the hand-over rehearsal with the actual Admin passed, or the G8 record states plainly that only the validation run was done (section 14; DL-035); the checks of section 12 that were not run are listed; the usability test is **not** a release gate (it happens after hand-over, section 13). The summary lists open defects by severity and the residual risks, including the ones this plan says cannot be tested.

---

## 6. Defect Management

**Severity, specific to this product.**

| Sev | Meaning here | Examples |
|-----|--------------|----------|
| 1 Critical | A cost, rate or formula value reaches an Engineer; a wrong total or row figure in a case with a stated expected value; an approved estimate changes; data loss; a restore leaves a broken portal or leaves a key or dump on disk; a role or CSRF bypass; the portal cannot be installed from the README | Canary found in an Engineer response; BL of 300 for CE-1; Approve accepted on cleared figures by direct API call |
| 2 Major | An AC fails with a workaround; the server accepts what only the screen refuses; the export differs from the SPEC section 14.12 checklist; a WCAG 2.2 AA violation on a delivered screen; the README fails the rehearsal | Download allowed at `out-of-date` when called directly; an axe violation |
| 3 Moderate | Wrong wording or state that does not mislead about a price; a layout defect at one width that leaves every action reachable | Message differs from the UX spec text |
| 4 Minor | Cosmetic; no effect on use | Alignment |

Priority P1 to P3 follows the severity unless the master changes it. Type is Product, Test (a flaky or wrong test), Environment or Requirement (an AC that cannot be tested or contradicts another document; this goes to the product-owner, not the developer).

**Lifecycle.** New, Open, Fixed, Verified, Closed; Reopened if the retest fails. QA verifies a fix by rerunning the failing test and the regression around it, not by reading the diff.

**Record.** One file per defect, `docs/07-qa/defects/DEF-NNN-<slug>.md`, from the template. In Jira and GitHub mode, each defect is also a Jira Bug linked to the story with label `aiid-DEF-NNN` and the priority from the severity, and a mirrored GitHub issue labelled `bug`, `sev-n` and `ai-delivery`, each linking the other (playbook 4.5, 5.4). Repro steps are exact; evidence is test output, never a screenshot of real data.

**Service levels.** Sev-1 and Sev-2 block G7 for the story. Sev-3 is fixed before G8 or the master accepts it in writing. Sev-4 goes to the backlog. A Sev-1 found after G7 reopens that story's gate. Usability findings (section 13) are logged the same way with the type Product and handed to the master, who routes them; they do not hold a gate.

---

## 7. Regression Strategy

**Suite composition.**

| Tier | Contents | Runs | Time budget |
|------|----------|------|-------------|
| R-fast | Lint, type-check, all Vitest (unit, integration, contract, security, acceptance written so far) | Every PR, and by QA at every G7 | Minutes |
| R-e2e | Playwright, Chromium, three widths: the journeys, axe, the canary scan | Every PR, and at every G7 | Minutes |
| R-nightly | R-fast plus R-e2e on Chromium, Firefox and WebKit; Lighthouse; the 500-node timing | Nightly on `master` | Longer |
| R-release | R-nightly plus k6, the export open in Excel desktop, the real mail send, the rehearsal, the device checks repeated on changed screens | Before G8 | Hours, with people |

**Areas that always rerun together** (the minimum QA adds to R-fast when a story touches them):

| Changed area | Always rerun |
|--------------|--------------|
| Formula engine, registry, seed configuration | Every CE case, `acceptanceTree`, the properties of strategy 5.5, the export read-back, the guards of strategy 5.4 |
| `figure-state`, input-change detection, autosave | The whole FR-100 and FR-101 pack, approval refusal, export refusal, the quantity-warning withholding |
| Any Engineer-reachable route, view model or e-mail | The canary scan, the role matrix, the identical-keys test |
| Auth, session, users | Role matrix, lock-out, password table, session clock, revocation, one-Admin |
| Masters, customers, "Not applicable" entries | FR-065 (approve, change masters, compare), hidden-entry refusals, delete guards |
| Approval, unlock, cancel, remove | The whole status and approval state-transition pack, the audit-row tests, the immutability refusals |
| Export | Cell-by-cell read-back, footer position, no reason and no warning in any cell |
| Docker, scripts, backup, restore | Install walk-through if the README changed, backup and retention tests, restore failure paths |
| Layout, tokens, shell | Three widths, axe, touch-target size, raw-colour search, the keyboard run |

**Flaky tests.** A test that fails and then passes on rerun is a defect of type Test, raised the same day, quarantined within a day with a ticket, and never deleted to get green. Retries are off in unit and integration tests; Playwright allows one retry and the report shows it. Canary and role-matrix tests are never quarantined. A suite that is green only on retry is not green at G7.

**Status note, 2026-11-21 (DL-276).** **RISK-031 was reopened at 9** (DL-276; **closed again by DL-279** after `master` push run 44907312557) (reopen trigger (a) fired on `master` push run 44894461614, 77b98fbb: `users.spec.ts:58` [desktop], both attempts; see `docs/07-qa/final-regression-report.md` section 2.3). **Rule R10 covers PR runs only**; it does not apply to `master` push runs, which are never re-run under it. **QA reads every `master` push run daily** (Stage 11 and each Stage 12 shard: failed, flaky, cases at 25 s or more) and reports it to master the same day. **DEF-038 watch (DL-277, 2026-11-21):** DEF-038 (AQP-341, #462) is Sev-3, type Test, open. QA greps every job log of every `master` push run for the line `[AQP-341 stored-values diagnostic]` (added by PR #580 once merged) and for a first-read mismatch of `estimate-fasteners.spec.ts` AC-2, AC-3 "back to None". If either appears, DEF-038 returns to provisional Sev-2 the same day, blocks G8, QA reads the second read and the save list, and master is told. **DEF-034 closed (2026-11-21):** fix #579 (7e42970c) verified on `master` push run 44904394383; its two cases read 1.4 to 3.0 s. **New watch entry, same run:** `account.spec.ts:313` [tablet] ("Set a new password" AC-5, AC-7: a person the Admin adds is sent to it from every page) failed attempt 1 at 4.4 s with an axe `document-title` (serious) violation on `html`, and passed on retry (7.9 s). It is not a time-out and not in #579's area; it looks like a scan before the title was set (compare DEF-009). One occurrence; the next first-attempt axe violation of this case is a Bug the same day (Sev-3, Test, or Product if the title is missing after load); reported to master. New watch entries from the final regression: `estimate-form-sections.spec.ts:161` [tablet] (rule of `:145`) and `estimate-fasteners.spec.ts:171`, `:198` [desktop] (first-minute cluster).

**DEF-053 closed (2026-11-21; AQP-383, #569; fix #571, `efeed217`).** Proof met: PR run of record 44902999104 (head `a11abdf1`) `users.spec.ts:58` 10.0 / 15.9 / 14.7 s (mobile / tablet / desktop), and `master` push run 44907312557 (fully green, 0 flaky in all four shards) 8.3 / 9.9 / **24.3** s, all attempt 1. **Rule R10 ends at this close-out; the live rule is W1 only.** **Near-line reading and watch (DL-267 line):** 24.3 s [desktop] is 0.7 s under the 25 s line, test no. 514 of shard 4, late in the shard. `users.spec.ts:58` stays on the list until G8 with the trigger of DL-279 (3), as restated by DL-284 in the paragraph on run 44913544147 below: **two passing desktop readings of 25 s or more on `master` pushes, or any attempt-1 failure outside a ruled wave, reopens DEF-053 the same day** (QA's first wording here, "any reading of 25 s or more", was stricter and is withdrawn). The helper change also cut the DEF-047 axe cases (`masters-table-actions.spec.ts`, 768 / 1024 / 1366 px, desktop) from 28.7 / 28.4 s on `242c21f7` to 21.7 / 19.4 / 18.3 s on `efeed217`. Other readings of 25 s or more on `efeed217`, recorded for the daily read (no attempt-1 failure): `estimate-fasteners.spec.ts:113` 32.5 s [desktop] (budget not re-read by QA), `:198` and `:149` 27.8 s [desktop], `estimate-form.spec.ts:96` 27.4 s [tablet] and 27.3 s [desktop], `estimate-picture.spec.ts:208` 29.3 s and `:111` 26.0 s [desktop]. **Correction (same day):** PR run 44902999104 had 1 flaky, `rates-changed.spec.ts:135` [tablet] (AC-10, 30 s time-out on attempt 1, `toHaveCount(0)` of the "Rates changed" status). It was already watched under DL-257 (E) (first occurrence PR run 44577408149), so this is the **second occurrence** and the trigger is met: **DEF-057 (AQP-387, #585), Sev-3, type Test**, logged the same day; no re-run rule. `estimate-save.spec.ts:107` and `unlock.spec.ts:186` stay watched under the same DL-257 (E) trigger. The `[AQP-341 stored-values diagnostic]` line is in no job of run 44907312557 (0 lines; PR #580 not merged).

**`estimate-form-sections.spec.ts:431` [tablet] AC-4, AC-8: count for DL-281 (2026-11-21; QA, from the job logs it holds plus the readings already in this section).** PR #584 run 44908595418 (head `00115c09`, base before #571) failed both attempts at **30.2 s and 32.0 s** (test no. 378 and 385 of shard 2). **Passing first-attempt tablet readings: 14. At 25 s or more: 1** (25.1 s, `master` push 44890683601); the DL-267 line needs three, so **no Bug: it stays on the watch list.** Passing readings in s, by run: 10.9 (44850302908), 13.4 (44894461614), 16.5 (44888177238), 16.6 (44755812730), 17.1 (44904394383, 7e42970c), 18.2 (#555 44870213022), 19.5 (44899114212, 242c21f7), 21.8 (#555 merged head 44888215530), 22.1 (44883887032), 23.6 (#538 44780475691, inside a ruled wave), 24.1 (44892640890), **25.1** (44890683601), and **since #571 (efeed217)**: 22.9 (PR run of record 44902999104, head a11abdf1, with the helper change) and 22.5 (`master` push 44907312557, efeed217); none at 25 s or more since #571. Failures, both-attempt: PR #557 run 44875704411 (30.4 / 31.6 s, measured wave 1.53x, DL-270) and PR #584 run 44908595418 (30.2 / 32.0 s; shard 2 at 1.29x, not a ruled wave, DL-281). Both failures are on runs whose base lacks #571 (the first is older, the second predates it). Trigger for this entry: a passing first-attempt tablet reading of 25 s or more on a `master` push run after #571, or an attempt-1 failure on a head that contains #571 (outside a ruled wave), makes it a Bug the same day.

**`master` push run 44909939586 on `cb631040` (#580 merged; 2026-11-21, read by QA).** CI and the Windows package run (44909939587) green; `Stages 1 to 11b`: 438 files and 9,707 tests (unit), 590 files and 15,073 tests overall, including `process-items.test.ts` (26 tests, 997 ms; DEF-056's file passed); E2E 528 / 522 / 524 / 508 passed, **0 flaky, 0 failed** in all four shards. **`[AQP-341 stored-values diagnostic]`: 0 lines in every job** (the line prints only on a first-read mismatch). Watch readings, mobile / tablet / desktop in s, all attempt 1: `users.spec.ts:58` 7.1 / 9.6 / 19.9; `estimate-form-sections.spec.ts:431` 18.0 / **15.1** / 15.3 (a 15th passing tablet reading, below 25 s; count in the entry above is now 15 passing, 1 at 25 s or more; none at 25 s or more since #571); `:145` 16.5 / 11.4 / 12.7; `rates-changed.spec.ts:135` 14.3 / 12.0 / 12.3 (DEF-057's case passed at all three widths). Readings of 25 s or more outside 60 s and 90 s budgets: `estimate-form-sections.spec.ts:331` [mobile] 26.3 s; `process-propagation.spec.ts:109` [mobile] 26.0 s (a spec from STORY-02.08, 30 s default, new on the list, evidence only). On a 90 s budget (`test.slow()`, not listed): `estimate-form.spec.ts:96` 29.5 s [mobile]. No attempt-1 failure on this run.

**`master` push run 44913544147 on `0f69aa20` (#584, G8-C-NFR9; 2026-11-21, read by QA).** CI and the Windows package run (44913544181) green; unit 440 files and 9,723 tests, overall 592 files and 15,089 tests; E2E 528 / 522 / 524 / 508 passed, **0 flaky, 0 failed**; **`[AQP-341 stored-values diagnostic]`: 0 lines in every job.** **DEF-053: reading 1 of 2 (DL-284; QA's reopen was withdrawn, DEF-053 is Closed again).** `users.spec.ts:58` [desktop] read **25.6 s** on attempt 1 (mobile 9.5 s, tablet 16.2 s); shard 4 ran 0.94x efeed217's shard 4 and 1.22x cb631040's, so not a slow draw; desktop readings on `master` pushes since #571: 24.3, 19.9, **25.6** s. **Trigger as ruled (DL-279 (3), DL-284):** a second desktop reading of 25 s or more on a `master` push, or any attempt-1 failure outside a ruled wave, and QA reopens DEF-053 the same day as **Sev-3, type Test, known limitation, accepted in writing for G8** (floor: the whole-page axe scan of a list filled to about 650 people, DL-275 (I); no product fault; release notes; #545 lowers it after G8), and **R10 revives for PR runs** at that moment. (QA's first text of the trigger, "any reading of 25 s or more", was stricter than DL-279 and is replaced by this.) **#382** (AQP-293 SQR-01) is **off the list of G8-blocking Majors** (DL-284 (3)); its remaining items are Minor. Other readings, attempt 1, mobile / tablet / desktop in s: `estimate-form-sections.spec.ts:431` 13.6 / 23.3 / 19.3 (16th passing tablet reading, none at 25 s or more since #571; the :431 count stays 1 at 25 s or more); `:145` 12.3 / 21.1 / 14.8; `rates-changed.spec.ts:135` (DEF-057) 9.8 / **24.1** / 14.6 (near the line on tablet, passed); `account.spec.ts:313` 9.4 / 6.6 / 6.7 (passed at all widths, no axe violation). Cases at 25 s or more are on 60 s or 90 s budgets (`estimate-tree:269`, `estimate-autosave:47`, `estimate-fasteners:148`, `estimate-save:304, :335, :347`), not listed.

**`master` push run 44917849003 on `ae1bb352` (#586, DEF-055 fix; 2026-11-21, read by QA).** CI and the Windows package run (44917849008) green; unit 440 files and 9,731 tests, overall 594 files and 15,122 tests; E2E 528 / 522 / 524 / 508 passed, **0 flaky, 0 failed**; **`[AQP-341 stored-values diagnostic]`: 0 lines in every job.** **`users.spec.ts:58` [desktop] 24.8 s** (mobile 9.4 s, tablet 10.5 s), all attempt 1: under the line, so the DL-284 count stays **1 of 2** (desktop readings on `master` pushes since #571: 24.3, 19.9, 25.6, 24.8 s: near the line again, no second reading at 25 s or more). Other readings, mobile / tablet / desktop in s: `estimate-form-sections.spec.ts:431` 16.1 / 20.9 / 16.2 (17th passing tablet reading, below 25 s); `:145` 15.1 / 18.2 / 13.9; `rates-changed.spec.ts:135` (DEF-057) 12.1 / 15.2 / 14.9; `estimate-save.spec.ts:107` 17.7 / 19.8 / 14.7. Cases at 25 s or more are on 60 s or 90 s budgets (`estimate-fasteners`, `estimate-save:304, :347`, `estimate-tree:269`), not listed. **DEF-055 closed:** see its file.

**`master` push run 44922163960 on `dcf8a192` (#587, DEF-056 test fix; 2026-11-21, read by QA).** CI and the Windows package run (44922164104) green; unit 440 files and 9,731 tests, overall 594 files and 15,124 tests, `process-items.test.ts` green (28 tests): **DEF-056 closed**. E2E 527 / 522 / 524 / 508 passed, **1 flaky, 0 failed**; **`[AQP-341 stored-values diagnostic]`: 0 lines in every job.** **DEF-053 REOPENED as a Sev-3 Test known limitation (DL-284 trigger met):** `users.spec.ts:58` [desktop] **27.5 s** on attempt 1 (mobile 7.1 s, tablet 9.8 s), the second desktop reading of 25 s or more on a `master` push (25.6 s on 44913544147); shard 4 ran 1.05x ae1bb352's shard 4, not a slow draw; readings since #571: 24.3, 19.9, 25.6, 24.8, 27.5 s. Accepted in writing for G8 by master (DL-284); **R10 revives for PR runs** (the exact case, once per head, DL-274 (2)); W1 stays live. **New flaky on a `master` push run, the original RISK-031 case:** `estimate-calculate.spec.ts:297` [mobile] ("AC-9: keyboard, sticky bar, width and accessibility", the axe blocked state; DEF-037's `:291`, the case DEF-037 was logged for) failed attempt 1 at **30.3 s** with `page.evaluate: Test timeout of 30000ms exceeded` in `waitForAnimationsToFinish` (`support/design-system.ts:78`, called from `expectFormAccessible`, spec :301); the retry passed in 19.8 s. Shard 1 ran 1.18x ae1bb352's shard 1 (shards 2, 3, 4 at 0.90x, 0.97x, 1.05x), not a ruled wave. A time-out-mode attempt-1 failure on a `master` push run with the run green: no Bug yet (one occurrence for this case since DEF-037 closed on 2026-11-17); **watch entry: the next attempt-1 failure of this case outside a ruled wave, on any run, is a Bug the same day** (Sev-3, Test; reopen DEF-037 or log a new one, master told); **RISK-031 is CLOSED (DL-279), not open:** its reopen triggers stand as written (DL-268, DL-279): (a) a red required check on a `master` push in the time-out mode; (b) two time-out-mode attempt-1 failures outside a ruled wave on `master` push runs on one day; (c) a red W1 or R10 re-run; (d) a second DEF-052 occurrence. Master counts this as **occurrence 1 of 2 for 2026-11-21 (UTC)** under (b) (counted from the close in DL-279; the attempt-1 time-outs on earlier `master` pushes that morning were under the open risk); a second one on a `master` push today reopens the risk. Reported to master. Other readings, mobile / tablet / desktop in s: `estimate-form-sections.spec.ts:431` 17.1 / 21.6 / 20.2 (18th passing tablet reading, below 25 s); `:145` 16.7 / 14.3 / 17.5; `rates-changed.spec.ts:135` 11.9 / 14.3 / 14.8; `estimate-save.spec.ts:107` 18.9 / 18.8 / 16.1. Cases at 25 s or more are on 60 s or 90 s budgets, not listed.

**`master` push run 44924430846 on `c0cf1d21` (#583, DEF-054 security headers and CSP; 2026-11-21, read by QA).** CI and the Windows package run (44924430870) green; unit 441 files and 9,792 tests, overall 595 files and 15,185 tests (`process-items.test.ts` 28 tests, 1,620 ms); the JS budget passed; E2E 534 / 527 / 528 / 513 passed, 6 / 4 / 20 skipped in shards 2 to 4 (as before), **1 flaky, 0 failed**; `[AQP-341 stored-values diagnostic]`: 0 lines in every job. **DEF-054 closed** (21 of 21 header cases on attempt 1; see its file). **The flaky:** `customers.spec.ts:262` [desktop] ("by keyboard: the alert dialog names the rates it replaces and starts on Keep current rates") failed attempt 1 at **19.4 s**: `expect(getByRole('alertdialog', { name: 'Reset ... to defaults?' })).toBeVisible()` ran out on its own 15 s with "element(s) not found" (spec :271, after `pressWithKeyboard(reset)` at :269), the retry passed in 11.6 s (mobile 9.7 s, tablet 11.5 s). It is **not** a 30 s budget cut, so QA does not count it on RISK-031's triggers (a) and (b) (master rules otherwise); it is the first occurrence of this case in the six `master` push runs QA read (44907312557, 44909939586, 44913544147, 44917849003, 44922163960, 44924430846) and the first `master` run with the CSP. No CSP violation is shown and every header case passed; PR #583's body lists no such flaky on its CSP runs (QA did not read those logs). **Watch with a stated trigger:** a second occurrence on any run is a Bug the same day (Sev-3, type Test, product not excluded: a keyboard activation that opens no dialog could be a press before hydration or a policy effect) and master is told; QA proposes the trace of that attempt be kept if it recurs. Other readings, attempt 1, mobile / tablet / desktop in s: `users.spec.ts:58` 7.1 / 10.3 / **16.4** (DEF-053's desktop readings on `master` pushes since #571: 24.3, 19.9, 25.6, 24.8, 27.5, 16.4; the accepted known limitation, DL-284); `estimate-form-sections.spec.ts:431` 22.6 / 16.1 / 15.2 (tablet reading 16.1, below 25 s); `:145` 16.7 / 15.9 / 12.9; `rates-changed.spec.ts:135` (DEF-057) 13.8 / 15.7 / 10.0; `estimate-calculate.spec.ts:297` 12.8 / 19.2 / 13.2. All passed on attempt 1 except the flaky above.


**Near-budget watch list (E2E, live; owner qa-engineer; moved here on 2026-11-20 from DEF-048 and then DEF-049, both closed; last refreshed 2026-11-20 evening, after DL-265).** Evidence, not scope: a case on this list is in no Bug's scope unless master widens it. **Lines:** 25 s is the near-budget line for a 30 s budget (the P2 line of DL-257 (A)); 20 s is the lower line of DL-259 (3). Cases on a 60 s or 90 s budget (`estimate-save`, `estimate-picture`, `estimate-tree` :269 with `test.slow()`, `estimate-fasteners`) are counted against that budget and are not listed unless over 80 %. All cases below have the 30 s default (no `test.slow()` or `test.setTimeout` in their specs at `origin/master`). **Triggers.** (1) A time-out-mode flaky on two non-wave runs in one day, or a failure on both attempts, and no open Bug covers the case: QA logs a Bug the same day and tells master (RISK-031 practice; DL-257 (D), DL-261). A ruled runner wave (DL-259) does not count towards (1) but is listed. (2) **The three SCR-14 axe cases (DL-264 (1), replaces DL-263 (6)(b)):** any attempt-1 failure of one of them on any run means QA logs a Bug the same day (Sev-3, type Test) and master rules on it before any re-run (there is no re-run rule for them; R5 ended). Readings of 25 to 30 s are recorded and need no report. (3) `estimate-form-sections.spec.ts:145` (DL-264 (5)(a)): the next attempt-1 failure on any run outside a ruled wave, or a second reading of 29 s or more on a `master` push run, means a Bug the same day. (4) `estimate-treatments.spec.ts:87` (DL-264 (5)(b)): any attempt-1 failure, or a reading of 29 s or more, means a Bug the same day. (5) **DEF-051 early-shard reopen trigger (DL-273 (3)), until 2026-11-28 inclusive (7 days after its close-out of 2026-11-21):** any attempt-1 failure of `lead-warning.spec.ts` :229, :253 or :280 (by title; now :222, :246 and :273) in the first 2 minutes of a shard (from the shard log's "Running N tests" line), outside a ruled wave (W1 (d) measured, or ruled by master), on any run means QA reopens DEF-051 the same day; R9 then applies again and the DL-272 warm-up becomes the required next step. After 2026-11-28 a failure is read under the Bug-or-watch line. (6) `users.spec.ts:58` [desktop] is **DEF-053** (AQP-383, #569) since DL-274 (2026-11-21), under the DL-267 line; it is no longer a watch, and rule **R10** covers its re-runs. (7) `estimate-form-sections.spec.ts:431` [tablet] (DL-274 (3)): a watch under the DL-267 line (one reading of 25 s or more, 25.1 s on `master` push 44890683601, and no failure outside a wave); it becomes a Bug on a time-out-mode attempt-1 failure outside a ruled wave plus at least three passing readings of 25 s or more in the same project. **The Bug-or-watch line (DL-267 (2)):** a time-out-mode attempt-1 failure outside a ruled wave plus at least three passing readings of 25 s or more in the same project is a Bug; one of the two without the other is a watch with a trigger. **Refresh:** from the first `master` push run after each merge that touches E2E, and at the hardening window. Rules in force with this list: **W1 (DL-265) and R10 (DEF-053, DL-274)**. R8 ended with DEF-050 and R9 with DEF-051, both on 2026-11-21.

**A. The three SCR-14 Users axe cases, `masters-table-actions.spec.ts`, describe "SCR-14 Users: axe scan of the forced table (DEF-021, AQP-245 AC-5)", "AC-5: at N px axe finds no violation on the forced table, after a Tab through the long-name row", `[desktop]`, N = 768 / 1024 / 1366 (DEF-047, closed 2026-11-20).**

| Run | 768 / 1024 / 1366 px, s | Note |
|---|---|---|
| #527 run 44591769411 (older head) | 17.4 / 17.1 / 19.4 | from DL-260 and DL-263 (6)(b) |
| #527 run of record 44738649937 (fb15d167) | 19.3 / 18.9 / 19.5 | DEF-047 P2 reading |
| #527 merged-head run 44748674828 (0fbf789) | 13.0 / 13.9 / 14.7 | QA |
| `master` push 44752152410 (5d6d72b) | 15.6 / 14.9 / 15.6 | DEF-047 P1 and P2 reading |
| #542 diagnostic run 44752992735 (ffc0d93a) | 21.2 / 23.3 / 22.1 | a 1.30x draw (DL-263) |
| #540 run 44752189754 (06474b76) | 23.9 / 24.8 / 24.0 | QA; shard 4 about 1.39x the `master` run above |
| `master` push 44755812730 (f652c22c) | 23.4 / 24.7 / **25.2** | QA; shard 4 about 1.37x. **Trigger (2) reached at 1366 px; reported to master 2026-11-20** |

**B. Cases master asked to add (DL-259 (3), readings on green run 44667850276, read by master) and QA's readings of the same cases (mobile / tablet / desktop, s).**

| Case | DL-259 | `master` push 44752152410 | `master` push 44755812730 |
|---|---|---|---|
| `users.spec.ts:58` AC-1, AC-7 (**DEF-053** since DL-274, rule R10; table I) | 24.6 [desktop] | 10.9 / 10.8 / 17.6 | 5.1 / 11.6 / **26.8** |
| `remove-price.spec.ts:136` (DEF-050, closed 2026-11-21; the case was split into five, section H) | 22.5 | 23.5 / 18.2 / 20.6 | 16.3 / 19.0 / **25.5** |
| `lead-warning.spec.ts:253` AC-8 **keyboard case** (in DEF-051 at close-out, DL-269; fixed by #555, now :246) | 21.5 | **28.0 / 25.1** / 20.9 | 16.4 / 16.2 / **29.4** (98 % of the budget) |
| `lead-warning.spec.ts:280` AC-8 **axe case** (joined DEF-051 by DL-272; fixed by #555, now :273) ("no sideways scroll and no axe violation with the dialog open"; not in DEF-051) | - | 25.5 / 16.2 / 18.0 | 14.0 / 15.5 / 23.9 (#540 run 44752189754: 16.7 / 15.3 / **27.8**) |
| `estimate-warning.spec.ts:117` AC-6 | 20.8 | 21.7 / 23.0 / 18.6 | 18.4 / 12.9 / 21.6 |
| `estimate-review.spec.ts:166` | 20.0 | 18.9 / 13.9 / 15.5 | 12.9 / 14.9 / 21.9 |

**C. Cases that failed attempt 1 on a non-master run, or sit at 25 s or more on a `master` push run, with no open Bug (2026-11-20).**

| Case | Evidence | Status |
|---|---|---|
| `estimate-form-sections.spec.ts:145` AC-2 `[desktop]` | #540 run 44752189754: **failed attempt 1 at 30.1 s** (a 15 s `expect(...).toHaveValue` after `page.reload()` cut by the 30 s budget, "element(s) not found"; test no. 6 of shard 4, about 70 s into the shard), retry passed in 19.7 s. `master` push 44755812730: **29.8 s** (99 %), passed. Other readings 10.3 to 19.5 s | One failure (RISK-031 lists it). **Watch with a stated trigger (DL-264 (5)(a)): the next attempt-1 failure outside a ruled wave, or a second reading of 29 s or more on a `master` push run, is a Bug the same day.** Both slow readings are test no. 6 of shard 4, about 70 s into the shard: evidence added to DEF-050 hypothesis 3 (no change to its scope) |
| `lead-warning.spec.ts:229` AC-5 `[desktop]` | #540 run 44752189754: **failed attempt 1 at 30.2 s** (15 s `expect(#review-approved-notice).toBeVisible()` at spec :245 cut by the budget), retry passed in 16.4 s. #526 run 44662178640: flaky at the same line :245 inside the ruled runner wave (DL-259 (1)). Desktop (corrected 2026-11-20): 32 first-attempt readings, 1 failed, passing median 19.5 s, 5 of 31 passing at 25 s or more (25.0 to 29.6 s); `master` push 44755812730: 25.0 s | **DEF-051 (AQP-381, #544), closed 2026-11-21 with :229, :253 and :280 all in scope (DL-269, DL-272, DL-273); fixed by #555. Reopen trigger in (5) above, until 2026-11-28.** |
| `estimate-treatments.spec.ts:87` AC-1 (the eight, :61 before 2026-11-20) | `master` push 44755812730: **26.1 s** [desktop]; #540 run 44752189754: **28.5 s** [tablet] (95 %), 23.0 [desktop], 21.2 [mobile]; 26.0 [mobile] on 44739529276. Never failed | Not DEF-049's scope. **Watch with a stated trigger (DL-264 (5)(b)): any attempt-1 failure, or a reading of 29 s or more, is a Bug the same day** |
| `estimate-form-sections.spec.ts:92` AC-1 `[desktop]` | 25.0 s on 44755812730 | watch |
| `estimate-warning.spec.ts:63` AC-6 `[desktop]` | 24.4 s on 44755812730 | watch |
| `approve-override.spec.ts` "AC-4: a reason of 501 characters, or with a hidden character, is refused under its field in the browser..." (was :184; by title, because #546 moved the lines) | 25.5 [mobile] on 44739529276; 24.0 [tablet] on 44755812730 | watch (DEF-050's file; the case is not in its scope) |

**D. Cases that were this list's reason and are fixed (readings after the fix, 2026-11-20).** `estimate-form.spec.ts` AC-9, three cases, and `estimate-treatments.spec.ts` AC-2, two cases (DEF-049, PR #540, f652c22): `master` push 44755812730, first attempt, 9.2 to 19.5 s (worst 19.5 s); #540's final run 44752189754 worst 18.7 s. The five replacing cases of DEF-048 (PR #531, 402485c): `master` push 44739529276 worst 18.3 s (see DEF-048). Cases that stay under the P2 line are listed here only if they reach 25 s again.

**E. Read the draw before reading a case.** On 2026-11-20 shard 4 ran about 1.37x to 1.39x the `master` push run 44752152410 on both 44755812730 and 44752189754 (455 and 457 tests in common; per-test totals), while those runs' `next build` figures were not slower than other shards (TypeScript 5.1 to 6.7 s). Several desktop cases read 25 to 30 s on the otherwise fully green `master` push 44755812730. Its "0 flaky" is therefore a narrow margin (29.8 s, 29.4 s), not a wide one. The architecture issue for after G8 (DL-257 (9)) is the common root.

**F. Slow-shard wave occurrences (DL-265 (3), rule W1; evidence, not scope; no Bug).** PR #538 (AQP-350), run 44780475691, head 359d3689, `Stage 12: E2E (shard 2 of 4)`, attempt 1: `2 failed, 2 flaky, 485 passed (21.6m)`, all four cases `[tablet]`. Readings read by QA from the attempt-1 shard-2 log (job 136441510469) and the `master` push 44755812730 shard-2 log (job 136355114926, fully green); first attempt, then retry, in s. All four cases are on the 30 s default. QA re-read the durations and the pass/fail marks in both logs and they agree with DL-265 (1); the error sites in the Result column are as master read them (DL-265 (1)), not re-read by QA.

| Case (`[tablet]`) | #538 run 44780475691, shard 2 | `master` push 44755812730, shard 2 | Ratio (worst #538 reading / `master`) | Result on #538 |
|---|---|---|---|---|
| `estimate-form-sections.spec.ts:331` AC-8 (axe in `expectFormAccessible`) | **30.4 / 31.8** | 15.4 | 2.1x | failed on both attempts (30 s budget; `page.evaluate` in `AxeBuilder.analyze`) |
| `estimate-warning.spec.ts:117` AC-6 (AC-4) | **30.2 / 31.7** | 12.9 | 2.5x | failed on both attempts (`page.waitForResponse` at :122) |
| `estimate-warning.spec.ts:181` AC-9 keyboard | **30.3**, then 25.7 | 17.2 | 1.8x (first attempt) | flaky: failed attempt 1 (`waitForResponse` at :204), passed on retry |
| `estimate-warning.spec.ts:211` AC-9 axe | **30.3**, then 26.0 | 16.2 | 1.9x (first attempt) | flaky: failed attempt 1 (a 15 s `expect` for the `alertdialog` cut by the 30 s budget, no received text), passed on retry |

On the `master` run the four cases read 12.9 to 17.2 s (43 to 57 % of the budget), the normal draw. The wave was shard 2 of that run only: DL-265 (1) measured the 462 tests common to both shard-2 runs at a median per-test 1.65x (1.62x total), with the median already 1.72x in the first 2 minutes, and the other three shards of the run at 0.87x to 1.31x. QA did not re-measure the ratios. These four cases go on RISK-031 as wave occurrences (DL-265 (3)). They do not count towards trigger (1) above (a ruled wave, DL-259) and do not touch trigger (3), which is for `estimate-form-sections.spec.ts:145`, a different case. Cases of this file already on the list: `estimate-warning.spec.ts:117` (table B, DL-259 20.8 s, `master` 21.7 / 23.0 / 18.6 and 18.4 / 12.9 / 21.6 s across the three widths: the 12.9 s above is the `[tablet]` reading of 44755812730), `:63` (table C).

**G. Not E2E: Stage 11 (Vitest) is watched in DEF-052 (2026-11-20).** `master` push 44778990017 (251636c8) went red in Stage 11 because three lock-out cases of `tests/acceptance/aqp-38-sign-in.test.ts` (:298, :318, :330) hit Vitest's 5 s budget (they take under 0.3 s on nine green runs; the same file's fixed-wait "busy database" case took 13.2 s against 0.75 to 0.80 s). It is not a runner wave (the stage's per-file median ratio to eight green runs was 0.78 to 1.37; PostgreSQL-heavy files stretched). Bug DEF-052 (AQP-382, #550). Readings for the three cases are in the DEF-052 evidence table; there is no re-run rule for it (DL-265 (5)); if master rules one, it is recorded here with R9 and W1. **Update 2026-11-21 (DL-266):** the file read normally on `master` push runs 44823699480 (3,331 ms for the 42 tests, "busy database" case 826 ms) and 44850302908 (3,161 ms, 810 ms), with no "Test timed out" and no `afterAll` 42501 error; the three cases print under 0.3 s (not printed). No second occurrence.

**H. DEF-050 closed on 2026-11-21 (AQP-380, #539); readings after the fix, and the watch cases on `master` push 44850302908 (266db7a9, #546's squash; fully green, 0 flaky in all four shards).** The eight replacing cases (R8 ended with the close-out): `approve-override.spec.ts` "AC-3, AC-7: an override with a reason" (:184, :198, :212 on 266db7a9) and `remove-price.spec.ts` "AC-3, AC-6, AC-7: a good removal" (:162, :199, :218, :228, :240). All 24 readings passed on attempt 1: worst 13.6 s, 0 of 24 over 15 s (mobile / tablet / desktop: :184 11.4 / 7.8 / 10.3; :198 11.7 / 7.8 / 11.4; :212 13.6 / 10.0 / 11.7; remove :162 11.2 / 9.4 / 11.6; :199 10.7 / 9.8 / 12.2; :218 10.5 / 8.5 / 10.3; :228 6.9 / 6.4 / 8.4; :240 6.1 / 6.1 / 8.1). They are off the list unless they reach 25 s again. **Watch cases on the same run (mobile / tablet / desktop, s):** the three SCR-14 axe cases at 768 / 1024 / 1366 px, **24.8 / 22.9 / 22.3** (no failure; the DL-264 (1) trigger is a first-attempt failure); `lead-warning.spec.ts` :229 21.0 / 20.5 / **26.1**, :253 20.3 / 19.3 / 21.5, :280 17.1 / 17.5 / 20.3; `estimate-form-sections.spec.ts:145` 15.2 / 15.3 / 13.1 (no reading of 29 s: DL-264 (5)(a) not touched); `estimate-treatments.spec.ts:87` 18.7 / 17.7 / 20.4 (DL-264 (5)(b) not touched). At 25 s or more on a 30 s budget on this run: `users.spec.ts:58` [desktop] 27.8, `lead-warning.spec.ts:229` [desktop] 26.1, `estimate-form-sections.spec.ts:92` [desktop] 26.0. On #546's merged-head run 44848021750 (f00952fa, a slower draw) the `lead-warning.spec.ts:253` case read **26.9 s** [mobile] and the eight cases peaked at 17.6 s (4 of 24 over 15 s): evidence for the :253 watch, no failure.

**I. 2026-11-21: DEF-051 closed; `users.spec.ts:58` on the watch list; `estimate-form-sections.spec.ts:431` as evidence.**

*DEF-051 (AQP-381, #544), closed 2026-11-21 (DL-273).* The three cases (`lead-warning.spec.ts`; by title, lines on 03c81cbf: AC-5 :222, AC-8 keyboard :246, AC-8 dialog axe :273) read, mobile / tablet / desktop, s: PR #555 run of record 44870213022 AC-5 11.2 / 7.7 / 13.9, keyboard 11.3 / 8.4 / 11.3, axe 9.6 / 6.7 / 10.6; `master` push 44890683601 (03c81cbf, fully green, 0 flaky) AC-5 8.2 / 9.2 / 9.1, keyboard 9.4 / 9.5 / 8.0, axe 9.2 / 9.1 / 5.6; all 39 readings of the file on attempt 1, worst 13.9 s and 11.5 s. **First-minute cluster (evidence for DEF-050 hypothesis 3 and for the post-G8 `architecture` issue, DL-269 (2)(c)):** on PR #553 run 44863502429 and PR #561 run 44883081233 the three cases failed attempt 1 together in `[tablet]`, shard 3, tests no. 4 to 7, about 70 s after the shard started (30.1 to 30.9 s; retries 17.9 to 20.4 s); the same early window as `estimate-form-sections:145`. They are off the list unless they reach 25 s again; the early-shard reopen trigger runs to 2026-11-28 (trigger (5) above).

*`users.spec.ts:58` AC-1, AC-7 `[desktop]` (was a watch under DL-273 (4); **became DEF-053 on 2026-11-21 under DL-274**, rule R10; Jira AQP-383, GitHub #569).* Two attempt-1 failures, both `Test timeout of 30000ms exceeded.` and both passed on retry: PR #555 run of record 44870213022, 31.8 s (test no. 492 of shard 4, about 16 minutes into the shard; retry 25.9 s), and PR #555 merged-head run 44888215530, 31.9 s (no. 507, about 16.6 minutes in; retry 27.0 s). Both are **late** in the shard, not in its first minutes, when the Users list holds the most data made by earlier specs in the same job; that fits the whole-page axe cost that grows with the shared E2E data (DL-263 (4), DL-264 (1)), not the early-compile window. QA's census of the logs it holds (overlapping runs, not a full census): 43 first-attempt desktop readings, 2 failed, passing median 20.9 s, **13 of 41 passing at 25 s or more (25.8 to 29.3 s)**; recent: 26.8 (44755812730), 26.0 (44781381557), 27.8 (44850302908), 17.3 (#557's run 44875704411), 17.6 (`master` push 44890683601). **Wave status, QA's measure** (W1 (d) pattern against the latest fully green `master` push run before each; matched tests, median per-test ratio): run 44870213022 shard 4 1.52x (1.40 in the first 4 minutes) but shard 1 of the same run 1.54x, so the control (0.25 above the other shards) is not met: not a measured wave. Run 44888215530 shard 4 1.50x (1.43 in the first 4 minutes), the other shards at most 1.17x (0.33 lower): **a W1-measured wave** by that pattern (DL-270 (2)(a): it does not count towards a trigger). So the second failure is inside a measured wave, and the trigger as written (a second failure outside a ruled wave, or two more readings of 25 s or more) is not met. **Reported to master with the census:** by the DL-267 line (one failure outside a ruled wave plus at least three passing readings of 25 s or more in the same project) the census already has both halves; DL-273 (4) quoted three readings (26.8, 24.6, 17.6 s). **Outcome (DL-274):** one attempt-1 failure outside a ruled wave (the first) plus 13 passing readings of 25 s or more is the DL-267 line, so it is a Bug; the second failure is inside a W1-measured wave and does not count. DL-273 (4) had counted three readings from table B; master corrected it on the full series. QA recounted on the logs held on 2026-11-21: 45 first-attempt readings, 2 failed, 43 passing, median 20.3 s, 13 of 43 at 25 s or more.

*`estimate-form-sections.spec.ts:431` AC-4, AC-8 `[tablet]` (evidence under DL-270; **a watch under the DL-267 line since DL-274 (3)**, trigger (7) above; no Bug).* Both attempts failed at 30.4 s and 31.6 s (`page.evaluate`, `AxeBuilder.analyze`) inside PR #557's run 44875704411, whose shard 2 master measured at 1.53x (W1 (d) met, DL-270 (1)). Other readings `[tablet]`: 10.9 s (`master` push 44850302908), 16.6 s (44755812730), 18.2 s (#555 run 44870213022), 21.8 s (#555 run 44888215530), 23.6 s inside #538's 1.62x wave (DL-265), and **25.1 s on `master` push 44890683601** (the latest fully green run, shard 2 of 20.1 minutes); desktop and mobile readings 9.2 to 25.2 s. Reported to master as a fact: DL-270 gave "no reading at 25 s or more on a normal draw" as one ground for no watch entry.

**2026-11-22 (qa-engineer; master's DL-290 and DL-285 (3); times UTC).**

- **DEF-058 (AQP-392, #602), Sev-3, type Test: `estimate-form-sections.spec.ts` :331 (STORY-05.04 AC-8) and :431 (STORY-05.11 AC-4, AC-8), both [tablet], in any project.** Logged on DL-290 ruling A2 for PR #599 run 44985919886 (head 5fe9fed6), shard 2 job 137096326780: :331 failed both attempts (30.2 s, 31.5 s); :431 failed attempt 1 (30.2 s) and passed on the retry (31.2 s); `Test timeout of 30000ms exceeded.` alone each time; shard 2 ran 1.23x the base (others 0.98, 0.71, 1.00), not a ruled wave. **Trigger (1) of the watch list fired for :331; the trigger set after DL-281 fired for :431.** Both leave the watch list and are in this Bug's scope. Fix: test-only, hardening window, behind Sev-2 and Major items, ahead of Minors, branched from a `master` that contains #600 (AQP-388); no budget, retry or timeout change; every assertion and the axe scans kept; proof P1, P2, P3 as DL-257 (A). **Rule R11** (PR runs only, never a `master` push; DL-290 (5)) governs re-runs until it closes; RISK-031 trigger (c) reads "a red W1, R10 or R11 re-run". Readings by run and width are in the defect file; the proof wanted on #599's updated-head run (shard summaries with every flaky line named, and the :331 and :431 readings at three widths) is added there when that run exists. Latest `master` readings (44988681963, 45512bd4, 0 flaky): :331 11.8 / 18.6 / 22.4 s and :431 13.6 / 23.9 / 23.8 s (mobile / tablet / desktop, attempt 1).
- **DEF-057 (AQP-387): a third attempt-1 failure, the first on a `master` push, and the first with the diagnostic.** `rates-changed.spec.ts:224` [tablet] (the AC-10 case, renumbered from :135) on `master` push 44985240147 (60ac0d18), shard 3 job 137094268903: failed at 33.1 s, retry 14.8 s. The diagnostic reads "after the press the test ended as timedOut", "no answer to the Recalculate request was seen" (request "sent +null ms after the press; answer none"), "notice elements still on the page: 0". So this is **not** DEF-057's Sev-2 trigger (Recalculate answered 200 while the notice stays, or the server cleared and the screen kept it): there is no answer seen and no notice left on the page, so this attempt shows no stale notice. What it does not explain is why no request or answer was seen: the diagnostic cannot say whether the press was lost or the request was never sent. DEF-057 stays Sev-3 with no re-run rule. Counted by master as the one trigger (b) occurrence of 22 Nov (DL-290 (4)). Recorded in the DEF-057 file.
- **DEF-059 (AQP-393, #603), Sev-3, type Test, product not excluded: `estimate-first-load.spec.ts:64` [desktop] (STORY-05.13 AC-4).** Attempt 1 failed on its own 15 s `expect` at :77 ("Loading the form" status found but `hidden`) on two `master` pushes of 22 Nov: 44975509844 (616d7e34, job 137064401810, 26.2 s, retry 9.5 s) and 44983705175 (0381fc5c, job 137089551760, 25.6 s, retry 11.8 s). By **DL-285 (3)** (a case that fails on its own `expect` timeout with a received state is a watch on its first occurrence and a Bug on its second, the same day) this is the second, and no earlier ruling covers the case (DL-290 (4) lists the two failures as "not counted" for RISK-031 and orders nothing else), so QA logged it, with master told. Series: no failure of the case in the six `master` push runs of 21 Nov (44945571540 back to 44922163960); it read 8.9 / 16.4 / 13.2 s (mobile / tablet / desktop) on 44988681963. **Not counted on RISK-031 trigger (b)** (an `expect` on its own timeout, DL-264 (4)(d), DL-285 (4)). No re-run rule. Fix: test-only unless the measurement shows a product fault; Minor-class lane (assumption for master to confirm).
- **Master push runs read for first-attempt failures (22 Nov).** 44988681963 (45512bd4, #593) and its Windows package run 44988681968: success; Stage 12 shards 1 to 4 `534 passed`, `527 passed (6 skipped)`, `529 passed (4 skipped)`, `513 passed (20 skipped)`: **0 flaky, 0 failed, 0 time-outs of 30 s in any shard**. `master` push run 44990887665 (08394110) had started at 05:47Z and was still in progress, so it is **not read here**; it and any later run are read when complete. **RISK-031 trigger (b), 22 Nov count: still 1 of 2** (`rates-changed.spec.ts:224`; the 30 s-budget form only). Triggers (a), (c) and (d): not touched.

- **Master push runs read, 22 Nov, after the first note (qa-engineer, 2026-11-22; DL-293).** `master` push 44990887665 (08394110, #600): green (see DEF-058's readings). **44992801362 (6087e8b8, #599):** CI success; shard 2 `1 flaky, 529 passed (21.2m)`: `estimate-calculate.spec.ts:238` [tablet] failed attempt 1 at 30.3 s with only "Test timeout of 30000ms exceeded." and passed on retry (30.5 s). **Not a ruled wave** (shard 2 1.34x to 1.36x the preceding run's; shard 3 1.38x with no failure; W1 (d) 1.4x line not met on its own). **RISK-031 trigger (b), 22 Nov count: 2 of 2** (`rates-changed.spec.ts:224` on 44985240147 and this case); RISK-031 reopens at 9 under DL-293 (2). **44995772811 (62ff83c4, #588):** CI red at `Stages 1 to 11b`, Stage 6, `tests/unit/load-plan.test.ts:104` AC-4 (5,676 ms, "Test timed out in 5000ms"): **DEF-060** (AQP-394, #608). Shard 2 `1 flaky, 529 passed (20.0m)`: `estimate-form.spec.ts:74` [tablet], an assertion with a received value (110 px): **DEF-061** (AQP-395, #609), not a time-out, not on trigger (b). Trigger (a) now reads "Stage 6, Stage 11 or Stage 12" (DL-293 ruling 1d).
- **DEF-060 (AQP-394, #608), Sev-3, type Test: `tests/unit/load-plan.test.ts:104` AC-4 "is a PNG of 199 KB ..."** (STORY-10.09, AQP-371, #588). Stage 6 5,676 to 6,256 ms on slower runners (master 44995772811; #601 44995940002 attempt 1; records-t 44997491093; #581 44997762703), 2.3 to 3.4 s on fast ones; margin about 1.5x against the 5 s budget. Pre-empts the queue; **merge freeze** until the fix squashes (DL-293 ruling 1b); test files only, no budget change; proof 1.5 s or less in Stage 6 and Stage 11 on the PR run of record and the first `master` push after the squash. No re-run of any run red on this case.
- **DEF-061 (AQP-395, #609), Sev-3, type Test, product not excluded: `estimate-form.spec.ts:74` [tablet] AC-1** (STORY-05.03, AQP-303; exposed by #600, AQP-388): card 04 read 110 px lower than card 03 on one flex line, so the page moved between the two separate reads (:78, :79). Test-only fix in that spec after the DEF-060 fix and #605; if what grows is a product element whose loading and loaded heights differ, it returns to master. Never re-run.
- **Watch list entry added: `estimate-calculate.spec.ts:238` [tablet]** "AC-2: nothing is sent while a field shows a value that is not saved: the page says so, the field says why, and fixing the field lets the next press go" (review SQR-01 of AQP-317; the spec is unchanged since #459, 17 Nov). Its first budget cut on record: 30.3 s on `master` push 44992801362 (retry 30.5 s). Tablet readings on 22 Nov `master` pushes (master, DL-293 (2)): 25.6, 20.3, 19.0, 22.0, 19.9, 21.3, 30.3 (failed) / 30.5, 26.8 s; mobile 13.3 to 21.7 s; desktop 17.8 to 24.8 s; unchanged by #600. **Trigger (DL-293 (2)): a second attempt-1 failure in the time-out mode on any run, in any project, is a Bug the same day (qa-engineer: Sev-3, type Test; master told). No re-run rule; a both-attempts red comes to master.** It is not a close-out condition of RISK-031 (DL-293 (2)).

- **DEF-057 (AQP-387, #585) re-graded Sev-2, 2026-11-22 (master's DL-294 (1); QA read the logs).** DL-280's trigger is met: PR #605 run 44999981920 shard 3 (job 137139171639), `rates-changed.spec.ts:224` [tablet], attempt 1 at 31.1 s: the diagnostic's server reads show `state: "current"`, `ratesChanged: null`, stored SUBMITTED with 2 calculations, while the screen kept the notice and a busy Recalculate button; `POST /recalculate` answered 200 at +5,910 ms and the refresh was sent at +5,929 ms with no answer by the end. The diagnostic headline "no answer to the Recalculate request was seen" is false: its matcher (`watchRecalculate`, :101) looks only for `/calculate`. **Correction to the 44985240147 entry above:** its request log shows `POST /recalculate` answered 200 at +12,483 ms and the refresh answered at +13,920 ms with 0 notice elements; it is a 12.1 s recalculation that used the budget (still a budget cut, still counted on trigger (b)); only the "no answer" wording is withdrawn. DEF-057 blocks G8 and takes the next lane that frees; the cause step comes first (DEF-057 file). RISK-033 registered by master (DL-294 (5)).
- **Watch list entry added: `process-propagation.spec.ts:109` [tablet]** "a changed default reaches the customers (AC-1 to AC-3, AC-5, AC-10) > moves the customers on the old default, asks about the others by keyboard, saves only what was chosen, and Escape keeps every value". First attempt-1 failure on record: PR #605 run 44999981920 shard 3, **30.4 s** (test no. 77), "Test timeout of 30000ms exceeded." and "apiRequestContext.delete: Test timeout of 30000ms exceeded." at `cleanUp` :88 (the customer `DELETE` loop), called from :175; retry 27.8 s (no. 89). It failed in the same seconds (07:52:57 to 07:53:28Z) as the AC-10 case's slow server answers (DEF-057); on the other two workers `reassign-task.spec.ts` passed in 2.8 to 8.8 s. Readings in the logs QA holds, s, attempt 1, mobile / tablet / desktop: `master` 08394110 26.3 / 11.1 / 24.1; PR #599 run 44990897082 28.8 / 24.8 / 18.0; `master` 6087e8b8 17.6 / 18.3 / 14.6; `master` 62ff83c4 19.7 / 11.7 / 18.3; `master` 60ac0d18 [tablet] 21.4; PR #605 run 44999981920 21.2 / **FAIL 30.4** (retry 27.8) / 23.8. Earlier: 26.0 s [mobile] on `master` 44909939586. **Trigger (DL-294 (2)): a second attempt-1 failure in the time-out mode, on any run and in any project, is a Bug the same day (qa-engineer: Sev-3, type Test; master told); if DEF-057's cause step shows a shared cause, it is folded into DEF-057 and DEF-057's proof adds an attempt-1 pass of :109 at all three widths.** No re-run rule; a red on both attempts comes to master. Not counted on RISK-031 trigger (b) (a PR run). Readings near the budget (28.8 s [mobile] on PR #599's run) suggest a margin case as well.
- **DEF-061 (AQP-395, #609) re-typed Product (layout), 2026-11-22 (DL-294 (4)):** owning story STORY-05.07 (AQP-315); the picture slot's 48 px loading skeleton (`picture-slot.tsx:41`) is replaced by a control about 160 px tall, against UX spec :417. One PR: the loading branch of `picture-slot.tsx`, the red-first height case and the one-frame read in `estimate-form.spec.ts`; no combined review; proof on the PR run of record and the first `master` push after the squash.

- **2026-11-22, DL-295 and the closure reads (qa-engineer).** **DEF-057, fifth occurrence:** PR #612 run 45008203701 (head 93e12a5f), shard 3 job 137164420759, `rates-changed.spec.ts:224` [tablet] attempt 1 at 31.3 s (retry 10.8 s); mobile 9.2 s and desktop 9.8 s passed attempt 1. The corrected headline reads "RECALCULATE ANSWERED 200 AND THE NOTICE IS STILL SHOWN": POST sent +222 ms, answered 200 at +5,199 ms; `_rsc` refresh sent +5,236 ms, headers +6,052 ms; the notice was still shown at about +14.9 s; server `current` / `ratesChanged: null`. DL-295 note: "answered" means the headers arrived, not that the body ended. [tablet] attempt-1 failures of this case so far (RISK-033's count, P 3): 44985240147, 44999981920, 45008203701. Route and time-box (2026-11-26) in the DEF-057 file. On the `master` pushes after #605 the case passed attempt 1 at every width: 45008501202 10.0 / 17.6 / 10.1 s and 45010599354 7.9 / 12.6 / 14.0 s (mobile / tablet / desktop).
- **QA tasks open from DL-295:** (q2) **the rate count for RISK-033 (done on the narrow route, 2026-11-22; the full count over about 330 runs was not run because the script was denied by the permission system and was not worked around):** all 49 `master` push CI runs from 2026-11-20 02:37Z to 22 Nov 10:04Z plus eb4137f4: the AC-10 case failed attempt 1 on **2 of 50 pushes, both at tablet** (44941416105 on 21 Nov, 32.2 s, and 44985240147), 0 of 50 at mobile and 0 of 50 at desktop; PR runs read: 2 of 5 at tablet (#605 run 44999981920, #612 run 45008203701), 0 elsewhere; 5 tablet attempt-1 failures since 20 Nov (44902999104, 44941416105, 44985240147, 44999981920, 45008203701), none at mobile or desktop. **44941416105 (a `master` push, 21 Nov, 6e63bb90, the merge of #591) was not recorded before; it is the sixth DEF-057 occurrence and a possible RISK-031 trigger (b) event for 21 Nov: master to rule.** Details in the DEF-057 file. (q3) **O5 timing lines:** #612's observer (head 8078432d, 3 commits, BLOCKED when read) is **not on `master` yet**; once it is, the O5 line of shard 3 of every run goes into a table here, and the first failure with an O1 to O5 report goes to master the same day.
- **DEF-058 closed, 2026-11-22.** P1 (PR run of record 44999981920, worst 21.4 s), P2 (first `master` push after #605, 45008501202 on d959e8f7, 12 of 12 attempt 1, worst 16.2 s, 0 flaky, 0 failed) and P3 (one page open, at most one scan per case, read from the spec) are met; R11 ends. **DEF-060 closed, 2026-11-22.** P1 (555 / 174 ms) and P2 (936 / 388 ms on a slow-class Stage 6) met; the two later `master` pushes read 465 / 142 ms and 567 / 203 ms.
- **RISK-031 close-out (DL-293 (2)), QA's read:** (i) the DEF-060 fix squashed with its proof: met. (ii) DEF-058 closed on its DL-291 (3)(a) proof: met. (iii) a `master` push run that contains both, with `Stages 1 to 11b` success and 0 time-out-mode flaky in every shard: **met on 45008501202 (d959e8f7, #605; contains ea915150) and again on 45010599354 (d119ae39, #601)**: both have `Stages 1 to 11b` and `Stages 1 to 11` success and 0 flaky and 0 failed in all four shards. DEF-057, DEF-059 and `estimate-calculate.spec.ts:238` are not close-out conditions and none had a flaky on either run. The closing ruling is master's.

- **2026-11-22, PR runs read for first-attempt failures (qa-engineer, at the orchestrator's request).** **DEF-062 (AQP-396, #614), Sev-3, type Test: `estimate-calculate.spec.ts` :143, :202 and :238 [tablet], both attempts, PR #611 run 45009385390 (head 43d54bb6), shard 2 job 137168093516** (30.1 / 30.4 / 30.3 s on attempt 1, 33.8 / 31.3 / 31.0 s on the retries, 10:00 to 10:01Z, `ECONNRESET` lines in the window). Two triggers fired: the :238 entry below (a second attempt-1 time-out on any run is a Bug the same day, DL-293 (2); the first was `master` push 44992801362) and trigger (1) of this list (both attempts, no open Bug) for all three; one Bug for one spec, one mode and one window (DL-290 A2 (iii)). Not a ruled wave (shard 2 1.17x `master` 45008501202's; others 1.32, 0.92, 1.58), and the head's diff cannot reach the Calculate screen. **`estimate-calculate.spec.ts` :143, :202 and :238 [tablet] now sit in DEF-062's scope** and leave this list as watch entries. Normal tablet readings (attempt 1, s, six runs): :143 17.3 to 24.0; :202 16.4 to 28.0 (27 to 28 on three of six); :238 17.9 to 26.8. The run of record 45011895045 was green.
- **DEF-063 (AQP-397, #615), Sev-3, type open (Test, product not excluded): `estimate-fasteners.spec.ts` :93, :104 and :127 [desktop], attempt 1, the part form not visible in 15 s (`waitForForm`, `part-form.ts:57`), at the start of shard 4, twice in 8 minutes** (PR #604 run 45011363827, job 137174187838, 20.2 to 20.5 s; PR #611 run of record 45011895045, job 137175825653, 20.1 to 20.3 s; retries passed in 7.3 to 11.9 s). Second occurrence for each case (DL-285 (3)); own 15 s `expect`, so not on RISK-031 trigger (b); PR runs. Same file and mode on 22 Nov: `master` push 44975509844 `:207` and `:234`. Not seen on the `master` pushes 45008501202 and 45010599354. **An early-shard cold-start family** with DEF-057 (the slow `/recalculate`, DL-295) and DEF-059 (the stored-values read pending 15 s); master rules whether DEF-063 joins that cause step.
- **PR #604 run 45011363827, shard 4, the fourth flaky:** `estimate-form.spec.ts:74` [desktop] (card 04 read 102 px below card 03 at 1366 px, y 1451 against 1553): **DEF-061's failure at desktop, before #611 merged**, so the picture-slot shift is not tablet-only.

- **DEF-061 closed, 2026-11-22.** The failure also read 102 px at desktop (1366 px) on PR #604 run 45011363827 before the fix. #611 squashed as eb4137f4. P1 (PR run of record 45011895045) and P2 (first `master` push after the squash, 45013997495, 0 flaky, 0 failed): the red-first case (`estimate-picture.spec.ts:406`) and `estimate-form.spec.ts:74` attempt-1 green at all three widths, worst 10.3 s; the red-first case was red at all three widths in the PR body (run 45007584457).

- **Trigger (b) daily ledger (DL-296 process rule: each UTC day's count, from every `master` push run of the day; QA writes it, master quotes it in the daily update). 22 Nov 2026 (UTC), read 2026-11-22 from the Stage 12 job logs of every `master` push CI run.** Trigger (b) counts a time-out-mode attempt-1 failure (a 30 s budget cut) outside a ruled wave on a `master` push run. Not counted: an own-15 s `expect` (DL-264 (4)(d), DL-285 (4)) and a failure with a received value.

| Run (sha) | Result | Stage 12 flaky or failed (attempt 1) | Counted on (b) |
|---|---|---|---|
| 44972676346 (c9cc3ba5) | green | none | - |
| 44975509844 (616d7e34) | green | `estimate-fasteners.spec.ts:207`, `:234`, `estimate-first-load.spec.ts:64`, all [desktop] | no: own 15 s expects |
| 44983705175 (0381fc5c) | green | `estimate-first-load.spec.ts:64` [desktop] | no: own 15 s expect |
| **44985240147 (60ac0d18)** | green | `rates-changed.spec.ts:224` [tablet], 33.1 s | **yes (1)** |
| 44986816755 (d2382217) | green | none | - |
| 44988681963 (45512bd4) | green | none | - |
| 44990887665 (08394110) | green | none | - |
| **44992801362 (6087e8b8)** | green | `estimate-calculate.spec.ts:238` [tablet], 30.3 s | **yes (2)** |
| 44995772811 (62ff83c4) | red at Stage 6 (`load-plan.test.ts` 5 s, DEF-060; trigger (a) now reads Stage 6, 11 or 12) | `estimate-form.spec.ts:74` [tablet], a received value (DEF-061) | no |
| 45006794087 (ea915150) | green | none | - |
| 45008501202 (d959e8f7) | green; **RISK-031 closed again after this run (DL-296)** | none | - |
| 45010599354 (d119ae39) | green | none | **0** after the restart |
| 45013997495 (eb4137f4) | green | none | **0** |
| 45016574514 (50cb1150, #612, the first with the observer) | green; `Stages 1 to 11` success (job 137194437864); shards `543 passed (14.9m)`, `536 passed (16.3m)`, `538 passed (10.5m)`, `522 passed (14.1m)` | none (0 flaky, 0 failed) | **0** |
| 45020428761 (f02c3b54, #616, DEF-062 fix) | green; `Stages 1 to 11` success (job 137207378449); shards `543 passed (15.4m)`, `536 passed (19.5m)`, `538 passed (13.9m)`, `522 passed (11.6m)` | none (0 flaky, 0 failed) | **0** |
| 45022375651 (de4799ae, #613, DEF-059 fix) | green; `Stages 1 to 11` success (job 137212454425); shards `543 passed (16.1m)`, `537 passed (15.1m)`, `539 passed (13.6m)`, `523 passed (11.2m)` | none (0 flaky, 0 failed) | **0** |
| 45025620716 (2ff31d2b, #617, DEF-063 fix) | green; `Stages 1 to 11` success (job 137223401008); shards `523 passed (12.5m)`, `539 passed (12.2m)`, `537 passed (19.3m)`, `543 passed (13.6m)` | none (0 flaky, 0 failed) | **0** |

**22 Nov count, UTC: 2 of 2 before the restart at 45008501202 (44985240147 and 44992801362; DL-293 (2)); 0 of 2 after it, through 45025620716 (45010599354, 45013997495, 45016574514, 45020428761, 45022375651 and 45025620716 had 0 flaky and 0 failed; the push of 34bc3250, run 45027664779, is read when it completes).** 21 Nov: 2 of 2 as master recorded it in DL-296 (44941416105 counted, recorded late; QA did not recount 21 Nov here). The ledger is extended on each later `master` push run.
- **Observer lines (O5) of the AC-10 case, `rates-changed.spec.ts:224`, read on every width from the first `master` push with the observer (DL-295 q3). Shard 3 = [tablet], shard 1 = [mobile], shard 4 = [desktop]; milliseconds after the press; "headers" is Playwright's `response` event, "body end" is `requestfinished`.**

| Run | Width | Attempt | Result | Test | POST /recalculate sent / headers / body end | refresh (rsc) sent / headers / body end |
|---|---|---|---|---|---|---|
| 45016574514 (50cb1150) | mobile | 1 | passed | 10,836 | +351 / +1,204 (200) / +1,204 | +1,268 / +1,798 (200) / +3,305 |
| 45016574514 (50cb1150) | tablet | 1 | passed | 13,708 | +73 / +612 (200) / +612 | +635 / +953 (200) / +1,414 |
| 45016574514 (50cb1150) | desktop | 1 | passed | 14,420 | +323 / +877 (200) / +884 | +922 / +1,656 (200) / +2,338 |
| 45020428761 (f02c3b54) | mobile | 1 | passed | 10,607 | +470 / +2,381 (200) / +2,393 | +2,405 / +2,741 (200) / +3,153 |
| 45020428761 (f02c3b54) | tablet | 1 | passed | 17,230 | +99 / +615 (200) / +615 | +627 / +899 (200) / +1,379 |
| 45020428761 (f02c3b54) | desktop | 1 | passed | 10,259 | +192 / +844 (200) / +844 | +856 / +1,238 (200) / +2,030 |
| 45022375651 (de4799ae) | mobile | 1 | passed | 12,650 | +114 / +976 (200) / +979 | +998 / +1,838 (200) / +3,249 |
| 45022375651 (de4799ae) | tablet | 1 | passed | 15,818 | +296 / +1,247 (200) / +1,252 | +1,303 / +1,663 (200) / +2,193 |
| 45022375651 (de4799ae) | desktop | 1 | passed | 9,882 | +248 / +807 (200) / +815 | +832 / +1,145 (200) / +1,485 |
| 45025620716 (2ff31d2b) | mobile | 1 | passed | 11,351 | +226 / +1,712 (200) / +1,712 | +1,737 / +2,031 (200) / +2,650 |
| 45025620716 (2ff31d2b) | tablet | 1 | passed | 14,080 | +85 / +552 (200) / +552 | +578 / +1,036 (200) / +1,773 |
| 45025620716 (2ff31d2b) | desktop | 1 | passed | 11,064 | +460 / +1,176 (200) / +1,183 | +1,195 / +1,723 (200) / +2,653 |

  Reading: on a passing run the POST answers in 0.5 to 1.2 s (the failures had 5.2, 5.9, 8.1 and 12.5 s) and the refresh body ends 0.5 to 2.1 s after its headers. Every later run's O5 line goes into this table, and the first failure with its O1 to O5 report goes to master the same day.

- **DEF-062 closed, 2026-11-22.** #616 squashed as f02c3b54. P1 (PR run of record 45017915849, worst 13.4 s), P2 (first `master` push after the squash, 45020428761, 0 flaky, 0 failed, worst 15.7 s) and P3 (one page open before the press) met; the three cases are now `estimate-calculate.spec.ts` :155, :213 and :248 (bound by title); R12 ended.
- **Watch list entry added: `approve.spec.ts:101` [desktop]** "AC-8: the dialog at this width > is keyboard operable, has no sideways scroll and no axe violation, and shows "Approving" while the request is under way" (an approval-dialog case, so a section 9 item 2 area). First attempt-1 failure on record: PR #613 run 45016832555 (head f70067fe, DEF-059's PR) shard 3 job 137190837912, test no. 300, **30.1 s**, "Test timeout of 30000ms exceeded." with `expect(#review-approved-notice).toBeVisible()` at :129 waiting 15 s, "element(s) not found" (no received value); the retry passed (18.6 s). A one-off on a PR run; no open Bug covers it, and trigger (1) needs two non-wave runs in a day or both attempts, so **no Bug now**. Readings in the logs QA holds, attempt 1, s, mobile / tablet / desktop: 6087e8b8 14.8 / 25.8 / 23.4; 45008501202 10.9 / 22.1 / 15.7; 45010599354 12.6 / 15.5 / 14.6; eb4137f4 20.1 / 17.4 / 18.5; 50cb1150 17.5 / 20.1 / 12.8; f02c3b54 13.4 / 26.3 / 18.4; PR #616 run 45017915849 14.4 / 21.1 / 21.3. **Trigger proposed by QA, for master to confirm (the form of DL-293 (2) and DL-294 (2)): a second attempt-1 failure in the time-out mode, on any run, in any project, is a Bug the same day (Sev-3, type Test; master told).** Tablet readings of 25.8 and 26.3 s are above the 25 s line.

- **DEF-059 closed, 2026-11-22** (type Product (layout) confirmed by the measurement: the values-loading status was 0 px wide at 1366 px). #613 squashed as de4799ae; P1 (PR run of record 45020577093) and P2 (first `master` push after the squash, 45022375651, 0 flaky, 0 failed): the new "skeleton has a width" case and the AC-4 case attempt-1 green at all three widths, worst 11.0 s. **DEF-063 closed, 2026-11-22** (cause measured as a cold first compile; Test). #617 squashed as 2ff31d2b; P1 (run 45022384312) and P2 (`master` push 45025620716, 0 flaky, 0 failed): `estimate-fasteners.spec.ts` :96, :107, :130 attempt-1 green at all three widths, worst 15.7 s.

**Regression result in a report** states the command, the count passed, failed and skipped, and the commit. A skipped test is explained or it is a failure. `quantity-cases-complete` (strategy 5.4) must be among the passing tests.

---

### 7.1 Final regression scope (hardening window; set 2026-11-21, checked against the plan of DL-275 (C) and DL-276)

**Status.** Not run. It starts after the hardening merges below have landed and the orchestrator has set the freeze (about 30 Nov, DL-276 (7)), on the delivery lead's word. `master` at this writing is `c0cf1d21` (#583); every `master` push run since `242c21f7` is read in section 7 above. **Any merge after the final regression needs a new pass** of at least the areas in the areas table at the top of section 7. Basis: CLAUDE.md section 9 items 1 to 3 and 5 (heavy browser suites run in CI, QA reads the logs), DL-275 (C1 to C4), DL-276, DL-277 to DL-284. The regression is one pass of three tiers (A to C), the G8 conditions (D), the defect list (E), the watch items (F), the live and human steps (G) and the records QA owns (H).

**A. The hardening merges that must be on `master` first, and what the regression reads for each.**

| Item | PR (state at 2026-11-21 night) | What it changed | What the regression reads (QA) |
|---|---|---|---|
| DEF-034 long-name account trigger | #579 merged `7e42970c` | top-bar trigger truncates; no sideways scroll at 768 px and wider (NFR-016) | the two cases of `master` run 44904394383 (1.4 to 3.0 s); no-horizontal-scroll check at 360, 768, 1366 px in every E2E shard |
| DEF-053 shared axe helper | #571 merged `efeed217` | `expectNoAxeViolations` returns violations only (same rules, tags, page, assertion) | every axe case still fails on a planted violation (negative control was shown on the diagnostic head, DL-275 (I)(a)); readings in section 7 |
| DEF-038 tests and diagnostic | #580 merged `cb631040` | tests only; the `[AQP-341 stored-values diagnostic]` line prints on a first-read mismatch | grep of every job log of the final head and of every `master` push run: 0 lines (0 on run 44924430846) |
| G8-C-NFR9 Lighthouse key screens | #584 merged `0f69aa20` | `KEY_SCREENS` of `lighthouserc.cjs`, seed steps in `nightly.yml`, 500-customer data | see D, G8-C-NFR9 |
| DEF-055 assignment e-mails expire | #586 merged `ae1bb352` | `send_before` = write time + 24 h; no row unless alerts and `FEATURE_EMAIL` are on; reassign expires the old Engineer's rows; **data migration** expires pending `task-assigned` rows with no `send_before` (DL-282) | CI tests of both; on the rehearsal install the count of pending `task-assigned` rows with no `send_before` before and after the upgrade (expected 0 after); Mailpit shows no stale mail when `FEATURE_EMAIL` is switched on (D, 09.08) |
| DEF-056 test fix | #587 merged `dcf8a192` | tests only | `process-items.test.ts` (28 tests) green on every run; no `.skip`, `.fixme`, `.todo` in it |
| DEF-054 security headers and CSP | #583 merged `c0cf1d21` | proxy nonce per request, CSP and four more headers on every answer, `sandbox` on data answers; HSTS is the reverse proxy's | closed 2026-11-21 on run 44924430846 (21 of 21 header E2E cases, 44 + 54 unit tests); the live `curl -I` behind the real proxy stays in G; every later E2E run is also the "nothing broke under the CSP" check |
| Export limits, body cap, install proxy checks (ADR-017; #575, #410, #576) | **#590 open** (CI running at the pause) | export thread timeout, service heap, keep-alive; request-body cap ahead of route parsing; install checks for the proxy | CI tests of the cap (an oversize body is refused before route parsing, error shape unchanged) and of the install checks in Stage 13; the 500-node export completes inside the new limits on the rehearsal machine (D, G8-C-NFR10 (b)); the README proxy section read against what the checks enforce (docs PR #581) |
| Batched audit insert (ADR-018, #568, PRF-F-05) | **#589 open** | default propagation writes its audit entries in one `recordMany` call | the audit entries of a propagation are the same set as before (count, actor, order, no secret) on the integration test and on a 500-customer run; the Process Master lock is held far less than the 1.5 to 1.8 s of #568 (developer's medians: 374 and 198 ms at 500 customers; QA reads the CI figure, not the PR table) |
| STORY-10.09 load, capacity, volume, uptime monitor (AQP-371) | **#588 open** (all required checks green; only the frozen Nightly "CI feedback time" job is red, DL-275, RISK-023) | the load, capacity and volume runs; the README "Uptime monitor" | AQP-371's ACs one by one against the PR's results (test plan 9.5 row 10.09: NFR-010 and NFR-011 at 25 and 50 users and the 500-customer volume; NFR-012 uptime check once Q-18 is answered; NFR-024 an injected fault in a route and a job is logged with time, request ID and user ID and no secret, kept 30 days). A figure that breaks an NFR is a new defect (DL-276 (4)) |
| DEF-057 diagnostic | **#591 open** | test-only diagnostic in `rates-changed.spec.ts` AC-10 (Recalculate request status and time; notice state and a second read of the server on a mismatch) | E |
| STORY-10.08 browser matrix, keyboard flows, sweep (AQP-370) | **PR opening now** | Firefox and WebKit journeys at 360 and 1366 px (NFR-019), the keyboard-flow suite, the sweep, a nightly Firefox and WebKit job | AQP-370's ACs one by one; test plan 9.5 row 10.08: every delivered screen is in the matrix; NFR-016's five sizes and both orientations; axe tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`; keyboard-only run of key flows; Chromium, Firefox and WebKit nightly. The real-phone and screen-reader part (AC-9, section 12) is human: G |
| Advisories #536 (`uuid` < 11.1.1 via `exceljs`, moderate) and #537 (`basic-ftp` <= 6.2.3, high, dev only) | open | a non-breaking bump, or accepted by the delivery lead with a reason (D5) | Stage 7 audit passes; **if `exceljs` moves, the export pack reruns**: cell-by-cell read-back, footer position, no reason and no warning in any cell, pictures |
| Docs PR #581 and records PR #494 | open | architecture v0.58 section 8 table (SQR-05), ADR-017 and ADR-018, the Windows reverse-proxy section (#576), audit batch append | QA reads the install section against #590's checks; not a code gate |

**Not in the regression's scope, by decision:** #513 and Dependabot #476 (Next 16.4.6, proposed for after G8, D6; if it lands before G8 the whole regression reruns); #545 (post-G8 E2E floor); #577 (STD-F-03, waiver asked of the delivery lead, D9); CI-speed and measurement work (CLAUDE.md section 9 item 4); the Nightly "CI feedback time" job (red and accepted, RISK-023).

**B. CI on the final `master` head (DL-275 (C1)); the push run of the head, read job by job.** Every required check fully green: secret scan (Gitleaks, full history), data-file check, lint, type-check, unit tests with coverage of pure code, dependency audit (high and above, runtime), licence check, build, migrations on an empty database and the drift check, configuration version 1, integration tests against PostgreSQL (the canary scan, the role matrix, the identical-keys test and `quantity-cases-complete` are in it), the JS budget (every route at most 200 KB gzip), E2E in four shards at mobile, tablet and desktop with axe, and the Windows package run. Reported: command or run ID, the count passed, failed and skipped, the commit; every flaky by file and title and judged under the DL-267 line; every skip explained (the E2E skips are width-specific; shards 2 to 4 show 6, 4 and 20 on `master` runs; a changed count is explained). No re-run except under W1 or R10 (R10 only on PR runs). Reference counts at `c0cf1d21`: unit 441 files / 9,792 tests, integration 595 files / 15,185 tests, E2E 534 / 527 / 528 / 513 passed.

**C. R-nightly tier (DL-275 (C2)), read from the Nightly workflow on `master`:** Chromium, Firefox and WebKit (after AQP-370 lands); Lighthouse on the five `KEY_SCREENS` at 500 customers (G8-C-NFR9); the 500-node calculation timing (NFR-008). The Nightly's one red job, "CI feedback time", is accepted and frozen; QA reads every other job of the latest Nightly on `master`.

**D. G8 conditions QA verifies or reads (none can be closed by an agent alone).**

| Condition | Source | What closes it | QA's part |
|---|---|---|---|
| **G8-C-AC8** | DL-243 (AQP-312 AC-8) | Accucut IT runs `deploy/windows/manual/AC-8-jea-prompt-check.md` on a real Windows Server test machine (about 15 minutes; a made-up `FAKE-KEY-` value; six PASS lines) and comments the result on AQP-312. No result by 1 Dec: G8 moves or the delivery lead accepts the risk in writing (D3) | reads the result; a FAIL means the full-administrator fallback of the story is a code change for the delivery lead to decide |
| **G8-C-NFR9** | DL-275 (A5), DL-281 (4) | the five key screens measured on the Wi-Fi profile (360 x 800, `rttMs` 40, `throughputKbps` 10240, 4x, median of 5; LCP at most 2 s, TBT at most 200 ms) and recorded by reviewer-performance in its final report; #574 re-graded on that evidence. Reported by the developer in #584: `/queue` LCP 312 ms, TBT 0; `/assign` 194 / 0; customers at 500 customers 290 / 40; workspace (Engineer, 500 parts) 189 / 70; cost view 242 / 0 | confirms the figures match the Nightly Lighthouse job's log on `master` and that the five screens are the ones named; does not re-measure |
| **G8-C-NFR10** | DL-271 | (a) the delivery lead answers OQ-PM-05 (largest realistic estimate with pictures) or accepts 14 to 67 s at 500 nodes in writing (D1, by 26 Nov); (b) `npm run test:perf` AC-1 (50 nodes, 50 pictures of 199 KB, gate 10 s; delivery PC p95 2.85 s) and AC-2 (500 nodes, 500 pictures; recorded: 97.5 MB, 14.3 to 67.4 s, 0.8 to 1.05 GB resident, every run completed) re-read on the target host or rehearsal machine (D4), with #590's limits in force | runs or reads the `test:perf` figures on the machine named in D4; a slower host or a limit that ends a 500-node export is a new defect or a note in the release notes |
| **09.08 real send** (AQP-355) | DL-250, DL-275 (A7) | one real send through Accucut's Microsoft 365 mailbox after Q-18 (about 28 Nov, D2); or formally deferred by the delivery lead | **DEF-055 first** (merged): count of pending `task-assigned` rows with no `send_before` before and after the upgrade (DL-282); Mailpit run showing no stale mail when `FEATURE_EMAIL` is switched on; the OAuth2 path on the real tenant |
| **Sprint stories Done or deferred in writing** | CLAUDE.md section 3, G8 | AQP-370 and AQP-371 Done with their ACs verified (A above); 09.08 Done or deferred | the AC matrix of the final regression report (sections 3 and 4) is refreshed for the stories that changed since `242c21f7`, and the 10.08 and 10.09 rows (section 5 of that report) replaced by the verified results |

**E. Defects and how each is handled at G8** (Jira open Bugs after DEF-054 closed: 11, none Sev-1 or Sev-2; DEF-054 was the last Sev-2).

| Defect | Sev, type | State | G8 handling |
|---|---|---|---|
| DEF-038 (AQP-341, #462) | Sev-3, Test (DL-277) | open on the diagnostic; Jira "In Review" | reopen trigger: any `[AQP-341 stored-values diagnostic]` line in a job log, or a first-read mismatch of `estimate-fasteners.spec.ts` "back to None": provisional Sev-2 the same day, blocks G8, master told. If it has not fired, **master accepts it in writing at G8** |
| DEF-057 (AQP-387, #585) | **Sev-2** from 2026-11-22 (DL-294 (1); was Sev-3, Test, product not excluded), type open | open; route set by DL-295 (observation first, time-box 2026-11-26; #612); `rates-changed.spec.ts:224` [tablet]; the server cleared the rates-changed state while the screen kept the notice (PR #605 run 44999981920) | **blocks G8**; next lane that frees, ahead of every Sev-3 and Minor; cause step first (matcher fix, why `/recalculate` took 5.8 s and 12.1 s, delayed-refresh local run); no re-run rule; a red run (both attempts) comes to master; a fix under `src/` gets the combined review of section 9 item 2; **master reads it as fixed or brings it to the delivery lead at G8** |
| DEF-058 (AQP-392, #602) | Sev-3, Test (DL-290 A2), **closed 2026-11-22** | closed; P1 (PR #605 run 44999981920), P2 (`master` 45008501202) and P3 met | R11 ended with it; nothing for G8 |
| DEF-059 (AQP-393, #603) | Sev-3, Product (layout) confirmed (DL-291), **closed 2026-11-22** | closed; #613 squashed as `de4799ae`; P1 (run 45020577093) and P2 (`master` 45022375651) met | nothing for G8 |
| DEF-060 (AQP-394, #608) | Sev-3, Test (DL-293 (1)), **closed 2026-11-22** | closed; #610 squashed as `ea915150`; P1 and P2 met; the freeze ended with the squash | nothing for G8; RISK-031 close-out item (i) met |
| DEF-062 (AQP-396, #614) | Sev-3, Test, **closed 2026-11-22** | closed; #616 squashed as `f02c3b54`; P1 (PR run 45017915849), P2 (`master` 45020428761) and P3 met | R12 ended with it; nothing for G8 |
| DEF-063 (AQP-397, #615) | Sev-3, Test (cold first compile, measured), **closed 2026-11-22** | closed; #617 squashed as `2ff31d2b`; P1 (run 45022384312) and P2 (`master` 45025620716) met | nothing for G8 |
| DEF-061 (AQP-395, #609) | Sev-3, Product (layout) (DL-294 (4)), **closed 2026-11-22** | closed; #611 squashed as `eb4137f4`; P1 (run 45011895045) and P2 (`master` 45013997495) met | nothing for G8 (the UX-spec sentence is ux-expert's, before the final review) |
| DEF-053 (AQP-383, #569) | Sev-3, Test, known limitation (DL-284) | open, accepted in writing for G8 | floor is the whole-page axe scan of a list filled to about 650 people; **listed in the release notes**; R10 revived for PR runs; #545 lowers it after G8 |
| DEF-052 (AQP-382, #550) | Sev-3, Test | watch, one occurrence | Stage 11 `aqp-38-sign-in.test.ts` lock-out cases read each run; a second occurrence is a lane (DL-266) |
| DEF-033, DEF-036, DEF-040, DEF-043, DEF-018 | Sev-3 | open | **fixed, or accepted in writing by master at G8** (section 6; DL-275 (A11)) |
| DEF-019, DEF-042 | Sev-4 | open | backlog (section 6) |
| Majors that are not Bugs: #568 (#589), #573 (#588), #574 (watch, re-grade with G8-C-NFR9), #575 and #410 and #576 (#590, #581), #577 (waiver D9) | Major | see A | each is Done in the code and in the final reviews' re-reads, or waived by the delivery lead in their own words, before G8 (CLAUDE.md section 9 item 3) |

**F. Watch items the final regression reads on every run** (section 7 has the readings and triggers): `users.spec.ts:58` [desktop] (DEF-053 floor); `estimate-form-sections.spec.ts` :431 and :331 [tablet] (**now DEF-058, 2026-11-22, no longer watch items; read for R11 and the fix proof**), `:145` (DL-264 (5)(a)); `estimate-first-load.spec.ts:64` [desktop] (**now DEF-059, 2026-11-22**); `estimate-treatments.spec.ts:87`; `rates-changed.spec.ts:135` (DEF-057); `estimate-calculate.spec.ts:297` [mobile] (RISK-031's original case; its 21 Nov count is in project-state); `account.spec.ts:313` [tablet] (an axe `document-title` violation once, DL-278 (5): a violation list is never a time-out); **`customers.spec.ts:262` [desktop]** (new, 2026-11-21: attempt 1 failed at 19.4 s when `expect(alertdialog).toBeVisible()` ran out on its own 15 s; retry passed; first occurrence in the six `master` push runs read, and the first `master` run with the CSP; proposed trigger: a second occurrence on any run is a Bug the same day, Sev-3, type Test, product not excluded, master told; QA does not count it on RISK-031's triggers (a) and (b) because it is not a budget cut, and master rules otherwise); the DEF-038 grep (B above). **RISK-031 is closed (DL-279)**; its four reopen triggers are checked daily and again on the final head.

**G. Live and human steps** (owners and dates are in `docs/07-qa/final-regression-report.md` section 8; this list is what the regression must have an answer for): the AC-8 kit (D); the NFR-010 re-read on the target host (D); 09.08 and the DEF-055 count (D); **a live `curl -I` on `/sign-in` and a signed-in page behind the real reverse proxy of the rehearsal install**, expecting one CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and one `Strict-Transport-Security` (the proxy's), no header twice, and `/sign-in` refused in a frame of another origin (the in-CI proof of DEF-054 covers the app; this covers the proxy, #576); a live Engineer session (view-source and the network panel on queue, task, form, Calculate, export refusal; NFR-002; the canary scan stays the gate); the export opened in Excel desktop (50 and about 500 nodes; #440); the NFR-010 25-user and NFR-011 timings if #588's script is run on the rehearsal machine; real phone, tablet, screen reader and Windows high contrast on the changed screens and the five WCAG criteria axe cannot judge (section 12); the Windows package install with a backup and restore rehearsal on a clean server by the actual Admin from the README alone (section 14); absent-feature checks (FR-090, 092, 094, 095, 096, 097); the usability test is not a gate (section 13).

**H. Records QA owns for G8 (DL-275 (A9)).** Done 2026-11-21: GitHub #127, #128 and #394 closed; defect files DEF-020, DEF-021, DEF-024 to DEF-026 closed; files DEF-013 and DEF-037 to DEF-044 exist; DEF-054 and DEF-056 closed on file, in Jira and on GitHub. To do at the end of the run: reconcile every open Bug across file, Jira and GitHub again; write `docs/07-qa/release-<version>-qa-summary.md` (pass rates, open defects by severity, residual risks, the accepted Sev-3 list for master's written acceptance, D7); refresh the AC and FR matrices of the final regression report for the changed stories; append the run as a new section of `docs/07-qa/final-regression-report.md` (the sections above are not edited, the report's addendum rule).

**I. Order of the run.** (1) Confirm the head, and that every item in A is on it, and that no PR is open against `master` except those named "not in scope". (2) Read the head's push run job by job (B), then the previous two push runs. (3) The nightly tier (C). (4) Refresh the AC and FR traceability for the stories changed since `242c21f7`, 10.08 and 10.09 first. (5) The areas-that-always-rerun table at the top of section 7 for every area A touched: export (#536 if it moves `exceljs`, #590), audit and masters (#589), auth, session and every page header (#583, #590), mail (#586), layout (#579, #571). (6) The G8 conditions (D) and the live steps (G). (7) The report, the defect reconciliation (H) and the recommendation: **ACCEPT** only if no Sev-1 or Sev-2 is open, every Major is fixed or waived in writing, every G8 condition is met or formally moved or accepted, and the head's push run is fully green; otherwise **REJECT** with the list.


## 8. Reporting and Metrics

**Per story:** `docs/07-qa/<story-id>-test-report.md` from the template, with the AC matrix (AC, test IDs, technique, result, evidence), the regression result, the non-functional results, the exploratory notes, the defect list and a recommendation of ACCEPT or REJECT. In Jira and GitHub mode the summary is a Jira comment and a PR comment, and the report is committed to the story branch.

**Per release:** `release-<version>-qa-summary.md`.

**Metrics kept** (reported, with the caveat that the numbers are small):

| Metric | Source | Reading |
|--------|--------|---------|
| AC coverage | ACs verified over ACs, per story | Must be 100 % at G7 |
| SPEC section 14 items verified | Section 9.3 | 17 of 17, with item 12's Excel-desktop open done by hand |
| CE cases asserted | Section 10 | 12 of 12 and the properties; none pending |
| Pass rate, regression | R-fast and R-e2e | Green or the reason |
| Canary coverage | Routes scanned over Engineer-reachable routes | 100 % |
| Defects by severity and by phase found | Review, QA, acceptance, escaped | Defect removal efficiency is only meaningful past about 20 defects; below that, report counts |
| Flaky tests | Reruns | 0 open at G8 |
| Usability | Section 13 | Reported as counts of attempts, not percentages |

---

## 9. Acceptance Tests by Story

The 88 candidates of `backlog.md` v0.2, in backlog order. **No story has acceptance criteria yet**, so each row lists the conditions QA expects the ACs to cover and will test, taken from the PRD fit criterion and the strategy. When the real ACs exist, the report follows them; a condition here that the ACs omit is raised to the product-owner as a gap, not silently added. Level: U unit, I integration, S security, E E2E at three widths, X export read-back, M manual. Every UI story adds NFR-016 (no horizontal scroll at 360, 768 and 1366 px, every action reachable), NFR-017 (controls at least 44 px on touch layouts) and NFR-018 (axe at WCAG 2.2 AA, keyboard-only run of its flows) as ACs (consistency report section 8); they are not repeated in each row. Tier is section 3.

### 9.1 Enablers and EPIC-01 (foundation, access, confidentiality)

| Story | Conditions QA will test (source) | Level | Tier |
|-------|----------------------------------|-------|------|
| 10.01 Scaffold, CI | Stages 1 to 11 exist and block merge (strategy 10); lint, type-check and test green on the empty scaffold; Gitleaks exercised on a string built at test time; data-file allow-list; the `n.37` placeholder pattern test fails on a pasted real-looking value; `.env.example` lists every variable and the env validation test fails on a missing one; the database guard refuses a bad connection; fork PRs get no secret; no `eval` and no Server Actions (ESLint) | I, S | A |
| 10.02 Tokens and shell | NFR-016 at the five sizes; NFR-017; NFR-018; no raw colour or size outside tokens (code search, NFR-020); logo file hash unchanged (NFR-021); contrast of every state and button text; the rupee glyph exists in each shipped font file; `lang="en-IN"`, one `h1`, landmarks, skip link first; **section 12 checks** | E, M | B |
| 01.01 Sign in, sign out | Valid sign-in opens the role's home; wrong password and unknown e-mail give one message that does not say which part was wrong, with no timing difference beyond tolerance; sign-out ends the session and the back button shows no data; lock-out after 5 failures for 15 minutes with a controlled clock, the 6th refused; a sign-in return address to another origin is ignored; cookie flags HttpOnly, Secure, SameSite on staging over TLS; CSRF with a foreign `Origin`; sign-in page carries `noindex` | I, S, E | A |
| 01.02 Role enforcement | Every manifest row as Engineer, Lead, Admin and signed out equals SPEC section 3; every `route.ts` and `page.tsx` is in the manifest and every handler uses `withRoute`; navigation per role equals SPEC section 9; direct URL to a forbidden page gives 403 (Lead) or the uniform not-found (Engineer) | I, S, E | A |
| 01.03 Engineer sees no cost | Section 11 in full, including the negative control, the identical-keys test, the uniform not-found, `Cache-Control: no-store`, and the ESLint rule shown to fire | S, E | A |
| 01.04 Users, one Admin | FR-004: list shows name, e-mail, role, active; deactivated user refused at the next request; a password set by the Admin sends that user to the "set a new password" page and every other page and API refuses until they do; FR-005: a second active Admin refused by the service **and** by direct SQL; the Admin cannot change their own role or deactivate themselves by direct call; an Admin reset clears a sign-in block; role change effective at once | I, S, E | A |
| 01.07 Audit service and screen | FR-011: one test per event type creates exactly one entry with who, when, object, before and after; the screen lists and filters by event type, user and date; direct UPDATE and DELETE refused as the runtime role; no role can edit or delete; an Engineer gets the uniform not-found; entries hold no figure the viewer may not see | I, S, E | A |
| 01.05 Password rule, change own | FR-098 table on the zod schema and on all five entry points: 9 refused, 10 accepted, 128 accepted, 129 refused; no number; no symbol; a space as the only symbol (accepted, ASSUMPTION-56); the user's e-mail in other letter case; a common password; the failing part is named; `bootstrap:admin` refuses a weak password; sign-in with an existing password never runs the rule; FR-002 old password refused after change | U, I, E | B |
| 01.06 12-hour session | FR-099 with a controlled clock: just before 12 hours accepted, just after refused; a session used every minute is still ended (activity does not extend it); a draft in progress is not lost when the session ends (error guess, see charter C9) | I, E | B |
| 01.08 About page | FR-010 text matches SPEC section 9 exactly, version line and copyright line; the descriptive word "cost" on this page must not trip the canary scan (the scan does not forbid the word) | E, S | C |

### 9.2 EPIC-02 (masters and settings), EPIC-03 (registry and engine)

| Story | Conditions QA will test (source) | Level | Tier |
|-------|----------------------------------|-------|------|
| 02.01 Process Master | FR-012: add, update, delete with search; a new item is added to every customer with the default; deleting an item a formula uses is refused and lists the formulas; rates to 2 decimals (OQ-ARCH-05); Admin only; each edit audited | I, E | B |
| 02.03 Material Master | FR-015: duplicate Material in Drawing refused; choosing a material fills Material Considered; specific gravity of 0 or below refused 422 on POST and PATCH; Material-Scrap-Rate (per kg) bounds; "Not applicable" not listed; delete refused while a Draft or Submitted estimate uses it, naming the estimates, allowed after only approved estimates use it with their screens and exports unchanged; no rate in any Engineer response | I, E, S | B |
| 02.04 Exchange Rates | FR-016: values drive BH and BI; updated-by and at shown; USD of 0 gives "—" on BJ with no error (CE-8) | U, I, E | B |
| 02.05 Treatment / Color list | FR-017: CRUD; "Other" cannot be removed; "Not applicable" not listed | I, E | C |
| 02.02 Customers with default rates | FR-013: only the name is required; a new customer starts with the current defaults; "Reset to Defaults" after confirmation restores them; delete guard as for materials; a value changed in the Process Master afterwards does not alter an approved estimate | I, E | B |
| 02.06 "Not applicable" entries | FR-018, D-17, D-27: both rows exist after `npx prisma migrate deploy` on an empty database with no seed; PATCH and DELETE on the fixed ID give 404 identical to a random ID; direct SQL UPDATE and DELETE refused; creating that name in any letter case gives 422 `NAME_RESERVED`; `GET /options/*` returns it and holds no rate for it; absent from `GET /materials`, `/treatments`, search and Admin pages; with it and N above 0: O, M and AK are 0 while AO, AQ and AS still calculate; F and I blank; the words show to every role; export shows the words in E and blank F and I; "Other" still on the Admin's list | I, S, X, E | B |
| 02.07 Delete with guard | See 02.02 and 02.03; the refusal names the estimates; one audit entry | I, E | B |
| 02.08 Propagate a changed default | FR-014, SPEC item 10: customers equal to the old default update; for each that differs the Admin chooses apply or keep, with apply-all and keep-all; Reset to Defaults works | I, E | B |
| 02.09 Settings and Last backup line | FR-105 with a controlled clock: a good run 7 days old shows its time and no notice; 9 days old adds "Backup late"; free space below 20 % adds "Disk nearly full"; a Lead gets 403, an Engineer the uniform not-found; no control starts, restores or deletes a backup | I, S, E | A |
| 03.01 Registry seed, letters | FR-020: the registry holds every SPEC section 7 field in order with letter, section, type, width and format; FR-021: position 1 is A, 26 Z, 27 AA, 52 AZ, 53 BA, 67 BO and the inverse; letters never stored; system fields cannot be deleted | U, I | B |
| 03.02 Formula engine | FR-022, 023: one test per operator, function (SUM, MIN, MAX, ROUND, IF) and comparison; a comparison outside IF is a validation error; `ROLLUP` is not a function; unknown name, syntax error and cycle rejected, the cycle shown; dependency order; no `eval` or `new Function` (code search and ESLint); coverage of `src/lib/formula/**` at or above 95 % | U | A |
| 03.03 Row-level outputs | FR-024, 026, 027, 028, FR-018 effect: one test per formula in SPEC section 7.4 against `acceptanceTree` with a hand-calculated table reviewed before the run; O equals `M - N` exactly, N above M included (A-21); a rate typed 12 % is used as 0.12; division by zero shows "—" and calculation continues; stored at full precision, shown to 2 decimals; row outputs depend on no other row | U, I | A |
| 03.05 Calculation record | FR-031: each Calculate and Recalculate stores the configuration version and every master value used; after any master changes, the earlier calculation is unchanged; direct UPDATE of `calculations`, `calculation_rows` refused; each press has its own record with the presser's name | I, S | A |
| 03.04 Product total (BL, BN, BO) | **Section 10 in full.** FR-025, 029, 030; the seed `BL = SUM(BG)`; `quantity-in-one-formula`, `bl-is-sum-bg`, `no-rolled-up-figure`, `quantity-cases-complete` pass | U, I | A |
| 03.06 Performance gate | NFR-008: `tree500`, 20 runs, p95 under 2 s; the machine specification recorded in the result | I (timed) | B |

### 9.3 EPIC-04 (tasks and queues), EPIC-05 (workspace)

| Story | Conditions QA will test (source) | Level | Tier |
|-------|----------------------------------|-------|------|
| 04.01 Assign a task | FR-032, 033, 041: the task appears in the Engineer's Open queue and the estimate exists in Draft; the folder path is a link with a Copy path button that places the exact path on the clipboard; a tooltip explains blocked links; task ID `Q-<year>-<4 digits>` unique, the year taken in IST (a task created at 23:30 IST on 31 December and one at 00:30 IST on 1 January); deadline stored in UTC and shown in IST; deadline in the past; empty path; very long title | I, E | B |
| 04.02 Queues by role | FR-034: Open, Closed and Overdue tabs sorted by deadline ascending; an overdue task also stays in Open; an Engineer sees only own tasks and another's task gives the uniform not-found; Lead and Admin see all | I, S, E | B |
| 04.03 Overdue cues and bell | FR-036: colour, icon and "Overdue by X" all present; FR-037: counts per role (Engineer own, Lead assigned by me, Admin all); the bell opens the Overdue tab; visible on mobile; a Lead's bell count equals their Overdue tab (ux-spec section 4); overdue flips at the right instant (controlled clock at 23:30 and 03:00 IST) | I, E | B |
| 04.04 Engineer sees status | FR-102: every Engineer page that lists or opens own work shows the status and never a price; the canary scan still finds 0 | E, S | A |
| 04.05 Task closes and reopens | FR-038: Approve moves the task to Closed; unlock returns it to Open; cancel of an approved estimate reopens it; cancel on Draft or Submitted leaves status as it is | I, E | B |
| 04.06 Lead filter, task filters | FR-035: a Lead's queue opens on "Assigned by me" and can change it; FR-039: filters by Engineer, customer and date narrow the list | I, E | C |
| 04.07 Reassign, change deadline (R2) | FR-040: change logged with who, when, old and new; no cancel function exists | I, E | C |
| 06.01 Status flow | FR-064 state transitions: Draft to Submitted to Approved, unlock back to Draft; every other transition refused by the service (decision table over all pairs); Engineer's inputs read-only once Submitted, by direct call too; no return-to-Engineer action; a Lead's or Admin's Recalculate on a Draft sets Submitted with the same checks as Calculate (A-08) | U, I, S | A |
| 05.01 Open task, choose customer | FR-042: entry is blocked until a customer is chosen; changing it asks for confirmation; the new customer's rates apply at the next calculation; the Engineer sees the customer name and never the rates | I, E, S | B |
| 05.02 Build the parts tree | FR-043, 044, SPEC item 3: add child and sibling, reorder by buttons, delete; Sl. No gives 1, 1.1, 1.1.1, 1.1.2, 1.2 and renumbers after each operation at any depth; "1.10" keeps its zero; 500 nodes; each operation is an input change (FR-100) | U, E | B |
| 05.03 Part form, first sections, hint | FR-045, 046, 051, 052, 029: fields in SPEC order with their letter badge; Enter moves to the next field in order; F is read-only and shaded; I is absent from the page and the data; numbers accept 2 decimals, refuse a negative and a 3-decimal entry with a message; decimal keyboard on a phone; the hint beside QTY per Assy states it is the count for the whole order while the label and Excel header still read QTY per Assy; **R-10 on a real phone** (section 12) | U, E, M | A |
| 05.04 Part form, remaining sections | FR-045: every SPEC section 7.1 field present, in eight sections, each section showing its column range; Enter order across sections | E | B |
| 05.05 Fasteners fields | FR-048, SPEC item 4: S defaults to "None"; with "None" or blank T and U are hidden, not required and stored and exported as 0; choosing another value shows and requires them | U, E | B |
| 05.06 Surface Treatments, Treatment / Color | FR-049, 050: one multi-select sets the eight flags Z to AG (selected 1, not selected 0), none allowed; "Other" reveals a text box whose text is stored and exported | U, E, X | B |
| 05.07 Part picture, optional | FR-047: the limit is 204,800 bytes (10573): 204,799 accepted, 204,800 refused (labelled assumption, "under"; QA-OQ-08), 204,801 refused, and the strategy's 199 x 1024 accepted and 201 x 1024 refused; PNG, JPG, GIF and WebP accepted; a text file renamed `.png` and a polyglot refused with a clear message; paste, drag and drop, file choice; camera and gallery on a phone (once on a real device); preview, replace, remove; a part with no picture passes Calculate, is not listed as missing and exports an empty cell C | I, S, E | B |
| 05.08 Save a draft, unsaved warning | FR-053: a draft saves with blanks; leaving with unsaved changes warns (browser close, in-app navigation and sign-out); a save that changes nothing does not bump `inputs_revision` | I, E | B |
| 05.09 Calculate | FR-055, 056, SPEC item 4: a blank visible input (Remarks included, Part Model excepted) blocks, names the nodes and fields, flags the tree and submits nothing; hidden Fasteners fields never block; 0 in any other number field is accepted; success gives status Submitted and exactly the one message; **the Engineer's response body is exactly `{status, message}`**; blank check precedes the warning (a blank with an H of 0 gives 422 `CALCULATE_BLOCKED`, not the 409); two simultaneous presses give one calculation; only the assigned Engineer may press | U, I, S, E | A |
| 05.12 Warn on a 0 in QTY per Assy | FR-104 conditions 1, 2, 5, 6, 7, 8, 9 and **the whole of strategy 5.2 CE-9 test table**: 409 `CALCULATE_ACK_REQUIRED` with the revision and one warning per row and nothing written; the acknowledged request succeeds, records the warning, creates one `calculation.warning_acknowledged` audit row in the same transaction naming rows and no figure; a stale acknowledgement never passes, including two concurrent requests; an acknowledgement with no warning due is ignored; `{"acknowledge": true}` is 400; 0.01 gives no warning, `0.00` does; dialog wording, "Go back" leaves the estimate Draft, focus starts on the safe choice; the same 409 body under two sets of `canaryMasters` | U, I, S, E | A |
| 05.10 Autosave every 30 seconds (R1+) | FR-054: edit, wait 30 s (controlled clock), reload, the edit is present; a repeated PATCH with the same values, `1.50` against `1.5` included, does not clear figures | I, E | B |
| 05.11 Completeness count, tree icons (R1+) | FR-057: count and icon correct on seeded data; icon as well as colour; Part Model ignored | E | C |

### 9.4 EPIC-06 (cost review and approval)

| Story | Conditions QA will test (source) | Level | Tier |
|-------|----------------------------------|-------|------|
| 06.02 Estimate review | FR-024, 025, 029, 030 display: BL, BN and BO each appear once with hand-calculated values; BN is "—" when the total Tool Cost is 0; **a parent shows only its own row's BG, BJ and BK, equal to its row in the file, and no sum of rows below or item total exists in any response**; while cleared, BL and BN show no value and BO still shows the latest approved price, labelled | I, E, X | A |
| 06.03 Cost details, Lead formula view | FR-058, 059, 060: the button is absent for Engineers; every stage with its formula for Lead and Admin; cost lines for unselected Surface Treatments hidden but present as 0 in the export (SPEC item 5); no edit control for a Lead; taking the operands printed on SCR-07, the worked line reproduces the printed result | I, E, X | B |
| 06.04 Recalculate, cleared figures | FR-061, 100, strategy section 9 "Added for SPEC v1.4": for each kind of input change (a number, Remarks, customer, picture, add, delete, move, reorder) `/costs` returns no BL, BN, total Tool Cost or calculated row value, and `/nodes/{id}/costs` returns the state alone; inputs including H stay; Recalculate restores them; autosave and an identical PATCH do not clear; change and change back stays cleared; the `calculations` row is unchanged; BO still shows the latest approved price, labelled; **no stale, italic or flagged figure exists anywhere in the DOM** | I, E | A |
| 06.05 Approval blocked while not current | FR-101: by direct API call Approve is refused with `NOT_CALCULATED` and `TOTALS_OUT_OF_DATE`; two concurrent requests, an input save and an approve, never approve on figures older than the save; the message names the missing step; after Recalculate approval is accepted | I, S, E | A |
| 06.06 Approve and lock | FR-062, NFR-026: pre-filled with BL and editable; inputs read-only afterwards by direct call; approver and time recorded; an override is logged once; BL of 100.004 with a price of 100.00 is not an override and 100.01 is (A-12); price of 0, negative, 3 decimals, text, very large; only Lead and Admin, an Engineer gets the uniform not-found; direct UPDATE on approved data refused | U, I, S, E | A |
| 06.07 Price override reason | FR-103: approve at a changed price with no reason is accepted and logged; with a reason it is stored and shown in the audit entry; dropped when the price is not an override; 500 characters accepted and 501 refused; script text renders as text; **the reason is in no cell of the file, in no Engineer response** | I, S, X, E | B |
| 06.08 Unlock with reason and notices | FR-063: reason required; status returns to Draft; task reopens; notice if the configuration changed, and if rates changed; the earlier approved price stays labelled "approved earlier" through the unlock and any later input change until a new approval replaces it; recalculating afterwards uses current masters; unlock with no input change keeps figures `current`, and approval still needs a Recalculate; `/costs` gives who, when and the reason; revert and a second unlock | I, E | A |
| 06.09 Approved keeps its values | FR-065, NFR-026: approve, then change a process rate, a material price and an exchange rate, rename a material and a treatment, delete an unused rate; screen data and every export cell are identical before and after | I, X | A |
| 06.10 Quantity warning for Lead and Admin | FR-104 conditions 3, 4: a Lead's Recalculate and an Admin's Recalculate warn even where the Engineer acknowledged; the Engineer's calculation keeps the Engineer's name and the new one the Lead's; the notice names row, person and time while figures are current, is withheld while cleared, and Approve still succeeds with warnings on the calculation | I, E | A |
| 06.11 Rate-change notice | FR-106, strategy section 9 "OQ-ARCH-06": change a rate used by a current Submitted estimate and `/costs` gives counts by kind and no value; approval still succeeds; a rate the calculation did not use gives nothing; an approved estimate gives nothing; a formula change alone gives nothing; the Engineer's data holds nothing; after Recalculate the notice is gone; one `rate-diff` table test shared with `/unlock-preview` | I, S, E | B |
| 06.12 Cancel approval, Admin only | FR-107, strategy section 9 "A-30": Lead 403 and no button; Engineer the uniform not-found; wrong or missing password and an empty reason give 422 `STEP_UP_FAILED` or a validation error; a stale `approvalId` gives 409 `APPROVAL_CHANGED`; cancel on Approved gives Draft and reopens the task, on Draft or Submitted the status stays; the price stays on screen labelled "Approval cancelled" and BO2 is empty in a new file; one audit row in the same transaction holding the price; the `calculations` row unchanged; a wrong step-up does not block sign-in | I, S, E, X | A |
| 06.13 Remove the cancelled price | FR-108: not offered before a cancel; remove before cancel gives 409; second password required; afterwards "Not set yet" on every screen and no route returns the price; a second removal refused; a new approval after Recalculate brings a price back; the audit record keeps the price and only the Admin reads it; direct SQL UPDATE of `approved_price` as the runtime role refused | I, S, E, X | A |

### 9.5 EPIC-07 (export), EPIC-10 remainder, EPIC-08, EPIC-09

| Story | Conditions QA will test (source) | Level | Tier |
|-------|----------------------------------|-------|------|
| 07.01 Download the worksheet layout | FR-066, 071, SPEC item 12 checklist by ExcelJS read-back: header row 1, columns A to BO in order, widths, centre and middle alignment, rupee, dollar and euro formats; file name `Quotation_<Customer>_<TaskId>_<YYYY-MM-DD>.xlsx` (customer names with slash, quote, accents, very long); **one manual open in Excel desktop per release with no repair prompt** | X, M | B |
| 07.02 Node rows, picture, hidden lines | FR-067, 068: one row per node depth-first; Sl. No as text so "1.10" keeps its zero; picture in column C scaled to fit, empty for a part with none; hidden cost lines and hidden Fasteners fields as 0; a divide-by-zero cell empty; a value starting `=` is a string cell, not a formula | X | B |
| 07.03 One total, total Tool Cost | FR-069, strategy section 9 "footer position": BL2, BN2 and BO2 once in row 2; no per-item totals; with 10 nodes row 12 is empty and row 13 holds the value under Tool Cost with the label to its left, with 1 node the footer is row 4; no Tool Cost gives 0 and an empty BN2; each node's BM entry as typed; the sum of the exported BG column equals BL2 at any quantity; BO2 is the latest approved price, empty after a cancel; no reason and no warning in any cell | X | A |
| 07.04 Refuse the download until current | FR-070, SPEC item 15: an Engineer is refused; never calculated gives 409 `NOT_CALCULATED`; out of date gives 409 `EXPORT_OUT_OF_DATE` and `allowOutOfDate=true` changes nothing; a change between `export-summary` and `export` still gives the 409; at `current` the file downloads; **every other route works as usual**, only the download is refused; no partial file; the message links to Calculate or Recalculate | I, S, E | A |
| 07.06 Warning notice on the export preview | FR-104: SCR-10 shows the notice while figures are current and withholds it while cleared; says the file carries no warning | E | B |
| 07.05 Export size and time gate | NFR-010: 50 nodes with 50 images p95 at or under 10 s; page latency at or under 500 ms p95 while a 500-node export runs; memory of `app` under its limit | k6 | B |
| 10.06 Reserved drawing region | FR-087: one reserved region at 1024 px and wider on the workspace, none below; no horizontal scroll at 1024 | E | C |
| 10.03 Page metadata | FR-089, NFR-022 on every route in the manifest: title at most 60, description at most 160, Open Graph title and description; `noindex, nofollow` behind sign-in and on the sign-in page; reset page sends `no-referrer`; no sharing-image tag; none of the canary values or customer names in any tag | E, S | C |
| 10.04 Install and update | FR-091 part, NFR-030: on a clean VM, someone who did not write the README reaches a working sign-in page within 30 minutes by the README alone; `.env.example` lists every variable; `/api/health` passes; the update procedure with rollback by image tag; production seeding refuses placeholder values | M, timed | A |
| 10.05 Weekly backup, watch, free space | FR-091, NFR-013: `backup.sh` writes an encrypted copy, a manifest (date, image tag, PostgreSQL version, size, SHA-256) and a `job_runs` row; with too little free space it makes no copy, records a failed run and removes no copy; `backup-watch` with a controlled clock: 7 days raises nothing, 8 days logs `error` and writes one outbox row, a re-run writes no second; alert below 20 % free; retention with controlled dates: just under 2 years stays, just over goes, a failed run never removes a good copy; no private key on the host | I, M | A |
| 10.11 Admin restores with one guided command | Section 14: scripted failure paths at G7, then the Admin's rehearsal before G8 | I, M | A |
| 10.07 Loading, empty, error states (R1+) | FR-088: three states and a save confirmation on each data screen | E | C |
| 10.08 E2E, responsive, accessibility suites | QA reviews the suite for completeness: every delivered screen is in the matrix; NFR-016's five sizes and both orientations; axe rules `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`; keyboard-only run of key flows; Chromium, Firefox, WebKit nightly | E | B |
| 10.09 Performance, capacity, observability | NFR-010 and 011 k6 at 25 and 50 users; NFR-012 uptime check once Q-18 is answered; NFR-024 an injected fault in a route and a job is logged with time, request ID and user ID and no secret; logs kept 30 days | k6, M | B |
| 10.10 NFR-009 guards (AQP-169, enabler) | NFR-009 Lighthouse mobile preset on the five key screens (LCP at or under 2 s and Total Blocking Time at or under 200 ms), median of 5 runs (PROPOSED in the PRD) on the office Wi-Fi profile, which decides: 360 x 800 viewport, `rttMs` 40, `throughputKbps` 10240, `cpuSlowdownMultiplier` 4 (PRD NFR-009; Slow 4G is retired as the pass/fail profile). A nightly run on Slow 4G (`rttMs` 150, `throughputKbps` 1638.4, 4x) is reported and does not decide. First-load JavaScript at most 200 KB gzip on every route, checked after `npm run build`. The Lighthouse baseline of `/` moves to this story's G7. The G7 of AQP-28 (10.02) still records a reference Lighthouse run of `/` on the Wi-Fi profile if possible (AQP-1 10710); it is a reference, not a pass/fail check | Lighthouse CI, I | B |
| 10.12 Privacy and data handling | NFR-028, 029: repository scan finds 0 real personal data in fixtures; the interface is English only | I | C |
| 08.01 Fields and formulas list (R2) | FR-072: the list matches the registry; a Lead sees formulas read-only | I, E | B |
| 08.02 Edit a formula (R2) | FR-073, 080, SPEC item 9: autocomplete, live check, preview against a sample node; unknown letter or rate name, syntax error and cycle cannot be saved; save needs the password | U, I, E | B |
| 08.03 Insert a field (R2) | FR-074, 075, SPEC item 6: insert after AX gives a new AY, former AY to BO shift by one, formulas re-letter and calculate the same results, BL2 and BO2 move to BM2 and BP2; **property test over random insert positions**; export read-back; new inputs are mandatory and visible to Engineers, **new outputs hidden from Engineers (canary scan on a new output)** | U, I, X, S | A |
| 08.04 Delete a field (R2) | FR-076, SPEC item 7: a referenced field is blocked with the list of formulas; an unreferenced one deletes and later letters shift back; system fields refused; step-up required | I, E | B |
| 08.05 Configuration versions (R2) | FR-077: every change creates an immutable version; each estimate records its version; approved estimates are pinned; changing a formula leaves an approved estimate's values and layout unchanged | I, X | A |
| 08.06 Checkpoints and revert (R2) | FR-078, SPEC item 8: revert restores the exact earlier configuration; logged; can be undone; revert to the version before a checkpoint that has none; checkpoints never touch estimate data; approved estimates still show and export their original values; step-up required | I, E | B |
| 08.07 Change history (R2) | FR-079: each change appears with who, when, old and new; filter by user and date | I, E | C |
| 01.09 Admin hand-over (R2) | FR-006, NFR-004: after the step exactly one active Admin exists and it is logged; refused without the correct password; the README checklist for passing the key and the server access exists (inspection) | I, E, M | B |
| 09.01 Mail outbox and transport (R2) | NFR-014: each `SMTP_AUTH_MODE` builds the expected Nodemailer options; a local stub token endpoint gives a token, a renewal after a refused token, and an expired-secret failure that ends `failed` with no secret in `last_error` or the log | I | B |
| 09.02 Settings: switch, sender, test e-mail (R2) | FR-019: alerts OFF sends none; the test e-mail arrives (Mailpit; the real mailbox once OQ-ARCH-11 is answered); a stubbed 5.7.60 refusal gives `SENDER_NOT_ALLOWED` with no secret in the response or the log | I, E | B |
| 09.03 Assignment e-mail (R2) | FR-081, SPEC item 11: To the Engineer, Cc the assigner, details, folder path, deadline in IST, only when ON; the body holds no forbidden string | I, S | B |
| 09.04 Overdue e-mail within 5 minutes (R2) | FR-082: sent within 5 minutes in a controlled-clock test, Cc the assigner | I | B |
| 09.05 Daily digest at 11:00 IST (R2) | FR-083: sent at 11:00 IST, Cc the assigning Leads, none when nothing is overdue; 03:00 IST is the previous date in UTC | I | B |
| 09.06 No duplicates, logged, retried (R2) | FR-084, NFR-014: a re-run sends 0 duplicates; failures retried 3 times and logged; catch-up after a restart; at most 25 claimed per run; two workers do not double-send | I | B |
| 09.07 Reset a password by e-mailed link (R2) | FR-003: the link works once and a second use is refused; an unknown e-mail gets the same response; the new password meets FR-098; the page sends `no-referrer` and `noindex` | I, S, E | B |
| 09.08 One real send (R2) | FR-019 verification: one message through the actual mailbox, with the result and headers recorded and no secret in any log. Needs Accucut IT. **The only proof of the mail sign-in**; alerts are not live without it. **Added 2026-11-21 (DL-282, DEF-055 fix #586, migration `20261121160000_expire_unsent_assignment_mail`):** on the rehearsal install, before the upgrade that carries the migration and before `FEATURE_EMAIL` is switched on, QA records the count of pending `task-assigned` rows with `send_before IS NULL` (`SELECT count(*) FROM email_outbox WHERE event = 'task-assigned' AND status = 'pending' AND send_before IS NULL;`) and again after the upgrade; **expect 0 after**. Then switch e-mail on and check that no old "Task assigned" mail goes out (only mails of assignments made after the upgrade). Counts go in the release notes inputs and the rehearsal log | M | B |

### 9.6 SPEC section 14 acceptance map

SPEC section 14 now has 17 items. `test-strategy.md` section 12 maps items 1 to 14 and its coverage target says "14 of 14"; items 15 to 17 were added later (issue for the solution-architect, section 18.3). This plan maps all 17.

| SPEC item | Stories that carry it | Verified by | First possible |
|-----------|----------------------|-------------|----------------|
| 1 Engineer sees no cost | 01.03 and every Engineer-reachable story | Section 11 | 01.03 |
| 2 Outputs match to 2 decimals | 03.03, 03.04 | `acceptanceTree`, one test per formula, CE cases (section 10) | 03.04 |
| 3 Sl. No renumbers | 05.02 | Unit, E2E | 05.02 |
| 4 Calculate validation | 05.09, 05.05 | Integration, E2E | 05.09 |
| 5 Hidden treatment lines | 06.03, 07.02 | View test, export read-back | 07.02 |
| 6 Insert after AX | 08.03 | Integration, property test, read-back | R2 |
| 7 Delete referenced field | 08.04 | Integration | R2 |
| 8 Revert | 08.06 | Integration, approved estimate unchanged | R2 |
| 9 Step-up, invalid formula | 08.02, 08.04, 08.06 | Integration | R2 |
| 10 Master sync | 02.08 | Integration | R1+ |
| 11 E-mails | 09.03 to 09.06 | Controlled clock; the real send by hand | R2 |
| 12 Export | 07.01 to 07.03 | Read-back; manual open in Excel desktop. Read with the D-16 exception: one total only, the total Tool Cost in the footer | 07.03 |
| 13 No horizontal scroll | Every UI story, 10.08 | Playwright at 360, 768, 1366 px | 10.02 |
| 14 One Admin | 01.04 | Integration; direct SQL | 01.04 |
| 15 Download refused until current | 07.04 | Integration, E2E | 07.04 |
| 16 Only the Admin cancels and removes | 06.12, 06.13 | Integration, E2E | 06.13 |
| 17 Rate notice, approval not blocked | 06.11 | Integration, E2E | 06.11 |

---

## 10. The CE Cases (the quantity rule and BL)

The oracle is `test-strategy.md` section 5 (SPEC section 14.2 and section 18.5; the rule settled on AQP-26 comments 10535 and 10537; AQP-14 comment 10510). Every value is invented and was worked by hand in the strategy. **BL = SUM(BG) over all rows; H is the count for the whole order, typed on every row; nothing is multiplied down the tree; a parent shows only its own row.** Stored BG = per-piece cost x H typed.

**QA's G7 rule for story 03.04 and any story citing these cases:** every row below is asserted and passes, from the first commit, with no `it.todo`, `.skip`, `.skipIf`, `.fails` or `.only`; `quantity-cases-complete` is among the passing tests and has been shown to fail on a planted `it.todo`; each case runs twice, once through the evaluator with stated BG and once as a real estimate through `calculation-service` (strategy 5.3). A pending case makes the AC unverified and the recommendation REJECT.

| Case | Setup (invented) | Expected | The named wrong answer, and what it means |
|------|------------------|----------|-------------------------------------------|
| CE-1 | Frames, pipes, lids typed 2, 6, 24 at per-piece cost 0, 1, 1. BG 0, 6, 24 | BL **30**. With cost on the lids alone, 24 | 300: typed counts multiplied down the tree. 612: a row's own H applied twice. 2: H not applied |
| CE-2 A | Item 4 at 150, its part 12 at 20. BG 600, 240 | **840** | 1560: counts multiplied down the tree |
| CE-2 B | Item 2 at 5, part 6 at 7, sub-part 24 at 11 | 10 + 42 + 264 = **316** | |
| CE-2 C | As A with 3 typed on the part | **660** | A valid estimate; pins that the count is taken as typed. No check can catch it (ARCH-R6) |
| CE-3 | Two top-level items typed 2 and 3, each with 0 on its row and one child typed 2 and 3 at cost 1 | **5**; no per-item figure in any response | |
| CE-4 | Item 1. Parent P 1 at 10, child S 1 at 5 | **15**; P shows 10 on screen and in the file, S shows 5. With P at 2: **25**. With S also 2: **30** | 5: children only |
| CE-5 | All quantities 1, a random tree | BL equals the sum of per-piece costs | |
| CE-6 | Item 2 at 0. Below it A 6, B 30, C 210, each at 1, one under the other | **246** | |
| CE-7 | CE-1 tree; Tool Cost 2 on P and 3 on S | Total Tool Cost **5**, no quantity applied; BN = 30 / 5 = **6**. With no Tool Cost, BN is "—", the export cell empty, total Tool Cost 0 | |
| CE-8 | Exchange rate USD 0 | BJ "—" on each row; BG and BL unaffected; no error. A formula that makes a BG null gives BL "—", never a lower number | |
| CE-9 A | Item 2 at 0; part H 0 at 1; sub-part 24 at 1 | BL **24**; warning on 1.1 | 0: the withdrawn rule |
| CE-9 B | A plus a second part H 6 at 1 | **30**; warning on 1.1 | |
| CE-9 C | Item 2; part H 0; below it H 0; below that 24, each at 1 | **24**; warnings on 1.1 and 1.1.1 | |
| CE-9 D | Top-level item H 0 at 3, one child H 4 at 1 | **4**; one warning, the item's own | |
| CE-9 E | Item 2 at 0; part H 0 at 1 with nothing below; part H 2 at 1 | **2**; warning on 1.1 | |
| CE-9 F | Top-level item H 0 at 5, nothing below | **0**; one warning | |
| CE-9 G | Item 2 at 0; part H 0 at 1; below it H 0 at 1, nothing below that | **0**; warnings on 1.1 and 1.1.1 | |
| CE-10 | Item 2 at 0; part 0.5 at 2; sub-part 1.25 at 4. BG 0, 1, 5 | **6** | |
| CE-11 | CE-1; reorder siblings; move S directly under the item | **30** both times. A move changes Sl. No but not the price, and still clears the totals until Recalculate | |
| CE-12 A | Childless item H 3 at 5, BG 15 | **15** | 45: item quantity applied to its own row again |
| CE-12 B | The same at H 1, BG 5 | **5** | 5: the two agree, which is why a sample at quantity 1 cannot catch this |
| CE-12 C | Item X H 2 at 0 with one child typed 2 at 1; item Y as variant A | **17** | 47 |
| CE-12 D | Their own example: the item alone, H 5, per-piece cost 200 | **1000** | 5000 |

**Properties** (fast generated trees, compare at 2 decimals; the generator must make top-level items with their own cost, with and without children, and H of 0, above 1 and fractional): BL equals a plain loop over BG; reordering siblings or moving a node leaves BL unchanged; setting one row's H to 0 lowers BL by exactly that row's BG.

**Warnings column of CE-9** belongs to story 05.12 and the Lead stories 06.10 and 07.06; its BL column belongs to 03.04.

**Through the export.** For CE-1 the file shows row BG of 0, 6 and 24 and BL2 of 30, and the Lead's data shows the same three figures. For every case the sum of the exported BG column equals BL2.

**The parallel run (TR-004)** compares the portal with the worksheet's own formula on estimates the delivery lead chooses. Its data stays outside the repository and its result is reported as agreement or not, never as values. QA has no say in what is compared and does not hold the data.

---

## 11. The Canary Scan: Engineers receive no cost data (NFR-002, SPEC item 1)

The method is the strategy's (section 6). This plan adds who runs it, when, and the independent pass.

**What is scanned.** Signed in as an Engineer, Playwright runs the journeys (queue, open task, tree, form, images, Calculate, the Warn dialog, after submit, after approve), recording every response: HTML, RSC flight payloads, JSON, headers and the JS chunks the pages load. It also calls every Engineer-reachable route in the manifest directly, and every Lead and Admin route as an Engineer (403 or the uniform not-found, with no body data). `canaryMasters` gives every process rate, customer rate, material price, specific gravity, Material-Scrap-Rate (per kg) and exchange rate a unique sentinel with a rare digit pattern, and the estimate is calculated and approved so every Restricted output exists with a known value.

**Forbidden in any Engineer-reachable byte:** each sentinel and each calculated output as plain digits, in Indian grouping and in 2-decimal form; rate names, `Material-Price`, `{{f:`, `{{rate:`, formula text. **Allowed:** what the Engineer typed, including Machining, Plating, Tool and Fasteners Cost (FR-008), and the descriptive word "cost" (About page, FR-010). The canary estimate's inputs are chosen so no output equals a typed value, or the scan raises a false alarm.

**Negative control.** A test-only route returns one sentinel and the scanner must report it. If it cannot find a planted leak, the suite fails. This is shown at 01.03's G7 and re-shown whenever the scanner changes.

**Also asserted** (strategy 6): Calculate's Engineer response is exactly `{status, message}`; `GET /tree` and `GET /form` give the same keys to an Engineer and a Lead; a missing estimate and another Engineer's estimate give byte-identical responses; the export file, summary and page refuse an Engineer with no data; no `calculation_rows` import reachable from Engineer views (ESLint rule shown to fire); e-mail bodies hold no forbidden string; the Engineer's data carries no figure state and no `override_reason`; `Cache-Control: no-store` on every authenticated response; the 409 body of the Warn path has one strict schema for every role and is the same under two sets of `canaryMasters` apart from `requestId`; after an acknowledged Calculate no Engineer response holds `warnings`.

### 11.1 When it runs

| When | Who | Scope |
|------|-----|-------|
| Every PR | CI | Whole canary suite, every Engineer-reachable route |
| 01.03's G7 | QA | Whole suite, negative control, ESLint rule, independent pass (11.2) |
| G7 of every story that adds or changes an Engineer-reachable route, field, view model, message or e-mail | QA | Whole suite plus the story's new route by direct call, plus the independent pass on that route |
| G7 of 08.03 (new output hidden from Engineers) | QA | A new Restricted output in a calculated estimate must appear in no Engineer byte |
| Release | QA | Whole suite on the release candidate, the staging build and its production image |

### 11.2 The QA-owned independent pass

The developer's scanner is trusted only if something else agrees with it. QA's pass differs in three ways: (1) it builds its route list from the file system (`route.ts`, `page.tsx`) and the built `.next` output, not from the developer's manifest, so a route missing from the manifest is still scanned (`qaCanaryRoutes`); (2) it signs in through the UI, follows every link and button the Engineer can reach, and records the traffic itself; (3) it looks for **transformed** values, which an exact-digit match misses: a total shown to 1 decimal or rounded to whole rupees, a ratio of two sentinels, a value converted to dollars, a value in words, a percentage, a sum of two rates. Where such a form is possible, a sentinel is chosen so its transformed form is also unique. A leak found by this pass is Sev-1.

### 11.3 What the scan cannot see

A value hidden in an image or a PDF (neither exists in scope); a leak through timing or response size (a Lead-only code path that takes longer, or a body that is longer when an estimate has a cost); a leak to a person with server access (NFR-007, ARCH-R8). QA tries the response-size difference once as an exploratory item (charter C1).

---

## 12. Phone, Screen Reader and High-Contrast Checks (DL-017; first UI story, 10.02)

**Due:** at the G7 of STORY-10.02 on the built pages, as DL-017 and CR-20 set. They do not hold G3 or G4. **Why on built pages:** the mock-ups are rebuilt with shadcn/ui, so a check of them would not prove the product.

**A limit stated now.** At 10.02's G7 the built pages are the shell and whatever 10.01 and 10.02 deliver; the sign-in page (01.01) is rank 3 and the workspace much later. So the check at 10.02 proves the header, navigation frame, skip link, focus ring, tokens, brand red and contrast; it cannot prove forms, dialogs, tables, the tree drawer or the sticky action bar. QA therefore also runs **carry-forward checks** at the G7 of the first story that introduces each component class, using the same method and recording in that story's report:

| Component class | First story | Added checks |
|-----------------|-------------|--------------|
| Form, errors, password field | 01.01 | Screen reader reads labels and the error summary; focus goes to the error summary; show or hide password; high-contrast error border and icon |
| Queue as cards (phone) and table, tabs, bell | 04.02, 04.03 | Cards on a phone, tabs by arrow keys, the bell's accessible name and count, "Overdue by X" not by colour alone |
| Tree drawer, guided form, sticky action bar | 05.02, 05.03 | **R-6** (the drawer is found) and **R-10** (the 189 px sticky offset with the phone keyboard open: tabbing and typing through section 08 leaves the focused field visible) on one real phone; Enter-to-next; picture field with camera |
| Alert dialog (Warn), approval dialogs | 05.12, 06.06 | Focus enters the dialog, is trapped, returns; initial focus on the safe choice; the dialog is announced; Escape closes |
| Cleared state, notices, Settings | 06.04, 06.10, 02.09 | The cleared total is announced as needing Recalculate, not as an error; notices reachable and read |

**Accepted (DL-035, QA-OQ-01):** DL-017 is met at the G7 of 10.02 for the shell only, and these carry-forward checks finish it. Any carry-forward check not run is listed in the G8 record.

### 12.1 Real phone

**Devices.** At least one real phone per release (NFR-019); for 10.02, a low-end phone if one can be found, because brand red with white text is 4.59:1 and the margin is narrow (R-5). Android with Chrome and an iPhone with Safari are both wanted. **The delivery lead provides a real phone (10573, QA-OQ-04 answered), and offered one.** The report states which phone, system and browser was used; the other platform is a check not run and is listed at G8. The Windows PC, its screen reader and Excel desktop are also provided.

| # | Check | Pass |
|---|-------|------|
| P1 | Open the staging build over TLS at the phone's portrait and landscape orientation | No horizontal page scroll; header, menu and every action reachable |
| P2 | Tap targets | Every control is easy to hit; none under 44 px except the stated row icons (36 px) |
| P3 | Daylight (R-5) | Outdoors or at a window, brand-red buttons with white text are legible; if weak, the button red goes to the darker value the UX spec names (#C42626, 6.0:1) and nothing else changes |
| P4 | Text zoom and reflow | At 200 % zoom and 320 px width nothing is clipped and no page scrolls sideways |
| P5 | Keyboard open | Where a field exists, the focused field stays visible above the sticky bar (completed by R-10 at 05.03) |
| P6 | Decimal keyboard and paste | Number fields show the decimal keyboard (from 05.03); paste works in the password field |

### 12.2 Screen reader

**NVDA on Windows** with Chrome, and **VoiceOver on the iPhone or TalkBack on the Android** used for P-checks, whichever the real phone is. A person who uses a screen reader regularly is preferred; if none, QA's pass is a basic one and the report says so.

| # | Check | Pass |
|---|-------|------|
| S1 | Page title, `lang`, one `h1`, landmarks (banner, navigation, main), skip link first | Announced as designed; after a route change focus goes to the `h1` |
| S2 | Every control has a name; icon-only buttons and the bell have accessible names; column letters read as "Excel column J" | No "button" with no name |
| S3 | Live regions | Saves, copies and totals are announced politely; blocking errors by `alert` |
| S4 | Navigation by landmarks, headings and tabs | Reaches every screen of the role's menu |
| S5 | Nothing is conveyed by colour alone | Status, overdue and errors have an icon and words that are read |

### 12.3 Windows high contrast

Windows contrast themes (Aquatic, Desert, Dusk, Night sky) in Edge or Chrome on Windows 11, plus, as an automated aid only, Playwright with `forcedColors: 'active'`. The manual check is the evidence.

| # | Check | Pass |
|---|-------|------|
| H1 | Focus ring | Visible on every control (a box-shadow ring is dropped in forced colours; an outline survives) |
| H2 | Borders and boundaries | Buttons, inputs, cards and the error border are visible; errors still show icon and text |
| H3 | Logo and icons | The logo image is present and unaltered; icons are visible against the theme colours |
| H4 | Status and selection | Selected tab, current page, disabled state and the cleared-total state are distinguishable without brand colours |
| H5 | No content lost | Nothing disappears because it was a background image or colour |

**Evidence** is a checklist table per check with pass or fail, the device and software versions, and screenshots that contain only invented data, stored in `docs/07-qa/<story-id>-evidence/` (the folder name every report since AQP-123 uses) and linked from the test report. A failure is a defect: Sev-2 where it blocks a task, otherwise Sev-3.

---

## 13. The Usability Test (CR-20, DL-026; tasks 1, 4, 7)

### 13.1 Decision, timing and status

Decided in PRD 12.2 (CR-20) and DL-026: a facilitated test of the `ux-spec.md` section 10 tasks, **on built pages, during Accucut's testing and acceptance after the hand-over**. It is **not a gate before hand-over and is not in the dates**; the price-reading risks are covered before hand-over by the scripted checks of figures and wording in sections 9 and 10. The participants are the delivery lead's: 2 Engineers, 2 Leads and 1 Admin, no specific names (AQP-1 10556). Whether a person reads a price correctly, and types the right count (ARCH-R6), stays unverified until this test (RISK-015).

**Who sits with the testers (AQP-1 10574, QA-OQ-03 answered):** the delivery lead. They are the facilitator. QA does not attend and works from the filled-in observation form. Because the facilitator is the sponsor, who set the rules and employs the participants, two limits are stated rather than assumed away: participants may defer to them or rate ease higher than they feel, and a facilitator who knows the right answer may hint without meaning to. So the ease ratings are read with care, and the scoring rule in 13.3 (any hint makes the attempt *assisted*) is the check on the second.

### 13.2 Who and what

| Participant | Tasks | Risks tested |
|-------------|-------|--------------|
| P-E1, P-E2 (Engineers) | **Task 1**: enter a part with 25 inputs from a printed sheet (`usabilitySheet`); then a third part, a frame with 6 pipes and 4 lids on each pipe | R-1 (guided form against the worksheet), R-4 (keyboard), R-14 (types 24, the count for the whole order, not 4) |
| P-L1, P-L2 (Leads) | **Task 4**: read an estimate and explain three things (below); approve at a different price with and without a reason. **Task 7**: change an input on a calculated estimate and try to approve, then try to download | R-2, R-8, R-11, R-12, R-13 |
| P-A1 (Admin) | The new task of PRD 12.2: find and read the Last backup line (FR-105) and say what "Backup late" means and what to do. **Task 6** (insert a field and say which letters change; try to delete a used field) is in PRD 12.2 but not in the brief for this plan, and is Release 2 (QA-OQ-02) | The backup line (FR-105); R-9 and R-11 only if task 6 is included |

No names, e-mail addresses or roles beyond the labels are recorded. Notes use P-E1 to P-A1. The test runs on a staging build loaded with invented data, never on an environment that holds the Admin's real masters.

**Task 4, restated from the fixture** (the ux-spec text needs aligning, section 18.3). On `usabilityEstimates` the Lead is asked to: (a) explain why a parent shows one figure on screen and the same single figure in the file (CE-4: the parent shows its own cost only); (b) explain why a lid row with a count of 24 adds 24 times its per-piece cost to the total with nothing multiplied (CE-1); (c) approve at a price different from the calculated total, once with a reason and once without, and find where the override and the reason are recorded. Success: all three explained correctly without help. **Task 7:** the Lead changes one input on a calculated estimate, tries Approve, then tries Download. Success: says why both are off and what to press, and does not read the cleared figures as an error or as lost work.

### 13.3 Procedure

1. **Readiness check (QA, before any session).** The scripted wording and state checks pass on the build: the Warn dialog, the cleared state with "Recalculate", the notices, the refused download message, the quantity hint. The three fixtures load. A pilot run with one person who is not a participant tests the script, the sheets and the timing, and is thrown away.
2. **Sessions.** One at a time, think aloud, about 45 minutes for an Engineer or Lead and 30 for the Admin, about one working day in all (PRD estimate). The delivery lead, as facilitator, reads the task cards aloud word for word, answers no question about the portal ("what would you do?" is the only reply), and records on QA's form every hint, pause of more than a minute, wrong click and remark. Anything they say that points to the answer, including a nod or "are you sure?", is written down and makes the attempt *assisted*. If they name a separate note-taker, that person records and they only facilitate; QA does not assume one. No video or audio is kept in the repository; if sessions are recorded at all it is with the person's agreement, stored outside the repository and deleted after the notes are made.
3. **Scoring per attempt.** *Success*: finished without help. *Assisted*: finished after a hint (counts as not a success). *Failed*: not finished. *Critical error*: a wrong price outcome the participant did not notice, such as 4 typed for the lids and Calculate pressed, or a Lead approving after misreading a figure. Time is taken for task 1. Each task ends with one ease rating from 1 to 5.
4. **Excel baseline for R-1.** One Engineer enters the part in the portal first and then in Excel, the other the reverse, so neither order is favoured. This is a rough comparison from two people, and is reported as such.
5. **Analysis (QA).** Findings with the task, what happened, what the participant said, and a proposed severity.

### 13.4 Targets and how to read them

Targets are the ux-spec's: task success at least 90 percent without help; no critical error on task 4 (and, because it changes a price, none on task 1's third part); mean ease at least 4 of 5; task 1 median under 4 minutes for a typical part, to be calibrated against the Excel baseline.

**With five people the percentages cannot be read as percentages.** Task 1 has 2 attempts, task 4 has 2, task 7 has 2, and the Admin's task has 1: 7 attempts. A single failed or assisted attempt is 6 of 7, or 86 percent, which is under 90 percent. So in practice the target means **no failed or assisted attempt without a logged cause**, and any critical error is a finding whatever the count. The report states attempts as counts and does not claim a percentage. The product-manager and ux-expert may restate the target for this sample size; QA does not.

### 13.5 Output and routing

`docs/07-qa/usability-test-report.md` (written after the sessions) with attempts by task, times, ratings, findings and the anonymised notes. Each finding is a defect record with the type Product and a proposed severity (a wrong-count critical error is Sev-1 in effect). The master routes findings: the delivery lead decides what is fixed before go-live. Nothing in this section can reopen a closed story by itself.

---

## 14. The Restore Rehearsal (NFR-013, FR-091, architecture 9.5 and 16.14)

### 14.1 What it proves and what it does not

There are **two runs, and only the second meets the requirement** (DL-035).

| Run | Who runs it | When | What it shows |
|-----|-------------|------|---------------|
| **A. Validation** | The delivery lead, as both Admin and IT (10573: "I will do the validations before giving it to the actual admin") | Before go-live, once 10.04, 10.05, 10.11 and 02.09 are Done | That the README steps, `restore.sh`, the failure paths and the post-checks work. **It does not show that the actual Admin can follow the README alone, and it does not satisfy FR-091 or NFR-013 for hand-over.** The runner knows the system and wrote or approved the rules |
| **B. Hand-over** | **The actual Admin**, from the README alone | At hand-over, before go-live | That **the Admin, from the README alone, on a healthy staging server, can restore a weekly copy using the key they hold**, in the time the requirement gives (RTO at most 4 hours), with the IT person on hand and not helping unless the command stops. This is the rehearsal FR-091 and NFR-013 name |

The G8 record states which run was done. If only A was done, it says so, and NFR-013's "the Admin can restore" stays a claim.

Neither run proves anything about the loss of the server or its disk, which loses the live data and every backup together (their decision, they were told). Neither rehearses a hand-over of the key, only that the Admin can produce it.

### 14.2 People and conditions

| Role | Run A (validation) | Run B (hand-over) |
|------|--------------------|-------------------|
| Runner | The delivery lead, as Admin. Follows the README | **The actual Admin**, the person who will do it for real. Not yet named; the delivery lead names them at hand-over (QA-OQ-05). Follows the README alone |
| IT person | The delivery lead again (10573). They set up staging and the Admin's account. With one person in both roles there is no one to sit silent, so the "helps only when stopped" rule is not applied | The person who grants the Admin's server access (A-35): Accucut IT, or the delivery lead acting as IT if they say so. Sets up staging and the account; **sits by and says nothing, and helps only after `restore.sh` has stopped and printed its stop message** ("Call your IT person") |
| Observer | **None independent.** The delivery lead cannot be runner, IT and observer. Times come from the host log line `restore.sh` writes and from the delivery lead's own notes on QA's form. Hesitations they notice are logged as README defects | A person the delivery lead names, who is **not** the IT person (one person cannot both help and judge whether help was needed). If the delivery lead is again the IT person, the observer is someone else. QA supplies the form. Times each step, notes every hesitation, reads nothing aloud |
| QA | Sets the preconditions, runs the failure drills (14.4), checks the result (14.6), records | The same |

**Preconditions (QA checks before the Admin sits down).**
1. Staging runs the release candidate image, on the same Compose file as production, with invented data, and `/api/health` passes.
2. The Admin's own account exists on the staging host as A-35 proposes: key-only SSH, not in the `docker` group, `sudo` allowing `scripts/restore.sh` and nothing else. QA verifies: `sudo -l` shows only that script; the account cannot read `.env`; `docker ps` is refused. If Accucut IT gives full access instead, this is recorded and ARCH-R8 applies in full; the rehearsal runs the same.
3. A **throwaway staging key pair** (never the production key) is generated by the IT person; the private key is given to the Admin, who stores it where they would store the real one, apart from the server. The Admin produces it from there during the session.
4. At least three weekly copies exist from `scripts/backup.sh` on staging, with manifests, the newest one at least a day old.
5. After the newest copy, the `rehearsalMarkers` are created (an invented user, customer and estimate). They must be gone after the restore.
6. An approved estimate exists in the newest copy, with its approved price and an export file saved before the session, so the restore can be compared.
7. Free space on the staging disk is above 20 %.
8. The README at the release-candidate tag, the only document the Admin gets.

**The scenario card the Admin receives:** "On the staging portal someone entered wrong data this week. Restore the portal to the newest weekly copy. You have the key from where you keep it. Use only the README. If the command stops, say so." Nothing else is said.

### 14.3 The session

The observer starts a stopwatch when the Admin opens the README, and records the clock time of each step: T0 opens the README, T1 connected to the server, T2 starts `restore.sh`, T3 sees the list of copies and chooses the newest, T4 pre-checks pass, T5 pastes the key, T6 reads what will be lost and types the date, T7 restore ends, T8 `/api/health` passes and the Admin signs in. The observer also records every pause of more than a minute, every re-read of the README, every wrong command and every question asked.

**What counts as stopped (Run B).** The IT person may help only after the script exits with its stop message. If the Admin is stuck at a README step for more than **15 minutes** without making progress (accepted at DL-035, QA-OQ-06: a label, not a pass mark, and well inside the 4-hour RTO), the observer notes the step, a hint is given, and the rehearsal is marked **assisted**: this is a README defect and the rehearsal is repeated after the fix. A second attempt by the same person is a weaker test, because they have now read it; the report says so.

**Run A.** There is no observer to apply the 15-minute limit, so no run is marked assisted. The delivery lead notes any step where they stopped, re-read or guessed, and each becomes a README defect. Run A cannot be marked a pass for hand-over; it is marked "validation passed" or "validation failed".

### 14.4 Scripted failure paths (QA with the IT person, on staging, before the Admin's session; at 10.11's G7, where the delivery lead is the IT person)

These are the A-35 tests of the strategy (section 9). Each stops with a plain message and leaves the portal running on the old database.

| # | Drill | Expected |
|---|-------|----------|
| D1 | A copy altered after it was written (SHA-256 mismatch) | Stops at the pre-check, names the problem, changes nothing |
| D2 | A manifest naming a newer PostgreSQL than the host | Stops at the pre-check |
| D3 | Too little free space | Stops at the pre-check |
| D4 | A wrong key pasted | Stops with a plain message; no partial database; the key is not written to disk |
| D5 | A typed date that does not match | Refuses to continue |
| D6 | A restore that fails half way (a copy built to fail on load) | The old database comes back, the portal restarts and `/api/health` passes, a plain message and "Call your IT person" |
| D7 | The Admin's limited account | Can run `restore.sh`; cannot read `.env` or use Docker |

After the main run, the Admin does one drill (D1 or D4) and says aloud what the message tells them to do. This tests whether the plain message is understood by the person it is for.

### 14.5 Pass criteria

**Run B (hand-over).** All of: (1) the actual Admin completes the restore **unassisted**; (2) every post-check in 14.6 passes; (3) the total time is recorded and is at most 4 hours (it is expected to be far less; the number is the finding); (4) every README fault found is logged as a defect: Sev-2 if it caused an assist or a wrong command, Sev-3 for unclear wording; (5) D1 to D7 pass. Otherwise the rehearsal fails, the README or script is fixed and it is run again.

**Run A (validation).** Items (2), (3), (4) and (5) apply. Item (1) is not required and not claimed. A pass means the steps work; the report heading says "validation", and the G8 record does not count it as the rehearsal FR-091 and NFR-013 name.

### 14.6 Post-checks (QA, with the IT person)

| # | Check | Pass |
|---|-------|------|
| V1 | `/api/health`, sign-in as the Admin and as a Lead | Works |
| V2 | The `rehearsalMarkers` | Gone |
| V3 | The approved estimate and its price, and a fresh export compared with the saved one | Identical to the copy (NFR-026 style), images present |
| V4 | Audit rows after the copy | Gone, as the restore screen said they would be; the host log line, outside the database, exists with date and result |
| V5 | The private key and the decrypted dump are on no disk | Search the host (temporary directories, the Admin's home, the restore working directory, shell history, process arguments) for the key marker text and for dump files; none. A key pasted into the shell instead of the prompt would show in history |
| V6 | A safety copy of the pre-restore database exists as an ordinary copy | Present |
| V7 | The Admin's account after the run | Still limited |
| V8 | The Last backup line on Settings | Observe and record. A restore rolls `job_runs` back with the data, so the line may show an older time, or "Backup late", though a good copy was just used. If so, tell the solution-architect; it is a design question, not a finding against the Admin |

### 14.7 Evidence and timing

The log (the form, filled-in checks, times, defects) is `docs/07-qa/restore-rehearsal-<date>-validation.md` for Run A and `docs/07-qa/restore-rehearsal-<date>-handover.md` for Run B; neither holds a key, a secret or real data. Run A happens after 10.04, 10.05, 10.11 and 02.09 are Done and after the Admin's account exists on staging (A-35); Run B at hand-over, once the actual Admin is named and has their key, and before go-live. Both are human steps, outside the hours and the dates (release plan 3.1), and G8 evidence. The disk is 40 GB by the delivery lead's decision (10576); the free-space and "Disk nearly full" checks run at that size. Recommended, not required: once a year with the oldest retained copy, because a two-year retention is worth only what can still be read.

---

## 15. Other Non-Functional Verification: When Each Is Checked

Methods and targets are the strategy's (sections 8 and 9). This table says when.

| NFR | Check | Per PR | Story G7 | Nightly | Pre-release (G8) |
|-----|-------|:------:|:--------:|:-------:|:----------------:|
| 001, 002 | Role matrix, canary scan | Yes | Yes | Yes | Yes |
| 003 | CSRF, cookies, lock-out, password, session | Yes | 01.01, 01.05, 01.06 | | Cookies over TLS on staging |
| 004 | Step-up, one test per action (2 of 2 in R1, 6 of 6 with R2) | Yes | 06.12, 06.13, 08.x, 01.09 | | |
| 005 | Uploads | Yes | 05.07 | | |
| 006 | Gitleaks, data-file check, placeholder pattern | Yes | Every story | | Full history |
| 007 | One test per audit event; direct UPDATE and DELETE refused | Yes | 01.07, each event story | | |
| 008 | `tree500`, 20 runs, p95 under 2 s | | 03.06 | Yes | Yes |
| 009 | Lighthouse mobile, five screens; office Wi-Fi profile decides, Slow 4G nightly is report-only | | 10.10 | Yes | Yes |
| 010, 011 | k6 at 25 and 50 users; export 50 nodes with 50 images | | | | Yes, on staging |
| 012 | External uptime check | | | | Yes, once Q-18 answers; monthly after |
| 013 | Retention, missed-run alert, free space, restore | Yes | 10.05, 10.11 | | **Rehearsal (section 14)** |
| 014 | Controlled-clock mail tests | Yes | 09.x | | **One real send** |
| 015 | IST and UTC: 23:30 IST, 03:00 IST, year boundary | Yes | 04.01, 04.03, 09.05 | | |
| 016, 017 | Five sizes, both orientations; 44 px | Yes | Every UI story | Yes | Yes |
| 018 | axe WCAG 2.2 AA, keyboard run, the five added criteria by hand | Yes | Every UI story | Yes | Manual on changed screens; section 12 |
| 019 | Chromium every PR; three browsers nightly; one real phone | | | Yes | One real phone |
| 020, 021 | Raw-colour search, logo hash, contrast, rupee glyph | Yes | 10.02 | | |
| 022 | Tag check on every route | Yes | 10.03 | | |
| 024 | Injected fault logged | | 10.09 | | |
| 025 | Coverage, lint, type-check | Yes | Every story | | |
| 026 | Approve, change masters, compare | Yes | 06.09 | | |
| 027 | Export read-back | Yes | 07.x | | **Manual open in Excel desktop** |
| 030 | Clean-VM README walk-through, 30 minutes | | 10.04 | | Repeat if the README changed |
| 023, 028, 029 | Inspection, repository scan, English only | | 10.06, 10.12 | | |

---

## 16. Exploratory Charters

One session per charter at the G7 of the first story that matches it, time-boxed to 60 minutes (90 for C1 and C4), and repeated at release on changed areas. The report records mission, areas, what was tried, findings and anything not covered.

| # | Mission | Areas and ideas (error guessing) | Matches |
|---|---------|----------------------------------|---------|
| C1 | Find a way for an Engineer to learn a cost | Transformed values (section 11.2); error pages, the 404 and 500 pages, redirects, `_next/data` and RSC responses, source maps, print view, copied text, browser history and cache after sign-out, the Warn dialog and its 409, e-mail bodies, response size or timing that differs when an estimate has costs, an Engineer using a Lead's bookmarked URL | 01.03 and every Engineer story |
| C2 | Break the quantity rule in the people's hands | Typing the per-assembly count instead of the whole-order count; 0, 0.5, 0.01, 1000, 99999, pasting a number with a comma or a rupee sign; changing a parent's count after the children were typed; moving a node; two top-level items | 03.04, 05.03, 05.12 |
| C3 | Break the cleared-totals rule | Two tabs (Engineer and Lead) editing the same estimate; change and change back; autosave racing a Recalculate; browser back after Calculate; Approve pressed during an edit; slow network; a double click on Recalculate | 06.04, 06.05 |
| C4 | Break the approval sequence | Approve, unlock, edit, recalculate, cancel, remove, approve, in every order and from stale tabs; the Lead and the Admin acting at once; a wrong password three times; the audit rows afterwards; the earlier price label | 06.06 to 06.13 |
| C5 | Break the export | Customer and part names with `=`, `+`, `@`, quotes, accents, very long text, emoji; a 500-node estimate; images of 1 pixel and 204,799 bytes; a part with no picture; a node deleted between summary and download | 07.01 to 07.04 |
| C6 | Break the tree | Depth 10; 500 nodes; rapid add and delete; moving a node under itself; reordering at the top and bottom; "1.10" and "1.2" order; deleting a parent with children | 05.02 |
| C7 | Time | A deadline at 23:59 IST and 00:00 IST; 03:00 IST (previous date in UTC); the year boundary for task IDs; the server clock behind or ahead; overdue exactly at the deadline | 04.01, 04.03, 09.x |
| C8 | Masters | Rates with 3 decimals, 0, negative, 1e9, text; a very long customer name; duplicate names in different case and with trailing spaces; deleting a used item from two tabs | 02.x |
| C9 | Sessions and lost work | The 12-hour session ending while an Engineer is mid-part: is the draft kept? Sign-out in one tab while another is open; browser back after sign-out; two devices at once; the unsaved-changes warning when the session has ended | 01.06, 05.08 |
| C10 | The phone | Rotation mid-entry; the keyboard open; paste; camera; the drawer on a small screen; the bell; a slow network | 05.03, 05.07 |
| C11 | Restore and backup | Run `backup.sh` twice in a minute; a copy name with odd characters; a restore while a user is signed in; what the Admin sees after | 10.05, 10.11 |

---

## 17. Commands

Direct commands, not `npm run`, because a global rule prompts on `npm run` (`npm test` is fine). Run from the repository root in Git Bash. **Checked 2026-11-21 against `package.json` (scripts `lint`, `typecheck`, `test`, `test:coverage`, `test:perf`, `test:e2e`, `build`, `check:data-files`, `check:licences`) and the CI stage names of run 44924430846 (stages 1 to 13).** Heavy browser suites run in CI, not on the QA machine (CLAUDE.md section 9 item 5): QA reads the CI logs (`gh run view <id> --log`, `gh api repos/<owner>/<repo>/actions/jobs/<id>/logs`) and does not re-run a workflow. Each report records the exact output and the run ID. The CI uses `package.json` scripts; the commands below must stay equal to them.

| Purpose | Command | Notes |
|---------|---------|-------|
| Install | `npm ci` | Lockfile only |
| Lint | `npx eslint .` | Includes the import-boundary rules (cost repositories, no `eval`, no Server Actions) |
| Type-check | `npx tsc --noEmit` | |
| Generate and build | `npx prisma generate && npx next build` | |
| All Vitest tests | `npx vitest run` or `npm test` | Unit, integration, contract, security, acceptance written so far |
| One level | `npx vitest run tests/unit` (also `tests/integration`, `tests/security`, `tests/acceptance`) | |
| One file | `npx vitest run tests/acceptance/<file>` | |
| Quantity cases only | `npx vitest run tests/unit/quantity` | Plus the integration quantity tests |
| Coverage | `npx vitest run --coverage` | Needs the coverage provider 10.01 installs; thresholds from the strategy (section 11) |
| All E2E, all widths | `npx playwright test` | Browsers installed once with `npx playwright install` |
| One width | `npx playwright test --project=<name>` | Project names per QA-A2 |
| Accessibility | `npx playwright test tests/e2e/a11y` | |
| Canary suite | `npx playwright test <canary spec>` | Path fixed by 01.03 |
| Report | `npx playwright show-report` | |
| Migrations on an empty database | `npx prisma migrate deploy` | Only against the local or CI test database; the guard of 4.1 must refuse any other |
| Dependency audit | `npm audit --omit=dev --audit-level=high` | High or above blocks |
| Secret scan | Gitleaks over the full history | Invocation set by 10.01 |
| Load and page timing | k6; Lighthouse CI | Invocation set by 10.09, 10.10 and 07.05; staging only |
| Export timing (NFR-010 AC-1, AC-2) | `npx vitest run --config vitest.perf.config.ts` (`npm run test:perf`) | On demand, not in CI; the target host or rehearsal machine for G8-C-NFR10 (b) |
| First-load JavaScript budget (NFR-009) | `npx tsx scripts/check-js-budget.ts` after a build, against a seeded database | CI stage 11b; every route at most 200 KB gzip |
| Data-file and licence checks | `npx tsx scripts/check-data-files.ts`; `npx tsx scripts/check-licences.ts` | CI stages 3 and 8 |

**Order of a G7 run:** `npm ci`; `npx eslint .`; `npx tsc --noEmit`; `npx prisma generate && npx next build`; `npx prisma migrate deploy` on the empty test database; `npx vitest run` (all, with coverage); `npx playwright test`; then the story's own acceptance file by name, the canary suite if section 11.1 applies, and the manual checks the story's row names.

---

## 18. Open Questions, Issues for Other Roles and Dependencies

### 18.1 Open questions

| ID | Question | Owner | Needed by | Assumption until answered |
|----|----------|-------|-----------|---------------------------|
| QA-OQ-01 | **Closed.** DL-017 puts the device and assistive-technology checks at the G7 of "the first UI story" and CR-20 names 10.02, but at that G7 only the shell exists | master | | Accepted at DL-035: met at 10.02's G7 for the shell only, finished by the carry-forward checks of section 12; G8 lists any not run |
| QA-OQ-02 | The brief names tasks 1, 4 and 7. PRD 12.2 also gives the Admin task 6 (Release 2, in scope A's single hand-over) and the Last backup line. Does the Admin take task 6? | product-manager | Before the sessions | The Admin takes the backup-line task; task 6 only if the product-manager says so |
| QA-OQ-03 | **Answered (10574).** Who sits with the testers at the usability test? | delivery lead | | "I sit with the testers": the delivery lead facilitates, QA does not attend (13.1, 13.3). For the rehearsal, Run A has no independent observer (14.2); Run B's observer is a person they name, not the IT person |
| QA-OQ-04 | **Answered (10573).** Devices | delivery lead | | "A real phone, a Windows PC with a screen reader and excel desktop." One phone offered: reports name the platform used, and the other is listed at G8 as not run. The screen reader on the PC is not named; NVDA is assumed |
| QA-OQ-05 | **Answered for validation (10573, DL-035):** "Both Admin and IT will be me. I will do the validations before giving it to the actual admin." **Still open for Run B:** who the actual Admin is, and who is the IT person and the observer at hand-over | delivery lead | Hand-over | Run B waits for the actual Admin to be named |
| QA-OQ-06 | **Closed.** Is 15 minutes stuck at one README step the right limit? | master | | Accepted at DL-035 for Run B. Not applied to Run A, which has no observer |
| QA-OQ-07 | **Answered (10573).** The picture limit | delivery lead | | "It is 204,800 bytes." Business-analyst applies it to SPEC and NFR-005 |
| QA-OQ-08 | Is a file of exactly 204,800 bytes accepted or refused? 10573 notes it is unanswered | delivery lead; product-owner | 05.07 Ready | Refused ("under"); one expected value flips if they say accepted |

### 18.2 Dependencies that hold QA work

OQ-ARCH-11 (mail account) holds the real send; A-35 (the Admin's account) holds Run A of the rehearsal, and the naming of the actual Admin holds Run B; the disk stays at 40 GB by the delivery lead's decision (10576), so 10.05's retention and free-space tests run at that size, and who clears old copies is open (the master's G4 condition); Q-18 holds the uptime check; No CE case waits on Q-35, Q-38 or Q-39: SPEC 18.5 and test-strategy 5.6 treat the rule as settled, and `backlog.md` v0.2 holds no story. The `ux-expert` stop (BLK-03) holds G4 but not this plan.

### 18.3 Issues for other roles

| To | Issue |
|----|-------|
| solution-architect | (1) `test-strategy.md` section 12 maps SPEC section 14 items 1 to 14 and section 11's target says "14 of 14"; SPEC now has 17. Items 15 (download refused), 16 (Admin-only cancel and remove) and 17 (rate notice) need rows and the target should read 17 of 17. (2) Section 10 names `npm run lint`, `npm run typecheck`, `npm run build` and `npm run test:e2e`; CI is unaffected, but local runs use the direct forms, so the scripts must wrap those commands exactly. (3) Where the canary suite lives (`tests/security/` or `tests/e2e/`) is not fixed. (4) The Last backup line after a restore (check V8 in section 14.6) |
| ux-expert | `ux-spec.md` section 10 task 4 (line 919) still asks the Lead to explain a parent's summed figure and a rounding difference of 0.01 between a sum shown and a sum of parts. Under D-25 and FR-029 a parent shows only its own row, so that wording appears stale. Its figures also carry two-decimal rupee amounts that this plan did not use and could not verify as invented (section 0.7 repeats such figures). Please align task 4 to CE-1 and CE-4 and confirm the figures on the screens are not workbook values (the figure check in `check-figures.cjs` is against the data model, not against the workbook) |
| product-owner | Testability review of every story's ACs at Ready (section 2); QA-OQ-08 (exactly 204,800 bytes) |
| business-analyst | Apply the 204,800-byte picture limit (10573) to SPEC and NFR-005 wording, so the AC for 05.07 can cite a number |
| product-manager | QA-OQ-02; the usability target of 90 percent cannot be read with 7 attempts (section 13.4) |
| scrum-master | Story 10.02's G7 evidence list is section 12; 05.03's includes R-10 on a real phone; 10.11's G7 is the scripted drills, not the Admin's rehearsal |
| developer | The database guard (4.1); the canary negative control; `quantity-cases-complete` with a planted-`it.todo` negative control; the test-name convention of section 2 |
| master | QA-OQ-01 and QA-OQ-06 are accepted (DL-035) and closed here; condition 15 is answered by this plan, for the G4 check. The G8 record must state which rehearsal run was done and list the device checks not run. `docs/project-state.md` (open questions table) still says Q-39 is open and "03.04 cannot pass G7 without it"; SPEC 18.5 and test-strategy 5.6 say the rule is settled and nothing is held. Please reconcile |

### 18.4 Risks raised

No new register entry is proposed. Two restate existing ones from the testing side: **RISK-015** (people misreading prices or typing the wrong count) stays unverified until section 13, which is after hand-over; and the rehearsal (section 14) is the only evidence that the Admin can restore, so until it passes, NFR-013's recovery target is a claim, not a result.

---

## 19. Change Log

| Version | Date | Change |
|---------|------|--------|
| 0.3.9 | 2026-11-22 | DEF-059 and DEF-063 closed with their proofs (P1, P2); the trigger (b) ledger and the O5 table extended to `master` pushes 45022375651 and 45025620716. Section 7.1 defect table: DEF-059 and DEF-063 closed. |
| 0.3.8 | 2026-11-22 | DEF-062 closed with its proofs (P1, P2, P3); `approve.spec.ts:101` [desktop] added to the watch list; the trigger (b) ledger and the O5 table extended to `master` push 45020428761. Section 7.1 defect table: DEF-062 closed. |
| 0.3.7 | 2026-11-22 | DL-296 process rule: the trigger (b) daily ledger for 22 Nov (every `master` push run, 2 of 2 before the restart, 0 of 2 after) and the first O5 observer lines (`master` push 45016574514, all three widths, passed). |
| 0.3.6 | 2026-11-22 | The :224 rate count (narrow route) and its result in section 7 (the sixth DEF-057 occurrence, `master` push 44941416105); DEF-061 closed with its proofs (P1, P2). Section 7.1 defect table: DEF-061 closed. |
| 0.3.5 | 2026-11-22 | PR runs read at the orchestrator's request. Section 7 dated note: DEF-062 (`estimate-calculate.spec.ts` :143, :202, :238 [tablet]) and DEF-063 (`estimate-fasteners.spec.ts` :93, :104, :127 [desktop], shard 4 start) logged; DEF-061 seen at desktop on PR #604 run 45011363827. Section 7.1 defect table: DEF-062 and DEF-063 rows. |
| 0.3.4 | 2026-11-22 | DL-295 and the closure reads. Section 7 dated note: DEF-057 fifth occurrence (PR #612 run 45008203701) and its route; the open q2 (rate count) and q3 (O5 lines) tasks; DEF-058 and DEF-060 closed with their proofs; QA's read of RISK-031's close-out conditions. Section 7.1 defect table: DEF-058 and DEF-060 closed, DEF-057 route. |
| 0.3.3 | 2026-11-22 | DL-294. Section 7 dated note: DEF-057 re-graded Sev-2 with the diagnostic readings and the correction to the 44985240147 entry; `process-propagation.spec.ts:109` [tablet] added to the near-budget watch list with its readings and trigger; DEF-061 re-typed Product (layout). Section 7.1 defect table: DEF-057 and DEF-061 rows updated. |
| 0.3.2 | 2026-11-22 | DL-291 and DL-293. Section 7 dated note: master push runs 44992801362 and 44995772811 read (trigger (b) 2 of 2, RISK-031 reopened at 9); DEF-060 (load-plan AC-4, Stage 6, merge freeze) and DEF-061 (`estimate-form.spec.ts:74` [tablet]) logged; `estimate-calculate.spec.ts:238` [tablet] added to the near-budget watch list with its trigger. Section 7.1 defect table: DEF-059 re-typed Product (layout), probable; DEF-060 and DEF-061 rows added. |
| 0.3.1 | 2026-11-22 | DL-290 and DL-285 (3). Section 7: a dated 2026-11-22 note (DEF-058 for `estimate-form-sections.spec.ts` :331 and :431 [tablet] with rule R11; the DEF-057 occurrence at `rates-changed.spec.ts:224` on `master` push 44985240147; DEF-059 for `estimate-first-load.spec.ts:64` [desktop]; `master` push 44988681963 read, 0 flaky; RISK-031 trigger (b) count for 22 Nov stays 1 of 2). Section 7.1 E and F: DEF-058 and DEF-059 added; the :431 watch entry in F replaced by the Bug. No other section is changed. |
| 0.3 | 2026-11-21 | Hardening window, before G8 (CLAUDE.md section 9 item 3; DL-275 (C), DL-276, DL-277 to DL-284). (1) New section 7.1: the scope of the final regression (what CI must show, the hardening merges and what each adds, the 10.08 and 10.09 coverage, G8-C-AC8, G8-C-NFR9, G8-C-NFR10, the 09.08 real send and DEF-055 count, defects and their G8 handling, the watch items, the human and live steps, the order and the freeze). (2) Section 7: the `master` push run 44924430846 (`c0cf1d21`) reading and the new `customers.spec.ts:262` watch item. (3) Section 17: commands read from `package.json` and the CI stages; three rows added. (4) Header: version, date and status brought up to date (it still said "nothing is built"). Section 5 and the per-story exit lists are unchanged; during the fast track the per-story gate is the green CI (CLAUDE.md section 9 item 1) and the exit lists apply to the final regression as a whole. |
| 0.2.4 | 2026-11-11 | AQP-130 G7 (02.05 Treatment / Color list), run through CI because browsers do not run on the QA machine (DL-142 (5)): (1) QA browser probes that cannot be a CI test are run in a throwaway pull request that adds the probe to the story code, and the probe source is kept as `.txt` in `docs/07-qa/<story>-evidence/` (as in 0.2.3, but run in CI instead of locally); (2) QA plants must pass `eslint .` and `tsc --noEmit`, so the tests and not stage 4 or 5 catch them (an audit write is skipped with `if (Date.now() < 0) ...`, not deleted, which would leave an unused variable); (3) a QA acceptance file lands in `tests/acceptance/` and adds its tests to the Vitest count of stage 11, which the merge invariant of the next ruling must include; (4) the evidence folder is `docs/07-qa/<story>-evidence/` (section 12 aligned, as DL-135 (1) asked). Setup tests insert rows as the database owner, not through the route under test, so a plant in one route does not fail the tests of another (found when the first add plant failed the rename and delete tests). |
| 0.2.3 | 2026-11-10 | AQP-123 G7 (02.04 Exchange Rate Master): the G7 routine for a master whose saves change one shared row now includes (1) a keyboard-only save of a pair other than the canary pair, run by QA locally against a throwaway database with no Engineer scan running and the canary pair restored at the end; it is not a CI test, because it would race the never-quarantined Engineer scan (QLT-02); (2) a check of the focus-keyed effect (`useEffect` on an `errors` object) in every dialog or form with two or more required fields: submit it empty, type three letters in the first refused field and in the second, and look at where each letter lands (this found DEF-024, DEF-025 and DEF-026 in the delivered Add dialogs). Habit: in Playwright, `browser.newContext()` inherits the project's `storageState`, so a test that needs a signed-out or differently signed-in context passes `{ cookies: [], origins: [] }` (a sign-in page opened on an inherited Admin session never shows its form). QA probes that must not run in CI are kept as `.txt` under `docs/07-qa/<story>-evidence/` and run with the local configuration. |
| 0.2.2 | 2026-11-09 | AQP-122 G7 (02.03 Material Master): the 02.03 conditions in section 9.2 were run (report `AQP-122-test-report.md`). Added the QA habit of `test.fail` for an open defect (DEF-020, DEF-021): the test reports as passed while the fault exists and as failed once it is fixed, so the line is removed with the fix. Added two planted-fault families to the G7 routine for a master with an audit entry: a second transaction inside the change, and an entry after the commit. Habit for long lists (more than about 40 rows): scan from the top of the page, because a half-hidden row button under the sticky bar is reported by axe as a target-size fault. |
| 0.2.1 | 2026-11-03 | Privacy and data handling renumbered 10.10 to 10.12; 10.10 is now AQP-169, the NFR-009 guards (JS budget and Lighthouse), per AQP-1 10724 and test strategy v0.13 section 10. NFR-009 moved from the 10.09 row to a new 10.10 row. The NFR-009 pass/fail profile is office Wi-Fi (`rttMs` 40, `throughputKbps` 10240, 4x, median of 5) with Slow 4G nightly and report-only, as PRD NFR-009. The Lighthouse baseline of `/` is at AQP-169's G7, and the G7 of AQP-28 still records a reference run of `/` if possible (AQP-1 10710) |
| 0.2 | 2026-11-02 | G4 remediation 10 (AQP-1 10573, 10574; DL-035). Devices come from the delivery lead (one phone: platform named per report, the other listed at G8); the delivery lead sits with the testers and facilitates the usability test, with the limits of that stated; the restore rehearsal is two runs, A validation (delivery lead as Admin and IT, no independent observer, does not satisfy FR-091 or NFR-013) and B hand-over (the actual Admin, 15-minute limit accepted), and the G8 record states which was done; QA-OQ-01 and QA-OQ-06 closed; QA-OQ-03, 04, 07 answered, QA-OQ-05 answered for Run A only; picture limit 204,800 bytes with the exact-limit file refused as a labelled assumption (new QA-OQ-08) |
| 0.1 | 2026-11-02 | First issue for G4. Acceptance conditions for the 88 candidate stories, the 17 SPEC section 14 items, the CE cases with expected values, the canary scan and its independent pass, the device and assistive-technology checks, the usability test (tasks 1, 4, 7), the Admin's restore rehearsal, regression, commands. Written against PRD v0.10, test-strategy v0.9, SPEC v1.12, architecture v0.9, ux-spec v0.6, backlog v0.2. No code existed; nothing was run |
