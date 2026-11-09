# DEF-021: The Edit button of every material is outside the visible table area from 768 to 1022 px and from 1024 to about 1270 px

| Field | Value |
|-------|-------|
| Story / AC | AQP-122 (STORY-02.03) / AC-7 and AC-1; UX SCR-13 |
| Severity | Sev-3 Moderate |
| Priority | P2 |
| Type | Product (design) |
| Status | New |
| Found by / date | qa-engineer, 2026-11-09 |
| Build / commit | `b02955bb07e176f834477aeb08dc3713d563bd37` on `feat/AQP-122-material-master` (PR #120) |
| Environment | Windows 11, Node v24.19.0, Chromium (Playwright 1.64.1), throwaway PostgreSQL 17 with invented credentials, invented data, development server |
| Jira / GitHub | [AQP-234](https://sankumar76.atlassian.net/browse/AQP-234) / [#127](https://github.com/sankumar76/Accucut-Quotation/issues/127) |

## Steps to Reproduce
1. Sign in as the Admin and add one material (invented name and numbers).
2. Open `/masters/materials` at 768 x 1024 and look for the pencil (Edit) button on the row.
3. Repeat at 900, 1000, 1023, 1024, 1180, 1257, 1280, 1366 and 1440 px wide.

## Expected Result
Each row's Edit action is visible. On SCR-11 (Process master) at 768 px the table's region is 718 px wide and so is its content, and the pencil shows.

## Actual Result
The table needs 968 px (six columns; `TableHead` is `whitespace-nowrap`). Its own scroll region is narrower than that, so the Edit button lies beyond the right edge of the visible area until the person scrolls the table sideways.

| Viewport | Region width | Content width | Edit button right edge | Region right edge | Edit visible |
|----------|--------------|---------------|------------------------|-------------------|--------------|
| 768 | 718 | 968 | 977 | 743 | no |
| 900 | 850 | 968 | 977 | 875 | no |
| 1000 | 950 | 968 | 977 | 975 | no |
| 1023 | 973 | 973 | 982 | 998 | yes |
| 1024 (side menu from here) | 710 | 968 | 1233 | 991 | no |
| 1180 | 866 | 968 | 1233 | 1147 | no |
| 1257 | 943 | 968 | 1233 | 1224 | no |
| 1280 | 966 | 968 | 1233 | 1247 | yes |
| 1366 | 1052 | 1052 | 1317 | 1333 | yes |
| 1440 | 1126 | 1126 | 1391 | 1407 | yes |

iPad portrait and landscape and small laptops therefore show the list with no visible Edit button. The page itself never scrolls sideways (`documentElement.scrollWidth` equals the viewport width at every width), so the wording of AC-7 ("no horizontal page scroll") is met; a keyboard user reaches the button by Tab because the region scrolls to the focused control; phone cards are fine. No data is lost.

## Evidence
- `tests/e2e/aqp-122-qa.spec.ts`: "[AQP-122 AC-7] DEF-021: the Edit button of a row is inside the visible table area, with no sideways scroll of the table". It is marked `test.fail` at 768 px, so it is reported as passed while the fault exists and as failed once it is fixed, which is the signal to delete the `test.fail` line. It passes at 360 and 1366 px.
- The numbers above come from `getBoundingClientRect()` of the region (`[data-slot="table-container"]`) and the first row's button in a scratch probe at each width (the probe is not committed).
- Control: the same measure on `/masters/process` at 768 gives region 718, content 718, button inside.
- The developer's test of the 44/36 px targets measures height only, so it cannot see this.

## Suspected Area
`src/components/ui/table.tsx` (headings do not wrap) with the six columns of `src/components/features/masters/material-list.tsx`. The choice is the ux-expert's: let the headings wrap, put Edit in the first column, or keep cards up to 1280 px. Stories 02.04 and 02.05 reuse the tab shell, so it is cheaper to settle before them.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | The QA test above; remove its `test.fail` line |
| Verified | qa-engineer | | |
