# DEF-015: CI stage 12 can stall for minutes in `playwright install --with-deps` (unbounded apt download of the browser's system packages on every run)

| Field | Value |
|-------|-------|
| Story / AC | CI infrastructure; relates to AQP-199 (STORY-10.14, CI feedback time), NFR-025, RISK-023 |
| Jira / GitHub | [AQP-206](https://sankumar76.atlassian.net/browse/AQP-206) / [#88](https://github.com/sankumar76/Accucut-Quotation/issues/88) |
| Severity | Sev-3 Moderate (master, DL-100, AQP-199 comment 10986) |
| Priority | P3 |
| Type | Environment |
| Status | New |
| Found by / date | developer (AQP-199 comment 10985); recorded by qa-engineer, 2026-11-05 |
| Build / commit | Unchanged code; CI run 42061753504, attempt 3 |
| Environment | GitHub-hosted `ubuntu-24.04` runner, required job `Stages 1 to 11`, stage 12 (E2E) |
| Owners | **Fix approach:** solution-architect (pending). **Placement:** product-manager. **Due:** before the end of sprint 1 |

## Steps to Reproduce
1. Re-run the CI job `Stages 1 to 11` on unchanged code.
2. Watch the stage 12 step that runs `npx playwright install --with-deps chromium`.

## Expected Result
Installing the browser's system packages takes a bounded, small share of stage 12, so the time CI takes reflects the tests.

## Actual Result
In run 42061753504, attempt 3:
- Stage 12 spent **about 9.5 minutes** inside `playwright install --with-deps`.
- `apt-get` fetched **20.5 MB at 35.9 kB/s** from the Azure Ubuntu mirror, and single packages stalled for **up to 170 s**.
- The **340 tests** that followed passed in **4.3 minutes**.

## Evidence
The stage 12 log of run 42061753504, attempt 3, as summarised in Jira AQP-199 comment 10985 (developer). The tests were unaffected.

## Suspected Area (optional)
The browser's system packages are downloaded fresh on every run, with no cache and no time bound, in the stage 12 install step of `.github/workflows/ci.yml`. The solution-architect chooses the fix approach.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
