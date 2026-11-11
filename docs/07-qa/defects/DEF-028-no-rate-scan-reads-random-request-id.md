# DEF-028: `aqp-123-exchange-rates.test.ts` "[AQP-123 AC-6] decision table" scans a 403/401 body that holds a random request ID for the digits 838 and 839, so it fails by chance

| Field | Value |
|-------|-------|
| Story / AC | STORY-02.04 (AQP-123) / AC-6 (where the test lives); found in `master` push run 42873078338 |
| Severity | Sev-3 Moderate (test-plan scale, section 7 service levels: no product impact, fixed before G8; fails open-to-red at random and never hides a leak) |
| Priority | P3 |
| Type | Test (a "no rate in this body" scan that also reads a random member of the body) |
| Status | Fixed (PR #216 open, verified; closes on merge, DL-133 route) |
| Jira / GitHub | [AQP-273](https://sankumar76.atlassian.net/browse/AQP-273) / [#215](https://github.com/sankumar76/Accucut-Quotation/issues/215), relates to AQP-123 |
| Found by / date | orchestrator (brief on AQP-123, comment 11429) from the failed run; logged by qa-engineer, 2026-11-10 |
| Build / commit | `master` at `aeefb58`, run 42873078338, job 130029124218 ("Stages 1 to 11b"). The runs before and after are green. The test file is QA's acceptance file from AQP-123's G7 (DL-135) |
| Environment | GitHub Actions `ubuntu-latest`, Vitest acceptance level over a throwaway PostgreSQL 17 |

## Steps to Reproduce
1. Open job 130029124218 of run 42873078338 and find `FAIL tests/acceptance/aqp-123-exchange-rates.test.ts > AQP-123 AC-6 ... > [AQP-123 AC-6] decision table: Lead 403, Engineer 403, signed out 401, ...` (17 ms).
2. The body received was `{"type":"about:blank","title":"You do not have access to this.","status":403,"code":"FORBIDDEN","requestId":"req-0839e75b"}`. The pattern at line 400, `/838|839|1\.23|4\.56|inr|usd|eur/i`, matches "839" inside "0839e75b".
3. Forced reproduction, no seam needed (`problemResponse` and `forbiddenProblem` take the ID as an argument): `await problemResponse(forbiddenProblem('req-0839e75b')).text()` and `expect(text).not.toMatch(<the line-400 pattern>)`. Run locally at `1d37902` (Vitest, a temporary file that was not committed): `AssertionError: expected '{"type":"about:blank",...,"requestId":"req-0839e75b"}' not to match /838|839|1\.23|4\.56|inr|usd|eur/i`.

## Expected Result
The test passes whatever request ID the server makes. The scan looks for the rates, not for digits of a random ID.

## Actual Result
`src/server/http/problem.ts:28-30` makes `requestId` as `req-` and 8 random hex digits (`randomBytes(4)`). Lines 400 and 417 scan the whole body text, so an ID holding "838" or "839" fails the test with no leak. Odds: 6 three-digit windows in 8 digits, 2 patterns, 1/4096 each, about 0.29% per body; 6 bodies at line 400 and 2 at line 417 per run, about **2.3% per run of the file**.

## Evidence
Run 42873078338, job 130029124218: the failure above. Test line 408 (`read.text.replace(/"requestId":"[^"]*"/, '')`) already knew the ID is random: it removed it before comparing the Lead and Engineer bodies, but not before the scans.

## Suspected Area (confirmed at the fix)
Test, not product: the product is right to put a random request ID in every refusal (architecture section 6). The two scans in the file were written without allowing for it.

## Audit of the other scans (DL-138 / DL-140 precedent)
Method: every `not.toMatch`, `not.toContain` and `not.toContainEqual` under `tests/` (375 lines), plus the `includes(...)).toBe(false)`, `indexOf` and `RegExp.test(...)).toBe(false)` forms, read for one question: can the scanned text hold a random value (a request ID, `req-` and 8 hex digits; a `gen_random_uuid()` ID; a token), and is the scanned string made only of digits and the letters a to f, with no point or other character? Scans of source files, workflow text and fixed fixtures cannot hold a random value and were set aside.

| Where | Scans | Random value in the text | Same fault? | Action |
|-------|-------|--------------------------|-------------|--------|
| `tests/acceptance/aqp-123-exchange-rates.test.ts:400` | `/838\|839\|1\.23\|4\.56\|inr\|usd\|eur/i` on 6 refusal bodies per run | `requestId` | Yes, about 1.75% per run | Fixed: `withoutRequestId(answer.text)` |
| `tests/acceptance/aqp-123-exchange-rates.test.ts:417` | `/838\|839/` on 2 Origin-refusal 403 bodies per run | `requestId` | Yes, about 0.6% per run | Fixed: same helper |
| `tests/integration/masters/materials.test.ts:129` | `/917\|737\|717/` on `JSON.stringify(options)` | `id` from `gen_random_uuid()` (migration `20261108100000_materials`) | Yes, about 1.6% per run of that file (22 three-digit windows in a UUID, 3 patterns) | Fixed: `withoutUuids(...)`, the well-formed UUID only |
| `tests/acceptance/aqp-38-sign-in.test.ts:370` | `/57014\|statement timeout\|canceling\|login_throttles/i` on `JSON.stringify(response)` | possibly a hex token in a cookie | In kind, not in practice: a 5-digit run needs 5 specific digits, at most 60 windows x 16^-5, about 6 in 100,000 runs | Not changed (recorded; no change is proportionate). Revisit if a random member is ever added to that answer |
| `tests/acceptance/aqp-123-exchange-rates.test.ts:413`, `aqp-122-materials-requests.test.ts:88`, `tests/security/engineer-refused-before-lookup.test.ts:201` (headers, including `X-Request-Id`), `tests/security/strict-schema.test.ts:185`, `tests/unit/http-with-route.test.ts:347`, `tests/unit/assert-never.test.ts:18` | a number with a decimal point (`839.73`, `91.37`, `771.37`, `123.45`, `12345.67`) | request IDs and UUIDs, which never hold a point | No | None |
| Every canary list (`canary-masters.ts`, `exchange-rate-canary.ts`, `process-master-canary.ts`, `material-master-canary.ts`) and `aqp-122-materials-access.test.ts:154,192` (`ALL_SPELLINGS`) | invented values that end `.37` or `.73`, in several spellings, each with a point | request IDs and UUIDs | No: a point is never in the random text | None |
| `aqp-122-materials-access.test.ts:87`, `tests/unit/materials-routes.test.ts:219`, `tests/e2e/aqp-122-qa.spec.ts:497`, `tests/e2e/navigation.spec.ts:112` | words such as `price`, `gravity`, `scrap`, `rate`, `cost` (case-insensitive) | request IDs and UUIDs | No: they use letters outside a to f (p, r, s, t, o, g, v, y, i), so hex text cannot hold them | None |
| `tests/acceptance/aqp-113-def006-probes.test.ts:201` (`f:[0-9a-f]{8}`, `rate:`) | formula token form | `req-` IDs | No: a request ID has no `f:` before its digits | None |
| `tests/acceptance/aqp-106-formula-engine.test.ts:307` (`/e[+-]?\d/i`) | the written form of two computed decimals | none | No | None |
| `tests/unit/ci-run-summary-attempts.test.ts:94` (`'500'`), `tests/unit/columns.test.ts:51` (`'-7'`) | fixed strings built from fixed inputs | none | No | None |
| `audit-production.spec.ts`, `users-production.spec.ts`, `users.spec.ts`, `canary-scan.spec.ts`, `aqp-122-qa.spec.ts:461,491` and the rest of the page and header scans | names, phrases, passwords and camel-case field names (all 8 characters or more, or containing a point or an upper-case letter) | tokens in the HTML | No | None |
| The remaining lines | file text (source, workflow, config), fixed fixtures, or names of the form `Qa5a-Create` | none | No | None |

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | qa-engineer | 2026-11-10 | Test-only PR `fix/AQP-273-def-028-request-id` (DL-133 route). New `tests/support/random-members.ts` (`withoutRequestId`: the first `"requestId":"req-<8 hex>"` member only; `withoutUuids`: well-formed UUIDs only). Used at `aqp-123-exchange-rates.test.ts` lines 400 and 417 and `integration/masters/materials.test.ts:129`. Every other character is still scanned; no retry, timeout, skip or removal (DL-057) |
| Regression test added | qa-engineer | 2026-11-10 | `tests/unit/random-members.test.ts` (6 tests): bodies of the real `forbiddenProblem`, `unauthorizedProblem` and `originRefusedProblem` with request IDs `req-0839e75b`, `req-a838c0de`, `req-83983983`, `req-1838aaaa` fail the raw scan and pass the stripped scan; 2,000 IDs from the real `newRequestId()` give one identical stripped body; a planted `"rate":"1.23"` or `usd 839.73` is still found; an ID of another shape (9 digits, upper case, non-hex, `REQ-`) or a second `requestId` member is not removed; a UUID with 717, 737 or 917 is removed and a `pricePerKg` of `917.37` beside it is still found; a malformed UUID stays |
| Verified | qa-engineer | 2026-11-11 | PR #216, code at `ca8c4ec`, run 42948234269 attempt 1: 5 of 5 green (stages 1 to 11b: unit 145 files / 2799 tests, integration and acceptance 201 files / 4917 tests; shards 1 to 3: 231, 228 and 215 passed), no `flaky` or `failed` line. Control PR #217 (closed unmerged), `ca8c4ec` plus a planted `"rate":"1.23"` in every 403/401 body of the AQP-123 test double, run 42948309072, job 130286337362: exactly one failure, `[AQP-123 AC-6] decision table ...` at the line-400 scan (`Tests 1 failed \| 4916 passed (4917)`), so the fixed scan still finds a rate. The original fault is gone: `req-0839e75b` passes the stripped scan (`tests/unit/random-members.test.ts`). The Origin scan at line 417 holds `/838\|839/` only, so the plant does not reach it; its fault and fix are the same as line 400 and the unit test covers the three problem kinds |
