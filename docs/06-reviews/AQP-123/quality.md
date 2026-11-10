# Review Report — AQP-123 (STORY-02.04 Exchange Rate Master) — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 2. Round 1 is below; round 2 is at the end of this file |
| Base…branch | `master...feat/AQP-123-exchange-rate-master` (PR #151; merge base 023e17d; PR base `master` 051c0b5, docs-only since) |
| Commit reviewed | Round 1: 939f32f (commits 1fb8031, 699ec1e, 05d90fa, 2420242, d9e5711, 939f32f). Round 2: `939f32f..e72e8f2` (7950c4c, 4f59298, e72e8f2) |
| Date | 2026-11-10 |
| **Verdict** | Round 2: **APPROVE WITH COMMENTS** (no open Blocker, Critical or Major; 1 new Info, QLT-11). Round 1 was REQUEST CHANGES (1 Major: QLT-01) |

## Summary

The server side is correct, and it is the best-built master so far. Here is how it works:

- **Validation.** One rule (`DEFAULT_VALUE_PATTERN`, up to 12 digits and 2 decimals, 0 or more) is used by the screen, the route schema and the service. A CHECK in the table holds the same rule.
- **Saving.** The rates travel as decimal text. Both rows get one stamp from an injected clock.
- **Concurrency.** The table lock comes first, then `FOR UPDATE`, so two saves cannot overlap, even on an empty table.
- **Audit.** The entry is written with the change's own `tx`. The registry columns are worked out before the transaction opens.

I re-planted A3 and A4 myself on a throwaway PostgreSQL 17. Each plant fails exactly the create or the edit late-failure test of `exchange-rates.test.ts`. An extra plant removes the table lock, and the concurrency test catches it 3 times out of 3.

The **one Major is in the screen, not the server**. After a refusal that names both fields, a keyboard user who types a fix into the first field loses focus after the first keystroke. The rest of what they type goes into the **other** rate. I reproduced it in the browser: typing `84.37` into "1 USD in ₹" left USD = `8` and EUR = `88.3714.37` (QLT-01). A rate typed into the wrong currency is a data-entry error on the two numbers that every USD and EUR price is divided by. The fix is small, and I checked it: with the fix, the probe passes at all three widths.

**DEF-020 guard: confirmed by plant.** On the real code, the DEF-020 test passes at 360, 768 and 1366 px. With the guard removed, it fails at all three widths. The failure is at line 319: `H1:Materials and lists` appears in the focus log. The guard was then restored. The `@one-width` commit 1fb8031 matches the §10.5 ruling, and no assertion is weakened (details below).

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 (QLT-01) |
| Minor | 3 (QLT-02, QLT-03, QLT-10) |
| Info | 6 (QLT-04 to QLT-09) |

## Checks Run

The review used a detached worktree at 939f32f in the scratchpad (`rq-151`). Dependencies were linked from the developer's worktree, which has an identical `package-lock.json`. The PostgreSQL 17 container (`rq151-db`, port 55451, invented passwords) was migrated with `prisma migrate deploy` and seeded (`prisma db seed`, `ensure-seed-version`), and was **removed afterwards**. Nothing in the developer's worktree or the main folder was changed.

| Check | Command | Result |
|-------|---------|--------|
| PR CI | check runs of PR #151 (run 42761745140, head 939f32f) | Green, 5 of 5, at G5 (orchestrator 11287). During this review the run's E2E shards were re-running (attempt 2, not started by me); "Stages 1 to 11b" green again |
| Integration, story file | `npx vitest run tests/integration/masters/exchange-rates.test.ts` | **26 of 26 pass** |
| Unit, security, guards | `npx vitest run tests/unit/exchange-rates-lib.test.ts tests/unit/exchange-rates-routes.test.ts tests/unit/masters-service-exchange-rates.test.ts tests/unit/canary-scan-gate.test.ts tests/unit/one-width-tag.test.ts tests/unit/late-failure-runner-use.test.ts tests/security` | 20 files, **1,090 of 1,090 pass** |
| **Plant A3** (create) | diff below; same integration file | **1 failed, 25 passed**: "first save (create): no rate is left and no entry is kept" (`expected 17 to be 16`) |
| **Plant A4** (edit) | diff below | **1 failed, 25 passed**: "a later save (edit): the rates are as they were, with their stamp, and no entry is kept" (`expected 18 to be 17`) |
| Extra plant: no table lock | `await masters.lockExchangeRates(tx);` removed | The concurrency test **fails 3 of 3** (`expected { eur: null, usd: null } to deeply equal { eur: '91.37', usd: '81.37' }`): two first saves both read "not set" |
| **DEF-020 plant** | `focusOpener(SAVE_BUTTON, status === 'error')` → `focusOpener(SAVE_BUTTON)` | **Real code:** "DEF-020: when a save succeeds …" **passes** at mobile, tablet and desktop, with no retries. Tablet and desktop passed in one run. Mobile passed in a run of its own after I emptied the throwaway table, because QLT-10 had made an earlier mobile attempt unrunnable. **Plant (table emptied first):** it **fails at all three widths**, each at `exchange-rates.spec.ts:319` (`focusLog.filter(H1:…)` received `"H1:Materials and lists"`). The guard was restored with `git checkout` |
| Focus probe (QLT-01) | scratch spec `tests/e2e/rq-probe.spec.ts`, not committed | **Real code: fails at 360, 768 and 1366**, with the same state each time: `{"active":"exchange-rate-eur","usd":"8","eur":"88.3714.37"}`. **The suggested fix applied temporarily: passes at all three widths** (`{"active":"exchange-rate-usd","usd":"84.37","eur":"88.371"}`), and the two existing AC-3 focus tests still pass (10 of 10). Reverted with `git checkout` |
| `@one-width` commit 1fb8031 | read against test strategy v0.28 §10.5 rows for `process-master.spec.ts` and `materials.spec.ts` | Matches the ruling: see "The one-width commit" below |
| G12 scope (`tests/security/**`, scan spec, gate) | diff read line by line | No assertion removed or weakened: see "G12" below |
| Type-check, lint, build, full suite | not re-run | CI stages green on 939f32f; orchestrator re-ran `tsc` (11287). Not repeated |

**Local E2E harness (stated, so the result is read correctly).** Turbopack refuses a `node_modules` that is a junction to another folder ("Could not find the Next.js package"). So my untracked local config ran `next dev --webpack` on port 3151. On this loaded machine, the stock `auth.setup.ts` could not finish its route warm-ups within its 180 s limit (3 attempts). I therefore used an untracked set-up that signs in the E2E Admin and opens the tab, nothing else, and I raised the local test and expect timeouts. Neither the specs under review nor any PR file was changed for the runs, except the planted line, which was reverted.

### The plants (diffs printed before each run)

A3, `src/server/services/exchange-rate-service.ts` (reverted with `git checkout`):

```diff
 async function change(
-  { masters, audit, clock = systemClock }: ExchangeRateDependencies,
+  { masters, audit, transactions, clock = systemClock }: ExchangeRateDependencies,
@@
   const after = await masters.saveExchangeRates(wanted, { updatedById: context.actorId, updatedAt: clock.now() }, tx);
-  await audit.record(tx, {
-    event: 'master.edited',
+  const plantedEntry = {
+    event: 'master.edited' as const,
     ...context,
     objectType: EXCHANGE_RATES_OBJECT_TYPE,
     object: { id: EXCHANGE_RATES_OBJECT_ID, label: EXCHANGE_RATES_LABEL },
     before: auditState(before),
     after: auditState(after),
-  });
+  };
+  if (before.stamp === null) await transactions.run((tx2) => audit.record(tx2, plantedEntry));
+  else await audit.record(tx, plantedEntry);
   return after;
```

A4 is the same diff with `before.stamp !== null` in the `if`. The service has one `save` for the first save and for later ones, so the stamp decides "create" or "edit", as the developer's plants did.

DEF-020, `src/components/features/masters/use-exchange-rates.ts:92`:

```diff
-    focusOpener(SAVE_BUTTON, status === 'error');
+    focusOpener(SAVE_BUTTON);
```

## AC conformance

| AC | Implemented in | Tested by | Result |
|----|----------------|-----------|--------|
| AC-1 values, "Not set yet", stamp line in IST | `exchange-rates-panel.tsx:41-68`, `exchange-rate-service.ts:92-100`, `formatIst` | E2E "AC-1, AC-5, AC-7 …", "AC-1: Not set yet …"; integration AC-1 | **Met.** "Not set yet" is the placeholder of an empty field. The stamp names the saver's current name (integration test line 213). It is read as text |
| AC-2 both saved together, idempotent, stamp UTC/IST, ≥ 0 with ≤ 2 decimals, 0 accepted | `exchange-rate-service.ts:118-155`, `exchange-rate-repository.ts:116-123`, migration CHECKs | integration "stores both rates with one stamp", "is idempotent", "accepts 0"; routes unit tests; E2E keyboard save | **Met.** A repeated body changes nothing, writes no stamp and writes no entry. `TIMESTAMPTZ` is stored. The midnight test asserts UTC only (QLT-03) |
| AC-3 blank, negative, non-numeric, 3 decimals: 422 naming the field, nothing changes | `schemas/exchange-rates.ts:104-107`, `assertValid` (service), `exchangeRateProblems` (screen) | integration 8 cases plus "both wrong"; routes unit tests (422); E2E messages and real 422 | **Met** (`+`, exponent, separator, `.5`, `5.` and 13 digits are refused too) |
| AC-4 exactly one entry with before/after; none when unchanged | `exchange-rate-service.ts:118-137`, `audit-events.ts` (`exchange_rate` words) | integration AC-2/AC-4 and DEF-017 blocks, A3/A4 plants, concurrency test | **Met in substance.** The event is `master.edited` / `exchange_rate`, not the AC's literal `master.exchange_rate.updated`, which follows architecture §8 (QLT-04). Both currencies are in before/after, so each changed one is too |
| AC-5 hints with registry letters | `lib/fields/lookup.ts` (`columnOfKey`), `columnsOf` (service), `exchangeRateHint` | unit "follows a re-lettering"; E2E "letters from the answer", real BH/BJ/BI/BK | **Met.** The letters are derived at each read, and a missing key fails before any write |
| AC-6 403 / SCR-26 / 401; scan finds 0; canary values | manifest `ADMIN_ONLY`, `role-matrix` row, `canary-masters.ts`, `ensureCanaryExchangeRates`, PUT recipe | role matrix, strict-schema, CSRF, refused-before-lookup (manifest walks); canary scan and the new Admin control | **Met.** The scan's precondition (the canary pair is in the database during the Engineer scan) can be overwritten by this story's own E2E saves (QLT-02) |
| AC-7 360/768/1366: no sideways scroll, 44 px, axe 0, keyboard only, `inputmode="decimal"` | `exchange-rates-panel.tsx` (`UnitInput`) | E2E 13 tests × 3 widths | **Partly met.** Every listed check passes in CI. But "keyboard only" fails a keyboard user who corrects a refused field while the other field is also refused (QLT-01) |

## Findings

| ID | Severity | File:line | Rule / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------|-------|--------|---------------|
| QLT-01 | **Major** | `src/components/features/masters/use-exchange-rates.ts:60-65, 122-125` | AC-7 (keyboard only), AC-3, ux-spec §6.0 "Forms" | `useFocusFirstError` re-runs on **every** new `errors` object. `setField` always builds a new object, even for a field with no message. So after a refusal that names both fields, the first keystroke in USD removes its message, the effect runs, and focus moves to EUR. The same happens when typing in a valid field while the other one has a message | **Reproduced** (probe, at 360, 768 and 1366 px): typed `84.37` into USD, and the result was USD `8`, EUR `88.3714.37`, focus on EUR. A keyboard or screen-reader user can save a USD rate in the EUR field, and that rate feeds every EUR price (BK = BG / BI). The AC-3 E2E test does `fill('-1')` and then clicks, so it never checks focus after an edit | Move focus only when a **submit** produces errors, not when an error is removed. Snippet below. **Test:** the probe below, added to `exchange-rates.spec.ts` at three widths (it fails now and passes with the fix). The same pattern is in `material-form-dialog.tsx:82-87` and `process-form-dialog.tsx:65-75` (outside this diff; follow-up suggested) |
| QLT-02 | Minor | `tests/e2e/canary-scan.spec.ts:93`, `tests/e2e/exchange-rates.spec.ts:163-191, 297-331` | AC-6, BR-003, test strategy §6 | The exchange rates are a **single pair**. `prepare()` writes the canary pair before the Engineer scan, but two tests in `exchange-rates.spec.ts` save their own pair through the real route (`rateFor(…, 100)` and `rateFor(…, 120)`). Under `fullyParallel`, and in the same shard, those saves can replace 838.37 / 839.73 between `prepare()` and the scan. Materials do not have this problem, because each canary material is a row of its own | If a rate ever leaked to an Engineer during such a window, the scan would look for values that are no longer in the database and would pass. The gate's precondition is assumed, not checked | After the Engineer scan, assert that the database still holds the canary pair (read `exchange_rates`). If it does not, fail with "the canary pair was replaced during the scan". Or have the two saving tests send the canary values. **Test:** the post-scan assertion itself |
| QLT-03 | Minor | `tests/integration/masters/exchange-rates.test.ts:205-211` | Testing Notes edge case "the stamp across midnight IST" | The title says "00:00:01 IST is a different day from 23:59:59 IST", but the test asserts only the two UTC instants. Nothing checks the IST date the screen shows across midnight. The E2E checks one IST time (15:10) | A regression in the IST display at the day boundary (the case named in the story) would pass this test | Add `expect(formatIst(new Date(first.updatedAt))).toBe('09 Nov 2026, 23:59 IST')` and `expect(formatIst(new Date(second.updatedAt))).toBe('10 Nov 2026, 00:00 IST')`, or rename the test to what it checks |
| QLT-10 | Minor | `tests/e2e/exchange-rates.spec.ts:53-56, 164, 298` | test strategy §10 (one retry, reported; DL-057) | The two tests that save through the real route ("AC-2, AC-7: by keyboard only" and "DEF-020") send a pair that depends only on the width (`rateFor`). If the first attempt's PUT commits and the attempt then fails later (a timeout, a slow `afterOneFrame`), the retry finds the same pair already stored. The screen then says "already have these values", sends no PUT, and the retry **cannot pass**. **Observed:** in one of my runs the mobile DEF-020 test failed this way (page snapshot: the status "The exchange rates already have these values. Nothing was changed."). Tablet and desktop passed in that run | A transient failure becomes a deterministic one on retry, which hides the real first failure behind a misleading second one. `playwright.config.ts:58` has `retries: 1` in CI | Put the attempt into the value, for example `rateFor(testInfo, base + 30 * testInfo.retry)`. That keeps the `n.37` pattern and stays distinct per width and per attempt. **Test:** run the spec with `--retries=1` after planting a failure after the PUT; the retry then sends a PUT |
| QLT-04 | Info | `src/server/services/exchange-rate-service.ts:129` | AC-4 vs architecture §8 (AQP-74 ruling 2026-11-06); question (1) | `master.edited` with `object_type` `exchange_rate`, not `master.exchange_rate.updated` | AC-4's substance is fully met. The AC (2026-11-02) predates the ruling. §8 names events `<object>.<past participle>`, confirms `master.edited`, and lets `object_type` name the master. `master.exchange_rate.updated` breaks both parts of that rule. This matches AQP-122's precedent (its QLT-06). `master.edited` for the very first save is consistent: the pair is one object with a fixed ID that goes from "not set" to set. **Agree with the developer** | product-owner: amend AC-4's text to `master.edited` / `object_type` `exchange_rate`, as for AQP-113 and AQP-122. No code change |
| QLT-05 | Info | `src/server/views/schemas/exchange-rates.ts:119-125`; `exchange-rate-service.ts:84-90` | architecture §6 row "Exchange rates"; question (2) | The answer carries `columns` (letter and label of the rate column and of the price column, per currency) in addition to "Rates, stamp" | Needed for AC-5: the browser has no registry, and loading it would cost first-load JS (NFR-009). The letters are derived on the server at each read, the strict output schema pins the shape, and the field holds no Restricted value (labels and letters only) on an Admin-only route. Additive, and nothing else consumes it. **Agree with the design** | solution-architect: add "and the registry letters and labels of the rate and price columns (AC-5)" to the §6 row. No code change |
| QLT-06 | Info | `src/components/features/masters/exchange-rate-texts.ts:198-210`; `process-texts` `TRY_AGAIN_BODY` | question (3), ux-expert | The five state sentences follow SCR-11 and the Materials tab. Two can be untrue in an edge case. (a) "Exchange rates saved. The change is in the audit log." shows after any 200 PUT. If the screen's copy of the pair is stale (a second tab saved the same values), the server writes **no** entry, yet the notice says the change is in the log. (b) The failed-save body "… Nothing was changed." is also shown when the response is lost after the server committed | Wording only; both cases are rare (one Admin) | ux-expert: consider "Exchange rates saved." without the audit clause, or keep it and accept the edge case. (b) is the shared SCR-11 sentence; rule it once for every master |
| QLT-07 | Info | `src/components/features/masters/use-exchange-rates.ts:128-135` | design note (Dev Record decision 7) | On a 200, the hook throws away the PUT answer (`outcome.value`, which is the state written in the same transaction) and reads the pair again with GET. That costs a second round trip, and it creates the "saved, but the re-read failed" state that DEF-020 then has to guard | Correct as built, and the guard is tested. For a single pair, the PUT answer is already the server's state | Optional: `setRow(outcome.value)` and skip the re-read. DEF-020 then cannot happen here, and the guard stays harmless. Not required for this PR |
| QLT-08 | Info | `tests/integration/masters/exchange-rates.test.ts:188, 213-218` | test hygiene | (a) `insertPersonAsOwner(db, 'Second Admin', 'LEAD')`: the second saver is a Lead named "Second Admin". The service does not check roles (the route does), but the name misleads. (b) The rename test restores the Admin's name only if its assertion passes. A failure would then cascade into every later test that expects "Invented Admin" | Confusing to read; a failure would be reported many times | (a) Name it "Invented Second Saver". (b) Put the restore in `try/finally` |
| QLT-09 | Info (good practice) | service, repository, migration, tests | — | The lock order (table, then rows) holds even with no rows. Columns are worked out before the transaction (no half-done save). One rule source is shared by screen, schema and service, with a CHECK one level down. Rates are decimal text end to end, with a 12-digit limit inside `Decimal(18,4)`. The runtime role has no DELETE or TRUNCATE, and this is tested. The shared late-failure runner is used, with no local runner. The DEF-020 test records the whole focus sequence instead of polling once. The "refused entry rolls back" twins exist for create and for edit (the AQP-122 QLT-02 lesson applied) | — | — |

<details><summary>Detailed notes &amp; code suggestions</summary>

### QLT-01

**Current** (`use-exchange-rates.ts:60-65`, `:122-125`)
```ts
function useFocusFirstError(errors: RateErrors) {
  useEffect(() => {
    const first = EXCHANGE_RATE_FIELDS.find((field) => errors[field] !== undefined);
    if (first !== undefined) document.getElementById(RATE_FIELD_IDS[first])?.focus();
  }, [errors]);
}
…
const setField = (field: ExchangeRateField, value: string): void => {
  setTyped((current) => ({ ...(current ?? values), [field]: value }));
  setErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== field)));
};
```

**Suggested.** Focus on a refusal only. Keep a counter that only `submit` and the server refusal in `finish` increase:
```ts
const [refusals, setRefusals] = useState(0);
useEffect(() => {
  const first = EXCHANGE_RATE_FIELDS.find((field) => errors[field] !== undefined);
  if (first !== undefined) document.getElementById(RATE_FIELD_IDS[first])?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- focus moves when a save is refused, not when a message is cleared
}, [refusals]);
// in submit, after setErrors(found) when found is not empty, and in finish when the server refused: setRefusals((n) => n + 1)
```
Also, in `setField`, return `current` unchanged when `field` has no message. That avoids a needless render, but on its own it does **not** fix the case of both fields refused.

**Regression test** (as the probe; add to `exchange-rates.spec.ts`, three widths):
```ts
test('AC-3, AC-7: after a refusal of both fields, typing a fix into the first keeps focus and text there', async ({ page }) => {
  await answerGetWith(page, STORED);
  await openWithForm(page);
  await page.getByLabel(LABEL_USD).fill('');
  await page.getByLabel(LABEL_EUR).fill('88.371');
  await page.getByRole('button', { name: 'Save exchange rates' }).click();
  await expect(page.getByLabel(LABEL_USD)).toBeFocused();
  await page.keyboard.type('84.37');
  await expect(page.getByLabel(LABEL_USD)).toBeFocused();
  await expect(page.getByLabel(LABEL_USD)).toHaveValue('84.37');
  await expect(page.getByLabel(LABEL_EUR)).toHaveValue('88.371');
});
```

### QLT-02

**Suggested**, at the end of the Engineer scan test in `canary-scan.spec.ts` (and of the others that call `prepare()`):
```ts
const pair = await readExchangeRatesFromDatabase(); // SELECT currency, inr_value::text FROM exchange_rates
expect(pair, 'the canary pair was still in the database when the scan ran').toEqual({ USD: '838.3700', EUR: '839.7300' });
```

</details>

## The one-width commit (1fb8031)

- **Five tags, and only those.** There are three in `process-master.spec.ts` ("adds a rate …", "changes the name and the default value …", "filters by name …") and two in `materials.spec.ts` ("an edit that changes nothing closes without a request", "filters by Material in Drawing …"). The titles match the test strategy v0.28 §10.5 rows word for word. The diff changes only the `{ tag: '@one-width' }` argument, so **no `expect` is removed, widened or reordered**.
- **Pins.** `one-width-tag.test.ts` goes from 47 to 52 tests and from 9 to 11 files. The five keys carry their `describe` blocks. The test passes (in the 1,090 above).
- **Exclusions hold.** `canary-scan.spec.ts` carries no tag (it is never in `RULED_FILES`), and `canary-scan-gate.test.ts` keeps its three-width assertion. "Duplicate name" (`materials.spec.ts:205`) has no tag and runs at three widths, as §10.5 requires. `exchange-rates.spec.ts` has no tag, because §10.5 has not ruled on it. Its header names the tag in words that avoid the literal text, which is the 939f32f fix.
- **Separate change in `materials.spec.ts`.** The page-description test (commit 2420242, not 1fb8031) now expects two tabs and drops "exchange" from its negative match. That follows ux-spec v0.18 (the words name the tabs that exist), and it is not in G12 scope.

## G12 (test strategy §10, DL-114)

The in-scope files changed are `canary-scan.spec.ts`, `canary-scan-gate.test.ts`, `tests/security/engineer-import-rule.test.ts` and `tests/security/role-matrix.test.ts`. I found **no weakening**:

- The scan gains one test and one loader.
- The gate's list grows from 8 to 9 titles.
- `role-matrix` gains one row. The only other change is a comment merged into one line.
- `engineer-import-rule` moves `@/server/repositories/exchange-rate-repository` and `@/server/services/exchange-rate-service` from `FUTURE_IMPORTS` into the `blocked` lists. `BLOCKED_IMPORTS` is built from both, so it holds the same strings as before, plus `decimal-text`.
- The forbidden list still holds 838.37 and 839.73, now taken from their single definition.

No planted-fault proof is required. QLT-02 concerns the scan's precondition, not a weakened assertion.

## Answers to the three questions (quality view)

1. **Event name.** Keep `master.edited` with `object_type` `exchange_rate`. Architecture §8 is the later, binding rule, and the AC text should be amended (QLT-04).
2. **`columns` in the answer.** It is right, and AC-5 requires it in some form. The architect should list it in §6 (QLT-05).
3. **Five state sentences.** They are acceptable, and they are the ux-expert's to rule. Two edge cases are noted for that ruling (QLT-06).

## Issues for other roles

- **developer:** QLT-01 (required). QLT-02, QLT-03 and QLT-10 are recommended in this PR.
- **product-owner:** amend the AC-4 text (QLT-04).
- **solution-architect:** the §6 row "Exchange rates" should list `columns` (QLT-05).
- **ux-expert:** rule on the five state sentences and on the two edge cases (QLT-06).
- **Follow-up (suggested GitHub issue, if master agrees):** the same focus pattern as QLT-01 is in `material-form-dialog.tsx:82-87` and `process-form-dialog.tsx:65-75`, which this PR does not touch.
- **reviewer-performance:** none from quality.

## Verdict

**REQUEST CHANGES.** The verdict rests on one Major, QLT-01, a keyboard data-entry defect in the new tab that I reproduced in the browser. Its fix is about 10 lines plus one E2E test. I checked it: the probe passes at all three widths, and so do the existing AC-3 focus tests. The server, the audit and the transaction behaviour are correct, and plants A3, A4 and the lock plant prove the tests have teeth. On re-review I will check QLT-01 with the probe at three widths, and only the new diff.

---

## Round 2 — `939f32f..e72e8f2` (new diff only)

| Field | Value |
|-------|-------|
| Commits | 7950c4c (focus on refusal only; ux-spec v0.21 words; saving tests send the canary pair), 4f59298 (the Engineer scans check the canary pair at their end), e72e8f2 (`Object.hasOwn`, damaged row fails loudly, schema comment, imports, `object_id` pin) |
| Diff | 16 files, +266 / -90 |
| Rulings read | master G6 DL-129 (Jira 11299, PR comment 6761458791); ux-spec v0.21 SCR-13 "The Exchange rates tab: final words"; architecture v0.33 §6 and §8; AC-4 amended (AQP-1 11304). STD-03, STD-04 and STD-05 are out of scope by ruling |
| **Verdict** | **APPROVE WITH COMMENTS.** QLT-01 (Major) and the three Minors are fixed and verified. One new Info (QLT-11) |

### Checks run (round 2)

The same scratchpad worktree was checked out at e72e8f2. A new throwaway PostgreSQL 17 container (`rq151r2-db`, port 55451, invented passwords) was migrated, seeded and given its configuration version, then **removed afterwards**. The dev server ran with `next dev --webpack` (port 3151), with the same minimal Admin set-up and local timeouts as round 1. No PR file was changed, apart from the planted lines, which were reverted.

| Check | Command | Result |
|-------|---------|--------|
| PR CI | run 42780235188 on e72e8f2 (orchestrator brief) | Green, 5 of 5 |
| Unit, integration, security, guards | `npx vitest run` on the story's integration file, `exchange-rates-lib`, `exchange-rates-routes`, `masters-service-exchange-rates`, `masters-audit-events`, `canary-scan-gate`, `one-width-tag`, `late-failure-runner-use` and `tests/security` | 22 files, **1,133 of 1,133 pass** |
| E2E, real code | `npx playwright test … tests/e2e/exchange-rates.spec.ts --retries=0` (360, 768, 1366) | **49 of 49 pass** (16 tests × 3 widths, plus set-up) |
| QLT-10, second pass on the same database | the keyboard and DEF-020 tests again, `--retries=0`, no reset | **7 of 7 pass**. Stored pair after each pass: `EUR=839.7300 USD=838.3700` |
| **QLT-01 re-plant** | round-1 focus behaviour put back (diff below) | The three new QLT-01 tests **fail 9 of 9** (3 tests × 3 widths), each `Expected: focused, Received: inactive` (lines 239, 261, 297). Reverted with `git checkout` |
| Canary text | `Number('838.37').toFixed(4)`, `Number('839.73').toFixed(4)` | `838.3700`, `839.7300`, equal to `inr_value::text` |
| Scan spec | not run locally (it needs the production server) | Relies on CI stage 12 (green) |

QLT-01 re-plant, `src/components/features/masters/use-exchange-rates.ts` (printed before the run, then reverted):

```diff
   const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
-  useFocusOnRefusal(focusRequest);
+  useEffect(() => {
+    const first = EXCHANGE_RATE_FIELDS.find((field) => errors[field] !== undefined);
+    if (first !== undefined) document.getElementById(RATE_FIELD_IDS[first])?.focus();
+  }, [errors]);
@@
-    setErrors((current) => (current[field] === undefined ? current : Object.fromEntries(Object.entries(current).filter(([name]) => name !== field))));
+    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== field)));
```

### Round-1 findings

| ID | Severity | Status | Evidence |
|----|----------|--------|----------|
| QLT-01 | Major | **Fixed** | `useRateForm` asks for focus only through `showErrors`, called on a client or server refusal, and each refusal makes a new `FocusRequest`. `setField` returns the same object when the field had no message. Three new E2E tests: my case, the mirror (Tab to EUR, type; USD keeps its message) and a server 422 naming both fields. They fail under the re-plant (9 of 9) and pass on the real code |
| QLT-02 | Minor | **Fixed** | Two fixes, both sound. (1) The only E2E writes to `exchange_rates` are now the keyboard test, the DEF-020 test and the Admin control, and all three send the canary pair. The AC-3 real-server PUTs and the set-up warm-up are 422 and write nothing. (2) The AC-3 and AC-5 Engineer scans and the chunk negative control each call `expectCanaryRatesStillStored()` at their end |
| QLT-03 | Minor | **Fixed** | `formatIst` of both saves is asserted: `09 Nov 2026, 23:59 IST` and `10 Nov 2026, 00:00 IST`. Integration 26 of 26 |
| QLT-10 | Minor | **Fixed** (by another route than I suggested; rebuttal accepted) | The GET is answered with `STORED` and the PUT sends the canary pair, so every attempt sees a change and sends a real request. The second pass on the same database passes 7 of 7 |
| QLT-04 | Info | Closed | AC-4 now reads `master.edited` / `exchange_rate`. Architecture v0.33 §8 (line 1034) fixes `object_id` `00000000-0000-4000-8000-000600000001`, and the new unit test pins that literal and `exchange_rate` exactly |
| QLT-05 | Info | Closed | Architecture v0.33 §6 lists `columns` |
| QLT-06 | Info | Fixed | The words match ux-spec v0.21 lines 829-833 word for word (table below). Roles are right: Failed is `role="alert"` (danger tone) and Saved is `role="status"` |
| QLT-07 | Info | Not changed; accepted | The re-read stays. The DEF-020 guard line is unchanged, and the DEF-020 test passes at three widths and now also checks the Saved-case error sentence |
| QLT-08 | Info | Not changed; accepted | It holds nothing |
| QLT-09 | Info | n/a | Good practice, noted in round 1 |

**The words of ux-spec v0.21 against the build.**

| State | ux-spec v0.21 | Build (`exchange-rate-texts.ts`, `states.tsx`) |
|-------|---------------|------------------------------------------------|
| Saved | `Exchange rates saved.` | Same |
| Nothing to save | `You have not changed either rate, so there is nothing to save.` | Same |
| Failed | Title `We could not save the exchange rates.`, sentence `Check your connection and try again. What you typed is still in the form.` | Same |
| Loading | `Loading the exchange rates` | Same |
| Error (load), no Saved notice | Title `We could not load the exchange rates`, sentence `Check your connection and try again. Nothing was changed.` | Same (the `ErrorState` default) |
| Error (load), Saved notice on the page | `The exchange rates were saved, but we could not show them. Check your connection and try again.` | Same. The condition is `notice === RATES_SAVED_NOTICE`, the "Saved notice on the page" rule |

### New finding (round 2)

| ID | Severity | File:line | Issue | Impact | Suggested fix |
|----|----------|-----------|-------|--------|---------------|
| QLT-11 | Info | `tests/e2e/exchange-rates.spec.ts:59-64, 171-199, 383-420` | The two saving tests now always send the canary pair, which the database normally already holds. So the server answers 200 without writing, and no E2E test drives a save that really changes a stored rate through the screen. The file header says so | Low. A changing save (both rows, one stamp, one audit entry, in one transaction) is proven against PostgreSQL by the integration file, including the A3, A4 and lock plants. The route is proven by `exchange-rates-routes.test.ts`. The screen side of a changing save (the PUT body, the Saved notice, the re-read) does not depend on what the server writes | None for this PR. If a later story needs a real changing save in E2E, it can save another pair and restore the canary pair in `finally`, as long as no Engineer scan runs in that window. The post-scan check (QLT-02) would then catch an overlap |

### G12 (round 2)

In scope, only `tests/e2e/canary-scan.spec.ts` changed: one import, the helper `expectCanaryRatesStillStored`, and one call at the end of each of three tests. **Nothing is removed or weakened; three assertions are added.** `tests/security/**`, the scan helper and `canary-scan-gate.test.ts` are not touched.

Outside G12 scope, in `exchange-rates.spec.ts`:
- The changed sentence assertions follow the v0.21 ruling.
- The failed-save and DEF-020 tests gain a negative assertion (`Nothing was changed.` has count 0).
- The DEF-020 test's first GET is now answered with `STORED` instead of the real route. That does not weaken it: the guarded path (a 200 PUT, then a failing re-read) is unchanged.

The other changes need no G12 check:
- `masters-audit-events.test.ts` gains a deny-by-default test.
- `exchange-rates-lib.test.ts` replaces `letterOfKey(...)` with `columnOfKey(...)?.letter`, an equivalent assertion, and adds the `object_id` pin.

### Other changes in the diff (quality view)

- `audit-events.ts:147` (`Object.hasOwn`): correct, and the new test covers `toString`, `constructor`, `__proto__` and `hasOwnProperty`.
- `exchange-rate-repository.ts:97-103`: a damaged row now throws, with no value in the message. Both reads now agree.
- The hook split (`useRatesRead`, `useRateForm`, `useSaveRates`) keeps the behaviour. The full spec passes, including the keyboard save, the late first read and the skeleton.

### Verdict (round 2)

**APPROVE WITH COMMENTS.** No Blocker, Critical or Major remains. The open items are three Infos: QLT-07, QLT-08 and QLT-11.

| Severity | Open after round 2 |
|----------|--------------------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 3 (QLT-07, QLT-08, QLT-11) |
