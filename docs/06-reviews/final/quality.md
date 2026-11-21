# Review Report: whole product (final review): Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 (the one full review, fast track CLAUDE.md §9 item 3, hardening window) |
| Base…branch | `master` |
| Commit reviewed | `242c21f7` (AQP-365, #564), read in the read-only worktree `.claude/worktrees/final-review` |
| Date | 2026-11-21 |
| **Verdict** | **REQUEST CHANGES**: one new Major (QLT-F-01, #578). Three Majors that were already open (#382, #410, #568) are still open and must be fixed before G8 too |

## Summary

The product is in good shape for correctness. The flows I traced end to end hold up: assign, the part form and autosave, calculate, approve, unlock, cancel, removing a price, export, the mail jobs, versions and masters. In each one:

- the guard and the write share a transaction;
- the order of row locks is written down and followed;
- jobs are idempotent through unique keys;
- leases are fenced by an attempt number;
- the figures read for an export come from one snapshot;
- Engineer access is decided by role in one route manifest.

The stories that merged on green CI with no review are the mail jobs (09.02 to 09.06), export (07.04 to 07.07), autosave (05.10), queue filters (04.06), versions (08.05), change history (08.07) and states (10.07). I found no Blocker or Critical in them.

The one new Major is in the assignment e-mail. Its rows never expire and are queued even while this install sends no e-mail. When e-mail is switched on (STORY-09.08), or after a long worker outage, every one of them goes out, including mails about tasks that are now closed or belong to someone else. The overdue e-mail was designed to prevent exactly this (decision D-c).

The other findings are Minor. They cover:

- the digest size has no cap;
- the 11:00 digest is not retried when its run fails;
- the export "busy" answer loses its own words;
- autosave does nothing while the tab is hidden;
- a role change leaves open tasks with a non-Engineer;
- the queue filter cannot pick a deactivated Engineer;
- one FR-052 check is missing.

| Severity | Count (new) |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 7 |
| Info | 2 |

**Carried open Majors / Sev-2 (not new; §9 item 3 applies to them):**

| Issue | Severity | What |
|---|---|---|
| #382 | Major | AQP-293 SQR-01: the calculation store reads masters on extra pool connections while it holds the estimate lock |
| #410 | Major | AQP-315 SQR-01: the Next proxy buffers request bodies up to 10 MB on every `/api` route before the route's own cap applies |
| #568 | Major | AQP-365 SQR-01: propagating a default to 500 customers takes 1.5 to 1.8 s while holding the Process Master lock |
| #462 | Sev-2 | DEF-038: after Fasteners is set to "None", the server still held the old Qty and Cost |
| #347 | Sev-2 | DEF-034: a long name in the top-bar account trigger makes every page scroll sideways at 768 px and wider |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Code reading at `242c21f7` | Read, Grep in the read-only worktree | Done (areas below) |
| FR → test traceability scan | `grep -rhoE "FR-[0-9]{3}" tests` against the PRD FR list | 30 FR IDs are not named in any test. Spot checks show the behaviour is tested under story or AC IDs instead (QLT-F-I1) |
| Unit, integration, E2E suites | not run | Not run, as the brief says (no node_modules in the review worktree; no full-suite runs; heavy tests run in CI). Master CI was green at merge of #564 |
| Open-issue de-duplication | `gh issue list --state open --limit 200` | Done. Each finding below is new, or is linked to the issue that already covers it |

## Findings

| ID | Severity | File:line (242c21f7) | Rule / FR / AC | Issue | Why it matters | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-F-01 | **Major** (#578) | `src/server/services/task-mail.ts:74`; `src/server/services/task-service.ts:273`, `:362` | FR-081, FR-084, BR-040; AQP-350 AC-1, AC-7; D-c | **Assignment rows have no `sendBefore`, and they are written whenever alerts are ON, even with `FEATURE_EMAIL` off.** `outbox-send` sends any due row, and it does not check whether the task was reassigned again or closed | When IT turns `FEATURE_EMAIL` on (09.08), or after a long worker outage, weeks of stale "Task assigned" mails go out at 25 a minute. If a task is reassigned before its row is sent, the old Engineer is told about a task they can no longer open. The overdue e-mail has a 24-hour window for this very reason; the assignment e-mail has none | Set `sendBefore` (for example now + 24 h) on `task-assigned` rows. Optionally enqueue only when `FEATURE_EMAIL` is on, and skip the pending row of an older revision when a reassignment is saved. Test: assign, move the clock forward 2 days, run `runOutboxSend`, expect `EXPIRED` |
| QLT-F-02 | Minor | `src/server/jobs/daily-digest.ts:114`; `src/server/mail/templates/daily-digest.ts:58` | FR-083; AQP-352 | **The digest lists every overdue task with no cap.** Each row is about 1 KB of inline-styled HTML. At about 180 tasks the body passes `MAX_BODY_LENGTH` (200,000, `email-outbox-repository.ts:136`), and `enqueue` refuses it | That Engineer then gets no digest, every day. The run is `failed`, and the catch-up repeats the failure at each restart. Tasks cannot be cancelled (FR-040) and close only on approval, so overdue tasks only accumulate | Show the oldest 50 rows, then "and N more", with the "Open my tasks" link. Unit test: 300 tasks render under the limit |
| QLT-F-03 | Minor | `src/server/jobs/daily-digest.ts:218` (catch-up only at start-up) | FR-083; AQP-352 AC-5 | **A failed 11:00 run is not retried while the worker stays up.** Say the database is unavailable at that minute and the run throws. The wrapper writes a `failed` row with no `istDate`. Only the start-up catch-up asks `hasRunFor` | That day's digest is lost unless someone restarts the worker | Run the same catch-up check hourly (or every 15 min) until the end of the IST day. It is already idempotent through the digest key |
| QLT-F-04 | Minor | `src/lib/export/download-client.ts:50` | FR-070; architecture §4.6 (503 `EXPORT_BUSY`) | **The 503 `EXPORT_BUSY` title is thrown away** (`status >= 500 → null`). The person then sees "We could not build the file ... give the reference below to your administrator" | A temporary capacity limit (2 builds, 1 large) reads like a fault and sends people to the Admin. The server's words, "Other files are being built right now. Try again in a moment.", are never shown | Treat `503` with code `EXPORT_BUSY` as `refused` with its title, and optionally honour `Retry-After`. Unit test in `download-client` |
| QLT-F-05 | Minor | `src/components/features/estimate-workspace/use-autosave.ts:45` | FR-054; AQP-367 AC-7 | **Autosave does nothing while the tab is hidden, and nothing saves when the tab is hidden or the page is left** (`visibilitychange` → hidden, `pagehide`). An Engineer types a value, then switches to the drawing in another application. The value stays unsaved for as long as the tab is hidden | If the browser crashes, the laptop sleeps or the 12-hour session ends, the typing is lost, even though the architecture says "autosave keeps typed work if a session ends mid-entry". AC-7 does ask for the skip, so this is rated Minor (a product rule) | One `gate.flush('auto')` when the page becomes hidden, still subject to the same guards: not dirty, a save in flight, Calculate in flight. Product-owner to confirm, since this changes AC-7 |
| QLT-F-06 | Minor | `src/server/services/user-service.ts:178`; `src/server/repositories/overdue-repository.ts:107`, `:135` | FR-004, FR-032, FR-081 to FR-083 | **Changing the role of an Engineer who has open tasks is neither refused nor warned.** The tasks stay with a Lead or Admin, who cannot press Calculate (`/calculate` allows only Engineers). The overdue scan and the digest still mail them as the Engineer, because the SQL checks `is_active` and not the role | The task is stuck until someone notices and reassigns it, and the e-mails go to the wrong role. The Deactivate dialog warns about open tasks; the role change does not | Warn about open tasks in the Edit user dialog, as Deactivate does, or refuse until they are reassigned. Add `eng.role = 'ENGINEER'` to both scans |
| QLT-F-07 | Minor | `src/app/(portal)/queue/page.tsx:46-49`; `src/lib/tasks/queue-filters.ts` (`choiceOf`) | FR-039, FR-040; STORY-04.07 AC-9 | **The queue's Engineer filter offers only active Engineers** (the assign context), so a deactivated person's ID in the address is dropped as stale | The Deactivate dialog says "You can reassign their open tasks". The Lead cannot filter the queue to find those tasks, so a leaver's work is hard to collect | Offer deactivated Engineers who still have open tasks, marked "(inactive)", in the filter list only, not in Assign |
| QLT-F-08 | Minor (tests) | `src/components/features/estimate-workspace/field-renderer.tsx:140` | FR-052 (decimal keyboard) | **No test checks `inputMode="decimal"` on the part form.** Only `tests/e2e/exchange-rates.spec.ts` asserts an `inputmode` | Losing the attribute in a refactor would pass CI, and phone users would get the full keyboard | Assert `inputmode="decimal"` on a number field in `estimate-form.spec.ts` or a renderer unit test |
| QLT-F-I1 | Info | `tests/**` | Traceability (CLAUDE.md §6 rule 3) | 30 in-scope FRs are not named by ID in any test: FR-013, 017, 032 to 035, 039, 041, 042, 045 to 047, 051, 052, 054, 059, 072, 085, 086, 089, 099, 102, 105 (plus FR-090, 092, 094 to 097, which are out of scope). The tests trace to story and AC IDs instead. Spot checks found the behaviour covered: autosave E2E with Playwright's clock, Enter to the next field, Backup late, the 12-hour session, the engineer-status integration test | Only FR-052 (QLT-F-08) has a real gap among those checked | QA's G8 trace table should map each FR to its story test, so the FR-to-test link does not depend on comments in the tests |
| QLT-F-I2 | Info | `src/server/jobs/*.ts`, `src/server/repositories/email-outbox-repository.ts` | FR-084, NFR-014, NFR-024 | **Good practice in the unreviewed mail jobs, with nothing to fix:**<br>- the claim is one statement with `FOR UPDATE SKIP LOCKED`;<br>- every write is fenced by the attempt number;<br>- a reset link's body is emptied when the row ends;<br>- the overdue scan's SQL key matches `idempotencyKeys.taskOverdue`;<br>- recipients are stored as user IDs and checked again at send;<br>- logs and `job_runs` rows hold only counts and codes | n/a | n/a |

## FR coverage notes (vs PRD v-current)

- **Implemented and tested** (AC-level tests exist): all R1, R1+ and R2 Must FRs I traced. They are FR-001 to FR-008, FR-011 to FR-019, FR-022 to FR-031, FR-032 to FR-041, FR-042 to FR-057, FR-058 to FR-065, FR-066 to FR-071, FR-072 to FR-080, FR-081 to FR-084, FR-098 to FR-108.
- **Partly met / known gaps:**
  - FR-085: the persistent 240 px tree panel from 1024 px (#435).
  - FR-088: "Try again" after a page-level load error (DEF-033, #345).
  - FR-081 robustness (QLT-F-01).
  - FR-083 robustness (QLT-F-02, QLT-F-03).
- **Out of scope by decision:** FR-090, FR-092 to FR-097.
- **Human step outstanding:** STORY-09.08 (AQP-355), one real send on the real mailbox. QLT-F-01 should be fixed before it, or the first real send will also release the stale backlog.

## AC conformance (sampled, unreviewed stories)

| Story | AC sampled | Implemented in | Tested by | Result |
|---|---|---|---|---|
| 09.03 (AQP-350) | AC-1, AC-4, AC-5, AC-7 | `task-service.ts` `assignTask` / `reassignTask`, `task-mail.ts` | `tests/integration/tasks/assign-email.test.ts`, `reassign.test.ts` | Met as written. QLT-F-01 is a gap the ACs do not cover |
| 09.04 (AQP-351) | key, window, recipients, alerts off | `overdue-scan.ts`, `overdue-repository.ts` | `tests/integration/jobs/overdue-scan*.test.ts` | Met |
| 09.05 (AQP-352) | 11:00 IST, Cc, catch-up (AC-5), per-Engineer isolation (AC-9) | `daily-digest.ts` | `tests/integration/jobs/daily-digest.test.ts` | Met. QLT-F-02 and QLT-F-03 are robustness gaps |
| 09.06 (AQP-353) | 1/5/15 backoff, 4 attempts, skip final, backup-missed | `lib/mail/retry.ts`, `email-outbox-repository.ts`, `backup-watch.ts` | `tests/integration/mail/retries.test.ts`, `no-duplicates.test.ts`, `backup-missed.test.ts` | Met |
| 09.02 (AQP-349) | sender rules, test e-mail, alerts switch | `settings-service.ts`, `lib/settings/validation.ts` | `tests/integration/settings/*` | Met |
| 07.04 to 07.07 (AQP-334 to 336, 364) | refusal in one snapshot, size and time gate, warning notice | `export-service.ts`, `thread-runner.ts` | `tests/integration/export/*` | Met. QLT-F-04 is the client's wording |
| 05.10 (AQP-367) | AC-1 to AC-9 | `use-autosave.ts`, `use-part-form.ts`, `save-gate.ts` | `tests/e2e/estimate-autosave.spec.ts`, `tests/unit/estimate-autosave*.test.ts` | Met. QLT-F-05 is a product-rule suggestion |
| 04.06 (AQP-366) | Lead default, Engineer refusal (422), IST range | `task-service.ts` `filterOf`, `task-repository.ts` `filterWhere`, `lib/tasks/queue-filters.ts` | `tests/integration/tasks/queue-filters.test.ts` | Met. QLT-F-07 is a usability gap |
| 08.05 / 08.07 (AQP-360, 362) | pinning, history filters (who, category, event, from/to) | `config-service.ts`, `audit-service.ts`, `views/schemas/audit.ts` | `tests/integration/config/version-pinning.test.ts`, `tests/unit/config-history.test.ts` | Met |

## Areas covered

- **Mail:**
  - the outbox claim, lease and retry;
  - the overdue scan and the daily digest, with their store SQL;
  - the assignment e-mail and the reassign path;
  - the backup-missed alert;
  - Settings (sender validation, test e-mail);
  - the worker wiring.
- **Export:**
  - the service and its snapshot;
  - the thread gate (places, the large-estimate cap, timeout, release);
  - picture batches, file name, download client and button.
- **Autosave:** the timer, the save gate, the part form's `autosaveField` / `sendAgain` / conflict pause, and the E2E clock test.
- **Tasks:**
  - assign (number sequence, transaction);
  - reassign (lock, closed guard, revision);
  - queue tabs and filters (scope from the session, LIKE escaping, IST range);
  - the bell.
- **Masters integrity:**
  - material and customer delete guards against open estimates;
  - a treatment deleted while a part still holds it;
  - the deleted-master check on unlock and cancel.
- **Access:** route-manifest roles for every `/api/v1` route (export, costs, config, settings and audit are Lead/Admin or Admin only; calculate is Engineer only).
- **Smaller checks:**
  - the version cache;
  - the rate-change diff (06.11);
  - the audit query schema (Who filter, range order);
  - page metadata and robots (10.03);
  - the FR traceability scan.

## Areas not covered (or only lightly)

- **Not re-reviewed:** the stories that already had a combined review (auth, step-up, approval/unlock/cancel/remove, calculation, config edit/insert/delete/revert, hand-over, backup/restore, H-OBS). Their open follow-ups stay as filed.
- **Only lightly:** client components beyond export and autosave (10.07 states, SCR layouts). Responsive, accessibility and performance belong to the other reviewers and to QA.
- **Windows install, update and restore scripts:** not read in this pass.
- **No suites run:** none were executed here, per the brief. The results above come from reading code, not from running it.
- **#523** (the pg "client already executing a query" warning): I looked for concurrent queries on one transaction client (`Promise.all` inside `transactions.run`) and found none. The caller is still unknown and the issue stays open.

## Hand-off

- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final/quality.md`
- Jira / GitHub updates: GitHub #578 (QLT-F-01, Major); AQP-1 hand-off comment
- Open questions: QLT-F-05 changes AC-7 of STORY-05.10 (product-owner to rule)
- Risks raised: none new (QLT-F-01 tracked as #578)
- Recommended next agent: developer, to fix #578 in the hardening window before STORY-09.08's real send. Then master, for the G8 inputs.
