# Final delta review (§9 item 3, DL-354): consolidated findings

| Item | Value |
|---|---|
| Range reviewed | `242c21f7..1fe1581b` (H = master after #663; 246 files under `src/`, `prisma/`, `scripts/`, `.github/`) |
| Reports | `standards.md` (reviewer-standards), `quality.md` (reviewer-quality), `performance.md` (reviewer-performance); QA's product-wide pass is in `docs/07-qa/final-review-cr01.md` (in progress) |
| CI on H | Push run 45303206514: every job `success`, 0 flaky |
| Verdicts | standards APPROVE WITH COMMENTS; quality APPROVE WITH COMMENTS; **performance REQUEST CHANGES (one new Major)** |
| Compiled by | orchestrator, 2026-11-23 (the only review document the orchestrator authors) |

## Counts (new in this delta / carried open from the 242c21f7 review)

| Severity | Standards | Quality | Performance | Total new |
|---|---|---|---|---|
| Blocker | 0 / 0 | 0 / 0 | 0 / 0 | **0** |
| Critical | 0 / 0 | 0 / 0 | 0 / 0 | **0** |
| Major | 0 / 1 (STD-F-03, waived DL-298 (6)) | 0 / 0 | 1 (PRF-C-01) / 1 (PRF-F-04) | **1** |
| Minor | 4 / 10 | 3 / 7 (QLT-F-02 to F-08) + 3 CR-01 story Minors | 2 / 7 | 9 |
| Info | 6 / 3 | 5 | 4 / 2 | 15 |

## Blocker, Critical and Major (fix in the hardening window or the delivery lead's own waiver; DL-354 (3))

| ID | Severity | Where (at H) | Finding | Route |
|---|---|---|---|---|
| PRF-C-01 | **Major (new)** — Critical if the first nightly on H reads Workspace TBT > 200 ms | Parts tree (`PartsTreeList` / row toolbar Move up/down targets; since #656) | Each render scans the whole node list twice per row: O(n²). Benchmark ≈ 40 ms per render at 500 parts, ≈ 0.5 s at the 2,000-part cap (Node 24, this PC); ≈ 160 ms per render at 500 parts on the NFR-009 4× CPU profile → Workspace TBT may reach 160–230 ms vs the 200 ms limit. Estimate, not a measurement: no nightly has run on H yet. Absorbs PRF-F-07 (TreeNode not memoised) | GitHub **#665**. Fix ≈ 10 lines (pass each row's index from `PartsTreeList` instead of rescanning), with a unit test; takes the next free lane (DL-354 (5)); proof: the first nightly Lighthouse on the fix head reads Workspace TBT under 200 ms |
| PRF-F-04 | Major (carried) | 500-node export | Timeout and heap flag are in; the target-host reading is still not recorded | GitHub **#575**; closes with G8-C-NFR10 (b) (QA on the rehearsal machine after the freeze, DL-311) |
| STD-F-03 | Major (carried, **waived**, DL-298 (6)) | Function-size rule (40 lines) | Grown: 157 → 175 functions over 40 lines; largest 379 → 411; `usePartsTree` 132 → 247 | GitHub **#577**; listed at G8 as a waived Major (master's G8 review re-reads the growth) |

## Minor (D7 list at G8, each with a GitHub follow-up; fixed in idle lanes only, DL-354 (3))

**New in this delta**
- STD-C-01 seven copies of one dialog-button skeleton (Ignore, Restore, Mark as quoted add three).
- STD-C-02 `rfq` missing from the password rule's `PRODUCT_WORDS` after the RFQ Portal rename (**product-manager question**: an auth change to approve?).
- STD-C-03 CSP literal in `file-response.ts:40` duplicates and differs from `API_CONTENT_SECURITY_POLICY`.
- STD-C-04 the sweep's TLS front listens on all interfaces (`scripts/lib/tls-front.ts:80`).
- QLT-C-01 `/estimates/<code>/export` for an Ignored estimate shows a "Try again" that can never work (409 falls through to the error page; `export/page.tsx:40-45`).
- QLT-C-02 a Quoted estimate's Engineer page says "Approved and locked." beside a "Quoted" badge (`estimate-workspace.tsx:154-159`).
- QLT-C-03 `approval.unlocked` audit entry does not record whether the estimate was Approved or Quoted (`unlock-service.ts:144-151`).
- PRF-C-02 first-load headroom under DL-073's 10,000 B floor on `/queue` (6,873 B) and `/masters/materials` (8,553 B); no NFR breached (`/queue` LCP 294 ms, TBT 3 ms) — master to record the floor as not met.
- PRF-C-03 download-marker query plan not verified (`download-repository.ts:84-96`).

**Carried from the 242c21f7 review (still open at H)**: STD-F-04 to STD-F-13 (four grown: file size, failure-expression copies, unused exports, long lines; STD-F-12 branches 70 → 120), QLT-F-02 to QLT-F-08 (still without GitHub issues — DL-312 needs them), PRF-F-08 to PRF-F-12; CR-01 story Minors still open: AQP-403 QLT-01 (move refusal order not pinned), AQP-403 QLT-04 (five rollback notes lack the `_prisma_migrations` step; #627), AQP-405 QLT-05 (`treeActionsOffered` unused); D7 item #645 (QLT-01 of AQP-411).

## Info and questions

- Product-manager questions: QLT-C-04 (a download already being built when the estimate is ignored still hands over the file and logs it — acceptable?), QLT-C-05 (restoring a task more than 24 h after its deadline never sends the overdue e-mail — intended?), STD-C-02 (`rfq` in the password rule), STD-C-06 (do Windows service names and READMEs fall under CR-01 item 2's rename?).
- QLT-C-06 the "Engineer sees Ignored tasks" switch is half wired (no effect today: always on).
- Fixed since 242c21f7: STD-F-01 (#583), STD-F-02 (#581, #590 — recommend closing #576 after the install rehearsal's C1 to C10), STD-F-14, QLT-F-01 (#578 via #586), PRF-F-05 (#568 via #589), PRF-F-06 (#410 via #590); PRF-F-01 (#573) resolved by measurement.
- Process: the GitHub label `final-review` was missing; the orchestrator created it on 2026-11-23.

## Next steps (orchestrator)

1. PRF-C-01 (#665) to the next free developer lane; fix PR on fully green CI; QA reads the first nightly on the fix head.
2. Open the D7 GitHub follow-ups for the Minors that have none (QLT-F-02 to F-08, the new STD-C-01..04, QLT-C-01..03, PRF-C-02/03, the CR-01 story Minors).
3. Route the four product-manager questions.
4. Master logs the final-review verdict once QA's product-wide pass is in.
