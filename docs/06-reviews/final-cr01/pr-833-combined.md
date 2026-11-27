# Review Report — PR #833 (AQP-502 / DEF-145: the PartForm placeholder holds the form's space) — Combined security and quality, security lens first, performance lens

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance (the §9 (2) combined review that DL-465 note 6 requires because #833 changes an NFR-002 cost-confidentiality scan on the Engineer's page; security lens first, then performance). reviewer-quality's first pass is `pr-833-quality.md` (QLT-833-01 to -12) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-502-partform-placeholder` (PR [#833](https://github.com/sankumar76/Accucut-Quotation/pull/833)) |
| Commits reviewed | `b418cbea` (named in the request), then **`14371378`** (tests only: PF-14h), where the mutation work was run and the review submitted; then `517d367a` (layout only: the picture block; read, no change to what the ghost draws or to the scan) |
| Date | 2026-11-27 |
| GitHub review | [pullrequestreview-6090197973](https://github.com/sankumar76/Accucut-Quotation/pull/833#pullrequestreview-6090197973) (COMMENT, REVIEW_IDENTITY single-token), 4 inline comments |
| Reviewed against | NFR-001, NFR-002; DL-465 (note 6), DL-468 (194,000 B); QLT-833-03; `tests/unit/estimate-page.test.ts` (the old whole-page scan and the new ghost scan) |
| **Verdict** | **REQUEST CHANGES.** **1 Blocker, 1 Critical, 1 Major, 1 Minor, 2 Info.** The §9 stop applies (Blocker and Critical). **The new ghost scan is not at least as strong as the old whole-page scan**: 13 inputs that the old scan rejected pass it. The ghost itself is sound |

## Summary

The ghost is built safely. On the Engineer's page it is drawn from the Engineer's own `getForm` through the route's strict schema, and every text in it is a text of that definition or a fixed line. I found no way for it to carry a cost figure. The test that is meant to guard this is weaker than what it replaced, in two places that I proved by mutation: `class` values are not scanned at all, and the scan deletes every allowed text from the whole markup, so a short allowed text such as the column range `R` removes every capital R from it and `Rate` is no longer a word of the scan. A stricter scan of the same size (exact attribute values, class tokens, no comment or script, no `replaceAll` on markup) killed all 264 mutants I tried and accepts the real ghost.

| Severity | Count |
|----------|-------|
| Blocker | 1 (SEC-833-01) |
| Critical | 1 (SEC-833-02) |
| Major | 1 (SEC-833-03) |
| Minor | 1 (SEC-833-04) |
| Info | 2 (SEC-833-05, -06) |

## Checks Run

| Check | Command / source | Result |
|-------|------------------|--------|
| Diff | `git diff origin/master...pr/833` (27 files, +1,127 −131) and the delta to `517d367a` | read; the delta changes the picture block and tests only |
| Real tests, unchanged, at `14371378` | `npx vitest run tests/unit/estimate-page.test.ts tests/unit/part-form-ghost.test.ts` in my own worktree `.claude/worktrees/sec-833` (node_modules by junction to another worktree's, as the other lanes do; `src/generated` copied) | 2 files, **58 tests pass**, including the 11 mutants of the PR, which all fail the scan as claimed |
| Architecture and import rules | `tests/security/engineer-import-rule.test.ts`, `tests/unit/estimate-review-architecture.test.ts`, `part-form-ghost.test.ts` | 3 files, 1,652 tests pass |
| **Mutation matrix** (mine) | a copy of `estimate-page.test.ts` with an added matrix, in the same worktree | **23 values × 11 places = 253 cells + the 11 lane mutants**, each against (a) the old whole-page scan applied to what was added and (b) the real `ghostViolations`, with the real ghost markup and the real allowed list; then the same against a stricter scan |
| CI at `14371378` (run 46021515304) | job log | Stages 1 to 11b **passed**: unit 552 files, 11,879 tests; unit, integration, security and acceptance 728 files, 17,760 tests. **Stage 11b `/estimates/[code]` 193,074 B**, within DL-468's 194,000 B (and under the old 193,500 B). E2E shards were running |
| CI at `517d367a` (run 46023034732) | job log | Stages 1 to 11b **passed**: unit 11,880 tests; unit, integration, security and acceptance 17,761 tests. **Stage 11b `/estimates/[code]` 193,077 B** (+3 B on `14371378`), within 194,000 B. E2E shards running when I wrote this; not read |
| Cleanup | my worktree, the junction and the copied files | removed afterwards (see the end) |

## Mutation proof

**Setup.** The real ghost of the Engineer's page (20,327 characters of markup, about 180 `class` attributes), the real `ghostViolations` (unchanged), and the real allowed list from the Engineer's `getForm` (37 texts). For each (value, place) I asked: *does the old scan reject what was added* (the word regex of the old test, or a review word it also checked) and *does the new scan reject the changed ghost*. A **regression** is old rejects and new passes.

**Values (23):** `Machining rate 450.00 per hour`, `16889808.07`, `rate`, `cost`, `formula`, `price`, `Total Unit Production Price`, `450`, `45`, `1,234`, `₹`, `$`, `€`, `£`, `Rs 5`, `=E5*F5`, `=SUM(E5:E9)/G3`, `Qty*Rate`, fullwidth `４５０.００`, Arabic-Indic `٤٥٠`, `＄5`, `ra&#8203;te` (zero-width), fullwidth `ｒａｔｅ 450`.
**Places (11):** a text node; a `class` value; a `data-ghost-*` value; `aria-busy`, `aria-hidden` and `inert` values; a `style` value; an unlisted attribute (`title`); a single-quoted attribute; an HTML comment; a `<script>` block.
**Also:** text split across elements (3 forms); a rate in a section name (in the ghost only, and in the definition itself).

| Result | Count | Which |
|--------|-------|-------|
| **Regression (old rejects, new passes)** | **13** | **6 in a `class` value** (`Machining rate 450.00 per hour`, `rate`, `cost`, `formula`, `price`, `Total Unit Production Price`); **7 for `Qty*Rate`** in a `class` value, a `data-ghost-*` value, an `aria-busy`, `aria-hidden` or `inert` value, a single-quoted attribute and an HTML comment |
| Passes both (the old scan never rejected it) | 64 | two-digit numbers, `£`, `Rs 5`, `=E5*F5`, `=SUM(E5:E9)/G3`, fullwidth and Arabic-Indic digits, `＄5` in a `data-ghost-*`, `aria-*`, `inert` value, a single-quoted attribute or a comment (and in `class`); and in `class` alone: `16889808.07`, `450`, `1,234`, `₹`, `$`, `€`, `ra&#8203;te`, `ｒａｔｅ 450` |
| Rejected by the new scan | the rest | a text that is not the definition's; `title` and any unlisted attribute; a `style` value; a `<script>` block; `$` `€` `₹` or 3 or more ASCII digits in a `data-ghost-*`, `aria-*` or `inert` value |
| Split across elements | rejected (3 of 3) | each fragment is a text that is not the definition's |
| A rate in a section name | in the ghost only: rejected; in the definition itself: passes by design (SEC-833-05) | |

**Why 7 pass: the one-character allowed texts.** The allowed list from the real definition holds `R`, `P, Q`, `S–U`, `V–Y` and `Z–AG` (the cards' column ranges): 5 of 37 texts are 4 characters or fewer. The scan does `rest.replaceAll(text, '')` on the whole markup for each allowed text, so every capital `R` is deleted from every attribute value and comment, and `Qty*Rate` becomes `Qty*ate`. Lower-case `rate` is untouched, which is why the PR's own mutants (all lower case, in texts and in a `title`) did not show it.

**The same matrix against a stricter scan: 0 survivors of 264** (253 cells + 11 lane mutants), and the real ghost passes it. Its rules: (1) every text node exactly a text of the definition or a fixed line (as now); (2) refuse `<!--`, `<script`, `<style`, `<?` and CDATA; (3) every attribute exactly one of: `inert=""`, `aria-hidden="true"`, `role="status"`, `aria-label` = `FORM_LOADING`, `data-part-ghost=""`, `data-ghost-wide=""`, `data-ghost-picture=""`, `data-ghost-grid=""`, `style="--n:<digits>"`, and `class` whose every token is in the set of tokens the ghost's code defines; (4) refuse an attribute with single or no quotes; (5) no `replaceAll` on markup. The function I used (a test file in my worktree, not committed) is:

```ts
function strictViolations(ghost: string, allowedTexts: ReadonlyArray<string>, classTokens: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const allowed = new Set(allowedTexts);
  for (const match of ghost.matchAll(/>([^<>]+)</g)) {
    const text = decode(match[1] ?? '').trim();
    if (text !== '' && !allowed.has(text)) problems.push(`text: ${text}`);
  }
  if (/<!--|<script|<style|<\?|<!\[CDATA/i.test(ghost)) problems.push('comment, script or style');
  const exact: Record<string, (value: string) => boolean> = {
    inert: (v) => v === '', 'aria-hidden': (v) => v === 'true', role: (v) => v === 'status', 'aria-label': (v) => v === FORM_LOADING,
    'data-part-ghost': (v) => v === '', 'data-ghost-wide': (v) => v === '', 'data-ghost-picture': (v) => v === '', 'data-ghost-grid': (v) => v === '',
    style: (v) => /^--n:\d+$/.test(v),
    class: (v) => v.split(/\s+/).filter((t) => t !== '').every((t) => classTokens.has(t)),
  };
  for (const match of ghost.matchAll(/ ([a-zA-Z][\w:-]*)=(?:"([^"]*)"|'([^']*)')/g)) {
    const name = match[1] ?? '';
    const value = match[2] ?? match[3] ?? '';
    if (match[3] !== undefined || exact[name] === undefined || !exact[name](value)) problems.push(`attribute: ${name}="${value}"`);
  }
  if (/ [a-zA-Z][\w:-]*=[^"'\s>]/.test(ghost)) problems.push('unquoted attribute');
  return problems;
}
```

For production use `classTokens` should come from the code (the exported strings of `form-layout.ts` and the ghost's few inline classes) and not from the ghost under test, which is what I used for the mutants only.

## The ghost can carry only the Engineer's own definition and fixed texts (checked in the code)

- `engineer-ghost.tsx`: `estimates.getForm(viewer, estimateId)` as the Engineer (`openForRead`, `mayOpen`), then `formBody` (the route's strict schema, no added field), then `ghostOf` (`parseForm`, the form's own reader). A fault gives no ghost and logs the kind only.
- `PartFormGhost` draws, as text: `FORM_LOADING` (a hidden line and the status's name), each section's `name`, `columnRange` and `sectionLinkText(number, shortName)`, each field's `hint`, `SURFACE_HINT`, and, for a locked estimate, the `Notice` with `FORM_LOCKED`. The controls are `Skeleton` blocks with no text. `style` holds `--n` (the number of fields of a card). The picture block and the hint line follow `field.hint` (the delta to `517d367a` changes only which grey block the picture has).
- The Engineer's ghost is given no part values (`texts` is empty), so `TreatmentChips` (a chosen flag's label, its column letter and `= 1`) is never drawn for an Engineer.
- It is a server component with no `'use client'`, so by construction the Flight payload carries its output and not its `form` prop (I did not inspect a payload).

## NFR-001 and NFR-002 overall

| Check | Result |
|-------|--------|
| Role and route | **Met.** The Engineer branch only (`case 'ENGINEER'`), one more read of the service behind `GET /form`; no new route; the role-matrix has nothing new. `engineer-import-rule` and `estimate-review-architecture` pass |
| Engineer: no cost to an Engineer | **Met in the code; the guard is weak (SEC-833-01 to -03).** The ghost holds only the Engineer's definition and fixed texts. The test that is meant to prove it is not as strong as the old one |
| Lead's ghost (`estimate-review.tsx`) from the seed | **Met.** Built from `seed.form` and `seed.part`, the Engineer-safe bodies of #827; the part's values decide which cards show, and chosen treatments print as a label, a letter and `= 1`. No figure. It has no scan test (SEC-833-04) |

## Findings

| ID | Severity | File:line | Rule / NFR | Issue | Impact | Suggested fix |
|----|----------|-----------|------------|-------|--------|---------------|
| SEC-833-01 | **Blocker** | `tests/unit/estimate-page.test.ts:242` (and `:238`) | NFR-002; PR claim "at least as strong" | `class` and `style` values are removed from the text that is scanned for words and figures, and `class` is on the attribute allow-list with any value. A word of the old scan, a rate or a figure in a `class` passes | 6 of 13 regressions: `rate`, `cost`, `formula`, `price`, `Total Unit Production Price`, `Machining rate 450.00 per hour` in a `class` all pass; the old whole-page scan rejected each. About 180 elements carry a `class` | Do not strip `class`: require every token to be in a set from the code, and run the word scan on class values too |
| SEC-833-02 | **Critical** | `estimate-page.test.ts:243` | NFR-002 | `rest.replaceAll(text, '')` deletes every allowed text from the whole markup, and the allowed list holds `R`, `P, Q`, `S–U`, `V–Y`, `Z–AG` (5 of 37 are ≤ 4 characters) | 7 of 13 regressions: `Qty*Rate` in a `data-ghost-*`, `aria-busy`, `aria-hidden` or `inert` value, a single-quoted attribute or a comment passes (every capital `R` is deleted, so `Rate` is no word); lower-case `rate` is caught, which is why the PR's mutants did not show it | Never `replaceAll` on markup; check attributes by exact (name, value) pairs, refuse comments, script, style and non-double-quoted attributes (rules in the proof section) |
| SEC-833-03 | **Major** | `estimate-page.test.ts:228` | NFR-002 | The figure check is ASCII-only, 3 or more digits or a decimal, and three currency signs | 64 cells pass in attributes and comments (also passed the old scan, so not a regression): `45`, `£`, `¥`, `Rs 5`, `=E5*F5`, `=SUM(E5:E9)/G3`, fullwidth and Arabic-Indic digits, `＄5`; the claim "no figure" holds for texts only | The exact-value attribute table makes it moot; otherwise `\p{Nd}` with the `u` flag and add `£ ¥ Rs INR =` |
| SEC-833-04 | Minor | `estimate-page.test.ts:255` | NFR-002 | The scan runs for the Engineer's Draft only: `FORM_LOCKED` and the ignored words are not in the allowed list, so a locked or ignored estimate's ghost is never scanned (it would fail, a false alarm). The Lead's ghost has no scan | the same function draws every state and both heads | Run it for the Engineer's Approved and ignored estimates with the fixed texts allowed; give the Lead's ghost a scan (texts equal the seed's definition, the notice and the chips' labels; no digit run) |
| SEC-833-05 | Info | `estimate-page.test.ts:256` | NFR-002 | A rate typed into the registry itself (a section name or a hint) passes the new scan by design, because the allowed list is built from the same `getForm` | the old scan never saw those texts (the page did not carry them); `GET /form` already sends them to the Engineer; the strict schema bounds keys, not words | None here. The guard for registry text is the config editor's content: product-manager and architect may want a rule there |
| SEC-833-06 | Info (performance) | `engineer-ghost.tsx` | NFR-009, NFR-010 | The Engineer's render gains one `getForm` (about 3 to 4 queries) and the ghost's markup (20,327 characters in the unit render, about 180 class attributes; a few KB gzipped, an estimate); no client JavaScript; no per-row growth (the ghost is a new part's) | small; Stage 11b is 193,074 B | None |

## NFR impact

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-002 no cost to an Engineer | **The guard on the Engineer's page is weaker than before** (13 regressions); no leak found in the code | SEC-833-01, -02, -03, -04, -05 |
| NFR-001 roles on the server | None found | — |
| NFR-009 first load (DL-468: 194,000 B) | Low: 193,074 B at `14371378` | SEC-833-06 |
| NFR-010 | Low: one more read on the Engineer's render | SEC-833-06 |

## Issues for other roles
- **developer (lane 2):** SEC-833-01 to -04 (a stricter scan, with my mutants added as cases: a `class` word, `Qty*Rate` in each attribute and in a comment, `£`, a formula fragment, Unicode digits).
- **reviewer-quality:** QLT-833-03's three mutants are killed, but their `class` variants are not; QLT-833-03 should stay open until SEC-833-01 and -02 are closed.
- **product-manager and solution-architect:** SEC-833-05 (no content rule for registry text that the Engineer's page now carries).

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final-cr01/pr-833-combined.md`
- Jira / GitHub updates: PR #833 COMMENT review 6090197973 (4 inline comments); Jira AQP-502 comment
- Open questions: none
- Risks raised: none new
- Recommended next agent: developer (lane 2) for SEC-833-01 to -04; then reviewer-performance for the delta (the stricter scan and my matrix re-run)
