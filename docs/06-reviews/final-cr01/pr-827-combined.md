# Review Report — PR #827 (AQP-498 / DEF-141: the Lead's review page gets its form data as server props) — Combined security and quality, performance lens

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance (the combined security-and-quality review of CLAUDE.md §9 item 2, required by DL-455 (c) with the performance lens; the solution-architect's review of the loading pattern is separate) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-498-lead-page-server-props` (PR [#827](https://github.com/sankumar76/Accucut-Quotation/pull/827)), from master `c83e57b0` |
| Commit reviewed | `90520f83` (the head at the time of writing; it did not move while I reviewed) |
| Date | 2026-11-27 |
| Reviewed against | DL-451, DL-452, DL-455; DEF-141 (Jira AQP-498, GitHub #825) and the profile on #825; PRD NFR-001, NFR-002, NFR-009, NFR-010; `docs/standards/coding-standards.md`; architecture data loading and role enforcement |
| GitHub review | [pullrequestreview-6085159574](https://github.com/sankumar76/Accucut-Quotation/pull/827#pullrequestreview-6085159574) (COMMENT, REVIEW_IDENTITY single-token), label `review:performance-approved` |
| **Verdict (at `90520f83`)** | **APPROVE WITH COMMENTS.** No Blocker or Critical open, so the §9 stop does not apply. **Two conditions before merge:** (1) PRF-827-01, a red unit test fixed by a one-line mock, so CI is fully green; (2) the proof table lands with measured numbers, and PRF-827-02 says (ii) is likely outside DL-455's 10 % band, which is master's to rule on those numbers |

## Summary

The design does what DL-455 (B) ordered. The Lead's page reads the four answers through the same services, as the same viewer, builds them with the same code and strict schemas as the four routes, and hands them over as a `seed`. The Engineer's page does not reach any of it. A read fault gives no seed, logs the kind only, and the form fetches as before. I found no way for an Engineer to receive a cost figure, and no role check is bypassed. Role enforcement stays on the server and no endpoint is added.

The risks are on the performance side, and they are mostly unmeasured. The reads did not disappear: they moved from four browser requests into the render, where the services' own statements remain (my estimate: 12 to 16 more on a 75-statement Prepared render), one of them (`getNode`) is O(n) in the tree and serial after `getCosts`, and all of it repeats on every `router.refresh()` and row press though the form uses it once. At 25 concurrent users on a pool of 10, that narrows the NFR-010 margin (estimate: about 375 to about 445 ms of 500) without, by my reading, breaching it. CI is red at Stage 6 on one unit test that needs a mock entry, so Stage 11b (the 193,500 B first-load figure) has not run.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 2 (PRF-827-01, PRF-827-02) |
| Minor | 4 (PRF-827-03, -04, -05, -06) |
| Info | 2 (PRF-827-07, -08) |

## Checks Run

| Check | Command / source | Result |
|-------|------------------|--------|
| PR head and delta | `gh pr view 827`; `git fetch`; `git rev-parse origin/fix/AQP-498-lead-page-server-props` | `90520f83`, unchanged during the review; 20 files, +551 −33 |
| Diff read in full | `gh pr diff 827` (976 lines) and the files in a read-only detached worktree at the head | done |
| Services behind the seed | `estimate-inputs.ts:201` (`getForm`), `estimate-service.ts:320-436` (`openForRead`, `configurationFor`, `viewReaders`, `getNode`), `estimate-review-service.ts:144` (`getCosts`), `masters-service.ts:271`, `treatment-service.ts:173`, `estimate-node-repository.ts` (`listNodes`), `prisma-client.ts` (`app` pool `max: 10`, `connectionTimeoutMillis` 5 s, statement time-out 10 s) | read |
| Governance inputs | DL-451, DL-452, DL-455, `DEF-141-lead-review-page-slower-since-800.md`, PRD NFR-001, -002, -009, -010 (`docs/02-product/prd.md` v0.65) | read |
| CI at the head | run 45962188465 | **Stages 1 to 11b: failed at Stage 6** (`tests/unit/cost-details-page.test.ts`: `No "getMastersService" export is defined on the "@/server/composition" mock`; 1 failed of 11,740; 541 of 542 files passed). Stages 7 to 11b did not run. E2E shards 1 to 4 still in progress when I wrote this |
| Unit, E2E, build, Lighthouse | not run by me | my worktree has no install, and heavy suites stay in CI (§9 (5)); no measurement of mine is claimed. Every figure below marked "estimate" is from reading the code |

## DL-455 conditions, read against the code

| DL-455 term | Result | Evidence |
|-------------|--------|----------|
| 2 (a) props from the same services, same role checks (NFR-001) | **Met** | `part-form-seed.ts` calls `getForm`, `getNode`, `listMaterialOptions`, `listTreatmentOptions` with the `viewer` that `page.tsx` took from `authorizePage('/estimates/[code]')`. `getForm` and `getNode` start with `openForRead` (`mayOpen`). `getCosts` has its own Lead/Admin allow-list with `assertNever`, in the same `Promise.all`. The two option lists take no viewer, as their routes do |
| 2 (a) same shapes, no added field | **Met** | `part-form-bodies.ts` is the one builder; the four routes now call it. The strict schemas fail closed on an extra key (a `ZodError` is caught, logged by name and code, no seed). The `PartFormSeed` wrapper adds `estimateId` and `partId` around the bodies, which are not body fields. `part-form-seed.test.ts` compares the four bodies with the four real routes, as JSON, for LEAD and ADMIN |
| 2 (a) the Engineer's path unchanged | **Met** | The ENGINEER branch of `page.tsx` is untouched and `renderReview` (so `readFormBodies`) is reached for LEAD and ADMIN only. In the shared hooks, no seed gives `seeded === null`, so the effects, the initial state and the fetches are the old ones; the only addition is an inert context provider around the form. `estimate-page.test.ts` pins that the Engineer's page has no seed and reads neither list. The four routes answer what they answered (same builders, same schemas; the node route already parsed twice) |
| 2 (a) NFR-002: every field of every seed body | **Met** | form: id, letter, label, kind, unit, hint, defaultValue, required, editable, nameKey, visibleWhen (field id and words), rule (a type, a limit, the registry's option words, or a field id). materials: id, name, materialConsidered. treatments: id, name. part: id, parentId, slNo, label, nodeKind, completeness, revision, `inputs` (field id and typed text, of fields of the form only, `visibleInputs`), `picture` (id, sanitised name, size; no bytes). No rate, cost, formula or customer rate is named by any schema. The seed reaches only the Lead and the Admin, who may see the inputs (FR-115) |
| 2 (a) role-matrix and strict-schema tests | **Met by construction; CI to confirm** | no route added or changed in what it answers; `tests/security` is stated green locally (2,814 tests). I did not see CI's security stage because Stage 6 stopped the job |
| 2 (b) fresh after `router.refresh()`, typed text kept | **Met, with a note (PRF-827-08)** | the page re-reads all four on every render; the hooks take the seed once per mount (`useState` initialiser), so a refresh does not wipe typed text (hook-level test) and the form's values are as fresh as when it fetched once at mount |
| 2 (b) tests change only where they mock removed fetches; nothing weakened | **Not quite (PRF-827-01)** | `estimate-page.test.ts`: one mock entry plus 3 cases; `hook-harness.ts`: additive `createContext` and `useContext`. No wait, budget or time-out changed, no assertion removed. But a second test file needs the same mock entry and is red, which contradicts the PR body's "the only edit to an existing test" |
| 2 (b) unit tests cover the props path | **Met** | `part-form-seed.test.ts` (parity with the routes, readers accept the bodies, strict schemas, a fault gives no seed and logs the kind only), `part-form-seeded-reads.test.ts` (three hooks: seeded start reads nothing; read again, a conflict, no seed, another estimate, another part and a refused body read from the server) |
| Error path: no seed, kind only, no personal data | **Met** | `logFault` logs `errorName` and `errorCode` and a fixed sentence; no id, no message, no estimate. The unit test asserts a host name in an error message is not logged |
| No extra round trips, no N+1 | **Met in kind, not in cost** | four service calls per render (one more serial round, `getNode`), none per row; the browser makes none. The cost of those reads is PRF-827-02, -03, -04 |
| First load at or under 193,500 B | **Not measured** | Stage 11b did not run (PRF-827-01). Estimate: +150 to 250 B gzip, headroom about 940 B (`ffd02f7d` read 192,557 B). PRF-827-07 |
| Proof tables meet DL-455's proof terms | **Not yet filed** | the PR body says "Filled in below when the passes finish". See "The proof, to be read against" |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-827-01 | Major | `review-page.tsx:10`; `tests/unit/cost-details-page.test.ts:25` (not in the diff) | §9 (1) fully green CI; DL-455 2 (b) | The new `getMastersService` import breaks a test that mocks `@/server/composition` without it: Stage 6 red (1 of 11,740). Stage 6 stops the job, so Stages 7 to 11b did not run. The PR body says `estimate-page.test.ts` is the only existing test edited and the full `tests/unit` was not run | No merge on red; no Stage 11b figure; the "only edit" claim in the PR body is wrong | Add `getMastersService: () => shared.mastersService` to that mock, say in the PR body that it is a mock of a new export and nothing is weakened, run `npx vitest run tests/unit` in full. A search of `tests/unit` found no other composition mock for this page lacking it |
| PRF-827-02 | Major | `review-page.tsx:61`; `estimate-inputs.ts:201`; `estimate-service.ts:429` | NFR-010; DL-455 proof (ii) | The reads moved onto the render path and their own statements stayed. Estimate: +12 to 16 statements on a 75-statement Prepared render (estimate access ×3, configuration basis and current version ×3 to 4, node list ×2, plus the lists and `lastWrittenAt`); a whole load about 100 to 106 against the 99 allowed by "within 10 % of 7753cdff's 90" | At 25 users on `app` pool `max: 10`, drain time 25 × statements × t / 10: at an assumed 2 ms a statement about 375 ms now, about 445 ms with the reads, of 500 (estimate). Proof (ii) likely misses by a few statements | Measure (ii) at the head, interleaved with 7753cdff. If above 99, master rules on the numbers, or cut the repeats without changing any body: one estimate-access read and one configuration basis shared across the three calls; give `getNode` the node list `getCosts` read. Do not cache the option lists (STORY-05.06 AC-3) |
| PRF-827-03 | Minor | `review-page.tsx:63`; `estimate-service.ts:430-435` | NFR-010 | `readPartBody` waits for `getCosts` (the row comes from `costs.nodes`), so one more round is serial on the first-paint path. `getNode` lists every node with its inputs, builds the whole tree and every view, and keeps one: O(n), straight after `getCosts` did the same listing | typical 50 nodes: a few ms (estimate). At 500 nodes: a second read of roughly 0.5 to 1 MB, each row parsed through `NODE_ROW`, about 10 to 30 ms of event-loop time per render (estimate), not overlapping across 25 renders. The profile used one-part trees | None for typical size. Add one invented 200- or 500-row tree to the proof and give (i) at the head against `master`; if more than 10 % worse, a follow-up passes `getNode` the records `getCosts` read, or adds a single-node read |
| PRF-827-04 | Minor | `use-form-definition.ts:25` (and `use-part-form.ts:93`, `use-treatment-options.ts:18`) | NFR-009, NFR-010 | The hooks read the seed once, but the server reads and sends all four bodies on every render: each `router.refresh()` (Recalculate, Approve, Unlock, …) and each `?row=` press, and the client ignores the first three | Each refresh pays PRF-827-02's statements again and an RSC payload of the form definition, both lists and the part (estimate 15 to 40 KB uncompressed, about 40 fields and a modest material list). The refresh follows every Lead action | None needed to merge. Put the RSC bytes of a refresh at the head against `master` in the proof. Follow-up: memoise the form's sections per configuration version (a version never changes; only `lastSavedAt` varies) |
| PRF-827-05 | Minor | `part-form-seed.ts:36`; `review-page.tsx:61` | NFR-010 | The seed's reads fan out beside `getCosts`: up to about 11 statements at once from one request (`getCosts` 4, `getForm` 2, each list 2, marker 1) against a pool of 10 and a 5 s connection time-out | Under saturation the optional reads can take connections from the essential `getCosts`, whose time-out is the page's 500; before, the four were separate requests that could fail alone | Acceptable at about 25 users. If the proof's 25-at-once figure degrades more than the statement count explains, read the seed after `getCosts`. Else name it in the G8 risks |
| PRF-827-06 | Minor | `tests/unit/part-form-seed.test.ts:79` | DL-455 proof (iii); DEF-141 | Nothing keeps the four browser reads from coming back. If a client reader (`toField`, hand-written) refuses a body the server builds, `seeded` is `null` and the form fetches again with no failing test. The case parses the harness's form only | DEF-141 can return silently; proof (iii) is a one-off profile | (a) Parse a body from the real registry (every field kind and rule type) with `parseForm`; (b) one assertion in an existing Lead-page spec that no request to `/form`, `/options/*` or `/nodes/` follows hydration (not a CI tooling change, §9 (4)) |
| PRF-827-07 | Info | `use-form-definition.ts:6`; `part-form.tsx`; `estimate-review.tsx` | NFR-009 (200 KB, ceiling 193,500 B) | The seed logic is in the first load of `/estimates/[code]`. No new function enters the bundle (`parseForm`, `parseMaterials` are existing readers renamed). Estimate +150 to 250 B gzip against about 940 B headroom | Not measured: Stage 11b did not run | The proof table gives the Stage 11b figure from a green run |
| PRF-827-08 | Info | `use-part-form.ts:93` | DL-455 2 (b) | Freshness holds as before, but "a refresh re-renders with new props" is true of the page, not of the form's values: the seed is start-only | Nothing is staler than on `master` | None for this PR. #806 will need to say which side wins after an Engineer's save since the page was drawn; the 409 path still reads from the server |

<details><summary>Detailed notes</summary>

### PRF-827-02: how the figures were reached (all estimates, labelled)
- **Statements per service, by reading the code.** `getForm`: `findEstimateAccess` (1), `findConfigurationBasis` (1) and the configuration (1 if the current version is read each time; the registry document is immutable), `lastWrittenAt` (1): 3 to 4. `listMaterialOptions` and `listTreatmentOptions`: 2 each. `getNode`: `findEstimateAccess` (1), `listNodes` (1), `viewReaders` (current version and basis, 2 to 3), `visibleInputs` (basis, 1 to 2), `pictureOf` (0 or 1): 5 to 8. Together 12 to 16. The page's own 75 do not include them.
- **What the browser reads carried that the server read does not repeat.** DL-455 gives 147 statements for a whole Prepared load against 90 at 7753cdff, of which the render is 75. The four reads are therefore 57, about 14 each, and the services' own share of that is about 12 to 16 in all; the rest is each API request's session and user lookups. Moving the reads to the server removes that rest and keeps the services' share. The whole load would be about 90 + 12 to 16 = 102 to 106.
- **Pool arithmetic.** `POOL_SETTINGS.app.max` is 10. If one statement takes t on the connection, 25 renders of S statements need 25 × S × t / 10 to drain. With t = 2 ms (an assumption for a local PostgreSQL on the target server), S = 75 gives 375 ms and S = 75 + 14 = 89 gives 445 ms. With t = 1.5 ms: 281 and 334 ms. The profile's laptop gave 0.7 to 1.3 s at every commit, baseline included, so it cannot settle t; this is why I ask for the head's (i) and (ii) on the same pass as 7753cdff.

### PRF-827-03: where the second node list is
`getCosts` (`estimate-review-service.ts:163`) calls `nodes.listNodes(estimateId)` inside its `Promise.all`; `getNode` (`estimate-service.ts:430`) calls it again, then `viewsOf` builds a view for every node to keep one. `NODE_SELECT` includes `inputs` (a JSON object per row, up to 200 entries of up to 1,000 characters by the schema bounds), each row parsed by `NODE_ROW`. `MAX_PARTS_PER_ESTIMATE` is 2,000; NFR-010 names 500 nodes as the largest estimate it excludes from the 500 ms line.

### What I did not find
- No N+1 per tree row, no unbounded result set added (the option lists were already unbounded in their routes), no missing timeout beyond the pool's own (statement 10 s, connection 5 s), no leak: the hooks add one state and no listener or timer.
- The route handlers now parse twice for form, materials and treatments (the builder, then `withRoute`'s output schema); the cost is microseconds for about 40 fields and is not worth a finding.
- Logging: no personal data; the fixed sentence differs by `what` only.

</details>

## The proof, to be read against (DL-455 (B) Proof; the PR body's section is still empty)

When the table lands I will read it against these terms, same machine and same pass as 7753cdff, interleaved so drift cancels:

| DL-455 term | What I will check |
|-------------|-------------------|
| (ii) statements per Prepared load within 10 % of 7753cdff's 90 (99 or fewer) | the count at the head, from the ORM log, with the render and the browser's share shown apart; PRF-827-02 expects 100 to 106 |
| (iii) no form-data reads after hydration | the list of every request after hydration, with start and end, shows none of the four; and no read to `/tree` |
| (iv) median TBT within 10 % of 7753cdff's in the same pass | medians of the same number of runs per commit as the profile (3 or more), not one run |
| (v) an action sent at hydration within 10 % of its idle time | median of 10, Recalculate and approve, at hydration and idle, at the head |
| Added by this review | (i) the page's server time at the head against 7753cdff and master, sequential and 25 at once (NFR-010); the same on one invented 200- or 500-row tree (PRF-827-03); RSC bytes of a refresh (PRF-827-04); the Stage 11b figure at a green head (PRF-827-07) |

Whether the 10 % band on (ii) is met is master's call on the numbers (DL-455 reserves such calls to master). If the reads' own statements keep it above 99, the options are in PRF-827-02.

## NFR impact

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-010 page data within 500 ms at 25 users (PROPOSED) | **Medium.** Margin narrows (estimate 375 to 445 ms of 500, pool of 10); not breached by my reading; cannot be graded on the profile machine | PRF-827-02, -03, -05 |
| NFR-009 LCP and TBT; 200 KB JS and the 193,500 B ceiling | **Low.** LCP met everywhere in the profile; TBT should fall with the four reads and their duplicated work gone (to be proven in (iv)); script growth small and unmeasured; HTML grows by the seed | PRF-827-07, -04 |
| NFR-001 roles enforced on the server | **None found** | — |
| NFR-002 no cost to an Engineer | **None found**; every field of the four bodies traced above | — |

## Issues for other roles
- **solution-architect (DL-455 (c)):** the loading pattern moves from a client fetch to server props, and the seed is start-only (PRF-827-08). Whether the architecture document needs the line is theirs to decide. PRF-827-04's follow-up (a memo of the form's sections per configuration version) is a service-level change and would be theirs to size.
- **qa-engineer:** DEF-141's grade stays on lane 2's profile. The "reads should not grow with rows" note in the profile is true of the browser's request count, not of `getNode`'s cost (PRF-827-03); QA may wish to add a many-row tree to the profile method for the DEF-141 closing read.
- **product-manager:** NFR-010 is still PROPOSED and this review used the stated 500 ms at 25 users with an assumed 2 ms a statement; the target server's real latency per statement is not in the PRD.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final-cr01/pr-827-combined.md`
- Jira / GitHub updates: PR #827 COMMENT review 6085159574 (8 inline comments, PRF-827-01 to -08), label `review:performance-approved`; Jira AQP-498 hand-off comment
- Open questions: none
- Risks raised: none new (NFR-010 margin noted under PRF-827-02 for master's G8 note if the proof confirms it)
- Recommended next agent: developer (lane 2): PRF-827-01 and the proof table; then master for the ruling on (ii); solution-architect for DL-455 (c)

---

# Round 2: delta review `90520f83..0793b7d5` (DL-457), security lens on the access check

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance (combined review, round 2; the security lens on the access check that DL-457 (b) asks for) |
| Commits reviewed | `7de1f97f` (ARC-827-01 reworded, the `cost-details-page.test.ts` mock, the PRF-827-06 guard) and `0793b7d5` (`EstimateService.getPartForm`, `EstimateInputs.formOf` and `visibleInputsOf`, `readListBodies` and `readPartFormBodies`). The head did not move while I reviewed |
| Date | 2026-11-27 |
| GitHub review | [pullrequestreview-6085500480](https://github.com/sankumar76/Accucut-Quotation/pull/827#pullrequestreview-6085500480) (COMMENT) |
| **Verdict (at `0793b7d5`)** | **APPROVE WITH COMMENTS.** Open after this round: **0 Blocker, 0 Critical, 0 Major, 3 Minor (PRF-827-03, -04, -09), 2 Info (PRF-827-06 (b), -08)**. Before merge: E2E shards 1 to 4 of run 45966127622 green (running when I wrote this), and the proof table filed in the PR body and read against DL-457's restated terms (the section still reads "Filled in below") |

## Security lens: `getPartForm` against `getForm` plus `getNode` (NFR-001, NFR-002)

Read: `estimate-service.ts:443-451`, `estimate-inputs.ts` (`formOf`, `visibleInputsOf`, `getForm`), and the code they replace (`openForRead`, `configurationFor`, `viewReaders`, `partIn`).

| Case | `getForm` + `getNode` | `getPartForm` | Same? |
|------|----------------------|---------------|-------|
| owner Engineer | `openForRead` (`findEstimateAccess`, `mayOpen`) allows | the same `openForRead` | Yes |
| another Engineer | `openForRead` throws `NotFoundError` before any other read | the same call, before the `Promise.all` | Yes |
| Lead, Admin | `mayOpen` true for any estimate | the same | Yes |
| unknown estimate | `findEstimateAccess` null: `NotFoundError` | the same | Yes |
| unknown part | `getForm` answers, `getNode` throws `NotFoundError` (`partIn`) | throws `NotFoundError` (`partIn`): as strict as `getNode` | Yes (the page then has no seed) |
| Draft, Prepared, Approved, Quoted, Ignored | no state check in either; the only use of state is `configurationFor` (a locked estimate keeps the registry it was approved with) | `viewReaders(id)` calls the same `configurationFor`; the form and the values are built from that one document | Yes |

- **No refused state to lose.** Neither replaced method refuses on state, so lane 2's "refused state" has nothing to preserve beyond the frozen-registry choice, which is shared code.
- **No field added.** `node` is `{...view, inputs, picture}` as in `getNode`; `form` is `formOf`, the same expression `getForm` used (`getForm` now returns through `formOf`: a refactor of an Engineer-reachable method with an identical result). The page still passes both through `formBody` and `nodeBody`, the routes' strict schemas. The NFR-002 trace from round 1 stands.
- **No new surface.** The only caller of `getPartForm` is `part-form-seed.ts`, reached from the Lead and Admin branch alone. No route changed, so the role-matrix has nothing new; `tests/security` is in the green step below.
- **Refusal before reads.** The three reads start after `openForRead` resolves, so a refused viewer causes no node or configuration read.
- **Canonical id.** `getPartForm` passes the estimate's own `id` to `viewReaders`, `lastWrittenAt` and `pictureOf`; `getNode` passed the caller's string. Lookups are by uuid, so this is the same or safer.

## Round-1 findings

| ID | Status | Note |
|----|--------|------|
| PRF-827-01 | **Fixed** | the mock is in; Stage 6 passes (543 files, 11,750 tests) |
| PRF-827-02 | **Closed by DL-457** | the combined read removes about 4 queries; master restated (ii') at `master`'s 147 and accepted the server-time remainder provisionally (DL-457 (C)). The NFR-010 reading on the reference machine stays with me (DL-455 (7) (b)) |
| PRF-827-03 | **Open, Minor** | still one serial round after `getCosts` and one more listing of the parts. Reported: statements equal at 1 and 53 rows; 118 against 97 ms on 53 rows (about +21 %). DL-457 wants 200 rows; I read it when the table lands |
| PRF-827-04 | **Open, Minor** | unchanged; a follow-up, not a merge condition |
| PRF-827-05 | **Resolved** | peak beside `getCosts` about 9 statements (was about 11 against a pool of 10) |
| PRF-827-06 | **Fixed in part** | (a) a case parses the real registry's form (over 30 fields, at least 5 rule types); (b) the "no reads after hydration" E2E assertion is not added: Info, as DL-457 (iii) is measured and the CI ratio decides |
| PRF-827-07 | **Resolved** | Stage 11b `/estimates/[code]` **192,818 B** gzip against the 193,500 B ceiling (headroom 682 B); `ffd02f7d` read 192,557 B, so +261 B (my estimate was 150 to 250) |
| PRF-827-08 | Info, unchanged | the seed is start-only |

## New finding

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-827-09 | Minor | `tests/unit/part-form-seed.test.ts:148` | NFR-001; DL-457 (b) | The equality cases do not cross every role with every state: the status loop runs for the Lead only (the owner Engineer and the Admin only in the default state); the Engineer's refusal is checked for another Engineer only. The frozen-registry branch is not reached: the fake's `findConfigurationBasis` (`tests/support/fake-estimates.ts:194`) returns a version id only when `currentCalculationId` is set, and the loop sets `status` alone | A difference by state would be hidden; I found none because the code is shared | Loop ENGINEER (owner), LEAD, ADMIN over the three statuses; add one Approved case with `currentCalculationId` and an older `configVersionId`, and assert `getPartForm` equals `getForm` and `getNode`. A unit test only |

## CI at `0793b7d5` (run 45966127622)

Stages 1 to 11b **passed**. Stage 6: 543 files, 11,750 tests. The unit, integration, security and acceptance step: 719 files, 17,631 tests (the role-matrix and strict-schema suites are in `tests/security`). Stage 11b JS budget: all 24 rows within limit; `/estimates/[code]` 192,818 B. E2E shards 1 to 4: in progress at the time of writing. I ran nothing locally.

## The proof, to be read against DL-457 (3)

(ii') statements per Prepared load at or below `master`'s 147, each added query listed by service and purpose, none per row; (iii) no read of `/form`, `/options/*` or `/nodes` after hydration, any state or row count; (iv') median TBT at or below `master`'s in the same pass; (v') 0 reads in flight at hydration and each action's delay at hydration no more than 7753cdff's plus 20 ms; server time (sequential median) within 20 % of `master`'s, or the remainder reported with its cause; the same at 1, 53 and 200 rows (PRF-827-03). Lane 2's pass 1, as relayed in DL-457, meets (iii) and (v'); the table in the PR body is what I will read.

## Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final-cr01/pr-827-combined.md` (round-2 section)
- Jira / GitHub updates: PR #827 COMMENT review 6085500480 (2 inline comments); Jira AQP-498 comment
- Open questions: none
- Risks raised: none new
- Recommended next agent: developer (lane 2) for the proof table and PRF-827-09; then master
