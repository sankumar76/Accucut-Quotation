# DEF-002: tests/unit/ci-workflow.test.ts fails on a Windows clone with default Git line endings

| Field | Value |
|-------|-------|
| Story / AC | AQP-27 (STORY-10.01) / AC-4 (regression) |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Test |
| Status | Closed (verified by qa-engineer on `60eeb67`, 2026-11-03) |
| Found by / date | qa-engineer, 2026-11-03 |
| Build / commit | `5390559` on `feat/AQP-27-scaffold-ci` |
| Environment | Windows 11, Git for Windows with `core.autocrlf=true` (the default), fresh `git clone`, `npm ci` |
| Jira / GitHub | [AQP-167](https://sankumar76.atlassian.net/browse/AQP-167) / [#22](https://github.com/sankumar76/Accucut-Quotation/issues/22) |

## Steps to Reproduce
1. `git clone --branch feat/AQP-27-scaffold-ci <repository> <new folder>`, then `npm ci`.
2. `git ls-files --eol .github/workflows/ci.yml` shows `i/lf w/crlf`.
3. `npx vitest run tests/unit`.

## Expected Result
All unit tests pass, as on CI and in the original working tree (where the files are LF).

## Actual Result
1 of the 366 unit tests fails: `CI workflow > AC-4: the trigger is pull_request, never pull_request_target, and the job keeps its required-check name`. `AssertionError: expected '# CI pipeline: ...' to match /^on:\n {2}pull_request:/m`. The expression expects `\n`; a CRLF checkout has `\r\n`. The other tests that read files (env-example, gitleaks-baseline, data-files, licences) pass on the CRLF clone.

## Evidence
- Fresh clone of `5390559`: 1 failed, 365 passed of the 366 branch tests. Original working tree: all 21 files pass.
- `.gitattributes` holds one rule, `*.sh text eol=lf`; nothing normalises `.yml`, `.ts` or `.json`.

## Suspected Area
`tests/unit/ci-workflow.test.ts` (the `^on:\n` expression). Fix by accepting `\r?\n`, and/or add `* text=auto eol=lf` to `.gitattributes` (existing trees then need `git add --renormalize .`).

## Impact
The delivery lead works on Windows: a fresh clone or a second developer sees a red suite that is not a product fault. CI (Linux) is unaffected, which is why it is green.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-03 | `60eeb67`: `tests/unit/ci-workflow.test.ts` converts `\r\n` to `\n` when it reads the workflow |
| Regression test added | developer | 2026-11-03 | The fix is in the test itself; the failing case is the regression test |
| Verified | qa-engineer | 2026-11-03 | Re-test below |

## Re-test on `60eeb67` (qa-engineer)
Fresh `git -c core.autocrlf=true clone --branch feat/AQP-27-scaffold-ci`, `npm ci`. `git ls-files --eol` shows `i/lf w/crlf` for `.github/workflows/ci.yml` and `tests/unit/ci-workflow.test.ts` (269 files with CRLF in the working tree), the same condition that failed on `5390559`.
- `npx vitest run tests/unit/ci-workflow.test.ts`: 8 of 8 pass.
- `npx vitest run tests/unit`: 19 files, 369 tests, 0 failed.
