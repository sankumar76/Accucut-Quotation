# Review Report — AQP-337 (STORY-08.01) — Combined security and quality (CLAUDE.md §9 item 2)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (combined security-and-quality review, `critical-review`) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-337-fields-formulas` (PR #399) |
| Commit reviewed | d549627 (base 6d1a293 after the update; the PR's own changes, 38 files). The later merge commit fbff069 (master #397, AQP-304) was not reviewed |
| Date | 2026-11-14 |
| **Verdict** | **APPROVE WITH COMMENTS.** There is no Blocker, Critical or Major finding. There are six Minors and six Infos. I recommend fixing SQR-02 (a one-line test control) and SQR-06 (read rate names only) before the squash, because both are cheap. Everything else goes to the hardening window and is not waived. |
| PR review | https://github.com/sankumar76/Accucut-Quotation/pull/399#pullrequestreview-5907270291 (COMMENT, 9 inline comments). GitHub anchored it to the head at the time, fbff069, so the diff lines match. The content reviewed is d549627 |
| PR label | `review:quality-approved` |

## Summary

The story is small and careful. It meets the security scope of the brief.

- **NFR-002: who can reach a formula.**
  - **Manifest.** `/config/fields` (page), `GET /api/v1/config/fields` and `GET /api/v1/config/current` are `ADMIN_AND_LEAD` in the manifest. They match architecture §6 row "Configuration" (A L) and the hand-written `SPEC_ACCESS`.
  - **API order.** `withRoute` runs in this order: origin check (only for a state-changing method, so not here), `requireUser` (401), must-change-password (403), `allowsRole` (fixed 403). Only after that does it parse input or call the handler.
  - **Page order.** `authorizePage` redirects a signed-out caller, then calls `forbidden()` for a refused role, before the page body runs. Only `GET` is exported from either route, so any other method gets 405 and there is no CSRF surface.
- **The page reads nothing (A-4).** It renders `<FieldsScreen viewOnly={role !== 'ADMIN'} />` and nothing else. So its HTML and RSC payload carry no formula and no rate name. The rows come only from the JSON answer of `GET /api/v1/config/fields`, which an Engineer cannot call.
- **Client code holds no Restricted text.** The client modules hold no formula text, rate or operand name, or `{{…}}` marker. These are `features/config/*`, `lib/config/*` and `app/(portal)/config/*`, and `config-fields-confidentiality.test.ts` checks them against the seed formulas in both stored and display form. So no JS chunk can carry one, a chunk shared with an Engineer page included. The cross-feature `useMasterList` adds only `shared/states`, `use-after-delay` and types. Default-deny `viewOnly` is right.
- **Strict schemas, not reused.** `configFieldsSchema` and `configCurrentSchema` are `z.strictObject`. Only the two routes and the server-only barrel import them; the barrel is closed to `engineer-*` views by `engineer-import-rule`. `config-read-service` is in `SERVICES.blocked`.
- **`readVersionUse`.** It runs two Prisma reads in parallel, both with `select` only: `configVersion.findUnique → creator.name`, and `estimate.count` over a relation filter. Both are parameterised and there is no raw SQL. The integration test runs over `db.prisma`, which is the runtime role (`audit-database.ts` builds everything on `base.prisma`, and the owner pool is separate). So the grants on `config_versions`, `users`, `estimates` and `calculations` are exercised in CI.
- **The tests would catch a leak.**
  - Make a route `ALL_ROLES`: the role matrix fails (manifest against `SPEC_ACCESS`). So do `config-routes` (Engineer 403) and the Engineer route scan in refused-before-lookup, whose FORBIDDEN list now holds every seed formula in both forms.
  - Read before the role check: refused-before-lookup now spies on `harness.configRepository` (see SQR-02 for its missing control).
  - A formula typed into client code: the confidentiality source scan fails, with its own planted-string control.
  - Live: `canary-scan.spec.ts` iterates the manifest and reads every script an Engineer's pages load.
- **Quality.**
  - **ACs.** All eight are met. Rows come out in position order, with letters derived (`fieldLetter`) and formulas through `toDisplayForm` using one shared `referenceContext`. The UX-09 sentence names the per-row price column by `systemRole: 'unit-price'`.
  - **Re-lettering.** Two tests insert a field and check that both the formulas and the sentence move one letter on.
  - **States.** The skeleton shows after 300 ms (`SkeletonBlock`), the error has "Try again", and focus goes to the error heading. There is a no-match state with "Clear filters", which returns focus to the search box. Phones get cards.
  - **The four existing tests changed** (`http-navigation`, `navigation.spec`, `js-budget-routes`, `js-budget`): none is weakened (see the verification table).
  - **Spacing (#395).** Clean: only `s-*` tokens, `md:w-1/3`, `top-1/2`, `-translate-y-1/2` and `max-w-prose`.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 6 |
| Info | 6 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff read | GitHub MCP `pull_request_read get` and `get_files` (38 files) | **All of it read**: every `src/` file, every test and support change, the e2e spec |
| Context, code | `get_file_contents` at d549627 for `with-route.ts`, `page-access.ts`, `route-manifest.ts`, `config-service.ts`, `master-repository.ts`, `use-master-list.ts`, `use-read-again.ts`, `shared/states.tsx`, `engineer-refused-before-lookup.test.ts`, `navigation.spec.ts`, `spec-access.ts`, `calculation-database.ts`, `audit-database.ts`; `get_commit` d549627 | Read |
| Context, docs | Jira AQP-337 (ACs, Dev Context). Read-only local reads of `docs/04-architecture/architecture.md` §6 (lines 949 to 955, 1961), `docs/03-ux/ux-spec.md` SCR-17, `docs/03-ux/screens/SCR-17.html` (`hide-md`), `prisma/schema.prisma` (`EstimateStatus`), and `docs/06-reviews/AQP-303/combined.md` for the report shape | Read. GitHub code search returned 0 results for this repository (no index), as in AQP-303 |
| Unit, integration, lint, `tsc`, build, E2E | CI run 43627161275 on d549627, as reported in the brief | Reported 6 of 6 green. **Not run locally**: the brief said GitHub MCP only, and the PC is short of memory (CLAUDE.md §9 item 5). One read-only `git cat-file -t` was run by mistake, before I re-read the brief. It changed nothing |

## AC Conformance
| AC | Implemented in | Tests | Result |
|----|----------------|-------|--------|
| AC-1 table in column order (Column, Field, Section or stage, Kind, Formula in display form); BH and BI are Outputs; search by letter, name or formula; filter by kind | `configFieldRows` (sort by `position`, `fieldLetter`, `placeOf`, `toDisplayForm` with one `referenceContext`); `fields-table.tsx`; `fields-list.ts` (`filterFields`: every word, any case, over letter, label and formula) | `config-read-service.test.ts` (order, kinds, place, display form, no `{{`, re-lettering); `config-fields-screen.test.ts` (headings, filter); `config-routes.test.ts`; integration `fields-list.test.ts`; e2e AC-1 | **Met.** "Section or stage" is hidden from 768 to 1023 px, as in the mock-up: **SQR-10** |
| AC-2 System tag on A, H, BG, BL, BM, BO; no delete; no Edit formula on A, F, I, BO | `systemRole` drives the tag; `canEditFormula = output && formula !== null`; no action is drawn for any role | Service (exactly those six letters, BM `tool-cost`, false on A, F, I, BO, 31 editable); route; screen (4 tags in the fixture, no `<button>`); e2e | **Met** (A-2: the flags are carried for 08.02) |
| AC-3 O shows `IF(Material-Specific-Gravity > 0, M - N, 0)`; BL shows `SUM(BG)` and the sentence | Seed formula through `toDisplayForm`; `totalFormulaNote(fieldLetter(unit-price))` | Service (both, and the sentence moves to BH after an insert); route; e2e as Admin and as Lead | **Met.** Forward risk for 08.02: **SQR-07** |
| AC-4 Lead: same table, no actions, the banner; menu marks it "View only" | `viewOnly` for every role but the Admin; `Notice` with "View only." and "Formulas are shown so you can check the arithmetic."; manifest `labelFor: { LEAD: 'Fields and formulas (view only)' }` | `config-fields-page.test.ts` (ADMIN false, LEAD true, nothing read); screen; `http-navigation`; `navigation.spec`; e2e Lead | **Met** (A-3 label instead of a chip: **SQR-09**) |
| AC-5 Engineer: SCR-26 or fixed 403; signed out: 401; manifest rows A L; role matrix; canary 0 | Manifest; `withRoute`; `authorizePage` | role-matrix, refused-before-lookup (config spied, formulas in FORBIDDEN), strict-schema, csrf, `config-routes` (fixed 403 plus scan; 401), page test, confidentiality, `canary-scan.spec.ts` | **Met.** Guard depth: **SQR-01**, **SQR-02** |
| AC-6 `GET /config/current`: number, saved by and at, estimates in use | `getCurrent` (`getCurrentVersion` plus `readVersionUse`) | Service; route; PostgreSQL as the runtime role (seed has no saver, a later version names its maker, never-calculated estimates count 0, an unknown ID gives 0 and null) | **Met** (A-1 definition: **SQR-08**; test order: **SQR-03**) |
| AC-7 Default, Loading skeleton, Error with retry; phone cards with search | `useMasterList` with `initialItems: null`; `SkeletonBlock` (300 ms); `ErrorState focusOnMount` plus Try again (`refresh`); `FieldCards` below 768 px | Screen (aria-busy, no rows before the read); e2e (500, focus on the error, retry gives rows) | **Met.** Focus after a successful retry: **SQR-04** |
| AC-8 360, 768, 1366 px; no page scroll; table in a named focusable region; axe 0; keyboard | `Table regionLabel` (`role="region"`, `tabindex=0`); `BREAK_LONG_NAMES` on the formula | e2e at three widths (region focus, overflow ≤ 0, axe, 44 px controls, keyboard clear) | **Met as reported by CI** |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix | Test that would catch it |
|----|----------|-----------|-----------------|-------|--------|---------------|--------------------------|
| SQR-01 | Minor | `tests/security/config-fields-confidentiality.test.ts:81-84` | NFR-002 guard depth (AC-5) | The importer scan matches only a static `from '…'` whose specifier text contains `features/config/`, `lib/config/`, `services/config-read-service` or `schemas/config`. It misses a relative import from a sibling folder (`'../config/fields-table'` from `features/estimate-workspace/`, `'./config/fields-client'` from `src/lib/`), dynamic `import()` and `next/dynamic`, and the barrel's own `export * from './config'`. The barrel is in the allow-list but is not detected; this passes only because the first assertion filters the allow-list to what was found | The test claims "a new one fails here until someone decides". An Engineer-reachable component could import the SCR-17 screen with a relative path and stay green. This is defence in depth only: the route still refuses the Engineer, and no formula is in source | Resolve each specifier to a repo path (`@/` becomes `src/`, a relative path is `path.resolve(dirname(file), spec)`). Match `from`, `import(` and `export … from`. Compare against the set of restricted files | A control that runs the matcher on a planted `import { FieldsList } from '../config/fields-table'` placed in `features/estimate-workspace/` and expects a hit; assert that `schemas/index.ts` is detected |
| SQR-02 | Minor | `tests/security/engineer-refused-before-lookup.test.ts:111` | AC-5 "nothing is looked up first"; test adequacy | `watch('config', harness.configRepository)` was added, but the control "the counting can fail" proves only `masters.listProcessItems` | If the config spies were ineffective (for example the service held its own copy of the members), every refused-role case would still pass, and the "no config read for an Engineer" claim would be unproven | In the control, also call `GET /api/v1/config/fields` as the Admin and `expect(lookups()).toContain('config.findLatestRef')` | That assertion |
| SQR-03 | Minor | `tests/integration/config/fields-list.test.ts:76` (also 47, 55) | Test determinism | The tests depend on order. `getCurrent` expects `number: 2` and the saver only because the earlier describe inserted version 2. The first test's `estimatesInUse: 0` depends on running first. Line 55 uses `toBeGreaterThanOrEqual(2)` | Running one test on its own (`-t`, `.only`) or a reorder makes it fail, or pass for the wrong reason | Each test sets up what it asserts. For example, the `getCurrent` test inserts its own later version (max + 1) and expects that number and saver | `vitest run tests/integration/config -t "answers with the latest version"` passes on its own |
| SQR-04 | Minor | `src/components/features/config/fields-screen.tsx:170` | WCAG 2.4.3; AC-8 keyboard | After "Try again" succeeds, the focused button is unmounted (skeleton, then rows), so focus falls to `<body>`. A repeated failure is fine (`focusOnMount`). This is consistent with the masters screens (`returnFocus=false`) | A keyboard or screen-reader user starts again from the top of the document | After a read that followed a retry and succeeded, focus the search input (`useFocusAfterRead` with an opener ref, or a small effect) | e2e AC-7: after Try again, `expect(page.getByLabel('Search')).toBeFocused()` |
| SQR-05 | Minor | `src/components/features/config/fields-screen.tsx:18` | Coupling (coding standards §1, reuse) | Cross-feature import of `../masters/use-master-list`. The hook is documented as "a masters screen", but it is generic | Masters-driven changes to the hook silently change SCR-17, and the next list screen will copy the cross import. Lint allows it, so this is maintainability, not a rule break. No Restricted code comes with it (checked) | Move it to `src/components/shared/` (with `ReadStatus`), re-export it from the old path, and update the doc. Hardening window | n/a (existing tests cover the behaviour) |
| SQR-06 | Minor | `src/server/services/config-read-service.ts:120` | Least data (architecture §8); BR-004 | `masters.listProcessItems()` loads every rate **with its `defaultValue`** into the Configuration read path (a route a Lead can call) only to use `id` and `name`. Nothing leaks, because the schema is strict | A later edit that spreads an item into a row or a log would have a Restricted rate value to hand | Make `listProcessItemNames(tx?)` take an optional transaction (`clientFor` already handles both cases), or add a names-only read without one. Type the dependency `Pick<MasterRepository, 'listProcessItemNames'>` | Service test with a `masters` that offers only `{ id, name }`, so the value cannot be reached by type |
| SQR-07 | Info | `src/server/services/config-read-service.ts:103-107` | UX-09; forward risk for 08.02 | The sentence is tied to `systemRole === 'total'`, not to the formula | After 08.02 lets the Admin edit BL, the sentence could be false under a formula that is no longer `SUM(BG)` | In 08.02, show it only when the display form is `SUM(<unit-price letter>)`, or move it to SCR-18's BL state | 08.02: a BL formula that is not `SUM(BG)` gives `note: null` |
| SQR-08 | Info | `src/server/repositories/config-repository.ts` `readVersionUse`; PR A-1 | AC-6; product-owner ruling | "Estimates in use" counts estimates whose **current** calculation used the version, across every status (DRAFT, SUBMITTED, APPROVED), including estimates whose task was cancelled. Never-calculated estimates count for none | A reasonable reading. SCR-21 ("what uses it") will show this number to the Admin, so it should mean what the business expects | product-owner: confirm A-1 (and whether cancelled-task estimates count) before the SCR-21 story uses it | n/a |
| SQR-09 | Info | `src/server/http/route-manifest.ts` (`labelFor`); PR A-3 | AC-4 "the side menu marks it View only" | The mark is the label "Fields and formulas (view only)", not a chip | Meets the AC literally, with no menu-shape change | ux-expert or product-owner: confirm, or order the chip as a small story | n/a |
| SQR-10 | Info | `src/components/features/config/fields-table.tsx:58` | AC-1, AC-8 | "Section or stage" is `hidden lg:table-cell`, so from 768 to 1023 px it is not shown anywhere (cards are used only below 768 px). It matches the mock-up (`hide-md`) | A Lead on a tablet cannot see where a field sits | ux-expert: confirm it is intended | n/a |
| SQR-11 | Info | `src/components/features/config/fields-texts.ts:34`; `src/lib/config/fields-client.ts` (`systemRole` comment) | Docs | One comment says "these filters" where the text is "this filter". The client `systemRole` comment says `'total'` "has a sentence of its own", but the sentence comes in `note` | Misleading comments only | Correct both comments | n/a |
| SQR-12 | Info | — | Praise | The page reads nothing, so the Loading and Error states are real and the RSC payload is clean by construction. Letters and the UX-09 letter are derived, with re-lettering tests for both. FORBIDDEN now includes every seed formula in both forms across the whole refused-before-lookup sweep. A source-level scan of the client code has its own planted control. `FormulaError` holds no formula text. Strict schemas | — | — | — |

## Security and integrity verification (scope of the brief)
| Item | Result |
|------|--------|
| `/config/fields` page and both `/api/v1/config/*` routes are Admin and Lead only | Yes. Manifest `ADMIN_AND_LEAD`, `SPEC_ACCESS` (hand-written) agrees, and the role matrix compares them |
| Refusal (403 Engineer, 401 signed out) before any lookup | Yes. `withRoute` order: CSRF (non-GET), `requireUser`, must-change, `allowsRole`, then input and handler. `authorizePage` calls `forbidden()` first. Unit `config-routes` (fixed 403, 401, body has no `letter`, `formula`, `fields` or `estimatesInUse`); page test (no `getFields` or `getCurrent` call); refused-before-lookup spies the config repository (control missing: SQR-02) |
| CSRF for any non-GET | n/a. Only `GET` is exported (`Object.keys(route) == ['GET']` is tested), so Next.js answers 405 to any other method |
| Page reads nothing server-side: no formula in an Engineer-reachable page, RSC payload or JS chunk (shared chunks included) | **Verified.** The page passes only `viewOnly`. Formulas arrive only in the JSON of an Admin and Lead route. The SCR-17 client sources hold no formula, rate name or marker (confidentiality scan with a planted control), so no chunk can hold one. `useMasterList` and its imports hold nothing Restricted. The e2e canary scan reads an Engineer's scripts |
| Strict response schema, not reused elsewhere | Yes. `z.strictObject` for both; imported only by the two routes and the server barrel. The barrel is barred from `engineer-*` views (`engineer-import-rule`). Importer guard depth: SQR-01 |
| `config-read-service` blocked for Engineer views | Yes (`SERVICES.blocked` in `engineer-import-rule.test.ts`) |
| `readVersionUse` parameterised; runtime role's grants | Yes. Prisma `findUnique` and `count` with `select` only, no raw SQL. The integration test runs over the runtime-role client (`db.prisma`) in CI. Rate values loaded but not sent: SQR-06 |
| Confidentiality test and its allow-list of importers | Present and sensible. Gaps for relative, dynamic and barrel imports: SQR-01 |
| No secrets | None in the diff. Every name is invented. Gitleaks runs in CI stage 2 |
| Could a test fail if an Engineer reached a route, or a formula text leaked? | Route reachable: yes (role matrix, `config-routes`, refused-before-lookup, page test, canary). Formula leak: yes (FORBIDDEN now carries the seed formulas, the source scan, the canary) |

## Changed existing tests (none weakened)
| Test | Change | Weakened? |
|------|--------|-----------|
| `tests/unit/http-navigation.test.ts` | Adds "Fields and formulas" to the Admin's exact list and "Fields and formulas (view only)" to the Lead's; the "everything built" Lead check names the new label | No. The lists are stricter, and the Engineer still gets neither |
| `tests/e2e/navigation.spec.ts` | Lead menu: `[...IMPLEMENTED_MENU]` becomes an exact list with the new item. The "hidden" loop excludes "Fields and formulas" | No. The exclusion is needed because `getByRole('link', { name })` is a substring match and would match "(view only)". Presence is pinned by the exact list. The Engineer test is unchanged (exact list plus exact-text absence) |
| `tests/unit/js-budget-routes.test.ts` | Adds the `/config/fields` row; problems 12 → 13 | No |
| `tests/integration/js-budget.test.ts` | Adds the page to `APP_PATHS` and the stub; rows 10 → 11 and 14 → 15; "1 of 15", "2 of 15" | No. Each count follows the one added page |
| `tests/unit/config-service.test.ts` | The fake gets `readVersionUse` | No (interface member only) |

## Assumptions A-1 to A-7
| ID | Reasonable? | Needs a ruling? |
|----|-------------|-----------------|
| A-1 "in use" = current calculation's version | Yes | **product-owner** before SCR-21 shows it (SQR-08) |
| A-2 flags instead of actions | Yes (no edit in scope) | No |
| A-3 menu label instead of a chip | Yes | ux-expert or product-owner, optional (SQR-09) |
| A-4 the page reads nothing; one extra round trip | Yes. It is the stronger NFR-002 choice | No |
| A-5 the letter in the sentence is derived | Yes (coding standards §10) | No |
| A-6 banner text is the AC's | Yes | No |
| A-7 an unknown rate makes the read fail (500, Error state) | Yes. A rate in use cannot be deleted (409), and fail-closed is right for a formula list | No |

## Issues for other roles
- **developer (AQP-337):** SQR-02 and SQR-06 are recommended before the squash, because each is a few lines. SQR-01, 03, 04, 05 and 11 go to the hardening window, or now if you are in the file.
- **orchestrator:** confirm CI is green on the merge head fbff069 before the squash. If SQR-01 to SQR-06 are not fixed here, record them as `tech-debt` or `follow-up` for the hardening window.
- **product-owner:** SQR-08 (A-1 definition, cancelled-task estimates); SQR-09 (A-3).
- **ux-expert:** SQR-09 (chip or label); SQR-10 (Section or stage hidden from 768 to 1023 px); SQR-04 (focus after a retry, which the masters screens share).
- **developer of 08.02:** SQR-07 (the BL sentence must follow the formula).
- **reviewer-performance:** nothing new. `readVersionUse` counts across all estimates with a relation filter (small data; for information only).
