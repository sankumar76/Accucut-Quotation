# Review Report — PR #799 (AQP-487 / DEF-130: the export thread bundle missing after `next build` alone) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (the one combined security-and-quality review, CLAUDE.md §9 item 2: data reaching the customer) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-487-export-build-failure` (PR [#799](https://github.com/sankumar76/Accucut-Quotation/pull/799)), 1 commit |
| Commit reviewed | `98698c36` |
| Date | 2026-11-26 |
| PR review | [review 6076191399](https://github.com/sankumar76/Accucut-Quotation/pull/799#pullrequestreview-6076191399) (COMMENT, single-token; 5 inline comments; label `review:quality-changes-requested`) |
| Reviewed against | Jira AQP-487 (DEF-130), GitHub #797; the brief's points (a) start-up line, (b) every build path pinned, (c) README; ADR-012, ADR-015, ADR-002 (superseded); `docs/standards/coding-standards.md` §1, §3, §4, §6, §10 |
| **Verdict** | **REQUEST CHANGES (one Major), not a merge stop.** No Blocker, no Critical, so §9 item 2 does not stop the merge. The Major (QLT-799-01) puts 3 Edge Runtime warnings into every build. It is cheap to fix now; if it is deferred, master records that and a `tech-debt` issue is filed. Export logic, data and NFR-002 are untouched. No secrets |

## Summary

**The cause is right, and the fix does what it says.** The export looks for `<cwd>/.next/export-worker.mjs` (`composition.ts:526` → `exportThreadFile`). Only the bundle step makes that file. `next build` on its own does not. The start-up check reuses the same `exportThreadFile`, so it looks in the same place the export does. It cannot stop the start: `existsSync` never throws, and the line is written with no exit. It runs only when `NODE_ENV === 'production'`, after the env check, and never during `next build`. Its cost is one `stat` plus a module the first request loads anyway: the chain it pulls in at run time is `lib/errors` → `fields/uses`, `calculate-words`, `assert-never`, and the rest are type-only imports. It logs no setting and no value, only the server's own working folder (SEC-799-01).

**DEF-130 is not Sev-1 on this evidence.** The Windows package, the only production path (ADR-015), cannot be made without the bundle. There is no Docker build path. The fault happens only when someone runs `next build` by hand, as on the demo. That makes it a Sev-3 candidate, which is for QA and master to decide.

**The Major:** the new static `import { exportThreadProblem } from '@/server/export/thread-runner'` in `src/instrumentation.ts` brings `node:fs`, `node:path` and `node:worker_threads` into the **Edge Instrumentation** bundle. Stage 9 of run 45839134196 now prints "Turbopack build encountered 3 warnings … Ecmascript file had an error", with the import trace `Edge Instrumentation: thread-runner.ts ← instrumentation.ts`. The latest green master run (45832168454) has **0** such warnings. The file's own doc comment (`instrumentation.ts:13-15`) promises "the build prints no Edge-runtime warning", and `onRequestError` uses a dynamic import "for the same reason".

**The tests are mostly real.** A mutation run killed 13 of 17 mutants. The survivors are listed in QLT-799-03.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 1 |
| Minor | 4 |
| Info | 5 |

## Build paths: does each one make the bundle? (brief point 3)

| Path | Makes the bundle? | Evidence (at `98698c36`) |
|------|-------------------|--------------------------|
| `npm run build` | **Yes**, after `next build`, chained with `&&` | `package.json:11` `prisma generate && next build && tsx scripts/build-export-worker.ts`; writer `scripts/lib/export-worker-bundle.ts:17` (`.next/export-worker.mjs` under cwd) = reader `thread-runner.ts:52-53`. Served by `next start` from the same folder, it is found. (Run directly as `node .next/standalone/server.js`, the server changes into `.next/standalone` and would **not** find it. No documented path does that. The Windows package makes its own copy, see below.) |
| `npm run dev` | **Yes**, before `next dev` | `package.json:10`. The E2E development server uses the same order (`playwright.config.ts:107`), and the export E2E journeys pass on it in CI |
| Docker | **No build path exists** | No `Dockerfile` in the tree (`git ls-tree`). `compose.dev.yml:1-2`: "There is no deployment Compose file"; it holds only `db` and `mailpit`. `ci.yml:322-326` Stage 13 "image" is `if: ${{ false }}`. ADR-002 is superseded by ADR-015 for the runtime |
| Windows package | **Yes. It cannot be made without the bundle** | `package-windows.ps1:183` copies the standalone server into `stage\app`, then `:188` `New-EsbuildBundle … -OutFile (Join-Path $app '.next\export-worker.mjs')`. `:129-130` throw on an esbuild failure or a missing file, and `:160` sets `$ErrorActionPreference = 'Stop'`. The service runs `server.js` with working directory `{{CURRENT_DIR}}\app` (`deploy/windows/services/AccucutApp.xml:18-19`), so `cwd\.next\export-worker.mjs` is the packaged file. Built by `windows-package.yml:87-88` (`npm run build`) and `:140` (package). The stage folder is deleted first (`:175`), so nothing stale is reused |
| CI `verify` and E2E shards | **Yes** | `ci.yml:255-257` (Stage 9), `ci.yml:461-463` (shard build) |
| Playwright production servers (local) | **Yes** | `playwright.config.ts:118`, `playwright.sweep.config.ts:108` |
| Nightly | **Yes** where an export runs; **no** for Lighthouse | `nightly.yml:354` and `:573` use `npm run build`. `nightly.yml:166` (Lighthouse) runs `npx next build` alone. It needs no export, but its server now logs the line |
| `next build` by hand (the demo) | **No.** This is DEF-130 | Now loud at start-up (this PR). The README's own performance section still shows it (`README.md:375`, QLT-799-04) |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Diff and touched files | `gh pr view 799`, `gh pr diff 799`; full files at the head: `instrumentation.ts`, `thread-runner.ts`, `composition.ts:511-526`, `package.json`, `ci.yml`, `nightly.yml`, `windows-package.yml`, `package-windows.ps1`, `AccucutApp.xml`, `compose.dev.yml`, `playwright*.config.ts`, `scripts/build-export-worker.ts`, `scripts/lib/export-worker-bundle.ts` | 5 files: README, 2 `src`, 2 tests. No export logic, no data path, no client code |
| Unit tests at the head (worktree `aqp-403`, read-only) | `npx vitest run tests/unit/export-bundle-paths.test.ts tests/unit/instrumentation.test.ts tests/unit/export` | 456 of 457 passed. The 1 failure was a 5 s timeout in `export-refusal.test.ts`, which this PR does not change (it scans every tracked file under parallel load). Run again with the two PR files: **36 of 36 passed** |
| Mutation check of the new tests (scratch copy from `git archive 98698c36`, not the repository) | 17 mutants, each run against `export-bundle-paths`, `instrumentation` and `export/thread` | **13 killed.** Survivors: M03 `;` for `&&` in `build`; M09 bundle removed from `playwright.sweep.config.ts`; M11 the Windows bundle line commented out; M12 the esbuild exit check disabled (QLT-799-03). Killed: build step removed or moved, dev step removed, either CI step removed or respelled, Playwright production server, Windows line removed, `NODE_ENV` guard removed, check removed, check made to exit, reader or writer path changed |
| CI at `98698c36` | `gh pr checks 799` (run 45839134196) | Stages 1 to 11b **pass**; E2E shards 1, 2 and 3 **pass**. **Shard 4 fails** at `tests/e2e/users.spec.ts:58` ("the list … no axe violations", failed and failed on retry, 32.5 s each). This PR changes no E2E, no client code and no user data path, and that case is the person-count-sensitive one the PR body names (DL-422). It looks unrelated, but the squash needs a green run: re-run, or an owner's diagnosis |
| Build warnings | Stage 1-11b job 139975825303 log, compared with master job 139951469196 | **PR: 3 Edge Runtime warnings** (`node:fs`, `node:path`, `node:worker_threads`, traced through Edge Instrumentation). **Master: 0** (QLT-799-01) |
| Stage 11b `/estimates/[code]` (ceiling 192,500 B) | same job log | `PASS /estimates/[code] gzip 192,162`: **the same as master's 192,162 B**, 338 B inside the ceiling. No client code changed |
| Bundle made in CI | same log | `Export thread bundle: …/.next/export-worker.mjs` |
| Secrets, personal data | diff | none. Test values are invented (`invented-password`, `D:\Accucut\app`, `/srv/portal`) |

## Findings

| ID | Severity | File:line | Issue | Why (impact) | Fix | Test that catches it |
|----|----------|-----------|-------|--------------|-----|----------------------|
| QLT-799-01 | **Major** | `src/instrumentation.ts:4` | The static import of `thread-runner` (which imports `node:fs`, `node:path` and `node:worker_threads` at top level) is compiled into the **Edge Instrumentation** bundle. Every build now prints 3 warnings and "Ecmascript file had an error". Master prints none. | It breaks the file's documented rule (`:13-15`) and the pattern `onRequestError` follows (`:46`, dynamic import "for the same reason"). A clean build log is what tells a real new warning apart. The Edge bundle now holds a `worker_threads` import that would fail if it were ever loaded | Load it only on the Node branch. Either (a) make `register` async and use `const { exportThreadProblem } = await import('@/server/export/thread-runner');` inside the `NODE_ENV === 'production'` block (Next.js awaits an async `register`; the DEF-001 tests become `await expect(register()).rejects.toThrow(ExitCalled)`), or (b) keep it synchronous with Node's built-in loader and no static import: `const { existsSync } = process.getBuiltinModule('node:fs');` in a small `export/thread-file-check.ts` that builds the path with the shared `EXPORT_WORKER_OUTPUT` | A unit test that `src/instrumentation.ts` has no static import of a module importing `node:*` (read as text, like `export-bundle-paths`), or a build-log check for "Edge Runtime" in Stage 9 |
| QLT-799-02 | Minor | `src/server/export/thread-runner.ts:64` | The line's repair advice is wrong on the production install. On the Windows server there is no `npx`, `tsx`, `scripts\` or `src\` ("The server never runs npm", `package-windows.ps1:6-7`). So "run `npx tsx scripts/build-export-worker.ts` in C:\Accucut\…\app" cannot work there, and nor can `npm run build` | Normally the package cannot reach this state. But if the file is ever lost there (a partial copy, or antivirus quarantine), the one line meant to guide the operator sends them to a command that fails | Add the package remedy: `… On an installed release, install the release package again with C:\Accucut\current\update.ps1 (deploy/windows/README.md).` (whether `update.ps1` accepts the same tag again is for the developer to check, or name the next release) | `export-bundle-paths.test.ts`: the text names the package remedy |
| QLT-799-03 | Minor | `tests/unit/export-bundle-paths.test.ts:18-53` | Four mutants survive. (1) `build` with `;` instead of `&&`: the test checks only order, and with `;` a failed `next build` still ends green. (2) `playwright.sweep.config.ts:108` is a build path that is not pinned. (3) The Windows bundle line commented out (`# New-EsbuildBundle …`) passes, because `indexOf` finds the text inside the comment. (4) The esbuild exit check disabled passes, because only the `throw` strings are asserted. `nightly.yml` is not read at all | A future edit to any of these four can ship a build path without the bundle, or a package step that no longer stops, with the test green | (1) `expect(build).toMatch(/next build && tsx scripts\/build-export-worker\.ts/)`. (2) Loop over both Playwright configs. (3) Match the line anchored: `/^\s*New-EsbuildBundle -Entry 'src\/worker\/export-thread\.ts'/m`. (4) `toMatch(/if \(\$LASTEXITCODE -ne 0\) \{ throw "esbuild failed for/)` and `toMatch(/if \(-not \(Test-Path -LiteralPath \$OutFile\)\) \{ throw "esbuild wrote no file/)`. Optionally read every `.github/workflows/*.yml` | The mutants M03, M09, M11 and M12 are then killed |
| QLT-799-04 | Minor | `README.md:228` with `README.md:375` | The new Build row says "Never run `next build` alone", but the "Performance checks" section still tells the reader to run `npx next build` alone before `check-js-budget.ts`. `CLAUDE.md` §1 "Build command" has the same gap (outside this PR; see "Issues for other roles") | Two instructions in one README disagree. The measuring server also logs the new line, which may alarm the reader | `README.md:375`: `npm run build` (or add the bundle line) | Extend the README test: no line of `README.md` is exactly `npx next build` |
| QLT-799-05 | Minor | `src/instrumentation.ts:31-34` | The line is plain text on stderr, with no level and no code field, in a stream where the server's other lines are pino JSON (`src/lib/logger.ts`; coding standards §4 "structured logs", §10 "use the shared logger") | A log reader that filters JSON by `level >= 40`, or searches for `EXPORT_THREAD_MISSING` as a code field, misses it. The DEF-001 line it copies is different: that process exits at once, so nothing follows it | `logger.error({ code: 'EXPORT_THREAD_MISSING', file }, problem)`, or keep stderr and accept the DEF-001 precedent in a one-line comment | `instrumentation.test.ts` with a logger spy: one `error` record with `code` |
| SEC-799-01 | Info | `thread-runner.ts:64` | The line holds the server's absolute working folder twice (in `file` and "in ${folder}"). It is not a secret, and on the Windows install it is `C:\Accucut\releases\<tag>\app`. On a developer or demo machine it includes the OS user name (`C:\Users\<name>\…`). It goes to the local log only | none for security | Optional: name the folder once | n/a |
| QLT-799-06 | Info | `src/instrumentation.ts:31-34` | Nothing in the block can throw today (`existsSync` returns `false` on any error). But a throw here would keep the whole portal answering 500 (the DEF-001 behaviour the doc comment describes), not just Download | Robustness only | Optional: `try { … } catch { /* the check must never stop the start */ }` | n/a |
| QLT-799-07 | Info | `scripts/package-windows.ps1:126` with `scripts/lib/export-worker-bundle.ts:26-34` | Pre-existing, not from this PR: the two recipes for the same file differ. The package passes `--conditions=react-server` and the `npm run build` recipe does not | A future dependency whose `react-server` export differs could behave differently in the package and in CI | Follow-up: one recipe (have the package call `bundleExportWorker`, or pass the same conditions) | n/a |
| QLT-799-08 | Info | `tests/unit/export-bundle-paths.test.ts:44`; `instrumentation.test.ts:139` | The test title says the standalone copy "would wipe" the bundle, but robocopy `/E` (`package-windows.ps1:49`) does not purge. The order is still right, since the bundle must sit inside the copied `app`. Also, `mkdtempSync` folders are never removed | Accuracy and test hygiene | Reword to "must be made inside the package's app folder"; remove the scratch folder in an `afterEach` | n/a |
| SEC-799-02 | Info | diff | **No change to export logic, data or cost visibility (NFR-002).** `thread-runner.ts` gains only a pure function. `createThreadBuilder`, the routes, `composition.ts` and every read are unchanged. The line names no rate, figure, setting or user. No secret in the diff | none | none | n/a |

## Security notes (brief point 1 and point 4)

| Check | Result | Evidence |
|-------|--------|----------|
| Cannot crash or block start-up | **Yes** | No throw path (`existsSync` never throws); no `process.exit`; mutant M15 (exit added) is killed by `instrumentation.test.ts` |
| Logs no secret, only the file needed | **No secret.** It logs the folder as well as the file (SEC-799-01, acceptable) | `thread-runner.ts:64` |
| Production only | **Yes** | `instrumentation.ts:31`; the development, test and build-phase cases are tested (mutant M13 killed) |
| No noticeable cold-start cost | **Yes** | One `stat`; the run-time import chain is 4 small modules the first request loads anyway |
| Export logic, data and NFR-002 unchanged; no secrets | **Yes** | SEC-799-02 |

## Acceptance conformance (brief (a) to (c) → code → test)

| Item | Code | Test(s) | Status |
|------|------|---------|--------|
| (a) One clear line at production start naming the command, without stopping | `instrumentation.ts:30-34`, `thread-runner.ts:56-65` | `instrumentation.test.ts` (4 cases), `export-bundle-paths.test.ts` (3 text cases) | **Met** (QLT-799-01 build warnings, QLT-799-02 remedy wording, QLT-799-05 format) |
| (b) Tests pin that every build path makes the bundle | none changed | `export-bundle-paths.test.ts` | **Partly met**: build, dev, CI, Playwright production and the Windows package are pinned. The sweep config and nightly are not, and three assertions are weak (QLT-799-03). Docker has no path |
| (c) README note | `README.md:228` | README test | **Met** (QLT-799-04: line 375 contradicts it) |
| `/estimates/[code]` first load | none | Stage 11b | 192,162 B, the same as master, under 192,500 B |

## Issues for other roles

- **developer:** QLT-799-01 (about 10 lines), then QLT-799-02, -03 and -04 (a few lines each), in this PR if the deadline allows.
- **qa-engineer and master:** DEF-130 severity. No shipping path can ship without the bundle: the Windows package stops without it, and Docker has no path. The fault needs a manual `next build`. This supports Sev-3, not Sev-1.
- **master:** if QLT-799-01 is deferred, record it and file a `tech-debt` issue.
- **delivery lead (the owner of `CLAUDE.md`, append-only):** §1 "Build command" still reads `prisma generate && next build` and the stack row says "Docker Compose for deployment". Both are stale (ADR-015).
- **solution-architect:** the hosting release on a managed host (decided 2026-11-23) will add a new build path. It must make the bundle after `next build`, inside whatever folder the server runs in, and be added to `export-bundle-paths.test.ts`. If it serves `.next/standalone/server.js`, the bundle must be made in `.next/standalone/.next/`.

## Round 2 at `d4afb2ac` (fix commit `b2adee06`, then a merge of `master`)

**Verdict: APPROVE WITH COMMENTS.** All five findings are fixed and verified. Open: Blocker 0, Critical 0, Major 0, Minor 0, Info 5 (SEC-799-01, SEC-799-02, QLT-799-07 unchanged; QLT-799-09 and QLT-799-10 are new). There is no merge stop under §9 item 2. The squash still needs E2E shards 1 to 4 green in run 45844480678; they were pending when this was written. Only the diff since review 6076191399 was reviewed. The merge commit brings in only `master`'s #795 (task queue tabs): `git diff origin/master...d4afb2ac` holds just this PR's 6 files.

| Prior finding | Result | Evidence |
|---|---|---|
| QLT-799-01 Major | **Fixed** | `register()` is now `async`. `thread-runner` and the logger are loaded with `await import(...)` inside the `NEXT_RUNTIME === 'nodejs'` and `NODE_ENV === 'production'` block. **Stage 9 of run 45844480678 (job 139994634087, checkout of merge `c5c54fb`): 0 "Edge Runtime" / "build encountered" / "Ecmascript file had an error" lines, the same as master.** New unit test: the static imports are exactly `@/lib/env` and `next` (mutant "static import re-added" killed) |
| QLT-799-02 Minor | **Fixed** | `thread-runner.ts:64` gives a source-folder repair and an installed-Windows-release repair (`C:\Accucut\current\update.ps1`, the next release; the running release is refused). Pinned in `instrumentation.test.ts` |
| QLT-799-03 Minor | **Fixed** | The round-1 survivors are now killed: M03 `;`, M09 sweep config, M11 commented-out line, M12 disabled exit check (mutation run on a scratch `git archive d4afb2ac`, baseline 26 of 26 green) |
| QLT-799-04 Minor | **Fixed** | `README.md:375` is now `npm run build`. A README test refuses any line that is exactly `npx next build` |
| QLT-799-05 Minor | **Fixed** | `logger.error({ code: 'EXPORT_THREAD_MISSING' }, problem)` (pino, structured). The block sits in a `try`/`catch`. A throwing logger leaves the start untouched (test; mutant "catch removed" killed) |
| QLT-799-06 Info | **Fixed** | the `try`/`catch` above |
| QLT-799-08 Info | **Fixed** | Test title reworded; scratch folders removed in `afterEach` |
| SEC-799-01, QLT-799-07, SEC-799-02 Info | Unchanged (they need no action) | |

**Checks asked for in round 2**

| Check | Result | Evidence |
|---|---|---|
| Edge build | **0 Edge Runtime warnings, the same as master** | job 139994634087 log, `grep -cE "Edge Runtime\|build encountered\|Ecmascript file had an error"` = 0; `✓ Compiled successfully`; `Export thread bundle: …/.next/export-worker.mjs` |
| Env-check exit before any `await` | **Yes, by reading the code** | `src/instrumentation.ts`: `loadAppEnv()`, `loadExportEnv()` and the `catch` with `process.stderr.write` and `process.exit(1)` all come before the first `await import(...)`. An async function runs synchronously up to its first `await`, so the exit is as immediate as before. **Not pinned by a test** (QLT-799-09) |
| Stage 11b `/estimates/[code]` | **192,162 B**, the same as master and round 1, 338 B under 192,500 B | same job: `PASS /estimates/[code] gzip 192,162` |
| Unit tests at the head | 68 of 68 passed: `export-bundle-paths`, `instrumentation`, `export-timeout-setting`, `export/thread` (worktree `aqp-403`, read-only) | |
| NFR-002, export logic, secrets | Unchanged; none | the diff touches only the start-up check, its text, tests and the README |

**New findings (Info only)**

| ID | Severity | File:line | Issue | Fix (optional) |
|---|---|---|---|---|
| QLT-799-09 | Info | `tests/unit/instrumentation.test.ts` (DEF-001 cases) | "The exit is made before any `await`" is a claim in the doc comment but not a test. A mutant that adds `await Promise.resolve()` before `loadAppEnv()` survives, because the tests `await` the rejection. The behaviour is the same today, since Next.js awaits `register()` before it serves | `const pending = register(); expect(exit).toHaveBeenCalledWith(1); await expect(pending).rejects.toThrow(ExitCalled);` |
| QLT-799-10 | Info | `src/instrumentation.ts` (the empty `catch`) | If the dynamic import itself fails, nothing is written at start-up. This is intended (the check must never stop the start), and the export's own per-request error still logs `EXPORT_THREAD_MISSING` or `FAILED`. Coding standards §1 asks for no silent swallow; the comment explains this one | Optional: `process.stderr.write('The export bundle check could not run.\n')` in the `catch` |
