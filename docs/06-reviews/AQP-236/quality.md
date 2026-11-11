# Review Report — AQP-236 (DEF-022), each `playwright test --list` gets its own cache folder — Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 (narrow scope, master ruling DL-120) |
| Base…branch | `master...fix/AQP-236-list-cache-race` (PR #220; base 1d37902) |
| Commit reviewed | ddf6191 |
| Date | 2026-11-10 |
| **Verdict** | **APPROVE WITH COMMENTS** (no Blocker, Critical or Major findings) |

## Summary

The scope is the three files of PR #220 and the questions in the DL-120 brief: whether the root cause is right, whether any guard is weaker, temp-folder cleanup, Windows and Linux paths, cost on CI, the quality of the new unit test, and a control plant.

- **The root cause is right, and I confirmed it in Playwright 1.64.1's own source** (QLT-03). The compiled `.js` cache file has a SHA-1 header, so a half-written one is caught and compiled again. The `.map` source-map file has no such check:
  - A listing that compiles a spec first deletes every cache file for that spec path (`clearOldCacheEntries`), then rewrites the `.map`.
  - So a second process compiling the same spec at the same moment can delete or truncate the map the first one just wrote.
  - `retrieveSourceMap` hides the read error and returns `null`, so the test's location falls back to the compiled line.
  - A folder per listing removes the shared state completely. A warm cache would avoid it too, but only after something has warmed it.
- **Nothing is weakened.** All six test bodies in `e2e-shards.test.ts` are byte-identical; only `beforeAll` changed. No assertion, matcher, count or exemption changed in any of the four guard files. `canary-scan-gate.test.ts` (in G12 scope) uses the helper, but neither its assertions nor what the listing returns changed, so the G12 rule is not triggered. Dropping the whole-suite-first order is correct: its only job was to fill a shared cache.
- **The control proves the fix.** Control PR #221 restored one fixed shared cache folder. On it, the DL-120 pair failed **6 of 10** local cold runs (Windows) on the shared cache: 5 with the DEF-022 signature and 1 with an `EPERM` on a shared `.map`. 3 more runs hit the 100 s listing limit under host load and are inconclusive. PR #220's head passed **10 of 10** under the same loop. In CI, the new unit test failed on the plant.
- **Cost is neutral, within host noise** (see the cost table).
- **Two Minor test-quality findings.** Two "removes the folder" tests and the "not from the caller" test can pass without proving what their names say (QLT-01, QLT-02). The concurrency test does catch the plant, so this guard is not empty, which is why these are Minor.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 (QLT-01, QLT-02) |
| Info | 5 (QLT-03 to QLT-07) |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| PR CI | `gh run view 42951199191` (head ddf6191, attempt 1) | All checks green: Stages 1 to 11b, 1 to 11, E2E shards 1, 2 and 3 |
| Diff | `git diff origin/master...origin/fix/AQP-236-list-cache-race` | 3 files, as the Dev Record says; nothing under `src/`, no config, CI or dependency changes |
| Callers | `git grep listPlaywrightSuites` | Called by `e2e-shards`, `one-width-tag`, `own-width-files` and `canary-scan-gate`, as the PR says. No `PWTEST_CACHE_DIR` in `ci.yml`, `vitest.config.ts` or `package.json` |
| Root cause in Playwright | read `node_modules/playwright/lib/common/index.js` (1.64.1, the locked version) | Confirmed (QLT-03) |
| Five listing files on the head | `vitest run tests/unit/playwright-list.test.ts e2e-shards one-width-tag own-width-files canary-scan-gate` (Windows 11, Node 24.19.0, ddf6191) | 5 files, 46 of 46 pass. No `accucut-playwright-list-*` folder left in `%TEMP%` afterwards |
| Plant: new unit test | `vitest run tests/unit/playwright-list.test.ts` on the control (997eebd) | Alone, locally: **1 failed** (`expected 1 to be 3`, the concurrency test), 5 passed. In CI stage 6, with the other listing files: **3 failed** (concurrency plus both "removes the folder" tests). That difference is QLT-01 |
| Plant: cold race, local | 10 runs of `vitest run e2e-shards one-width-tag` with the fixed shared folder deleted before each run, on the control | **6 of 10 failed on the shared cache**: runs 1, 2, 4, 5 and 7 with the DEF-022 signature (`expected [ …(688) ] to deeply equal [ …(688) ]`, compiled lines such as `materials.spec.ts:330`); run 6 with `EPERM … accucut-playwright-list-shared-control;…_dbguard.map` (the same race, as a Windows file lock on a shared source map). Runs 8 to 10 were stopped at the 100 s listing limit while the host was heavily loaded (158 to 163 s per run), which is inconclusive for the race (DL-057 class). Run 3 passed |
| Head: cold race, local | the same loop on ddf6191, a new `PWTEST_CACHE_DIR` per run (ignored by the helper, which makes its own) | **10 of 10 passed** (16 of 16 tests each, 25 to 41 s per run). No `accucut-playwright-list-*` folder left in `%TEMP%` afterwards |
| Plant: cold race, CI | control run 42958806182, stage 6 | The union test **passed** once on a cold shared folder (Linux). Stage 11 did not run, because stage 6 failed on the unit test |

### What the control can and cannot show

- **In CI, stage 6 is a cold run, not a warm one.** No step caches or warms Playwright's transform cache, and every runner starts empty. So master's stage 6 has always listed on a cold shared folder. Stage 11 then repeats the tests on a warm one. DEF-022 has never shown in CI (master run 42945910485, and the control's single cold sample stayed green). The race depends on timing, and it shows far more on the Windows host.
- **So one CI run cannot prove the race absent or present.** The local cold loop is the evidence for the race, and the unit test is the evidence that cannot flake: it fails on the plant every time.
- **Closed:** #221 was closed unmerged after these readings were recorded, and its comment holds the reading. **Deleting the branch `control/AQP-236-shared-cache` was refused by this session's permission settings**, so it is still on origin. A human or the orchestrator deletes it (the security review flagged its fixed shared temp folder, which the plant needs; it must never merge). The local shared folder the plant created has been removed.

### Cost on CI (head run 42951199191 against master run 42945910485)

| Measure | Master 1d37902 | Head ddf6191 |
|---------|----------------|--------------|
| `Stages 1 to 11b` job | 3:40 | 2:26 |
| Stage 4 lint / stage 5 type-check (host speed probe; nothing changed here) | 17 s / 13 s | 9 s / 6 s |
| Stage 6 step (Vitest duration) | 35 s (34.45 s) | 24 s (22.58 s) |
| Stage 11 step (Vitest duration) | 97 s (95.21 s) | 60 s (59.23 s) |
| Stage 6, four listing files (ms): one-width / canary gate / own-width / e2e-shards | 2890 / 1353 / 1395 / 4426 | 1588 / 1545 / 1428 / 3923 |
| Stage 11, the same files (master: warm default cache; head: cold private caches) | 1164 / 1912 / 1272 / 5112 | 1206 / 2338 / 2050 / 4040 |
| Stage 12 shards | not affected (they do not import the helper) | — |

The head's runner was about twice as fast as master's (lint and type-check did not change but took half the time). So the job times compare hosts, not the change. The fairest reading is stage 11:
- On master, stage 11 lists on a warm cache. On the head, every listing is cold.
- The four files sum to 9.46 s on master and 9.63 s on the head, about +0.2 s on a faster host.
- They run in parallel workers, so the added path is a few seconds at most.
- This agrees with the developer's local +4 s on the six-file set.
- It is far from both the 100 s listing limit and the 120 s hook limit. No RISK-023 effect.

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-01 | Minor | `tests/unit/playwright-list.test.ts:83-102` | coding standards §6 (meaningful assertions, deterministic) | The two "removes the folder" tests only assert `existsSync(folder) === false` after the listing. They never check that the folder existed while the listing ran. With a fixed shared folder (the control), the result depends on whether another process has created that folder: they **passed** alone locally and **failed** in CI stage 6 | A cleanup assertion that can pass vacuously. The plant is caught only by the concurrency test, so the guard rests on one test | In the fake handler, record `existsSync(folder)` and assert it is `true` before asserting removal, as the concurrency test already does |
| QLT-02 | Minor | `tests/unit/playwright-list.test.ts:114` | §6 | `not.toBe('a-shared-folder-the-caller-set')` passes for **any** other folder, including a fixed shared one. It passed on the control, both locally and in CI. The name says the folder comes "from the listing", which this does not show | The caller-override half of the test cannot detect a return to a fixed folder | Assert the folder is a new one from this helper: `expect(basename(folder).startsWith('accucut-playwright-list-')).toBe(true)`, `dirname` equals `tmpdir()`, and it existed during the call |
| QLT-03 | Info | `tests/support/playwright-list.ts:19-24` | — | Root cause confirmed, with a more precise mechanism. In Playwright 1.64.1 (`lib/common/index.js`), `getFromCompilationCache` validates `.js` with a SHA-1 header. `addToCache` first runs `clearOldCacheEntries` (it deletes **every** file for that spec path, including a fresh entry), then writes the `.map` without a check. `retrieveSourceMap` hides a missing or truncated map and returns `null`, so the location falls back to the compiled line. "Half-written entry" is right in substance; strictly, it is the source map, deleted or truncated by a concurrent compile | None; the fix removes all sharing. Useful if a later Playwright changes the cache | Optional: name the `.map` file in the header comment |
| QLT-04 | Info | `tests/support/playwright-list.ts:90-92` | §4 (no silently swallowed errors) | The swallowed `rm` failure is deliberate and commented, and that is right: cleanup must not hide the listing's result. But "a leftover in the temp folder, which the system clears" is not true on Windows by default (`%TEMP%` is not cleared on reboot without Storage Sense) | A rare leftover on a dev machine, for example after a listing is killed on timeout while a child still holds a file. It never leaves the temp folder: the path is always the `mkdtemp` result | Optional wording: "…is a leftover in the temp folder; it must not replace…" |
| QLT-05 | Info | `tests/unit/playwright-list.test.ts:59,68` | naming | `bothStarted` waits for three listings | Readability only | Rename to `allStarted` |
| QLT-06 | Info | `tests/support/playwright-list.ts:109` | — | A `PWTEST_CACHE_DIR` set by the caller is now ignored for these listings. That is deliberate and tested. Nothing in CI or config sets it. **For QA:** step 2 of the DEF-022 repro ("set `PWTEST_CACHE_DIR` to a new folder") has no effect on the head. "After" runs are cold per listing whatever the variable says. "Before" runs must use master's helper (1d37902), where the variable still applies | Avoids a misread QA loop | QA states this in the G7 method |
| QLT-07 | Info | `tests/unit/e2e-shards.test.ts:53-65` | G12 rule (test strategy §10) | Not a weakening: the six `it` bodies are unchanged, the same five listings are made, and only the order is now all at once. A cold all-at-once listing on a shared folder was the QLT-04 failure; with private folders the order carries no meaning. Praise: the new unit test fakes `execFile` through `promisify.custom`, with no cast and no real Playwright process, and the concurrency test holds all three listings in flight before any finishes | — | None |

<details><summary>Detailed notes & code suggestions</summary>

### QLT-01
**Current**
```ts
fake.handler = async (options) => {
  folder = cacheFolderOf(options);
  return { stdout: EMPTY_LIST };
};
await listPlaywrightSuites();
expect(folder).not.toBe('');
expect(existsSync(folder)).toBe(false);
```
**Suggested**
```ts
let existedDuringListing = false;
fake.handler = async (options) => {
  folder = cacheFolderOf(options);
  existedDuringListing = existsSync(folder);
  return { stdout: EMPTY_LIST };
};
await listPlaywrightSuites();
expect(existedDuringListing, folder).toBe(true);
expect(existsSync(folder), folder).toBe(false);
```
Make the same change in the failure-path test. Test that would catch it: the control plant then fails both tests on every run, in every order.

### QLT-02
**Suggested**
```ts
const folder = environment?.[CACHE_DIR_VARIABLE] ?? '';
expect(folder).not.toBe('a-shared-folder-the-caller-set');
expect(basename(folder).startsWith('accucut-playwright-list-'), folder).toBe(true);
expect(resolve(dirname(folder))).toBe(resolve(tmpdir()));
```
</details>

## Reviewer-specific tables

**Requirement conformance.** DEF-022 has no ACs; the bar is DL-120 and the AQP-236 brief.

| Requirement | Implemented in | Tested by | Result |
|-------------|----------------|-----------|--------|
| Root cause fixed at the source (own cache per listing, or a `globalSetup` warm-up) | `withPrivateListCache` + `listPlaywrightSuites`, `tests/support/playwright-list.ts:85-113` | `playwright-list.test.ts` (concurrency test), control plant | Met |
| No retry, no raised limit, no order or lock (DL-057) | Same; `LIST_TIMEOUT_MS` (100 s) and `hookTimeout` (120 s) unchanged | Diff reading | Met |
| Not quarantined; assertions unchanged | `e2e-shards.test.ts` (only `beforeAll` changed) | Diff reading; G12 check | Met |
| Cold-cache repro fails before and passes after | — | Developer: before 3 of 20 fail, after 0 of 26. Reviewer: control 6 of 10 race failures (3 more load timeouts), head 0 of 10 | Met |
| Temp folder removed after success and after failure; never outside the temp folder | `finally` + `rm` on the `mkdtemp` path only | `playwright-list.test.ts` tests 2, 3, 5 and 6 (QLT-01 weakens 2 and 3) | Met |
| Windows and Linux paths | `mkdtemp(join(tmpdir(), prefix))`, `rm` with `maxRetries: 3` (Windows EBUSY) | Windows locally, Linux in CI | Met |
| CI green | — | Run 42951199191, attempt 1 | Met |
| QA cold loops of 10 of 10 (G7) | — | qa-engineer | Pending G7 |

## Issues for other roles

- **qa-engineer (G7):** see QLT-06. The DEF-022 repro's `PWTEST_CACHE_DIR` no longer controls these listings on the head, so for the "before" runs use master's helper.
- **developer:** QLT-01 and QLT-02 are cheap (test-only, a few lines). Fixing them in this PR is preferred, but they do not hold G6.
