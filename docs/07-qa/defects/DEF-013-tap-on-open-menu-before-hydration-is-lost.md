# DEF-013: A tap on "Open menu" (or the account menu) before the page is interactive is lost; the person must tap again

| Field | Value |
|-------|-------|
| Story / AC | AQP-28 (STORY-10.02, app shell `app-shell.tsx`); found at AQP-182 G7, split from DEF-011 (DL-082, DL-083) |
| Severity | Sev-3 Moderate |
| Priority | P2 |
| Type | Product |
| Status | **Closed** (Jira Done). Fixed in AQP-188 (STORY-10.13) AC-10, PR #75, squash `557b5e3a`: one small inline script captures the tap on elements marked `data-early-intent` and replays it once the first-open loader is ready |
| Jira / GitHub | [AQP-197](https://sankumar76.atlassian.net/browse/AQP-197) / [#69](https://github.com/sankumar76/Accucut-Quotation/issues/69) |
| Found by / date | qa-engineer, AQP-182 G7, build `db768eb` |
| Environment | Playwright mobile project, Chromium |

> Restored on 2026-11-21 (DL-276) from the Jira Bug AQP-197, which is the source of truth for the full text. This file is a condensed copy for the defects folder.

## Steps to Reproduce
Below 1024 px open a signed-in page and tap "Open menu" as soon as it is painted, before hydration (also with the JavaScript chunks delayed by 4 s).

## Expected Result
The first tap opens the drawer or the account menu as soon as the page is interactive; a person never taps twice.

## Actual Result
The tap does nothing and shows nothing; the drawer stays closed after hydration, and only a second tap opens it. QA probe: drawer opened false in both probes while hydrated afterwards was true.

## Suspected Area
`src/components/shared/app-shell.tsx`, the menu button and `account-trigger.tsx`

## Fix & Verification  _(developer / qa-engineer)_
AQP-188 AC-10 at three widths, 20 of 20 runs per width with every script held back (solution-architect ruling, AQP-188 comment 10870, DL-083).
