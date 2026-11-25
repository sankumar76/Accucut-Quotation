# DEF-033: "Try again" on a page-level load error does not read again once the server read works again (Customers and Process master)

| Field | Value |
|-------|-------|
| Story / AC | Found in the G7 of AQP-142 (STORY-02.02, PR #297) / no AC of AQP-142 fails; ux-spec section 6.0 "Error (load)" and the comments in the `error.tsx` files ("Try again asks the server again") |
| Severity | **Sev-3 Moderate** (workaround: reload the page). Test plan section 6 |
| Priority | P3 (Jira Medium). Fixed before G8 or accepted by master in writing |
| Type | Product, **pre-existing** (Process master on `master` shows it; not caused by AQP-142) |
| Status | **CLOSED 2026-11-24 (qa-engineer)**: fixed by PR #668 (squashed as `1ab13781`, AQP-287), verified in a real browser and on the push runs (Closure below). Earlier: New, routed by master in DL-192 to a separate `fix/AQP-287-<slug>` PR after #297, due before G8 |
| Jira / GitHub | [AQP-287](https://sankumar76.atlassian.net/browse/AQP-287) / [#345](https://github.com/sankumar76/Accucut-Quotation/issues/345); relates to AQP-142 |
| Found by / date | qa-engineer, exploratory session in the G7 of AQP-142, 2026-11-12 |
| Build / commit | H1 `cb95102` (report at H2 `f269b05`); the Process master part is `master` `3f22672` code |
| Environment | Windows 11, Node v24.19.0, Playwright Chromium at 360x800, 768x1024 and 1366x768, production build of H1, throwaway PostgreSQL 17; invented data only |

## Steps to Reproduce
1. As the Admin, open `/masters/customers/{id}` (and, separately, `/masters/customers` and `/masters/process`) so the session is warm.
2. Make the page's own server read fail: QA withdrew `SELECT` on the table (`customers`, `process_items`) from the application role in the throwaway database, then reloaded the page. The error state shows with focus on its title and a **Try again** button.
3. Give the permission back, so the read works again.
4. Press **Try again** and wait 3 seconds.

## Expected Result
"Try again" asks the server again and the page appears.

## Actual Result
The error state stays: the customer page, the Customers list and the Process master page, at 360, 768 and 1366 px (each measured with `recoveredByTryAgain` false). A browser reload shows each page at once. The boundaries pass Next's `reset` straight to the button; `reset` re-renders the boundary's children and does not request the server component again.

## Evidence
- QA series `aqp-142-qa.spec.ts` (local, not committed): `tryAgain` measurements for "case 5", "case 6", "list first read" and "process master comparison"; summarised in `docs/07-qa/AQP-142-test-report.md` (Exploratory Testing).
- Code: `src/app/(portal)/masters/customers/error.tsx`, `customers/[id]/error.tsx`, `process/error.tsx` (`onClick={reset}`); the same pattern is in `materials/error.tsx`, `users/error.tsx`, `audit/error.tsx` and `src/app/error.tsx` (not run).

## Suspected Area (optional)
The route-level `error.tsx` files: ask the router for a fresh read (for example `router.refresh()` inside a transition together with `reset`, as the Next.js documentation describes). One shared piece would serve all boundaries. Regression test: one E2E per kind of boundary, with the read failing and then working, asserting the page appears after Try again.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-23 | PR #668, squashed as `1ab13781` (`fix/AQP-287-try-again-rereads`): shared `useRetryRead` (router refresh, then reset); 15 `error.tsx` boundaries |
| Regression test added | developer | 2026-11-23 | `tests/unit/route-error-retry.test.ts` (one case per `error.tsx` found by a glob; 20 cases red on the old pages, green with the fix). No E2E case: a page whose server render fails cannot be made to fail from Playwright without a fault hook in product code |
| Verified | qa-engineer | 2026-11-24 | Closure below: real-browser reproduction on a build of `1ab13781` (12 of 12 pages recovered) and push runs CI 45319179466 and Windows package 45319179465 (attempt 1, success) |

## Severity history and routing
- QA: Sev-3, pre-existing, not held against AQP-142.
- Master, DL-192 (Jira AQP-142 comment 11711): DEF-033 goes to a separate PR from `master` after #297 merges, every error boundary, quality and standards reviews, due before G8.


## Closure (qa-engineer, 2026-11-24)
Master (DL-360, the DEF-033 note): the file asks for no ruling; QA closes it on its own verification (test plan section 6: "QA verifies a fix by rerunning the failing test and the regression around it, not by reading the diff"), against #668 and the push runs. DL-192 asked for reviews by reviewer-quality and reviewer-standards; CLAUDE.md section 9 item 1 and DL-354 (4) replace that request (error boundaries are in none of the section 9 item 2 areas), so the closure does not wait for a review.

| Check | Result | Evidence |
|-------|--------|----------|
| Push run CI on `master` `1ab13781` | **success**, attempt 1: Stages 1 to 11b, Stage 12 shards 1 to 4, Stages 1 to 11 all success | run 45319179466 (`gh run view`) |
| Push run Windows package on `1ab13781` | **success**, attempt 1: Stage 13 Windows package | run 45319179465 |
| Original reproduction, real browser | **Fixed**: SELECT withdrawn from the application role (owner role, throwaway PostgreSQL 17), page reloaded to the error state with its **Try again** button, SELECT given back, **Try again** pressed: the page appears (the Try again button is gone within 15 s) on Customers list, Process master, Materials and Audit log, at 1366, 768 and 360 px, **12 of 12** (`recoveredByTryAgain` true). A plain reload afterwards also shows each page. On the base (3f22672 code) the same steps measured `recoveredByTryAgain` false (see Actual Result) | `tests/e2e-qa/def033.qa.ts` (QA throwaway, build of `1ab13781`, `next dev` on Next 16.4.5 = the pin of DL-344); copy kept in `docs/07-qa/final-review-cr01-evidence/scripts/def033.qa.ts` |
| Unit regression | the PR's `tests/unit/route-error-retry.test.ts` ran in Stages 1 to 11 of run 45319179466 (success) | run 45319179466 |

Not run by QA: the other 11 boundaries (Settings, Users, Configuration fields, Tasks queue, Assign, Estimate, Cost details, Export, Checkpoints, Customer page, root page) in a real browser; they share the same `RouteLoadError` / `useRetryRead` piece and are covered by the PR's glob test. Dev server, not the production build, for the real-browser run.