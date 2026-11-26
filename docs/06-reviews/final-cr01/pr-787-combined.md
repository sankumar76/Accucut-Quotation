# Review Report — PR #787 (AQP-459 / DEF-102, the reveal half: the show / hide password button inside the field) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review, CLAUDE.md §9 item 2: authentication and passwords; DL-419 (E)) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-459-password-reveal` (PR [#787](https://github.com/sankumar76/Accucut-Quotation/pull/787)), 1 behind `master` (`6b6e8e6b`, #778, which touches none of the 4 files) |
| Commit reviewed | `51070109` |
| Date | 2026-11-26 |
| Reviewed against | Jira AQP-459 (DEF-102); ux-expert ruling, item (1) of "four questions from lane 3", the dated note at the end of `docs/03-ux/rulings/conformance-check-2026-11-28.md` (records-u `212429b2`); DL-419 (E) check list, DL-419 (C), DL-422 (records-u decision log); `docs/standards/coding-standards.md` §1, §3, §5, §6; precedent `pr-715-combined.md` |
| **Verdict** | **APPROVE WITH COMMENTS**: no Blocker, Critical or Major finding. CI run 45798949161 is fully green at the head |

## Summary

One shared control changes, and all ten password forms get it. The eye button now sits inside the field at its right edge. It is `type="button"`, has the same accessible names as before, keeps `aria-pressed`, and is the field's height. The input keeps its `name`, `id`, `autoComplete` and every caller prop; only the type flips, as before. The password is hidden again on three triggers:

- **Submit:** a native listener on the enclosing `<form>`. All ten importers render the field inside a `<form onSubmit>`, checked one by one.
- **Error:** the field turning `aria-invalid`. `FormField` always wires `aria-invalid`, and the state is adjusted while rendering.
- **Leaving the page:** `pagehide`.

A client-side navigation unmounts the control, so its state is gone.

The submit path is proven in a real browser, and that is the strongest part of the PR. A failed sign-in shows only a notice and never sets `aria-invalid` on the password field (`sign-in-form.tsx:105`). So the E2E assertion at `sign-in.spec.ts:118-120` can pass only through the submit listener. React 19.3.1 treats `submit` as a discrete event, so the type is `password` again before the request returns.

I found four Minors and nothing that blocks the merge:

- **SEC-787-01:** the `pagehide` reset is scheduled, not committed. React gives `pagehide` default priority, so a page frozen into the back/forward cache still holds `type="text"` in its DOM.
- **QLT-787-01:** Microsoft Edge draws its own reveal eye (`::-ms-reveal`) inside password fields. Nothing in `src/` hides it, so Edge users may now see two eyes side by side in one field, and our reset does not reset Edge's.
- **QLT-787-02:** the toggle stays enabled while the field is disabled during a pending request.
- **QLT-787-03:** in the error state the field's border is 2 px, so the button's hover and pressed fill covers its inner 1 px.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 4 |
| Info | 4 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Diff | `gh pr diff 787`; full `password-input.tsx` at `51070109`; `button.tsx`, `input.tsx`, `form-field.tsx`, `globals.css` focus and size tokens at the head | 4 files, +218/−11, matches the PR file list. `Button` already defaults `type` to `button`, and the explicit `type="button"` is kept |
| Importers | `git grep PasswordInput 51070109 -- src` | 10 forms: sign-in, change own password (`change-password-parts.tsx`), delete field, formula password, revert, cancel estimate, remove price, hand-over, Admin reset password, user form. **Every one renders the field inside a `<form noValidate onSubmit>`**, so the submit reset reaches all ten. Each uses `{...control}` from `FormField` (or the same pattern), so `aria-invalid` arrives |
| CI | `gh run view 45798949161` | **success** at `51070109c81c…`: Stages 1 to 11, 1 to 11b, E2E shards 1 to 4 |
| Master drift | `git log 51070109..origin/master`; name-only diff | 1 commit (#778): no password, button, input, globals or touched-spec file. Updating the branch before merge carries no conflict risk for this review |
| Unit tests at head | `npx vitest run tests/unit/password-input.test.ts tests/unit/compact-layout.test.ts` (worktree `aqp-402`, read-only) | **2 files, 20 tests passed** (10 new) |
| React event priority (SEC-787-01, SEC-787-02) | read `getEventPriority` and `resolveUpdatePriority` in `react-dom-client.development.js` 19.3.1 | `submit` is in the **discrete** list (synchronous commit). `pagehide` is in no list, so its update is **default** priority (a scheduler task) |
| Edge reveal (QLT-787-01) | `grep -rn "ms-reveal" src/` | no match. **Not reproduced**: CI's Playwright Chromium does not draw `::-ms-reveal`, and no Edge was run here |
| Sign-in throttling from the new failed attempt | `sign-in.spec.ts:18-19`, `unknownEmail(testInfo)` | each test has its own client address and an invented unknown e-mail, so the extra failed attempt per width cannot lock anything else |
| DL-422 person count | PR body; `grep -c createDisposableUser\|createUser\|signInAs` over the diff | **0** new calls, and no case added, removed or renamed. **+0** before `users.spec.ts:58`, as the body states |
| DL-419 (C) overlays | diff | no portal, popover or overlay. The button is positioned inside the field's own wrapper. **Not applicable** |
| Secrets / fixtures | diff and PR body | invented values only (`an-invented-wrong-password`, `invented-class`). No value is held, logged or put in a URL |
| Lint, type-check, build, E2E locally | not run locally (§9 item 5: heavy browser tests run in CI) | CI is the record |

## Findings

| ID | Severity | File:line | Rule / check | Issue | Why (impact) | Fix |
|----|----------|-----------|--------------|-------|--------------|-----|
| SEC-787-01 | Minor | `src/components/shared/password-input.tsx:51` (with `:24-27`) | DL-419 (E) "visibility reset on navigation (pagehide)" | **The `pagehide` reset is scheduled, not committed, before the page is frozen.** `setShown(false)` runs in a native `pagehide` listener. React 19 takes the priority from `window.event.type`, and `pagehide` is not a discrete event, so the update gets default priority (a scheduler task). When the browser puts the page in the back/forward cache, the DOM it keeps still has `type="text"`. On return, the task runs at some point after `pageshow`, and nothing guarantees that is before the first paint. The submit reset is not affected (`submit` is discrete). | Narrow: it needs a page that is cached (many of these pages are `no-store`, and Chrome and Firefox often skip those), and the person who chose to show the password on the same device. Even then the password can show for a frame or more on Back. But the check list names this case, and the unit test proves only that the listener is called, not that the DOM changes. | Commit synchronously: `useEffect(() => hideWhenLeft(box.current, () => flushSync(() => setShown(false))), [])` (import `flushSync` from `react-dom`). This is safe here because the listener never runs during a render. **Test that catches it:** E2E on sign-in: show the password, then `page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); return document.querySelector('#password')?.getAttribute('type'); })` must return `'password'` in the same task. **When:** this PR if quick, otherwise the hardening window |
| QLT-787-01 | Minor | `src/components/shared/password-input.tsx:54` | ux ruling (1): one eye inside the field; DL-419 (E) reset | **Edge's own reveal button is not hidden.** Chromium Edge draws a native eye (`::-ms-reveal`) inside a password field once a value is typed. It sits in the content box, which now ends 44 px before our button, so two eyes appear side by side inside the field. Edge's reveal also masks and unmasks without changing `type`, so our `aria-pressed`, our names and the submit, error and `pagehide` resets do not cover it. **Not reproduced** (no Edge here; CI is Chromium). The pseudo-element is Microsoft's documented hook for this. | R1 runs on a local Windows server, and Edge is Windows' default browser. A duplicated control in the place the ruling just fixed would show at the customer review, and a second reveal state would go untracked. | Add `[&::-ms-reveal]:hidden` to the input's class: `cn('pr-(--control-h) compact-fine:pr-(--compact-field-h) [&::-ms-reveal]:hidden', className)`. **Test:** a unit assertion on the class, and a manual check in Edge at the next local run or demo. **When:** this PR (one class) preferred |
| QLT-787-02 | Minor | `src/components/shared/password-input.tsx:55-62` | consistency; UX states | **The toggle stays enabled while the field is disabled.** Seven importers pass `disabled={pending}` (or `saving`). The input greys out, but the ghost eye drawn inside it stays live and coloured. This behaviour existed before, but now the button sits inside a disabled-looking field. | A control that looks part of a disabled field but still responds. Cosmetic, plus a small chance of revealing the password while a request is in flight. | `disabled={props.disabled}` on the `Button`. The submit has already hidden the password, so nothing is stranded in the shown state. **Test:** unit: `mount({ disabled: true })` gives a button with `disabled: true` |
| QLT-787-03 | Minor | `src/components/shared/password-input.tsx:59` | ux ruling (1): "the fill stops inside the field's border" | **In the error state the fill covers half of the border.** `Input` turns `aria-invalid:border-2`, but the button keeps a **1 px** transparent border with `bg-clip-padding`. So `hover:bg-primary-soft` and `active:bg-primary-line` paint over the inner 1 px of the red 2 px border on the top, right and bottom of the button's area. | Cosmetic, and only on hover or press while the field shows an error: the red border looks notched at the eye. | Put `peer` on the input and add `peer-aria-invalid:border-y-2 peer-aria-invalid:border-r-2` to the button (the input comes before the button in the DOM, so `peer` works). **Test:** unit class assertion; optionally a screenshot in the error state |
| SEC-787-02 | Info | `password-input.tsx:24-31`, `:51`; `sign-in.spec.ts:113-120` | DL-419 (E): reset on submit; password managers | **Sound, and proven in a browser.** The submit listener is native on the `<form>`, so it fires whatever React's `onSubmit` does, `preventDefault` included. `submit` is discrete, so the type is `password` again before the request returns. A failed sign-in never sets `aria-invalid` on this field, so the E2E can pass only by this path. The input stays one `input` with the same `name`, `id` and `autocomplete`, and the button comes after it. | none | none |
| QLT-787-04 | Info | `password-input.tsx:24`; `tests/unit/password-input.test.ts:139` | coding standards §1 (clarity) | `hideWhenLeft` is typed `(() => void) \| undefined` but always returns a function, so callers write `stop?.()` for nothing. `void form;` at test `:139` is noise. | Readability only | Return type `() => void`; drop `void form;`. Cross-reference for reviewer-standards |
| QLT-787-05 | Info | `tests/unit/password-input.test.ts:106-133`, `:135-153` | §6 test adequacy | The error reset and the `pagehide` reset are proven at unit level only, with a hook harness and fake event targets. The real-DOM wiring (`box.current.closest('form')`) is covered by the sign-in E2E for submit only. Several unit cases pin Tailwind class strings. That is brittle, but deliberate here: they pin the ruling's geometry, and the E2E box assertions back them at three widths. | Acceptable for the scope; SEC-787-01's test would close the `pagehide` gap | Optional, with SEC-787-01 |
| QLT-787-06 | Info | `password-input.tsx:55-59` | password managers | Extension password managers (1Password, Bitwarden and others) put their own icon at an input's right edge, so it may overlap the eye. This is common to every in-field reveal and does not change the field contract the check list asks to keep. | none for the built-in managers | none; watch at the customer review |

## Security notes (the §9 item 2 focus: DL-419 (E) check list)

| Check | Result | Evidence |
|-------|--------|----------|
| `autocomplete` kept (`current-password` / `new-password`) | **Yes** | `{...props}` reaches the input unchanged, except that `className` is merged and `type` is set. Unit `:77` keeps `name`, `id`, `autoComplete: 'new-password'`, `aria-describedby` and `required`. The sign-in E2E "the fields name the browser's helpers" is unchanged and green |
| Reset to hidden on submit | **Yes** | `:24-31`; all 10 importers are inside a `<form onSubmit>`; unit `:135`; **browser-proven** at `sign-in.spec.ts:113-120` (SEC-787-02) |
| Reset on navigation (`pagehide`) | **Yes, not synchronous** | Client-side navigation unmounts the control. The `pagehide` path is wired and unit-tested with fakes, but the commit is deferred (SEC-787-01) |
| Reset on error | **Yes** | Render-time adjustment at `:44-49` when `aria-invalid` turns true (React's documented "adjust state on prop change" pattern). Clearing the error does not show the password again. Unit `:106`. A repeated error while the field is already invalid is covered by the submit reset |
| No password in a URL, log, analytics, error message or fixture | **Yes** | The control holds no value (unit `:83`), and the diff adds no logging, URL or analytics. The E2E uses invented strings only, through the existing sign-in route |
| `type="button"`, never submits | **Yes** | `:56` (and `Button`'s own default); unit `:68` |
| `aria-pressed` and accessible name | **Yes** | `:60-61`; unit `:68`, `:95`; E2E sign-in `:93-104` and account `:198-209`, with the same words as before |
| Focus order and focus ring | **Yes** | The button follows the input in the DOM, so the tab order is unchanged. The global `:focus-visible` outline (3 px, offset 2 px, `globals.css:314-316`) is drawn outside both boxes, and the wrapper does not clip it. The keyboard cases at three widths are unchanged and green |
| Password managers still recognise the field | **Yes** (QLT-787-01 for Edge's built-in reveal; QLT-787-06 for extension icons) | Same element, attributes and order. Only the button moved |
| Unit + E2E on sign-in and one change form at three widths, with axe | **Yes** | `sign-in.spec.ts` and `account.spec.ts` existing cases (axe, 44 px, no sideways scroll, keyboard) at 360, 768 and 1366 px, now with box containment. CI green |
| Target size (WCAG 2.5.8, NFR-017) | **Yes** | The button is `inset-y-0 h-auto`, so it is the field's height (44 px, or 36 px only under `compact-fine:`). Width is `--control-h` / `--compact-field-h`. Inside portalled dialogs `compact-fine:` does not apply, so the input and button there stay consistent at 44 px |
| DL-419 (C) overlay rule | **Not applicable** | no overlay or portal is added |
| DL-422 person count | **+0** | stated in the body, and confirmed from the diff |

## Reviewer-specific tables

### Acceptance conformance (ux ruling item (1) and DL-419 (E) → code → test)

| Criterion | Code | Test(s) | Status |
|-----------|------|---------|--------|
| Eye button inside the field at its right edge | `:53-59` (`relative` wrapper; `absolute inset-y-0 right-0`); input `pr-(--control-h)` keeps typed text clear | unit `:49`; E2E sign-in `:106-111` (x and y containment), account `:203-207` (x) at 3 widths | Met (QLT-787-01 for Edge) |
| `aria-label` "Show password" / "Hide password", `aria-pressed` | `:60-61` | unit `:68`, `:95`; E2E sign-in, account | Met |
| `type="button"` | `:56` | unit `:68` | Met |
| Fills the field height minus border; 36 px fine pointer, 44 px touch | `:59` (`h-auto` + `inset-y-0`, transparent 1 px border, `bg-clip-padding`, `compact-fine:w-(--compact-field-h)`) | unit `:49`, `:61`; E2E 44 px cases | Met (QLT-787-03 in the error state) |
| One component change serves all ten forms | single file; 10 importers unchanged | each form's existing E2E and axe run (CI green) | Met |
| Reset on submit / navigation / error | `:24-31`, `:44-51` | unit `:106`, `:135`, `:147`; E2E sign-in `:113-120` | Met (SEC-787-01: `pagehide` not synchronous) |
| `autocomplete` and field contract kept | `:41`, `:54` | unit `:77`, `:89` | Met |
| No password in URL, log, fixture | no such code | unit `:83`; diff read | Met |

### Finding → code → test

| Finding | Code | Test that would catch it |
|---------|------|--------------------------|
| SEC-787-01 | `password-input.tsx:51` | E2E: dispatch `pagehide` in `page.evaluate` and read the input's `type` in the same task → `'password'` |
| QLT-787-01 | `password-input.tsx:54` | unit class assertion `[&::-ms-reveal]:hidden`; manual check in Edge |
| QLT-787-02 | `password-input.tsx:55-62` | unit: `mount({ disabled: true })` → button `disabled: true` |
| QLT-787-03 | `password-input.tsx:59` | unit class assertion `peer-aria-invalid:border-y-2`; optional error-state screenshot |
| SEC-787-02, QLT-787-04..06 | as listed | n/a |

## Issues for other roles

- **developer:** QLT-787-01 (one class) and QLT-787-02 (one prop) are worth taking in this PR. SEC-787-01 is a one-line change plus one E2E step inside the existing sign-in case (still +0 persons), so take it in this PR if it fits before the Wed 2 Dec cut-off, otherwise in the hardening window. QLT-787-03 is cosmetic and can go to the hardening window. None blocks the merge.
- **ux-expert:** confirm that a disabled field should also disable its eye (QLT-787-02). In the CR-01 session, draw the error state of the in-field eye (QLT-787-03).
- **qa-engineer:** at the next local run or the demo, look at the sign-in page in Microsoft Edge and confirm one eye only (QLT-787-01).
- **reviewer-standards:** QLT-787-04 is in your area if you want it.

## Previous Findings (re-review only)

n/a (round 1).

## Round 2 (re-review of `51070109..1bccebe7`, 2026-11-26) — APPROVE WITH COMMENTS

Scope: the one fix commit `1bccebe7` (3 files, +56/−9). CI run 45806135860 is fully green at `1bccebe7`. `npx vitest run tests/unit/password-input.test.ts tests/unit/cn.test.ts` ran at `1bccebe7` in a temporary scratchpad worktree, since removed: 2 files, 36 passed. Master drift (#778, #756) touches none of the 4 files. DL-422 stays **+0**: the E2E step sits inside the existing sign-in case. PR review [6073269759](https://github.com/sankumar76/Accucut-Quotation/pull/787#pullrequestreview-6073269759).

| Finding | Round-2 status | Evidence |
|---------|----------------|----------|
| SEC-787-01 | **Fixed** | `flushSync` wraps the hide in both native listeners (`password-input.tsx:53`); they never run during a render. E2E `sign-in.spec.ts:117-121` dispatches `PageTransitionEvent('pagehide', { persisted: true })` and reads `#password` as `password` in the same task, at 3 widths. The unit test counts the `flushSync` |
| QLT-787-01 | **Fixed** (not yet seen in a real Edge) | `[&::-ms-reveal]:hidden` on the input, with a unit assertion. The qa-engineer's manual check in Edge stays open as a check, not a hold |
| QLT-787-02 | **Fixed** | `disabled={props.disabled}` (`:62`), with unit cases. Side effect: QLT-787-07 |
| QLT-787-03 | **Fixed** | `peer` on the input; `peer-aria-invalid:border-y-2 peer-aria-invalid:border-r-2` on the button, kept after merging (probe with the project's `extendTailwindMerge` set) |
| QLT-787-04 | **Fixed** | the return type is `() => void`; `stop()`; `void form;` removed |
| SEC-787-02, QLT-787-06 | Info, stand | — |
| QLT-787-05 | Info; the `pagehide` gap is closed by the E2E step | — |

**New finding**

| ID | Severity | File:line | Issue | Why | Fix |
|----|----------|-----------|-------|-----|-----|
| QLT-787-07 | Minor | `src/components/shared/password-input.tsx:61-62` | A disabled eye draws a 1 px divider inside the disabled field. `Button`'s base keeps `border` (all four sides) and `disabled:border-border`, and the plain `border-transparent` does not override the `disabled:` variant (`tailwind-merge` probe). The top, right and bottom edges fall on the field's own disabled border; the left edge shows as a line | Cosmetic, only while a request is pending in 7 forms; new with the QLT-787-02 fix | Add `disabled:border-transparent` to the button's `className`. **Test:** a unit class assertion. Hardening window or this PR; does not block |

Open after round 2: Blocker 0, Critical 0, Major 0, Minor 1 (QLT-787-07), Info 3 (SEC-787-02, QLT-787-05, QLT-787-06). The label stays `review:quality-approved`.

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 4, Info 4). CI run 45798949161 is green at `51070109`. DL-422 +0 is confirmed.
- Recommended next agent: developer (optional: QLT-787-01, QLT-787-02 and SEC-787-01 in this PR), then orchestrator: bring the branch up to date and merge per CLAUDE.md §9 on fully green CI, by the end of Wed 2 Dec.
- **Round 2 (1bccebe7):** APPROVE WITH COMMENTS. All 5 round-1 findings are fixed; one new Minor (QLT-787-07) does not block. Next: orchestrator merges on fully green CI after updating the branch.
