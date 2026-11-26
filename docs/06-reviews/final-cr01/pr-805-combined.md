# Review Report — PR #805 (AQP-488 / DEF-131 PR 1: the server audit of a Lead's and an Admin's inputs, picture and tree writes) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review, CLAUDE.md §9 item 2: anything that can lose or corrupt data, and the trace of a Lead's and an Admin's writes) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-488-lead-edit-server` (draft PR [#805](https://github.com/sankumar76/Accucut-Quotation/pull/805)), `061bd3f2` plus a merge of `master` |
| Commit reviewed | `b1532683` (CI run 45852588661) |
| PR review | [review 6077180630](https://github.com/sankumar76/Accucut-Quotation/pull/805#pullrequestreview-6077180630) (COMMENT, single-token; 6 inline comments; label `review:quality-changes-requested`) |
| Date | 2026-11-26 |
| Reviewed against | Design note `docs/04-architecture/lead-admin-input-edit-2026-11-27.md` v1.2 (records-u `55d90dc5`), sections 3.2, 3.4, 3.8, 3.9, 4 and 6b; RISK-038 / R-1; DL-434, DL-435; `docs/standards/coding-standards.md` §1, §4, §6, §10 |
| **Verdict** | **REQUEST CHANGES. Merge stop: one Blocker (QLT-805-01).** CI Stage 6 fails on the project's own "audit in the change's transaction" check (AQP-237), so Stages 7 to 11b never ran: the 18 integration cases, the build and Stage 11b are unproven in CI. The design is right and the shapes are clean. NFR-002 holds |

## Summary

**What is right.** Every repository method that writes estimate nodes has exactly one caller path, and each one now traces a Lead's or an Admin's write in its own transaction:

| Method | Called from |
|--------|-------------|
| `insertNode` | `addPart` |
| `placeNodes` | `addPart`, `moveNode` and `deleteNode` (through `finishChange` or directly) |
| `deleteNodes` | `deleteNode` |
| `saveInputs` | `estimate-inputs.saveInputs` |
| `setImage` | `image-service.point` (put and remove) |

All seven route call sites pass an `AuditContext` built from the session, as every other audited route does. The role comes from `viewer.role` and never from the body. `traceFor` runs first, so a service built without `audit` refuses a Lead's or an Admin's write before anything is read. An Engineer gets `null` and is not audited.

The shapes are strict. They hold no ID, no figure, no bytes and no file name. A material is shown by its name. A delete keeps names and kinds, never values, and caps its list at 100 rows with `truncated`. No-ops (the same value, the same picture, a move to the same place, a removal when there is none) and refusals write nothing. Statuses, the row lock, the revision and fingerprint checks and the figure clearing are untouched. There is no 403 on tree writes. The tree texts match the design word for word.

**The Blocker (QLT-805-01).** `tests/unit/audit-transaction-architecture.test.ts` refuses all five new `record` calls ("not a .run( callback of a TransactionRunner and not a named function whose calls can be followed"). They are methods of an object literal returned by `build()`, which the check cannot follow. CI run 45852588661 Stage 6 fails, 1 of 11,599 tests (job 140025607074). This is the very guard the design names (section 3.4, "Static check"), and it must not be loosened to pass.

**Minors:**
- **QLT-805-02:** the tree writes read the configuration on a second connection while holding the row lock (SQR-03).
- **QLT-805-03:** a real stored change can leave no entry (a treatment switched between a listed option and "Other" with the same words).
- **QLT-805-04:** the 60-field cap is below the save's own 64.
- **QLT-805-05:** test gaps against the design's own list.
- **QLT-805-06:** a Lead's save now reads the whole tree to find one Sl. No.

| Severity | Count |
|----------|-------|
| Blocker | 1 |
| Critical | 0 |
| Major | 0 |
| Minor | 5 |
| Info | 3 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff origin/master...b1532683` (29 files; `src` 12); full reads of `input-change-audit.ts`, `input-change.ts`, the audit-events additions, `estimate-service.ts` (`addPart`, `moveNode`, `deleteNode`, `finishChange`, `lockForChange`, `configurationFor`, `viewReaders`), `estimate-inputs.ts` `saveInputs`, `image-service.ts` put and remove, the 7 routes | as summarised |
| Every node writer is covered (R-1) | `git grep` of the repository's writers (`insertNode`, `placeNodes`, `deleteNodes`, `saveInputs`, `setImage`) and of raw `estimate_nodes` writes in `src` and `scripts`; `git grep` of the callers of the six service methods | Every writer reaches a traced service method. Only `scripts/seed-lighthouse-data.ts` writes nodes outside them, and it is a seed script, not a person's path. All 7 routes pass the session context |
| Unit tests at the head (scratch `git archive b1532683`, read-only) | `npx vitest run` on the 9 unit files the PR adds or changes, plus `audit-transaction-architecture` | 439 of 440 passed; **`audit-transaction-architecture` fails** (QLT-805-01) |
| CI | `gh run view 45852588661`; job 140025607074 log | Stage 6 **failure**: 1 failed of 11,599, the same 5 findings. **Stages 7 to 11b were not run**, so there is no integration, build or Stage 11b result. E2E shards still queued when this was written |
| Integration tests (the 18 input-audit cases, the 500-node timing) | not run | CI never reached them. Locally, the only database is the demo's (not to be touched). **Unverified**: to be read from the run on the fixed head |
| Editable fields on the seed form | a scratch script over `buildFormSections(seedConfig)` | 34 form fields, **31 editable**, longest label 19 characters (QLT-805-04) |
| Audit screen roles | `route-manifest.ts:154-165` | `/audit` and `/api/v1/audit` are `ADMIN_ONLY`, unchanged |
| Client impact | `use client` scan of the changed files; importers of `lib/audit/categories.ts` | No client file changed. `categories.ts` is imported by the `/audit` page only, not by `/estimates/[code]`. Stage 11b did not run (QLT-805-01) |
| Secrets, personal data | diff | none. Test values are invented |

## Findings

| ID | Severity | File:line | Issue | Why (impact) | Fix | Test that catches it |
|----|----------|-----------|-------|--------------|-----|----------------------|
| QLT-805-01 | **Blocker** | `src/server/services/input-change-audit.ts:83, 96, 110, 129, 147` | The AQP-237 architecture check (`tests/support/audit-transaction-check.ts`) refuses all five `auditService.record` calls. Each sits in a method of the object literal returned by `build()`; `helperSymbol` follows only a `function` declaration or a `const f = …`, and only calls in the same file. CI Stage 6 fails | Broken required tests: the PR cannot merge, and Stages 7 to 11b (integration, build, Stage 11b) never ran, so none of the 18 cases is proven in CI. The guard exists to prove that each entry commits with its write (architecture section 6). The design asks for it to count these calls (section 3.4, "Static check") | **Do not loosen the check.** Preferred: keep the shaping pure and move the write into the `.run(` callbacks. `input-change-audit.ts` exports builders that return the entry or `null`, for example `inputsChangedEntry(context, actorRole, { … }): AuditEntryInput<'estimate.inputs_changed'> \| null`. Each callback then does `const entry = …; if (entry !== null) await audit.record(tx, entry);` right after its write. Reads they need on `tx` (`listNodes`, `lockEstimate`) stay in the callback, which also satisfies the check's rule (b). Alternative: make each writer a named function declaration taking `(audit, tx, …)`, called directly from each callback | `audit-transaction-architecture.test.ts` green, with `checked` rising by the number of new calls |
| QLT-805-02 | Minor | `src/server/services/estimate-service.ts:449, 477, 495` | `configurationFor(id)` is called inside `transactions.run`. It reads `findConfigurationBasis` on the pool, not on `tx`, so a Lead's tree write holds the estimate's row lock and a first connection while it waits for a second | Against the rule the save itself states (review SQR-03: "holds neither a second connection nor the estimate's lock while it is read"). The app pool has 10 connections (`prisma-client.ts:43`), so concurrent tree writes can starve it into transaction timeouts. It also adds a query to every Lead tree write. Cross-reference: reviewer-performance | `viewReaders` already reads this document before the transaction: return it (`{ completenessOf, nameOf, document }`) and pass `readers.document` | A unit test with a fake `findConfigurationBasis` that fails when called inside a running transaction |
| QLT-805-03 | Minor | `src/lib/estimate/input-change.ts:60` | `changedFields` picks fields by their **display text**, while the save decides "changed" on the **stored value** (`estimate-inputs.ts:56` `sameValue`: a treatment's `id` and `text`). Switching Treatment / Color between a listed option and "Other" with the same words is a real write (revision up, figures cleared) with **no entry** | A real Lead or Admin write leaves no trace, against "every real change writes an entry" (section 3.9; R-1). There is no cost impact today: the treatment is words only (`row-calculator`, `export/rows`) | Choose the fields with the save's own comparison (stored values), then render the text. Where the two texts are equal, show the kind, for example "Other: Anodise" | Integration: a Lead switches a listed treatment to "Other" with the same words, giving one entry |
| QLT-805-04 | Minor | `src/server/services/audit-events.ts:127-128` | `fields` is capped at 60, but a save may carry 64 values (`MAX_VALUES_PER_SAVE`, `views/schemas/form.ts:20`), and a rule can zero more. The Admin can insert fields (`field-insert.ts`) | Above 60 changed fields the entry is refused, so the save fails with a 500. That is unreachable today (31 editable fields), but the limit is unrelated to the form's | Bound it by a shared constant at least `MAX_VALUES_PER_SAVE` plus the fields a rule can zero, or drop `.max` (the form bounds it) | Unit: the schema accepts as many fields as the seed form has editable ones, and the cap is at least `MAX_VALUES_PER_SAVE` |
| QLT-805-05 | Minor | `tests/integration/estimates/input-audit.test.ts:155, 201, 253, 298` | Gaps against the design's own test list (sections 3.9 and 4): (1) `it.each(['APPROVED'])` has no QUOTED case for the save, and no tree-write case on QUOTED or ignored. (2) "adds, replaces and removes" never replaces, so `did: 'replaced'` is untested. (3) Rollback on an audit failure is tested for add only, not for move, delete, picture put and picture remove. (4) `expect(await revisionOf(first)).toBeGreaterThanOrEqual(0)` cannot fail. (5) Section 3.9: "add the audit assertions" to the kept tree tests and `image.test.ts:265` is not done (they run through `withAuditContext`). No existing assertion was weakened | Paths the design calls out can regress unseen | Add QUOTED and ignored (tree too), a second put with other bytes, and the failing-audit case for move, delete, put and remove; drop or replace line 253 | as listed |
| QLT-805-06 | Minor | `input-change-audit.ts:81, 94`; `estimate-service.ts:449` | Each Lead or Admin save and picture change now reads the **whole tree** (`listNodes`, with every row's inputs) inside the lock, only to number one row. `addPart` lists the tree a second time after `finishChange` already did | On a 500 to 2,000-row estimate, with autosave every 30 s, every Lead save pays a full-tree read under the row lock. CI never ran the 500-node timing (QLT-805-01). Cross-reference: reviewer-performance | Number the row from a lighter read (`id`, `parentId`, `sortIndex` only), or let `finishChange` return the list it reads and pass it on | The 500-node integration timing in the run of record |
| QLT-805-07 | Info | `audit-events.ts` `describeInputFields` | The picture reads "1.4 Top cover: Part Model Picture replaced", while the design table says "Part Model, Picture replaced". The three tree texts match the design exactly | Wording only | Optional: a comma between label and value, or keep it and note the change in the design | the describe unit test |
| QLT-805-08 | Info | `input-change-audit.ts:166` | `traceFor` throws a plain `Error` (a 500). It is a wiring fault, not a user error, so that is acceptable; coding standards §10 prefer an `AppError` subclass | none | Optional: a named error class | n/a |
| SEC-805-01 | Info | as above | **NFR-002 and security hold.** Strict zod shapes; `inputField` has three keys; only `editable` fields (no derived, picture, rate or unknown key); no IDs, bytes or file names; deleted rows keep names and kinds, never values; `actorRole` comes from the session; the entry is written in the write's transaction; Engineer writes are unaudited; the audit read is Admin-only | none | none | n/a |

## Security notes (brief points 1 to 7)

| Point | Result | Evidence |
|-------|--------|----------|
| 1. Audit coverage, same transaction, no unaudited Lead or Admin path, Engineer unaudited | **Yes by code** (QLT-805-03 is the narrow exception). **Not proven in CI** (QLT-805-01) | The write-to-caller table above; `trace?.…(tx, …)` after each write inside `transactions.run`; `traceFor` returns `null` for an Engineer |
| 2. What an entry stores | **Yes** | `actorRole` in `after`; display text of changed editable fields only (cut at 2,000); delete = root, `rows`, `list` ≤ 100, `truncated`; no-ops and refusals write nothing |
| 3. Behaviour unchanged; a service without audit refuses before reading | **Yes** | `lockForChange` and the guards are unchanged; `traceFor` is the first line of each write |
| 4. Wording; SCR-16 "Input change"; kind names from `node-kinds.ts`; audit Admin-only | **Yes** (QLT-805-07 for the picture comma) | `NODE_KIND_NAMES`; unit tests pin "Added Sub-Assembly 1.4 under 1 Frame", "Moved 1.4 Top cover to 1.2", "Deleted 1.4 Top cover and 3 rows under it" |
| 5. Tests: 18 integration cases, unit tests, older tests updated and not weakened | 18 cases present; units pass; older tests only gain `withAuditContext` and `audit`, with no assertion removed. **The integration cases did not run in CI** | QLT-805-05 |
| 6. Performance on large estimates | **Not measurable on this run** (Stage 7 skipped) | QLT-805-02, QLT-805-06 |
| 7. NFR-002; Stage 11b | NFR-002 holds (SEC-805-01). No client change; Stage 11b did not run | |

## Issues for other roles

- **developer:** QLT-805-01 first (move `record` into the callbacks with pure builders). QLT-805-02 belongs to the same change. Then QLT-805-03 to -06. Re-run CI and state the 500-node timing and Stage 11b in the PR body.
- **qa-engineer:** DEF-131 Row E and Row E-T. The QUOTED, ignored-tree, replace and per-event rollback cases (QLT-805-05) are the ones still missing.
- **reviewer-performance:** QLT-805-02 and QLT-805-06 (full-tree read and second connection under the row lock).
- **orchestrator and master:** do not merge until Stage 6 is green and the integration stage has run (RISK-038 closes only on a proven run).
