# DEF-031: The customer page title (`h1`) does not wrap a customer name with no space, so the page scrolls sideways (1681 / 1618 / 1276 px with 100 characters at 360 / 768 / 1366 px)

| Field | Value |
|-------|-------|
| Story / AC | STORY-02.02 (AQP-142, PR #297) / **AC-8** ("No horizontal page scroll"); ux-spec 6.0 "Names wrap"; WCAG 2.2 SC 1.4.10 Reflow; NFR-016 |
| Severity | **Sev-2 Major** (QA graded Sev-2; master confirmed in DL-192: an AC fails and WCAG 1.4.10 on a delivered screen, as DL-174 (3) for DEF-030). Test plan section 6 |
| Priority | P2 (Jira High). **Blocks G7 of AQP-142** |
| Type | Product, **in the story's own diff** (the customer page is new in PR #297) |
| Status | **Closed** 2026-11-12. Fixed in round F2a of #297 (DL-192; the shared `PageHeader` `h1` always wraps), verified by QA on H4 `eb6bc66`, on `master` as `0ca47df`; push run 43339039704 5 of 5 (DL-197 (5)(h), DL-200). Jira AQP-285 and GitHub #342 closed |
| Jira / GitHub | [AQP-285](https://sankumar76.atlassian.net/browse/AQP-285) / [#342](https://github.com/sankumar76/Accucut-Quotation/issues/342); relates to AQP-142 |
| Found by / date | qa-engineer, G7 of AQP-142 (attempt 1), 2026-11-12 |
| Build / commit | H1 `cb95102` (report at H2 `f269b05`) |
| Environment | Windows 11, Node v24.19.0, Playwright Chromium at 360x800, 768x1024 and 1366x768, the production build of H1 (`next start`), throwaway PostgreSQL 17; invented data only |

## Steps to Reproduce
1. Sign in as the Admin. Add a customer whose name has no space: for example 40 or 100 characters (`Q`, letters, `-`, then `W` to the length; the form accepts 100).
2. Open the customer's page, `/masters/customers/{id}`, at 360, 768 or 1366 px.
3. Read `document.documentElement.scrollWidth - document.documentElement.clientWidth`.
4. Open the list, `/masters/customers`, with the same customer and read it again.

## Expected Result
No sideways scroll of the page. The name wraps inside the heading, as it does in the breadcrumb, the notices and the list (`BREAK_LONG_NAMES`, `[overflow-wrap:anywhere]`; ux-spec 6.0 "Names wrap").

## Actual Result
The `h1` has `overflow-wrap: normal`; the unbroken name runs past its box and the page scrolls sideways. The list does not overflow with the same names.

| Name length | 360 px | 768 px | 1366 px | `h1` client / scroll width at 360 px |
|---|---|---|---|---|
| 100 | **1681** px | **1618** px | **1276** px | 328 / 2025 |
| 40 | **346** px | **61** px | 0 | 328 / 690 |
| 24 | 0 | 0 | 0 | 328 / 334 |

## Evidence
- QA series `aqp-142-qa.spec.ts` (local, not committed), "AC-8 with the longest name the form accepts", measurements `ac8LongName` in QA's scratch output; summarised in `docs/07-qa/AQP-142-test-report.md` (AC-8 row, Exploratory Testing).
- Elements that overflow, by `scrollWidth > clientWidth` and not `overflow: auto`: the `h1` and its two containing `div`s, then `main`. List page: none.
- Code: `src/components/features/masters/customer-edit-screen.tsx:137` passes `customer.name` to the shared `PageHeader`; `src/components/shared/page-header.tsx` draws the `h1` as `<h1 tabIndex={-1} className="text-heading font-semibold tracking-tight text-ink">` with no wrapping class. The breadcrumb (`:58`) and the notices (`:86`) of the same file carry `BREAK_LONG_NAMES`.

## Suspected Area (optional)
The shared `PageHeader` `h1` (master's route in DL-192 F2a: it always wraps; `./break-long-names` if #334 has merged, otherwise the literal class with a comment naming "GitHub issue 225"). Regression tests (extend `customers.spec.ts`): a 100-character name, `horizontalOverflow(page) <= 0` at 360, 768 and 1366 px on the customer page; reviewer-quality plants the class removed and sees red on that assertion only. QA's retest (G7 attempt 2): the 100, 40 and 24-character series at 3 widths, a `PageHeader` sweep of the other pages at 360 px, axe with the long name, regression by name.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-12 | round F2a, H3 `7fd3cdd`; on `master` as `0ca47df` |
| Regression test added | developer | | `customers.spec.ts` |
| Verified | qa-engineer | 2026-11-12 | G7 attempt 2 on H4 `eb6bc66`; push run 43339039704 |

## Severity history and routing
- QA: Sev-2 on 2026-11-12, noting that DL-174 (3) set the same class (a long unbroken name, sideways scroll at every width) at Sev-2, and that master could reclassify it in writing.
- Master, DL-192 (G7 attempt 1, NO-GO; Jira AQP-142 comment 11711, PR #297 comment 6827649206): Sev-2 by the scale; fixed in fix round F2 on #297 with DEF-032; reviewers: reviewer-quality and reviewer-standards, no performance review; H3 needs CI 5 of 5 and no new median of five.
