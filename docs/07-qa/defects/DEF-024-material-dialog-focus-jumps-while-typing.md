# DEF-024: Add material dialog: after a refusal of several fields, each key typed moves focus to the next refused field, so one value is split across the cost fields

| Field | Value |
|-------|-------|
| Story / AC | AQP-122 (STORY-02.03) / AC-7 (keyboard only) and the UX spec 6.0 "Forms" rule |
| Severity | Sev-2 Major |
| Priority | P2 |
| Type | Product |
| Status | Verified by QA in CI on PR #167 (closes with the merge and master's G7) |
| Found by / date | qa-engineer, 2026-11-10 (G7 of AQP-123, condition F of DL-129 (8) and DL-131 (3)) |
| Build / commit | `e72e8f2` (PR #151 head). `src/components/features/masters/material-form-dialog.tsx` is byte-identical to `origin/master` (ce9c02c), so the fault is on `master` |
| Environment | Windows 11, Node v24.19.0, Chromium (Playwright 1.64.1) at 360, 768 and 1366 px, development server, throwaway PostgreSQL 17 on port 55523. Probe: `docs/07-qa/AQP-123-evidence/aqp-123-focus-jump.spec.ts.txt` |
| Jira / GitHub | [AQP-269](https://sankumar76.atlassian.net/browse/AQP-269) / [#161](https://github.com/sankumar76/Accucut-Quotation/issues/161) |

## Steps to Reproduce
1. As the Admin open /masters/materials and press "Add material".
2. Press the dialog's "Add material" button with every field empty. Five fields show a message and focus goes to the first one, Material in Drawing (this part is as UX spec 6.0 "Forms" says).
3. By keyboard type three letters, `xyz`, into the field that has focus.

## Expected Result
Focus moves to the first message once, when the save is refused, and never while a person types (the rule the master applied to the Exchange rates tab as QLT-01, DL-129 (1)). All three letters land in Material in Drawing and focus stays there.

## Actual Result
The first letter stays in Material in Drawing, the second lands in Material Considered and the third in Price per kg; focus ends on Specific gravity. Typing into the second refused field (Material Considered) instead puts the first letter there and then moves focus back to Material in Drawing. Desktop run: `material-in-drawing=x ; material-considered=y ; material-price=z ; material-specific-gravity= ; material-scrap-rate=` (F-a), and `material-in-drawing=y ; material-considered=x ; material-price=z` (F-b). A price, a specific gravity or a scrap rate typed this way can end in the wrong cost field (a number is a valid value in any of them).

## Evidence
`RESULT F-a desktop | Material (SCR-13, AQP-122) | refused=5 first=material-in-drawing | focused=material-specific-gravity | material-in-drawing=x ; material-considered=y ; material-price=z ; material-specific-gravity= ; material-scrap-rate=`. `RESULT F-b desktop | ... first=material-in-drawing second=material-considered | focused=material-specific-gravity | material-in-drawing=y ; material-considered=x ; material-price=z ...`. The tablet and mobile runs are in the test report.

The cause is the same line in each dialog: an effect keyed on the `errors` object runs again every time the object is replaced, and typing replaces it (the message of the typed field is removed), so after each key focus is moved to the first field that still has a message. In this dialog five fields are refused by an empty submit, so one typed value is spread over up to five fields.

## Suspected Area
`src/components/features/masters/material-form-dialog.tsx`: `useEffect(() => { ... focus first field with a message }, [errors])`. The fix the Exchange rates tab uses is to request focus only when a refusal is shown (`showErrors`), never when a field is typed in (`use-exchange-rates.ts`, QLT-01). The three dialogs can share one fix with the `follow-up` issue for ux-spec v0.21 section 6.0 (AQP-1 11307).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-10 | PR #167 (AQP-269, AQP-270, AQP-271): `69805d1` the shared hook `src/components/shared/use-focus-on-refusal.ts` and the three dialogs; `db1319a` and `cde1b29` the round-2 tests; G6 closed at `cde1b29` (DL-138) |
| Regression test added | developer | 2026-11-10 | materials.spec.ts "DEF-024: after a refusal of several fields ..." (360, 768, 1366 px), with the second-refusal check in the Add test and the Material part of the server-refusal check (`aqp-122-qa.spec.ts`) |
| Verified | qa-engineer | 2026-11-10 | QA's own F-a and F-b probes for this dialog, replayed in CI on the fixed code (control PR #185, run 42867526102): all 6 pass at 360, 768 and 1366 px; the same probes and the developer's test fail with the old effect planted back (control #186, run 42867558564) and with typing asking the hook for focus (control #187, run 42867587822); report `docs/07-qa/AQP-269-test-report.md` |
