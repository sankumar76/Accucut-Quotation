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

---

# Round 2: delta `517d367a..1d435f9b` (the strict scan), security lens

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance (combined review, round 2) |
| Commits reviewed | `d4bd3753` (the card count block), `d9d29ce7` (the strict scan, 253 mutants), `3e82ff6c` (e2e wait), `b359f21f` (the Lead and locked Engineer ghosts scanned, the icon allowance), `1d435f9b` (the picture box follows `editable`; the Engineer count says 0 of the total; an Approved swap case). Head `1d435f9b`, which did not move |
| Date | 2026-11-27 |
| GitHub review | [pullrequestreview-6090665823](https://github.com/sankumar76/Accucut-Quotation/pull/833#pullrequestreview-6090665823) (COMMENT, 2 inline comments) |
| **Verdict (at `1d435f9b`)** | **APPROVE WITH COMMENTS.** Open: **0 Blocker, 0 Critical, 0 Major, 1 Minor (SEC-833-07), 2 Info (SEC-833-08, -09)**. **SEC-833-01, -02, -03 and -04 are resolved.** The E2E shards of run 46027662255 were running when I wrote this and are not read |

## The matrix against the PR's actual scan

I ran the PR's own `strictViolations`, `classTokensOfTheCode`, `NOTICE_ALLOWANCE`, `theGhostAndItsAllowedTexts` and `theLeadGhost`, unchanged, in my own worktree at `1d435f9b` (a copy of `estimate-page.test.ts` with my block added; node_modules by junction as before, `src/generated` copied; removed afterwards, junction first), with the round-1 matrix (23 values × 11 places = 253 cells) on **three real ghosts**.

| Ghost | Baseline violations | Cells | Survivors | Regressions against the old whole-page scan |
|-------|---------------------|-------|-----------|---------------------------------------------|
| Engineer (20,800 characters) | none | 253 | **0** | **0** |
| Lead, from the seed (20,327) | none | 253 | **0** | **0** |
| Locked Engineer, Approved (21,455) | none | 253 | **0** | **0** |

Every input the old scan rejected is still rejected on all three ghosts, and so are the 64 cells it never rejected. The PR's own tests (`estimate-page.test.ts`, `part-form-ghost.test.ts`) pass in my run.

| Round-1 finding | Status |
|-----------------|--------|
| SEC-833-01 (Blocker): `class` values unscanned | **Resolved.** A class is checked by token against tokens read from the code (123 tokens; 154 with the notice files), none containing a word of the old scan, none a bare number |
| SEC-833-02 (Critical): `replaceAll` of short allowed texts | **Resolved.** No `replaceAll` on the markup; attributes by exact (name, value); no comment, script, style, `<?` or CDATA; single or no quotes refused |
| SEC-833-03 (Major): weak figure check | **Resolved** by exact values (a figure cannot be in an attribute that has one allowed value) |
| SEC-833-04 (Minor): only the Engineer's Draft scanned | **Resolved.** The Lead's ghost and the locked Engineer's ghost are scanned, each with its own allowed list; the notice is allowed by exact markup |

## The icon allowance cannot carry a word or a figure

It is one string of 343 characters, rendered from the real `Notice` at test time and taken out of the markup whole before the scan. It has no text between its tags, no word of the old scan, and its 20 numbers are the `xmlns` address, the sizes, the `viewBox` and the circle and path geometry. Its attributes are `xmlns`, `width`, `height`, `viewBox`, `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `class`, `aria-hidden` and, on the shapes, `cx`, `cy`, `r`, `d`. A changed icon is not that string, so it is not removed and fails (the PR's mutant: `<text>rate 450</text>` inside the svg). `data-slot` is accepted only as `alert` or `alert-description` and only where the allowance is given, so the plain Engineer ghost refuses any `data-slot`. The icon is the component's own output with no data in it; any data that reached it would change the string.

## SEC-833-07 (Minor, new): the scan reads text, valued attributes and comments, not the markup's skeleton

On all three ghosts, **11 of 13 extra mutants survive** that the old whole-page scan rejected (a word anywhere in the markup):

| Mutant | Engineer | Lead | Locked |
|--------|----------|------|--------|
| an attribute after a newline (`<div\ntitle="Qty*Rate 450" inert`) | survives | survives | survives |
| an attribute after a tab | survives | survives | survives |
| an attribute after a slash (`<div/title=…`) | survives | survives | survives |
| a space before the `=` | survives | survives | survives |
| a space after the `=` | survives | survives | survives |
| a bare attribute `rate` | survives | survives | survives |
| a bare attribute `data-cost` | survives | survives | survives |
| an element `<x-rate></x-rate>` | survives | survives | survives |
| an element `<cost-cell></cost-cell>` | survives | survives | survives |
| `<!DOCTYPE rate 450>` | survives | survives | survives |
| a text `&#114;ate 450` (numeric entity) | rejected | rejected | rejected |
| an upper-case attribute name `TITLE=` | rejected | rejected | rejected |
| a text appended after the ghost's end | (excluded: the page scan cuts the ghost by depth and the old scan reads what is left, so this is not a case) | | |

React's serializer writes none of these forms (one space, double quotes, tag names from the code), so a regression needs `dangerouslySetInnerHTML` or a lower-case custom tag in JSX. That is why this is Minor and not a merge condition. **Fix (about 15 lines, validated):** after the existing checks, blank every quoted value and every text node, then require the skeleton to be tags of known names (the ghost's code draws `div`, `span`, `p`, `ul`, `li`) whose attributes are of known names (the `exact` table, plus the svg's, which the allowance removes) with one space between them; refuse the old word regex in the skeleton and any `<` that is not a plain tag. I ran it on the same three ghosts: **it rejects all 11 survivors and accepts the three real ghosts.** The function:

```ts
function skeletonViolations(raw: string, allowance: Allowance, tags: ReadonlySet<string>, attributeNames: ReadonlySet<string>): string[] {
  let ghost = raw;
  for (const piece of allowance.markup ?? []) ghost = ghost.split(piece).join('');
  const problems: string[] = [];
  const skeleton = ghost.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''").replace(/>[^<>]+</g, '><');
  if (/\b(rates?|prices?|costs?|formulas?)\b/i.test(skeleton)) problems.push('a word of the old scan in the skeleton');
  for (const piece of skeleton.split(/(?=<)/)) {
    if (piece === '') continue;
    const tag = /^<(\/?)([a-z][a-z0-9-]*)((?: [a-zA-Z][\w:-]*(?:=""|=''))*)>/.exec(piece);
    if (tag === null) { problems.push(`not a plain tag: ${piece.slice(0, 40)}`); continue; }
    if (!tags.has(tag[2] ?? '')) problems.push(`tag ${tag[2] ?? ''}`);
    for (const attribute of (tag[3] ?? '').matchAll(/ ([a-zA-Z][\w:-]*)=/g)) if (!attributeNames.has(attribute[1] ?? '')) problems.push(`attribute name ${attribute[1] ?? ''}`);
    if (piece.slice(tag[0].length).replace(/^[^<]*/, '') !== '') problems.push('stray text');
  }
  return problems;
}
```

## Info

- **SEC-833-08:** the guard "no word of the old scan is a class token" (`estimate-page.test.ts:322`) runs for the plain token set only. The Lead's and the locked Engineer's ghosts use `classTokensOfTheCode(true)` (154 tokens from 8 files). Both sets are clean today; the tokens are every lower-case string literal in those files, so a future literal `'rate'` there would be allowed in a class. Run the guard over both sets.
- **SEC-833-09 (performance lens):** the ghost now draws each card's count as an invisible text ("0 of N" for the Engineer; the part's own count for the Lead; a few digits, derived from the definition by the form's own rule and checked by exact text, so it cannot carry another number). The ghost's markup is 20,800 characters for the Engineer (20,327 before), a few KB gzipped (estimate). No client JavaScript is added.

## CI at `1d435f9b` (run 46027662255)

Stages 1 to 11b **passed**: unit 552 files, 11,896 tests; unit, integration, security and acceptance 728 files, 17,777 tests. **Stage 11b `/estimates/[code]` gzip 193,080 B**, within DL-468's 194,000 B (+3 B on `517d367a`'s 193,077 B). E2E shards 1 to 4 running when I wrote this; not read.

## Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final-cr01/pr-833-combined.md` (round-2 section)
- Jira / GitHub updates: PR #833 COMMENT review 6090665823 (2 inline comments); Jira AQP-502 comment
- Open questions: none
- Risks raised: none new
- Recommended next agent: developer (lane 2) for SEC-833-07 (recommended, not a merge condition) and SEC-833-08; then master/orchestrator once the run is fully green

---

# Round 3: delta `1d435f9b..78e199f6` (option B, DL-471 notes 5 and 6), security lens

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance (combined review, round 3; GitHub [pullrequestreview-6091836306](https://github.com/sankumar76/Accucut-Quotation/pull/833#pullrequestreview-6091836306), a COMMENT) |
| Commits reviewed | `f6b35c5a` (the skeleton check in the strict scan, as I proposed), three e2e commits, and `78e199f6` (the Engineer's page makes no read of the form definition and draws no first-wait ghost) |
| **Verdict (at `78e199f6`)** | **APPROVE WITH COMMENTS.** 0 Blocker, 0 Critical, 0 Major, 0 Minor, 2 Info (SEC-833-10, -11). SEC-833-07 and -08 are resolved by `f6b35c5a` and `b359f21f`'s follow-up (the skeleton check; the token guard over both sets) |

## (a) The scan guards the exact component and data drawn

The PR's own `strictViolations` (with the skeleton check), class tokens and icon allowance, unchanged, with my 253-cell matrix and 14 forms React never writes, on five real ghosts, in my own worktree at `78e199f6` (removed afterwards, junction first). The two new ones are the **real `PartFields` second wait**, rendered with `usePartValues` stubbed to `loading` and the definition passed through `formBody`, `JSON` and the client's `parseForm`, editable and locked.

| Ghost | Baseline | Cells | Survivors | Unwritten forms surviving |
|-------|----------|-------|-----------|---------------------------|
| Engineer, `engineerGhost` builder (20,800 chars) | none | 253 | 0 | 0 |
| Lead, from the seed (20,327) | none | 253 | 0 | 0 |
| Locked Engineer, builder (21,455) | none | 253 | 0 | 0 |
| Engineer, real second wait (`PartFields`, silent; 20,755) | none | 253 | 0 | 0 |
| Locked Engineer, real second wait (21,410) | none | 253 | 0 | 0 |

The second wait's markup equals the builder's character for character except the one hidden `Loading the form` line (`silent`), editable and locked. The PR's 87 tests in `estimate-page.test.ts` and `part-form-ghost.test.ts` pass in my run, and nothing the old whole-page scan rejected passes.

## (b) NFR-001 and NFR-002

The ghost's data is now the client's own copy of the body of `GET /estimates/{id}/form` (the Engineer's `getForm` through `formBody`, the strict schema; the client keeps the keys `parseForm` names): the same body the form draws its fields from, so the ghost can show no more than the form will. The Engineer's page makes no server read of the definition and draws no ghost (a unit test spies `getForm`; `page.tsx` has neither `engineerGhost` nor `getForm`); against `master` its diff is a blank line, braces and a comment. No route, role check or import into the Engineer's page changes. The Lead's ghost is unchanged. This also removes SEC-833-06's extra read.

## Info
- **SEC-833-10:** the scan renders `engineerGhost`, which production no longer calls (the Engineer's caller of `PartFormGhost` is `part-fields.tsx`; `engineer-ghost.tsx` has no importer in `src` until #836). A change to what `part-fields.tsx` passes would not reach the scan. The harness I used (about 25 lines: stub `usePartValues`, render `PartFields` with the client-parsed form, `splitGhost`) can be one more scan case that pins the real call.
- **SEC-833-11:** `engineer-ghost.tsx` is unimported in `src` until #836; a future unused-file check would flag it.

## CI at `78e199f6` (run 46045742726)
Running when I wrote this; not read. The delta removes an `import()` and a prop, so I expect no growth (`1d435f9b`: 193,080 B, limit 194,000 B).

## Hand-off (round 3)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final-cr01/pr-833-combined.md` (round-3 section)
- Jira / GitHub updates: PR #833 COMMENT review 6091836306
- Open questions: none
- Risks raised: none new
- Recommended next agent: orchestrator or master, once run 46045742726 is fully green with Stage 11b at or under 194,000 B
