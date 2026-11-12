# Test Report — AQP-274 (DEF-029, GitHub #308): the load error after a successful save says the change was saved (Process SCR-11, Materials SCR-13)

| Field | Value |
|-------|-------|
| Tester | qa-engineer |
| Build / commit | **H1 = `e6e1c14`** on `fix/AQP-274-saved-not-shown` (PR #309, `sankumar76/Accucut-Quotation`), tested as it is. Its CI merge ref `87eddc0` is H1 into `master` `6b1883f`. `master` has since moved to `afecc58` (#222) and `cdcf18b` (the records PR #321); the update to the new tip comes after G7 (DL-171 (7)). `git diff --name-only 6b1883f origin/master` over `src/components/features/masters`, `tests/unit` and the three masters specs of #309 is empty, so neither move touched a file of #309. This report is the one commit on top of H1 (H2, docs only) |
| Story / defect | AQP-274 (Jira) = DEF-029 (Sev-3), mirrored as #308; found against AQP-113 (Process) and AQP-122 (Materials); G6 CONDITIONAL GO DL-171, conditions A and B met; QA scope DL-171 (6) |
| CI | Run **43179008751**, attempt 1 (the only attempt), event `pull_request`, 5 of 5 `success`: `Stages 1 to 11b`, E2E shards 1, 2, 3, `Stages 1 to 11`. Path 5:23 (first job 07:56:49Z, last job 08:02:12Z). 0 `✘`, 0 retry, 0 flaky line |
| Environment | CI as above, plus a local run: Windows 11, Node v24.19.0, Playwright 1.64.1 Chromium, `next dev` (Turbopack) on port 3274, a throwaway PostgreSQL 17 container on 127.0.0.1:55474 (roles from `docker/postgres-init/01-create-roles.sh`, `prisma migrate deploy`, `ensure-seed-version.ts`). Container, dev server and the file that held its throwaway passwords were removed after the run. The shared databases were not used. QA's spec `aqp-274-qa.spec.ts` (Appendix A) is **not committed**: this commit adds the report alone. Invented data only |
| Date | 2026-11-12 |
| **Recommendation** | **ACCEPT.** On both screens, at 360, 768 and 1366 px, after an Add, Save or Delete that succeeded and a list read that failed, the page shows the success notice, the title, the v0.23 sentence, and not "Nothing was changed."; focus is on the title; a failing Try again keeps the sentence and a passing one shows the list. With a deleted-elsewhere notice (warning and information) and with a refused Delete (no notice) the standard line stays. Treatment / Color is unchanged. axe finds 0 violations at three widths. CI is 5 of 5 at the target counts. No new defect. DEF-029 is **Verified** on H1 (pending G7). Open defects against this story: Sev-1 0, Sev-2 0, Sev-3 0, Sev-4 0 |

## Summary

PR #309 makes `ProcessResults` and `MaterialResults` pass `SAVED_NOT_SHOWN_BODY` to `MasterLoadError` only while `master.notice?.tone === 'success'`; without a success notice `description` is `undefined` and the shared default, `Check your connection and try again. Nothing was changed.`, shows. The one constant lives in `master-texts.ts`; Treatment / Color imports it (text unchanged). H1 adds a 9-case Node render test of the words for every notice, DEF-029 in two E2E titles and two file-local helper constants.

I did four things. (1) I read the CI of H1 from the jobs API and from the shard logs and compared it with the push run of the `master` commit in the merge ref (section N). (2) I drove the running app as the Admin at the three widths with the list read forced to fail after each kind of success, each kind of "no success notice", and on Treatment / Color (sections A and B). (3) I read the two controls, #316 and #327 (section C). (4) I read the diff (section D). Everything in A and B was run on a local throwaway stack; I did not need a QA branch PR, so no QA control PR was opened.

## N. CI of H1 (DL-171 (5), (6)(a))

Run 43179008751, head `e6e1c14`, attempt 1. A listing of runs for the branch shows three runs: 43171948731 (`b22f735`, the first push, red because the AQP-122 AC-8 load-error test still asserted the false line; fixed in `86d7108`), 43173595283 (`356e9d6`, green) and this one (`e6e1c14`, green). Jobs API for 43179008751: `Stages 1 to 11b` success (07:56:49Z to 08:00:54Z), shard 3 success (to 08:01:48Z), shard 2 success (to 08:01:09Z), shard 1 success (to 08:02:04Z), `Stages 1 to 11` success (08:02:06Z to 08:02:12Z). Reference: the push run **43169697211** of `master` `6b1883f` (attempt 1, 5 of 5 success), whose five job logs I read the same way. Merge ref in every job: `87eddc0` "Merge e6e1c14 into 6b1883f".

| | Base 43169697211 (`6b1883f`) | H1 43179008751 | Difference | Target (DL-171 (5)) |
|--|--|--|--|--|
| Vitest unit (`Test Files`) | 157 files, 3,185 passed | 158 files, 3,194 passed | **+1 / +9** | +1 / +k, k = 9 |
| Vitest full (`Test Files`) | 217 files, 5,549 passed | 218 files, 5,558 passed | **+1 / +9** | +1 / +k |
| E2E shard 1 | 275 passed, 3 skipped | 275 passed, 3 skipped | 0 | +0 |
| E2E shard 2 | 273 passed, 4 skipped | 273 passed, 4 skipped | 0 | +0 |
| E2E shard 3 | 260 passed, 17 skipped | 260 passed, 17 skipped | 0 | +0 |
| E2E total | 808 passed, 24 skipped | 808 passed, 24 skipped | **+0 / +0** | +0 / +0 |

Totals match (3,185 + 9 = 3,194; 5,549 + 9 = 5,558; 808 and 24 unchanged). **Names:** from the six shard logs I took every `✓` and `-` entry, removed `:line:col` and the duration, and compared by title. Base: 832 entries (808 + 24), 826 distinct; H1: 832 and 826. **Missing from H1: only the two renamed titles at three widths (6 entries)**, "…the load error's title keeps focus and the page heading never takes it (DEF-020)" for Process and for Materials. They are all present under their new titles, which end ", and the sentence says the change was saved (DEF-029)". **Added by H1: the same 6 entries.** Nothing else differs. `Gitleaks`: "698 commits scanned … no leaks found". JS budget: `/masters/process` 175,119 (limit 200,000, headroom 24,881), `/masters/materials` 187,481 (headroom 12,519), the figures the PR states. `Cache restored successfully`: 3 in `Stages 1 to 11b`, 5 in shard 1; no `Cache not found` line.

**Regression files by name (DL-171 (6)(c)), instances in the H1 run, all passed:** `masters-slow-read.spec.ts` 15 of 15 (5 per width, including the two renamed tests); `aqp-122-qa.spec.ts` 60 of 60, including `[AQP-122 AC-8] Loading, Error and Empty` and `[AQP-122 AC-8] DEF-020` at three widths; `treatments-focus.spec.ts` 38 passed and 1 skipped (the same one skipped in the base run); `exchange-rates.spec.ts` 48 of 48.

## A. Acceptance on the running app (DL-171 (6)(b))

Method: signed in as the E2E Admin; the list read is made to fail by a Playwright route that answers `GET` of the list with the 503 the server sends when the database is busy (`DATABASE_BUSY`), from the moment the test sets it, so the write goes through and only the read that follows fails. Three widths, 360x800, 768x1024 and 1366x768 (the product's `mobile`, `tablet` and `desktop` projects). The words are written out in the spec from ux-spec v0.23, not imported. After the error shows, each test checks: the success notice (`role=status`) is still on the page; the title; the sentence is exactly the v0.23 one (`getByText(…, { exact: true })`); "Nothing was changed." appears nowhere on the page; the last element to take focus is the title (`focusin` log from before the click) and it still has focus a frame later and in a poll; and "Try again" is visible.

| ID | Case | Expected (ux-spec v0.23) | 360 | 768 | 1366 |
|----|------|--------------------------|-----|-----|------|
| P1 | Process **Add** succeeds, list read fails | `<name> was added. The change is in the audit log.` stays; title `We could not load the rates`; **`The change was saved, but we could not show the list. Check your connection and try again.`**; no "Nothing was changed."; focus on the title; page does not scroll sideways (`scrollWidth - clientWidth` 0); **axe 0**; a failing Try again keeps the sentence and the notice; a passing one removes the error, shows the new row and leaves the notice | Pass | Pass | Pass |
| P2 | Process **Edit** (Save) | same, notice `<name> saved. The change is in the audit log.` | Pass | Pass | Pass |
| P3 | Process **Delete** | same, notice `<name> was deleted. The change is in the audit log.`; after the good read the row is gone | Pass | Pass | Pass |
| P4 | Process **Edit of a rate deleted elsewhere** (404, warning notice `<name> no longer exists.`), list read fails | title; **`Check your connection and try again. Nothing was changed.`**; the saved sentence absent; no success notice; axe 0 | Pass | Pass | Pass |
| P5 | Process **Delete of a rate deleted elsewhere** (information notice `<name> was already deleted.`), list read fails | same standard line; axe 0 | Pass | Pass | Pass |
| P6 | Process **Delete refused** because a formula began to use the rate (the server's 409 `PROCESS_ITEM_IN_USE`, stubbed; the refusal dialog opens and the notice was cleared when the dialog opened), list read behind it fails; after Close | title; the standard line; the saved sentence absent; **no** success notice on the page; axe 0 | Pass | Pass | Pass |
| P7 | Process **first read** fails | (DL-171: if not reachable, record it) | **Not reachable** | **Not reachable** | **Not reachable** |
| M1 | Materials **Add** succeeds, list read fails | as P1 with title `We could not load the materials`; axe 0; no sideways scroll; Try again fails then passes | Pass | Pass | Pass |
| M2 | Materials **Edit** (Save) | as P2 | Pass | Pass | Pass |
| M3 | Materials **first read** fails | (as P7) | **Not reachable** | **Not reachable** | **Not reachable** |
| T1 | **Treatment / Color Add** succeeds, list read fails | unchanged: title `We could not load the treatments`; the same sentence; no "Nothing was changed."; focus on the title; axe 0 | Pass | Pass | Pass |

Page text captured at the moment of P1 and M1 (the name is an invented `QA-…` name), identical at all three widths: `Process master … Add rate <name> was added. The change is in the audit log. Search We could not load the rates The change was saved, but we could not show the list. Check your connection and try again. Try again`, and `Materials and lists … Add material <name> was added. The change is in the audit log. Search materials We could not load the materials The change was saved, but we could not show the list. Check your connection and try again. Try again`.

**P7 and M3, not reachable.** The list that a page load shows is carried by the page itself (the server renders it; the `aqp-122-qa.spec.ts` comment says "a page load carries the list with it"), so the list's `GET` is not made on load and a route that fails it changes nothing: the page shows its rows. QA's P7 and M3 assert exactly that (the error heading does not appear within 15 s and a row is visible), so the fact is evidenced and not assumed. The standard line without a notice is still reached by P6 (a refused Delete behind the refusal dialog) and, in every one of the seven non-success rows, by the unit test (section C). Exchange rates was not driven (see section D): its tab is untouched by H1 and its 48 instances in the H1 run passed.

**Runs.** Run 2 (all 33 instances of the spec, 2 workers): 27 passed including the setup project's 2, 2 failed for the environment (below), and 6 were the first form of P7 and M3, which expected an error and found the page's rows. After I changed P7 and M3 to assert "not reachable" (no change to any other test, only `console.log` of the page text added), run 4 (P1, P5, P7, M1, M3 at three widths, 1 worker) passed 15 of 15 plus setup 2 of 2. So every one of the 33 instances has one run in which it passed with the final text of its test. **Environment failures, not product failures:** run 1 (setup project: `next dev` too cold, 180 s timeout; when I measured after run 3 the machine had about 700 MB of 8 GB free; a database "timeout exceeded when trying to connect" in the server log); run 2 P5 at 360 px (`apiRequestContext.get: read ECONNRESET` in QA's own pre-step that lists the rates, before the product was touched) and P1 at 1366 px (`waitUntilHydrated` timed out at the page load); run 3 (setup timed out again, dev server answered `/sign-in` in 44 s). I stopped all processes of mine, restarted one dev server and used one worker. I recorded them here and did not hide them; they are not flaky tests of the product's suite, which I did not run locally.

## B. AC verification matrix (the defect's expected results, DEF-029, and ux-spec v0.23 tests (1) to (4))

| ID | Expectation | Test ID(s) | Technique | Result | Evidence |
|----|-------------|-----------|-----------|--------|----------|
| E1 | Process Add, Edit and Delete each followed by a failed re-read: title `We could not load the rates` and the v0.23 sentence under the success notice (SCR-11 test (1)) | CI `masters-slow-read.spec.ts:77` at three widths (Edit); AQP-122 AC-8 does the same for Materials; QA P1, P2, P3 | State transition (save, then failed read), decision table by notice | **Pass** | A: P1, P2, P3 at 360, 768, 1366. CI: 3 of 3 for `:77` |
| E2 | Materials Add and Edit, title `We could not load the materials` and the same sentence (SCR-13 test) | CI `masters-slow-read.spec.ts:105`, `aqp-122-qa.spec.ts:278`; QA M1, M2 | same | **Pass** | A: M1, M2 at three widths. CI: 3 of 3 each |
| E3 | The success notice stays; "Nothing was changed." is absent; focus on the title (SCR-11 test (4)); a failing Try again keeps the sentence; a passing one shows the list and leaves the notice | QA P1 to P3, M1, M2; CI `expectSavedNotShown` and `expectLoadErrorHoldsFocus` | Error guessing (second failure), focus log | **Pass** | A: every row. `focusin` log ends on the title in all 18 saved-sentence runs (P1, P2, P3, M1, M2, T1 at three widths) |
| E4 | A warning or information notice (rate deleted elsewhere): the standard line (SCR-11 test (3)) | QA P4, P5; unit `masters-load-error-words.test.ts` rows 2 and 3 | Decision table | **Pass** | A: P4, P5 at three widths (reviewer-quality noted no CI E2E covers this; the unit test and these do) |
| E5 | No success notice: the standard line (SCR-11 test (2), SCR-13) | unit rows 1 (Process, Materials); QA P6 for a no-notice failed re-read | Decision table | **Pass** | A: P6 at three widths. First read not reachable (P7, M3) |
| E6 | A refused Delete (a formula uses the rate): notice cleared, standard line after a failed re-read | QA P6 | Error guessing | **Pass** | A: P6 at three widths |
| E7 | Treatment / Color says its own sentence, unchanged; Exchange rates keeps its words | QA T1; CI `treatments-focus.spec.ts` (38 passed, 1 skipped as in base), `exchange-rates.spec.ts` 48 of 48; diff | Regression + inspection | **Pass** | T1 at three widths; diff in D: `treatment-panel.tsx` changes only the import and the constant it passes; `exchange-rates-panel.tsx`, `exchange-rate-texts.ts` are not in the diff |
| E8 | axe 0 on the Process saved-sentence error at three widths | QA P1 (also M1, T1, P4, P5, P6); CI `expectNoAxeViolations` in `aqp-122-qa.spec.ts:278` | axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) | **Pass** | P1 at 360, 768, 1366: 0 violations |
| E9 | One shared `SAVED_NOT_SHOWN_BODY`; Treatment imports it; text unchanged | Diff | Inspection | **Pass** | section D |
| E10 | Responsive: no sideways page scroll with the error and notice | QA P1, M1 | Measurement | **Pass** | `scrollWidth - clientWidth` is 0 at three widths |

## C. Controls and the unit test (DL-171 (5), (6)(d))

**Unit test, run locally on H1:** `node node_modules/vitest/vitest.mjs run tests/unit/masters-load-error-words.test.ts` → 1 file, 9 of 9 passed (40 s). In the CI run it is part of the +1 / +9 above. The expected strings are written out in the file (`STANDARD_LINE`, `SAVED_SENTENCE`), not imported, and I compared them with ux-spec v0.23 line 388 and SCR-11 line 756: identical to the character.

**#316** (developer's plant, `813af2d`, closed unmerged; `description` removed from both results files; I did not rerun it, I read its run): run 43173789224, attempt 1, `Stages 1 to 11b` success, the three E2E shards failed. The failed lists in the three shard logs total **9 failed instances = 3 widths x 3 tests**: `masters-slow-read.spec.ts:77`, `:105` and `aqp-122-qa.spec.ts:278`, each at mobile, tablet and desktop (each listed twice in the logs, once per attempt, because the suite retries once). Nothing else failed. It was made on `356e9d6`; H1 adds only tests, so the plant still describes the guard.

**#327** (reviewer-quality's plant B, `0d4071b`, closed unmerged): `git diff e6e1c14 0d4071b` is the two results files, `const saved = master.notice?.tone === 'success';` removed and `description={SAVED_NOT_SHOWN_BODY}` unconditional, nothing else. Run 43180573071, attempt 1: `Stages 1 to 11` and `Stages 1 to 11b` failed; Vitest "4 failed | 3190 passed (3194)", exactly the four non-success rows: Process none, Process warning (edited, gone), Process information (deleted, gone), Materials none. The three E2E shards succeeded: the E2E suite is green under this plant, which is the gap the unit test closes, and QA's P4, P5 and P6 would also be red under it (not run; DL-171 (6)(d) requires no QA control).

## D. Diff read (H1 against the merge-ref base `6b1883f`)

`git diff --stat 6b1883f e6e1c14`: 9 files, +123 / -13. `src/`: `master-texts.ts` (+7, the constant), `material-results.tsx` and `process-results.tsx` (`description={saved ? SAVED_NOT_SHOWN_BODY : undefined}` with `saved = master.notice?.tone === 'success'`), `treatment-panel.tsx` (imports `SAVED_NOT_SHOWN_BODY` and passes it; the sentence is the same literal), `treatment-texts.ts` (-2, the removed copy). `tests/`: `aqp-122-qa.spec.ts`, `masters-slow-read.spec.ts`, `support/masters.ts`, `masters-load-error-words.test.ts`. **No** file of `exchange-rates-panel.tsx`, `exchange-rate-texts.ts`, a route, a dependency, the workflow or `package.json`. `git diff --stat 356e9d6 e6e1c14` (G6 condition A) is three files, all under `tests/` (+85 / -4): `masters-slow-read.spec.ts`, `support/masters.ts`, `masters-load-error-words.test.ts` (+78). Condition A (ii), the two titles carry "DEF-029", is visible in the run's test names (section N); (iii), the two literals are file-local `const`s written out in `support/masters.ts` (`SUCCESS_NOTICE_SENTENCE`, `NOTHING_WAS_CHANGED`). Master checks STD-01 and STD-02 at G7 (DL-171 (6)); I only note they are met.

## Exploratory session (charter)

*Mission:* find a way for the page to say something false about a save after a failed list read. *Areas:* the sequence save, failed read, Try again fails, Try again passes; the three notice tones; a refused Delete; focus; widths; the Treatment / Color neighbour. *Findings:* (1) the notice is never cleared by a failed read or by Try again (P1 to P3, M1, M2): consistent with "Not a toast" in SCR-11. (2) After a passing Try again the error and the sentence go and the notice stays (all); the list shows the new row for Add and Edit and no row for Delete. (3) In P6 the failed read happens behind the refusal dialog, so the person sees the standard line only after pressing Close; it is a correct line (nothing was changed: the server refused the Delete) and no success notice is on the page. (4) The first read cannot be made to fail through the API because the list arrives with the page (section A). (5) Failed **writes** on Process and Materials still say "Nothing was changed." (`process-form-dialog.tsx`, `process-delete-dialogs.tsx`, `material-form-dialog.tsx`): that is #307 (condition K), named in DL-171 (6)(d) as not a finding against AQP-274; I did not test it. (6) I did not find a new defect.

## Non-functional and security

Accessibility: axe 0 at 360, 768 and 1366 px on the Process saved-sentence error (P1), the Materials one (M1), the Treatment one (T1) and the three standard-line cases (P4, P5, P6); focus on the error title in every saved-sentence case; the error title is a heading; "Try again" is a button; the notice is `role=status`. No colour or layout code changed, so contrast is not re-measured. Performance: JS gzip +58 B (`/masters/process`) and +57 B (`/masters/materials`) against the base, within the budget. Security: the change is wording behind a condition on client state; no route, input or permission changed. The new unit test and probe use invented names; no secret is in the report, the spec or the logs I read (Gitleaks "no leaks found").

## Defects

New: **none**. DEF-029 (Sev-3, #308, Jira AQP-274): **Verified on H1** by P1 to P6, M1, M2 at three widths and by the CI run (rule: QA verifies a fix by running the failing case and the regression around it, not by reading the diff). The Jira Bug and the GitHub issue close with the merge (`Closes #308`); I did not move AQP-274 to Done: that waits for master's G7. Related and open, outside this diff: #307 (failed writes), DEF-030 / AQP-275 (Sev-2 per DL-174, Users notice).

## Issues for other roles

1. The DEF-029 file on the records branch (`docs/07-qa/defects/DEF-029-load-error-says-nothing-changed-after-saved.md`) still says Status New and has an empty "Fix & Verification" table. H2 may add only this report (DL-171 (6)(e)), so the update (Fixed by `b22f735`, tests `e6e1c14`, Verified by qa-engineer on H1 with this report) belongs to the next records commit (qa-engineer's lane, `docs/07-qa/defects/`); the orchestrator should open it after master's G7.
2. For the merge (orchestrator, DL-171 (7)): neither #222 nor #321 touched a file of #309 (see the header), so the update to `cdcf18b` or later needs no new G7 if `git diff H2 H3` over #309's files is empty. If #297 merges first and still references `TREATMENT_SAVED_NOT_SHOWN_BODY`, the update comes back to master.
3. The probe could not make a first read fail (section A). If master wants the "no notice, first read fails" row proven in a browser, a test must change how the list is delivered; today only the unit test covers it. I do not recommend it.

## Appendix A. QA's spec (not committed; run only against the throwaway stack)

`tests/e2e/aqp-274-qa.spec.ts` of the worktree, removed from the worktree after the run (the file is kept outside the repository). It reuses `support/masters.ts` and `support/treatments.ts` helpers only for opening screens, making rows through the API and the 503 body; every expected word is its own. Reproduce: a throwaway database with the two roles, `prisma migrate deploy`, `ensure-seed-version.ts`, `next dev` on a free port, then `npx playwright test --config playwright.local.config.ts tests/e2e/aqp-274-qa.spec.ts`.

```ts
import { expect, test, type Page } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { makeMaterial, makeRate, MATERIALS_LOAD_ERROR, openMaterials, openProcessMaster, PROCESS_LOAD_ERROR, pressWithKeyboard, rowButton } from './support/masters';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';
import { afterOneFrame, BUSY, newTreatmentName, openTreatments, recordFocus } from './support/treatments';

/**
 * QA probe for AQP-274 (DEF-029), G7. NOT part of the product's suite: it runs only on QA's throwaway database and dev server.
 * The words are written out here from ux-spec v0.23 (section 6.0 "Error (load)", SCR-11, SCR-13), not imported from src or from the developer's helpers.
 */
test.use({ storageState: ADMIN_STATE });

const SAVED = 'The change was saved, but we could not show the list. Check your connection and try again.';
const STANDARD = 'Check your connection and try again. Nothing was changed.';
const NOTHING = 'Nothing was changed.';
const AUDIT = 'The change is in the audit log.';
const TREATMENT_LOAD_ERROR = 'We could not load the treatments';

interface Fail {
  value: boolean;
  reads: number;
}

/** From the moment `value` is true, the GET of this list answers 503 (as a busy database does); the writes and every other call go through. */
async function failList(page: Page, path: string): Promise<Fail> {
  const fail: Fail = { value: false, reads: 0 };
  await page.route(`**${path}`, (route) => {
    if (route.request().method() === 'GET' && fail.value) {
      fail.reads += 1;
      return route.fulfill(BUSY);
    }
    return route.continue();
  });
  return fail;
}

async function lastFocused(page: Page): Promise<string> {
  return page.evaluate(() => document.activeElement?.textContent ?? '');
}

/** The load error with the saved sentence: success notice still on the page, title, sentence, no "Nothing was changed.", focus on the title. */
async function expectSavedSentence(page: Page, title: string, notice: string, focusLog: string[]): Promise<void> {
  const heading = page.getByRole('heading', { name: title });
  await expect(heading).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: notice }), 'the success notice stays above the error').toBeVisible();
  await expect(page.getByText(SAVED, { exact: true }), 'the v0.23 sentence, exactly').toBeVisible();
  await expect(page.getByText(NOTHING), '"Nothing was changed." is absent').toHaveCount(0);
  await expect(page.locator('main').getByText(STANDARD)).toHaveCount(0);
  await afterOneFrame(page);
  await expect(heading, 'focus is on the title').toBeFocused();
  expect(focusLog.at(-1), 'the last element to take focus is the title').toBe(`H2:${title}`);
  await expect.poll(() => lastFocused(page), { message: 'focus stays on the title' }).toBe(title);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
}

async function expectStandardLine(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText(STANDARD, { exact: true }), 'the standard line').toBeVisible();
  await expect(page.getByText(SAVED), 'the saved sentence is absent').toHaveCount(0);
}

/** A failing Try again keeps the sentence and the notice; a passing one shows the list and leaves the notice. */
async function tryAgainFailsThenPasses(page: Page, fail: Fail, title: string, notice: string, row: string | null): Promise<void> {
  const before = fail.reads;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect.poll(() => fail.reads, { message: 'Try again made another read' }).toBeGreaterThan(before);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText(SAVED, { exact: true }), 'a failing Try again keeps the sentence').toBeVisible();
  await expect(page.getByText(NOTHING)).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: notice })).toBeVisible();

  fail.value = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
  await expect(page.getByText(SAVED)).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: notice }), 'the notice stays after a good read').toBeVisible();
  if (row !== null) await expect(page.locator('[data-item-id]:visible').filter({ hasText: row })).toBeVisible();
}

async function deleteElsewhere(page: Page, name: string): Promise<void> {
  const list = await page.request.get(`${DEVELOPMENT_URL}/api/v1/process-items`);
  const items = ((await list.json()) as { processItems: Array<{ id: string; name: string }> }).processItems;
  const id = items.find((item) => item.name === name)?.id ?? '';
  const response = await page.request.delete(`${DEVELOPMENT_URL}/api/v1/process-items/${id}`, { headers: { origin: DEVELOPMENT_URL } });
  expect(response.status()).toBe(204);
}

test.describe('Process master (SCR-11): a save succeeded, then the read fails', () => {
  test('P1 Add: v0.23 sentence, notice stays, focus on the title, axe 0, no sideways scroll, failing and passing Try again', async ({ page }, testInfo) => {
    const name = `QA-rate-${testInfo.project.name}-r${testInfo.retry}-${Date.now().toString(36)}`;
    await openProcessMaster(page);
    const fail = await failList(page, '/api/v1/process-items');
    await pressWithKeyboard(page.getByRole('button', { name: 'Add rate' }));
    const dialog = page.getByRole('dialog', { name: 'Add rate' });
    await dialog.getByLabel('Rate name').fill(name);
    await dialog.getByLabel('Unit').selectOption('per kg');
    await dialog.getByLabel('Default value').fill('1.5');
    fail.value = true;
    const focusLog = await recordFocus(page);
    await dialog.getByRole('button', { name: 'Add rate' }).click();
    await expect(dialog).toBeHidden();
    await expectSavedSentence(page, PROCESS_LOAD_ERROR, `${name} was added. ${AUDIT}`, focusLog);
    console.log(`PAGETEXT ${testInfo.project.name} :: ${(await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 500)}`);
    expect(await horizontalOverflow(page), 'the page does not scroll sideways').toBe(0);
    await expectNoAxeViolations(page);
    await tryAgainFailsThenPasses(page, fail, PROCESS_LOAD_ERROR, `${name} was added. ${AUDIT}`, name);
  });

  test('P2 Edit: v0.23 sentence, notice stays, focus on the title, Try again', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    const fail = await failList(page, '/api/v1/process-items');
    await pressWithKeyboard(rowButton(page, name, 'Edit'));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Default value').fill('2.37');
    fail.value = true;
    const focusLog = await recordFocus(page);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expectSavedSentence(page, PROCESS_LOAD_ERROR, `${name} saved. ${AUDIT}`, focusLog);
    await tryAgainFailsThenPasses(page, fail, PROCESS_LOAD_ERROR, `${name} saved. ${AUDIT}`, name);
  });

  test('P3 Delete: v0.23 sentence, notice stays, focus on the title, Try again', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    const fail = await failList(page, '/api/v1/process-items');
    await pressWithKeyboard(rowButton(page, name, 'Delete'));
    const alert = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    fail.value = true;
    const focusLog = await recordFocus(page);
    await alert.getByRole('button', { name: 'Delete rate' }).click();
    await expect(alert).toBeHidden();
    await expectSavedSentence(page, PROCESS_LOAD_ERROR, `${name} was deleted. ${AUDIT}`, focusLog);
    await tryAgainFailsThenPasses(page, fail, PROCESS_LOAD_ERROR, `${name} was deleted. ${AUDIT}`, null);
    await expect(page.locator('[data-item-id]:visible').filter({ hasText: name })).toHaveCount(0);
  });

  test('P4 Edit of a rate deleted elsewhere (warning), then the read fails: the standard line', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    const fail = await failList(page, '/api/v1/process-items');
    await pressWithKeyboard(rowButton(page, name, 'Edit'));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Default value').fill('5.37');
    await deleteElsewhere(page, name);
    fail.value = true;
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: `${name} no longer exists.` })).toBeVisible();
    await expectStandardLine(page, PROCESS_LOAD_ERROR);
    await expect(page.getByRole('status').filter({ hasText: AUDIT })).toHaveCount(0);
    expect(fail.reads).toBeGreaterThan(0);
    await expectNoAxeViolations(page);
  });

  test('P5 Delete of a rate deleted elsewhere (information), then the read fails: the standard line', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    const fail = await failList(page, '/api/v1/process-items');
    await pressWithKeyboard(rowButton(page, name, 'Delete'));
    const alert = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    await deleteElsewhere(page, name);
    fail.value = true;
    await alert.getByRole('button', { name: 'Delete rate' }).click();
    await expect(page.getByRole('status').filter({ hasText: `${name} was already deleted.` })).toBeVisible();
    await expectStandardLine(page, PROCESS_LOAD_ERROR);
    expect(fail.reads).toBeGreaterThan(0);
    await expectNoAxeViolations(page);
  });

  test('P6 Delete refused because a formula began to use the rate (409), then the read fails: the standard line', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    const fail = await failList(page, '/api/v1/process-items');
    await page.route('**/api/v1/process-items/*', (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({
            status: 409,
            contentType: 'application/problem+json',
            body: JSON.stringify({ status: 409, code: 'PROCESS_ITEM_IN_USE', title: `${name} cannot be deleted while a formula uses it`, usedBy: [{ letter: 'AL', label: 'Cutting Cost' }] }),
          })
        : route.continue(),
    );
    await pressWithKeyboard(rowButton(page, name, 'Delete'));
    const alert = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    fail.value = true;
    await alert.getByRole('button', { name: 'Delete rate' }).click();
    const refusal = page.getByRole('alertdialog', { name: 'This rate is used by a formula' });
    await expect(refusal).toBeVisible();
    await expect.poll(() => fail.reads, { message: 'the list was read again behind the refusal and failed' }).toBeGreaterThan(0);
    await refusal.getByRole('button', { name: 'Close' }).click();
    await expect(refusal).toBeHidden();
    await expectStandardLine(page, PROCESS_LOAD_ERROR);
    await expect(page.getByRole('status').filter({ hasText: AUDIT }), 'no success notice is on the page').toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('P7 the first read cannot be made to fail (the list is server-rendered): recorded as not reachable', async ({ page }, testInfo) => {
    await page.route('**/api/v1/process-items', (route) => (route.request().method() === 'GET' ? route.fulfill(BUSY) : route.continue()));
    await page.goto('/masters/process');
    await expect(page.getByRole('heading', { level: 1, name: 'Process master' })).toBeVisible();
    const reachable = await page.getByRole('heading', { name: PROCESS_LOAD_ERROR }).waitFor({ timeout: 15_000 }).then(() => true, () => false);
    testInfo.annotations.push({ type: 'first read reachable', description: String(reachable) });
    expect(reachable, 'a page load carries the list with it, so no read can fail').toBe(false);
    await expect(page.locator('[data-item-id]:visible').first()).toBeVisible();
  });
});

test.describe('Materials tab (SCR-13): a save succeeded, then the read fails', () => {
  test('M1 Add: v0.23 sentence, notice stays, focus on the title, axe 0, Try again', async ({ page }, testInfo) => {
    const name = `QA-material-${testInfo.project.name}-r${testInfo.retry}-${Date.now().toString(36)}`;
    await openMaterials(page);
    const fail = await failList(page, '/api/v1/materials');
    await pressWithKeyboard(page.getByRole('button', { name: 'Add material' }));
    const dialog = page.getByRole('dialog', { name: 'Add material' });
    await dialog.getByLabel('Material in Drawing').fill(name);
    await dialog.getByLabel('Material Considered').fill('Invented brass');
    await dialog.getByLabel('Price per kg').fill('58.37');
    await dialog.getByLabel('Specific gravity').fill('7.37');
    await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('22.37');
    fail.value = true;
    const focusLog = await recordFocus(page);
    await dialog.getByRole('button', { name: 'Add material' }).click();
    await expect(dialog).toBeHidden();
    await expectSavedSentence(page, MATERIALS_LOAD_ERROR, `${name} was added. ${AUDIT}`, focusLog);
    console.log(`PAGETEXT ${testInfo.project.name} :: ${(await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 500)}`);
    expect(await horizontalOverflow(page), 'the page does not scroll sideways').toBe(0);
    await expectNoAxeViolations(page);
    await tryAgainFailsThenPasses(page, fail, MATERIALS_LOAD_ERROR, `${name} was added. ${AUDIT}`, name);
  });

  test('M2 Edit: v0.23 sentence, notice stays, focus on the title, Try again', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    const fail = await failList(page, '/api/v1/materials');
    await pressWithKeyboard(rowButton(page, name, 'Edit'));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('47.37');
    fail.value = true;
    const focusLog = await recordFocus(page);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expectSavedSentence(page, MATERIALS_LOAD_ERROR, `${name} saved. ${AUDIT}`, focusLog);
    await tryAgainFailsThenPasses(page, fail, MATERIALS_LOAD_ERROR, `${name} saved. ${AUDIT}`, name);
  });

  test('M3 the first read cannot be made to fail (the list is server-rendered): recorded as not reachable', async ({ page }, testInfo) => {
    await page.route('**/api/v1/materials', (route) => (route.request().method() === 'GET' ? route.fulfill(BUSY) : route.continue()));
    await page.goto('/masters/materials');
    await expect(page.getByRole('heading', { level: 1, name: 'Materials and lists' })).toBeVisible();
    const reachable = await page.getByRole('heading', { name: MATERIALS_LOAD_ERROR }).waitFor({ timeout: 15_000 }).then(() => true, () => false);
    testInfo.annotations.push({ type: 'first read reachable', description: String(reachable) });
    expect(reachable, 'a page load carries the list with it, so no read can fail').toBe(false);
    await expect(page.locator('[data-item-id]:visible').first()).toBeVisible();
  });
});

test.describe('Treatment / Color tab (SCR-13): its sentence is unchanged', () => {
  test('T1 Add, then the read fails: the same sentence, the same title, no "Nothing was changed."', async ({ page }, testInfo) => {
    const name = newTreatmentName(testInfo);
    await openTreatments(page);
    const fail = await failList(page, '/api/v1/treatments');
    await pressWithKeyboard(page.getByRole('button', { name: 'Add treatment' }));
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    await dialog.getByLabel('Name').fill(name);
    fail.value = true;
    const focusLog = await recordFocus(page);
    await dialog.getByRole('button', { name: 'Add treatment' }).click();
    await expect(dialog).toBeHidden();
    await expectSavedSentence(page, TREATMENT_LOAD_ERROR, `${name} was added.`, focusLog);
    await expectNoAxeViolations(page);
  });
});

```
