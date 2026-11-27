# Review Report — PR #833 (AQP-502 / DEF-145: the PartForm placeholder holds the form's space) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (DL-465 (3) "Review": reviewer-quality's delta review; the ux-expert's check of the built page is separate) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-502-partform-placeholder` (PR [#833](https://github.com/sankumar76/Accucut-Quotation/pull/833)), merge base `f7b20eff` |
| Commit reviewed | `4d367758` (the fix is `eb148e54`; `4d367758` merges `master` f7b20eff and changes nothing in `src/` or in the tests reviewed here) |
| Date | 2026-11-27 |
| Reviewed against | DL-465 (fix condition), DL-468 (194,000 B), DL-388 and DL-422 (E2E placement, person ledger), DL-404 (no wait/budget change); DEF-145; UX ruling `docs/03-ux/rulings/partform-placeholder-shape-2026-11-28.md` PF-1 to PF-15; architect note `lead-page-server-props-2026-11-27.md` v1.2 §5a; NFR-002; `docs/standards/coding-standards.md` §1, §3, §6 |
| GitHub review | [pullrequestreview-6089340560](https://github.com/sankumar76/Accucut-Quotation/pull/833#pullrequestreview-6089340560) (COMMENT, REVIEW_IDENTITY single-token, 9 inline comments), label `review:quality-changes-requested` |
| **Verdict** | **REQUEST CHANGES** |

## Summary

The design is right and most of it is well built. The ghost is plain server markup with no hooks and no client JS. It is drawn from the form's own definition with class strings shared with the form (PF-4). The shape rules moved to `form-shown.ts` unchanged and are re-exported, so no caller changed. The Engineer's ghost can only hold the Engineer's own `/form` words (NFR-002 holds by construction). Stage 11b reads 193,076 B, within DL-468's 194,000 B. The regression E2E was red before the fix at all three widths, on the 8 px assertion itself.

**It does not meet DL-465's fix condition yet, and CI is red at `4d367758`.** (1) The Lead's ghost is drawn with the Engineer's look: it shows every field hint and a 44 px treatments box. The Lead's review form drops the hints (`reviewField`) and shows the treatments as chips. So the ghost is taller than the form, and `#review-actions` jumps **up** 156 to 210 px at the swap (the case fails at 1366 px too). On the Engineer's page the form is 54 to 135 px taller than its ghost (QLT-833-01). (2) Two existing E2E cases of `estimate-first-load.spec.ts` fail. The ghost's `status` has no accessible name, and the second ghost is silent by PF-9.2 (QLT-833-02). (3) The new NFR-002 test that replaced the cost-word scan inside the ghost is weaker than the scan it replaced. I proved this by mutation: a ghost text "Machining rate 450.00 per hour", a bare "16889808.07" and a `title="Machining rate 450 per hour"` attribute all pass it. The old page scan catches the first and the third (QLT-833-03). (4) The chunk-hold helper leaves route handlers running after the test ends, which fails PF-14e on its own (QLT-833-04). (5) The approval E2E cases fail on this run and pass on `master`, and the cause is not yet known (QLT-833-05).

| Severity | Count |
|----------|-------|
| Blocker | 3 (QLT-833-01, -02, -03) |
| Critical | 0 |
| Major | 3 (QLT-833-04, -05, -06) |
| Minor | 4 (QLT-833-07, -08, -09, -10) |
| Info | 2 (QLT-833-11, -12) |

## Checks Run

| Check | Command / source | Result |
|-------|------------------|--------|
| Diff and history | `gh pr view 833`, `git diff f7b20eff origin/pr-833`, `git log` | 23 files, +860/−110; commits 7e3116bd (red spec), b9da7838 (red spec, ledger +0), 1cda9d33 (merge), eb148e54 (fix), 4d367758 (merge master f7b20eff) |
| Test-first red | CI run 45997757836 at b9da7838 (spec only, no fix) | **Red on the 8 px assertion** at all three widths: Lead Draft [desktop] `#review-actions moved from 874 to 2309 px` (1,435), retry 1,371; [mobile] 2,360; Engineer [desktop] 1,351. Good test-first evidence (not red on a missing marker) |
| Unit tests (CI) | CI run 46008059200, job "Stages 1 to 11b" | 552 files / 11,867 tests passed; 728 / 17,748 passed (the two Vitest passes) |
| Unit tests (local, my worktree at 4d367758) | `npx vitest run tests/unit/estimate-page.test.ts tests/unit/part-form-ghost.test.ts tests/unit/compact-layout.test.ts` | 3 files, 56 tests passed |
| Mutation of the NFR-002 ghost test | 6 mutants in my own worktree `.claude/worktrees/qlt-833-mut` (removed afterwards), `npx vitest run tests/unit/estimate-page.test.ts` | See QLT-833-03: **3 of 4 cost mutants survive**; the 2 controls are killed; the cut is exact |
| Stage 11b | CI run 46008059200, job 140536478751 | `/estimates/[code]` gzip **193,076 B**: within DL-468's 194,000 B (+64 B on `master` 193,012 B, as the PR says) |
| E2E at 4d367758 | CI run 46008059200 (final: `failure`) | **Red.** Shard 1 [mobile]: 13 failed, 1 flaky, 577 passed. Shard 3 [tablet] and [desktop]: 11 failed, 3 flaky, 587 passed. Shards 2 and 4 were **cancelled** part-way, after their own `partform-placeholder` [desktop] and `approve-override` [tablet] cases had failed on both attempts (progress lines; no summary was printed) |
| E2E on `master` f7b20eff | CI run 46007880263 | All jobs `success`; `approve-override.spec.ts` :125, :184, :198, :284 [desktop] passed |

### CI at 4d367758 (run 46008059200)

| Case | [mobile] 360 | [tablet] 768 | [desktop] 1366 |
|------|--------------|--------------|----------------|
| `partform-placeholder:109` Lead Draft | **moved 210 px** (4152 → 3942), both attempts | **moved 156 px** (2931 → 2775), retry 196 | **failed** both attempts (shard 4 was cancelled before its summary, so the figure is not printed) |
| `partform-placeholder:109` Lead Prepared | **moved 182 px** (4288 → 4106) | failed both attempts | **failed** both attempts |
| `partform-placeholder:148` Engineer | **moved 54 px** (3509 → 3563) | **moved 135 px** (2869 → 3004) | **failed** both attempts |
| `partform-placeholder:167` PF-14e | flaky (`Response has been disposed`) | **failed** both attempts, `apiResponse.text: Response has been disposed` | passed |
| `estimate-first-load:59`, `:75` | **failed** | not reached (shard 2 cancelled) | **failed** |
| `approve-override` :125 :162 :184 :198 :230 :284 :314, `approve:225` | **failed** (8) | **failed** both attempts :125 :162 :184 :198 :230 :314 and `approve:225`; :284 passed (shard 2, cancelled before its summary) | **failed** :125 :184 :198 :284; flaky :230, `approve:225` |

## AC conformance (DL-465 (3) fix condition and the PF rules)

| Requirement | Implemented in | Tested by | Result |
|-------------|----------------|-----------|--------|
| DL-465 (3) (i): `#review-actions` moves ≤ 8 px at the swap, Draft and Prepared, 360/768/1366 | `part-form-ghost.tsx`, `estimate-review.tsx:148`, `lazy-review-form.tsx`, `part-form.tsx` | `partform-placeholder.spec.ts:109` | **Not met**: 156 to 210 px at 360 and 768 px, and failing at 1366 px (QLT-833-01) |
| DL-465 (3) (i): the jump to the button made before the swap, the button in view after it | same | `:109`, `window.location.hash` | Partly. A scripted hash, not Enter on the notice link (QLT-833-07). Not reached at 360/768 because the move assertion fails first |
| DL-465 (3) (i): red before, green after, three widths | spec first (7e3116bd, b9da7838) | CI 45997757836 | Red before: **yes**. Green after: **no** |
| DL-465 (3) (ii): Engineer's workspace improved, not regressed | `engineer-ghost.tsx`, `page.tsx` Engineer branch, `estimate-workspace.tsx` | `:148` | Improved (from about 1,351 px to 54 to 135 px). The spec's own 8 px bar is not met, and the measurement mixes in the tree's arrival (QLT-833-06) |
| DL-465 (3) (iii): Stage 11b within the limit (194,000 B, DL-468) | ghost is server markup | Stage 11b | **Met**: 193,076 B |
| DL-465 (3) (iv): one Lighthouse CLS reading per state, reported | PR body | — | Reported (Draft 0.0004/0, Prepared 0/0). The PR says Lighthouse cannot see the swap on that machine |
| DL-465: no wait, budget or time-out change (DL-404); `rates-changed:263` unchanged | — | diff | Met. The hold is a route gate. `expect.poll` on the held count is a condition, not a time wait |
| DL-388, DL-422: nothing after `users.spec.ts`; ledger +0 | `partform-placeholder.spec.ts` | file order; set-up Lead and Engineer only | Met (`p…` sorts before `users…`; no person-making call) |
| PF-1 one ghost for every wait | `part-form.tsx:100-103`, `lazy-review-form.tsx`, `part-fields.tsx:173` | unit PF-1, PF-7 | Met in structure. But the Lead's ghost is not the Lead's form's shape (QLT-833-01) |
| PF-2, PF-3 structure; real words; no value | `part-form-ghost.tsx` | unit PF-1 to PF-3 | Engineer: met. **Lead: not met** (hints and treatments drawn as the Engineer's form draws them) |
| PF-4 one source for sizing strings | `shared/form-layout.ts` | unit PF-4 | Met |
| PF-5 fields by the form's own rules | `form-shown.ts` (moved verbatim), `ghostOf` | unit PF-5 | Met for visibility. Not met for the review look (`reviewField`), which is part of what the Lead's form draws |
| PF-6 server-drawn, zero client JS; shell never imports it | `engineer-ghost.tsx` by `import()`, `estimate-review.tsx` | unit PF-6; Stage 11b | Met |
| PF-7 `treeUnread` | `estimate-workspace.tsx:194`, `part-form.tsx:80` | unit PF-7 | Met |
| PF-8 no delay, no fade, no key trick | — | read | Met |
| PF-9.1/9.2 one busy region; second ghost silent | `part-form-ghost.tsx:116-117` | unit PF-9 | Met as ruled. It breaks two existing E2E cases that the PR did not update (QLT-833-02) |
| PF-9.4 no id/name/href/tabindex/heading/form marker | same | unit PF-9.4 | Met, except the `data-slot` attributes of `Card`/`Skeleton` (QLT-833-08) |
| PF-10 reduced motion | `Skeleton` | `:167` | Built. Red at 768 for a helper fault (QLT-833-04) |
| NFR-002 on the Engineer's page | `engineer-ghost.tsx` (`getForm` → `formBody`) | `estimate-page.test.ts` | Holds by construction (QLT-833-11). **The test that guards it in the ghost is weaker than before** (QLT-833-03) |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-833-01 | **Blocker** | `src/components/features/estimate-review/estimate-review.tsx:148`; `src/components/features/estimate-workspace/part-form-ghost.tsx:76`, `:82-89` | DL-465 (3) (i); PF-2, PF-3, PF-5; DEF-145 | The Lead's ghost draws the **Engineer's** form, not the review form. The review form passes every field through `reviewField` (`review-look.ts:29`), which drops every hint except QTY per Assy, and it shows the chosen treatments as chips or "None selected". The ghost draws every hint and a 44 px control for the treatments. The ghost is therefore taller than the form it stands for, and the swap moves `#review-actions` **up** 156 to 210 px (CI 46008059200: [tablet] 2931 → 2775, [mobile] 4152 → 3942). The Engineer's form is in turn 54 to 135 px taller than its ghost | The fix condition is not met, so CI is red. A jump to Recalculate or Approve made before the swap still ends away from the button (now above it, not below) | Give the ghost the review look when `head === 'lead'`: map each field through `reviewField` before drawing it (a pure function with no client import), and draw the treatments as the review does (one `h-s-5` line where none is chosen, or the chip row's height). Then read the Engineer's remaining delta from the PF-14a per-card diagnostics, which the spec already collects (they are not reached today because the move assertion fails first). Test: the existing `:109` and `:148` at three widths |
| QLT-833-02 | **Blocker** | `part-form-ghost.tsx:116-117`; `tests/e2e/estimate-first-load.spec.ts:68`, `:100` (not in the diff) | PF-9.1, PF-9.2; STORY-05.* AC-4; DEF-059 | Two existing cases fail at 360 and 1366 px, both attempts. They find the placeholder by `getByRole('status', { name: 'Loading the form' })`. The old bars had `aria-label`. The ghost's `status` has only a visually hidden line, and `status` takes its name from the author, not from its content, so it has no name. The second wait's ghost is silent by PF-9.2, with no `status` role at all | CI red. A screen reader user meets an unnamed status region | (a) Name the ghost's region: `aria-label={FORM_LOADING}` on the root next to `role="status"` (the hidden line can stay or go, at the ux-expert's word). (b) Update `:75` to PF-9.2's contract with the ux-expert's agreement, keeping DEF-059's point: the second wait shows `[data-part-ghost]` without a role, attached, visible, with a width above 0. Name the change and the ruling in the PR body. This is a contract change, not a weakening |
| QLT-833-03 | **Blocker** | `tests/unit/estimate-page.test.ts:224`, `:227-228` | NFR-002 (AC-6); brief item 1 (c) | The ghost is cut out of the cost-word scan, and the new allow-list test is meant to hold it instead. It does not. `text.includes(word) \|\| word.includes(text)`, with the section numbers `"1"` to `"9"` and the short names among the allowed words, lets any text that contains a digit 1 to 9, or a section's short name, pass. Only text nodes are read, so attributes are not checked at all. **Mutation results** (my own worktree at 4d367758, `part-form-ghost.tsx`): ghost text `Machining rate 450.00 per hour` **survives**; ghost text `16889808.07` **survives**; attribute `title="Machining rate 450 per hour"` on the ghost **survives**; controls `₹ 450.00` and `Labour rate` are killed; the same words placed just outside the ghost are killed by the page scan (so the cut itself is exact). Before this PR the whole page, attributes included, was held to `/\b(rates?\|prices?\|costs?\|formulas?)\b/i`, which kills the first and third mutants | NFR-002's guard on the Engineer's page is **weaker than before** for the ghost's region. A later change that drew a rate or a figure into the ghost (or into an attribute of it) would pass CI | Make the allow-list exact, and scan what is left with the old regex. Allowed strings, compared with `===`: `FORM_LOADING`, `FORM_LOCKED`, each `section.name`, `section.columnRange`, `sectionLinkText(section.number, section.shortName)`, each non-null `hint`. Then remove each allowed string from the ghost's HTML and require of the remainder: no cost word (`/\b(rates?\|prices?\|costs?\|formulas?)\b/i`, attributes included), no currency sign, and no digit outside `class` and `style` values. Re-run the three surviving mutants: each must fail |
| QLT-833-04 | Major | `tests/e2e/support/hold-fields-chunk.ts:23-33` | §6 deterministic tests; DL-404 | The route handler fetches every `/_next/static/*.js` and stays registered after the test ends. Scripts still in flight then raise `route.fetch: Test ended` or `apiResponse.text: Response has been disposed`, and Playwright counts that against the test. PF-14e (`:167`) failed both attempts at 768 for this reason alone, and was flaky at 360 | A new flaky case in a suite already under RISK-031's watch | End each test with `await page.unrouteAll({ behavior: 'ignoreErrors' })` (a `test.afterEach` in the spec, or a `dispose()` on `HeldChunk` called in `finally`), and `release()` in the same `finally` so no handler waits on the gate after a failure |
| QLT-833-05 | Major | (cause not established) `tests/e2e/approve-override.spec.ts`, `approve.spec.ts:225` | NFR-004 action paths; CI green | On this run the approval cases fail on both attempts at all three widths: [mobile] approve-override :125 :162 :184 :198 :230 :284 :314 and `approve:225`; [tablet] :125 :162 :184 :198 :230 :314 and `approve:225`; [desktop] :125 :184 :198 :284. The same cases pass on `master` f7b20eff (run 46007880263). The reading: the total taken from the Totals tile comes back empty (`approve:225` expected `""` against the field's `16889808.07`; `:184` stored ₹ 0.01, which is 0 plus one paisa) | CI red on the approval action's tests. If the PR causes it, it is a product regression on the page this PR changes | Lane 2 finds the cause before the next push. Check whether the tile's `innerText` reads empty while the ghost or the swap is on the page, and run one case on the branch with and without the ghost. Report it in the PR. If it is not this PR, show the same failure on `master` |
| QLT-833-06 | Major | `tests/e2e/partform-placeholder.spec.ts:153-161` | PF-14f, PF-15; DL-465 (3) (ii) | The Engineer case takes `before` as soon as the chunk is held, which may be before the tree has been read. The tree's own arrival, which PF-14f says is not counted, is then mixed into the "end of the page" move. The PF-14f form-area check (24 px) comes after the 8 px main-bottom check, so it never runs while the first one fails | The case cannot say whether 54 to 135 px is the ghost's gap or the tree's growth. The Engineer's bar is "improved, not regressed" (DL-465), and the spec sets a stricter one that it measures loosely | Wait on a deterministic condition that the tree has been read (its first row is visible) before reading `before`. Assert PF-14f's `[data-form-area]` height (≤ 24 px) first. Keep the 8 px page-bottom check only if it holds with the tree settled, or state PF-15's bound in its place |
| QLT-833-07 | Minor | `tests/e2e/partform-placeholder.spec.ts:127-129` | DL-465 (3) (i) wording | "Follows the notice link with Enter" is built as `window.location.hash = '#review-calculate'` in `page.evaluate`, with no rates-changed notice on the page. It is the same fragment navigation, but not the keyboard path DL-465 names (that path stays covered by the unchanged `rates-changed.spec.ts:263`) | The regression case does not prove the exact user path | Either set up the rates-changed state and press Enter on the notice's link, or say in the PR body that the scripted hash stands in for it and have master accept it |
| QLT-833-08 | Minor | `part-form-ghost.tsx:95-103` (via `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Skeleton`) | PF-9.4 | PF-9.4 lists `data-slot` among the markers the ghost must not carry. The ghost has `data-slot="card"`, `card-header`, `card-title`, `card-content` and `skeleton`. The unit test forbids only `textarea` and `input`. No current E2E locator is satisfied by the ghost by mistake (I checked the unscoped `[data-slot="card"]` uses: each is filtered by text or scoped). The new spec itself relies on `[data-slot="card"]` | A future unscoped card locator on the estimate page could match the ghost | The ux-expert accepts it (Card gives the same box), or the ghost uses plain `div`s with the card's classes and its own marker |
| QLT-833-09 | Minor | `partform-placeholder.spec.ts` | PF-14b, PF-14c, PF-14d, PF-14f | Not built: 1024 px (declared), the count of height changes (declared), the Engineer's Prepared/Approved state with the notice (not declared), PF-14c's "no `aria-busy="true"` and no Loading status left" (only `[data-part-ghost]` count 0 is checked), PF-14d's Tab-through (inert attribute and axe stand in) | Smaller coverage than the ruling's checks | Add the Engineer locked case and the two PF-14c assertions (cheap). List the rest in the PR body for the ux-expert's check |
| QLT-833-10 | Minor | `tests/e2e/support/auth.ts:326` | helper doc ("every part") | `makeEstimateCalculable` writes the part's inputs onto **every** node of the estimate, the Main Assembly included (`WHERE estimate_id = $1`) | Works today (Calculate answers 200), but stores part inputs on an assembly row, which another rule may read later | Add `AND node_kind = 'PART'` (or the column's real name) |
| QLT-833-11 | Info | `src/app/(portal)/estimates/[code]/engineer-ghost.tsx:24-31`; `page.tsx` Engineer branch | NFR-002; architect note §5a | **(a) is confirmed by construction.** The Engineer's ghost is built only from `getForm(viewer)` through `formBody` (the strict, no-cost `formResponseSchema`, the same body `GET /form` sends this Engineer) plus two constants. The ghost draws section names, column ranges, strip items and hints. It does not draw labels, units, defaults or values. Nothing from the costs view or the Lead's seed can reach this branch. A failed read logs the kind only and draws no ghost | — | — |
| QLT-833-12 | Info | `src/lib/estimates/form-shown.ts`; `form-values.ts`; `compact-layout.test.ts` | PF-4, PF-5; brief item 2 | Good practice. The three shape rules moved **verbatim** and are re-exported, so no caller changed. `compact-layout.test.ts` is **not weakened**: the file list loses `part-fields.tsx` because the class moved into `FORM_ROOT`, and two new assertions pin `is-compact` in `FORM_ROOT` and `className={FORM_ROOT}` in `part-fields.tsx`, which is the same guarantee as before, now on the shared string. The ghost also uses `FORM_ROOT`, so the scope reaches it as PF-4 intends | — | — |

<details><summary>Detailed notes and code suggestions</summary>

### QLT-833-01
**Current** (`estimate-review.tsx:148`)
```tsx
ghost: seed === undefined ? undefined : ghostOf({ form: seed.form, part: seed.part, notice: inputsNotice(header.status, isIgnored, state), head: 'lead' }),
```
**Suggested** (in `PartFormGhost`, so the second wait in `PartFields` gets it too)
```tsx
const look = head === 'lead' ? reviewField : (field: FormField) => field;
const sections = shownSections(form.sections, texts).map((section) => ({ ...section, fields: section.fields.map(look) }));
// and GhostTreatments: for the review, one h-s-5 line (none chosen) or the chips' row height, not CONTROL_HEIGHT
```
Check that `review-look.ts` has no client import (today it imports only `QTY_PER_ASSY_HINT` and a type), so the ghost stays server-safe (PF-6).

### QLT-833-03
**Current** (`estimate-page.test.ts:224-228`)
```ts
for (const word of [section.name, section.columnRange, section.shortName, `${String(section.number)}`]) allowed.add(word);
...
const stray = texts.filter((text) => ![...allowed].some((word) => text.includes(word) || word.includes(text)));
```
**Suggested**
```ts
const allowed = [FORM_LOADING, FORM_LOCKED, ...form.sections.flatMap((s) => [s.name, s.columnRange, sectionLinkText(s.number, s.shortName), ...s.fields.flatMap((f) => (f.hint === null ? [] : [f.hint]))])];
const stray = texts.filter((text) => !allowed.includes(text));           // exact, not a substring
expect(stray).toEqual([]);
let rest = ghost;
for (const word of [...allowed].sort((a, b) => b.length - a.length)) rest = rest.replaceAll(escapeHtml(word), '');
expect(rest).not.toMatch(/\b(rates?|prices?|costs?|formulas?)\b/i);     // attributes included, as before the PR
expect(rest.replace(/ (class|style)="[^"]*"/g, '')).not.toMatch(/\d/);  // no figure anywhere else
expect(ghost).not.toMatch(/[$€₹]/);
```
Mutants to re-run: a ghost text `Machining rate 450.00 per hour`; a ghost text `16889808.07`; `title="Machining rate 450 per hour"` on the ghost's inner `div`. Each must fail.

### QLT-833-04
```ts
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
```
</details>

## Issues for other roles

- **ux-expert:** QLT-833-02 (a), whether the ghost's region takes `aria-label` beside the hidden line; QLT-833-02 (b), the PF-9.2 change to DEF-059's case; QLT-833-08, `data-slot` in the ghost; the treatments in the Lead's ghost (QLT-833-01), which PF-1 already describes (chips or "None selected").
- **master:** QLT-833-07, whether a scripted hash meets DL-465 (3) (i)'s "Enter" wording.
- **qa-engineer:** QLT-833-05, the approval cases red on this run only, to be read with lane 2's cause.

## Previous Findings (re-review only)

None (round 1).

---

# Round 2 — delta `4d367758...da536811`

| Field | Value |
|-------|-------|
| Review round | 2. The delta only: 13 commits, fe4ac129 to da536811. The head moved eight times while I reviewed; I judged each delta as it arrived and set the verdict on the last head |
| Commit reviewed | `da536811` (tests only since fdb966a4: 898ab8f3 QLT-833-19, da536811 the unlocked-Draft Enter case) |
| CI judged | **da536811: run 46035822905**, attempt 1 `failure` (shard 4), the run of record; attempt 2 (a re-run of shard 4 started by lane 2 without authorisation) `success`, reported separately and **not** counted as the run of record (master is ruling on it). **fdb966a4: run 46031373092**, the last run before it with the product code unchanged since 1d435f9b. Shards 1, 3 and 4 `success`; shard 2 cancelled by the runner; Stage 11b `/estimates/[code]` **193,080 B** (DL-468 limit 194,000 B) |
| Date | 2026-11-27 |
| Reviewed against | Round 1's findings; the amended UX ruling (PF-9 items 1 to 3, PF-14c, PF-14h, PF-16, PF-17; records-u); DL-465 (3) and notes 6, 7 and 9 (records-u d60a6740 and later); DL-470 (3) |
| GitHub review | [pullrequestreview-6091629223](https://github.com/sankumar76/Accucut-Quotation/pull/833#pullrequestreview-6091629223) (COMMENT, single-token, 1 inline comment); label `review:quality-changes-requested` kept |
| **Verdict** | **REQUEST CHANGES**, on one open item only: QLT-833-21 (Major), the `estimate-warning` time-outs on attempt 1, waiting on master's ruling on its cause step and on the re-run. Every code finding of rounds 1 and 2 is closed or Minor. If master clears QLT-833-21, the code is APPROVE WITH COMMENTS |

## Round 2 summary

Lane 2 fixed every round-1 Blocker and Major. Each fix is at the cause: the Lead's ghost now follows the review look; the ghost is a named status with no `aria-busy`; the NFR-002 ghost scan is exact and pins every attribute value; and the route handlers are removed after each test. One new Critical came up in this round and was fixed within it. Lane 2 had held the picture control's code back during the measurement, which hid a 22 to 38 px move of `#review-actions` (QLT-833-13). That hold is gone, the picture placeholder now has the final control's height, and every Lead case is measured again once the picture has arrived. The keyboard path DL-465 (3) (i) names (focus the real rates-changed link, press Enter before the swap, then the button is in view after the swap and after the picture) runs on the two states where the notice shows, Prepared and an unlocked Draft. Every case runs at 360, 768 and 1366 px, and all of them passed attempt 1 at da536811. One item stays open, and it is not a code finding. On attempt 1 at da536811, the run of record, six `estimate-warning` cases on the Engineer's page timed out on both tries in a slow desktop shard. This PR changes that page, the same cases failed at ede67a90, and the cause is not established. A re-run of that shard, started without authorisation, passed, but it does not count as the run of record. That item is master's to rule on (QLT-833-21). Everything else left is minor.

| Severity (open after round 2) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (QLT-833-21, open for master's ruling) |
| Minor | 4 (QLT-833-09 part, -10, -15 part, -20) |
| Info | 4 (QLT-833-11, -12, -16, -17) |

## Round 2 checks run

| Check | Command / source | Result |
|-------|------------------|--------|
| Delta | `git diff 4d367758 origin/pr-833`, read commit by commit | Product: `part-form-ghost.tsx`, new `surface-chips.tsx`, `surface-treatments.tsx`, `picture-slot.tsx`, `form-layout.ts`, `form-shown.ts`/`form-values.ts` (`sectionProgress` moved verbatim and re-exported), `engineer-ghost.tsx`, `estimate-review.tsx`, `part-fields.tsx`. Tests: `partform-placeholder.spec.ts`, new `estimate-review-row-return.spec.ts`, new `support/assigned-estimate.ts`, `hold-fields-chunk.ts`, `estimate-page.test.ts`, `part-form-ghost.test.ts` |
| CI at ede67a90 (before the picture hold) | run 46016096221 | Lead swap still moving: [tablet] 2773 → 2735 (38 px), [desktop] 2283 → 2261 (22 px), [mobile] 4102 → 4130 (28 px) |
| CI at 517d367a (hold removed, before the count block) | run 46023034732 (cancelled part-way by the next push) | [mobile] Lead Draft and Prepared 28 px at the swap (3890 → 3918, 4078 → 4106); fixed by d4bd3753 (the card count's block takes its words' width, so the 360 px header wraps as the form's does) |
| CI at fdb966a4 | run 46031373092 | Every `partform-placeholder` case **passed on attempt 1** at all three widths: shard 1 [mobile] `:86` Draft, `:86` Prepared, `:136` PF-17 Approved, `:162` Enter (Prepared), `:187` Engineer, `:211` PF-14e; shard 3 [tablet] the same six; shard 4 [desktop] the same six. `estimate-review-row-return:29` passed [mobile], [tablet], [desktop]. Flaky (passed on retry), not in this PR's specs: `estimate-tree:1056` [mobile]; `estimate-form-choice` :88 :109 :126 and `estimate-form-sections:64` [desktop], DEF-085's family, which master's note 7 does not attribute to #833 |
| CI at da536811 | run 46035822905 | **Attempt 1 (run of record):** shards 1, 2 and 3 `success`, shard 4 `failure`. Every `partform-placeholder` case passed attempt 1 at all three widths: [mobile] shard 1, [tablet] shard 3, [desktop] shard 4; 8 per width, `:86` Draft and Prepared, `:138` PF-17 Approved, `:167` Enter on a Prepared estimate and on an unlocked Draft, `:204` Engineer, `:228` PF-14e. `estimate-review-row-return:29` passed at all three widths. Stage 11b **193,080 B**. **Shard 4 [desktop] (28.8 min, against 12.9 to 17.8 min for the others):** 7 failed on both tries, all time-outs: `estimate-warning.spec.ts` :90, :99, :117, :145, :156, :181 (for example `page.waitForResponse: Test timeout of 30000ms exceeded` at `:52`; `keyboard.press` time-out at `:192`) and `masters-table-actions.spec.ts:409` (axe `page.evaluate` time-out). 7 flaky, all outside this PR's specs (DEF-085's four, `estimate-tree-width:544`, `export-refusal:93`, `formula-editor:64`). **Attempt 2 (shard 4 re-run, not of record):** `success`, 588 passed, 4 flaky (DEF-085's four); all nine `estimate-warning` cases passed attempt 1 in 20.3 min |
| The rates-changed notice's states (for note 7) | read `rates-changed-notice.tsx:25`, `estimate-review.tsx:211`, `estimate-review-service.ts:174`, `state-machine.ts:14,17` | The notice draws when the figures are `current`, rates changed and a calculation time exists, on any review that is not ignored. Rates are counted for every status except APPROVED. UNLOCK takes APPROVED or QUOTED to DRAFT and keeps the calculation, so **an unlocked Draft shows it** (STORY-06.11 AC-10; `rates-changed.spec.ts:319`; `tests/integration/estimates/rates-changed.test.ts:243`). Lane 2's first claim ("it cannot appear on a Draft") was wrong. The Draft case was added in da536811 |
| Width at 360 px | `playwright.config.ts` (unchanged by the PR); CI 45997757836 (round 1, red before the fix) | The spec is in no width list (`OWN_WIDTH_FILES` = `aqp-234-qa.spec.ts`, `masters-table-actions.spec.ts`), has no `@one-width` tag, no skip and no `.only`. **At 360 px the form is above `#review-actions`**: before the fix the swap moved it 2,360 px down there, which only a form above it can do. No case needs a phone-width exemption, so the PR body needs no reason for one |

## Prior findings, verified

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-833-01 | Blocker | **Fixed** | The Lead's ghost goes through `reviewField` and draws the treatments with the same `TreatmentChips` as the form (PF-16). The picture box follows the control: no hint line in the review look, and the thumbnail-only box when the page cannot change the part (PF-17). The card count's block takes the width of its words. The Engineer's title line uses `--lh-sub`. Green at three widths, at the swap and once the picture is here (fdb966a4) |
| QLT-833-02 | Blocker | **Fixed** | Every ghost is `role="status" aria-label="Loading the form"`; the second wait has no text (amended PF-9.1/9.2). `estimate-first-load.spec.ts` is untouched, and its `:59` and `:75` pass |
| QLT-833-03 | Blocker | **Fixed** (test quality; the combined reviewer holds the security lens, SEC-833-01 to -07) | The scan checks the skeleton tag by tag and text by exact match. Every attribute is on a list with its exact value, and class tokens must come from the ghost's own code; no comment, script, single-quoted or bare attribute is allowed. It runs on the editable and the locked Engineer ghost and on the Lead's ghost. My three mutants, the old scan's cases and 23 values in 11 places all fail it. QLT-833-14 (round 2) is closed by the same work |
| QLT-833-04 | Major | **Fixed** | `test.afterEach(page.unrouteAll({ behavior: 'ignoreErrors' }))` |
| QLT-833-05 | Major | **Fixed** | Root cause: `figure-tiles.tsx:64-65` hides every figure while any `[aria-busy=true]` is in the review, and the ghost carried one. Removed; a unit test holds both waits to no `aria-busy`; PF-14h asserts `[aria-busy="true"]` count 0 and the Totals visible before the swap. The approval specs pass again |
| QLT-833-06 | Major | **Fixed** | The Engineer case waits for the answer of the tree's read (the tree is in a drawer on a phone) and two animation frames, then measures. The page-end bar is PF-15's 24 px, as DL-465's "improved, not regressed" allows: not a weakening of a ruled bar |
| QLT-833-07 | Minor | **Fixed** | Enter on the real notice link, on **a Prepared estimate and an unlocked Draft** (da536811, DL-465 notes 6, 7 and 9). The Draft is built as `rates-changed.spec.ts:319` builds it (approve, then unlock, through the API, after the price changed), with no person made |
| QLT-833-08 | Minor | **Fixed** | `NO_SLOT`; a unit test allows only the notice's `alert*` slots |
| QLT-833-09 | Minor | **Partly fixed** | Added: PF-14c's two absences, the Approved case (PF-17), the Engineer's locked ghost in the unit scan. Not built: 1024 px, the count of height changes, the Engineer's locked state in the E2E |
| QLT-833-10 | Minor | **Not fixed** | `makeEstimateCalculable` (`support/auth.ts:326`) still writes every node of the estimate |
| QLT-833-11, -12 | Info | — | Unchanged |

## Round 2 findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Status at da536811 |
|----|----------|-----------|-----------------|-------|--------|--------------------|
| QLT-833-13 | Critical | (b418cbea) `partform-placeholder.spec.ts:81`, `:129`; `hold-fields-chunk.ts`; `part-form-ghost.tsx:91` | DL-465 (3) (i) and its rejected alternative (ii); PF-16.3 | **The picture hold hid a move the 8 px bar should catch.** b418cbea held the picture control's code through the measurement, after ede67a90 had measured that arrival at 22 to 38 px. `PictureSlot` asks for that code as soon as the fields mount, so a person meets it right after the swap. The keyboard case also held it, so the named user path was not proven to its end. The cause was a hint line that the review look removes, kept in the ghost and in `PictureSkeleton` | DL-465's bar met only for a moment | **Fixed (517d367a, 1d435f9b).** No hold anywhere. `PictureSkeleton` and the ghost take the final control's box: `PICTURE_ZONE_HEIGHT`, or `_UNHINTED` for the review look, or `_READONLY` (built from tokens) when the part cannot be changed. Every Lead case, the Approved case and both Enter cases are measured again after `pictureControlHere`, held to 8 px or asserting the button in view |
| QLT-833-14 | Minor | `estimate-page.test.ts` | NFR-002 test quality | Free attribute values; the locked Engineer ghost not scanned | — | **Fixed** (d9d29ce7, b359f21f, f6b35c5a) |
| QLT-833-15 | Minor | `tests/e2e/partform-placeholder.spec.ts` (PF-14e, the last `waitForLoadState('networkidle')`) | DL-404; §6 | Three `networkidle` waits; redundant once `afterEach` removes the routes | At least 0.5 s per case; can run to the time-out on a page with an open request | **Partly fixed**: the Lead cases' two are gone, PF-14e's remains. Remove it |
| QLT-833-18 | Minor | `form-layout.ts` (`PICTURE_ZONE_HEIGHT_UNHINTED`), `picture-slot.tsx` | PF-13.1, PF-17 | The Lead's picture box chosen by "no hint", with locked Lead states not measured | Approved and Quoted could still shift | **Fixed in substance** (1d435f9b): a read-only box built from tokens, chosen by `editable`, and an Approved swap case. The residue is QLT-833-20 |
| QLT-833-19 | Minor | `partform-placeholder.spec.ts` (Lead move cases) | test determinism | The jump target was found at run time, so a Draft that lost its Calculate button would have jumped to Approve and passed | A silent pass on a regression | **Fixed** (898ab8f3): `prepared ? '#review-approve' : '#review-calculate'`, asserted `toHaveCount(1)` first |
| QLT-833-20 | Minor | `src/components/shared/form-layout.ts` (`PICTURE_ZONE_HEIGHT_UNHINTED = 'h-[146px] md:h-[114px]'`) | PF-13.1 ("no per-width table read from one run") | The editable review's picture box is a per-width pixel table read from the control on the Lead's page. It is chosen by "the field has no hint", but what sets it is the Lead's column width and the control's own text. Unlike `PICTURE_ZONE_HEIGHT` (pinned within 2 px by `estimate-picture.spec.ts`), nothing pins it except the 8 px move cases at three widths | A width other than the three (1024 px), or a change to the control's text, can shift by a few px with no test naming why | Pin it as `estimate-picture.spec.ts` pins the other (the skeleton's box within 2 px of the control on the Lead's page at 360, 768 and 1366 px), or name it by what it is (the review's box) and add 1024 px to the Lead move cases. Not a merge condition |
| QLT-833-21 | Major | (not a code line) `tests/e2e/estimate-warning.spec.ts` :90, :99, :117, :145, :156, :181 [desktop]; the Engineer's page changed by this PR (`page.tsx` Engineer branch: one more `getForm` read per render; the ghost in `PartForm`) | CI green (DL-436); RISK-031 wave rules (W1 (e)); DL-449 (3) (e) (a product cause ruled out first) | On da536811 attempt 1, the run of record, the six cases timed out on **both** tries in shard 4 [desktop] (28.8 min). The same spec failed in the desktop shard at ede67a90 (run 46016096221: :80, :90, :99, :156, :211, a 26.5 min shard). It passed at fdb966a4 (run 46031373092, 21.0 min) and on `master` f7b20eff. `masters-table-actions:409`, on a page this PR does not touch, also timed out in the same shard, which points to a slow runner. But W1 (e) excludes reading it as a wave, because this PR changes the Engineer's page those cases use. The re-run (attempt 2, all nine passed in 20.3 min) was started without authorisation and is **not** the run of record | If the cause is this PR (the added render read, or the ghost in the Calculate path), the Engineer's Calculate warning gets slower or stalls | **Open, for master's ruling** on whether attempt 2 counts and on a cause step. My suggestion for the cause step: compare the Engineer page's server render time and the `estimate-warning` attempt-1 durations on `master` and on this branch at the same draw; and read `:52` (`waitForResponse` of Calculate) against the extra `getForm` read in `engineerGhost`. Not cleared by me |
| QLT-833-16 | Info | `surface-chips.tsx`; `part-form-ghost.tsx` (card count) | PF-3, PF-16.2; PF-4 | The Lead's ghost shows the chosen treatments as chips, which PF-16.2 rules. The card count's place holds invisible "n of m" words. In the Engineer's ghost these are "0 of" the total since 1d435f9b, the definition's own counts, which the strict scan allows by exact text. Sharing `TreatmentChips` between the form and the ghost is good practice | — | — |
| QLT-833-17 | Info | `tests/e2e/estimate-review-row-return.spec.ts` | DL-470 (3); DL-422; DL-388 | A sound regression case for the stale seed (edit, leave, return, then a second save not refused 409). It passes at three widths (fdb966a4) and makes no person | — | — |
