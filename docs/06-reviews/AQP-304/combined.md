# Review Report — AQP-304 (STORY-05.04) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-304-part-form-2` (PR #397) |
| Commit reviewed | c63210e (base da63d7f). The later merge commit 6756248 (master da63d7f, docs only) was not reviewed |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE.** There is no Blocker, Critical or Major finding. Two Minors and four Info notes are for the hardening window or later stories |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/397#pullrequestreview-5906222406 (COMMENT, 7 inline comments). GitHub anchored it to the head at the time, 6756248, so that the diff lines match. The content reviewed is c63210e. Jira AQP-304 comment 11908 |
| PR label | `review:quality-approved` |

## Summary

The form now has all eight sections, built from the registry, and the security properties of AQP-303 hold.

- **NFR-002, the Engineer allow-list.**
  - `isOnForm` is unchanged. The new placeholder path (`isPlaceholder`) applies the same two layers: it requires `kind === 'input'`, `engineerVisible`, `isEngineerVisibleAllowed`, and a data type of `select_other` or `flag`. It sends only ID, letter and label, under a strict schema.
  - The new `defaultValue` is sent only for inputs that are on the form. It is a registry text of at most 200 characters (`inputFieldSchema`).
  - Hints and the rupee unit are fixed texts looked up by key, and the registry's own values win.
  - The word "cost" appears only in the four labels of typed inputs and in the name of section 08. The unit, route and e2e scans remove exactly those words and still forbid `price`, `rate`, `formula` and `{{`.
  - Every calculated twin is shown absent: AK to AY, BG, BL, BN and BO.
  - **One gap:** the tampered-flag test does not check `reserved` (SQR-01).
- **Validation and limits.**
  - Remarks allows 1,000 characters (assumption A-1); other texts allow 200. The limit lives in the field's rule, which browser and server both read.
  - The request body allows 2,000 characters, so a 1,001-character text gets a 422 under its field.
  - `\p{Cs}` now refuses a lone surrogate with a 422 instead of a 500, proven in PostgreSQL (AQP-303 SQR-13: **met**).
  - Numbers are unchanged, and the same rule is applied to every new number field.
- **AQP-303 SQR-01 merge rule and revisions.** `estimate-inputs.ts` changes only to pass `maxLength`. Saves still write only the keys they name, revisions are still conditional, and the unit and PostgreSQL tests still prove it.
- **Default "None" (S).** It lives in the form and is never stored:
  - `commit` compares the value it would stand in for with what is held, so a blur, a blank or "None" typed over an untouched field sends nothing;
  - a part with nothing typed stays `EMPTY`;
  - Calculate (05.09) must apply the default when the key is absent (A-15), which the developer recorded as a follow-up.
- **SQR-05 (canary).** The scan person's canary part now stores every typed value, a canary price under I and an unknown key (`fillCanaryPart`). The service, the PostgreSQL tests and the e2e scan all prove the price and the key never leave. **Met.**
- **#395 (Remarks sizing).** The `--textarea-min-h` token (96 px) replaces `min-h-24`, with a unit test and an e2e check (at least 90 px). **Met.** The other numeric-spacing no-ops of AQP-303 SQR-07 remain for the hardening window.
- **The two AQP-303 tests that changed.** `form.test.ts` and `estimate-inputs-service.test.ts` now use Z instead of P as the key that is not on the form, because P is now on it. They still prove that an unrelated key survives a save, that a clear removes only its own key, and that a no-op is judged on the submitted keys. Z is a placeholder, so no save can name it (`formFieldById` returns undefined). See SQR-04 for what happens when 05.06 builds Z.
- **Harness coverage.** No new routes. The existing manifest, role-matrix, strict-schema and canary rows cover the widened schema. No new server module, so the engineer-import-rule list is unchanged.
- **Brief point (a), the tablet axe `target-size` failure.** The fix is a valid test fix and does not hide a real issue:
  - The overlapped element (`#estimate-customer`) was not focused. Ordinary content scrolled under a sticky header is not a WCAG 2.4.11 failure, and the control is fully usable once scrolled into view.
  - The product already protects focus: `html { scroll-padding-top: var(--sticky-top) }` is measured from every `[data-sticky-bar="top"]`, and the new strip is marked as one.
  - The strip's jump links focus the heading and assert it is below the strip.
  - A new e2e test tabs through the whole form at three widths and asserts that no focused control's top is above the bottom of the sticky bars.
  - The only gap is that this runs forward only (SQR-05, Info).
- **Brief point (b), `navigation.spec.ts` AC-7.** Not weakened. The shared Lead's test still checks the strict shape, `no-store`, the request ID, the menu match and that no cost word appears; only its count was relaxed to a non-negative integer. The exact count of 0 is now asserted for a disposable Lead who assigned nothing, which is deterministic. Before, the result depended on the order specs ran in, because `task-queue.spec` seeds overdue tasks as the shared Lead.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | GitHub MCP `pull_request_read get` and `get_files` (35 files); `get_file_contents` at c63210e for `form-fields.test.ts` (whole file) and `field-schema.ts` | Read in full: every changed file under `src/`, `canary-part-inputs.ts` and its security test, the e2e support (`part-form.ts`, `auth.ts` `fillCanaryPart`, `design-system.ts`), `navigation.spec.ts`, and the changed AQP-303 tests. Read for the relevant tests: `estimate-form-sections.spec.ts` (strip, axe and 2.4.11 tests), `form-sections.test.ts`, and the route and service tests by name and key lines |
| Context | Jira AQP-304 (via the PR body's AC table); AQP-303 review (SQR-01, 05, 07, 13); architecture §4.5 (`defaultValue`, A-15, `visibleWhen`) | Read |
| Tests, lint, `tsc`, build, E2E | CI on c63210e, reported 6 of 6 green by the brief | Not re-run. Nothing was run locally (GitHub MCP only) |

## AC Conformance
| AC | Implemented in | Tests | Result |
|----|----------------|-------|--------|
| AC-1 eight cards, ranges, letters, "n of m" | `form-fields.ts` (sections 1 to 8), `section-card.tsx`, `form-values.ts` `sectionProgress` | form-fields, route, form-values, e2e | Met |
| AC-2 rupee add-on and "Enter 0 if there is none." on U, AP, AU, BM; typed cost shown back as typed | `FORM_PRESENTATION` (key fallback, registry first) | form-fields (renamed or moved), route, service, PostgreSQL, e2e | Met |
| AC-3 Fasteners default "None", not stored | `defaultValue`, `textOf`, `commit` stand-in comparison | form-fields, form-values, route, service, PostgreSQL, e2e | Met. Note SQR-03 |
| AC-4 Remarks multi-line, 1,000 characters (A-1), live message, sizing | `textRuleOf`, `textTooLongMessage`, `lengthProblem`, textarea token | validation, route, service, PostgreSQL (1,000 with line breaks round-trips; 1,001 refused), textarea-height, e2e | Met. Note SQR-02 |
| AC-5 number rule and real-change rule unchanged | `validation.ts`, `estimate-inputs.ts` | route, service, PostgreSQL | Met |
| AC-6 sticky strip; 07 and G placeholders not counted | `section-strip.tsx`, `placeholder-fields.tsx`, `reserved` | form-fields, route, form-values (0 of 0), e2e | Met. Note SQR-01 |
| AC-7 no Restricted, rate, cost or formula; canary extended | allow-list; `canary-part-inputs.ts`; `fillCanaryPart` | form-fields, route word scan, `canary-part-inputs.test.ts`, PostgreSQL, canary-scan e2e | Met |
| AC-8 360, 768, 1366; axe; 44 px; 2.4.11 | strip `data-sticky-bar`, `scroll-padding`, `expectFormAccessible` | e2e (CI) | Met as reported. Note SQR-05 |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-----------------|-------|--------|---------------|--------------------------|
| SQR-01 | Minor | `src/lib/estimate/form-fields.ts:119` (`isPlaceholder`); the gap is in `tests/unit/estimate/form-fields.test.ts` ("refuses a field the registry wrongly flags…") | NFR-002 test adequacy; PR reviewer point 1 | The tampered-flag test compares only `section.fields`, not `reserved`. No test tampers a Restricted or calculated field into the placeholder path. If someone dropped `isEngineerVisibleAllowed` (or the `kind === 'input'` check) from `isPlaceholder`, a tampered registry could put the **label** "Material Rate / Kg" into every role's form answer, and no unit test would fail | A rate's name reaches an Engineer (UX-24), with no test catching it | In the tampered test, also set I's `dataType` to `'flag'` in the clone and flip `engineerVisible` on outputs, then assert that `reserved` IDs equal the untampered set | That extended test |
| SQR-02 | Minor | `src/lib/estimate/validation.ts:33` with `src/server/views/schemas/tree.ts` `MAX_INPUT_VALUE_LENGTH` | Coupled limits | Remarks' 1,000 (`MAX_LONG_TEXT_LENGTH`) and the answer bound of 1,000 (`MAX_INPUT_VALUE_LENGTH`, `partInputsSchema`) are separate constants with equal values. If the product owner raises A-1, a part with a long Remarks fails the answer schema, and `GET /nodes/{id}` and every save answer give a 500 for that part | The part can no longer be read or saved (fails closed, but blocks work) | Define `MAX_INPUT_VALUE_LENGTH` from `MAX_LONG_TEXT_LENGTH`, or add a test that the answer bound is at least every field's `maxLength` | That test |
| SQR-03 | Info | `src/lib/estimate/form-fields.ts:144` | AC-3, A-15; forward note for 05.09 | `defaultValue` is sent as the registry text and is not checked against the field's rule. Today only S (text) has one. A default an Admin later sets on a number input (for example "5") would show un-normalised, count as filled, and never be validated | A default that Calculate cannot read | 05.09 reads the default through the field's rule; optionally the registry's `document-rules.ts` refuses a default that fails its field's rule | Registry rule test |
| SQR-04 | Info | `tests/integration/estimates/form.test.ts:194` (and the service test) | Test longevity | Z stands in for "a field not on the form" until 05.06 builds the flags. Then the SQR-01 tests will plant a key the form accepts, and the "refused" case breaks | A loud failure in 05.06, not a silent one | 05.06: switch the probe to a field that stays off the form (I, or C until 05.07), or derive it with `formFieldById(...) === undefined` | n/a |
| SQR-05 | Info | `tests/e2e/estimate-form-sections.spec.ts:338` | WCAG 2.4.11 (brief point (a)) | The focus-not-obscured test runs forward with Tab only. Two paths are not covered: Shift+Tab back up through the strip and the customer field, and the Enter chain (`moveOnEnter` calls `focus()`) | Low. Browsers apply `scroll-padding` on focus in both directions, but nothing proves it here | Add a reverse pass and an Enter pass to the same assertion | Same test |
| SQR-06 | Info | PR follow-up (1) | Records | Architecture §6 "Estimate form" should list `defaultValue` and `reserved`. AQP-303 SQR-07's remaining numeric-spacing no-ops (`max-w-120` and others) and the `tokens.test.ts` guard are still open | Docs drift | The orchestrator routes this to the solution-architect and the hardening window | n/a |
| SQR-07 | Info | — | Praise | The placeholder path repeats both allow-list layers. Defaults never write. The canary part now holds a real Restricted value end to end (fake service, PostgreSQL, e2e scan). The lone surrogate is proven to give a 422 in PostgreSQL. There is an explicit 2.4.11 assertion. The navigation test is made deterministic without losing coverage | — | — | — |

## Security and integrity verification (scope of the brief)
| Item | Result |
|------|--------|
| Every new section and field obeys the two-layer allow-list; no Restricted, rate, cost or formula value in any Engineer response, page or hint | Yes. Fields go through `isOnForm`; placeholders go through `isPlaceholder` (both layers; ID, letter and label only). `defaultValue` is only for inputs on the form. Hints and units are fixed texts. Word scans in unit, route and e2e tests. Test gap: SQR-01 |
| Validation and limits for the new field kinds; the merge-onto-stored rule | Yes. Text limits per field, body 2,000, `\p{Cs}`; `saveInputs` is unchanged apart from `maxLength`. Coupled constants: SQR-02 |
| Revision handling | Unchanged (conditional write, 409). Tests: one write raises each revision by one; a no-op raises nothing |
| AQP-303 SQR-13 | Met (unit, route, service, PostgreSQL) |
| AQP-303 SQR-05 | Met (`canary-part-inputs.ts`, `fillCanaryPart`, `canary-part-inputs.test.ts`, `form-sections.test.ts`, canary-scan e2e) |
| #395 Remarks sizing | Met (`--textarea-min-h` 96 px, textarea-height test, e2e at least 90 px) |
| Tablet axe `target-size` on `#estimate-customer`; sticky strip | Valid test fix (scroll artefact on a control that was not focused). Product focus protection through `scroll-padding` and the measured strip; explicit 2.4.11 e2e test. Reverse and Enter paths: SQR-05 |
| The two changed AQP-303 tests | Still prove the same properties, with Z as the key that is not on the form. 05.06 must move the probe again (SQR-04) |
| `navigation.spec.ts` AC-7 | Not weakened; made deterministic |
| Manifest, role matrix, strict schema, engineer import rule | No new routes or server modules. The widened strict schema is covered by the existing rows and recipes |
| Test adequacy | Good. The one gap is SQR-01 |

## Issues for other roles
- **developer (05.06):** SQR-04 (the probe key); SQR-01 is cheap to add now.
- **developer (05.09):** apply the default when the key is absent, read through the field's rule (SQR-03).
- **solution-architect:** SQR-06 (§6 "Estimate form" should list `defaultValue` and `reserved`).
- **orchestrator:** SQR-02 and SQR-05 go to the hardening window if not fixed here. AQP-303 SQR-07 (other numeric spacing) is still open.
