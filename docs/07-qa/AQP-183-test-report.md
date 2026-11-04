# Test Report — AQP-183 (DEF-008): pressed state on every button variant

| Field | Value |
|-------|-------|
| Tester | qa-engineer, with the delivery lead for the phone check |
| Build / commit | `a13f194` (PR #56, head branch `docs/AQP-183-pressed-state`; a code PR by master's ruling DL-069) |
| CI | Run 41836397047 on `a13f194`: success on stages 1 to 12 (stage 12 is E2E: Chromium at three widths, plus axe). This is the regression reference; the PC was busy, so no full local regression was run |
| Environment | Local E2E: Windows 11, Node v24.19.0, Chromium (Playwright 1.64.1), in a separate worktree `C:\Users\sanku\Documents\Accucut-AQP-183-phone` (detached at `a13f194`). Phone: the delivery lead's iPhone 17 Pro Max, iOS 27.0.1, Chrome 155, office Wi-Fi, served by `npx next dev -H 0.0.0.0` from that worktree |
| Date | 2026-11-04 |
| **Recommendation** | **REJECT.** On the device the pressed state of the **primary (Calculate)** and **danger (Delete)** buttons is not perceptible, either held or tapped (DEF-010, AQP-185, #64, Sev-3). It is a design-level shortfall in the UX spec values, not a code fault: the code applies the spec, and `:active` works on iOS WebKit. Secondary, ghost, both pencil buttons, disabled and loading pass. G6 condition 4 (a `touchstart` listener) is **not** needed |

## Summary

DEF-008: on a touch screen, no button showed that it had been tapped. PR #56 adds a pressed look (`:active`) to every button variant: a pressed fill, the text colour, and the inset `--shadow-pressed`. It sits outside the hover media query and wins over hover. Disabled and loading buttons show nothing.

In Chromium the computed pressed look is verified at all three widths (45 of 45, no retries). On the delivery lead's iPhone, the secondary, ghost and icon variants show their pressed look and flash on a tap. Disabled and loading show no pressed state. That proves `:active` applies on iOS WebKit (QLT-29's concern).

The primary and danger buttons, however, change too little to be seen: their pressed fill moves by 1.30:1 and 1.37:1 against the rest fill, both dark reds on which the graphite inset shadow barely shows. The ux-expert needs to set stronger pressed values for these two in UX spec section 7.3.1.

## G7 condition 3a — the E2E spec with no retries

| Command | Projects | Result |
|---------|----------|--------|
| `npx playwright test tests/e2e/button-pressed.spec.ts --retries=0` | mobile 360x800 (touch), tablet 768x1024 (touch), desktop 1366x768 | **45 passed, 0 failed, 0 retried** (5.7 min; 15 tests per project) |

Per project, the spec covers:
- **The six sample buttons:** Calculate, Add part, Cancel, Delete, the 44 px pencil (Edit part) and the 36 px row pencil (Edit row). Pointer down shows the pressed fill, text and inset shadow; release takes the shadow away; the size does not change.
- **The three disabled samples:** Approve and lock, Download Excel, and Calculating (loading). Pointer down shows no pressed state.

The Playwright server was started fresh: ports 3000 and 3100 were checked free first.

## G7 condition 3b — on the delivery lead's iPhone

Page `/design-system`, section 05 "Buttons", served from the worktree at `a13f194`. The delivery lead's first attempt used their main folder, which has the old code without the fix; it is set aside. Results are in their own typed words, as relayed by the orchestrator. "Hold" means about a second; "tap" means a quick tap.

| # | Button | Action | Expected | Delivery lead's words | Result |
|---|--------|--------|----------|-----------------------|--------|
| 1 | Calculate (primary) | Hold | Darker red fill and inside shadow | "the pressed-in state for both 'Calculate' and 'Delete' buttons are not very clear." | ❌ Fail (DEF-010) |
| 2 | Calculate | Tap | Brief flash | "Calculate and Delete - I do not see brief flash." | ❌ Fail (DEF-010) |
| 3 | Add part (secondary) | Hold | Grey fill and inside shadow | "I retested the fix - 'Add Part' and 'Cancel' buttons looks good." | ✅ Pass |
| 4 | Add part | Tap | Brief flash | "Rest looks good" | ✅ Pass |
| 5 | Cancel (ghost) | Hold | Pale pink fill, dark text, inside shadow | "I retested the fix - 'Add Part' and 'Cancel' buttons looks good." | ✅ Pass |
| 6 | Cancel | Tap | Brief flash | "Rest looks good" | ✅ Pass |
| 7 | Delete (danger) | Hold | Deeper red fill and inside shadow | "the pressed-in state for both 'Calculate' and 'Delete' buttons are not very clear." | ❌ Fail (DEF-010) |
| 8 | Delete | Tap | Brief flash | "Calculate and Delete - I do not see brief flash." | ❌ Fail (DEF-010) |
| 9 | Pencil, 44 px | Hold | Grey fill and inside shadow | "yes, pencil button looks good" | ✅ Pass |
| 10 | Pencil, 44 px | Tap | Brief flash | "Rest looks good" | ✅ Pass |
| 11 | Pencil, 36 px row | Hold | Grey fill and inside shadow | "that looks good too" | ✅ Pass |
| 12 | Pencil, 36 px row | Tap | Brief flash | "Rest looks good" | ✅ Pass |
| 13 | Approve and lock (disabled) | Tap, then hold | Nothing changes | On the PC: "I a not able to tap on that button. The cursor changes to Red Circle with a red line cross." On the iPhone: "In mobile, When I tap nothing happens. But when I hold - it selects the text on the button and giving the tool tip menu to copy the text." | ✅ Pass for the pressed state (none shown). Long-press text selection: OBS-2 |
| 14 | Calculating (loading) | Tap, then hold | Nothing changes | "Calculating button - behavior is same as Approve and Lock button. When I tap nothing happens. But when I hold - it selects the text on the button and giving the tool tip menu to copy the text." | ✅ Pass for the pressed state (none shown). Long-press text selection: OBS-2 |

**Result:** 8 of 12 pressed checks pass (secondary, ghost, both pencils) and 4 fail (primary and danger, held and tapped); 2 of 2 disabled and loading checks pass.

## Why the primary and danger buttons fail (QA measurement)

| Variant | Rest | Pressed | Contrast rest:pressed | RGB distance | On the device |
|---|---|---|---|---|---|
| Primary (Calculate) | `#DE3030` | `#BF2626` | 1.30:1 | 34 | not clear |
| Danger (Delete) | `#B3261E` | `#8F1C13` | 1.37:1 | 39 | not clear |
| Secondary (Add part, pencils) | `#FFFFFF` | `#D9DADF` | 1.40:1 | 62 | good |
| Ghost (Cancel) | `#FFFFFF` | `#F2B8B8` | 1.70:1 | 101 | good |

The two failing variants change the least, and both are saturated dark reds, on which the inset shadow (`rgba(23, 24, 28, 0.28)`) is close to invisible. The values are those of UX spec v0.9 section 7.3.1, and the code applies them exactly (E2E above). So the remedy is in the spec values, then in `button.tsx` and the E2E tokens.

## Regression

CI run 41836397047 on `a13f194`: all stages 1 to 12 succeeded:
- secret scan, data-file check, lint, type-check;
- unit tests with coverage, dependency audit, licences;
- build, migrations and drift check;
- integration tests, changed-code coverage;
- E2E at three widths with axe.

No full local regression was run, by instruction: the PC was busy.

## Defects

| ID | Title | Severity | Status | Linked |
|----|-------|----------|--------|--------|
| DEF-010 ([AQP-185](https://sankumar76.atlassian.net/browse/AQP-185), [#64](https://github.com/sankumar76/Accucut-Quotation/issues/64)) | The pressed state of the primary (Calculate) and danger (Delete) buttons is not perceptible on the iPhone | Sev-3, type Product (design-level) | New | AQP-183 G7 condition 3; UX spec 7.3.1 |
| DEF-008 (AQP-183, #54) | The defect under test | Sev-3 | Reopened: fixed for four of six variants | |

Open: Sev-1 0, Sev-2 0, Sev-3 1 (DEF-010), Sev-4 0. The DEF-008 record is updated with this outcome.

## Observations (not defects)

| ID | Observation | Suggested home |
|----|-------------|----------------|
| OBS-1 (from AQP-38) | **iOS zoom on 14 px fields: not confirmed.** The delivery lead tapped the editable "Length" field in section 06: "Length field- on mobile, tap opened the keyboard", and the page did not zoom ("Nothing happend on tap"). Seen on iPhone 17 Pro Max, iOS 27.0.1, Chrome 155. No defect | None |
| OBS-2 | **Long-press on a button selects its text and shows the copy callout** on the iPhone, seen on the disabled "Approve and lock" and the loading "Calculating" button: "when I hold - it selects the text on the button and giving the tool tip menu to copy the text." Holding a field's value also selected the text, which is normal for a field. For buttons, the usual remedy is `user-select: none` and `-webkit-touch-callout: none` on the button base. Whether the enabled buttons do the same was not asked | ux-expert: decide whether buttons should refuse text selection and the callout (UX spec section 7.3), then developer |
| OBS-3 | On the PC, the disabled button shows the not-allowed cursor ("Red Circle with a red line cross"), as `disabled:cursor-not-allowed` intends | None |

## Next

1. **ux-expert:** set pressed values for primary and danger in UX spec section 7.3.1 that are perceptible on a phone (DEF-010). Decide on OBS-2.
2. **developer:** apply them in `button.tsx` and the expected tokens of `tests/e2e/button-pressed.spec.ts`.
3. **QA:** repeat the phone hold and tap for Calculate and Delete only (and OBS-2 if changed). The other results stand.
4. The phone development server can be stopped now. A later re-check uses the same worktree after the fix is pulled into it.

## Hand-off
- Status: COMPLETE
- Recommendation (G7): REJECT (primary and danger pressed states not perceptible; Sev-1 0, Sev-2 0, Sev-3 1: DEF-010, Sev-4 0)
- Jira / GitHub: AQP-185 and #64 (DEF-010) created and linked; AQP-183 moved to Rejected (In Progress); summaries on AQP-183 and PR #56
- Story status: AQP-183 moved to In Progress (Rejected)
