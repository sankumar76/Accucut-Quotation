# DEF-030: The Users "can sign in again" notice does not wrap a 120-character name, so the page scrolls sideways (611 px at 768 and 1024 px, 1011 px at 360 px)

| Field | Value |
|-------|-------|
| Story / AC | Found in the G7 of AQP-245 (STORY-10.21, PR #222) / no AC of AQP-245 fails; related to the no-sideways-scroll intent of AC-4 and to NFR-016 / FR-085. Code owners: AQP-65 (Users screen), AQP-28 (shared `Notice`) |
| Severity | **Sev-2 Major**, reclassified by master in DL-174 (QA graded Sev-3 Moderate). Test plan section 6: a WCAG 2.2 AA violation on a delivered screen (SC 1.4.10 Reflow), the same row as DEF-014 and the DL-094 rule that the scale decides severity |
| Priority | P2 (Jira High). **Blocks G8** |
| Type | Product, **pre-existing; not caused by AQP-245** (the notice is outside that PR's 2 files) |
| Status | **Closed** (fixed by PR #334, squash-merged to `master` as `8f66157`; verified in the G7 of AQP-275, GO in DL-195, 2026-11-12) |
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
`users-screen.tsx:132` (master's cause: the Notice is rendered without `BREAK_LONG_NAMES`), and/or `src/components/shared/notice.tsx` (a wrapping class on the message element, such as `break-words` or `overflow-wrap:anywhere`), or the other `Notice` call sites that interpolate a name. Regression test: activate (or save) a person with a 120-character name and assert `horizontalOverflow(page) <= 0` after the notice shows, at 360, 768 and 1024 px.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-12 | PR #334, `Notice` always applies `BREAK_LONG_NAMES` (`src/components/shared/notice.tsx`, `break-long-names.ts`); squash-merged as `8f66157` |
| Regression test added | developer | 2026-11-12 | `tests/unit/notice-wraps-long-names.test.ts` (6 cases); `masters-table-actions.spec.ts` SCR-14 "can sign in again" notice at 360 and 768 px |
| Verified | qa-engineer | 2026-11-12 | `docs/07-qa/AQP-275-test-report.md` (H2 `7ddb335`): 120 characters, page overflow 0 before and 0 after at 360, 768 and 1024 px (was 1011 / 611 / 611 px); 18 notices swept at 360 px; axe 0; control brings the overflow back; CI run 43247482466 5 of 5 |

## Severity history and routing

- QA graded Sev-3 on 2026-11-12 (a layout defect that leaves every action reachable).
- Master reclassified it to **Sev-2** in DL-174 (G7 of AQP-245, Jira AQP-245 comment 11619 and AQP-275 comment 11620, PR #222 comment 6818348583): the page needs scrolling in two dimensions to read the notice, which fails WCAG 2.2 AA SC 1.4.10 Reflow on a delivered screen. Master's cause: `users-screen.tsx:132` renders the Notice without `BREAK_LONG_NAMES`.
- It does not hold the G7 of AQP-245 (pre-existing and outside the PR's 2 files, DL-094). It **blocks G8** and is fixed by a developer PR after #222 merges. Sev-1 and Sev-2 are not accepted in writing.
- Jira AQP-275 priority is High with label `sev-2`; GitHub #325 carries `sev-2`.
