# Test Report — AQP-74 (STORY-01.07): Audit service and audit screen

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `7e0f287` on `feat/AQP-74-audit-log` (PR #97) |
| CI | Run 42206449038 on `7e0f287`: green on all four jobs (`Stages 1 to 11b`, both shards, fan-in `Stages 1 to 11`). Required path 305 s. Shard 1 204 passed, 2 skipped; shard 2 186 passed, 19 skipped; 0 failed, 0 flaky. **CI is the reference for E2E** |
| Environment | **Local, targeted only.** Windows 11, Node 22, in an isolated `git archive` copy of `7e0f287` (no shared worktree, no `git merge`), with a throwaway Postgres 17 database (Compose `qa74`, port 55674, removed). The PC was out of memory and its temp volume was full during this cycle, so no local E2E and no dev server were run, and some planted faults were run only in part (see below). Invented data only |
| Date | 2026-11-06 |
| Evidence list | master's G6 GO, Jira 11106; story description per scrum-master 11089 and PO READY 11093; one-width pins per architect 11078 |
| **Recommendation** | **ACCEPT the product, with QA-F1 (test adequacy) for master's ruling.** Every AC is met. One G7 evidence item is only partly met: a planted bypass of the single transaction **is caught for the role-change entry, but not for the activation entry, and for the rename entry only incidentally** (a lock-wait timeout in the self-rename test). The code itself writes every entry in the caller's transaction. Only the tests fall short |

## Summary

**Append-only is enforced at both layers on real PostgreSQL:**
- **Runtime role:** its grants are INSERT and SELECT only, so UPDATE, DELETE and TRUNCATE give "permission denied".
- **Owner:** a trigger refuses each with "Table "audit_log" is immutable".

**The rest, covered by tests:** the six user events, one per changed attribute; `actor_label` from the session; the Who filter by `actor_id`; and the people list with `{ id, name }`. The audit and users integration suites pass 64 of 64 on PostgreSQL.

**Lint:** a static `next/image` import and an `import('next/image')` each fail; a plain `<img>` passes.

**Other checks:**
- the 12 one-width pins equal the architect's list;
- the ux-spec v0.16 strings are in the source word for word;
- regression is green, including 11b.

## AC Verification Matrix

| AC | Technique | Result | Evidence |
|----|-----------|--------|----------|
| AC-1 (append-only; `actor_label` TEXT NOT NULL) | Direct SQL on the local database; `append-only.test.ts` | ✅ | **Columns:** `audit_log` has `actor_label text NOT NULL` among `id, actor_id, actor_label, event, object_type, object_id, object_label, before, after, request_id, created_at`. **Runtime role** (`accucut_app`): grants INSERT and SELECT only; UPDATE, DELETE and TRUNCATE on a real row each give "ERROR: permission denied for table audit_log". **Owner:** each gives "ERROR: Table "audit_log" is immutable: UPDATE / DELETE / TRUNCATE is not allowed." (triggers `trg_audit_log_forbid_change`, `trg_audit_log_forbid_truncate`). **The row is unchanged** afterwards |
| AC-2 (in the caller's transaction; rolled back with it) | Integration (local PostgreSQL) plus planted faults | ✅ product / **⚠ QA-F1 tests** | "a transaction that rolls back takes its entry with it", "a person change whose entry is refused is rolled back whole", "a rename that is rolled back writes no entry and leaves the name": all pass (64/64). **The planted bypass of one entry's transaction** (moving it into its own `transactions.run`) is in the QA-F1 table below |
| AC-3 (six user events; one per changed attribute; none for no change) | Unit `user-service-audit.test.ts`; integration | ✅ | Name, role and active flag each raise their own event, in order. Name plus role gives two entries, name alone gives one, and no change gives none (reviewer-quality caught 4 planted faults; QA ran the suites) |
| AC-4 (no hash, token or password in before/after) | Unit `audit-secrets.test.ts`; integration | ✅ | The secret-key and secret-value guard passes; `user.renamed` holds `{ name }` only (strict payload) |
| AC-5 (labels at the time; the rename entry shows the new name and old → new) | Integration `audit-database.test.ts` (AC-5 block, including the **self-rename** case) | ✅ | Passes on PostgreSQL. In "a self-rename: the entry names the Admin as they were (Who) and as they are now (Object)", Who is the name from the request and Object the new name |
| AC-6 (filters; IST "When"; Who from `actor_label`; Who by `actor_id`; people list; texts; 405) | Integration `audit-list-database.test.ts`; unit `audit-people.test.ts`, `audit-route.test.ts`; CI E2E; source check | ✅ | "after a rename an earlier entry still shows the old name in Who, a later one shows the new name, and filtering by the person finds both"; "filters by who, by event, by category and by day in IST"; keyset paging "with no gap and no repeat". **People list:** "keeps only the ID and the name: no e-mail address, role or active flag", "lists everyone, deactivated people included, sorted by name". **Strings, found word for word in the source:** the page text, the meta text, "No entries match", "Clear filters", "Not added", "Added as", "Earlier password", "Temporary password set", "Deactivated", the header "When", and IST formatting. **E2E (CI):** "PATCH, PUT, DELETE and POST on /api/v1/audit are 405 for the Admin" passed |
| AC-7 (Lead and Engineer get the fixed 403; signed out gets 401 or the redirect) | CI `audit-production.spec.ts` (6 tests, desktop); role matrix (unit and security) | ✅ | CI: "/audit answers HTTP 403 with the "no access" page and no entry" and "GET /api/v1/audit is the same fixed 403 whatever the query says" for a Lead and an Engineer; signed-out redirect and 401. All passed |
| AC-8 (empty, no-match, loading, error states) | CI `audit.spec.ts`; source | ✅ (see QLT-92) | CI: "No entries match" with the way back and Clear filters; the error state with "Try again"; "a broken answer is an error, never an empty list". **"No entries yet"** and its text "Changes to users, masters and approvals are recorded here as they happen." are in the source word for word, but **no test asserts them** (QLT-92, Info, as master noted) |
| AC-9 (360 / 768 / 1366: no sideways scroll, 44 px, axe 0, keyboard) | CI `audit.spec.ts` at three widths | ✅ | 11 tests on mobile, 11 on tablet, 17 on desktop (11 + 6 one-width), all passed. The suite's axe tags include `wcag21a` (AQP-198) |

## Master's G7 items (11106)

| Item | Result | Evidence |
|---|---|---|
| Every AC | ✅ | Above |
| **Audit atomicity, with a planted bypass** | ⚠ **QA-F1** | See "QA-F1" below |
| No UPDATE or DELETE by the runtime role | ✅ | AC-1 above: denied by grant, and the owner is refused by trigger |
| `user.renamed`: strict payload, one per changed attribute, none for no change, none on rollback, self-rename | ✅ | AC-3, AC-4, AC-5; integration and unit tests pass |
| `actor_label` from the session only; the Who filter by `actor_id`; after a rename the old name stays and the filter finds it | ✅ | AC-6 integration test (named above). Reviewer-standards confirmed `actor_label` comes from `requireUser()` with no client input |
| People list `{id, name}` for Admin only; fixed 403 on `/audit` and `/api/v1/audit` for others | ✅ | `audit-people.test.ts` (id and name only, all users, sorted); the page reads the list after `authorizePage('/audit')` (architect 11091); CI production 403 tests |
| From after To: no stale list, no false "Show more" | ✅ | CI E2E "a range that ends before it begins is said in words under To, and asks the server nothing" passed (QLT-89, verified at G6) |
| ux-spec v0.16 strings, including "No entries yet", the description and the meta text | ✅ (QLT-92 noted) | All present word for word in the source. "No entries yet", the description and the meta text are **not asserted by any test** (QLT-92, Info) |
| Lock test; PRF-03 | ✅ | `audit-lock.test.ts` passes in the 64/64 run. Reviewer-quality's planted fault (`FOR UPDATE` removed) failed it 5 of 5; QA did not re-run that plant, because of the resource limits. **PRF-03:** in `user-service.ts` the password is hashed on line 122 (create) and line 192 (reset), **before** `transactions.run` opens |
| Planted `next/image` import fails lint; a plain `<img>` passes | ✅ | Scratch copy only, never committed. `import Image from 'next/image'` gives **error** "'next/image' import is restricted … Use a plain <img> with width, height and alt (architecture section 10)" (`no-restricted-imports`), exit 1. `await import('next/image')` gives **error** "… (also when loaded with import())" (`no-restricted-syntax`), exit 1. A plain `<img … decoding="async">` gives **0 problems**, exit 0 |
| The 12 one-width pins | ✅ | `tests/unit/one-width-tag.test.ts` lines 83 to 94 equal the architect's list in 11078 word for word, with "an Engineer on the production build" fixed. CI ran exactly 12 audit tests on desktop only, beyond the 11 at three widths |
| Three widths with axe (`wcag21a`), keyboard, 44 px | ✅ | CI `audit.spec.ts` at three widths (AC-9). No local re-run (resource limits) |
| Log check | ✅ (static) | The audit service, repository, route, page, components and `user-service.ts` add **no log call**. The only log path is the shared `withRoute`, which logs `requestId`, route, method, status, code and `errorName`, never a message or a value. A planted 500 carrying an invented e-mail left 0 occurrences in the log at the AQP-48 and AQP-65 G7s. **Not re-run live here,** because of the resource limits |
| Regression with 11b | ✅ | CI 42206449038. 11b: `/` 162,464, **`/audit` 171,801**, `/queue` 163,623, `/sign-in` 166,296 (PRF-07, Info), `/users` 169,862, not-found 155,803: all 7 rows within the limit and under 190,000 B |

## QA-F1 (test adequacy, for master): a bypass of the single transaction is not caught for every event

**Method.** In a scratch copy, one entry's `await audit.record(tx, …)` in `user-service.ts` was replaced by `await transactions.run((own) => audit.record(own, …))`. The entry is then written in **its own** transaction, which would commit even if the user change rolled back. The audit and users integration suites (local PostgreSQL) and the user-service and audit unit tests were run against each plant. Each plant was restored afterwards.

| Event (line) | Integration (64 tests) | Unit (183 tests) | Caught? |
|---|---|---|---|
| `user.renamed` (166) | **1 failed**: "a self-rename …", which **timed out at 5 s**. In the self case the separate transaction waits on the actor row the outer transaction holds, so this is a lock wait, not an atomicity assertion | all pass | **Only incidentally** (self case). An ordinary rename with the bypass passes every test |
| `user.role_changed` (169) | all pass | **3 failed** ("… raises one event for each, in that order", "a name plus a role writes two entries", "a later rename leaves the earlier entries …") | ✅ by the unit tests |
| `user.activated` (172) | all pass | all pass | **No** |
| `user.deactivated`, `user.created`, `user.password_reset` | not run: the PC's temp volume filled up (0 MB free) and the cycle was stopped | — | not checked |

**Why "a rename that is rolled back writes no entry" cannot catch it:**
- The test makes the rollback happen by injecting a failure **into `audit.record` itself** (`record: () => Promise.reject(new AuditEntryRefusedError(…))`).
- With the bypass, that failure still propagates and the outer transaction still rolls back, so the name stays and no entry exists. The test passes either way.
- To expose a separate transaction, the failure has to come **after** the entry is written: for example a name plus role save where the **second** entry is refused. The test then asserts there is **no rename entry** and the name is unchanged.

**What is not in question:** the code under test is correct. Every `audit.record` takes the caller's `tx`, and the service-level "a transaction that rolls back takes its entry with it" passes on PostgreSQL. **The gap is in the tests,** against master's G7 item "a planted bypass must fail".

**Suggested (for master to rule; QA does not fix it):** one integration test per event kind in which a later step of the same transaction fails after the entry was written, asserting no entry and no change. Or a unit assertion, as for the role change, that every `record` call receives the transaction it was opened with. Severity proposal: Test, Sev-3.

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| Audit and users integration (local PostgreSQL) | `npx vitest run tests/integration/audit tests/integration/users` | 64 | 64 | 0 | 0 | about 1 min |
| User-service and audit unit tests (with the plants, then restored) | `npx vitest run tests/unit/user-service tests/unit/user-service-audit.test.ts tests/unit/audit` | 183 | 183 | 0 | 0 | under 1 min |
| Lint plants (scratch) | `npx eslint <file>` × 3 | 3 | as expected (2 errors, 1 clean) | — | — | — |
| Full regression (CI) | Run 42206449038 | 4 jobs | ✅ (E2E 204 + 186) | 0 | 21 (viewport-specific) | required path 305 s |

## Exploratory Testing

**Charter:** try to change or remove audit history as the database roles the portal uses, and check whether the tests would notice a broken transaction boundary. **Time-box:** 45 min.
- **Changing or removing history:** both roles were refused at the database, as above.
- **Transaction boundary:** a broken boundary is noticed for one event of the three tried (QA-F1).
- **Touch:** nothing touch-specific was found, so no phone check is needed.

## Defects

None raised as a defect. **QA-F1 is a test-adequacy finding for master** (proposed Test, Sev-3), and **QLT-92** (Info) is noted.

## Residual Risks / Notes

- **Resources:** this cycle ran with the PC out of memory and, at one point, 0 MB free on the temp volume. QA stopped and removed its database; no server was left running. The unrun plants (deactivate, create, reset; `FOR UPDATE`) and the live log check are listed above as not done. They are not claimed.
- **Migration:** it must not be edited after merge (master, 11106).
- **PRF-07 (Info):** `/sign-in` is 166,296 B, about +3 KB on `master`, and under the 190,000 B floor.
