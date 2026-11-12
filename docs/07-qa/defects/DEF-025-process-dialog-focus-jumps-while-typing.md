# DEF-025: Add rate dialog: after a refusal of several fields, typing moves focus to the next refused field, so a rate typed in the default-value field is split between the default value and the name

| Field | Value |
|-------|-------|
| Story / AC | AQP-113 (STORY-02.01) / the keyboard-only AC and the UX spec 6.0 "Forms" rule |
| Severity | Sev-2 Major |
| Priority | P2 |
| Type | Product |
| Status | Verified by QA in CI on PR #167 (closes with the merge and master's G7) |
| Found by / date | qa-engineer, 2026-11-10 (G7 of AQP-123, condition F of DL-129 (8) and DL-131 (3)) |
| Build / commit | `e72e8f2` (PR #151 head). `src/components/features/masters/process-form-dialog.tsx` is byte-identical to `origin/master` (ce9c02c), so the fault is on `master` |
| Environment | Windows 11, Node v24.19.0, Chromium (Playwright 1.64.1) at 360, 768 and 1366 px, development server, throwaway PostgreSQL 17 on port 55523. Probe: `docs/07-qa/AQP-123-evidence/aqp-123-focus-jump.spec.ts.txt` |
| Jira / GitHub | [AQP-270](https://sankumar76.atlassian.net/browse/AQP-270) / [#162](https://github.com/sankumar76/Accucut-Quotation/issues/162) |

## Steps to Reproduce
1. As the Admin open /masters/process and press "Add rate".
2. Press the dialog's "Add rate" button with every field empty. Three fields show a message and focus goes to the first one, Name (this part is as UX spec 6.0 "Forms" says).
3. By keyboard type three letters, `xyz`, into the field that has focus.

## Expected Result
Focus moves to the first message once, when the save is refused, and never while a person types (the rule the master applied to the Exchange rates tab as QLT-01, DL-129 (1)). All three letters land in Name and focus stays there.

## Actual Result
Typing `xyz` in Name keeps only `x`; focus moves to the Unit list, which takes no letters, so `yz` are lost. Typing into the second text field (Default value) puts the first letter there and moves focus back to Name, which gets the rest. Desktop run: `rate-name=x ; rate-unit= ; rate-default=` (F-a) and `rate-name=y ; rate-unit= ; rate-default=x` (F-b). A default value of `83.37` typed this way is kept as `8` (a valid number) and the name becomes `3.37`, which the screen accepts. A rate is a number that every formula using it multiplies, so a wrong default is a cost error (test plan section 6, Sev-2 "an AC fails with a workaround").

## Evidence
`RESULT F-a desktop | Process (SCR-11, AQP-113) | refused=3 first=rate-name | focused=rate-unit | rate-name=x ; rate-unit= ; rate-default=`. `RESULT F-b desktop | ... first=rate-name second=rate-default | focused=rate-unit | rate-name=y ; rate-unit= ; rate-default=x`.

The cause is the same line in each dialog: an effect keyed on the `errors` object runs again every time the object is replaced, and typing replaces it (the message of the typed field is removed), so after each key focus is moved to the first field that still has a message. The third refused field is a list, which takes no typed letters, so letters are lost as well as misplaced.

## Suspected Area
`src/components/features/masters/process-form-dialog.tsx`: `useEffect(() => { ... focus first field with a message }, [errors])`. The fix the Exchange rates tab uses is to request focus only when a refusal is shown (`showErrors`), never when a field is typed in (`use-exchange-rates.ts`, QLT-01). The three dialogs can share one fix with the `follow-up` issue for ux-spec v0.21 section 6.0 (AQP-1 11307).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-10 | PR #167 (AQP-269, AQP-270, AQP-271): `69805d1` the shared hook `src/components/shared/use-focus-on-refusal.ts` and the three dialogs; `db1319a` and `cde1b29` the round-2 tests; G6 closed at `cde1b29` (DL-138) |
| Regression test added | developer | 2026-11-10 | process-master.spec.ts "DEF-025: after a refusal of several fields ..." (360, 768, 1366 px), with the duplicate-name and column-letter server refusals now asserting focus on Rate name |
| Verified | qa-engineer | 2026-11-10 | QA's own F-a and F-b probes for this dialog, replayed in CI on the fixed code (control PR #185, run 42867526102): all 6 pass at 360, 768 and 1366 px; the same probes and the developer's test fail with the old effect planted back (control #186, run 42867558564) and with typing asking the hook for focus (control #187, run 42867587822); report `docs/07-qa/AQP-269-test-report.md` |
