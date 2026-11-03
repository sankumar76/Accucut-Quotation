# DEF-003: tests/unit/lint/layer-rules.test.ts first test times out (30 s) when the machine is busy

| Field | Value |
|-------|-------|
| Story / AC | AQP-27 (STORY-10.01) / AC-6 (regression) |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test (load-sensitive timing; test plan section 7 treats a test that fails and then passes as a defect of type Test) |
| Status | New |
| Found by / date | qa-engineer, 2026-11-03 |
| Build / commit | `60eeb67` on `feat/AQP-27-scaffold-ci` |
| Environment | Windows 11, Node v24.19.0, dev database up; machine busy |
| Jira / GitHub | [AQP-168](https://sankumar76.atlassian.net/browse/AQP-168) / [#24](https://github.com/sankumar76/Accucut-Quotation/issues/24) |

## Steps to Reproduce
1. In a second checkout start `npx tsc --noEmit`, `npx eslint .` and `npx next build` together.
2. In the main checkout run `npx vitest run --coverage`.

## Expected Result
All 506 tests pass, as they do on an idle machine (run twice, 23 files, 506 of 506, no retry).

## Actual Result
505 pass, 1 fails: `ESLint layer rules (AC-6) > AC-6: static import fails lint: src/lib imports src/server (alias)` with `Error: Test timed out in 30000ms.` It is the first test of the file, which loads the ESLint configuration (Next.js and TypeScript plugins) inside its own 30 s budget. The file passes alone (67 of 67). Seen twice (once with `npm ci` running in the background, once under the load above); reproduced once on demand.

## Evidence
- Failing run output line: `FAIL tests/unit/lint/layer-rules.test.ts > ESLint layer rules (AC-6) > AC-6: static import fails lint: src/lib imports src/server (alias)`, `Error: Test timed out in 30000ms.`
- `describe('ESLint layer rules (AC-6)', { timeout: 30_000 }, ...)` is the only timeout set in the file; there is no `beforeAll` that warms ESLint.
- CI run 41591216308 on `60eeb67` is green (idle runner).

## Suspected Area
`tests/unit/lint/layer-rules.test.ts`: warm the ESLint instance in a `beforeAll` with its own larger hook timeout (for example 120 s) so the 30 s limit covers linting, not configuration loading. QA's acceptance file gives every lint case 180 s and did not fail in the same load.

## Impact
No product effect. A developer who builds while testing sees a red test that says nothing about the layer rules. It does not hold G7: the suite is green on an idle machine and on CI with no retry.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
