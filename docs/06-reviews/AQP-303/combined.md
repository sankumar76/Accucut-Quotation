# Review Report — AQP-303 (STORY-05.03) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-303-part-form-2` (PR #392, a re-cut of #391 under DL-215) |
| Commit reviewed | 0dcc3da (base 553fdcf). The later merge commit aefc654 (master #393) was not reviewed |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE WITH COMMENTS.** There is no Blocker or Critical finding. There is one Major (SQR-01): a save rewrites a part's whole `inputs` from the current form, so it silently deletes stored values of any field that is not on the form at that moment. The fix is about five lines and protects data, so I recommend making it before the squash. If it is not fixed here, it goes to the hardening window and is not waived. |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/392#pullrequestreview-5905749422 (COMMENT, 8 inline comments). GitHub anchored it to the head at the time, aefc654, so that the diff lines match. The content reviewed is 0dcc3da |
| PR label | `review:quality-approved` |

## Summary

The part form is built carefully, and the security scope of the brief is met.

- **NFR-002, the Engineer form.**
  - The form is an allow-list in two layers. `isOnForm` lets a field through only if `engineerVisible` is set **and** `isEngineerVisibleAllowed` is true, so I and every calculated field are refused even when a stored flag is wrong. Only the sections and data types built so far get through.
  - What leaves is a *view* of each field: ID, letter, label, unit, hint and rule. A formula or cost stage cannot be spread in.
  - Response schemas are strict. Stored inputs are projected through the same allow-list (`visibleInputs`) before they leave, on both `GET /nodes/{id}` and the save answer, and only text values leave.
  - The tests would fail if a Restricted field leaked: the tampered-flag case, the regex over the whole answer, the planted Material Rate value in a stored row (unit, route and PostgreSQL), and the e2e "no price on the page" checks.
- **Validation and limits.**
  - Body: strict, with `revision` from 1 to 2^31−1. Values are keyed by UUID, each at most 1,000 characters, at most 64 per save.
  - Service: numbers are ASCII digits with at most 12 before the point and 2 after it, stored normalised as text. Text is trimmed, at most 200 characters, with no C0 control or DEL.
  - Unknown, Restricted, derived and not-yet-built fields all get the same 422 message. Every problem is reported at once and nothing is stored.
  - Text starting with `=` is stored as typed. The export must neutralise it (SQR-08).
- **Revision and lock.** One transaction does the following, in order:
  1. `lockEstimate` FOR UPDATE.
  2. The uniform 404, then the shared `assertEditable` (409).
  3. The part 404 (`findNode` filtered by `estimate_id`).
  4. A stale part revision gives 409 `PART_CHANGED`.
  5. The values are checked (422).
  6. If nothing changed after normalisation, nothing is written. Otherwise the part's `revision`+1 and `updated_at` are written in one UPDATE that carries `estimate_id`, and `inputs_revision`+1 is applied in the same transaction.

  SQR-01 (b) of AQP-302 holds: typed values raise the part revision, so the subtree fingerprint of a delete changes. This is tested in unit, PostgreSQL and e2e tests.
- **Material.**
  - The value is stored as lower-case UUID text under the field keyed `material-in-drawing`.
  - `lockMaterialForUse` (FOR SHARE, `deleted_at IS NULL`) is the only lock method, taken after the estimate lock. The delete takes the material FOR UPDATE and then reads, so there is no cycle.
  - A PostgreSQL race test runs the **real** `saveInputs` against the **real** `deleteMaterial` in both orders, with proof that one side waits for the lock. #390's hand-written writer tests are retired, and the `lockMaterialForUse` and two-deletes tests stay. #390's SQR-11 is met.
- **Harness coverage.**
  - Manifest rows, `ENGINEER_ROUTES`, spec-access, route loaders and recipes (role matrix, strict-schema, refused-before-lookup, CSRF, canary scan) are all in place.
  - `estimate-inputs` is in the engineer-import-rule service class.
- **Re-cut hunks.** All checked:
  - The `ENGINEER_ROUTES` union is exactly master's list plus the two new routes.
  - spec-access is a keep-both merge.
  - `fake-masters.ts` and `material-repository.ts` are not in the diff, so master's versions stand.
  - The `customer-delete.test.ts` fix is the minimal `...inputsDependencies()`.
  - `material-delete.test.ts` lost only the writer race tests, their helper and the unused imports.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 6 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | GitHub MCP `pull_request_read get` and `get_files` (53 files); `get_file_contents` at 0dcc3da for `material-repository.ts`, `master-rules.ts`, `api-client.ts`, `ui/input.tsx`, `globals.css` and `architecture.md` | Read in full: every changed file under `src/`, the integration tests (`form`, `material-race`, `material-delete`), the unit tests for the inputs service, form route and form fields, and every security and support change. Read at test-name level: the e2e spec, `form-client`, `form-values`, `validation` |
| Context | Jira AQP-303 (ACs, Dev Context, comments 11873 to 11895); architecture §4.5, §4.8, §4.9, §5.1 `estimates`, §6 Estimate form and Save inputs; `docs/06-reviews/AQP-302/combined.md` (SQR-01 b, SQR-09, SQR-11); `AQP-306/combined-pr390.md` (SQR-11, 12, 13, 16) | Read |
| Layout sweep (`lg:w-*` and others) | Read-only Grep of the local working tree (branch `feat/AQP-310-windows-install`, near master). GitHub code search has no index for this repository: it returned 0 results even for `lockMaterialForUse` | See SQR-07 |
| Unit, integration, lint, `tsc`, build, E2E | CI run 43613418802 on 0dcc3da, as reported in the brief and the Jira hand-off. On the merge head aefc654, run 43614167685 was still in progress when I read it | Reported 6 of 6 green. **Not run locally**: the brief said to use GitHub MCP only, and the PC is short of memory (CLAUDE.md §9 item 5) |

## AC Conformance
| AC | Implemented in | Tests | Result |
|----|----------------|-------|--------|
| AC-1 sections 01 and 02, range tags, letter badges first, 1/2/3-column grid | `form-fields.ts` (registry: `fieldsInFormOrder`, `sectionColumnRange`, `fieldLetter`), `section-card.tsx`, `field-renderer.tsx` (`tagFirst`), `part-fields.tsx` (auto-fit grid, 14.5rem minimum) | `form-fields.test.ts`, `estimate-form-route.test.ts`, e2e AC-1 | Met. The grid is auto-fit, so the number of columns follows the content width rather than fixed breakpoints, and with two sections there are at most 2 columns. This matches UD-4 |
| AC-2 label "QTY per Assy" and the hint | `QTY_PER_ASSY_HINT`, found by `systemRole === 'quantity'` | Unit (renamed label), route, e2e | Met. A constant, because stored versions are immutable (NFR-026). Labelled |
| AC-3 F read-only and shaded; I absent from the response, page and chunks | Allow-list (`isOnForm`); `derived` rule; `Input` `read-only:` styles; options carry ID, name and Material Considered | Tampered flags, route regex, e2e (no price or number of the canary material on the page), canary scan | Met |
| AC-4 0+ with 2 decimals; -1, 1.234, abc refused with the rule's words; typed text kept; blank allowed | `validation.ts` (shared by browser and server), `use-part-form.ts` `commit` | `validation.test.ts`, route (-1, 1.234, abc), PostgreSQL, e2e | Met. See SQR-11 for the 12-digit cap |
| AC-5 material list from `GET /options/materials` | `loadMaterialOptions`, `NativeSelect` | `form-client.test.ts`, e2e AC-5 | Met. Unlisted value shown as a UUID: **SQR-06** |
| AC-6 Enter moves on, never submits, Shift+Enter in multi-line | `moveOnEnter` (`isComposing`, `:disabled`, textarea plus Shift) | e2e AC-6, SQR-11 | Met |
| AC-7 PATCH: revision, decimal text, no-op without a bump, real change bumps in one transaction, stale gives 409, unknown or Restricted gives 422 | `estimate-inputs.ts` `saveInputs`, `estimate-node-repository.saveInputs` | Unit (refusal order, rollback), route, PostgreSQL (one transaction, two saves at once, no-op leaves `updated_at` alone) | Met. Data-loss path: **SQR-01**. Defence in depth: **SQR-02** |
| AC-8 one strict schema for every role, no cost, rate or formula text; canary 0 | `schemas/form.ts`, manifest, recipes | Three roles give equal answers; strict-schema, role matrix, canary scan | Met. Canary depth: **SQR-05** |
| AC-9 360, 768, 1366; axe; 44 px; keyboard | Components above; `--tree-w` | e2e AC-9 (CI) | Met as reported by CI. Token sweep: **SQR-07** |
| AQP-302 SQR-01 (b), SQR-09, SQR-11; #390 SQR-11 | Revision bump; `partInputsSchema` `[{fieldId, value}]`; `onOpen` and drawer focus; a single `lockMaterialForUse` | Service, route, PostgreSQL, e2e; `material-race.test.ts` | Met |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-----------------|-------|--------|---------------|--------------------------|
| SQR-01 | Major | `src/server/services/estimate-inputs.ts:146-155` | Data integrity (§9 item 2: "anything that can lose or corrupt data"); architecture §4.8 | `current = typedValues(document, part.inputs)` keeps only the **string** values of fields that are **on the current form and editable**, and `next` is built from it and written as the part's whole `inputs`. Any other stored key is silently deleted by a save of an unrelated field. | Irreversible, silent loss of typed values whenever the stored row holds a key the current form does not list. This happens: (a) after a registry change that moves a field to another section, turns off `engineerVisible`, changes its data type, or deletes it (SCR-20); (b) for values that later stories store as non-strings (05.06 flags) or write through another route (05.07 picture) until each of those stories remembers to widen `typedValues`; (c) through the same projection used on read. No test covers "an unrelated stored key survives a save" | Merge onto the **raw** stored object and project only for the answer: `const next: Record<string, unknown> = { ...part.inputs }`, apply `changes`, `changed = keys.some(k => (part.inputs[k] ?? null) !== (next[k] ?? null))`, write `next` (widen `EstimateNodeRepository.saveInputs` to `Record<string, unknown>`), and answer `inputs: typedValues(document, next)` with `completenessOf` of that projection. Reads stay projected, so NFR-002 is unchanged | Unit and PostgreSQL: a part stores `{[LENGTH]: '1.00', [P]: '7.00', invented: true}`; save `{[WIDTH]: '2'}`; the row still holds `P` and `invented`; the answer lists only LENGTH and WIDTH |
| SQR-02 | Minor | `src/server/repositories/estimate-node-repository.ts:117-118` | Defence in depth; test adequacy | The UPDATE matches on `id` and `estimate_id` only. The stale-revision check happens earlier, against a read, so correctness rests entirely on the estimate row lock. The "two saves at once" PostgreSQL test catches a removed lock only when the two reads interleave, which depends on timing | If a future writer of `estimate_nodes` skips `lockEstimate`, two saves could both pass with revision N, and the second would overwrite the first's `inputs` (computed from a stale read) with no 409 | Pass the expected revision: `... WHERE id = $n AND estimate_id = $e AND revision = $expected`. Treat `changed === 0` as `ConflictError(PART_CHANGED)` | A test with a held transaction (as in `material-race.test.ts`): hold save A after its read, run save B, release A, and expect a 409 even with the lock stubbed out |
| SQR-03 | Minor | `src/server/services/estimate-inputs.ts:143` | Resource use (cross-reference reviewer-performance) | `currentConfiguration()` runs inside `transactions.run`. `getCurrentVersion` queries the latest version on the runtime client, which takes a **second** pool connection while the transaction holds one connection and the estimate row lock | With concurrent saves at or above the pool size, every transaction waits for a second connection and the saves time out (`DatabaseBusyError`). It also lengthens how long the estimate lock is held | Read the registry before the transaction (`const document = await currentConfiguration(); return transactions.run(...)`). A version is immutable, so reading it before the lock is safe | Unit: a fake runner records that `currentConfiguration` is called before `run` |
| SQR-04 | Minor | `src/lib/estimate/validation.ts:31` | Input validation ("no control characters") | `CONTROL_CHARACTERS` covers C0 and DEL only. C1 controls (U+0080 to U+009F), the line and paragraph separators U+2028 and U+2029, and the bidi overrides and isolates (U+202A to U+202E, U+2066 to U+2069) all pass | Part No. and Description go into the tree label, the export and the customer quote. A bidi override can make text display differently from what is stored (spoofing a part number), and C1 controls can break the export | `/[\p{Cc}  ‪-‮⁦-⁩]/u` (line feed still allowed for multi-line, as now) | `validation.test.ts`: `'A\u0085B'`, `'FR‮321'`, `'x y'` are refused with `TEXT_CHARACTERS_MESSAGE` |
| SQR-05 | Minor | `tests/support/route-calls.ts:155` | NFR-002 guard depth (STORY-01.03 AC-6) | The canary recipe for PATCH sends `values: {}`, and the recipe part's stored `inputs` is `{}`. So the canary scan of `GET /nodes/{id}` and `PATCH .../inputs` never sees a stored Restricted value: the projection is proven only by unit and PostgreSQL tests | If the projection is bypassed later (for example a new route that returns `record.inputs`), the role-wide canary scan would not catch it | Plant a canary rate value under field I, and an unknown key, in the recipe part's stored inputs, so both routes must drop it end to end. Tree completeness tests will then see the part as `PARTIAL` unless completeness is computed from the projection (see SQR-01) | Canary scan: the planted value is never in any answer |
| SQR-06 | Minor | `src/components/features/estimate-workspace/field-renderer.tsx:65` | UX; AC-5 | A stored material that is not in the options list is shown as an `<option>` whose label is the raw UUID. This happens for a material soft-deleted while the estimate was APPROVED and then unlocked (the delete guard checks DRAFT and SUBMITTED only), or for "Not applicable" before 02.06 lists it | The Engineer sees a 36-character ID as the material, and saving that value again is refused with "Choose a material from the list." | Label it with a text, for example `MATERIAL_UNLISTED = 'Material no longer listed'` in `estimate-texts.ts`, and keep the value | Unit or e2e: a part whose material is not listed shows that label and no UUID |
| SQR-07 | Minor | `src/components/features/estimate-workspace/parts-tree-area.tsx:74` (fixed here); others outside this PR | Design tokens (NFR-020), AC-9 | `--spacing-*: initial` in `globals.css` removes the numeric spacing scale. That is why `lg:w-72` produced no width, and the `--tree-w` token is the right fix. The same no-op applies elsewhere (local tree, near master): `max-w-120` in `app/(public)/sign-in/page.tsx:40`, `system-page-frame.tsx:19`, `ui/dialog.tsx:30` and `master-search-box.tsx:30`; `min-w-44` in `customer-rates-table.tsx:75`; `max-h-60` in `customer-reset-dialog.tsx:76`; `md:w-24` in `account-screen.tsx:33`; `min-h-24` in `ui/textarea.tsx:14` (Remarks in 05.04) | Dialogs, the sign-in column and the search box have no maximum width on desktop. The reset list has no maximum height. The textarea has no minimum height. None of these makes a test fail | A follow-up issue: replace each with a token (`max-w-(--dialog-w)` and so on). Add a check to `tokens.test.ts` that refuses `(w|h|min-w|max-w|min-h|max-h|size|gap|p[trblxy]?|m[trblxy]?)-<digits>` in `src/` | That `tokens.test.ts` check |
| SQR-08 | Info | `src/lib/estimate/validation.ts` header; PR body "Follow-ups" | Formula injection (OWASP CSV injection) | Text starting with `=`, `+`, `-`, `@`, tab or CR is stored as typed. This is correct, as long as the export neutralises it. The follow-ups are listed only in the PR body | The export story could miss it | Raise the `follow-up` GitHub issues now (export neutralisation, including tab and CR; tree label from D; Enter to Calculate) and link them to STORY-08 and 05.09 | Export story test |
| SQR-09 | Info | `src/components/features/estimate-workspace/estimate-workspace.tsx:32` (code that existed before this PR) | FR-064; UI and server agreement | `editable = canEditInputs(header.status, 'ENGINEER')` uses the Engineer's rule for every viewer, so a Lead who opens a SUBMITTED estimate on SCR-05 gets a read-only form, although the server allows the save | Possibly intended (the Lead edits elsewhere). It is now visible because the form exists | Confirm with UX or the product owner; if it is not intended, pass the viewer's role | e2e as Lead on SUBMITTED |
| SQR-10 | Info | PR #392 body | Records | The AC-3 row and reviewer point 1 still name `findMaterialOption` ("selects three columns"), which this PR removed | A misleading Dev Record | Update the PR body | n/a |
| SQR-11 | Info | `src/lib/masters/master-rules.ts` (`DECIMAL_TEXT_PATTERN`, 12 digits) via `validation.ts` | AC-4 wording | A 13-digit number is refused with "Enter 0 or more, with up to 2 decimals.", which does not say why | Cosmetic | Optional: a separate message for the size | n/a |
| SQR-12 | Info | — | Praise | Two-layer allow-list with tampered-flag tests. Projection on every read. A uniform 422 message, so the answer does not tell Restricted fields from unknown ones. Refusal order pinned by tests. No-op detection after normalisation, with `updated_at` proven untouched in PostgreSQL. A real-writer race test with proof of the lock wait in both orders. A clean re-cut | — | — | — |

## Security and integrity verification (scope of the brief)
| Item | Result |
|------|--------|
| Engineer form is an allow-list; no Restricted field, rate, cost or formula (hint text included) | Yes. `isOnForm` with `engineerVisible` and `isEngineerVisibleAllowed`; the only hint override is the fixed QTY text; the field view has no formula or stage key; there is a regex over the whole answer |
| Strict schemas; `[{fieldId, value}]` | Yes. `formResponseSchema`, `savedInputsSchema`, `nodeDetailSchema.inputs` (strict entries, UUID `fieldId`, value up to 1,000 characters, up to 200 entries); body `strictObject` |
| Numbers ≥ 0, 2 decimals; text ≤ 200, no control characters; ≤ 64 values; unknown, Restricted or read-only gives one 422 | Yes. Gaps in the control-character set: SQR-04 |
| `=...` stored as typed; export follow-up | Stored as typed (correct). Follow-up issue not yet raised: SQR-08 |
| Row lock, shared `assertEditable`, node `revision` and `inputs_revision` in one transaction, no-op on equal values, stale gives 409 `PART_CHANGED` | Yes, with unit and PostgreSQL proof including rollback. Defence in depth: SQR-02 |
| AQP-302 delete fingerprint (SQR-01 b) | Yes. A typed value raises the node revision, so a stale delete is `TREE_CHANGED`. Unit, PostgreSQL and e2e |
| Material: lower-case UUID under the `material-in-drawing` field; `lockMaterialForUse` after the estimate lock; one method; no cycle with `deleteMaterial` | Yes. Lock order estimate → material, while the delete takes material → (read only). The ascending-ID rule for several materials is in a comment |
| PostgreSQL race of the real save against the real delete, both orders; #390 hand-written writer removed | Yes (`material-race.test.ts`; `material-delete.test.ts` edited) |
| Ownership 404 identical for another person's and a missing estimate or part | Yes. Bodies compared apart from the request ID (form and save); a non-UUID part ID gives 404 |
| Manifest, role matrix, strict-schema, canary for `form` and `inputs` | Yes. Canary depth: SQR-05 |
| Engineer import rule | `estimate-inputs` added to the services class |
| Re-cut hunks | Verified (see Summary). A type-check of the whole tree is CI's job (reported green) |
| Could a test fail if a Restricted field leaked, a stale revision were accepted, or the lock were removed? | Leak: yes, in several places. Stale revision: yes (unit, route, PostgreSQL). Lock removed: only by timing (SQR-02) |

## Issues for other roles
- **developer (AQP-303):** SQR-01, which I recommend fixing before the squash. SQR-02 to SQR-06 are cheap if you are in the file, or go to the hardening window. SQR-08 and SQR-10 are records.
- **orchestrator:** SQR-07 becomes a `follow-up` or `tech-debt` issue for the hardening window. It covers files outside this PR. Confirm that CI is green on the merge head before the squash.
- **ux-expert / product-owner:** SQR-09 (should a Lead edit inputs on SCR-05 while the estimate is SUBMITTED?).
- **reviewer-performance:** SQR-03 (pool connection inside the transaction).

## Re-review, round 2 (2026-11-14)

| Field | Value |
|-------|-------|
| Commits reviewed | e87bf6f (review fixes: SQR-01, 02, 03, 04, 11) and 566560f (the security review's Medium: Cf, Zl and Zp). Nothing else |
| CI | Running on 566560f when I read it. The merge waits for 6 of 6 green |
| Method | GitHub MCP `get_commit full_patch` for both commits and `get_file_contents` at 566560f. The regex was checked in Node 24 with sample strings. Nothing from the repository was run locally |
| **Verdict** | **APPROVE.** Nothing blocks the merge once CI on 566560f is green |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/392#pullrequestreview-5905837260 (COMMENT). Replies in each round 1 thread (r4574656981 to r4574658860). Count correction: issue comment 6880731643 |

| Finding | Result | Evidence |
|---|---|---|
| SQR-01 Major | **Verified** | `next = { ...part.inputs }`, so the save starts from the raw stored object. Only the submitted keys are set, and a blank deletes only its own key. The no-op check compares `part.inputs[k]` with `next[k]` for submitted keys only: `1.5` against a stored `1.50` is still a no-op, and a stored non-text value against new text is a change. The answer and the no-op return are both `typedValues`, so NFR-002 is unchanged. Unit and PostgreSQL tests plant `P`, an unknown key, a non-text value and a rate (unit only), and check that a save of WIDTH keeps them, that a clear removes only its own key, and that a no-op writes nothing. The old code would fail the first two |
| SQR-02 Minor | **Verified** | `UPDATE ... AND revision = ${expectedRevision}::int`; `changed === 0` returns `null`, and the service answers 409 `PART_CHANGED` before `bumpInputsRevision`. The fake repository mirrors it. The direct tests (PostgreSQL: wrong revision, then right, then old revision gives null, written, null; unit: another writer overtakes the read and the answer is 409) are accepted in place of a race test |
| SQR-03 Minor | **Verified** | `currentConfiguration()` is awaited before `transactions.run` |
| SQR-04 Minor and the security review's Medium | **Verified** | `/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u`. The regex is valid (General_Category short names with the `u` flag). It refuses tab (single-line), C1, U+2028, U+2029, the bidi characters, ZWSP to RLM, U+061C, U+2060 to U+2064, U+FEFF, the soft hyphen, tag characters and U+FFF9. It accepts ASCII, precomposed é, e followed by U+0301, Devanagari, Tamil, CJK, Arabic, NBSP, U+FE0F and emoji. This is the only server-side text path in this story: numbers are ASCII through `DECIMAL_TEXT_PATTERN`, and the material value must be a UUID through `lockMaterialForUse`. The browser uses the same function. `trim()` removes a leading or trailing U+FEFF rather than refusing it, which is safe. Blocking ZWJ and ZWNJ is a labelled assumption (product owner to confirm) |
| SQR-11 Info | **Verified** | `NUMBER_TOO_LARGE_MESSAGE` for 13 or more digits with a valid shape; the shape rule still wins for `…​.123` |
| SQR-05, SQR-06, SQR-07, SQR-09 | Open | Deferred to the hardening window, as agreed (thread replies) |
| SQR-13 Minor (new) | Open | A lone UTF-16 surrogate (`"\ud800"` in the JSON body) passes the rule. `JSON.stringify` emits `\ud800`, which PostgreSQL's jsonb refuses as an unpaired surrogate, so the user gets a generic 500 instead of a 422. Nothing is stored (fails closed). Fix: add `\p{Cs}` (checked: a lone surrogate matches it, a valid emoji pair does not), or refuse when `!text.isWellFormed()`. Test: `'FR\uD800321'` is refused and `'FR😀'` passes. In this PR or the hardening window |

New counts: Blocker 0, Critical 0, Major 0, Minor 4 (SQR-05, 06, 07, 13), Info 4 (SQR-08, 09, 10, 12).
