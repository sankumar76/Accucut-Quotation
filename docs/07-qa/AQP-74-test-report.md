# Test Report — AQP-74 (STORY-01.07): Audit service and audit screen

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | `7e0f287` on `feat/AQP-74-audit-log` (PR #97) |
| CI | Run 42206449038 on `7e0f287`: green on all four jobs (`Stages 1 to 11b`, both shards, fan-in `Stages 1 to 11`). Required path 305 s. Shard 1 204 passed, 2 skipped; shard 2 186 passed, 19 skipped; 0 failed, 0 flaky. **CI is the reference for E2E** |
| Environment | **Local, targeted only.** Windows 11, Node 22, in an isolated `git archive` copy of `7e0f287` (no shared worktree, no `git merge`), with a throwaway Postgres 17 database (Compose `qa74`, port 55674, removed). The PC was out of memory and its temp volume was full during this cycle, so no local E2E and no dev server were run, and some planted faults were run only in part (see below). Invented data only |
| Date | 2026-11-06 |
| Evidence list | master's G6 GO, Jira 11106; story description per scrum-master 11089 and PO READY 11093; one-width pins per architect 11078 |
| **Recommendation (attempt 2, `c5e4e41`)** | **ACCEPT.** All twelve planted transaction bypasses (six events × inside / sibling-after) fail a test, so DEF-017 is verified. QLT-92's strings are shown live on an empty log, and the live log check is clean. See "Attempt 2" at the end |
| Recommendation (attempt 1, `7e0f287`) | **ACCEPT the product, with QA-F1 (test adequacy) for master's ruling.** Every AC is met. One G7 evidence item is only partly met: a planted bypass of the single transaction **is caught for the role-change entry, but not for the activation entry, and for the rename entry only incidentally** (a lock-wait timeout in the self-rename test). The code itself writes every entry in the caller's transaction. Only the tests fall short |

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

---

## Attempt 2 (G7 re-run on `c5e4e41`, after master's NO-GO DL-107 and DEF-017)

| Field | Value |
|-------|-------|
| Build / commit | `c5e4e41` (PR #97). The product code is unchanged since `7e0f287`; the DEF-017 tests were added (`tests/integration/audit/audit-atomicity.test.ts`, `tests/support/late-failure.ts`; master verified in 11120) |
| CI | Run 42228339693 on `c5e4e41`: green on all four jobs. Stage 6 2218 / 2218; stage 11 3084 / 3084 (`audit-atomicity.test.ts` 13 / 13); E2E 204 + 186 passed, 0 failed, 0 flaky; 11b all 7 rows within the limit (`/audit` 171,801 B); required path 293 s |
| Environment | A fresh `git archive` copy of `c5e4e41` with its own `npm ci`, one throwaway Postgres 17 at a time, and one test file at a time (`--no-file-parallelism`). **Interruptions, recorded:** an earlier scratch copy lost files while in use (its `node_modules/.bin`, then its root files); it was replaced by a fresh copy, and the first planting run was repeated from the start. One integration test failed once with several database files running in parallel; it passed alone (18 / 18) and in the sequential baseline, so it is Environment and not counted |
| Evidence list | master 11106, 11112 (DL-107), 11117 and 11120 |
| **Recommendation** | **ACCEPT; close DEF-017 after the posted G7** |

### The twelve planted bypasses (11117 / 11120)

**Baseline** on the clean copy, sequential: `tests/integration/audit tests/integration/users tests/unit/user-service tests/unit/user-service-audit.test.ts tests/unit/audit` gives **260 / 260 passed** (16 files).

**Method:** for each event, one plant at a time in `src/server/services/user-service.ts`. Each was generated from the clean original by a script, never committed, and checked restored before the next plant.
- **(a) inside:** the event's `await audit.record(tx, …)` becomes `await transactions.run((own) => audit.record(own, …))`, a separate transaction inside the change's unit of work.
- **(b) sibling-after:** the entry is queued, then written by `transactions.run((own) => audit.record(own, …))` **after** the change's transaction has committed.

The same five test paths were run after each plant.

| Event | (a) inside | (b) sibling-after |
|---|---|---|
| `user.created` | **1 failed**: `audit-atomicity` "a failure after the entry was written takes the entry and the change back … user.created" | **2 failed**: `audit-atomicity` "an entry that is refused when it is written takes the change back … user.created"; `audit-database` "a creation whose entry is refused leaves no person behind" |
| `user.renamed` | **3 failed**: `audit-atomicity` (failure after the entry, user.renamed, two cases); `audit-database` "a self-rename …" | **7 failed**: `user-service-audit` AC-3 and AC-5 (3), `audit-atomicity` (refused entry, user.renamed), and others |
| `user.role_changed` | **4 failed**: `user-service-audit` AC-3 and AC-5 (3); `audit-atomicity` (failure after the entry) | **5 failed**: `user-service-audit` AC-3; `audit-atomicity` (refused entry, user.role_changed; failure after, user.renamed); `audit-database` AC-2 |
| `user.deactivated` | **2 failed**: `user-service-audit` AC-3; `audit-atomicity` (failure after the entry, user.deactivated) | **1 failed**: `audit-atomicity` (refused entry, user.deactivated) |
| `user.activated` | **1 failed**: `audit-atomicity` (failure after the entry, user.activated) | **1 failed**: `audit-atomicity` (refused entry, user.activated) |
| `user.password_reset` | **1 failed**: `audit-atomicity` (failure after the entry, user.password_reset) | **2 failed**: `audit-atomicity` (refused entry, user.password_reset); `audit-database` "a password reset whose entry is refused leaves the old password in place" |

**Result: 12 of 12 plants caught. Each is caught by its own event's DEF-017 test:**
- the inside form by "a failure after the entry was written …";
- the sibling-after form by "an entry that is refused when it is written …".

**Restore:** after every plant the file was byte-identical to the original, and the copy ended clean (equal to `c5e4e41`, line endings aside).

**Attempt 1's gaps are closed:** activation is now caught, and rename is caught by assertions, not by a timeout. **The sibling-before form remains a stated limit** (11117), covered by the review rule in architecture v0.29 §6.

### The rest of 11106 on the final head

The product code is unchanged since attempt 1, so attempt 1's results stand: append-only, `user.renamed`, `actor_label` and the Who filter, the people list and the 403, From after To, PRF-03, the lint plants and the 12 pins. They are re-confirmed by CI 42228339693 and the 260-test baseline.

**Items not finished at attempt 1:**

| Item | Attempt 2 result |
|---|---|
| Deactivate, create and reset bypasses | Caught (table above) |
| **QLT-92**: "No entries yet", the page description, the meta text | **Live**, on a fresh, empty database (`audit_log` count 0), `/audit` as the invented Admin on the dev server of `c5e4e41`: "No entries yet" **present**; "Changes to users, masters and approvals are recorded here as they happen." **exact**; the page description "A record of approvals, unlocks, price overrides, cancelled approvals, removed prices, quantity warnings gone ahead on, master data and user changes. The portal has no way to edit or delete an entry." **exact**; `<meta name="description">` = "A record of approvals, unlocks, price overrides, master data and user changes." **exact**; **no "Showing N of M" line and no button** in the empty state. After one change (an invented user added), the empty state is gone, the "Showing" line appears and the entry reads "Added as Engineer". **The test gap stays:** no automated test asserts "No entries yet", its text or the meta text (only the description is asserted once). Recorded as QLT-92 (Info), not a defect |
| **Live log check** | The same server received an added user, a duplicate in other letter case (422 `EMAIL_TAKEN`), an invalid address (422), and `GET /api/v1/audit` with an e-mail in `who` and in `from` (422 each). All addresses were invented. **The application's log has none of them:** the refusal line is `{"route":"/api/v1/users","method":"POST","status":422,"code":"EMAIL_TAKEN","msg":"route refused"}`. **Observation (dev only, no defect):** the Next.js development server's own request line prints the URL with its query string (`GET /api/v1/audit?who=…@example.test 422 in 981ms`), so a query-string value appears in the **dev** console. The production server (`next start`) prints no request lines; its log held only the application's JSON lines in the AQP-48 and AQP-65 probes |
| `FOR UPDATE` plant | Not re-run. The lock test passes in the 260-test baseline and in CI; reviewer-quality caught that plant 5 of 5 (11105) |

### Clean-up

The dev server is stopped. The databases `qa74b` and `qa74c` and their volumes are removed. No container of QA's is running.
