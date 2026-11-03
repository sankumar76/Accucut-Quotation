# Test Report — AQP-28 (STORY-10.02): Design tokens and responsive app shell

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | G7 run on `feat/AQP-28-tokens-and-shell` (PR #33, `sankumar76/Accucut-Quotation`). First run on `f903d48` (the G6 head). After the coordinator merged `master` into the branch (`a4b94a0`: docs PR #42 and AQP-97 / PR #32), the regression was run again on `a4b94a0`. The merge adds no change under `src/app`, `src/components`, `tests/e2e`, `package.json`, the lockfile, `next.config.ts` or the workflow |
| CI | Run 41629593078 on `f903d48`: success. Run 41634169861 on `a4b94a0`: success, stages 1 to 12 all green, stage 13 skipped by design |
| Environment | Windows 11 Pro; Node v24.19.0 (the project and CI use Node 22), npm 11.17.0; Docker; PostgreSQL 17 from the unchanged `compose.dev.yml` in a throwaway project `qa28g7` on host port 55428 (removed afterwards); Chromium via Playwright 1.64.1. The machine was shared with another QA run and was busy at times |
| Date | 2026-11-03 |
| **Recommendation** | **ACCEPT, conditional on AC-9.** AC-1 to AC-8 and AC-10 are verified with evidence. AC-9 (real phone, screen reader, Windows high contrast) is **pending the delivery lead's results**; until it is recorded it is an unverified AC and, by the story's own wording, G7 returns NO-GO. Open defects: Sev-1 0, Sev-2 0, Sev-3 2 (both type Test), Sev-4 0 |

## Summary

The page and shell do what AC-1 to AC-8 say. The token file equals the UX source, every contrast pair in UX 7.3 meets its ratio, the logo is byte-identical, only three fonts are preloaded and nothing is requested from a font host, the drawer, skip link, focus handling and reduced motion work, axe finds no violation at three widths, and in a production build `/design-system` answers 404 (built, started with `next start` and with the standalone `server.js`). The README's first-use steps work from a fresh clone, on the merged head, and the failure path it describes (a `CHANGE_ME` value stops the server and names the variable) is true. Two defects of type Test were found and raised (DEF-004, DEF-005); neither is a product failure. Known load-sensitive timeouts (DEF-003 class, AQP-168, #24) were seen and not raised again.

## Decision for master (read this first)

1. **AC-9 is not done and cannot be done by QA.** The checklist for the delivery lead is in Appendix A. QA pre-screened what a machine can show (keyboard order, focus outline, forced-colours rendering, a phone-sized browser over the Wi-Fi address) and found nothing that predicts a failure, but none of that replaces the real phone, Narrator and Windows contrast themes. Recommendation stays ACCEPT **only after** the delivery lead's results are recorded in this report and show no Sev-1 or Sev-2 finding.
2. **Screen reader: Narrator, not NVDA.** The test plan (12.2) assumes NVDA with Chrome; the story says "NVDA or equivalent". The delivery lead will use Windows Narrator. I treat it as the equivalent the story allows, but it is a weaker pass (Narrator in Chrome and Edge is less used by people who rely on a screen reader). Say so if you want NVDA (a free download) as well. The story also names VoiceOver or TalkBack on the phone; the checklist carries that as an optional step. If it is not run, list it as a check not run at G8 (test plan 12.1 already expects one platform only).
3. **Two Sev-3 defects of type Test (AQP-179 / #43, AQP-180 / #44).** Neither holds G7. DEF-004: a drawer-width assertion fails about one run in ten before Playwright's one retry hides it. DEF-005: `tests/unit/env.test.ts` fails on any computer that has a complete `.env`, which is exactly what the README tells the delivery lead to create.
4. **Regression on this machine.** The full Vitest run fails one test in every full run here (`layer-rules.test.ts`, first case, 30 s timeout: DEF-003 class). It passes alone (67 of 67) and in CI. Not counted against G7, as instructed.
5. **Not owed here:** the Lighthouse reference run (moved to AQP-169 by DL-058).

## AC Verification Matrix

Test IDs are the developer's titles (`[AC-n]` or `AC-n:` in the title) in `tests/unit` and `tests/e2e`, plus QA's own checks (scripts kept outside the repository in the session scratch folder, described under Evidence). I did not add acceptance tests to `tests/`: the developer's specs already carry each AC by name at the three widths, and my checks were done to look for what they miss. This means my pass on AC-1 to AC-8 is independent in method but not in test code. EP = equivalence partitioning, BVA = boundary-value, DT = decision table, EG = error guessing.

| AC | Test ID(s) | Technique | Result | Evidence |
|----|-----------|-----------|--------|----------|
| AC-1 | Developer `tokens.test.ts` (21 printed ratios, 30 pairs, token equality with `screens.css`, no raw colour or px font size elsewhere), `source-conventions.test.ts`; QA script | EP, BVA, EG | Pass | QA script read both `:root` blocks: 60 variables in `screens.css`, 57 shared with `globals.css`, 0 value differences (two shadows differ only by `.06` against `0.06`), the 3 not shared are the font family stacks that `next/font` replaces. Four type sizes 28/36, 18/26, 14/22, 12/16 and the phone heading 24/32 under `max-width: 767px`; spacing 4, 8, 12, 16, 24, 32, 48; radii 4, 8, 12; `--control-h` 44. Code search over 54 files in `src` (excluding the token file): 0 hex colours, 0 `rgb()/hsl()/oklch()`, 0 pixel font sizes, 0 arbitrary-pixel utilities. Contrast: the 20 ratios printed in UX 7.3 reproduced to 2 decimals (4.59 twice, 3.86, 5.97, 6.48, 5.67, 17.74, 8.43, 6.17, 5.33, 3.55, 3.23, 10.94, 6.56, 5.02, 6.92, 5.08, 6.54, 5.74, 9.98) and 7 more pairs tested (ink, ink-2, ink-3 and primary-ink on the page grey, white on danger and on success, the focus ring on white); 27 of 27 at or above their minimum (4.5 text, 3 UI) |
| AC-2 | Developer `brand-assets.test.ts`; e2e `AC-2: the header shows the real logo...` x3 widths; QA script and screenshots | EP | Pass (see OBS-1) | SHA-256 of `public/accucut-logo.jpg` and `docs/03-ux/assets/accucut-logo.jpg` both `d9ac5a2d…93615d7`. Alt text "AccuCut logo". "ACCUCUT LASERS" computed weight 700, colour equal to `--primary`, drawn by the Tinos file (platform-font probe). Top bar white, side menu graphite, main button `rgb(222,48,48)` with white text, ghost button text `rgb(181,36,36)` = `--primary-ink`. "Quotation Portal" appears from 768 px up and is hidden on phones (OBS-1) |
| AC-3 | Developer `brand-assets.test.ts` (glyph read from each font file that claims U+20B9), e2e `AC-3: no request goes to a font host...` x3; QA browser run | EP | Pass | Browser run, development server: preload links are exactly Plex Sans 400, Plex Sans 600 and Tinos 700; every request host was the page's own; the rupee files (`latin_ext`) load on the design-system page and the home page loads only the three preloaded files, so pages without a rupee sign do not fetch them. Both OFL licence files are in `src/app/fonts/`. Nine `.woff2` files, none from a font service |
| AC-4 | e2e `AC-4:` x 10 titles across the three projects (persistent menu, drawer, bell and account, skip link, focus offset, keyboard-only); QA exploratory run | EP, DT, EG | Pass | Playwright on both heads (see results). QA run at 360 px: 24 tab stops in a sensible order (skip link, menu button, logo, bell, account, then content), no positive `tabindex`, every stop has a 3 px outline, no stop hidden, the focus cycle returns to the start. `lang="en-IN"`, one `h1`, one banner, one navigation, one main at 360, 768 and 1366. Resizing from 800 to 1100 px with the drawer open closes it, leaves no scroll lock, no `aria-hidden` left behind, shows the side menu and hides the menu button |
| AC-5 | Developer `button-types.test.ts`, `cn.test.ts`, `components-json.test.ts`; e2e `QLT-01`, `QLT-03`; QA DOM inspection | EP | Pass | In the Buttons section: primary (red, white text), secondary (1 px strong border), ghost (`--primary-ink` text), danger, an icon-only square 44 x 44 and a row icon 36 x 36, all with `type="button"`, default height 44. Notices carry an icon, a 4 px left border and text; the error uses `role="alert"`, the saved notice `role="status"`. Skeleton, Empty and Error blocks are on the page (UX 6.0 "States"). The loading announcement is a live region beside the busy container, not inside it |
| AC-6 (negative) | e2e `AC-6:` x4 titles incl. the control that proves the check can fail; QA exploratory run | BVA, EG | Pass | Reduced motion: shimmer, spinner and drawer slide/fade all report `animation-name: none`; with motion allowed they run (control test). 320 px wide with WCAG 1.4.12 text spacing: no sideways page scroll, nothing outside the top bar. QA also loaded the page at 320 x 256 (400 percent zoom): the page itself does not scroll sideways (overflow 0); the wide tables scroll inside their own focusable region ("Contrast pairs, scrollable"), which WCAG 1.4.10 allows for tables |
| AC-7 | Developer `design-system-route.test.ts`, `production-routes.test.ts`; e2e `AC-7: all ten sections...` x3; QA production run | EP, EG | Pass | The ten h2 headings are in the required order at all three widths. Production: `npx prisma generate && npx next build` exit 0, `npx tsx scripts/check-production-routes.ts` passes. `next start` and `node .next/standalone/server.js`: `/design-system` 404; also 404 for `?x=1`, `/DESIGN-SYSTEM`, `/design-system/foo`, a `_next/data` path, and `/design-system/` (308 then 404); an RSC request (`RSC: 1` header) gets a 307 to `/design-system?_rsc`, a path with a query string, which answers 404 like the others (I did not follow the redirect itself). The production home page does not link to it (0 `href="/design-system`). The logo is served with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` |
| AC-8 | e2e `AC-8:` x 9 titles at 360, 768 and 1366 px (overflow, axe with `wcag2a, wcag2aa, wcag21aa, wcag22aa` on the page, with the account menu open, with the drawer open, 44 px and 36 px targets, keyboard only) | EP, BVA | Pass | First run on `f903d48`: 72 tests, 60 passed, 1 flaky, 11 skipped by design (side-menu tests on the two touch projects, drawer and target-size tests on desktop). On `a4b94a0`: 59 passed, 2 flaky, 11 skipped; the two flaky are a 5 s route-change wait and a 30 s axe run that timed out on a loaded machine and passed on retry; with retries off they passed 12 of 12 on a quieter machine. The one flaky of the first run is DEF-004. Stage 12 is on and blocks merge: CI stage 12 green on both heads. No axe violation in any run |
| AC-9 | Manual: Appendix A | | **Pending the delivery lead's results** | Not run. Pre-screen only (below): forced-colours emulation, keyboard order, a phone-sized browser over the Wi-Fi address |
| AC-10 | Manual: clean clone | EP, EG | Pass | See "AC-10 walk-through" below |

AC coverage: 9 of 10 verified; AC-9 pending.

## Automated Test Results

| Suite | Command | Total | Passed | Failed | Skipped | Duration |
|-------|---------|-------|--------|--------|---------|----------|
| Lint, `f903d48` and `a4b94a0` | `npx eslint .` | n/a | exit 0 | | | 27 s |
| Type-check | `npx tsc --noEmit` | n/a | exit 0 on both (on `a4b94a0` only after `prisma generate`, because the merge adds a Prisma model and a stale client fails with TS2339; an ordering matter, not a defect) | | | |
| Build | `npx prisma generate && npx next build` | n/a | exit 0 on both; routes `/`, `/_not-found`, `/design-system` | | | |
| Production route check | `npx tsx scripts/check-production-routes.ts` | n/a | passes on both | | | |
| Migrations | `npx prisma migrate deploy` (throwaway database) | n/a | `f903d48`: none to apply; `a4b94a0`: 1 migration applied | | | |
| Unit and integration, `f903d48` | `npx vitest run` with only the two database URLs set (as CI does) | 647 (33 files) | 647 | 0 | 0 | 37 s |
| Unit and integration, `f903d48`, first run | same, with all application variables also set | 647 | 645 | 2 | 0 | 51 s (DEF-005 and the DEF-003 class) |
| **Unit and integration, `a4b94a0`** | `npx vitest run` (two runs) | 1212 (51 files) | 1211 | 1 | 0 | 80 to 97 s |
| Layer-rules file alone, `a4b94a0` | `npx vitest run tests/unit/lint/layer-rules.test.ts` | 67 | 67 (calm machine); 66 once while another job ran | 0 or 1 | 0 | 11 s |
| End to end, `f903d48` | `npx playwright test` (own config wrapper on port 3128, same projects and specs) | 72 | 60 (1 flaky) | 0 | 11 | 3.6 min |
| **End to end, `a4b94a0`** | same | 72 | 59 (2 flaky) | 0 | 11 | 9.4 min (machine loaded) |
| Re-run of the two retried tests | `--grep "choosing a page in the drawer\|axe finds 0 violations with the drawer open" --repeat-each=3 --retries=0` | 12 | 12 | 0 | 0 | 1.9 min |
| Repeat of the drawer-width test | `--repeat-each=15 --retries=0`, mobile and tablet | 30 | 27 | 3 | 0 | 3.4 min (DEF-004) |

The one Vitest failure on `a4b94a0` is, in both full runs, `tests/unit/lint/layer-rules.test.ts > static import fails lint: src/lib imports src/server (alias)`, `Test timed out in 30000ms`: DEF-003 class, not raised again. The 11 skipped Playwright tests are skipped by design in the spec (`test.skip(...)` by project, so each test has one path); the counts are identical in CI.

Not run: Node 22 locally (CI runs it), Firefox and WebKit (nightly matrix not set up yet), `npm run lint`/`test`/`build` aliases (the direct commands were used, per project memory), a coverage run (CI stage 11 and its changed-code gate are green on both heads). The Playwright wrapper config sits outside the repository and only moves the port to 3128, because another QA run may use 3100 (`reuseExistingServer`).

## Non-Functional Checks

| Check | NFR | Method | Result |
|-------|-----|--------|--------|
| No horizontal scroll at 360, 768, 1366 px; and at 320 px with text spacing; and 320 x 256 | NFR-016 | e2e and QA script | Pass |
| Target size | NFR-017 | e2e on the two touch projects: every visible control at least 44 px, row icon at least 36 px (the test requires the row button to exist). Desktop is not in scope of the AC | Pass |
| Accessibility, automated | NFR-018 | axe `wcag2a, wcag2aa, wcag21aa, wcag22aa`: page, account menu open, drawer open, three widths | 0 violations in every run |
| Keyboard | NFR-018 | e2e plus QA full Tab traversal at 360 px | Pass |
| No raw colour or size outside tokens | NFR-020 | QA code search | Pass |
| Logo unaltered | NFR-021 | SHA-256 equal | Pass |
| Production gate | AC-7 | built and started two ways | Pass |
| Security smoke | | Production responses: no `X-Powered-By`; `/design-system` and its data paths answer the uniform 404 page; the invalid-environment message prints the variable name and no value. **No CSP or other security headers are sent** (CSP with nonces is in the Dev Context, not an AC); already tracked as follow-up #37 | Pass for this story's ACs; #37 stands |
| Performance | NFR-009 | No Lighthouse figure owed at this G7 (AQP-169, DL-058). JS budget tracked in #36 | Not run, as agreed |
| Real-phone daylight legibility (R-5), text zoom | test plan 12.1 P3, P4 | Not machine-checkable | In Appendix A |

## Exploratory Testing

**Charter.** Mission: look for what the developer's specs would not catch on the first built page: the paths a phone and a keyboard take, the production gate, and the setup the delivery lead will follow. Time-box not clocked. Areas, in risk order:

1. **Production gate.** Nine URL variants against `next start` and the standalone server (AC-7 row). No leak.
2. **Keyboard.** Full Tab traversal at 360 px (24 stops, cycle closes, no positive tabindex, 3 px outlines); drawer open then resized across 1024 px.
3. **Phone path.** A Pixel 7 profile loaded `/design-system` from the PC's Wi-Fi address (`192.168.29.8`) with `next dev` bound to all interfaces: no 4xx/5xx, no console error or warning, the drawer opened. This proves the `allowedDevOrigins` setting lets the scripts run from a private address; it does not prove the Windows firewall will let the real phone in (Appendix A step A4).
4. **Forced colours (aid only).** Playwright `forcedColors: 'active'` at 360 and 1366 px: the focus outline survives (outline, not box-shadow), the logo and text stay, borders show; the colour swatches in "Colour tokens" become empty outlined boxes (their hex and ratio text stays). The manual high-contrast check decides.
5. **Zoom and reflow.** 320 x 256 (400 percent): the page does not scroll sideways; only tables scroll inside their own region.
6. **README from a fresh clone** (AC-10 below) including the failure path.
7. **A hydration warning.** The development server printed "A tree hydrated but some attributes ... didn't match" during my first screenshots and during the developer's AC-3 spec. I traced both: the differing attribute is `caret-color: transparent` (added by Playwright's screenshot) and `data-probe="font"` (added by the spec's `platformFonts` helper) on elements below the fold, set before the page finished hydrating. A plain load, a load with the drawer opened and a load with one screenshot produced no new warning (4 before, 4 after). Not a product defect (OBS-3).

Not covered: Firefox, WebKit, a real phone, any screen reader, Windows contrast themes, a low-end phone in daylight, Node 22 locally.

## AC-10 walk-through

Fresh `git clone` of the branch into a scratch folder, updated to `a4b94a0`. Steps as the README lists them, with two deviations that I state rather than hide: (a) I wrote the `.env` by hand with invented values instead of `cp .env.example .env`, because QA is denied access to `.env.example` (the test `env-example.test.ts` passes and covers that file); (b) the database ran in my own Compose project on port 55428, because the developer's database already holds 55432.

| Step | Result |
|------|--------|
| `npm ci` | exit 0 (prints an audit summary for dev dependencies; the gate is `npm audit --omit=dev --audit-level=high`, green in CI; #39 tracks the dev-only findings) |
| `docker compose ... up -d db` | healthy |
| `.env` (placeholder values; `AUTH_SECRET` from the README's `node -e` command) | ignored by Git |
| `npx prisma generate` | exit 0 |
| `npx prisma migrate deploy` | `No pending migrations to apply` (the database was already migrated; the same command applied the one migration earlier on this head) |
| `npx next dev -H 0.0.0.0` | "Ready in 2.9s"; `http://localhost:3000/design-system` 200; `http://192.168.29.8:3000/design-system` 200 |
| Failure path | with `AUTH_SECRET=CHANGE_ME_AUTH_SECRET` the server prints `Invalid environment: AUTH_SECRET (invalid). Check .env against .env.example.` and exits 1; no value is printed |
| PR description and README | the same "Run locally" lines are in the PR #33 description and the README's first section; the README adds the `AUTH_SECRET` command, the placeholder statement, the phone instructions and the stop commands |

Limit: I ran on Node 24, on a machine where Docker and `.env` were available; the story asks for Node 22 and Docker Desktop on Windows. The CI job proves Node 22; the delivery lead's own run in Appendix A is the last proof of the README.

## Defects

| ID | Title | Severity | Status | Linked AC |
|----|-------|----------|--------|-----------|
| DEF-004 ([AQP-179](https://sankumar76.atlassian.net/browse/AQP-179), [#43](https://github.com/sankumar76/Accucut-Quotation/issues/43)) | Drawer-width assertion in `shell.spec.ts` fails about 1 run in 10 (sub-pixel overshoot of 0.000008 px); the one retry hides it | Sev-3, type Test | New | AC-4, AC-8 |
| DEF-005 ([AQP-180](https://sankumar76.atlassian.net/browse/AQP-180), [#44](https://github.com/sankumar76/Accucut-Quotation/issues/44)) | `tests/unit/env.test.ts` fails on a computer with a complete `.env` (the README setup) | Sev-3, type Test | New | AC-10 (regression; test from AQP-27) |

Known and not raised again: DEF-003 (AQP-168, #24), the load-sensitive timeout class. Open by severity: Sev-1 0, Sev-2 0, Sev-3 2 (plus the known DEF-003), Sev-4 0. Records are in `docs/07-qa/defects/`. Both Jira Bugs are linked to AQP-28 ("relates to") with labels `ai-delivery`, `aiid-DEF-004` or `aiid-DEF-005`, `agent-qa-engineer`, `sev-3`; both GitHub issues carry `bug`, `sev-3`, `ai-delivery`.

## Observations (not defects; for the master to route)

| ID | Observation | Suggested home |
|----|-------------|----------------|
| OBS-1 | AC-2 says the header shows "Quotation Portal" beneath the name on "any page". The build hides it below 768 px, as the mock-up does (`screens.css` line 484) and as the code comment states; the e2e test asserts it from 768 px up only. Not a failure of the intent, but the AC has no width | product-owner: add "from 768 px up" to AC-2 |
| OBS-2 | The bell ("Overdue tasks") links to the home page and the account menu items are disabled placeholders until stories 04.03 and 01.01. The delivery lead will tap them; Appendix A says so | none; informational |
| OBS-3 | `platformFonts` in `tests/e2e/support/design-system.ts` sets a `data-probe` attribute on a below-the-fold element, which can land before hydration finishes and make the development server log a hydration warning. Cosmetic, test-only | developer, Sev-4 backlog |
| OBS-4 | There is no `forced-colors` CSS. It is not needed so far (outline focus, real borders, text-only information), but the colour swatches vanish in a contrast theme by design. The manual check decides whether anything else matters | QA at AC-9 |
| OBS-5 | The Playwright config fixes the port at 3100 and reuses a server already on it. Two people testing in two folders on one machine can end up testing each other's code. I used a wrapper on 3128 | developer, optional hardening (`PORT` from the environment) |

## Residual Risks / Notes

- AC-9 is the open item. Brand red with white text is 4.59:1; the test plan (R-5) asks for a daylight look on a real phone; Appendix A has a step for it.
- The tests are the developer's; my independent checks were scripts, not committed tests. The pass on AC-1 to AC-8 is independent in method only.
- The Wi-Fi path can fail for reasons outside the code (guest Wi-Fi isolating devices, Windows firewall set to Public); Appendix A names both.
- The machine was shared and slow during several runs; where a result depends on that, the table says so and CI is the reference.
- Cleanup: the throwaway database project `qa28g7`, my dev servers and the scratch clone are removed or stopped at the end of this run (see Hand-off); scripts and screenshots are in the session scratch folder, outside the repository.

## Appendix A — AC-9 checklist for the delivery lead (about 15 minutes)

**Give this page to the delivery lead as it is.** It is written for someone who is not a developer. QA records the answers in the table at the end and copies them into this report.

---

### Check the new Accucut portal page on your phone and your PC (about 15 minutes)

**What you need:** your Windows PC with the project folder and Docker Desktop installed; your phone; both on the **same office Wi-Fi** (not the guest Wi-Fi, not mobile data); a person from QA next to you. If the one-time setup in step A2 has never been done, add about 10 minutes.

**How to answer.** After each step write **PASS** (you saw what it says), **FAIL** (you did not) or **SKIP** (you could not do it), and a few words about what you saw. A photo of a problem helps. If something fails, carry on with the next step.

#### Part A. Start the portal on your PC (about 3 minutes)

**A1.** Start **Docker Desktop** and wait until it says it is running.

**A2.** Open the project folder in File Explorer, right-click an empty spot and choose **Open in Terminal**. *First time only:* type these lines one at a time, pressing Enter after each, and wait for each to finish: `npm ci`, then `docker compose -f compose.dev.yml up -d db` (wait 10 seconds), then `copy .env.example .env`. Then open the new file `.env` in Notepad and replace every `CHANGE_ME` (letters and digits only for the two database passwords; the README shows how to make the `AUTH_SECRET` value), save it, and type `npx prisma generate`, then `npx prisma migrate deploy`.

**A3.** Type `npx next dev -H 0.0.0.0` and press Enter. Wait for the line that says **Ready**. If Windows asks whether to allow **Node.js** through the firewall, tick **Private networks only** and click **Allow**.

**A4.** Find your PC's address: open a second terminal window, type `ipconfig`, and look under **Wi-Fi** for the line **IPv4 Address**. It looks like `192.168.1.20`. Write it down.

**A5.** On the PC, open Chrome or Edge and go to `http://localhost:3000/design-system`. The first time it can take up to 30 seconds.
*You should see:* a page titled **Design system**, a white bar at the top with the AccuCut logo and **ACCUCUT LASERS** in red letters, and (on a wide window) a dark menu on the left.
**PASS** if you see it. **FAIL** if you see an error page. If it fails, stop and tell QA.

*A small round "N" button near the bottom-left corner is a developer tool and is normal. If it shows a red "Issue" count, take a photo and write it down.*

#### Part B. On your phone (about 5 minutes)

**Before you start:** write down your phone's **model** (Settings, About phone), the **Android or iOS version**, and the **browser name and version** (Chrome: the three dots, Settings, About Chrome. iPhone Safari: its version is the iOS version).

**B1. Open the page.** On the phone's browser go to `http://` + the address from A4 + `:3000/design-system` (for example `http://192.168.1.20:3000/design-system`).
*You should see:* the page opens within about 30 seconds. The top bar shows a three-line **menu button** on the left, the logo with **ACCUCUT LASERS** in red, a **bell** and a round **account button** on the right. Under the name the words "Quotation Portal" are not shown on a phone; that is on purpose.
**PASS** if it looks like this. **FAIL** if it will not open or looks broken. If it will not connect, check: same Wi-Fi (not guest), the firewall question in A3 (Private networks), then tell QA.

**B2. Nothing slides sideways.** Swipe left and right on the page.
**PASS** if the whole page stays put and no text is cut off at the right edge. (A few wide tables may scroll inside their own box; that is fine.) **FAIL** if the whole page moves sideways.

**B3. The menu.** Tap the three-line button.
*You should see:* a dark panel slides in from the left with **Home** and **Design system** (the second has a red mark), a **X** at the top right, and the rest of the page dimmed.
Now do four things: tap the **X** (the panel closes); open it again and tap the dimmed area (it closes); open it again and tap **Home** (the home page opens and the panel is gone); then press the phone's Back button to return.
**PASS** if all four work. **FAIL** if any does not.

**B4. Buttons are easy to hit.** Scroll to the section **Buttons**. Tap **Calculate**, **Add part**, **Cancel**, **Delete** and the square pencil button. Then tap the **bell** and the round **account** button at the top (the bell only goes to the home page for now; the account button opens a small menu with a name; tap outside to close it).
**PASS** if each button is easy to hit with your thumb the first time and no neighbouring button reacts. The small pencil in the table row is meant to be a little smaller: fail it only if it is hard to hit. **FAIL** if you often miss or hit the wrong thing.

**B5. The rupee sign.** Scroll to the section **Form controls and column letters** (the sixth). Find the box **Output (Lead and Admin only)** showing **₹ 1,234.50**.
**PASS** if you see a proper rupee sign (like a capital R with two bars). **FAIL** if you see an empty square, a question mark, "Rs" or nothing.

**B6. Sideways phone.** Turn the phone to landscape.
**PASS** if the page still fits, the top bar is complete and the menu button still opens the panel. **FAIL** if something is cut off or unreachable. Turn the phone upright again.

**B7. Daylight.** Hold the phone near a window or outside. Look at the red **Calculate** button.
**PASS** if the white words on the red are easy to read. **FAIL** if they are hard to read (write the lighting).

**B8. Make the text bigger.** Pinch with two fingers to zoom in.
**PASS** if you can zoom and the text gets bigger. **FAIL** if the phone will not let you zoom.

**B9. Optional, 2 minutes, only if you use it.** Turn on the phone's screen reader (Android **TalkBack**, iPhone **VoiceOver**), open the menu button and the first section, and listen. **PASS** if the menu button is called "Open menu" and the menu items are read by name. Turn it off again.

#### Part C. Keyboard on the PC (about 2 minutes)

Use Chrome or Edge on the PC at `http://localhost:3000/design-system`. Put the mouse aside.

**C1. The skip link.** Reload the page (F5) without clicking anywhere. Press **Tab** once.
*You should see:* a link **Skip to main content** appears at the top left with a thick dark outline. Press **Enter**.
**PASS** if the link goes away and the next **Tab** lands inside the page content, not back on the logo or menu. **FAIL** otherwise.

**C2. You can always see where you are.** Reload, then press **Tab** about ten times, then **Shift + Tab** a few times.
**PASS** if every stop has a clear thick dark outline, you never lose track of it, and it is never hidden behind the top bar. **FAIL** if the marker disappears or goes under the bar.

**C3. The menu with the keyboard.** Make the page narrower: hold **Ctrl** and press **+** several times (to 200 percent or more) until the three-line menu button appears at the top left. Press **Tab** twice (the second stop is the menu button), then **Enter**.
*You should see:* the dark menu panel opens. Press **Tab** several times: the marker stays inside the panel. Press **Esc**.
**PASS** if the panel closes and the marker is back on the menu button. **FAIL** if the marker leaves the panel while it is open or is lost on closing. Press **Ctrl + 0** to reset the size.

#### Part D. Screen reader: Windows Narrator (about 3 minutes)

**Turn it on:** press **Windows + Ctrl + Enter** (you will hear a voice). Or: Settings, Accessibility, Narrator, switch on. Turn the speaker volume up. **Turn it off:** press **Windows + Ctrl + Enter** again (or Caps Lock + Esc).

Use Chrome or Edge, at `http://localhost:3000/design-system`, with a normal wide window.

**D1. The page.** Reload (F5). **PASS** if Narrator says the page title, "Design system", "Accucut Quotation Portal".

**D2. The top bar.** Press **Tab** and listen to each stop: first "Skip to main content, link", then the logo and name link, then "Overdue tasks, link", then "Account menu, Preview User ..., button".
**PASS** if every stop has a meaningful name and a type (link or button). **FAIL** if you hear only "button", "unlabeled", a file name like "accucut-logo.jpg" or nothing.

**D3. The headings.** Press **Caps Lock + Space** to turn on scan mode, then press **H** repeatedly. *You should hear* "Design system, heading level 1", then the section titles in order: **Brand: Red Leads**, **Colour tokens**, **Type scale**, **Spacing**, **Buttons**, and so on to the tenth, **Component map for shadcn/ui**.
**PASS** if you hear all ten in this order. If scan mode will not work, press Tab instead and tell QA (SKIP). Press **Caps Lock + Space** again to turn scan mode off.

**D4. A switch and a tick box.** Tab to **Include the setup cost** and **E-mail alerts: ON**.
**PASS** if Narrator says the tick box is "checked" and the switch is "on", and when you press **Space** on the switch it says "off". **FAIL** otherwise.

**D5. The menu panel.** Make the window narrow as in C3 and open the menu with Tab and Enter. **PASS** if Narrator says it is a "Menu" (dialog) and reads "Home" and "Design system" as links, and while it is open you do not hear the page behind. Press **Esc**.

Turn Narrator off, and press Ctrl + 0 to reset the size.

#### Part E. Windows high-contrast mode (about 2 minutes)

**Turn it on:** press **Left Alt + Left Shift + Print Screen**, then click **Yes**. Or: Settings, Accessibility, **Contrast themes**, pick **Night sky**, click **Apply**. **Turn it off:** press the same three keys again, or choose **None** in Contrast themes and click **Apply**.

Open `http://localhost:3000/design-system` and press F5.

**E1. Everything is readable.** **PASS** if all the text is readable, the logo is there, buttons and boxes have visible edges, and the top bar and sections are separated by lines. The coloured squares in **Colour tokens** show as empty outlined boxes; that is expected, because their codes are written under them. **FAIL** if any text or button vanishes.

**E2. Keyboard marker.** Press **Tab** a few times. **PASS** if the marker is clearly visible on each stop.

**E3. Menus and notices.** Open the account menu (top right) and, in a narrow window, the left menu. Scroll to **Status badges and notices**. **PASS** if the menu edges are visible, the current page is still marked in the left menu, and each notice shows its icon and its words. In **Buttons**, **PASS** if the greyed-out buttons ("Calculating", "Approve and lock", "Download Excel") can still be told apart from the active ones.

**E4. A light theme too.** Switch to **Desert** (Contrast themes, Apply) and repeat E1 and E2 quickly.

Turn high contrast off and confirm the page looks normal again.

#### Part F. Finish

Stop the portal: click the terminal that runs it and press **Ctrl + C**, then type `docker compose -f compose.dev.yml down`. (While the portal runs with `-H 0.0.0.0`, anyone on the same Wi-Fi can open it, so stop it when you are done.)

**Write down for QA:**

| Item | Your answer |
|------|-------------|
| Phone model | |
| Phone system and version (Android or iOS) | |
| Phone browser and version | |
| PC Windows version (press Windows + R, type `winver`) | |
| PC browser and version (Chrome or Edge: menu, About) | |
| Narrator used (Windows version is enough) | |
| Contrast themes tried | |

| Step | PASS / FAIL / SKIP | What you saw (and photo if wrong) |
|------|--------------------|-----------------------------------|
| A5 | | |
| B1 | | |
| B2 | | |
| B3 | | |
| B4 | | |
| B5 | | |
| B6 | | |
| B7 | | |
| B8 | | |
| B9 (optional) | | |
| C1 | | |
| C2 | | |
| C3 | | |
| D1 | | |
| D2 | | |
| D3 | | |
| D4 | | |
| D5 | | |
| E1 | | |
| E2 | | |
| E3 | | |
| E4 | | |

---

**How QA will read the results.** Any FAIL on B1, B3, B5, C1, C3, D2 or E1 is recorded as a defect of Sev-2 (it stops a task or loses content); other FAILs are Sev-3. A step marked SKIP is "not run" and is listed at G8; a skipped B1 to B6, D or E block leaves AC-9 unverified.

### AC-9 results (to be filled by QA after the session)

| Part | Result | Device / software / version | Date |
|------|--------|-----------------------------|------|
| Phone (B) | Pending | | |
| Keyboard (C) | Pending | | |
| Narrator (D) | Pending | | |
| High contrast (E) | Pending | | |

## Artefacts

Committed with this report: `docs/07-qa/AQP-28-test-report.md`, `docs/07-qa/defects/DEF-004-drawer-width-assertion-sub-pixel-flake.md`, `docs/07-qa/defects/DEF-005-env-test-depends-on-ambient-environment.md`. No production code, test or test-plan file was changed. `docs/07-qa/test-plan.md` (modified in the working tree by someone else) was not touched and not staged. Updates the plan still needs from QA: section 17 now has verified commands for 10.02 (Playwright projects `mobile`, `tablet`, `desktop`; the wrapper-config trick for a second tester on one machine), and section 12.2 should say Narrator is accepted as the "equivalent" if the master agrees.

## Hand-off
- Status: COMPLETE for AC-1 to AC-8 and AC-10; AC-9 pending the delivery lead
- Recommendation (G7): ACCEPT, conditional on AC-9 (Sev-1 0, Sev-2 0, Sev-3 2 type Test, Sev-4 0)
- Jira / GitHub: AQP-179 and #43 (DEF-004), AQP-180 and #44 (DEF-005) opened and linked to AQP-28; summary comments on AQP-28 and PR #33
- Story status: not changed by QA
