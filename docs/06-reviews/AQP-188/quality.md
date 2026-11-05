# Review Report — AQP-188 (STORY-10.13) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 2 (G6 condition 1, DL-091: `3142157..6030585`); round 1 below is kept for the record |
| Base…branch | `master...feat/AQP-188-lazy-account-menu-and-drawer` (PR #75) |
| Commit reviewed | round 2: 6030585516e36fb41b9b0ecfcac6fdfec4788930 · round 1: 3142157cc6a01f6d22445c9ab0e42638492f1f78 |
| Date | 2026-11-05 |
| **Verdict** | **Round 2: APPROVE WITH COMMENTS** (QLT-55 and QLT-56 fixed; nothing at Minor or above open) · round 1: APPROVE WITH COMMENTS |

## Round 2 — G6 condition 1 (DL-091)

**Summary.** Both Minors are fixed with tests that would fail on the old code. QLT-57's evidence gap is closed by a new test. Two Info points: the object spread works around a private Radix prop with no type checking (QLT-61), and the QLT-56 test's final check relies on waiting for `networkidle` first (QLT-60).

| Severity (new, round 2) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 2 |

**Previous findings.**

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-55 | Minor | **Fixed** | `openedByKeyboard` ref: first-item focus only on the open that mounted the menu, then Radix's default. Test in `shell-lazy-load.spec.ts` (Enter, Escape, click, then focus on the `menu`) |
| QLT-56 | Minor | **Fixed** | `useFirstOpen.cancel()`; `setDrawerOpen` passed to `useCloseDrawerOnDesktop` cancels a pending open on widening. Test in `shell-first-open.spec.ts` (slow chunk, press, widen, `aria-busy` drops, no dialog after the chunk completes) |
| QLT-57 | Info | **Closed** | New test: after hydration, the last press wins |
| QLT-58, QLT-59 | Info | Unchanged | The spec split only moves tests |

**New findings (round 2).**

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-60 | Info | `tests/e2e/shell-first-open.spec.ts` (QLT-56 test) | Test adequacy | The final `toBeHidden` passes at once while the dialog is absent; it is made meaningful by waiting first for the chunk and for `networkidle` (at least 500 ms quiet). | Low. | None needed. |
| QLT-61 | Info | `src/components/shared/account-menu-panel.tsx` | Type safety (master's question) | `onOpenAutoFocus` is private in `@radix-ui/react-menu` (`MenuContentImplPrivateProps`, removed from the public types by `Omit`). The object spread avoids the excess-property check, so the prop is untyped. It reaches `MenuContentImpl` through the wrapper's `...props` and is composed with Radix's default. | A typo or signature change compiles and silently does nothing; only the E2E guards it. Depends on Radix internals. | Follow-up: add a typed `onOpenAutoFocus` to the shadcn `DropdownMenuContent` wrapper with one commented cast. |

**Checks run (round 2).** `git diff 3142157 6030585` (3 source and 3 test files); Radix `index.d.ts` for the prop's visibility; the wrapper's prop forwarding. E2E not run locally; CI 41978784135 green.

---

## Round 1 — review of 3142157 (kept for the record)

## Summary
The account menu panel and the mobile drawer now load on first open through one loader: a pure, total reducer (`src/lib/ui/first-open.ts`) plus one hook. The reducer keeps "where the code is" apart from "whether the person still wants it". A bare `import()` makes a failed load retryable. A small ES5 inline script keeps a tap made before hydration and hands it to the loader through one record. The pending look is keyed to `aria-busy`, so it shows before React runs. A planted-fault probe caught 17 of 17 faults. Two Minors: after a keyboard first open, later pointer opens focus the first item (QLT-55); a pending drawer open finishes on the desktop after widening (QLT-56).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Code reading | `git show 3142157:<file>` for all 23 changed files; story revision 7; ux-spec v0.11 rule 11 | see Findings |
| Unit tests (scratch copy via `git archive`; no working tree touched) | `npx vitest run tests/unit/first-open.test.ts tests/unit/early-intent.test.ts tests/unit/button-pending.test.ts tests/unit/portal-frame-props.test.ts tests/unit/design-system-route.test.ts` | 38 of 38 passed |
| Planted-fault probe | 17 single-line edits to the reducer, the script, the record reader, the button and trigger styles, and the frame props | 17 killed |
| E2E | not run locally | CI 41975770162 green; AC-10 evidence run 41974232482: 361 passed, 0 failed (20 per width) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-55 | Minor | `src/components/shared/account-menu-panel.tsx:47-54` | AC-4 ("a pointer open behaves as today") | The panel is mounted once with `keyboard` from the first activation, so `onOpenAutoFocus={focusFirstEnabledItem}` stays for every later open: after a keyboard first open, later pointer opens focus the first item. | Focus differs by how the person first opened the menu. | Apply the override to the first open only (a ref cleared on first use); Radix handles later keyboard opens itself. Test: Enter, Escape, click; expect focus on the `menu`. |
| QLT-56 | Minor | `src/components/shared/app-shell.tsx:81-83` | AC-5 (widening closes; button hidden at 1024 px), AC-8 slow path | `useCloseDrawerOnDesktop` reacts only to the media-query change; a pending open's `onOpen` then opens the Sheet on the desktop, and focus later returns to a hidden button. | A modal drawer over the desktop layout after a slow first open plus a resize or rotation. | Cancel a pending first open on widening (expose `cancel()` from the hook), or check the media query in `onOpen`. Test: delay the chunk, press at 360 px, resize to 1366 px, release; no dialog. |
| QLT-57 | Info | `src/components/shared/use-first-open.ts:87-100` | AC-8, AC-10 | Races checked: a double press gives one request; both controls give last press wins with the other's panel kept closed; a press during loading is ignored on the same control and cancels the other. Hand-over: `aria-busy` survives hydration and the replay keeps React consistent; children read the record before the frame deletes it. "Last press wins" after hydration has no test. | Evidence gap only. | Add an E2E: delay the account chunk, press account then menu, release; only the drawer opens. |
| QLT-58 | Info | `tests/e2e/support/design-system.ts`, `tests/unit/design-system-route.test.ts` | AC-9 (changes to existing tests) | `waitUntilAccountMenuIsLive` → `onClick` is correct for the first-load button; use it only before the first open (the Radix trigger has no `onClick`). The route test names `portal-frame-props.tsx`, where the gate now lives: a relocation, not a weakening. | — | Note both in the G6 record (the second is not "a wait"). |
| QLT-59 | Info | probe | Test adequacy | 17 of 17 planted faults caught (reducer 7, script and record 6, styles 3, props 1). | — | — |

## Reviewer-specific tables
**Quality: AC conformance**

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1, AC-2 budget and method | lazy loading | PR figures | Performance reviewer's area |
| AC-3 lazy, no preload, once each, never at 1366 px | hook, shell, account menu | `shell-lazy-load.spec.ts` | Met |
| AC-4 account menu unchanged | `account-trigger.tsx`, `account-menu.tsx`, `account-menu-panel.tsx` | E2E | Met for the first open (QLT-55) |
| AC-5 drawer unchanged, focus by hand | `app-shell.tsx`, `menu-drawer.tsx` | E2E (four focus paths, widening, slots) | Met (QLT-56) |
| AC-6 axe and reduced motion | — | E2E | Met |
| AC-7 no layout shift | absolute failure line; colour and shadow pending look | E2E | Met |
| AC-8 pending, ignore, Escape, failure line, retry, one loader | `first-open.ts`, hook, `first-open-failure.tsx`, `button.tsx`, `account-trigger.tsx` | unit and E2E | Met |
| AC-9 props and gate | `portal-frame-props.tsx`, layout | `portal-frame-props.test.ts` | Met |
| AC-10 early tap | `early-intent-script.ts`, `early-intent.ts`, hook | unit and E2E; 361 of 361 | Met |

## Previous Findings (re-review only)
n/a (first quality review of this PR).
