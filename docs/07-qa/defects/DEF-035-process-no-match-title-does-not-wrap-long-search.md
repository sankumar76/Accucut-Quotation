# DEF-035: The Process master "No rate matches" title does not wrap a long unbroken search, so the page scrolls sideways (304 px at 360, 100 px at 768, 96 px at 1024)

| Field | Value |
|-------|-------|
| Story / AC | Found in the G7 of AQP-275 as the reproduction ordered by DL-195 (5); origin: the AQP-122 G6 round-2 quality review, finding R2-QLT-11 (GitHub #123, open `follow-up` since 2026-11-08, never graded). Governing requirement: **NFR-016** (no horizontal page scroll at 768x1024, 1024x768 and 1366x768), FR-085, ux-spec 6.0 "Names wrap". Code owner: AQP-113 (SCR-11) and the shared `EmptyState` |
| Severity | **Sev-2 Major, graded by qa-engineer** on the NFR-016 clause, the same one DL-195 (3) used for DEF-034 and DL-192 for DEF-031: the page scrolls sideways at the three project widths, with the workaround of clearing the search. Likelihood is low to moderate (about 30 unbroken characters at 360 px, about 70 at 768 px; a pasted part number is enough) and enters RISK-028's P, not the grade (DL-094, DL-135). **Master confirms at grading** |
| Priority | P2 (Jira AQP-289 High, label `sev-2`). **Blocks G8** as a Sev-2 unless master grades it lower |
| Type | Product, pre-existing (open since the AQP-122 review; fixed for SCR-13 Materials by PR #120, not for SCR-11) |
| Status | **New** (fix: developer, in DEF-034's PR or its own; master rules which; before G8, DL-195 (5)) |
| Jira / GitHub | [AQP-289](https://sankumar76.atlassian.net/browse/AQP-289) / [#123](https://github.com/sankumar76/Accucut-Quotation/issues/123) (retitled DEF-035, labels `bug`, `sev-2` added); relates to AQP-288 (DEF-034); class guard: #348 (RISK-028) |
| Found by / date | Reviewer-quality (2026-11-08, as a follow-up); reproduced and graded by qa-engineer, 2026-11-12 |
| Build / commit | `master` `8f66157` (the squash of PR #334) |
| Environment | Windows 11, Node v24.19.0, Playwright Chromium, a production build (`next start`) of 8f66157 on a throwaway PostgreSQL 17 (`prisma migrate deploy`, seed version 1: the seeded rates are on the list); invented data only |

## Steps to Reproduce
1. Sign in as the Admin and open Process master (SCR-11) at 360, 768 or 1024 px. The page has no sideways overflow (0 px).
2. Type a 100-character search with no space into Search (for example `QAQUERY123-` padded with `Z`).
3. The "No rate matches" state shows. Read `document.documentElement.scrollWidth - clientWidth` and the box of its `h2`.

## Expected Result
The title wraps inside the window like every other name (ux-spec 6.0 "Names wrap") and the page does not scroll sideways (NFR-016, FR-085).

## Actual Result

| Width | Page overflow before | After | Title (`h2`) | `overflow-wrap` |
|---|---|---|---|---|
| 360 | 0 | **304 px** | 968 px wide, left edge at **-304 px**: the start of the title is cut off on the left and cannot be reached by scrolling | normal |
| 768 | 0 | **100 px** | 968 px wide, right edge at 868 px | normal |
| 1024 | 0 | **96 px** | 968 px wide, right edge at 1,120 px | normal |

axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`): 0 violations. SCR-13 Materials is not affected: `material-results.tsx` passes `BREAK_LONG_NAMES` to its `EmptyState` (not re-measured here: the fresh database held no material, so the state could not be shown; the AQP-122 CI case covers it).

## Evidence
- QA's local spec `tests/e2e/aqp-123-qa.spec.ts` (not committed), tests "#123 SCR-11 Process master at 360 / 768 / 1024 px", output lines `QA123 {...}`; the three rows above are those lines.
- Code: `src/components/features/masters/process-results.tsx:34` (`title={`No rate matches "${query.trim()}"`}`, no wrap rule); `src/components/shared/states.tsx:81` (the shared `EmptyState` heading has no wrap rule). Other `EmptyState` titles are static text (`audit-screen.tsx`, the queue page), so SCR-11 is the one other place that prints typed text.

## Suspected Area (optional)
Move the wrap into the shared `EmptyState` heading so every caller gets it (the suggestion of #123), then drop the class that the Materials caller adds. Regression test: SCR-11 No match at 360 and 768 px, asserting that the title fits its own box (R2-QLT-12) and that the page overflow is <= 0. RISK-028 and the guard #348 name `EmptyState` as a shape the guard must fail on once fixed.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## Severity history and routing

- Opened as a `follow-up` on 2026-11-08 by the AQP-122 round-2 quality review (R2-QLT-11), routed "before or with the next masters story (AQP-123)"; that routing was missed and the issue was never graded (DL-195 (5)).
- DL-195 (5) ordered qa-engineer to reproduce it on `master` and grade it. Reproduced on 8f66157 (above) and graded Sev-2 by qa-engineer on 2026-11-12; it now has a DEF id and a Jira Bug. Master confirms the grade and rules whether it rides DEF-034's PR or has its own.
- Jira AQP-289 priority is High with label `sev-2`; GitHub #123 carries `bug` and `sev-2`.
