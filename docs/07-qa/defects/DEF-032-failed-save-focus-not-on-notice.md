# DEF-032: After a failed Save on the customer page focus returns to the Save button, not to the notice (ux-spec v0.24, SCR-12 "Failed Save")

| Field | Value |
|-------|-------|
| Story / AC | STORY-02.02 (AQP-142, PR #297) / AC-8 (keyboard path); ux-spec v0.24 SCR-12 "The Customers words: final words", row "Failed Save (edit page)" |
| Severity | **Sev-3 Moderate** (differs from the UX spec text; does not mislead; the notice is `role="alert"`, the typed values stay and Save is the retry control). Test plan section 6 |
| Priority | P3 (Jira Medium) |
| Type | Product (code defect: master read the spec row as Confirmed in DL-192) |
| Status | **Closed** 2026-11-12. Fixed in round F2b of #297 (DL-192; after a failed Save, focus goes to the notice), verified by QA on H4 `eb6bc66` (a 503 and a real 409, 3 widths), on `master` as `0ca47df`; push run 43339039704 5 of 5 (DL-197 (5)(h), DL-200). Jira AQP-286 and GitHub #344 closed |
| Jira / GitHub | [AQP-286](https://sankumar76.atlassian.net/browse/AQP-286) / [#344](https://github.com/sankumar76/Accucut-Quotation/issues/344); relates to AQP-142 |
| Found by / date | qa-engineer, G7 of AQP-142 (attempt 1), 2026-11-12 |
| Build / commit | H1 `cb95102` (report at H2 `f269b05`) |
| Environment | Windows 11, Node v24.19.0, Playwright Chromium at 360x800, 768x1024 and 1366x768, production build of H1, throwaway PostgreSQL 17; invented data only |

## Steps to Reproduce
1. Open a customer's page as the Admin; type a rate (for example `6.66`) and a phone number.
2. Make `PATCH /api/v1/customers/{id}` answer 503 (a stubbed route, as the repository's own tests do).
3. Press **Save customer**.
4. Read `document.activeElement` once Save is enabled again.

## Expected Result
ux-spec v0.24, row "Failed Save (edit page)": "Danger notice above the form; the typed values stay; **focus goes to the notice**". Title `We could not save the changes.`, sentence `Check your connection and try again. What you typed is still in the form.`

## Actual Result
The title, the sentence and the kept values are word for word. The notice has `role="alert"`. Focus is on `BUTTON: Save customer` at 360, 768 and 1366 px (3 of 3).

## Evidence
- QA series `aqp-142-qa.spec.ts` (local, not committed), test "W: the three failed writes…": `activeElement` = `BUTTON:Save customer`, `focusIsAlert` false, `alertRole` = `alert`, at all three widths; see `docs/07-qa/AQP-142-test-report.md`, section (b), row "Failed Save".
- Code: `src/components/features/masters/use-customer-edit.ts`, `useCustomerSave`: the failure branch of `save()` ends with `setSaveFocusRequest((count) => count + 1)`, the same call as the success path; the effect then runs `saveButton.current?.focus()`.

## Suspected Area (optional)
The failure branch of `save()` in `use-customer-edit.ts`. Master's ruling (DL-192): the spec row is Confirmed, so the code changes, not the spec. Regression test (extend `customers.spec.ts`): after a stubbed 503 on `PATCH`, focus is on the notice (not on Save) at 3 widths; reviewer-quality plants the focus call removed and sees red on that assertion only. A refusal that names fields keeps going to the first field (`useFocusOnRefusal`); only the notice case changes.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-12 | round F2b, H3 `7fd3cdd`; on `master` as `0ca47df` |
| Regression test added | developer | | `customers.spec.ts` |
| Verified | qa-engineer | 2026-11-12 | G7 attempt 2 on H4 `eb6bc66`; push run 43339039704 |

## Severity history and routing
- QA: Sev-3 on 2026-11-12; does not hold G7 by itself (Sev-3 is fixed before G8 or accepted by master in writing).
- Master, DL-192 (Jira AQP-142 comment 11711, PR #297 comment 6827649206): fixed in round F2b on #297 together with DEF-031 (the files in scope of F2 are `page-header.tsx`, `customer-edit-screen.tsx`, the tests and the Dev Record; the developer states where the focus call sits if `use-customer-edit.ts` must change).
