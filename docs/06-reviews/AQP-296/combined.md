# Review Report — AQP-296 (STORY-04.04) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`, NFR-002) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-296-own-work-status-2` (PR #389, a re-cut of #387 under DL-212) |
| Commit reviewed | 05b0eab (base master 7d369e6) |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE WITH COMMENTS.** No Blocker or Critical findings, and the security side is clean. There is one Major, SQR-01 (assumption A-1). It is a wording conflict between the story, the G3-approved UX spec and AQP-297, not a code defect. It needs a ruling from the product-owner and the ux-expert. Land the chosen wording before the squash if the answer comes in time; otherwise before 04.05 starts, or in hardening. It is not waived. Two small Minors (SQR-02, SQR-03) are recommended before the squash. |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/389#pullrequestreview-5905072437 |
| PR label | `review:quality-approved` |

## Summary

The story adds one status badge shared by every surface and every role, a pure wording function over `estimates.status`, and `GET /api/v1/tasks/{id}`. The route has one strict schema for every role.

**What I verified on the security side:**
- **Scope.** It comes from the session (`scopeOf(viewer)`, an exhaustive switch). `findTask` puts `id AND engineerId` into one `findFirst`, so another Engineer's row is never read.
- **Uniform 404.** A task ID or viewer ID that is not a UUID returns null before any SQL runs. Null becomes `NotFoundError`, which gives one uniform 404. The 404 bodies for another Engineer's task, an unknown ID and a non-UUID are compared, apart from `requestId`, in the unit and E2E tests; the integration test checks the same three cases (plus an empty ID) are null on PostgreSQL.
- **Fields.** The eleven fields contain no rate, cost, formula value, amount, approver or reason. Both new schemas are `z.strictObject`, and `withRoute` re-parses the output.
- **The view.** It copies field by field, including `engineer`, and imports no service or repository. A lint test proves the real view lints clean and that importing the service or repository into it is refused.
- **Registers.** The manifest row is ALL_ROLES, matching architecture §6 "Task detail: A L; E own". Spec-access, route-loaders, route-calls (a real recipe), `ENGINEER_ROUTES` and the canary scan all cover the route.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 2 |
| Info | 6 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | GitHub MCP `pull_request_read get_files` (29 files); `get_file_contents` at 05b0eab for `task-repository.ts`, `task-service.ts`, `with-route.ts`, `tests/support/estimate-recipe.ts`, `tests/e2e/support/auth.ts`, `tests/e2e/canary-scan.spec.ts` | Read in full: every changed file under `src/` and every new and changed test |
| Context | Jira AQP-296 and AQP-297 (ACs, Dev Context); PR body (Dev Record, A-1 to A-4); ux-spec SCR-03, SCR-05, SCR-06, traceability (FR-102), OQ-UX-12; screens SCR-03, SCR-03-engineer, SCR-05, SCR-06; architecture §4.4 (line 439), §6 (lines 929-930); `docs/06-reviews/AQP-298/combined.md`, `AQP-299/combined.md`, `AQP-302/combined.md` | Read. Docs were read from the local working tree (branch `feat/AQP-306-delete-guard-2`), not from 05b0eab; the PR changes no docs |
| Unit, integration, lint, `tsc`, build, E2E | CI run 43605779390 on 05b0eab (`get_check_runs`) | 6 of 6 green: Stages 1 to 11, Stages 1 to 11b, E2E shards 1 to 4. **Not run locally**, as the brief directed |

## AC Conformance
| AC | Implemented in | Tests | Result |
|----|----------------|-------|--------|
| AC-1: badge with text and icon on the queue, the header and any task page; Closed = APPROVED; derived, not stored | `lib/estimate/task-status.ts`, `components/shared/status-badge.tsx` (used by `queue-list.tsx` and `workspace-header.tsx`) | `task-status.test.ts`, `status-badge.test.ts`, `task-detail.test.ts`, integration `engineer-status.test.ts`, E2E `task-status.spec.ts` | Met in substance. The wording of APPROVED is in dispute: **SQR-01** (A-1) |
| AC-2: 0 canary sentinels; no approver, price or reason; "Approved" shows no amount | Strict `taskDetailSchema`; `engineer-task.ts` field-by-field; the badge takes only the status | `task-detail-route.test.ts` (keys and regex), `status-badge.test.ts`, `strict-schema`, canary scan with four states plus a planted control | Met. Forward note: **SQR-04** |
| AC-3: one route, one strict schema, no role branch | `app/api/v1/tasks/[id]/route.ts`; manifest ALL_ROLES | Route test (same keys for three roles), `role-matrix`, `strict-schema`, E2E (Lead) | Met |
| AC-4: another Engineer's task gives a 404 identical to a missing one | `findTask(id, scope)` (scope in the query; UUID guard) → null → `NotFoundError` | Unit route (bodies compared), service unit, PostgreSQL integration, E2E (bodies compared) | Met. An ID over 100 characters gives 422 (**SQR-05**, not a probe) |
| AC-5: Lead and Admin see the same words | Shared `StatusBadge` and `taskStatusOf`; same view | `status-badge.test.ts` (three roles), route test (Lead and Admin answers equal the Engineer's), E2E Lead | Met |
| AC-6: canary scan extended to four states; negative control fires | `canary-scan.spec.ts`: DRAFT, SUBMITTED, APPROVED, unlocked (APPROVED → DRAFT); plant on `/api/v1/tasks/` | Same; `canary-scan-gate.test.ts` lists 13 tests at 3 widths | Met. The stated tasks carry no Restricted data of their own yet (**SQR-04**) |
| AC-7: 360, 768 and 1366; readable; axe 0 | `flex-wrap` on the badge pair | E2E at three widths: overflow and axe on the queue (Open and Closed tabs) and the draft header | Met. The approved header is not axe-checked, but the dark "Closed" badge is checked on the Closed tab |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-----------------|-------|--------|---------------|--------------------------|
| SQR-01 | Major | `src/components/shared/status-badge.tsx:37-42`; `src/components/features/estimate-workspace/workspace-header.tsx:7` (and the removed `STATUS_LABELS.APPROVED` in `estimate-texts.ts`) | A-1; AQP-296 AC-1; ux-spec SCR-03, SCR-05, SCR-06 (G3); AQP-297 AC-5 and AC-6 | APPROVED shows two badges, "Approved" and "Closed", on every surface. This replaces the header's "Approved and locked". No document draws this; see the ruling below | Deviates from the human-approved G3 design. Lead and Admin rows will say "Closed" twice once 04.05 adds AC-5. A screen reader hears "Approved Closed" with no separator. No security impact | A product-owner and ux-expert ruling (options A, B and C below; A recommended). Under A: drop the second badge; give the header a variant that says "Approved and locked". About 15 lines plus test words | The word assertions in `status-badge.test.ts` and `task-status.spec.ts`, updated to the chosen wording |
| SQR-02 | Minor | `src/lib/estimate/task-status.ts:40-41` | AQP-297 AC-4 (one `isTaskClosed`, a grep test for no second implementation) | `closed: true` for APPROVED is a second "is closed" rule, written before 04.05's single function exists | 04.05's guard will flag this file, or 04.05 must refactor it | Export `isTaskClosed(status)` here (or at 04.05's planned path), derive `closed` from it, and have the scrum-master update AQP-297's Dev Context path | Unit test of `isTaskClosed` over `ESTIMATE_STATUSES` |
| SQR-03 | Minor | `src/server/views/schemas/tasks.ts:25` | Maintainability; fail at build, not at run time | `STATUSES` is a fourth copy of the status union. The others are `ESTIMATE_STATUSES` and `EstimateStatus` in state-machine, `EstimateStatus` in the repository and `TaskEstimateStatus` in `lib/tasks/queue` | A new status breaks `taskStatusOf` at compile time but this enum only at run time (a 500, failing closed) | `z.enum(ESTIMATE_STATUSES)` (state-machine is on the Engineer allow-list) | `tsc`; optionally assert that the enum options equal `ESTIMATE_STATUSES` |
| SQR-04 | Info | `tests/e2e/canary-scan.spec.ts:408-417` | AC-2 and AC-6 depth (forward note for 06.06 and 06.08) | The APPROVED and unlocked tasks are made from the status alone, with no calculation, approved price or unlock reason. The approvals table does not exist yet | The scan cannot yet catch "price beside Approved"; the strict schema guards it meanwhile | When approve and unlock land, seed these tasks through the real actions with sentinel price and reason | The existing scan, then |
| SQR-05 | Info | `src/server/views/schemas/tasks.ts:113` | AC-4 | An `id` over 100 characters gets 422, not 404 | None. The answer does not depend on whether a task exists, and it matches the other `[id]` routes | None | n/a |
| SQR-06 | Info | `src/server/views/schemas/tasks.ts:126` | NFR-002 | `notes` is the one free-text field: the assigner's text, already shown on SCR-05 (UX-15, FR-032) | Not a system cost field | None | n/a |
| SQR-07 | Info | `tests/support/spec-access.ts:56` | Forward note for 04.07; AQP-298 SQR-01 | The entry is path-level with every role. The PATCH route for Lead and Admin will need method keys | The role matrix fails loudly until the entry is split, so there is no silent gap | Split into `GET` and `PATCH` keys in 04.07 | Role matrix |
| SQR-08 | Info | `src/lib/estimate/task-status.ts:31` | Maintainability | `TASK_STATUS_WORDS` is read only by a test | None | Move it into the test, or settle it with A-1 | n/a |
| SQR-09 | Info | n/a | Praise | The scope is cut in the query. Non-UUID guards protect both IDs. The view is field by field, with a lint proof. 404 bodies are compared across unit, integration and E2E tests. The new route has a planted control. One shared badge replaces two local copies, and its icon is never colour alone | — | — | — |

## Ruling on A-1

**The documents genuinely conflict.**

1. **AQP-296 AC-1:** "A status badge with text shows Draft, Submitted, Approved or Closed … Closed = APPROVED estimate". That is four words for three statuses with "or", so the story itself does not say which word an APPROVED badge shows, or whether it shows both.
2. **ux-spec, approved at G3 by a human,** shows one badge per status:
   - SCR-03 and SCR-03-engineer mocks: one "Approved" badge with a lock icon (SCR-03.html:128, 131; SCR-03-engineer.html:98, 101). On the Lead's row, "Closed" is plain muted text in the action column (SCR-03.html:130; UX-20; "Closed rows show the word 'Closed' instead of the reassign action").
   - SCR-05, state Approved (ux-spec line 645): "'Approved and locked.' read-only … no price shown".
   - SCR-05.html:50 and SCR-06.html:50: header badge "Approved and locked" with a lock icon.
   - FR-102 trace (line 1414): "SCR-05 (status badge, Submitted, Approved)".
   - OQ-UX-12, answered by the delivery lead (line 1473): "Should Engineers see a task's status 'Approved' (and Closed) without a price?" "Show the status, no price."
3. **Architecture §4.4 (line 439):** Open or Closed is derived from `estimates.status`, never stored. This agrees with the PR.
4. **AQP-297 (04.05):**
   - AC-4: one function, `isTaskClosed`, and no second implementation.
   - AC-5: "Closed" replaces the row actions.
   - AC-6: the Engineer sees "the status 'Approved/Closed'", which reads as one combined label.

**Is two badges right?** No document draws two badges.

**Is one combined label intended?** AQP-297 AC-6 points that way; the ux-spec points to one plain word per status.

**Does this story pre-empt 04.05?** In part:
- It puts "Closed" on every approved row for every role, which is 04.05's AC-6 territory. It will duplicate 04.05 AC-5's action-column "Closed" on Lead and Admin rows.
- Its `closed` flag is a second "is closed" rule (SQR-02).

It does not touch the tab logic, which 04.02 already derives in SQL.

**Recommendation to the product-owner and ux-expert (one decision):**
- **Option A (recommended):** one badge per status, as the G3 screens draw it. The queue shows "Draft", "Submitted" and "Approved" (lock icon). The header keeps "Approved and locked", which also tells the Engineer why the inputs are read-only. "Closed" stays the tab name and, on Lead and Admin rows, the 04.05 action-column word. Amend AQP-296 AC-1 to "Draft, Submitted or Approved; an approved task is in the Closed tab", and AQP-297 AC-6 to "status Approved, in the Closed tab". About 15 lines of code plus test words.
- **Option B:** one combined badge, "Approved · Closed", on every surface. This matches the story wording and AQP-297 AC-6. Update ux-spec SCR-03, SCR-05 and SCR-06.
- **Option C:** keep two badges, as built. Update ux-spec SCR-03, SCR-05 and SCR-06, and change AQP-297 AC-5 and AC-6 so "Closed" is not shown twice on a row.

Under any option, NFR-002 holds: the badge takes only the status.

## Security verification (scope of the brief)
| Item | Result |
|------|--------|
| An Engineer sees only their own task | `scopeOf(viewer)` from the session, an exhaustive switch; the request has no field to widen it. `findTask` uses `findFirst({ where: { AND: [{ id }, scopeFilter(scope)] } })`, so another Engineer's row is never read. Lead and Admin get scope `{ null, null }`, which is "A L" in architecture §6 |
| An identical 404 for another Engineer's task, an unknown ID and a non-UUID | `isUuid(id)` and `isReadable(scope)` return null before SQL. The route turns null into `NotFoundError`. The 404 bodies are compared apart from `requestId` in the unit and E2E tests; the PostgreSQL integration test checks that all three cases return null |
| The eleven fields carry no cost | id, code, title, notes, engineer {id, name}, customerName, folderPath, folderUrl, deadlineAt, status, assignedByName. No rate, cost, formula, approval amount, approver or reason. The repository selects the queue's columns plus `notes` and never touches `calculations`, `calculation_rows` or approvals |
| Strict schemas | `taskIdParamsSchema` and `taskDetailSchema` are both `z.strictObject`; the output is re-parsed by `withRoute` |
| The view copies field by field and imports no service or repository | Yes, including the nested `engineer`. The lint test lints the real file clean and refuses it with the service or repository imported. On the allow-list: `schemas/tasks`, `lib/estimate/task-status` |
| Manifest, role matrix, strict schema, canary | Manifest row ALL_ROLES; `spec-access` A L E; `route-loaders`; `route-calls` recipe = the owner's canary task (harness: seeded with id `targetId`; E2E: `insertCanaryEstimate` gives the task the owner's ID); `ENGINEER_ROUTES`; canary AC-3 scan through the manifest, plus a new four-state scan and a planted control |
| The route-recipes plant change | **Not weakened.** The planted row moved from `/api/v1/tasks/[id]` (now real, with a recipe) to an invented path that still has no recipe, and it is still named for GET and PATCH. The real route is held to a recipe by the existing completeness checks |
| Lead and Admin cut | Same shape, no role branch; their answers equal the Engineer's (unit, integration, E2E) |
| Accessibility | Each badge has a word and an icon. The queue keeps one link per row. axe runs at three widths on the queue's Open and Closed tabs and the draft header |

## Issues for other roles
- **product-owner and ux-expert:** decide A-1 (SQR-01): option A, B or C above. Then amend AQP-296 AC-1, AQP-297 AC-5 and AC-6, and the ux-spec if B or C is chosen.
- **scrum-master:** AQP-297 Dev Context names `src/lib/tasks/task-state.ts` and says "06.01 reuses it". 06.01 has landed (`lib/estimate/state-machine.ts`), and this PR adds `lib/estimate/task-status.ts`. Point 04.05 at a single `isTaskClosed` (SQR-02).
- **developer (06.06 and 06.08):** SQR-04, seed the approved and unlocked scan tasks through the real actions with a sentinel price and reason. **(04.07):** SQR-07, split the spec-access entry into method keys.

## Re-review, round 2 (2026-11-14)

| Field | Value |
|-------|-------|
| Commits reviewed | c6b9e88 (review fixes). The merge of master ba059dd (#388), 5364b02, was not reviewed, as the orchestrator directed |
| CI | 6 of 6 green on c6b9e88 (run 43607951454) |
| Method | GitHub commit patch of c6b9e88 (8 files); no local run |
| A-1 decision | Option A, applied by the developer; the product-owner amended AQP-296 AC-1 and AQP-297 AC-6 |
| **Verdict** | **APPROVE.** Nothing blocks the merge. |
| PR review | Follow-up COMMENT review on c6b9e88; thread replies r4574196593, r4574196951, r4574197247, r4574197473, r4574197729 |

| Finding | Result | Evidence |
|---|---|---|
| SQR-01 Major | **Verified** | `StatusBadge` draws one `Badge`; `CLOSED_LABEL`, `CircleCheck` and the `closed` branch are removed, so no surface draws "Closed" as a badge. Queue: "Approved" with a lock. `variant="header"`: "Approved and locked" for APPROVED only, used by `workspace-header.tsx`. Tests assert option A (one badge, one svg, no "Closed"; header words; "Approved" for three roles; E2E for Engineer and Lead). |
| SQR-02 Minor | **Verified** | `isTaskClosed` exported from `lib/estimate/task-status.ts`; `closed` derived from it; unit test over `ESTIMATE_STATUSES`. Note for 04.05: the repository's SQL `tabFilter` is the SQL form of the same rule; the grep test should allow it. |
| SQR-03 Minor | **Verified** | `z.enum(ESTIMATE_STATUSES)` for the queue row and the task detail; a test pins the options. |
| SQR-08 Info | **Verified** | `TASK_STATUS_WORDS` removed. |
| SQR-04 to SQR-07 Info | Open (forward notes) | SQR-04 for 06.06 and 06.08; SQR-07 for 04.07. |
| Security scope | **Unchanged** | Route, repository, service, `engineer-task.ts`, manifest, registers and canary scan untouched; schema keys and strictness the same; AC-6 canary `includes('Approved')` still matches "Approved and locked". |

New counts: Blocker 0, Critical 0, Major 0, Minor 0, Info 4.
