# Test Plan: Accucut Quotation Portal (scope A, one hand-over)

| Field | Value |
|-------|-------|
| Owner | qa-engineer |
| Version | 0.2.1 (AQP-169 renumbering applied to sections 4, 8 and 15; 0.2 was G4 remediation 10: AQP-1 comments 10573 and 10574 and DL-035 applied to sections 4, 5, 9, 12, 13, 14 and 18; v0.1 was the first issue, for G4, answering G3 condition 15 and CR-20) |
| Date | 2026-11-02 |
| Status | Draft. Nothing is built, so **no command in this plan has been run** and no test exists. Commands come from `CLAUDE.md`, the brief and `test-strategy.md`, and are not checked against a `package.json` (none exists) |
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

**Regression result in a report** states the command, the count passed, failed and skipped, and the commit. A skipped test is explained or it is a failure. `quantity-cases-complete` (strategy 5.4) must be among the passing tests.

---

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
| 09.08 One real send (R2) | FR-019 verification: one message through the actual mailbox, with the result and headers recorded and no secret in any log. Needs Accucut IT. **The only proof of the mail sign-in**; alerts are not live without it | M | B |

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

**Evidence** is a checklist table per check with pass or fail, the device and software versions, and screenshots that contain only invented data, stored in `docs/07-qa/evidence/<story-id>/` and linked from the test report. A failure is a defect: Sev-2 where it blocks a task, otherwise Sev-3.

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

Direct commands, not `npm run`, because a global rule prompts on `npm run` (`npm test` is fine). Run from the repository root in Git Bash. **None has been run: no `package.json` exists.** Each story's report records the exact output. `package.json` scripts, where the CI uses them, must wrap exactly these commands so the two cannot drift.

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
| 0.2.1 | 2026-11-03 | Privacy and data handling renumbered 10.10 to 10.12; 10.10 is now AQP-169, the NFR-009 guards (JS budget and Lighthouse), per AQP-1 10724 and test strategy v0.13 section 10. NFR-009 moved from the 10.09 row to a new 10.10 row. The NFR-009 pass/fail profile is office Wi-Fi (`rttMs` 40, `throughputKbps` 10240, 4x, median of 5) with Slow 4G nightly and report-only, as PRD NFR-009. The Lighthouse baseline of `/` is at AQP-169's G7, and the G7 of AQP-28 still records a reference run of `/` if possible (AQP-1 10710) |
| 0.2 | 2026-11-02 | G4 remediation 10 (AQP-1 10573, 10574; DL-035). Devices come from the delivery lead (one phone: platform named per report, the other listed at G8); the delivery lead sits with the testers and facilitates the usability test, with the limits of that stated; the restore rehearsal is two runs, A validation (delivery lead as Admin and IT, no independent observer, does not satisfy FR-091 or NFR-013) and B hand-over (the actual Admin, 15-minute limit accepted), and the G8 record states which was done; QA-OQ-01 and QA-OQ-06 closed; QA-OQ-03, 04, 07 answered, QA-OQ-05 answered for Run A only; picture limit 204,800 bytes with the exact-limit file refused as a labelled assumption (new QA-OQ-08) |
| 0.1 | 2026-11-02 | First issue for G4. Acceptance conditions for the 88 candidate stories, the 17 SPEC section 14 items, the CE cases with expected values, the canary scan and its independent pass, the device and assistive-technology checks, the usability test (tasks 1, 4, 7), the Admin's restore rehearsal, regression, commands. Written against PRD v0.10, test-strategy v0.9, SPEC v1.12, architecture v0.9, ux-spec v0.6, backlog v0.2. No code existed; nothing was run |
