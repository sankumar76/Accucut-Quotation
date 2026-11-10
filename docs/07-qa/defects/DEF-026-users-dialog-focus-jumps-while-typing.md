# DEF-026: Add user dialog: after a refusal of several fields, typing moves focus to the next refused field, so letters meant for the name and e-mail land in the masked password field

| Field | Value |
|-------|-------|
| Story / AC | AQP-65 (STORY-01.04) / the UX spec 6.0 "Forms" rule |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Product |
| Status | New |
| Found by / date | qa-engineer, 2026-11-10 (G7 of AQP-123, condition F of DL-129 (8) and DL-131 (3)) |
| Build / commit | `e72e8f2` (PR #151 head). `src/components/features/users/user-form-dialog.tsx` is byte-identical to `origin/master` (ce9c02c), so the fault is on `master` |
| Environment | Windows 11, Node v24.19.0, Chromium (Playwright 1.64.1) at 360, 768 and 1366 px, development server, throwaway PostgreSQL 17 on port 55523. Probe: `docs/07-qa/AQP-123-evidence/aqp-123-focus-jump.spec.ts.txt` |
| Jira / GitHub | [AQP-271](https://sankumar76.atlassian.net/browse/AQP-271) / [#163](https://github.com/sankumar76/Accucut-Quotation/issues/163) |

## Steps to Reproduce
1. As the Admin open /users and press "Add user".
2. Press the dialog's "Add user" button with every field empty. Three fields show a message and focus goes to the first one, Name (this part is as UX spec 6.0 "Forms" says).
3. By keyboard type three letters, `xyz`, into the field that has focus.

## Expected Result
Focus moves to the first message once, when the save is refused, and never while a person types (the rule the master applied to the Exchange rates tab as QLT-01, DL-129 (1)). All three letters land in Name and focus stays there.

## Actual Result
Typing `xyz` puts `x` in Name, `y` in E-mail and `z` in the password field, where it is masked; focus ends on the password field. Typing into E-mail first puts the first letter there and the rest into the other fields. Desktop run: `user-name=x ; user-email=y ; user-password=z` (F-a) and `user-name=y ; user-email=x ; user-password=z` (F-b). A name or an address is shown, so the Admin sees it; the letters in the password field are not shown. No cost value is involved, so QA grades this one level below the Material and Process dialogs; the master may raise it because of the masked field.

## Evidence
`RESULT F-a desktop | Users (SCR-14, AQP-65) | refused=3 first=user-name | focused=user-password | user-name=x ; user-email=y ; role=ENGINEER ; user-password=z`. `RESULT F-b desktop | ... first=user-name second=user-email | focused=user-password | user-name=y ; user-email=x ; role=ENGINEER ; user-password=z`.

The cause is the same line in each dialog: an effect keyed on the `errors` object runs again every time the object is replaced, and typing replaces it (the message of the typed field is removed), so after each key focus is moved to the first field that still has a message. The password field is the last one refused, so the stream of letters ends in a field whose content the person cannot read back.

## Suspected Area
`src/components/features/users/user-form-dialog.tsx`: `useEffect(() => { ... focus first field with a message }, [errors])`. The fix the Exchange rates tab uses is to request focus only when a refusal is shown (`showErrors`), never when a field is typed in (`use-exchange-rates.ts`, QLT-01). The three dialogs can share one fix with the `follow-up` issue for ux-spec v0.21 section 6.0 (AQP-1 11307).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | The probe's F-a and F-b cases for this dialog, as a committed spec at three widths |
| Verified | qa-engineer | | |
