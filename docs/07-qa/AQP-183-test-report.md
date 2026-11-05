# Test Report — AQP-183 (DEF-008): pressed state on every button variant

| Field | Value |
|-------|-------|
| Tester | qa-engineer, with the delivery lead for the phone check |
| Build / commit | **Attempt 2: `1a785db`** (PR #56, head branch `docs/AQP-183-pressed-state`, after the DEF-010 fix `0cfaf78`, the refactor `001e521` and the merge of `master`). Attempt 1: `a13f194`. A code PR by master's ruling DL-069 |
| CI | **Attempt 2:** run 41921509846 on `1a785db`, green (stages 1 to 12). Attempt 1: run 41836397047 on `a13f194`, green |
| Environment | Local E2E: Windows 11, Node v24.19.0, Chromium (Playwright 1.64.1), in a separate worktree `C:\Users\sanku\Documents\Accucut-AQP-183-phone` (detached at the commit under test). Phone: the delivery lead's iPhone 17 Pro Max, iOS 27.0.1, Chrome 155, office Wi-Fi, served by `npx next dev -H 0.0.0.0 -p 3000` from that worktree. Attempt 2 needed sign-in (AQP-38): a throwaway database (Compose `qa183p`, port 55583, since removed) with the invented E2E users |
| Date | 2026-11-04 (attempt 1 and attempt 2) |
| **Recommendation** | **Attempt 2: ACCEPT.** On the iPhone the primary (Calculate) and danger (Delete) buttons now turn "a clearly darker color" when held and show "a brief flash" when tapped. A long press selects no text, shows no callout or magnifier, and leaves disabled and loading buttons unchanged. E2E 45 of 45 with no retries; CI green. The first attempt-2 session reported the old behaviour; the later session did not reproduce it (see "Attempt 2"). DEF-010 can close on master's G7 GO; OBS-2 is resolved. *Attempt 1: REJECT (DEF-010).* |

## Summary

DEF-008: on a touch screen, no button showed that it had been tapped. PR #56 adds a pressed look (`:active`) to every button variant: a pressed fill, the text colour, and the inset `--shadow-pressed`. It sits outside the hover media query and wins over hover. Disabled and loading buttons show nothing.

In Chromium the computed pressed look is verified at all three widths (45 of 45, no retries). On the delivery lead's iPhone, the secondary, ghost and icon variants show their pressed look and flash on a tap. Disabled and loading show no pressed state. That proves `:active` applies on iOS WebKit (QLT-29's concern).

The primary and danger buttons, however, change too little to be seen: their pressed fill moves by 1.30:1 and 1.37:1 against the rest fill, both dark reds on which the graphite inset shadow barely shows. The ux-expert needs to set stronger pressed values for these two in UX spec section 7.3.1.

## Attempt 2 (G7 re-check on `1a785db`, master's G6 re-check, Jira 10858)

### What changed since attempt 1

- **DEF-010 fix, `0cfaf78`, per UX spec 7.3.1 as revised by the ux-expert.** Darker pressed fills: primary `#7F1616` (was `#BF2626`) and danger `#520F09` (was `#8F1C13`).
- **Instant press.** `active:transition-none` on press, then a 200 ms fade on release.
- **No text selection or iOS callout on buttons.** `select-none` and `[-webkit-touch-callout:none]` (`NO_TOUCH_CALLOUT`, renamed in `001e521`).

| Variant | Rest | Pressed (attempt 2) | Contrast rest:pressed | RGB distance | Attempt 1 |
|---|---|---|---|---|---|
| Primary (Calculate) | `#DE3030` | `#7F1616` | **2.25:1** | 102 | 1.30:1, 34 |
| Danger (Delete) | `#B3261E` | `#520F09` | **2.25:1** | 102 | 1.37:1, 39 |

### Automated check (d)

| Command | Projects | Result |
|---------|----------|--------|
| `npx playwright test tests/e2e/button-pressed.spec.ts --retries=0` on `1a785db` | mobile, tablet, desktop | **45 passed, 0 failed, 0 retried** (15 per project, plus the sign-in set-up; 8.4 min). Ports 3100 and 3101 were checked free; throwaway database `qa183p` |

### On the delivery lead's iPhone

The page was `/design-system`, section 05 "Buttons", served from the phone worktree at `1a785db`, signed in as the invented `e2e.lead@example.test`. Answers are in the delivery lead's own words, relayed by the orchestrator, in order.

**First session (not reproduced later).** On item (a), the delivery lead wrote: "Looks good on the PC. but I issue doesn't seem to be fixe on mobile. I still see the same behavior as last time". They confirmed it was the new version: "yes, I did get the sign-in page first and I signed in with e2e.lead@example.test".
- This is recorded as observed. A stale page or cached assets on the phone is a likely cause, because the same folder and server served attempt 1's code earlier that day. That cause is **not confirmed**.
- No defect is raised: the later session on the same server and commit did not reproduce it.

**Later session** (same server, signed in again after the 12-hour session window):

| # | Check | Expected | Delivery lead's words | Result |
|---|-------|----------|-----------------------|--------|
| 0 | Diagnostic: "Add part" | Pressed look, as in attempt 1 | "iPhone validation - looks good now" | ✅ |
| (a) | Hold Calculate and Delete for about a second | Clearly darker pressed colour | "yes, it turns a clearly darker color as expected when I hold it" | ✅ Pass |
| (b) | Quick-tap Calculate and Delete | A visible brief flash | "yes, I see a brief flash when I tap" | ✅ Pass |
| (c1) | Long press (about 2 s) on Calculate, Delete, Approve and lock, Calculating: text selected? | No | "The text doesn't get selected or highlighted, as expected" | ✅ Pass |
| (c2) | Same: copy callout or magnifier? | No | "No" | ✅ Pass |
| (c3) | Disabled and loading: any change of look while held? | No | "No, it doesn't" | ✅ Pass |

**Result:** 5 of 5 checks pass in the later session. Together with attempt 1's passes for secondary, ghost and both pencils, which this fix did not change, all six variants now show a perceptible pressed state on the device. Disabled and loading show none.

### Regression

- CI run 41921509846 on `1a785db` succeeded on stages 1 to 12, including E2E at three widths with axe.
- The local `button-pressed.spec.ts` run above passed.
- No full local regression was run, because the PC is shared.

## Attempt 1

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
| DEF-010 ([AQP-185](https://sankumar76.atlassian.net/browse/AQP-185), [#64](https://github.com/sankumar76/Accucut-Quotation/issues/64)) | The pressed state of the primary (Calculate) and danger (Delete) buttons is not perceptible on the iPhone | Sev-3, type Product (design-level) | **Attempt 2: fixed and verified on the device.** It closes on master's G7 GO | AQP-183 G7 condition 3; UX spec 7.3.1 |
| DEF-008 (AQP-183, #54) | The defect under test | Sev-3 | **Attempt 2: fixed for all six variants** (attempt 1: four of six) | |

Open after attempt 2: Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0. DEF-010 stays open only until master's G7 decision.

## Observations (not defects)

| ID | Observation | Suggested home |
|----|-------------|----------------|
| OBS-1 (from AQP-38) | **iOS zoom on 14 px fields: not confirmed.** The delivery lead tapped the editable "Length" field in section 06: "Length field- on mobile, tap opened the keyboard", and the page did not zoom ("Nothing happend on tap"). Seen on iPhone 17 Pro Max, iOS 27.0.1, Chrome 155. No defect | None |
| OBS-2 | **Long-press on a button selects its text and shows the copy callout** on the iPhone, seen on the disabled "Approve and lock" and the loading "Calculating" button: "when I hold - it selects the text on the button and giving the tool tip menu to copy the text." Holding a field's value also selected the text, which is normal for a field. For buttons, the usual remedy is `user-select: none` and `-webkit-touch-callout: none` on the button base. Whether the enabled buttons do the same was not asked | ux-expert: decide whether buttons should refuse text selection and the callout (UX spec section 7.3), then developer. **Attempt 2: resolved.** Buttons now use `select-none` and `-webkit-touch-callout: none`. On the iPhone, a long press on Calculate, Delete, Approve and lock and Calculating selects no text and shows no callout or magnifier |
| OBS-3 | On the PC, the disabled button shows the not-allowed cursor ("Red Circle with a red line cross"), as `disabled:cursor-not-allowed` intends | None |

| OBS-4 (attempt 2) | **First phone session showed the old behaviour; later session did not.** The delivery lead's first attempt-2 session reported "the same behavior as last time" on Calculate and Delete, while signed in on the new version. The later session on the same server and commit passed every check. A stale page or cache on the phone is a likely cause; it is not confirmed | None. If it recurs on a later phone check, reload the page with an empty cache before judging |

## Next (attempt 2)

1. **master:** G7 decision on AQP-183 at `1a785db` with this report's commit.
2. **QA, on GO:** close DEF-010 (AQP-185, #64) and move AQP-183 to Done.
3. The phone development server and `qa183p` are stopped and removed.

## Next (attempt 1, done)

1. **ux-expert:** set pressed values for primary and danger in UX spec section 7.3.1 that are perceptible on a phone (DEF-010). Decide on OBS-2.
2. **developer:** apply them in `button.tsx` and the expected tokens of `tests/e2e/button-pressed.spec.ts`.
3. **QA:** repeat the phone hold and tap for Calculate and Delete only (and OBS-2 if changed). The other results stand.
4. The phone development server can be stopped now. A later re-check uses the same worktree after the fix is pulled into it.

## Hand-off (attempt 2)
- Status: COMPLETE
- Recommendation (G7): **ACCEPT.** Primary and danger pressed states are now perceptible on the iPhone; long press selects nothing and shows no callout; disabled and loading are unchanged. E2E 45 of 45 with no retries; CI 41921509846 green. Open: Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0
- Jira / GitHub: summaries on AQP-183 and PR #56. DEF-010 (AQP-185, #64) closes on master's G7 GO

## Hand-off (attempt 1)
- Status: COMPLETE
- Recommendation (G7): REJECT (primary and danger pressed states not perceptible; Sev-1 0, Sev-2 0, Sev-3 1: DEF-010, Sev-4 0)
- Jira / GitHub: AQP-185 and #64 (DEF-010) created and linked; AQP-183 moved to Rejected (In Progress); summaries on AQP-183 and PR #56
- Story status: AQP-183 moved to In Progress (Rejected)
