# DEF-008: buttons show no pressed state on a touch screen (UX 7.3 says --primary-hover is the hover and pressed colour)

| Field | Value |
|-------|-------|
| Story / AC | AQP-28 (STORY-10.02) / AC-5 (the button set); UX spec v0.8 section 7.3 |
| Severity | Sev-3 Moderate |
| Priority | P3 |
| Type | Product |
| Status | New |
| Found by / date | delivery lead at the AC-9 phone check (step B4), 2026-11-04; analysed by qa-engineer |
| Build / commit | `e6053ce` on `feat/AQP-28-tokens-and-shell` (development server, `next dev -H 0.0.0.0`) |
| Environment | iPhone 17 Pro Max, iOS 27.0.1, Google Chrome 155.0.8059.37, office Wi-Fi |
| Jira / GitHub | [AQP-183](https://sankumar76.atlassian.net/browse/AQP-183) / [#54](https://github.com/sankumar76/Accucut-Quotation/issues/54) |

## Steps to Reproduce
1. On a phone, open `/design-system`.
2. Scroll to the section Buttons.
3. Tap Calculate, Add part, Cancel, Delete and the square pencil button.

## Expected Result
UX spec v0.8 section 7.3, colour table: `--primary-hover` #BF2626, use "Hover and pressed". A tap on the primary (main) button shows the pressed colour while the finger is down.

## Actual Result
No visible change on tap for any variant. The delivery lead's words: "I can tap on each, but I don't see button getting highlighted in some way to show that I tapped on the button." The buttons are display samples with no action, which is expected; the missing feedback is not.

## Evidence
- `src/components/ui/button.tsx` lines 19 to 22: each variant sets `hover:` colours only; there is no `active:` class.
- Built CSS (`npx next build`, Tailwind 4.3.3): `.hover\:bg-primary-hover:hover` sits inside `@media (hover:hover)`, so a touch-only screen never matches it; the stylesheet has 0 `active:` rules.
- The mock-up (`docs/03-ux/screens/screens.css`) has no `:active` rule either, so the spec table is the only statement of the pressed state.

## Suspected Area
`src/components/ui/button.tsx`: add `active:` colours per variant (primary `active:bg-primary-hover`; for danger, secondary and ghost the spec names no pressed colour, so the developer asks ux-expert, for example `active:bg-danger-ink`, `active:bg-surface-2`, `active:bg-primary-soft`). Add an E2E check on the touch projects that the pressed colour applies while the pointer is down.

## Impact
No task is blocked and every action is reachable. A person on a phone gets no sign that a tap registered, which invites a second tap on real actions once they exist (Calculate, Approve and lock). It does not hold G7 (Sev-3); it should be fixed before the first story with a real action on a phone (05.09) or accepted in writing by the master.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |
