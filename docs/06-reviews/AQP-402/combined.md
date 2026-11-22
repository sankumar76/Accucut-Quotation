# Combined security-and-quality review: AQP-402 (CR-01 item 7c "Download log and marker")

| Item | Value |
|---|---|
| PR | https://github.com/sankumar76/Accucut-Quotation/pull/622 (draft) |
| Head reviewed | `ef8683f64d0f8cc450180bd02bf25680931bcbe7` on `feat/AQP-402-download-marker` (master merged in, including AQP-391). Diff `git diff origin/master...origin/feat/AQP-402-download-marker`: 59 files, +1,903 / -60 |
| CI | Run 45035160359 on `ef8683f6` **succeeded**. All six jobs passed: "Stages 1 to 11b", "Stages 1 to 11", and E2E shards 1 to 4 (526, 547, 541 and 543 passed; none failed and none were flaky). The new `tests/e2e/download-marker.spec.ts` passed at all three widths. Its two `test.slow()` tests took 15.0 to 26.2 s |
| Review type | One combined security-and-quality review (CLAUDE.md §9 item 2, label `critical-review`). Three things make it critical: NFR-002 (the marker must never reach an Engineer), a new write in the export path, and a new append-only table |
| Reviewer | reviewer-quality (Principal Engineer) |
| Date | 2026-11-22 |
| **Verdict** | **REQUEST CHANGES, on one Major in a test only.** I found no Blocker or Critical. The production code is correct and safe. The migration only adds objects. Its grants and triggers are right. DL-302 condition (a) holds. NFR-002 holds at the schema, the route manifest, the route, the service and the page. The marker rule matches DL-300. The one Major (QLT-01) is that the existing approvals grants test no longer proves `trg_approvals_forbid_truncate`. It is a one-line test fix. Under §9 item 2 the merge gate is "no open Blocker or Critical", so this Major does not block the merge on its own. I recommend fixing it before merge (about 10 minutes); otherwise it must be fixed in the hardening window before G8 (§9 item 3) |
| Counts | Blocker 0 · Critical 0 · Major 1 · Minor 6 · Info 6 |

## How I read it

- **Records:** Jira AQP-402: AC-1 to AC-8, Dev Context, Testing Notes, Dependencies. The PR #622 body: Dev Record, deviations 1 to 8, NFR-002 evidence. From `origin/docs/AQP-1-records-u`: architecture v0.61 §4.12 b, d, f and g, and decision log DL-300 (rulings 3 and 6) and DL-302 (the 7E build condition).
- **Code read at the head:** the migration and `schema.prisma`; `download-repository.ts`, `download-marker.ts`, `download-marker-view.ts` and `download-markers-client.ts`; `download-marker-service.ts`, all of `export-service.ts` (`getSummary`, `getFile`) and `composition.ts`. Also the route, `route-manifest.ts`, the `withRoute` order of checks, `views/schemas/download-marker.ts` and `export.ts`, and the chip and its texts. On the screens: `estimate-export.tsx`, `estimate-review.tsx`, `workspace-header.tsx`, `review-page.tsx`, `estimates/[code]/page.tsx` (the role switch), `queue/page.tsx`, `queue-screen.tsx` and `queue-list.tsx`.
- **Existing code checked against the change:**
  - `findLatestApproval` takes the latest row and answers `null` when its price was removed. `approvedPriceOf` gives `null` for a cancelled approval.
  - `forbid_immutable_change` raises an error for every operation.
  - Nothing in `src`, `scripts` or `deploy` deletes from `estimates`, `calculations`, `approvals` or `users`, so the new `NO ACTION` foreign keys break no existing path. The only test-side `DELETE FROM estimates` is in `tests/support/overdue-world.ts`, and that world records no downloads.
- **Tests read:**
  - In full: `download-log.test.ts` (integration), `download-marker-restricted.test.ts` (security), the edited part of `grants.test.ts`, the new cases in `export-route.test.ts` and `estimate-review-screen.test.ts`, the E2E spec, and the `summaryWithoutMarker` helper with its two callers.
  - The test-case lists of `download-marker.test.ts` and `export-service.test.ts`.
- **Run by me** in the developer's worktree at `ef8683f6` (clean tree; read-only): `npx vitest run` on 12 files, the 7 new or changed unit files plus the 5 security files (download-marker-restricted, engineer-import-rule, role-matrix, strict-schema, engineer-refused-before-lookup). Result: **12 files and 2,529 tests passed** in 11.9 s. I did not run the PostgreSQL integration suite locally (no database here, and CI ran it). CI "Stages 1 to 11b" passed it on this head.

## Security and correctness checks

| # | Focus point | Result | Evidence |
|---|---|---|---|
| 1a | Migration only adds objects; foreign keys | **Pass** | One table, one index and four FKs (`estimates`, `calculations`, `approvals`, `users`; all `NO ACTION`), plus two triggers and the grants. No existing object is altered. `prisma migrate diff` is empty (Dev Record, CI stage 7). |
| 1b | Grants: SELECT and INSERT only | **Pass** | `REVOKE UPDATE, DELETE, TRUNCATE` and then `GRANT SELECT, INSERT` to `accucut_app`, so a later change to the default privileges cannot widen it. Tested at table level and for column UPDATE (`download-log.test.ts:54-68`). |
| 1c | Triggers refuse UPDATE, DELETE and TRUNCATE for every role | **Pass** | A row trigger (BEFORE UPDATE OR DELETE) and a statement trigger (BEFORE TRUNCATE) both call `forbid_immutable_change`. The runtime role is refused with 42501 and the owner with 23000 "immutable", for 3 UPDATEs, DELETE and TRUNCATE (`download-log.test.ts:70-93`). |
| 1d | Rollback note | **Pass, with Minor QLT-05** | `DROP TABLE "estimate_downloads"` is there with the consequence (history lost, marker reads "Not downloaded"). It does not say to mark the migration rolled back in `_prisma_migrations`. |
| 1e | The edited grants test (`TRUNCATE approvals, estimate_downloads`) | **Weakened: Major QLT-01** | The regex `(approvals\|estimate_downloads)` lets the new table's trigger satisfy the test. No other test checks `trg_approvals_forbid_truncate` (searched `tests/` for the trigger name and `pg_trigger`). |
| 2a | DL-302 (a): insert after the build and before the bytes, in the same request | **Pass** | `getFile`: (1) reads in a snapshot transaction; (2) builds outside any transaction and frees the place in a `finally`; (3) parses the file; (4) runs `transactions.run(insertDownload)`; (5) only then `return file`. The route sends bytes only after `getFile` resolves. |
| 2b | A failed insert gives 500 with no file and no leaked text | **Pass** | A non-`AppError` goes to `internalProblem` in `withRoute`, which logs it on the server only. `export-route.test.ts`: 500, no `Content-Disposition`, `problem+json`, body not `PK…`, message not echoed. |
| 2c | Refused or failed downloads write nothing | **Pass** | The 403, 404 and 409 refusals throw inside or before the snapshot, so no insert runs. A build failure or `ExportBusyError` throws before the insert. Covered by unit tests (409, 404, 403, build failure, summary) and integration tests (never calculated, Engineer, unknown estimate, out of date). |
| 2d | Transaction boundaries | **Pass** | The read snapshot is unchanged. The write is a short transaction of its own, so a build of up to 120 s stays outside the 10 s transaction limit (ADR-012). The approval recorded is the one read in the snapshot, which is the price that went into the file even if someone approves again during the build. That case then correctly reads "changed". |
| 3a | Marker in no Engineer-reachable schema | **Pass** | The field is only in `exportSummarySchema` (route Admin and Lead) and `downloadMarkersSchema` (route Admin and Lead). The security test walks 12 Engineer-reachable schemas through `z.toJSONSchema` and finds no download keys. All schemas are strict. |
| 3b | `GET /api/v1/download-markers`: Lead and Admin in the manifest **and** in the service; the Engineer refused before the query is read | **Pass** | Manifest row `ADMIN_AND_LEAD`. `withRoute` checks the role (step 3) before `parseInput(query)` (step 4). `assertMayRead` refuses `ENGINEER` by name, closed by `assertNever`, before any read, with a unit test that nothing is read. Role-matrix, strict-schema, csrf and refused-before-lookup rows were added. E2E: an Engineer gets 403. |
| 3c | Validation of `ids` | **Pass** | Strict query object. The string is capped at 200 × 37 characters, split on commas, each ID must be a `z.uuid()`, and there must be 1 to 200 of them, else 422 before any lookup. The repository de-duplicates, filters again and slices to 200. The SQL takes a bound `uuid[]` parameter (tagged template), so there is no injection. |
| 3d | IDOR beyond the role's scope | **Pass** | A Lead and an Admin already read every estimate's export (manifest `ADMIN_AND_LEAD`, no ownership rule), and the Closed tab lists any assigner's tasks (`assignedBy=anyone`). The answer has a count, a name and an instant; no price and no estimate ID. |
| 3e | Import rules | **Pass** | `engineer-import-rule.test.ts` blocks the repository and the service for Engineer views. `download-marker-restricted.test.ts` lists the only files allowed to import the chip, the view, the client, the repository, the service and `getDownloadMarkerService`. SCR-05's folder imports none. See Info QLT-13 for the Engineer's queue bundle. |
| 4 | Marker rule and deviation 2 | **Correct against DL-300 ruling 3; Info QLT-08** | See "The marker rule" below. |
| 5 | Deviations 4 to 7 | See QLT-01, QLT-04, QLT-09 and QLT-10 | |
| 6 | Tests: none deleted or weakened; the config tests; the slow-test budget | **One weakened (QLT-01); the rest justified** | No test file or case was deleted. The two config tests are justified (QLT-12), and so is the slow-test budget (QLT-11). |

### The marker rule (focus 4)

`downloadMarkerOf` returns `changed` exactly when `last.approvalId !== latestApprovalId`. Both sides are "the estimate's latest approval while it stands, else `null`":

- **The file's side** is `approvalInFileOf(findLatestApproval(...))`. `findLatestApproval` gives `null` when the latest row's price was removed, and `approvedPriceOf` gives `null` when it was cancelled.
- **The marker's side** is the LATERAL query. It takes the latest row by `approved_at DESC, id DESC`, then keeps it only if `removed_at IS NULL AND cancelled_at IS NULL`. It does not fall back to an earlier row, which matches the "an earlier row never comes back" rule (architecture v0.52).

I checked these cases against DL-300 (3), "the current approval is not the approval of the last downloaded file; a file downloaded before any approval counts as no approval; Mark as quoted alone does not change it":

| Sequence | Developer's result | DL-300 (3) | Architecture §4.12 d text ("an approval exists and differs") |
|---|---|---|---|
| Download without approval, never approved | Downloaded | Downloaded | Downloaded |
| Download without approval, then first approval | **Changed** | Changed | Changed |
| Download A, unlock only (D-29, A's price stays in the file) | Downloaded | Downloaded | Downloaded |
| Download A, unlock, approve B | **Changed** | Changed | Changed |
| Download A, A cancelled (no approval now) | **Changed** | Changed (none ≠ A) | Downloaded (no approval "exists"), which is wrong for the PM ruling: the customer holds a cancelled price |
| Download A, A cancelled and its price removed | **Changed** | Changed | Downloaded, wrong as above |
| Download after a cancel (file has no price), no new approval | Downloaded | Downloaded | Downloaded |
| Mark as quoted | No input | No input | No input |

**Deviation 2 is correct.** Recording `findLatestApproval`'s raw row, as AC-2 and §4.12 b word it, would put a cancelled approval's ID on a file that holds no price in BO2. The design's own condition ("an approval exists") would then show a stale file as "Downloaded". The developer's reading follows DL-300 and the words "the approval … that went into the file" in AC-2. The architecture and AC-2 wording should follow it (Info QLT-08, Issues for other roles). The only gap is a test: the SQL half of the cancel and remove path is not exercised over real rows (Minor QLT-02).

## AC conformance

| AC | Implemented in | Tested by | Result |
|---|---|---|---|
| AC-1 table, grants, trigger, index, `migrate diff` empty | `20261123130000_estimate_downloads/migration.sql`, `schema.prisma` | `download-log.test.ts` (grants, column grants, UPDATE/DELETE/TRUNCATE as runtime and owner, index plans); CI `migrate diff --exit-code` | **Met** (QLT-01 is about the existing approvals test, not this table) |
| AC-2 row before the bytes; failed insert gives 500 and no file; content and name unchanged | `export-service.getFile` | `export-service.test.ts` (order, insert fails, place released); `export-route.test.ts` (500, no attachment, no bytes, no leak); `download-log.test.ts` (row with calculation and approval IDs) | **Met.** The recorded approval is the one that stands (deviation 2, correct) |
| AC-3 refused download writes nothing | same | unit (409, 404, 403, build failure, summary); integration (never calculated, Engineer, unknown, out of date). The "Ignored" refusal arrives with 7B/7D | **Met** for this story's scope |
| AC-4 marker rule | `src/lib/export/download-marker.ts` | `download-marker.test.ts` (8 cases including cancelled, quoted not an input); integration (first approval after download, approve again, unlock alone) | **Met** (QLT-02: SQL cancel path untested) |
| AC-5 one chip; Closed tab in one LATERAL statement, ≤ 200, both indexes; quote dialog | `download-chip.tsx`, `download-repository.ts`, `GET /api/v1/download-markers`; SCR-10, SCR-06 header, Closed tab | `download-chip.test.ts`, route and service unit tests, `estimate-review-screen.test.ts`; integration (several tasks, 200 cap, index plans); E2E | **Met.** The quote-dialog chip goes to 7C, as AC-5 allows (QLT-09). Closed-tab markers come from a separate route instead of `task-queue.ts` (deviation 1), which is stronger for NFR-002 |
| AC-6 NFR-002 | schemas, manifest, service guard, import rules | `download-marker-restricted.test.ts`, `engineer-import-rule.test.ts`, role-matrix, strict-schema, refused-before-lookup; E2E Engineer pages and route 403; CI cost-confidentiality scan | **Met** |
| AC-7 words and icon, contrast, axe, wraps at 360/768/1366 | chip (`warn` tone + `TriangleAlert` + text; `flex-wrap`, `BREAK_LONG_NAMES`) | `download-marker.spec.ts` (axe, no horizontal overflow, icon count) in CI at 3 widths | **Met** (CI green) |
| AC-8 download, unlock, approve again gives amber; N downloads give "Downloaded N×" | marker rule | integration whole sequence; E2E "Downloaded 2×" | **Met** |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|---|---|---|---|---|---|---|
| QLT-01 | **Major** | `tests/integration/approval/grants.test.ts:104,107` | Test adequacy; "do not remove or weaken tests" (CLAUDE.md global §5); approvals AC-3 (STORY-06.06) | The TRUNCATE row now accepts `Table "(approvals\|estimate_downloads)" is immutable`. If `trg_approvals_forbid_truncate` were dropped or disabled, `estimate_downloads`' own trigger would still raise and the test would pass. No other test checks the approvals TRUNCATE trigger (searched `tests/` for the trigger name and `pg_trigger`). | The approvals table holds approved prices. The guard against an owner-level TRUNCATE wiping them loses its only regression test. | PostgreSQL fires BEFORE TRUNCATE statement triggers in the order the tables are listed, after the FK check passes, so with `approvals` named first the error is deterministic. Pin the regex to `approvals`: `['TRUNCATE', 'TRUNCATE approvals, estimate_downloads', 'approvals']`. Optionally also assert from `pg_trigger` that `trg_approvals_forbid_truncate` exists, is enabled (`tgenabled = 'O'`) and calls `forbid_immutable_change`, as `aqp-97-config-versions.test.ts:263` does. **Test that would catch it:** the pinned assertion fails if the approvals trigger is missing. |
| QLT-02 | Minor | `tests/integration/export/download-log.test.ts:146-201`; `src/server/repositories/download-repository.ts:80` | AC-4; deviation 2 | The SQL filter `s."removed_at" IS NULL AND s."cancelled_at" IS NULL` (the marker's side of deviation 2) has no integration test. The cancel case is tested only in the pure function and in the service with a fake approval. The PR's claim that "the two sides cannot disagree" is true by inspection but not shown over real rows. | A later edit to the LATERAL query (for example a `WHERE cancelled_at IS NULL` moved inside the inner `ORDER BY … LIMIT 1`, which would fall back to an earlier row) would go unnoticed. Downloads would then read "Downloaded" or "changed" wrongly forever after a cancel. | Add one integration case: download with approval A, then cancel A through the cancel service, and expect `changed`. Download again, and expect a row with `approval_id = null` and the marker `downloaded`, count 2. If cheap, also remove the price and expect `changed` before the second download. |
| QLT-03 | Minor | `src/app/(portal)/estimates/[code]/review-page.tsx:30` | Consistency of error handling (coding standards §3) | `Promise.all([getCosts, getMarker])`: if the marker read fails (a database fault), the whole SCR-06 review shows the error page. On the Closed tab the same failure is shown as "Download status unavailable." | A fault in a non-essential chip takes away the Lead's whole review page (figures, Approve, Unlock). | Read the marker with its own catch, as `queue/page.tsx` does, and pass `'unavailable'` to the header so it draws the same "Download status unavailable." words. Or record that a full-page error is intended. Test: a unit test of `renderReview` with a rejecting marker service still renders the costs. |
| QLT-04 | Minor | `src/app/(portal)/queue/page.tsx:36` | Coding standards §3 / global §3 "no silently swallowed errors" | `closedMarkers` uses `catch { return 'unavailable'; }` with no log. The browser path behaves the same way, but that one goes through a route that logs 5xx. | A broken marker query on the server side of the Closed tab is invisible in the logs. The rows only say "unavailable". | `catch (error) { logger.error({ route: '/queue', ...describeFailure(error) }, 'download markers could not be read'); return 'unavailable'; }`, using the same helpers as `withRoute`. Test: a unit test asserts `logger.error` is called once on a rejecting service. |
| QLT-05 | Minor | `prisma/migrations/20261123130000_estimate_downloads/migration.sql:5-6` | Migration conventions (global §7: rollback) | The rollback note gives `DROP TABLE` but not `npx prisma migrate resolve --rolled-back 20261123130000_estimate_downloads`. Without it, the next `migrate deploy` sees a recorded migration whose table is gone. This is the same point as AQP-403 QLT-04. | An operator following the note leaves `_prisma_migrations` out of step, and the next deploy or `migrate diff` misbehaves. | Add the `migrate resolve --rolled-back` line, and note that the FKs also go with the table. No test; this is documentation. |
| QLT-06 | Minor | `src/components/features/estimate-export/estimate-export.tsx:365` (deviation 5) | AC-5 / AC-8 (UX: the chip says what was downloaded) | SCR-10's chip shows the log as it was when the page was drawn. After the Lead presses Download on SCR-10, the chip beside the button still says "Not downloaded" (or the old count) until the page is reloaded. `router.refresh()` was avoided because of DEF-036. | A Lead may think the download did not register and download again, which inflates the count. This is a visible inconsistency on the one screen where the download happens. | Lowest-risk option: after a successful download, `DownloadButton` sets a small client flag and the page shows a one-line status, "Downloaded just now; the count updates when the page is opened again". The other option is a lightweight re-read of `GET export-summary` on success to redraw only the chip. Or accept it as documented and open a `follow-up` issue for the hardening window. Test: a unit test of the button's success path. |
| QLT-07 | Minor | PR #622 body, "Known limitations" | Architecture §10 rule "`/estimates/[code]` first load" (ADR-016) | The PR says the `/estimates/[code]` first-load figure "is posted below once CI has run". CI has run (the js-budget tests pass), but no figure is posted yet. | Each PR must state the route's figure, and the route has very little headroom (ADR-016). Cross-reference: reviewer-performance. | Post the figure from run 45035160359's `js-budget` log as a PR comment. |
| QLT-08 | Info | `src/server/services/export-service.ts:159`; `src/lib/export/download-marker.ts:50` | DL-300 (3); AC-2; architecture §4.12 b, d | **Deviation 2 is correct** (see "The marker rule"). The architecture text "when an approval exists and its ID differs" and AC-2's "`findLatestApproval` at that moment" would both misread a cancelled approval. | Documentation drift only. | Solution-architect: reword §4.12 d bullet 2 and the `estimate_downloads` row in §4.12 b to "the approval that stands (latest, not cancelled, price not removed), else none". Product-owner: align AC-2. |
| QLT-09 | Info | — (deviation 6) | AC-5 | The quote-dialog chip is left to 7C (AQP-400), as AC-5 and §4.12 h allow ("whichever merges second", about 0.1 d). | It could be forgotten. | Orchestrator: note on AQP-400 that `<DownloadChip marker={…} />` and an `IMPORTERS` entry in `download-marker-restricted.test.ts` are due in 7C, since 7E merges first. |
| QLT-10 | Info | `tests/integration/export/download-log.test.ts` and helpers (deviation 7) | AQP-398 (7A) | Tests here use `SUBMITTED`. If 7A (PR #620) merges first, the rename is mechanical. Migration order: 7A's migrations may carry earlier stamps than `20261123130000`. That is harmless here because this table does not depend on them and nothing is deployed before G8, but whichever PR merges second should re-run `migrate diff`. | A small merge cost. | None now. |
| QLT-11 | Info | `tests/e2e/download-marker.spec.ts:56,84` | Test strategy (timeouts); §9 | `test.slow()` on the two long journeys. This is a new spec, not a defect fix, so the "no budget change" constraint for defect fixes does not apply. It is per test, with a stated reason, and there is precedent (`estimate-fasteners.spec.ts`, `estimate-form.spec.ts`). CI measured 15.0 to 26.2 s against the 30 s default, so headroom without it would be about 4 s on the slowest shard. | Acceptable. | Put the measured figures (run 45035160359) in the two comments, as the precedents do. |
| QLT-12 | Info | `tests/integration/config/checkpoints-estimates.test.ts`, `version-pinning.test.ts`; `tests/support/approved-world.ts:87-93` | "Do not weaken tests" | The two config tests now compare the SCR-10 summary without `download`. **Justified:** `exportCellsOf` calls `getFile`, which is now a recorded download, so the marker changes between "before" and "after" by design. The marker is log data, not estimate data. Every figure, column, cell and warning is still compared, which is what those ACs (revert or version change leaves estimate data unchanged) protect. | None. | None. |
| QLT-13 | Info | `src/components/features/queues/queue-list.tsx`, `queue-screen.tsx` | NFR-002 | The queue screen is shared, so the chip, its words and `download-markers-client` are in the Engineer's queue JS bundle. No marker data reaches an Engineer: the server page and `markersOf` gate on `manager`, and the route refuses with 403. E2E checks the Engineer's DOM. | No cost or marker data is exposed, only component code. | None. If wanted later, load the chip lazily for managers. |

## Developer's deviations: my reading

1. **Separate markers route instead of a field in `GET /api/v1/tasks`:** agreed. One static, strict output schema for every role means a field there would sit in the Engineer's schema. The route is stronger for NFR-002. The cost is one more small request on a Closed-tab load (cross-reference reviewer-performance).
2. **Recorded approval = the approval that stands:** correct against DL-300 (QLT-08). Test gap: QLT-02.
3. **No audit event:** matches DL-300 (6) and DL-302.
4. **Grants test edit:** the reason (FK check before triggers) is right, but the assertion is too loose (QLT-01).
5. **SCR-10 chip not refreshed:** QLT-06.
6. **Quote-dialog chip to 7C:** allowed (QLT-09).
7. **`SUBMITTED` in tests:** QLT-10.
8. **Chip on SCR-06 for every status:** matches UX row 7c.

## Issues for other roles

- **solution-architect:** §4.12 b (`estimate_downloads.approval_id` "from `findLatestApproval`") and §4.12 d (bullet "when an approval exists and its ID differs") should say "the approval that stands, else none", as built and as DL-300 (3) requires (QLT-08). Optionally add the `migrate resolve --rolled-back` step to the §4.12 b rollback list (QLT-05).
- **product-owner:** AQP-402 AC-2 wording, as above.
- **orchestrator:** AQP-400 (7C) carries the quote-dialog chip (QLT-09).
- **reviewer-performance (final review):** the extra marker request after each Closed-tab page load (sequential after the page fetch), and the `/estimates/[code]` first-load figure (QLT-07).

## Tooling gaps

- The chrome-devtools and playwright MCP servers failed to connect, so I did no live UI check. AC-7 rests on CI's E2E at three widths.
- No local PostgreSQL, so the integration suite was not run by me. CI "Stages 1 to 11b" passed it on `ef8683f6`.

---

## Addendum: re-review round 2 (head `4bc8dbdd`, 2026-11-22)

| Item | Value |
|---|---|
| Head reviewed | `4bc8dbdd82fdfef352ccc3e73915ab308318aec4`. Since `ef8683f6` there are two commits: `500ae74d`, which merges `origin/master` 5b006268 (not reviewed: master's own content), and `4bc8dbdd`, "fix(export): review findings QLT-01 to QLT-05" (14 files, +130 / -22, reviewed in full) |
| CI | Run 45038764977 on `4bc8dbdd` **succeeded**: Stages 1 to 11b, Stages 1 to 11, and E2E shards 1 to 4 |
| Run by me | `npx vitest run` on 10 unit and security files in the developer's worktree at `4bc8dbdd` (clean tree; read-only): **10 files, 1,881 tests passed**. These were download-chip, estimate-page, estimate-review-screen, download-marker, download-markers-route, download-marker-service, export-service, export-route, download-marker-restricted and engineer-import-rule. I did not run the integration tests locally (no database here); CI passed them |
| **Verdict** | **APPROVE WITH COMMENTS.** QLT-01 to QLT-05 and QLT-07 are fixed. I accept the deferral of QLT-06 to follow-up #626. QLT-08 is resolved by architecture v0.62. The new diff raises no Blocker, Critical, Major or Minor. |
| Counts (open) | Blocker 0 · Critical 0 · Major 0 · Minor 1 (QLT-06, deferred to #626) · Info 7 (QLT-09 to QLT-13, plus QLT-14 and QLT-15 below) |

### Prior findings

| ID | Prior severity | Status | Note |
|---|---|---|---|
| QLT-01 | Major | **Fixed** | `grants.test.ts` now expects `stringContaining('Table "approvals" is immutable: TRUNCATE is not allowed')` for `TRUNCATE approvals, estimate_downloads`. With `approvals` listed first, a missing approvals trigger would let `estimate_downloads`' trigger answer with its own table name, and the test would fail. That is exactly the regression the test must catch. The new table's own trigger stays proved in `download-log.test.ts`. |
| QLT-02 | Minor | **Fixed** | Four integration cases cover the marker SQL over real rows: download then cancel gives `changed`; a download after the cancel records `approval_id = null` and gives `downloaded`; cancel then price removed gives `changed` with no earlier row coming back; and the Closed tab's by-task statement gives `changed`. The cancel and removal are written as owner UPDATEs of the columns the services set, because the services need a step-up. That is enough here, since the SQL under test reads those columns. |
| QLT-03 | Minor | **Fixed** | `review-page.tsx` `markerOf` catches the marker read alone and returns `'unavailable'`. `DownloadChip` accepts `'unavailable'` and draws "Download status unavailable." with no badge and no state. The text moved to `download-chip-texts.ts`, so the Closed tab and SCR-06 say the same words. `estimate-page.test.ts`: a rejecting marker service still renders the review with the code and never "Not downloaded"; the Engineer's page holds none of the marker words. |
| QLT-04 | Minor | **Fixed** | Both catches log `{ errorName, errorCode }` at `warn` and never the cause, so no host name or task ID appears. The test asserts that the invented host never appears in the logged arguments. |
| QLT-05 | Minor | **Fixed (my suggestion was wrong)** | The note now runs `DROP TABLE` and `DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261123130000_estimate_downloads'` in one transaction, then `migrate status`. This follows architecture v0.62 §5.6 case 2. I had suggested `migrate resolve --rolled-back`, but that only applies to a failed migration (P3009); Prisma does not mark an applied migration rolled back that way. The developer's note is right. |
| QLT-06 | Minor | **Deferral accepted** | Follow-up #626 is open, labelled `follow-up` and `ai-delivery`. Reasons: (1) it is a Minor, and §9 item 3 requires only Blocker, Critical and Major to be fixed before G8; (2) the chip never shows wrong data, only data as of when the page was opened; (3) the clean fixes need either `router.refresh()`, whose browser noise is DEF-036, or a client wrapper, which is a design choice for the hardening window. The final full review should re-check #626. |
| QLT-07 | Minor | **Fixed** | PR body, from run 45038764977's js-budget log: `/estimates/[code]` 182,452 B (headroom 17,548); `/estimates/[code]/export` 169,609 B (headroom 30,391); `/queue` 191,330 B (headroom 8,670). Under 9 KB of headroom on `/queue` is worth watching (cross-reference reviewer-performance). |
| QLT-08 | Info | **Resolved** | Architecture v0.62 §4.12 b and d now say "the approval that stands" (commit `a71f32d8` on records-u). The product-owner still aligns AQP-402 AC-2's wording. |
| QLT-09 to QLT-13 | Info | Unchanged | QLT-12: `summaryWithoutMarker` now replaces `download` with `null` instead of omitting it. The meaning is the same, and every other field is still compared. |

### New diff: notes

| ID | Severity | File:line | Note |
|---|---|---|---|
| QLT-14 | Info | `src/app/(portal)/estimates/[code]/review-page.tsx` (`markerOf`), `src/app/(portal)/queue/page.tsx` (`closedMarkers`) | The catch-all also turns a `NotFoundError` or `ForbiddenError` into `'unavailable'`. No caller is exposed: SCR-06's `getCosts` throws first for a missing estimate, the page's role switch never sends an Engineer here, and the queue page asks only for a manager. Faults are logged at `warn`, not `error`. That is acceptable for a degraded, non-essential chip, but whoever owns the alerting should know a database fault here does not log at `error`. |
| QLT-15 | Info | `tests/security/download-marker-restricted.test.ts` | The import guard now lists `review-page.tsx` as an importer of `download-marker-view`. That is correct: the file is loaded only on the Lead and Admin branch of `estimates/[code]/page.tsx`. |
