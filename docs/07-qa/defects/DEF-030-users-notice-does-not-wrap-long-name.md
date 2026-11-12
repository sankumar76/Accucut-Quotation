# DEF-030: The Users "can sign in again" notice does not wrap a 120-character name, so the page scrolls sideways (611 px at 768 and 1024 px, 1011 px at 360 px)

| Field | Value |
|-------|-------|
| Story / AC | Found in the G7 of AQP-245 (STORY-10.21, PR #222) / no AC of AQP-245 fails; related to the no-sideways-scroll intent of AC-4 and to NFR-016 / FR-085. Code owners: AQP-65 (Users screen), AQP-28 (shared `Notice`) |
| Severity | Sev-3 Moderate (test plan section 6: a layout defect that leaves every action reachable) |
| Priority | P3 |
| Type | Product, **pre-existing; not caused by AQP-245** (the notice is outside that PR's 2 files) |
| Status | New |
| Jira / GitHub | [AQP-275](https://sankumar76.atlassian.net/browse/AQP-275) / [#325](https://github.com/sankumar76/Accucut-Quotation/issues/325); relates to AQP-245 |
| Found by / date | qa-engineer, exploratory session M8 in the G7 of AQP-245, 2026-11-12 |
| Build / commit | `03e21f2` (H1 of PR #222 = `master` 6b1883f + the 2 AQP-245 files) |
| Environment | Windows 11, Node v24.19.0, Playwright 1.65.0 Chromium, `next dev` on a throwaway PostgreSQL 17; invented data only |

## Steps to Reproduce
1. Sign in as the Admin. Make a person with a 120-character name with no space (the longest the form accepts) and deactivate them.
2. Open Users (SCR-14) at 360, 768 or 1024 px. The page has no sideways overflow (0 px).
3. Press **Activate** on that person's row (table button or card button).
4. Read the saved notice "<120-character name> can sign in again." and measure `document.documentElement.scrollWidth - clientWidth`.

## Expected Result
The notice wraps like the names in the table and the cards (ux-spec 6.0 "Names wrap"), and the page does not scroll sideways (FR-085, NFR-016).

## Actual Result
The notice does not wrap the unbroken name and the page scrolls sideways.

| Width | Page overflow before | Page overflow after the notice | Notice text `scrollWidth` | Window |
|---|---|---|---|---|
| 360 | 0 | **1011 px** | 1305 | 360 |
| 768 | 0 | **611 px** | 1305 | 768 |
| 1024 | 0 | **611 px** | 1305 | 1024 |

## Evidence
- QA spec `tests/e2e/aqp-245-qa.spec.ts` (local, not committed), test M8 at 360, 768 and 1024 px, and M4 "after" (page overflow 611 px at 1024 px after the answer). Measurements are in `docs/07-qa/AQP-245-test-report.md` (PR #222, commit 6422ea4), sections "Exploratory Testing" and "M4".
- The notice has `role="status"` and no rule for an unbroken word: `src/components/shared/notice.tsx` (no break class on the message element); the text is built at `src/components/features/users/users-screen.tsx:132`.
- Pre-existing: `git diff --stat 6b1883f 03e21f2` lists only `users-list.tsx` and `masters-table-actions.spec.ts`, so `master` 6b1883f has the same notice code.
- The same shape may appear on other screens whose notices repeat a name (not measured).

## Suspected Area (optional)
`src/components/shared/notice.tsx` (a wrapping class on the message element, such as `break-words` or `overflow-wrap:anywhere`), or the `Notice` call sites that interpolate a name. Regression test: activate (or save) a person with a 120-character name and assert `horizontalOverflow(page) <= 0` after the notice shows, at 360, 768 and 1024 px.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

Routing: master. A Sev-3 is fixed before G8 or accepted by master in writing (test plan section 6). It does not hold G7.
