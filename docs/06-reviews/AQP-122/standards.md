# Review Report — AQP-122 (STORY-02.03 Material Master) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 1 |
| Base…branch | `origin/master...origin/feat/AQP-122-material-master` (PR #120; base 3695f90, 3 commits, 47 files, +3251 / -45) |
| Commit reviewed | 40107d572027956e20be11f9f7878d9f97db1d86 |
| Date | 2026-11-08 |
| **Verdict** | **APPROVE WITH COMMENTS** (no Blocker, Critical or Major; eight Minor and four Info) |

## Summary
The change follows the rule-book and the 02.01 Process master patterns closely where it matters most. Every body, parameter and answer of the new routes is a strict zod object, the estimate form's list has its own schema file with no rate field in it and a repository read that selects three columns, the role check comes from the manifest, SQL is parameterised, prices are decimal text and `Decimal(18,4)`, and there is no new dependency, `any`, non-null assertion, `console`, or lint suppression. The 02.01 Major (STD-01, a 192-line component) is not repeated: the only functions over 40 lines in `src/` are the two factories that 02.01 already justified inline, each one line longer. The findings are small and mostly repeat 02.01 Minors that were not fixed at source: example and fixture numbers outside the `n.37` pattern (02.01 STD-07), the rupee sign written as a literal in several places (02.01 STD-05), and a test setup callback that this PR pushed from 36 to 43 lines.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 8 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx eslint .` at 40107d5 in a scratch worktree (detached HEAD) | 0 problems (exit 0). CI "Stages 1 to 11b" also green |
| Type-check | `npx tsc --noEmit` at 40107d5 | 0 errors (exit 0) |
| Format-check | none configured (no Prettier or EditorConfig; `CLAUDE.md` lists no format command) | n/a. See STD-10 |
| CI | `pull_request_read get_check_runs`, run 42500626525 | 4 of 4 jobs success: Stages 1 to 11, Stage 12 shards 1 and 2, Stages 1 to 11b |
| Function length (§1, 40 lines) | TypeScript-compiler script over every changed `.ts`/`.tsx` (functions, arrows, methods) | In `src/`: only `createMasterRepository` (71) and `createMastersService` (87), both justified inline since 02.01. In `tests/`: `describe`/`test.describe` containers (accepted pattern) and three real functions: `setup(...)` in `auth.setup.ts` (43; was 36, so this PR crossed the limit, STD-01), `createFakeMasterRepository` (63; was 53) and `createSessionHarness` (57; was 56), both already over |
| File length (§1, 400 lines) | `wc -l` on changed `.ts`/`.tsx` | One file over: `tests/security/role-matrix.test.ts` 401 (was 396), STD-07. Largest `src/` file: `master-repository.ts` 360 (was 190) |
| Complexity (§1, ≤ 10) | read of every new function with branching (`specificGravityProblem`, `materialFormProblems`, `materialChangesFrom`, `changeMaterial`) | Highest about 7; none over 10. No ESLint `complexity` rule exists, so this is by reading |
| Casts, non-null, `any`, markers | search of all added lines for `as X`, `!.`, `: any`, `console.`, `TODO`, `FIXME`, `eslint-disable`, `@ts-`, `debugger`, `.only`, `.skip` | None in `src/`. One `attempt.reason as unknown` in `tests/integration/masters/materials.test.ts` (a widening, harmless). `as const` only |
| Dead code | every export of the new files searched for use | `filterMaterials`, `toMaterialRow`, `materialOptionSchema` are exported but used only in their own file; harmless, noted under STD-09 |
| Dependencies | `package.json` and lockfile not in the diff | No new dependency (§5). `tabs.tsx` uses the existing `radix-ui` package |
| Generated files and secrets | file list | No generated file, lockfile, data file or `.env*` in the diff. Only `src/`, `tests/`, `prisma/` |
| Commits and branch | `git log origin/master..origin/feat/AQP-122-material-master` | 3 commits, all Conventional Commits with story and sub-task keys; branch `feat/AQP-122-material-master`; PR title `AQP-122: STORY-02.03: Material Master`; labels `ai-delivery`, `feature` |
| Secret scan (DL-108) | Dev Record only; CI stage 2 full-history scan is inside the green "Stages 1 to 11" job | I could not re-run: `gitleaks` is not installed on this machine. See STD-08 |
| PR template | read of PR #120 body against `.github/pull_request_template.md` | Cost-confidentiality line is filled in with the specific additions (see "Focus checks"). Format row dropped (STD-10) |

## Focus checks (from the brief)
| Focus | Result |
|-------|--------|
| 02.01 patterns: 40-line limit | Met in `src/` (see Checks Run). The new service functions are 8 to 20 lines; the new repository functions 5 to 25 lines |
| 02.01 patterns: naming and layering | Layering is right: route -> `masters-service` -> `master-repository`; pure rules in `src/lib/masters/materials.ts` shared by screen and schema, written once; no business rule in a component (the dialog only collects, the server decides). Naming deviates in one respect: Materials code imports `process-*` names and `DEFAULT_VALUE_*` for prices (STD-04) |
| Error codes in `src/lib/errors.ts` | Reuses `FieldValidationError` (422, field named), `NotFoundError` (404) and `NAME_TAKEN_CODE`; no new code, and none needed (`NAME_RESERVED` belongs to 02.06). `toMaterialRecord` throws a plain `Error` for a damaged row, which matches `throttle-repository.ts` and `transaction.ts`. The doc comment of `NAME_TAKEN_CODE` still says "rate name" (STD-06) |
| Strict schemas carry no rate on the options route | Verified. `schemas/options.ts` imports only `zod`; `materialOptionSchema` is `z.strictObject({ id, name, materialConsidered })`; the route imports that file directly, not the Admin file; `readMaterialOptions` selects `id`, `materialInDrawing`, `materialConsidered` only; `withRoute` parses the answer with the strict schema and fails closed (500) on an extra key; `strict-schema.test.ts` is manifest-driven and picks the route up because it is `ALL_ROLES`; the new scan test asserts the keys are exactly `id, materialConsidered, name`. All five Admin-side schemas are strict objects and the update body is `.partial()` of a strict object, so a client cannot set a key the route does not offer |
| Invented values, `n.37` pattern | Partly. Canary values follow `n.37` or `n.73` and come from one definition (`material-master-canary.ts`); the loader row names are invented. But fixtures and doc examples elsewhere use values outside the pattern, and two spec headers say they are all `n.37` (STD-02). I did not open the workbook |
| PR template cost-confidentiality line | Filled in correctly: names the new Restricted values (price, specific gravity, Material-Scrap-Rate of two canary materials), the loader `ensureCanaryMaterials`, the three routes and the page in the manifest, the real-value recipe for `PATCH /materials/[id]`, and the scan result. All of it checks out in the diff |
| DL-108 Gitleaks method | `gitleaks dir` on each of the 3 commit trees is the fallback DL-108 prescribes, so the method is right. The record is thin on its precondition and on the scratch config (STD-08) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| STD-01 | Minor | `tests/e2e/auth.setup.ts:74-117` (added lines 105-111) | Coding Standards §1 (functions ≤ 40 lines, justify exceptions inline) | The `setup('make the E2E Admin ...')` callback was 36 lines on master and is 43 after this PR's seven added lines. The Dev Record says every new function is 40 lines or fewer, which holds for new functions but not for this existing one. No inline justification. | Small, but it is the standard's own threshold and the callback keeps growing by one story's warm-up each time. | Move the process warm-up and the materials warm-up into two helpers, for example `warmProcessRoutes(page, headers)` and `warmMaterialsRoutes(page, headers)`, and call them from the callback. |
| STD-02 | Minor | `src/server/services/audit-events.ts:97`; `tests/integration/masters/materials.test.ts:16,24`; `tests/e2e/materials.spec.ts:16,33`; `tests/support/route-calls.ts:93`; also `src/lib/masters/materials-client.ts:11`, `master-repository.ts:27`, `audit-events.ts:85` (examples "7.85") and the unit specs `materials-lib`, `materials-routes`, `masters-service-materials`, `materials-audit-events` | Coding Standards §6 ("no real data"); `CLAUDE.md` §6 rule 7; ADR-014 (every placeholder number follows `n.37`); AQP-122 Testing notes ("invented ... in the `n.37` pattern") | The headers of `materials.test.ts` and `materials.spec.ts` say "Names and numbers are invented (`n.37`, ADR-014)", but the shared fixtures use a specific gravity of `7.85` (the physical value for steel, in at least 8 files), and many others are not `n.37`: `58.5`, `59.50`, `214.5`, `95`, `19.32`, `2.70`, `30.5`. The doc comment at `audit-events.ts:97` gives "MS sheet, Mild steel, Price per kg 58.00, Specific gravity 7.85, Material-Scrap-Rate 22.00", which reads like a real price list and sits in production source of a public repository. Rough count of non-pattern numbers per file: 15 of 24 in `materials.spec.ts`, 26 of 53 in `materials.test.ts`. Format-edge inputs that cannot be `.37` (`58.123`, `0.01`, `1e3`) are fine and not counted. Canary values `757.73` and `727.73` end in `.73`, not `.37`; the earlier sentinels did the same, so I treat that as established. This repeats AQP-113 STD-07. I did not open the workbook, and I am not saying any value is real. | The pattern exists so that a pasted real value stands out. When ordinary fixtures are also off-pattern, a real value in a test can hide among them. If any figure is real, this becomes a Blocker. | The author confirms that none of `58.00`, `22.00`, `7.85`, `58.5`, `59.50` comes from Accucut's list or the workbook. Then: use `7.37` (or another `.37` value) for the specific gravity fixture; give the `audit-events.ts:97` example `.37` values or drop the numbers; make the fixtures whose values are stored and shown (`214.5` and the like) `n.37`; and reword the two spec headers to "except inputs that test the format". |
| STD-03 | Minor | `src/components/features/masters/material-form-dialog.tsx:158,161`; `src/components/features/masters/material-list.tsx:32-33`; `src/server/services/audit-events.ts:102,104` | Coding Standards §1 (no magic strings; DRY); repeats AQP-113 STD-05 | The rupee sign is written as a literal in six places. `process-items.ts:23` holds a private `RUPEE` constant and exports `valueSymbol(unit)`, which is the one place the rule lives, but the Materials code does not use it. | If the symbol or the format changes (for example "Rs"), the copies drift, and the audit text, table heading and input unit can disagree. | Export one constant (`export const RUPEE = '₹'` in `process-items.ts`, or `CURRENCY_SYMBOL` in a neutral module) and use it in all six places. Put the two column headings (`PRICE_HEADING`, `SCRAP_HEADING`) in `material-texts.ts` next to the other words, built from that constant. |
| STD-04 | Minor | `src/lib/masters/materials.ts:2-7,37,79,89`; `src/server/views/schemas/materials.ts:13,39`; `src/components/features/masters/material-form-dialog.tsx:35`, `material-list.tsx:14-15`, `material-results.tsx:18`, `material-texts.ts:1`, `materials-panel.tsx:15-16`, `use-material-master.ts:11-12`, `app/(portal)/masters/materials/error.tsx:6` | Coding Standards §2 (names reveal intent); §1 (single responsibility of a module) | Materials code reuses Process master names that say something else: `DEFAULT_VALUE_PATTERN` and `DEFAULT_VALUE_MESSAGE` are used to check a price, a scrap rate and a specific gravity, and `process-texts.ts` and `process-opener.ts` supply `PageNotice`, `BREAK_LONG_NAMES`, `ERROR_RETRY`, `CLEAR_FILTERS`, `isOpener` and `focusOpener` to the Materials tab. Reuse was the right call (PO and orchestrator asked for it); the file and constant names no longer describe what is in them. Follow-up #119 covers the hooks but not these names. | A reader of `materials.ts` sees "default value" for a price; the next master (02.02, 02.05) will import from `process-*` too, and a later rename touches more files. | Add the names to #119 now: `DECIMAL_TEXT_PATTERN` / `DECIMAL_TEXT_MESSAGE`, and `master-texts.ts` / `master-opener.ts` for the shared pieces. If cheap, add the neutral names as re-exports in this PR and switch the Materials imports to them, leaving 02.01 files unchanged. |
| STD-05 | Minor | `src/server/services/audit-events.ts:112-115` | Coding Standards §10 TypeScript ("Model states as discriminated unions ... field `kind`/`dataType`") | `describeMaster` tells a material from a rate with `'materialInDrawing' in state`. The comment explains it ("the two shapes share no key"), and `z.union` only works while that stays true. | It works for two shapes. 02.02 and 02.05 add a third and fourth, and the `in` chain turns into a guess that a new field name can silently break. | Tag the stored state, or choose the describer from the entry's `objectType` (`process_item`, `material`), which the caller already gives. For example `z.discriminatedUnion('kind', [...])` with `kind: 'material'` in `materialAuditState`. Needs a migration of existing 02.01 entries only if the tag is added to rates, so the `objectType` route is the cheaper one. |
| STD-06 | Minor | `src/server/repositories/master-repository.ts:289`; `src/lib/errors.ts:83` | Coding Standards §8 (comments explain why and stay true) | Two comments went stale. (1) "Over 40 lines on purpose ...: one object of seven repository methods, each about 20 lines or fewer": the repository now has 13 methods, six of them in `createMaterialMethods`. (2) `NAME_TAKEN_CODE` is documented as "A rate name that another rate already has", but `masters-service.ts:129` now also uses it for a material name. | Misleads the next reader about what the code does and why it is long. | (1) "an object of the process methods, plus a spread of the material methods". (2) "A name that another master entry (rate or material) already has, ignoring letter case". |
| STD-07 | Minor | `tests/security/role-matrix.test.ts` (lines 71-73 added; file is 401 lines) | Coding Standards §1 (files ≤ 400 lines) | The file was 396 lines and the PR adds 5 net, ending at 401. | One line over; the next route story will add more. | Shorten the three-line comment above the two new `SPEC_ACCESS` rows to one line now, and split the file (for example the stale-session table into its own module) in the next story that touches it. |
| STD-08 | Minor | PR #120 body, "Secret scan" row of the Dev Record; Jira comment 11181 | Coding Standards §5, §9 (no secrets committed); DL-098 (b); DL-108 | The method is the one DL-108 prescribes when `gitleaks git` cannot run: `gitleaks dir` on each commit's tree, three of three clean. Three gaps in the record: (a) DL-108 allows it only when `gitleaks git` cannot run, and the record does not say why it could not; (b) the scan used a scratch config that allow-lists three baselined documentation files, and "left out the unmodified workbook", while the committed `.gitleaks.toml` states there is no path allow-list. The PR changes none of those four files, so no new content went unscanned, but a reader cannot tell that from the record, and the scratch config is not in the repository; (c) I could not repeat the scan: `gitleaks` is not installed here (tooling gap). CI stage 2 (full history, committed config and baseline) is inside the green "Stages 1 to 11" job, which confirms the head but does not replace the pre-push scan (DL-108's own reasoning). | The control is sound; the evidence is hard to audit and hard to repeat for the next story. | Add one line to the Dev Record or the Jira hand-off for this and later stories: why `git` mode was unavailable, the exact `dir` command, and that the excluded files are untouched by the diff. Ask the solution-architect for the worktree-safe `gitleaks git --log-opts` form that DL-108 already invites, so the scratch config goes away. |
| STD-09 | Info | `src/server/repositories/master-repository.ts:286`; `tests/support/fake-masters.ts:96`; `src/components/features/masters/use-material-master.ts:27`, `src/lib/masters/materials-client.ts:18`, `src/server/views/schemas/options.ts:15` | Coding Standards §1 (files ≤ 400 lines; DRY) | `master-repository.ts` grew from 190 to 360 lines with one master added; 02.02, 02.04 to 02.07 will each add methods and will pass 400 in the next story or two. `MaterialMethodName` (not exported) is written again as `MaterialMethod` in the fake. `filterMaterials`, `toMaterialRow` and `materialOptionSchema` are exported but used only inside their own file. | Forward-looking; no rule is broken today. | Before 02.04, split the material methods into `material-repository.ts` behind the same `MasterRepository` interface, or export `MaterialMethodName` and reuse it in the fake. Drop `export` from the three symbols or keep them if a test is planned. |
| STD-10 | Info | PR #120 body ("Quality loop evidence"); `src/components/ui/tabs.tsx:24`, `material-form-dialog.tsx:130`, `master-repository.ts:143,148,244`, others | Coding Standards §9; PR template | (1) The template's "Format" row was dropped without a note. There is no formatter in the repo, so "n/a: none configured" is the honest entry (02.01's report said the same). (2) 12 added lines in `src/` are longer than 150 characters (the longest, 327, is a Tailwind class string in `tabs.tsx:24`; the longest of code is 174). No `max-len` rule exists. | None today. | Keep the row with "n/a" in later PRs. A `max-len` of about 160 that ignores class strings, or Prettier, would settle it; that is the architect's call. |
| STD-11 | Info | PR #120 as a whole | Coding Standards §3, §5, §10; Architecture §6, §10 | Good practice worth keeping: the options schema lives in its own file so an Engineer-reachable route imports nothing that has a rate field; the options read selects three columns instead of filtering after the fact; canary values have one definition used by the scan, the loader and the in-memory repository; the new scan test asserts the exact key set; the migration is additive, has a rollback note, CHECKs that mirror the schema rules, and takes DELETE and TRUNCATE from the runtime role; table lock before row lock follows PRF-01; one audit entry per change in the same transaction; the audit event names follow architecture §8 and the 02.01 ruling instead of the AC text, and the developer flagged that for the product-owner; the 02.01 Major (a 192-line component) did not recur and the hook is split into three small ones; `Prisma.Decimal`/decimal text, no floats; follow-up #119 filed for the duplicated hooks (rule of three). | Praise. | None. |
| STD-12 | Info | `docs/standards/coding-standards.md:95` | Coding Standards §10 SQL | Still open from AQP-113 STD-13: the last bullet stops mid-sentence ("Cost, rate and formula fields must never be"). Applied here as "never selected into an Engineer-reachable response" (architecture §5.3), which the options read satisfies. | A reviewer cannot cite the rule as written. | Owner master: complete the sentence. |

<details><summary>Detailed notes & code suggestions</summary>

### STD-01
**Current** (`tests/e2e/auth.setup.ts`, the callback now runs from line 74 to 117)
```ts
setup('make the E2E Admin the one active Admin and save a signed-in Admin (the Users spec)', async ({ browser }) => {
  // ... sign-in, users warm-up, process warm-up (about 30 lines) ...
  // And the Materials page and its three routes (STORY-02.03): ...
  await page.goto(`${DEVELOPMENT_URL}/masters/materials`);
  // four request checks
  await context.storageState({ path: ADMIN_STATE });
});
```
**Suggested**
```ts
async function warmMaterialsRoutes(page: Page, headers: Record<string, string>): Promise<void> {
  await page.goto(`${DEVELOPMENT_URL}/masters/materials`);
  await expect(page.getByRole('heading', { level: 1, name: 'Materials and lists' })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/materials`)).status()).toBe(200);
  // POST {} -> 422, PATCH unknown ID -> 404, GET options -> 200 as today
}
// in the callback: await warmMaterialsRoutes(page, headers);
```

### STD-02
**Current** (`src/server/services/audit-events.ts:97`)
```ts
/** "MS sheet, Mild steel, Price per kg ₹ 58.00, Specific gravity 7.85, Material-Scrap-Rate (per kg) ₹ 22.00": the whole material. */
```
**Suggested**
```ts
/** "Invented sheet, Invented steel, Price per kg ₹ 58.37, Specific gravity 7.37, Material-Scrap-Rate (per kg) ₹ 22.37": the whole material. */
```
Same replacement for `specificGravity: '7.85'` in `materials.test.ts:24`, `materials.spec.ts:33` and `route-calls.ts:93` (and the assertions that read it back, `toContainText('7.85')` becomes `'7.37'`).

### STD-03
**Suggested**
```ts
// src/lib/masters/process-items.ts
export const RUPEE = '₹';              // was: const RUPEE = '₹';
// material-form-dialog.tsx
<MaterialField form={form} field="pricePerKg" unit={RUPEE} />
// material-list.tsx
const PRICE_HEADING = `${MATERIAL_FIELD_LABELS.pricePerKg} (${RUPEE})`;
const SCRAP_HEADING = `Material-Scrap-Rate (${RUPEE} per kg)`;
// audit-events.ts
`${MATERIAL_FIELD_LABELS.pricePerKg} ${RUPEE} ${state.pricePerKg}`
```

### STD-05
**Current**
```ts
function describeMaster(state: z.output<typeof masterState>): string {
  return 'materialInDrawing' in state ? describeMaterial(state) : describeProcessItem(state);
}
```
**Suggested** (choose by the entry's object type; `describe` would receive it, or each event holds a map)
```ts
const DESCRIBERS = { process_item: describeProcessItem, material: describeMaterial } as const;
```
</details>

## Reviewer-specific tables
Not applicable (standards lens). Cross-references only: the JS headroom of 14,445 B on `/masters/materials` and the repeated `PRICE_HEADING`-style string building are reviewer-performance and reviewer-quality matters.

## Issues for other roles
- **product-owner:** AC-5 says `master.material.*`; the code follows architecture §8 (`master.created` / `master.edited` with `object_type` `material`). Correct the AC text as for AQP-113 (the developer already asked).
- **ux-expert:** the page `metadata.description` (`page.tsx:9`) and `MASTERS_DESCRIPTION` (`material-texts.ts:11`) tell the user the screen manages "exchange rates and the treatment and colour list", but only the Materials tab exists until 02.04 and 02.05. Confirm the words or show them only when the tabs exist. Also confirm the proposed words listed in the developer's hand-off.
- **master:** coding-standards.md:95 (STD-12). The `@one-width` ruling the developer asks for is the solution-architect's, section 10.5.
- **solution-architect:** worktree-safe `gitleaks git --log-opts` form (STD-08); whether to add `max-len` or Prettier (STD-10).

## Previous Findings (re-review only)
Not applicable (round 1). For information, the findings of AQP-113 that recur here at lower severity: STD-05 (rupee sign, now STD-03), STD-07 (`n.37`, now STD-02), STD-13 (coding-standards truncation, now STD-12).

## Tooling gaps
- `gitleaks` is not installed on the reviewer machine, so the DL-108 scan was reviewed from the record and from CI stage 2, not repeated.
- No formatter is configured, so no format-check ran.
- Not run locally: the unit, integration and E2E suites (CI green; test adequacy is reviewer-quality's lane).

---

# Round 2 (narrow re-review, DL-115 ruling 5)

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 2 |
| Range reviewed | `40107d5..b02955b` only (2 commits: `59426c8` tests, `b02955b` product and wording; 24 files, +323 / -161). PR #120 head `b02955bb07e176f834477aeb08dc3713d563bd37`; CI run 42506525720 green |
| Date | 2026-11-08 |
| **Verdict** | **APPROVE** (STD-01, STD-02, STD-03, STD-05, STD-06, STD-07 and STD-08 are resolved; the five ux-expert strings are applied exactly; two new Info items, nothing blocking) |

## Checks Run (round 2)
| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx eslint .` at b02955b (scratch worktree, detached) | 0 problems (exit 0) |
| Type-check | `npx tsc --noEmit` | 0 errors (exit 0) |
| Function length (§1) | TypeScript-compiler script over the 24 changed files | `src/`: `createMasterRepository` 71 (justified, comment corrected) and `createAuditService` 58 (the same 58 lines at 40107d5; one argument added on one line, not this PR's). `auth.setup.ts` callback: none over 40 (was 43) |
| File length (§1) | `wc -l` on changed files | None over 400; `role-matrix.test.ts` is exactly 400 |
| Rupee literals in `src/` | `grep` for the rupee sign | Only `RUPEE` itself (`process-items.ts:24`) and three doc comments. None in code |
| Old suspect values | `grep` for `7.85`, `58.00`, `22.00`, `58.5`, `59.5`, `214.5`, `19.32`, `2.70`, `30.5`, `'95'`, "Mild steel" in `src/` and `tests/` | None left in the Materials code or tests. Two unrelated hits: `design-system/controls-sections.tsx:77` (`defaultValue="Mild steel"`, a text, not in this PR's diff) and `ci-feedback-time.test.ts:54` (`159.5`, a duration) |
| Casts, `any`, `console`, TODO, suppressions | added lines of the range | None |
| Dependencies, files outside `src/` and `tests/` | `git diff 40107d5 HEAD --name-only` | None |
| Secret scan | `gitleaks` still not installed here; Dev Record: 5 of 5 commit trees clean; CI stage 2 green on the head | Reviewed from the record, not repeated (see STD-08) |

## Previous Findings
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| STD-01 | Minor | **Fixed** | `warmProcessRoutes` and `warmMaterialsRoutes` extracted in `tests/e2e/auth.setup.ts`; the callback is under 40 lines by measurement (PR body says 26). A shared `NOBODY` constant replaces the repeated all-zero ID |
| STD-02 | Minor | **Fixed** | See the first check below. The statement is in the PR body (Dev Record, round 2). Held Minor on the developer's word as master ruled (ruling 3); nothing in the range contradicts it |
| STD-03 | Minor | **Fixed** | `RUPEE` is exported once from `process-items.ts:24` and used in `material-form-dialog.tsx:159,162`, `material-texts.ts` (`PRICE_HEADING`, `SCRAP_HEADING`, moved out of `material-list.tsx`) and `audit-events.ts:98-107`. No literal remains in code |
| STD-04 | Minor | **Deferred to #119 (accepted)** | Master's comment on #119 lists the neutral names and a due date (before STORY-02.02). Not re-reviewed here |
| STD-05 | Minor | **Fixed** | See the third check below. One small follow-on, R2-01 |
| STD-06 | Minor | **Fixed** | `master-repository.ts:289` now says "the seven Process Master methods ... plus a spread of the material methods"; `src/lib/errors.ts:83` now says "A name that another master entry (a rate or a material) already has" |
| STD-07 | Minor | **Fixed** | `role-matrix.test.ts` is 400 lines |
| STD-08 | Minor | **Fixed** | See the fourth check below |
| STD-09 to STD-12 | Info | Open as Info | STD-09 is on #119 with a date (before STORY-02.04). STD-10 and STD-12 are not this PR's to close |

## The four focus checks
**STD-02: every stored or shown value is `n.37`.** The stored and displayed numbers are now `.37`: specific gravity `7.37` in the integration, unit and E2E fixtures and in `route-calls.ts`; `58.37` and `22.37` in the `audit-events.ts:98` example; typed E2E values `214.37`, `95.37`, `30.37`, `44.37`, `45.37`, `46.37`; the warm-up PATCH uses `1.37`. What remains outside the pattern I checked one by one, and all of it is a format input or its padded output: `58.123`, `7.375`, `7.371`, `0.001`, `1.234`, `2.345` (too many decimals), `0`, `0.00`, `0.01` (zero and the smallest value), `'1'`, `'7'`, `'23'` and their outputs `1.00`, `7.00`, `23.00`, and `' 58.3 '` becoming `'58.30'` (padding of one decimal, which cannot end in `37`). The spec headers now say "except inputs that test the format". The PR body carries the statement: none of the listed values came from Accucut's list, the workbook or any real price source, with the origin of each group (the invented UX mock-up, typed padding tests, textbook specific gravities), and it says the workbook and `.env*` were never opened. I did not open the workbook either. Result: resolved.

**STD-03: one rupee constant.** Confirmed in the table above. A search of `src/` for the literal finds only the constant and comments.

**STD-05: audit words by object type.** `describeMaster` is gone. `master.created`, `master.edited` and `master.deleted` call `describeMasterChange(objectType, before, after)`. `EventDefinition.describe` gained a third argument (`objectType`), `describeStored(before, after, objectType?)` passes it on (falling back to the event's own `'master'`, which has no words and shows a dash), and `audit-service.ts:179` passes `row.objectType`, which the services write as `process_item` and `material`. A state that does not fit the shape of its type, or a type with no entry, returns `NO_DETAIL` instead of a guess. Tests: a material under `process_item` and a rate under `material` show a dash; an unknown type and `'master'` show a dash; the same state under its own type is described; the audit service lists one entry of each kind in its own words. The Process master test now passes `'process_item'`. The developer also planted a key-based choice and the new test failed. Stored 02.01 entries keep working because they already carry `object_type` `process_item`. Result: resolved.

**STD-08: the DL-108 record.** The PR body now gives both reasons `gitleaks git` could not run: no `gitleaks` binary on the machine, and the official image `zricethezav/gitleaks:v8.30.1` cannot read the history because the checkout is a worktree whose `.git` is a file pointing outside the folder that can be mounted. It gives the commands: `git archive --format=tar -o <tree>.tar <sha> -- . ':(exclude)AMADA-20261006.xlsx'`, extract, then `docker run --rm -v "<tree>:/src:ro" -v "<scratch.toml>:/cfg/gl.toml:ro" zricethezav/gitleaks:v8.30.1 dir /src --config /cfg/gl.toml --redact --no-banner`. It states what the scratch config contains (default rules plus a path allow-list for `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md`, `docs/01-discovery/requirements-catalog.md` and `README.md`), that the workbook is left out, that the PR's diff touches none of those four files (checked with `git diff origin/master --name-only`), and that all five commit trees (255cc75, 18ddf2d, 40107d5, 59426c8, b02955b) exited 0. That is the "why" and the "exact command" DL-108 needs. One residue: the scratch file itself is still not in the repository, but its content is stated in full, and a worktree-safe form is already routed to the architect. Result: resolved.

## ux-expert wording (Jira 11188), five strings
| Constant | Required | In the code | Result |
|----------|----------|-------------|--------|
| `MATERIAL_NAME_REQUIRED_MESSAGE` (`lib/masters/materials.ts:31`) | `Enter the Material in Drawing.` | same; no longer an alias of `NAME_REQUIRED_MESSAGE` (import removed) | Exact |
| `MATERIAL_SEARCH_PLACEHOLDER` (`material-texts.ts`) | `Material in Drawing or Considered` | same | Exact |
| `MATERIALS_EMPTY_DESCRIPTION` | `Add the first material. A part's Material in Drawing is chosen from this list.` | same (double-quoted string, apostrophe intact) | Exact |
| `MASTERS_DESCRIPTION` | `Material prices, specific gravity and scrap rates.` | same | Exact |
| `metadata.description` (`materials/page.tsx:9`) | `Manage the materials used in estimates.` | same | Exact |

`CONSIDERED_REQUIRED_MESSAGE` was confirmed unchanged by the ux-expert and is unchanged. The tests were updated at the places 11188 lists (`materials.spec.ts:172,336`, `materials-lib.test.ts:94`, `materials-routes.test.ts:110,175`), and a new E2E test (`materials.spec.ts:101`) asserts that with one tab neither the description nor the meta says "exchange" or "treatment". The placeholder string is not asserted by any test; harmless, as the E2E tests find the field by its label. The 120-character search text defect the developer found (416 px of sideways growth in the No match state) is fixed with the shared `BREAK_LONG_NAMES` class on `EmptyState`, the class the table cells already use, and a test holds it at the three widths. SCR-11 probably has the same fault; the developer routed it rather than touching 02.01 code, which is the right call for scope.

## New findings (round 2)
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| R2-01 | Info | `src/server/services/audit-events.ts:124,131` | Coding Standards §5 (allow-lists), §10 | `MASTER_WORDS` is a plain object looked up with `objectType`, a string read from the database row. A key such as `toString` or `constructor` resolves to an inherited function (checked in node: `typeof M['toString']` is `function`), so `words(before)` would run and return a meaningless string instead of `NO_DETAIL`. Only server code writes `object_type` today, so this cannot happen in practice. | None now; it undoes the "never guess" intent of STD-05 for a corrupt or future value. | `if (!Object.hasOwn(MASTER_WORDS, objectType)) return NO_DETAIL;` before the lookup, or make `MASTER_WORDS` a `Map`. One line and one test case (`'toString'`). Can go in the next story that touches the file. |
| R2-02 | Info | `src/components/features/masters/material-list.tsx:30-31`; `tests/unit/materials-audit-events.test.ts:38` | Coding Standards §8, §9 | Two leftovers of the edit: removing the heading constants left two blank lines in a row before `EditButton`; and the test title "still says a rate in the words of the Process Master: the two shapes share no key" now describes the choice STD-05 removed. | Cosmetic. | Delete one blank line; retitle to "... by its own object type". |

## Round 2 summary
| Severity | New | Still open from round 1 |
|----------|-----|-------------------------|
| Blocker | 0 | 0 |
| Critical | 0 | 0 |
| Major | 0 | 0 |
| Minor | 0 | 0 (STD-04 is deferred to #119 by master, with a date) |
| Info | 2 | 3 (STD-09 on #119, STD-10, STD-12) |

**Verdict: APPROVE.** The PR template cost-confidentiality line was updated for the new loader (`loadCanaryMaterials` via `ensureCanaryMaterials`) and still matches the diff. The path margin (5:57, 3 s under the 6:00 warning) and the +942 B on `/masters/materials` are for reviewer-performance and master to weigh; they are not standards matters.

## Tooling gaps (round 2)
- `gitleaks` is still not installed on the reviewer machine, so the DL-108 scan was reviewed from the record and CI stage 2, not repeated. I did not pull the Docker image (a reviewer installs nothing).
- Not run locally: unit, integration and E2E suites (CI green; adequacy is reviewer-quality's lane).
