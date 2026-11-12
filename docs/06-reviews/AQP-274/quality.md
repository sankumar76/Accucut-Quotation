# Review Report — AQP-274 (DEF-029, GitHub #308, PR #309) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 (DL-169 (3c): reviewer-quality and reviewer-standards, then QA G7) |
| Base…branch | `master` 6b1883f `...fix/AQP-274-saved-not-shown` |
| Commit reviewed | `356e9d6` |
| Date | 2026-11-12 |
| **Verdict** | **APPROVE WITH COMMENTS** |

PR review (system of record): https://github.com/sankumar76/Accucut-Quotation/pull/309#pullrequestreview-5870753553 (inline comments r4547581271 QLT-01, r4547581959 QLT-02, r4547582484 QLT-03). Label `review:quality-approved`.

## Summary
The fix is correct and minimal. `process-results.tsx` and `material-results.tsx` now pass `SAVED_NOT_SHOWN_BODY` to `MasterLoadError` only when `master.notice?.tone === 'success'`, which is the `treatment-panel.tsx` pattern. The words match ux-spec v0.23 exactly:
- titles `We could not load the rates` and `We could not load the materials`;
- the sentence `The change was saved, but we could not show the list. Check your connection and try again.`;
- the standard line otherwise.

The Treatment / Color text is byte-identical after the move to the shared constant. The regression assertions are mutation-proven for the success half (control #316, red at 9). The one gap is the other half: with no notice, or a warn / info notice, nothing pins the standard line. My control #320 changes the condition to "any notice", and CI stays fully green (QLT-01, Minor).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 2 |

## Checks Run
| Check | Command / source | Result |
|-------|------------------|--------|
| Scope | `git diff origin/master...356e9d6 --stat` | 8 files, +40 / -11: two results components, `master-texts.ts`, the Treatment panel and texts, three E2E files. No route, query, dependency or CI change |
| Callers and callees read | `use-process-master.ts`, `use-material-master.ts`, `use-master-list.ts`, `master-load-error.tsx`, `process-texts.ts`, `material-texts.ts`, `process-dialogs.tsx`, `materials-panel.tsx` | Every path into `list.status === 'error'` traced (see Correctness) |
| PR CI | `gh run view 43173595283` | head 356e9d6, success: Stages 1 to 11b, 1 to 11, E2E shards 1 to 3 |
| Control #316 (developer) | `git diff 356e9d6 813af2d --stat`; `gh run view 43173789224 --log-failed` | Diff is only the two results files with `description` removed. Failed at exactly 9 instances: `masters-slow-read.spec.ts:77`, `:105`, `aqp-122-qa.spec.ts:278` × mobile, tablet and desktop |
| **Control #320 (mine)** | Branch `control/AQP-274-qlt-always` 0fe6e11 from 356e9d6, anchor-once Node script (the anchor must occur exactly once per file), diff printed. `const saved = master.notice?.tone === 'success';` → `const saved = master.notice !== null;` in both results files | Run 43175410045: **5 of 5 green**, E2E 260 + 275 + 273 = 808 passed, 17 + 3 + 4 = 24 skipped (identical to #309). PR closed after reading, never merged, branch kept. Local worktree removed |
| Suggested `tone === 'danger'` plant | `tsc --noEmit --strict` on a probe file with the `PageNotice` tone union | TS2367 "no overlap". The type-check stage refuses it, so it says nothing about the E2E assertions; it was replaced by #320 |
| Local unit / E2E | n/a | Not run: `npm ci` is not allowed for this task, and CI covers it at this head |

## Correctness — every way into the load error
| Path | Notice on the page | Expected (ux-spec v0.23) | Code gives |
|------|-------------------|--------------------------|-----------|
| Process Add / Edit / Delete succeeded, re-read fails (`onSaved`) | `savedNotice(…)`, tone `success` (`process-texts.ts:38-41`, `process-dialogs.tsx:43,51`) | saved sentence | saved sentence |
| Materials Add / Edit succeeded, re-read fails | `materialSavedNotice(…)`, tone `success` (`material-texts.ts:40-43`) | saved sentence | saved sentence |
| Process rate deleted elsewhere (`onGone`, edit / delete) | `goneNotice`, tone `warn` / `info` | standard line | standard line |
| Process delete refused because a formula now uses the rate (`onBlocked`) | `null` (cleared on the press, `use-process-master.ts:68`) | standard line | standard line |
| "Try again" after either | unchanged (not cleared by a read) | sentence unchanged | unchanged |
| First read | none: Process and Materials render the list on the server, status starts `ready` (`use-master-list.ts`) | n/a | n/a |
| Materials with no / non-success notice | unreachable until STORY-02.07 adds Delete | standard line | standard line |

The state order is safe: `setNotice(saved)` runs before `readAgain(true)`, so the render that shows `status === 'error'` already holds the notice.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Minor | `src/components/features/masters/process-results.tsx:50` (and `material-results.tsx:58`) | ux-spec v0.23 SCR-11 developer tests (2) and (3); SCR-13 Materials test "the first read fails: the standard line"; coding-standards §6 | No test pins the standard line when no notice, or a warn / info notice, is on the page. Control #320 (any notice → saved sentence) is fully green | A regression that shows "The change was saved…" under "<name> no longer exists. … your changes were not saved." would ship unseen. That is a false sentence of the same class as DEF-029 (Sev-3) | Node Vitest render test with `renderToStaticMarkup`, the pattern already used in `tests/unit/button-pending.test.ts`, `system-pages.test.ts` and others. Rows: `null`, `goneNotice(…,'edit')`, `goneNotice(…,'delete')`, `savedNotice(…)` for `ProcessResults`; `null` and `materialSavedNotice` for `MaterialResults`. E2E +0. If it is not done here, open a `follow-up` issue due with STORY-02.07 |
| QLT-02 | Info | `tests/e2e/support/masters.ts:147` | test adequacy | The helper is strong. It catches a dropped `description` (#316), an inverted condition (the same render in these tests) and a wrong sentence (exact text). The "audit log" anchor in `role=status` excludes gone notices. Only Edit is exercised; Add and Delete use the same `savedNotice` factory with `tone: 'success'` | none | none |
| QLT-03 | Info | `src/components/features/masters/master-texts.ts:35` | DL-169 (3c) | One shared constant instead of DL-169's "one constant per screen". ux-spec v0.23 SCR-11 sanctions it ("the developer can share one constant"), and the Dev Record states it. Treatment text is byte-identical, with no remaining reference to the removed name | none (better: one source of the sentence) | master notes the deviation in the G6 record. For placement and the repeated condition, see reviewer-standards STD-03 and STD-05 (not repeated here) |

<details><summary>QLT-01 suggested test (sketch, not run)</summary>

```ts
// tests/unit/masters-load-error-sentence.test.ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SAVED_NOT_SHOWN_BODY, TRY_AGAIN_BODY, type PageNotice } from '@/components/features/masters/master-texts';
import { ProcessResults } from '@/components/features/masters/process-results';
import { goneNotice, savedNotice } from '@/components/features/masters/process-texts';
import type { ProcessMaster } from '@/components/features/masters/use-process-master';

const master = (notice: PageNotice | null) =>
  ({ list: { status: 'error' }, dialogs: {}, notice, readAgain: async () => {} }) as unknown as ProcessMaster;

describe('SCR-11 load error sentence (ux-spec v0.23)', () => {
  it.each([
    ['no notice', null, TRY_AGAIN_BODY],
    ['rate gone on edit (warn)', goneNotice('R', 'edit'), TRY_AGAIN_BODY],
    ['rate gone on delete (info)', goneNotice('R', 'delete'), TRY_AGAIN_BODY],
    ['added (success)', savedNotice('R', 'added'), SAVED_NOT_SHOWN_BODY],
  ])('%s', (_, notice, line) => {
    const html = renderToStaticMarkup(createElement(ProcessResults, { master: master(notice), onClearFilters: () => {} }));
    expect(html).toContain(line);
  });
});
```
The same applies for `MaterialResults` with `null` and `materialSavedNotice('M', 'added')`. The plant of #320 turns the warn / info rows red.
</details>

## AC conformance (DEF-029 expected result, ux-spec v0.23)
| AC / expectation | Implemented in | Tested by | Result |
|------------------|----------------|-----------|--------|
| SCR-11: title `We could not load the rates`, saved sentence while a success notice shows | `process-results.tsx:48-52`, `master-texts.ts:35` | `masters-slow-read.spec.ts:77` (`expectSavedNotShown`, 3 widths) | Met; mutation-proven (#316) |
| SCR-13 Materials: title `We could not load the materials`, saved sentence | `material-results.tsx:56-60` | `masters-slow-read.spec.ts:105`; `aqp-122-qa.spec.ts:278` (3 widths) | Met; mutation-proven (#316) |
| "Nothing was changed." not shown while the success notice shows | same | same (`toHaveCount(0)`) | Met |
| No notice / warn / info notice: standard line | same (`description` undefined) | none (#320 green) | Met by code, untested (QLT-01) |
| Treatment / Color unchanged | `treatment-panel.tsx:64` | `treatments-focus.spec.ts:154` | Met |
| Focus on the error title (§6.0) | unchanged | `expectLoadErrorHoldsFocus` | Met |
| Exchange rates keeps its own sentence | `exchange-rates-panel.tsx:112` untouched | `exchange-rates.spec.ts:413` | Met |

## Issues for other roles
- **master:** record the QLT-03 deviation from DL-169 (3c) and decide on QLT-01: fix here, or a `follow-up` due with STORY-02.07.
- **qa-engineer (G7):** at G7, a deleted-elsewhere notice followed by a failed re-read on Process should show the standard line. This is ux-spec test (3), and no automated test covers it today.
- **developer:** the PR body's "No component-test setup exists in the repo" is inaccurate for render-only checks: four `tests/unit/*.test.ts` files already use `renderToStaticMarkup`.
