# DEF-010: pressed state of the primary (Calculate) and danger (Delete) buttons is not perceptible on the iPhone

| Field | Value |
|-------|-------|
| Story / AC | AQP-183 (DEF-008), G7 condition 3; UX spec v0.9 section 7.3.1 |
| Severity | Sev-3 Moderate |
| Priority | P2 |
| Type | Product (design level: the UX spec values, not the code) |
| Status | New |
| Found by / date | delivery lead at the AQP-183 G7 phone check, 2026-11-04; analysed by qa-engineer |
| Build / commit | `a13f194` (PR #56), served by `next dev -H 0.0.0.0` from `C:\Users\sanku\Documents\Accucut-AQP-183-phone` |
| Environment | iPhone 17 Pro Max, iOS 27.0.1, Chrome 155, office Wi-Fi |
| Jira / GitHub | [AQP-185](https://sankumar76.atlassian.net/browse/AQP-185) / [#64](https://github.com/sankumar76/Accucut-Quotation/issues/64) |

## Steps to Reproduce
1. On the phone, open `/design-system` and scroll to section 05, "Buttons".
2. Hold **Calculate** for about a second, then tap it quickly.
3. Do the same with **Delete**.

## Expected Result
UX spec section 7.3.1: while held, the pressed fill and the inset shadow are visible; a quick tap shows a brief flash of that look.

## Actual Result
In the delivery lead's own words:
- Holds: "I retested the fix - 'Add Part' and 'Cancel' buttons looks good. But the pressed-in state for both 'Calculate' and 'Delete' buttons are not very clear."
- Quick taps: "Calculate and Delete - I do not see brief flash. Rest looks good"

## Evidence
- The same session shows that `:active` works on iOS WebKit: Add part, Cancel and both pencil buttons show their pressed look; disabled and loading show none. G6 condition 4 (a passive `touchstart` listener) is therefore not needed.
- The code applies the spec: `tests/e2e/button-pressed.spec.ts` checks the computed pressed fill, text and inset shadow of every variant at three widths, 45 of 45 with `--retries=0`.
- QA measurement of the spec's values, rest to pressed:

| Variant | Rest | Pressed | Contrast rest:pressed | RGB distance | On the device |
|---|---|---|---|---|---|
| Primary (Calculate) | `#DE3030` | `#BF2626` | 1.30:1 | 34 | not clear |
| Danger (Delete) | `#B3261E` | `#8F1C13` | 1.37:1 | 39 | not clear |
| Secondary (Add part, pencils) | `#FFFFFF` | `#D9DADF` | 1.40:1 | 62 | good |
| Ghost (Cancel) | `#FFFFFF` | `#F2B8B8` | 1.70:1 | 101 | good |

The two failing variants change the least, and both are dark, saturated reds, on which the inset shadow (`rgba(23, 24, 28, 0.28)`) barely shows. On the light fills the same shadow is visible.

## Suspected Area
UX spec v0.9 section 7.3.1, the pressed values for primary and danger. The ux-expert chooses a pressed look on the red fills that a person can see on a phone. The developer then changes `src/components/ui/button.tsx` and the expected tokens in `tests/e2e/button-pressed.spec.ts`, and QA repeats the phone hold and tap for those two buttons.

## Impact
On a phone, the two most consequential buttons (Calculate, and Delete; Approve uses the primary look too) give no visible confirmation that a tap registered, which invites double taps. Nothing is blocked.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
