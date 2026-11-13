# DEF-033: "Try again" on a page-level load error does not read again once the server read works again (Customers and Process master)

| Field | Value |
|-------|-------|
| Story / AC | Found in the G7 of AQP-142 (STORY-02.02, PR #297) / no AC of AQP-142 fails; ux-spec section 6.0 "Error (load)" and the comments in the `error.tsx` files ("Try again asks the server again") |
| Severity | **Sev-3 Moderate** (workaround: reload the page). Test plan section 6 |
| Priority | P3 (Jira Medium). Fixed before G8 or accepted by master in writing |
| Type | Product, **pre-existing** (Process master on `master` shows it; not caused by AQP-142) |
| Status | New. Routed by master in DL-192: a separate `fix/AQP-287-<slug>` PR from `master` **after #297 merges**, every error boundary, reviewed by reviewer-quality and reviewer-standards, **due before G8**. Not part of round F2 |
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
| Fixed | developer | | `fix/AQP-287-<slug>` after #297 merges |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## Severity history and routing
- QA: Sev-3, pre-existing, not held against AQP-142.
- Master, DL-192 (Jira AQP-142 comment 11711): DEF-033 goes to a separate PR from `master` after #297 merges, every error boundary, quality and standards reviews, due before G8.
