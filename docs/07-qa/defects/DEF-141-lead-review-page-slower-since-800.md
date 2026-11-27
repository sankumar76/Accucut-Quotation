# DEF-141: the Lead's review page (/estimates/[code]) tests run about 30 % slower since #800 (shard 3); product (performance) suspected, not shown; provisional Sev-3 (DL-451; Jira AQP-498, GitHub #825)

| Field | Value |
|-------|-------|
| Story / AC | NFR-009 (LCP at most 2 s and TBT at most 200 ms on the stated Lighthouse profile; first load) and NFR-010 (page data within 500 ms at 25 concurrent users) on the Lead's review page `/estimates/[code]`; #800 (AQP-488, DEF-131 stage 1) as the first slow reading; AQP-478 (DEF-121, #819) on the same page; RISK-031 |
| Severity | **Provisional Sev-3 (master, DL-451 (A)); graded on a profile by the end of Sat 28 Nov 2026:** **Sev-2 and a G8 blocker** (section 9 (3)) if the page breaches NFR-009 or NFR-010 at the measured head where 7753cdff met it; **Sev-3** if it meets both but is measurably slower (fixed in the hardening window if the cause is local: a repeated query, an extra round trip, a blocking client call; otherwise named in the G8 recommendation with its numbers); **closed as no product defect** only if the profile shows no difference between 7753cdff and 2e11c44d (then master rules on the E2E gap the same day) |
| Priority | P3 (Jira Medium; labels `sev-3`, `performance`, `final-review`) |
| Type | **Product (performance): a product cause is suspected, not shown** |
| Status | **Open, 2026-11-27 (qa-engineer, DL-451).** Investigation: a developer lane (the orchestrator assigns; #800's author preferred), by the end of **Sat 28 Nov**. |
| Jira / GitHub | [AQP-498](https://sankumar76.atlassian.net/browse/AQP-498) / [#825](https://github.com/sankumar76/Accucut-Quotation/issues/825) (labels bug, sev-3, ai-delivery; Jira also aiid-DEF-141, agent-qa-engineer, performance, final-review); linked 'relates to' AQP-488 (#800) and AQP-478 (#819); RISK-031 named in the body. Searched first: JQL on `aiid-DEF-141`: nothing earlier. |
| Found by / date | qa-engineer, 2026-11-27, in the DL-450 cause step (test plan 0.3.115, records-u cdf0933b); ruled by master in DL-451 (records-u 97e477d6) |
| Build / commit | CI logs of #800's run of record 45922705204 (`6aa4dfbd`), `master` `2e11c44d`, `1b30b17f`, `73143e7e`, #812's run 45945851576, and 16 earlier shard-3 logs; the reference `31015cce` (CI 45387878703) |
| Environment | CI, Stage 12 shard 3 of 4 ([desktop] and [tablet]; shard 3 has no [mobile] tests) |

## The finding (QA's cause step, from existing logs)
The same **68 spec files and 591 to 593 tests** are in shard 3 on all 21 logs read, so the shard's make-up is ruled out. The **18 'Lead-page' spec files** (those that open the Lead's review, approval, cost, export or customer pages: `approve`, `approve-override`, `cancel-approval`, `cost-details`, `estimate-cleared`, `estimate-review`, `estimate-customer`, `export`, `export-warning`, `ignore-restore`, `lead-warning`, `remove-price`, `review-download`, `rates-changed`, `mark-quoted`, `unlock`, `download-marker`, `reassign-task`; 97 matched tests) against the rest (280 to 313 matched tests), matched by project, file and title, median ratio against `31015cce`:
| Run | Lead-page files | Rest | Lead / rest |
|-----|----------------:|-----:|------------:|
| `c30b349f` | 1.20 | 1.12 | 1.07 |
| `0cce6691` | 1.22 | 1.17 | 1.04 |
| `69ba8d98` (#789) | 0.96 | 0.96 | 1.00 |
| `d5e352f9` (#807) | 1.02 | 0.95 | 1.07 |
| `7753cdff` (#805) | 1.00 | 0.93 | 1.08 |
| the 11 older logs | 0.96 to 1.28 | 0.93 to 1.17 | 1.00 to 1.09 |
| **#800's run of record (`6aa4dfbd`)** | **1.83** | 1.42 | **1.29** |
| **`2e11c44d` (#800's squash)** | **1.33** | 0.98 | **1.36** |
| `1b30b17f` | 1.89 | 1.39 | 1.36 |
| `73143e7e` | 1.99 | 1.42 | 1.40 |
| #812's run 45945851576 | 2.08 | 1.52 | 1.37 |
**The adjacent pair at near-equal machine speed, `2e11c44d` against `7753cdff` (shard 3 at 1.03 and 0.95): Lead-page files 1.30 ([desktop] 1.21, [tablet] 1.37; n103) against the rest 1.04 (n296); the 15 Lead-page files #800 did not edit alone: 1.29 against 1.04.** Controls: `7753cdff` against `d5e352f9` 0.98 / 1.00, against `c30b349f` 0.83 / 0.84 (no gap). **Per file, `2e11c44d` against `7753cdff`:** unlock 1.61, rates-changed 1.52, approve-override 1.45, review-download 1.43, lead-warning 1.43, estimate-cleared 1.40, mark-quoted 1.29, cancel-approval 1.26, remove-price 1.24; **cost-details 0.85** (the cost page is not slower); audit 0.89. #800 edited only `estimate-review.spec.ts`, `ignore-restore.spec.ts` and `lead-warning.spec.ts`; the slowed files it did not edit, but it changed the pages they open: `src/app/(portal)/estimates/[code]/page.tsx` (+11/-), `review-page.tsx` and the Lead's inputs block and tree (27 files, +1,096 -164). **Time-outs** gather in shard 3's last minutes: #800's run of record 3 at minute 18, `73143e7e` 10 at minute 19, #812's run 17 at minute 20; none on the 11 older logs, `2e11c44d` or `1b30b17f`. **0 'Error: aborted' lines in shard 3** on every log (4 to 16 in the other shards, unchanged). **It shows on a fast draw** (`2e11c44d`: the rest at 0.98, the Lead-page files at 1.33) and adds to the machine's slowness on slow draws. **Cases affected:** `approve.spec.ts:312` (near-budget watch), `approve-override.spec.ts:314` (DEF-140), `unlock.spec.ts:204`, `cost-details.spec.ts:297`, `estimate-cleared.spec.ts:82` and `:153`.

## Caveats
The 18-file grouping is QA's own. The `31015cce` baseline is old, which is why the adjacent-run control matters. Shard 3 has no [mobile] tests. **Nothing was profiled: an E2E duration is not an NFR measure.** Tests that gained assertions (#789, #800, #818, #819) add some time, which does not explain the files #800 did not edit.

## Investigation (DL-451 (3); developer; by the end of Sat 28 Nov)
Locally, on a throwaway database with invented data, using a **production build**, at `7753cdff`, `2e11c44d` and current `master`, as a Lead on one Draft, one Prepared and one Approved estimate of the same invented tree: **(i)** the server time of `GET /estimates/[code]` (median and p95 of 20 requests after 3 warm-ups) and the same at 25 concurrent requests (NFR-010); **(ii)** database queries and server calls per render (count and total time, from the ORM's query log); **(iii)** the requests the page makes after hydration (count; any that block the first paint or the action buttons); **(iv)** one Lighthouse reading on NFR-009's mobile profile per commit, plus the existing nightly Lighthouse results for the page if it is in them (read only). No test, budget or CI change, nothing committed; the probe stays local and is reported here with the machine recorded. Heavy browser suites stay in CI (section 9 (5)); one Lighthouse run per commit is allowed.

## Fix and proof
The fix is a **product change on the Lead's approval page**, so it gets **one combined security-and-quality review before merge (section 9 (2)) with the performance lens on the measured numbers**; the solution-architect joins only if it changes the data-loading pattern. Proof: (i) to (iv) at the fix head back within **10 %** of `7753cdff`, or within the NFRs if #800's new content truly needs the time (master's call on the numbers). DEF-140 is re-read after the fix.

## Holds and rules in force (DL-451)
**#824 (the DEF-140 split) is held** until the profile is graded (it would take away the only CI signal before the regression is measured); if no product cause is found it merges when fully green; if one is found DEF-140 is re-read after the fix and the split merges only if `:314` still reads 25 s or more at a normal draw. **#806 and #811 do not merge before the profile is on record or the end of Sat 28 Nov, whichever comes first;** each then merges only fully green at 0 behind (DL-436), with the profile's (i) and (ii) at its head against `master` in the PR body; a head that worsens (i) by more than 10 % or adds round trips per render comes to master before merge. **R19 and DL-450 (A) stay** until the fix is on `master` and graded (at the latest G8).

## Fix & Verification  _(developer / reviewers / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Profile (i) to (iv) at 7753cdff, 2e11c44d, master | developer | | |
| Graded (Sev-2 / Sev-3 / closed) | master | | |
| Fix | developer | | |
| Combined review with the performance lens | reviewers | | |
| Profile at the fix head within 10 % of 7753cdff | developer, QA reads | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-498 and GitHub issue #825, created 2026-11-27 and cross-linked (Jira linked to AQP-488 and AQP-478). DL-450 (2), DL-451; test plan 0.3.116. Related: DEF-140 (the `:314` split, #824 held), `approve.spec.ts:312` (watch), RISK-031.
