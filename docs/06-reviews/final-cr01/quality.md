# Review Report: final delta review (CR-01 and fixes since 242c21f7): Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 (the §9 item 3 final review completed as a delta review, DL-354 ruling 1) |
| Base…head | `242c21f7` (the first final review, `docs/06-reviews/final/quality.md`) … **H = `1fe1581bb611f1b250c6f0e9ea010b11cb08392b`** (`master` after #663) |
| Scope read | `git diff 242c21f7 1fe1581b -- src prisma scripts .github` (246 files, +8,004 −1,429), every migration added, and the unchanged files the changed code now calls into in a §9 item 2 area (listed under "Areas covered"). Read from a `git archive` of H in my scratchpad, so no worktree was checked out or changed |
| Date | 2026-11-23 |
| **Verdict** | **APPROVE WITH COMMENTS.** No new Blocker, Critical or Major. Three new Minors and five Info items. The one Major I raised at 242c21f7 (QLT-F-01, #578) is fixed at H. The seven Minors of that review (QLT-F-02 to QLT-F-08) are still present, unchanged, and stay on the D7 list (DL-312) |

## Summary

CR-01 holds together end to end, and it is built on the same discipline as the code I reviewed at 242c21f7. I traced the new status lifecycle across every route that changes an estimate:

- DRAFT → PREPARED → APPROVED → QUOTED, plus the Ignored layer.
- Unlock and Cancel from QUOTED.
- Ignore and Restore, with the RFQ fully frozen while Ignored.
- Tree kinds, and reorder among rows with the same parent only.
- The download marker, the customer and subject at assignment, and the renames.

In every write path I traced:

- **One state machine, one place for "locked".** `decideTransition` judges the role first, then the layer, then the status. `isLocked` and `LOCKED_STATUSES` are the only "is it closed" rule. The SQL tab filters and the two mail scans derive from that rule, and a test parses them against it.
- **One lock, one revision.** Mark as quoted, Ignore, Restore, change customer, add, move and delete each take `lockEstimate` (`FOR UPDATE OF e FOR SHARE OF t`). Each makes its decision under that lock and writes its audit entry in the same transaction. A refusal writes nothing.
- **The database backs the code.** `ck_estimates_quoted` makes the status and the quote marker move together. The quote columns are cleared in the same `UPDATE` that leaves QUOTED (`setStatus`). The Ignored columns are all-or-none, and the underlying status is never touched.
- **"Fully frozen" is proven, not just claimed.** `tests/security/ignored-estimate-refusals.test.ts` builds its list of routes from the route manifest. It calls every state-changing estimate or task route, and both export reads, for each role the SPEC allows. Each must answer 409 `ESTIMATE_IGNORED` and write nothing. A route added later fails this test unless it refuses too.
- **NFR-002 holds.** The quote marker is withheld from the Engineer in `getWorkspace`. The download marker service refuses an Engineer before it reads. Every new answer is a strict schema, and the Engineer's views copy fields one by one.
- **The migrations are ordered and reversible.** `ADD VALUE 'QUOTED'` is alone in its file, before the file whose CHECKs name it. Every backfill is deterministic and rewrites nothing that is not empty. Each file carries a rollback note.

The new findings are small. The export page has no state for an ignored estimate: it shows a fault page with a "Try again" that cannot succeed (QLT-C-01). The Engineer's page on a Quoted estimate says "Approved and locked." beside a "Quoted" badge (QLT-C-02). An unlock entry does not record whether the estimate was Approved or Quoted (QLT-C-03).

| Severity | Count (new) |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Info | 5 |

No GitHub issue is opened by this review: nothing is at Major or above (brief, DL-354 (1)). The Minors go on the D7 list (DL-312).

## Checks Run

| Check | Command / source | Result |
|-------|---------|--------|
| Code reading at H | `git diff 242c21f7 1fe1581b -- <path>`, `git archive 1fe1581b` into my scratchpad, then Read and Grep | Done (areas below) |
| Combined reviews on record (evidence, not redone) | `docs/06-reviews/{AQP-384, 385, 390, 391, 398-399, 402, 403, 405, 407, 400, 401, 411}/combined.md`, `AQP-365/combined-568.md` | Read. I read only what changed after each one. The changes that had no combined review were #623 (3B), #652 (DEF-040, DL-340: no combined review needed), #656 (3D), #662 (DEF-075) and #663's delta. I read all of them in full |
| CI at H | `gh run view 45303206514` (CI, push of `1fe1581b`) | **All jobs success.** Unit: 494 files passed, 96.9 % statements. Integration on PostgreSQL: 665 files passed, 96.08 %. E2E at three widths: 570 + 567 + 570 + 552 passed, with no flaky line in the shard logs. Windows package run 45303206593: success |
| Suites run locally | not run | Not run, as the brief says (no tests in a lane worktree, and the records worktree is read-only use). The results above are CI's |
| Accepted test deviations | DL-343 (A) (#653), DL-346 (A) (#656), DL-346 (B) (#662) | Re-checked at H. `estimate-treatments.spec.ts:315-318` still clicks all eight in reverse and asserts `EVERY_TREATMENT_STORED`. The renumber case keeps every "Part renumbered to" assertion and the `[AQP-343 renumber diagnostic]` (`estimate-tree.spec.ts:248`, `:357`, `:369`). The DEF-075 `choose` workaround (`position: {x: 16, y: 10}`) is undone: `estimate-tree.spec.ts:32` presses the centre of the name. No other test was adapted to step around a product fault that I could find |
| Open-issue de-duplication | `gh issue list --state all` | Done. #578 is closed. #382, #626 and #577 are open, as stated below |

## Findings (new)

| ID | Severity | File:line (H) | Rule / FR / AC | Issue | Why it matters | Suggested fix and the test that would catch it |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-C-01 | Minor | `src/app/(portal)/estimates/[code]/export/page.tsx:34`, `:40-45`; `src/server/services/export-service.ts:192` | FR-109; A-CR01-8; DL-304 (2); coding standards §3 (expected errors handled) | **SCR-10 has no state for an ignored estimate.** `getSummary` refuses an ignored estimate with a 409 `ESTIMATE_IGNORED`, which is right. But `summaryOf` turns only `NotFoundError` into a result and rethrows everything else. So the page lands on `export/error.tsx`, "We could not load the export", with a "Try again" that fails the same way every time, and the server logs a fault. SCR-06 hides the Download link while the estimate is ignored, so a Lead gets here only from an open SCR-10 tab, a bookmark, Back, or a refresh after someone else ignored it | An expected business state is shown as a fault, and the person is invited to retry something that cannot work. The 409's own sentence ("This estimate is ignored. Restore it first.") never reaches them. Nothing is written and no file is given, so there is no data effect | Catch `ConflictError` with code `ESTIMATE_IGNORED` in `summaryOf`, and draw a read-only notice in the refusal's words, with a link back to `/estimates/<code>`. Or redirect there. **Test:** a page test (as `tests/unit/http-page-access.test.ts` does for 404) where the basis has `ignoredAt` set: expect the notice and no error boundary |
| QLT-C-02 | Minor | `src/components/features/estimate-workspace/estimate-workspace.tsx:154-159`; `estimate-texts.ts:105-106` | FR-102 ("Every Engineer page ... shows its status: Draft, Prepared, Approved, Quoted"); FR-110 | **On a Quoted estimate the Engineer's page says "Approved and locked." in the notice, beside a "Quoted" badge in the header.** The notice is drawn for `isLocked(status)`, which is right, but its title is the Approved one | One status gets two words on the same page. The Engineer is told "Approved" for an estimate whose quote has already gone to the customer. No figure is shown, so NFR-002 is not affected | Take the notice title from the status: "Quoted and locked." for QUOTED, from one constant beside `APPROVED_LOCKED_TITLE`. ux-expert to confirm the words. **Test:** extend the Engineer case of `tests/integration/estimates/mark-quoted.test.ts:322`, or the workspace markup test, to assert the Quoted wording and no "Approved" |
| QLT-C-03 | Minor | `src/server/services/unlock-service.ts:144-151`; `src/server/services/audit-events.ts:168`, `:570-577` | FR-011, FR-110 ("Unlock on a QUOTED estimate returns DRAFT ... the audit record has the entry"); NFR-007 | **The `approval.unlocked` entry does not record the status the estimate left.** Its `before` is `{approvedPrice}` and its `after` is `{reason}`. SCR-16 therefore shows an unlock from Quoted as "Approved at ₹ … → Unlocked. Reason: …", the same as an unlock from Approved. The sibling `approval.cancelled` entry does keep `status` before and after, and its test at `mark-quoted.test.ts:282` reads QUOTED there. The unlock test at `:269-278` checks only `after.reason` | Someone reading the history cannot tell from the unlock entry that a quote that had gone to the customer was taken back. They have to find the earlier `estimate.quoted` entry and work it out. The two "back to Draft" events of the same estimate are recorded inconsistently | Add `status: z.enum(['APPROVED', 'QUOTED'])` to `unlockedBeforeState`. Give it a read schema that defaults a missing key to `'APPROVED'`, so entries already stored still read (the pattern of `LEGACY_SUBMITTED`, `audit-events.ts:192-200`). Describe it as "Quoted at ₹ …" when it is QUOTED. **Test:** in `mark-quoted.test.ts:269`, expect `before.status === 'QUOTED'`; plus a unit case that a legacy entry without `status` still describes |
| QLT-C-04 | Info | `src/server/services/export-service.ts:242`, `:269`, `:275` | DL-304 (2); architecture §4.6 (one snapshot) | The download checks the Ignored layer in its read snapshot, builds the file (up to `EXPORT_TIMEOUT_SECONDS`, 240 s by default), then records the download in a second, short transaction **without checking the layer again**. An Ignore that commits during the build still lets the file out, and records a download against an estimate that is now ignored | This is consistent with the snapshot design: the file is the estimate as it stood when it was asked for, as with an unlock during a build. No figure is wrong and nothing is corrupted. I record it so the "fully frozen" claim is read precisely | Optional: make `insertDownload` conditional (`INSERT ... SELECT ... FROM estimates WHERE id = $1 AND ignored_at IS NULL`), and refuse 409 when it inserts nothing. Product-manager to say whether it is worth it |
| QLT-C-05 | Info | `src/server/repositories/overdue-repository.ts:110-112` (overdue scan, 24 h window), `:140` (digest) | FR-081, FR-109; D-c | Say a task is Ignored over its deadline and Restored more than 24 hours after it. Its **overdue e-mail is never sent**, because the deadline is outside `[since, now)`. The daily digest does list it from the next day | Probably the intended effect of D-c ("a mail about an old event must not go out late"), but no record says so for Restore | Product-manager to confirm in the PRD (FR-109 or FR-081) that Restore does not re-arm the overdue e-mail. No code change unless the answer is otherwise |
| QLT-C-06 | Info | `src/lib/tasks/queue.ts:25`; `src/server/services/task-service.ts:354`, `:375`; `src/server/services/estimate-service.ts:353-355` | A-CR01-2 ("the one place that says so") | `engineerSeesIgnored()` is the constant `true`. The queue and `getTask` ask it, but `getWorkspace` does not. So if it ever answered `false`, the task route would say "not found" while `/estimates/<code>` still opened the ignored estimate | No effect today, because A-CR01-2 was confirmed and the answer is `true`. A switch that is only half wired is a trap for whoever flips it | Either ask it in `getWorkspace` too, or remove the predicate now that A-CR01-2 is confirmed (DL-337) |
| QLT-C-07 | Info (process) | GitHub labels; DL-312 (3) | DL-312, DL-354 (1) | (a) **The D7 Minors of the first final review (QLT-F-02 to QLT-F-08) have no GitHub issue yet.** `gh issue list --state all` finds none. DL-312 (3) needs one per line at G8 (master opens any that are missing). (b) **The repository has no `final-review` label**: `gh label list` shows none. The brief and DL-354 ask for it on findings at Major or above. None is needed from this review, but the other two reviewers may need it | (a) If no one opens these issues, the G8 list will have lines with no issue. (b) `gh issue create --label final-review` fails while the label does not exist | Orchestrator: open the seven `tech-debt` issues at the freeze (or now), and create the `final-review` label once (`gh label create final-review`) before the first Major is filed |
| QLT-C-08 | Info (good practice) | `src/lib/estimate/state-machine.ts`; `tests/security/ignored-estimate-refusals.test.ts:155-219`; `tests/integration/estimates/{mark-quoted, ignore-restore, quoted-ignored, reorder}.test.ts`; the CR-01 migration tests | — | **Well done, with nothing to fix.** The role → layer → status order is closed by `assertNever`. The per-route refusals are pinned from the manifest, not from a hand-written list. Each new write has tests for lock-wait, two-at-once and "the audit entry fails, so everything rolls back". The migration tests run the rollback and the file from disk, with a cycle and an independent expected walk. The DEF-040 client bound (20 s, which is longer than the server's ~15 s worst case) re-reads the tree and never leaves `busy` set | n/a | n/a |

## Re-check of the open findings of the first final review, against H

| Finding (242c21f7) | Severity | At H | Evidence |
|---|---|---|---|
| QLT-F-01 (#578): assignment rows never expire | Major | **Gone (fixed)** | AQP-385 / DEF-055, #586. `task-mail.ts`: `sendBefore` = written + 24 h; `queueingEnabled()` is the alerts switch **and** `FEATURE_EMAIL`; `withdrawUnsent` expires the old Engineer's unsent rows in the reassign transaction (`task-service.ts:413-422`). Migration `20261121160000_expire_unsent_assignment_mail` expires the rows queued earlier. #578 is closed. The combined review AQP-385 is on record |
| QLT-F-02: digest with no cap | Minor | **Still present** (file unchanged) | `src/server/jobs/daily-digest.ts:114`; `src/server/mail/templates/daily-digest.ts:58`. Ignored tasks are now left out of the digest (`overdue-repository.ts:140`), which helps slightly but does not cap it |
| QLT-F-03: a failed 11:00 digest is not retried | Minor | **Still present** (unchanged) | `src/server/jobs/daily-digest.ts:218` |
| QLT-F-04: the 503 `EXPORT_BUSY` title is thrown away | Minor | **Still present** | `src/lib/export/download-client.ts:68` (`status >= 500 ? null`). The file changed only for the `filename*` reading (AQP-391) |
| QLT-F-05: autosave does nothing while the tab is hidden | Minor | **Still present** (unchanged) | `src/components/features/estimate-workspace/use-autosave.ts:45`. The product-owner's ruling on AC-7 is still pending |
| QLT-F-06: a role change leaves open tasks with a non-Engineer | Minor | **Still present** | `src/server/services/user-service.ts:178` (unchanged); `overdue-repository.ts:107`, `:136` still join on `eng.is_active` and not on the role |
| QLT-F-07: the queue's Engineer filter has active Engineers only | Minor | **Still present** | `src/app/(portal)/queue/page.tsx:62` (the assign context's `engineers`) |
| QLT-F-08: no test pins `inputMode="decimal"` on the part form | Minor (tests) | **Still present** | `field-renderer.tsx:146`. The only `inputmode` assertion is still `tests/e2e/exchange-rates.spec.ts` |
| QLT-F-I1, QLT-F-I2 | Info | Unchanged | — |
| #382 residue (SQR-03, -04, -06, -07) | Minor / Info | **Still present**; #382 is open with its retitled scope | `calculation-service.ts:236` (`nodes` has no `.min(1)`) and the duplicate-only check. Not touched by the delta |

### Combined-review Minors in my area, still open at H (for the D7 list)

| Finding | At H | Evidence |
|---|---|---|
| AQP-403 QLT-01: the move's refusal order (409 `TREE_CHANGED` before 422 `MOVE_ACROSS_PARENTS`) is not pinned | Still present | `estimate-service.ts:439-443`. `reorder.test.ts:155` and `:224` test each refusal alone, and no case sends a stale revision **and** another parent |
| AQP-403 QLT-04: the rollback notes do not say to delete the migration's `_prisma_migrations` row | Still present in 5 of the 8 CR-01-era files | Only `20261123130000_estimate_downloads` has it. `20261122100000`, `20261122110000`, `20261123100000`, `20261123140000` and `20261123160000` do not |
| AQP-405 QLT-05: `treeActionsOffered` is not called by any screen | Still present | `src/lib/estimates/tree-actions.ts:16`. It is cited only in comments (`row-actions.tsx:50`, `tree-panel.tsx:38`). The workspace calls `canEditInputs` directly (`estimate-workspace.tsx:80`), which is the same rule |
| AQP-401 QLT-13 (F4 on a read-only select) | **Gone (fixed in #663)** | `read-only-select.ts:29` has `'F4'` in `VALUE_KEYS` |
| AQP-402 QLT-06 (#626, the SCR-10 chip does not update after a download) | Open, deferral accepted | #626 is open |
| AQP-390 QLT-05 (follow-up) and QLT-08 (backfill on a copy of the demo database) | Open, as recorded there | Process items, not code |

## AC / FR conformance (CR-01 features as they combine)

| FR / rule | Implemented in (H) | Tested by | Result |
|---|---|---|---|
| FR-064: DRAFT → PREPARED → APPROVED → QUOTED; QUOTED unlocks to DRAFT; no "Submitted" anywhere | `state-machine.ts:143-221`; `estimate-repository.ts` `setStatus`; migration `20261123100000` (rename in place) | `tests/unit/estimate/state-machine.test.ts` (240 combinations against an independent table); `estimate-status-prepared-migration.test.ts`; `mark-quoted.test.ts:269` | Met |
| FR-110: Mark as quoted (Lead and Admin), no undo but Unlock, audited | `estimate-status-service.ts:110-133`; route `quoted/route.ts`; manifest row | `mark-quoted.test.ts` (one entry, rollback on audit failure, lock wait, two at once, Engineer 403); E2E `mark-quoted.spec.ts` | Met. QLT-C-03 is about the unlock entry's detail |
| FR-109 and DL-304: Ignore with remarks, Restore, fully frozen, Ignored tab, not in Open, Overdue or the bell | `estimate-status-service.ts:135-193`; `assertEditable` (`estimate-service.ts:173-178`); route-level checks in calculation, cancel, remove price, export, reassign; `tabFilter` (`task-repository.ts:271-283`); the overdue and digest SQL | `ignore-restore.test.ts`; `ignored-estimate-refusals.test.ts`; `ignored-tab.test.ts`; `closed-rule-architecture.test.ts` | Met. QLT-C-01 (SCR-10 page state) and QLT-C-04 (a build in flight) are the edges |
| FR-102: the Engineer sees their own status, and Ignored with remarks, with no cost | `getWorkspace` (marker withheld, `estimate-service.ts:370`); `engineer-task.ts`; `task-service.ts:372-377` | `ignored-estimate-refusals.test.ts:232` (Restricted-value scan); `quoted-restricted.test.ts`; `mark-quoted.test.ts:322` | Met. QLT-C-02 is about the notice's words |
| FR-111: the download marker, for Lead and Admin only; every download logged | `download-repository.ts:71-88`; `download-marker.ts:45-51`; `export-service.ts:275`; `download-marker-service.ts` | `download-log.test.ts`; `download-marker-restricted.test.ts`; E2E `download-marker.spec.ts` | Met. Downloads are in the log and not on the audit screen (DL-300 (6); PRD v0.47 FR-111 says so) |
| FR-043: kinds, allowed children, reorder within the same parent only | `node-kinds.ts:20-39`; `placeForAdd` (`estimate-service.ts:260-267`); `moveNode` (`:433-456`); migration `20261123140000` | `node-kinds.test.ts`; `reorder.test.ts` (10 cases, including two drops at once); `node-kind-migration.test.ts`; `tree-reorder*.test.ts`; `move-handle.test.ts` | Met |
| FR-032, FR-042: customer and subject at assignment; only Lead and Admin change the customer, audited | `task-service.ts:299-344`; `setCustomer` (`estimate-service.ts:375-401`); manifest row `ADMIN_AND_LEAD` | AQP-390 suites; `quoted-ignored.test.ts:194`, `:219` | Met |
| CR-01 item 9: export file name | `lib/export/file-name.ts`; `content-disposition.ts` | `tests/unit/export/file-name.test.ts` | Met (AQP-391 combined review) |
| DEF-040 and DEF-075 (client tree behaviour) | `use-parts-tree.ts:149-218`; `row-actions.tsx:42-58` | `use-parts-tree.test.ts`; `tree-row-actions.test.ts`; E2E `estimate-tree.spec.ts` | Met. QA closed both |

## Areas covered

- **Server, end to end:**
  - `state-machine.ts`, `can-edit-inputs.ts`, `task-status.ts`, `task-state.ts`;
  - `estimate-status-service.ts`, `estimate-service.ts` (assert, transition, customer, add, move, delete), `unlock-service.ts`, `cancel-approval-service.ts`, `remove-price-service.ts`, `approval-service.ts`, `calculation-service.ts` (lock path), `rate-changes.ts`, `export-service.ts`, `download-marker-service.ts`, `task-service.ts`, `task-mail.ts`;
  - `audit-service.ts` (`recordMany`), `audit-events.ts`, `default-propagation-*`;
  - the repositories for estimate, task, download, overdue, customer, material, estimate-use, export and estimate-node;
  - the new routes (`quoted`, `ignore`, `restore`, `download-markers`, `customer`, `tree/move`), `route-manifest.ts` and the schemas (`estimates`, `tasks`, `tree`, `download-marker`).
- **Migrations:** all eight added since 242c21f7. I checked their order, the `ADD VALUE` isolation, the backfills (deterministic, nothing overwritten), the CHECKs, the grants and triggers, and the rollback notes.
- **§9 item 2 areas, including unchanged callees:**
  - Engineer cost visibility: `page.tsx`'s role branch, `review-page.tsx`, `engineer-task.ts`, the queue's marker branch;
  - approval and step-up: unlock, cancel and remove price under the Ignored check;
  - authentication: `proxy.ts`, `public-path.ts`, `session.ts` and the `layout.tsx` nonce, which AQP-384 had already reviewed;
  - data integrity: the lock order (`lockEstimate`, `findTaskForUpdate`, customer `FOR SHARE`), and the conditional `UPDATE`s.
- **Client:** `use-parts-tree.ts`, `tree-reorder.ts`, `move-handle*.tsx`, `move-menu.tsx`, `row-actions.tsx`, `tree-panel.tsx`, `tree-moves.ts`, `estimate-workspace.tsx`, `estimate-review.tsx`, `review-actions.tsx`, `queue-screen.tsx`, `download-markers-client.ts`, `read-only-select.ts`, `field-renderer.tsx`.
- **Scripts:** `seed-lighthouse-data.ts` refuses any database that is not a throwaway one (`assertThrowawayDatabase`).

## Areas not covered (or only lightly)

- **Not re-reviewed:** code that is unchanged since 242c21f7 and outside the callee rule (DL-354 (1)). Also the parts that the combined reviews on record covered before their final commits.
- **Light:** CSS and compact-layout changes (#600), the rename sweep (#599), `nightly.yml` and the sweep and TLS scripts (#588, #593). Responsive layout, accessibility, performance and the first-load budget belong to the other reviewers and to QA.
- **No suites run locally:** see Checks Run. CI at H is the evidence.

## Issues for other roles

- **developer (hardening window, idle lanes only):** QLT-C-01, QLT-C-02 and QLT-C-03. Each is a small change plus one test.
- **ux-expert:** the words of the Engineer's Quoted notice (QLT-C-02), and of the SCR-10 ignored state (QLT-C-01).
- **product-manager:** QLT-C-04 (is a download already in flight when the estimate is ignored acceptable?) and QLT-C-05 (Restore does not re-arm the overdue e-mail).
- **orchestrator:** QLT-C-07. Open the D7 issues for QLT-F-02 to QLT-F-08 and the combined-review Minors above, and create the `final-review` label.
- **solution-architect:** AQP-403 QLT-04. Add the `_prisma_migrations` step to the general rollback rule in architecture §5.6.

## Hand-off

- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final-cr01/quality.md`
- Jira / GitHub updates: no GitHub issue (no finding at Major or above). AQP-1 hand-off comment
- Open questions: QLT-C-04 and QLT-C-05 (product-manager). QLT-F-05 still waits for the product-owner's ruling on AC-7
- Risks raised: none
- Recommended next agent: orchestrator. Compile `consolidated.md` with the other two reviews, and give QLT-C-01 to QLT-C-03 to idle lanes after any Major or above from the other reviewers
