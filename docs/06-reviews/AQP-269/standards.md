# Review Report — AQP-269 (with AQP-270, AQP-271) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `master...fix/AQP-269-dialog-focus-jump` (PR #167; base 322cd8e) |
| Commit reviewed | `69805d1a47b814e9ef13597d92077b97b01e402c` |
| Date | 2026-11-10 |
| **Verdict** | **APPROVE WITH COMMENTS** |

## Summary
The change follows the coding standards: the shared hook sits in `src/components/shared/` with a kebab-case `use-*.ts` name like its five siblings, it is typed without `any`, `!` or `as`, its doc comment explains why, the three dialogs shrink, nothing leaves the 7 files in scope, and the commit, branch and PR title carry the Jira keys. Three Minor and two Info findings remain; none blocks merge. The only item asked for is a tracked follow-up for the duplicated pattern in `use-exchange-rates.ts` (STD-01). Review posted on the PR: https://github.com/sankumar76/Accucut-Quotation/pull/167 (COMMENT, single-token identity).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Info | 2 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Lint | `npm run lint` | Not run by me (machine has about 380 MB free; instruction not to run). CI run 42852617579 on 69805d1, stages 1 to 11b: green |
| Type-check | `npx tsc --noEmit` | Not run by me. Same CI run: green |
| Format check | CI stage with lint | Same CI run: green |
| Secret / dependency scan | n/a | Diff read in full: no secrets, no new dependency, no lockfile change |
| Scope | MCP `get_files` / `get_diff` | 7 files, all named in the brief; no docs, config or generated files |
| Function size | by reading | Hook 30 lines; `useMaterialForm` 37 lines; `UserForm` 146 lines (pre-existing, STD-04) |
| Convention reads | `git show` on the head | `components/shared/use-*.ts` siblings have no `'use client'` (same here); `useEffectEvent` only in the new hook; React 19.3.1 in `package.json` |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Minor | `src/components/shared/use-focus-on-refusal.ts:13` (and `src/components/features/masters/use-exchange-rates.ts`, local `useFocusOnRefusal(request)`) | Coding Standards §1 (DRY, rule of three), §2 (naming), §11 (TODO without ticket) | Two different hooks share the name `useFocusOnRefusal` with different signatures; the pattern now exists in four places. The PR calls the migration "a possible follow-up" but no issue exists (a search of GitHub issues found none). | A grep for the name lands on two unrelated signatures; the untracked follow-up can be forgotten and the copy drift from the fixed one. | Open a GitHub `follow-up` + `ai-delivery` issue (origin AQP-269): move `useRateForm` onto the shared hook and delete the local copy (renaming it on the way); link it in the Dev Record. May be done after merge. |
| STD-02 | Minor | `src/components/features/masters/process-form-dialog.tsx:66` (focus callback 71-74) | Coding Standards §2 (misleading name), §1 (complexity, consistency) | `useFieldFocus(setErrors)` now also takes the errors setter and returns `showErrors`; its name and doc comment say only "focus". Its focus callback is a nested ternary with a dead `: null` branch, while the Users dialog looks the ref up in an object. | The name hides that the hook owns how errors are shown; two sibling dialogs solve the same lookup two ways. | Rename (`useRefusalFocus`), update the doc comment, and use `refs[field].current?.focus()` over one `refs` object (see notes). |
| STD-03 | Info | `src/components/shared/use-focus-on-refusal.ts:14` | Coding Standards §2 | Parameter `order` is the field order of the form; `fieldOrder` states it. | Readability only. | Rename; call sites pass it positionally, so no caller changes. |
| STD-04 | Minor | `src/components/features/users/user-form-dialog.tsx:107-252` (comment on 124) | Coding Standards §1 (functions at most 40 lines, justify exceptions inline) | `UserForm` is 146 lines (148 before) with no inline justification; the Dev Record calls it "an existing exception". Pre-existing, not introduced here. | A large unit remains hard to review; the exception is invisible in the code. | Add a one-line justification above `UserForm`, or extract `useUserForm` as its own change (as Material and Process already do). Not required for this PR. |
| STD-05 | Info | `tests/e2e/materials.spec.ts:181` (same pattern in `process-master.spec.ts`, `users.spec.ts`) | Coding Standards §6; CLAUDE §6.3 | Good practice: titles start with `DEF-024/025/026:`, sit in AC-labelled `describe` blocks, are AAA with one behaviour each, use throwaway data, and the plant run (CI 42852695987) shows the 9 new tests fail with the old code. Optional: the same explanatory comment is repeated in three specs; a helper such as `typeIntoFocusedField` is possible under the rule of three. | None. | Optional only. |

<details><summary>Detailed notes & code suggestions</summary>

### STD-02
**Current** (`process-form-dialog.tsx:66-79`)
```ts
function useFieldFocus(setErrors: (errors: FieldErrors) => void) {
  ...
  const showErrors = useFocusOnRefusal(FIELD_NAMES, (field) => {
    const target = field === 'name' ? name : field === 'unit' ? unit : field === 'defaultValue' ? defaultValue : null;
    target?.current?.focus();
  }, setErrors);
  return { refs: { name, unit, defaultValue }, showErrors };
}
```
**Suggested**
```ts
/** The three fields' refs, and `showErrors`: it stores a refusal's messages and focuses the first refused field (SCR-11; DEF-025). */
function useRefusalFocus(setErrors: (errors: FieldErrors) => void) {
  const name = useRef<HTMLInputElement>(null);
  const unit = useRef<HTMLSelectElement>(null);
  const defaultValue = useRef<HTMLInputElement>(null);
  const refs = { name, unit, defaultValue };
  const showErrors = useFocusOnRefusal(FIELD_NAMES, (field) => refs[field].current?.focus(), setErrors);
  return { refs, showErrors };
}
```
</details>

## Positive observations
- Hook placement, file name, named export and `Readonly` typing match the architecture conventions and its siblings; `useEffectEvent` keeps the focus callback out of the effect dependencies.
- Comments explain why (DEF IDs, QLT-01, UX spec section 6.0) and the "Nothing was changed." texts were left alone, so scope is clean.
- The commit `fix(masters,users): ... [AQP-269] [AQP-270] [AQP-271]` is Conventional Commits with story keys; branch `fix/AQP-269-dialog-focus-jump` and PR title `AQP-269: ...` match CLAUDE §7.3.

## Issues for other roles
- reviewer-quality: the call `onAdminTaken(...)` straight after `showErrors({ role })` in the Users dialog (user-form-dialog.tsx:157-158) is a design question about focus ordering, not a standards finding.
- qa-engineer: DEF-026's file says Sev-3 while Jira says Sev-2 (noted in the Dev Record; QA owns it).

## Previous Findings (re-review only)
n/a (round 1).
