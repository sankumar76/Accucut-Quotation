# Review Report — PR #819 (AQP-478 / DEF-121: the SCR-08 approval dialog's title code, lead-in, rows and price hint) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review, CLAUDE.md §9 item 2: an approval action) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-478-approve-dialog` (draft PR [#819](https://github.com/sankumar76/Accucut-Quotation/pull/819)), 1 commit, 0 behind `master` `2e11c44d` |
| Commit reviewed | `e86d29ef` (CI run 45928599850) |
| PR review | [review 6082815661](https://github.com/sankumar76/Accucut-Quotation/pull/819#pullrequestreview-6082815661) (COMMENT, single-token; 2 inline comments; label `review:quality-changes-requested`) |
| Date | 2026-11-26 |
| Reviewed against | DEF-121 (`docs/07-qa/defects/DEF-121-scr08-approval-dialog-title-lead-in-rows-and-hint.md`), ruling C-08-01 (`docs/03-ux/rulings/conformance-check-2026-11-28.md:93`), mock-up `docs/03-ux/screens/SCR-08.html:63-73`; ADR-016; `docs/standards/coding-standards.md` §1, §6, §10; CLAUDE.md (shadcn/ui, reusable components) |
| **Verdict** | **REQUEST CHANGES. Merge stop: one Blocker (QLT-819-01).** The extended E2E case cannot pass: two regular expressions lost their backslashes. CI shard 3 fails at `approve.spec.ts:233` on desktop, on the first run and on retry. The product change is right: the approval behaviour is unchanged, NFR-002 holds, the customer is escaped, and Stage 11b is +16 B |

## Summary

**The product code is right.** The diff touches only words and display:
- the heading `dialogTitle(code)`;
- a new server-safe `ApproveSummary` (the lead-in `<p id="approve-lead-in">` and a `<dl>` with "Calculated total (BL)" and "Customer");
- the `PRICE_HINT` on the price field;
- three new props passed through `approveOffer`, `ApproveControl` and `ApproveButton`.

`useApproval`, the request (`approveEstimate(estimateId, { calculationId, price, reason? })`), the override and reason rules, the refusal phases (TOTALS_OUT_OF_DATE, CALCULATION_CHANGED, refused, unconfirmed), the in-flight lock and focus handling are **byte-for-byte unchanged**. Every word matches the SCR-08 mock-up and C-08-01.

**The Blocker (QLT-819-01).** At `tests/e2e/approve.spec.ts:233` both regular expressions lost their backslashes:
- `/^Calculated total (B[A-Z])$/` is a group, so it requires "Calculated total BL" with no parentheses;
- `/^₹ [d,]+.d{2}$/` matches a literal "d".

Neither can match the real text ("Calculated total (BL)", "₹ 12,951.53"); I checked both in Node. CI shard 3 (job 140275744261) fails at line 233: "element(s) not found", after the 15 s expect timeout, then again on retry. The assertions before it (heading, accessible description) **pass**, which also confirms the accessibility wiring in a real browser.

| Severity | Count |
|----------|-------|
| Blocker | 1 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 4 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Diff | `git diff origin/master...e86d29ef` (10 files); full read of `approve-dialog.tsx` at the head | Words and display only. `useApproval`, `Alerts`, `refusalPhase`, the payload and the in-flight lock are unchanged |
| Wording against the design | `SCR-08.html:63-73`; ruling C-08-01; DEF-121 | Lead-in, "Calculated total (BL)", "Customer", the hint and "Approve and lock <code>" match word for word |
| Who can open the dialog (NFR-002) | `route-manifest.ts:313` (`/api/v1/estimates/[id]/approve` `ADMIN_AND_LEAD`); `estimates/[code]/page.tsx` role switch with `assertNever` | The Engineer branch gets the workspace, never `EstimateReview`, so it gets no `ApproveOffer` and no figure in its RSC payload. The dialog chunk holds words and code, no data. The customer name is not Restricted (shown read-only to every role, CR-01 item 6) |
| Unit and architecture tests | CI run 45928599850, Stages 1 to 11b (job 140275743901) | **pass**: `approve-summary.test.ts (9 tests)`, `estimate-review-architecture.test.ts (24 tests)` |
| Stage 11b `/estimates/[code]` (ceiling 193,500 B) | same job; master `2e11c44d` job 140265813467 | **192,558 B**, against master's 192,542 B: **+16 B**, 942 B under 193,500 B. `approve-summary.tsx` sits in the dialog's bare `import()` chunk |
| E2E | job logs of run 45928599850 | **Shard 3 fails**: `[desktop] approve.spec.ts:225` failed twice (line 233). The other shards were still running when this was written; the same line fails at every width |
| AC-1 case against its 30 s budget | latest green master run, the three widths | 8.3, 8.4 and 9.8 s on master. The six new assertions take well under a second when they pass, so about 9 to 11 s after the fix, far from 30 s. As written, line 233 waits the full 15 s expect timeout and fails |
| Escaping | unit test (`renderToStaticMarkup` with `<img src=x onerror=alert(1)>`); the code is a React text child | escaped (`&lt;img …&gt;`), never `dangerouslySetInnerHTML` |
| Person ledger | diff | no new person-making call: the case reuses `openedAsLead`, **+0** |
| Secrets | diff | none; invented names and numbers |

## Findings

| ID | Severity | File:line | Issue | Why (impact) | Fix | Test |
|----|----------|-----------|-------|--------------|-----|------|
| QLT-819-01 | **Blocker** | `tests/e2e/approve.spec.ts:233` | Both regular expressions lost their backslashes: `hasText: /^Calculated total (B[A-Z])$/` (the parentheses are a group) and `toHaveText(/^₹ [d,]+.d{2}$/)` (a literal `d`). Neither can match | A broken required test: CI shard 3 fails (desktop, twice), and the other widths fail at the same line. The PR cannot merge | `hasText: /^Calculated total \(B[A-Z]\)$/` and `toHaveText(/^₹ [\d,]+\.\d{2}$/)`. Also escape the dots on line 236 (`/Starts as the calculated total\. Edit it…\./`), or pass the exact string | The case is green at the three widths |
| QLT-819-02 | Minor | `approve-summary.tsx:24`; `approve-dialog.tsx:279` | The description is a plain `<p id="approve-lead-in">` with a hard-coded id handed to `DialogContent aria-describedby`, not the shadcn/Radix `DialogDescription`, which wires the id itself; the project's own `components/ui/dialog.tsx:32` says "give it a `DialogDescription`" | CLAUDE.md asks for shadcn/ui components. A fixed id can collide if a second dialog ever uses the summary. It works (E2E line 232 passes) | Render the lead-in as `<DialogDescription className="text-body text-ink">{LEAD_IN}</DialogDescription>` (from `@/components/ui/dialog`) and drop `aria-describedby={LEAD_IN_ID}` and `LEAD_IN_ID` | E2E line 232 stays green |
| QLT-819-03 | Info | `approve-summary.tsx:31` | `cn('…')` with one static string does nothing | none | a plain `className` | n/a |
| QLT-819-04 | Info | `tests/unit/approve-summary.test.ts:72` | `as unknown as Parameters<typeof approveOffer>[1]`: coding standards §10 ask for no `as` casts to silence the compiler | Test-only | a typed fixture builder (`costsOf` already exists in `estimate-review-rates-screen.test.ts`) | n/a |
| QLT-819-05 | Info | `approve.spec.ts:234` | `not.toBeEmpty()` on the Customer row passes for "Not set" too, so it does not show the right customer is drawn | Weak but not wrong | `toHaveText(<the customer the fixture sets>)` | n/a |
| SEC-819-01 | Info | as in "Checks Run" | **Approval behaviour and NFR-002 hold.** The payload, the override and reason rules, the 409 phases, the unconfirmed state and the in-flight lock are unchanged; there is no step-up on approve as built (ADR-009), and none is added. The approve route is `ADMIN_AND_LEAD`. The Engineer branch never renders the review. The BL shown is the figure the Lead's page already shows. The dialog chunk carries no data | none | none | n/a |

## The brief's seven points

| # | Point | Result |
|---|---|---|
| 1 | Approval behaviour unchanged | **Yes** (SEC-819-01) |
| 2 | No figure or customer data to an Engineer; server gating | **Yes**: route `ADMIN_AND_LEAD`; the page's role switch gives the Engineer the workspace only |
| 3 | Customer escaped as text | **Yes** (React text child; unit test) |
| 4 | Accessibility: description, heading, focus | **Yes in CI**: E2E lines 231-232 pass (the heading "Approve and lock <code>", the dialog's accessible description); the focus assertion is unchanged. QLT-819-02 for the component choice |
| 5 | Lazy loading and first load | **Yes**: the button still has a type-only import and a bare `import('./approve-dialog')`, and the guard now also forbids a runtime import of `approve-summary` (24 architecture tests pass). Stage 11b is 192,558 B (+16 B) ≤ 193,500 B |
| 6 | Tests: 9 units; the E2E against 30 s; +0 persons | Units **pass**. The E2E **fails** (QLT-819-01); after the fix it is about 9 to 11 s against 30 s. +0 persons |
| 7 | Quality | QLT-819-02 to -05 |

## Issues for other roles

- **developer:** fix the two regular expressions (QLT-819-01), then re-run CI; QLT-819-02 while there.
- **orchestrator:** do not merge until all three widths of `approve.spec.ts:225` are green.
