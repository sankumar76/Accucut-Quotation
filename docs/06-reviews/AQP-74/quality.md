# Review Report: AQP-74 (STORY-01.07), Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-74-audit-log` (PR #97) |
| Commit reviewed | 3aa50db808841ac3e706eefaee5508e93941ee4d |
| Date | 2026-11-06 |
| Reviewed against | Jira AQP-74 ACs (AC-3 now six events, 11080 and 11085); architect rulings 11078 and 11087; PM 11077; ux-expert 11084 |
| **Verdict** | APPROVE WITH COMMENTS for the code at this head. The rulings made after this head (`user.renamed`, `actor_label`, the one-width pins) are pending the fix push and are re-checked in a narrow round 2 |

## Summary
**Atomicity holds.** Each user change and its audit entry share one transaction: an opaque `Transaction` from a `TransactionRunner`, and an `append` that requires it. Against a throwaway PostgreSQL, moving any user write, or the append, out of the transaction, or not awaiting the entry, is caught by the integration tests. So a refused or failed entry takes the change back.

**Correctness of the rest:**
- the "before" state is read with `SELECT … FOR UPDATE`;
- the five wired events, AC-4's secret guard, IST whole days, the From/To order check (client and server), and keyset paging with its millisecond tie-break are correct and pinned by tests;
- `/audit` is in the role matrix, the same-403 loop and the page-order test.

**Two Minor findings:**
- the row lock's only test detects its removal by chance (2 of 5 runs);
- "Show more entries" is still offered while the date range is invalid, and pressing it shows a false error.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Code reading | `git diff origin/master...origin/pr-97` (56 files); Jira AQP-74 and comments 11074 to 11087 | see Findings |
| Unit and security tests (a fresh `git archive` copy of 3aa50db; the probe copy from the interrupted session was discarded and its process stopped) | `npx vitest run tests/security` and the unit tests for `user-service`, `audit-service`, `audit-events`, `audit-secrets`, `audit-route`, `audit-schemas`, `audit-client`, `audit-cursor` and `time-ist` | 352 of 352 passed |
| Integration tests | throwaway `postgres:17` container (CI image digest) on 127.0.0.1:55433, the project's role script, `npx prisma migrate deploy`; `npx vitest run tests/integration/audit tests/integration/users`. The container is stopped and removed; no `.env` file was read | 55 of 55 passed |
| Planted-fault probe | 21 edits (atomicity, lock, events, guard, IST, range, paging, role); integration included where it applies | 19 caught. Survived: the read without the lock (QLT-88), and the cursor ID left in capitals (equivalent: `uuid` ignores case). The throttle clear moved inside the reset transaction also survived and is equivalent (it is the last step before the commit) |
| Lock detection | `FOR UPDATE` removed; the concurrency test run 4 more times | Failed in 1 of 4 (2 of 5 with the probe run) |
| E2E | not run locally | CI 42179402882: 409 passed, 0 flaky |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-88 | Minor | `tests/integration/audit/audit-database.test.ts:250` | AC-2 and AC-3 ("before" is the state replaced); architecture §10 row-lock rule (11078) | Without `FOR UPDATE`, the concurrency test (ENGINEER → LEAD and → ENGINEER at once) failed in only 2 of 5 runs. The "→ ENGINEER" change is a no-op when both read ENGINEER, so only some interleavings break the chain. | Removing the lock in a later change would most likely pass CI. | Hold the row lock from a second (owner) transaction, start the update, assert it waits, change the row, commit, and assert the service saw the new state. That fails every time without the lock. |
| QLT-89 | Minor | `src/components/features/audit/audit-screen.tsx:113` | AC-6, AC-8 | With From after To, the previous page stays on screen with "Show more entries". `showMore` does not check `rangeProblem(filters)`, so a press sends an invalid range and the old cursor, gets 422, and shows the "could not load more" error. The list and total are those of the earlier filters. | A false error, and stale results shown under the new filters. | Return early on a range problem and hide "Show more entries" in that state; add an E2E step. |
| QLT-90 | Info | `tests/e2e/audit-production.spec.ts:44` | One width (test strategy §10.5) | `:visible` picks the representation (table or cards), but the "whole days" and "kind of entry" tests test server rules, and the representations are covered at three widths. The two Show more tests are about the representations. I agree with 11078 (12 pinned). The describe title reads "a Engineer". | — | Pin the 12 titles as the code produces them; fix the article if desired. |
| QLT-91 | Info | fix push | AC-3, AC-5, AC-6 | Pending from rulings after this head: `user.renamed` (six events; name plus role gives two entries, no change gives none, a rolled-back rename gives none); `audit_log.actor_label` with Who showing the name at the time and the filter by person (11087); the 12 one-width pins; the `user-service.ts` header comment. | AC-3 is not yet met at this head (five of six events). | Re-checked in round 2 (DL-091). |

## Reviewer-specific tables
**Quality: AC conformance at 3aa50db**

| AC | Result | Evidence |
|----|--------|----------|
| AC-1 append-only | Met | `append-only.test.ts` on PostgreSQL (runtime 42501; owner refused by the trigger) |
| AC-2 same transaction | Met | Integration rollback tests; the probe moved the writes and the append out of the transaction, all caught |
| AC-3 typed registry, wired events | **5 of 6** (rename pending, QLT-91) | One integration scenario per wired event; probe caught each missing or wrong event |
| AC-4 no secrets | Met | Stored-JSON test; guard fault caught |
| AC-5 label at the time | Met | Rename by service and by SQL |
| AC-6 screen, filters, paging, IST, 405 | Met (QLT-89) | Unit, integration, E2E; IST, range and paging faults caught |
| AC-7 role first, 403 | Met | Role matrix, same-403 loop, page-order test; faults caught |
| AC-8 states | Met (QLT-89) | E2E states |
| AC-9 widths, 44 px, axe, keyboard | Met (on CI) | `audit.spec.ts` |

## Previous Findings (re-review only)
n/a (first quality review of this PR).

---

## Round 2: full review of the fix push, 3aa50db..c365f00 (AQP-208 merge excluded; master 11096)

| Field | Value |
|-------|-------|
| Commit reviewed | c365f0073a67c69d53978635ab509e2796cee66c (diff `ea12a6f..c365f00`: 7167d4c, c365f00) |
| Reviewed against | the latest AQP-74 description (scrum-master 11089; PO READY 11093): AC-1 `actor_label`, AC-3 six events, AC-5 rename entry, AC-6 Who and texts, AC-8 empty states |
| CI | 42204813440 green |
| **Verdict** | APPROVE WITH COMMENTS. New findings: Blocker 0 · Critical 0 · Major 0 · Minor 0 · Info 1 |

**Previous findings**

| ID | Prior severity | Status | Evidence |
|----|----------------|--------|----------|
| QLT-88 | Minor | **Fixed** | `tests/integration/audit/audit-lock.test.ts`: a second transaction holds the row lock, `pg_locks` is polled for the waiter (no sleep), the change must not finish, and its `before` is the holder's result; a rolled-back holder is covered too. `FOR UPDATE` removed: killed 5 of 5; unlocked `findAccountById`: killed 3 of 3 |
| QLT-89 | Minor | **Fixed** | `audit-screen.tsx`: no results card while `rangeProblem(filters)` is set, and `showMore` returns early on it. E2E (stubbed "always more"): 0 entries, no "Show more", no "Showing N of M", no request |
| QLT-90 | Info | **Closed** | The 12 pins exactly as in 11078 (titles "a Lead" and "an Engineer"); `one-width-tag.test.ts` pins 47 in 9 files; a removed pin is caught |
| QLT-91 | Info | **Closed** | `user.renamed`, `actor_label`, the pins and the header comment are delivered (verified below) |

**Verified, with planted faults (throwaway local `postgres:17` with the CI image digest for integration; removed afterwards; no `.env` read)**

| Item | Result | Faults caught |
|------|--------|---------------|
| `user.renamed`, one event per changed attribute (name plus role gives 2, none for no change, none after a rolled-back rename, self-rename) | Met | rename not recorded; unchanged name recorded; "before" from the new name; Object as the old name |
| `actor_label` (NOT NULL; Who shows it; filter by `actor_id`; the old name kept after a rename) | Met | label from the object; filter by label text. The route's `actorLabel: user.name` wiring is covered by E2E only |
| People list (all users, deactivated included, sorted, `{id, name}` only) | Met | e-mail leaked; not sorted; deactivated dropped |
| ux-spec v0.16 strings | Met in code: "When", the description and meta, "No entries yet" and "No entries match", Clear filters focus to Who (E2E), no "Showing N of M", the six entry texts (unit) | "No entries yet" and the description and meta are untested (QLT-92) |
| One-width pins and article | Met | pin removed |
| PRF-03 (hash before the transaction) | Met; the own-reset check runs first, outside the transaction (`findAccountById`, case-insensitive), then the lock on `asked.id` | hash inside the transaction; self-reset check removed |

**New finding (round 2)**

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-92 | Info | `src/components/features/audit/texts.ts:43` | AC-6, AC-8 (ux-spec v0.16); test adequacy | "No entries yet" (title, text, no button), the page description and the meta description are correct but asserted by no test at any tier. Also: the users routes' `actorLabel: user.name` is not pinned at route level (a planted constant passes unit and integration) and is covered by the E2E rename test only. | A wording or state regression would go unnoticed. | One E2E with a stubbed empty answer and no filter (as the error tests stub the API), plus checks of the description and meta. |

**Checks run (round 2)**

| Check | Result |
|-------|--------|
| Integration (`tests/integration/audit`, `tests/integration/users`) on the throwaway database | 64 of 64 passed |
| `tests/security` and the unit tests for `user-service`, `user-service-audit`, `audit-service`, `audit-events`, `audit-people`, `audit-route`, `audit-schemas`, `audit-client` and `one-width-tag` | 320 of 320 passed |
| Planted-fault probe (15 faults, the lock faults repeated) | 14 caught; the route's `actorLabel` constant survives at unit and integration (covered by E2E) |
| E2E | Not run locally; CI green |
