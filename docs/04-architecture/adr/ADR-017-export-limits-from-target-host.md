# ADR-017: Export time and memory limits, set from the target-host reading

| Field | Value |
|-------|-------|
| Status | Accepted (2026-11-21, solution-architect, hardening window, CLAUDE.md section 9 item 3; for `master` to log) |
| Date | 2026-11-21 |
| Deciders | solution-architect (+ Santhosh, delivery lead, at G8: G8-C-NFR10 and OQ-PM-05) |
| Related | NFR-010, NFR-011, NFR-012, RISK-010, RISK-032, ADR-012, ADR-015, architecture section 4.6 and section 9.9; GitHub [#575](https://github.com/sankumar76/Accucut-Quotation/issues/575) (PRF-F-04), [#410](https://github.com/sankumar76/Accucut-Quotation/issues/410) (PRF-F-06), [#576](https://github.com/sankumar76/Accucut-Quotation/issues/576); DL-271, DL-275, DL-276 |

## Context

The export builds the whole workbook in memory, in a `node:worker_threads` thread (ADR-012, `src/server/export/thread-runner.ts`). As built at `master` 242c21f7:

- At most 2 builds at once (`DEFAULT_MAX_THREADS`), and at most 1 for an estimate over 100 parts (`DEFAULT_MAX_LARGE`, `LARGE_EXPORT_PARTS`). Any other request gets 503 `EXPORT_BUSY` with `Retry-After: 10`.
- Each thread may grow its heap to 512 MB (`DEFAULT_HEAP_LIMIT_MB`, `resourceLimits.maxOldGenerationSizeMb`).
- A build is ended after 120 s (`DEFAULT_TIMEOUT_MS = 120_000`), and the caller gets 500 `EXPORT_THREAD_TIMEOUT`.
- All three are code constants. `src/server/composition.ts:501` passes only `entry`.
- The Windows service `AccucutApp` (`deploy/windows/services/AccucutApp.xml`) sets no heap limit for the main thread. The "1.5 GB `app` limit" in section 3 is the retired Docker sizing. WinSW 2.12.0 has no memory cap of its own.

**Measured** (DL-271, STORY-07.05, AQP-335). Delivery PC: i7-10510U, 24 GB, Windows 11, Node 24, PostgreSQL 17 in Docker. The service-level `getFile` was timed, which means snapshot, picture reads and the thread build together.

| Case | Result |
|------|--------|
| AC-1: 50 nodes, 50 pictures, 20 runs | p95 2.85 s, against the 10 s NFR-010 line |
| AC-2: 500 nodes, 500 pictures of 199 KB, 5 runs | 14.3 to 67.4 s, median about 22 s (the PC was shared). File 97.5 MB. Peak resident 0.8 to 1.05 GB. Every run completed under the 512 MB thread heap |
| AC-3: two exports at once | One file and one 503. Slowest responsiveness probe 32 ms |

**Not known.** The target host's CPU, and whether its RAM matches A-39 (Windows Server 2022, x64, 8 GB RAM). G8-C-NFR10 (b) re-reads AC-1 and AC-2 on the target host or the rehearsal machine. That reading may arrive after the freeze (about 30 Nov), and any code merge after the freeze needs a new regression pass (DL-275 (B)).

**What the review found** (PRF-F-04, Major). The slowest run is 56 % of the 120 s timeout. A host about 2x slower would turn the largest exports into a 500, after holding a place and about 1 GB for two minutes. That is an estimate, not a measurement. The same review asked for a heap limit on the service (PRF-F-06, #410), because unbounded request bodies and an export can add up on an 8 GB host.

## Decision Drivers

- **NFR-010.** 50 nodes with 50 pictures in 10 s. It is met as evidence, with a 3.5x margin. Nothing here may slow it.
- **NFR-011.** 500 nodes per estimate are supported, so the largest export must complete rather than fail on a slower host.
- **NFR-012.** Availability. One export must not page the host or starve PostgreSQL. If the app process does fail, WinSW restarts it in 10 s.
- **RISK-010.** Restated at 4 by DL-271, with OQ-PM-05 still open, as the delivery lead's question.
- **The freeze.** A figure that depends on a reading taken after the freeze must be changeable on the host without a new build.
- **Simplicity.** No new dependency and no new moving part before G8.

## Considered Options

### Option A: Keep the in-memory build, and derive the timeout and the memory figures from the target-host reading (chosen)

- Pros:
  - One setting and one service argument change; no change to the export code path.
  - Fits every measured figure: no run failed, and the gate holds a second large build off.
  - The timeout can follow the reading after the freeze, through `.env`.
- Cons:
  - The largest exports stay slow (a wait on the Building state), and the app still holds the file twice while it answers.
  - The memory figures are a budget built from the parts, not a measurement on the target host, until QA reads it there.
- Cost / effort: about 2 hours for the developer (setting, service argument, two tests). QA's reading is already in G8-C-NFR10.

### Option B: Cap the export (refuse above a part or picture count, or a byte estimate)

- Pros: it bounds both time and memory.
- Cons:
  - It refuses a size that NFR-011 says is supported.
  - No stated NFR is broken today (DL-271 ruling B).
  - It is a scope change for the product-manager, and it waits on OQ-PM-05.
  - It needs new words on SCR-10.
- Cost / effort: a code story with UX words, about 1 day, and a scope decision.

### Option C: Stream the build (ExcelJS `stream.xlsx.WorkbookWriter` to a temporary file, then a streamed response)

- Pros: it removes both in-memory copies of the file, and keeps the thread's memory near flat.
- Cons:
  - It is a rewrite of `build-workbook.ts` and `file-response.ts`, with temporary files in a folder the service account can write.
  - Picture embedding and the NFR-027 file-fidelity checklist must be proven again in streaming mode.
  - It does not make the build faster.
  - It is a large change in the last week before G8.
- Cost / effort: about 2 to 3 days, plus a combined review and a new full regression.

## Decision

Option A. Options B and C wait for a trigger, listed under "When to revisit". Streaming stays after G8 (DL-276 ruling 3), unless OQ-PM-05's answer asks for more.

### 1. The export timeout becomes a bounded setting

- **The setting.** `EXPORT_TIMEOUT_SECONDS` in `.env`.
  - It is read through a new `exportEnvSchema` in `src/lib/env.ts`: `z.coerce.number().int().min(120).max(300).default(240)`.
  - It is added to `ENV_VARIABLE_NAMES` and to `.env.example`, with the line `EXPORT_TIMEOUT_SECONDS=240` and a comment pointing to this ADR.
  - `composition.ts` passes `timeoutMs: seconds * 1000` to `createThreadBuilder`. `DEFAULT_TIMEOUT_MS` stays as the builder's own fallback for tests.
  - A value outside 120 to 300 fails the start loudly, as every other `.env` value does.
- **Why a setting, when the pool sizes are constants (v0.14).** The pool sizes depend on the code. This figure depends on the host, and its reading may come after the freeze. Changing one line in `.env` on the target host needs no new build and no new regression. Every other export limit stays a constant.
- **The rule.** Let `t_max` be the slowest of the 5 AC-2 runs in the target-host reading, in seconds (`npm run test:perf`, `export-500.test.ts`, one file at a time, as QA runs it for G8-C-NFR10 (b)).

  | Reading | `EXPORT_TIMEOUT_SECONDS` |
  |---------|--------------------------|
  | `t_max` ≤ 80 s | **240**, the shipped default, so nothing changes |
  | 80 s < `t_max` ≤ 100 s | 3 × `t_max`, rounded up to the next 30 s (at most 300) |
  | `t_max` > 100 s | **300**, plus a revisit trigger (see "When to revisit") |
  | No reading by the freeze | **240** ships. The reading, when it comes, applies the rule on the host |

  **Why 3x the slowest run.** On one machine the spread was 4.7x from the fastest to the slowest run, and the slowest was about 3x the median. So 3x the slowest of five covers a busy day on the same host with room to spare.

  **Why 240 as the default.** It is 3.5x the delivery PC's slowest run (67.4 s), which allows for a target host slower than that PC.

  **Why not more than 300.** Past 5 minutes on the Building state, a person is better served by a refusal they can act on than by a longer wait. The proxy and browser timeouts also grow less predictable.
- **The proxy must wait longer than the build.** Its response timeout is at least `EXPORT_TIMEOUT_SECONDS` + 60 s, so the proxy never cuts a file that the thread is about to give. The install guide sets **360 s** for IIS, which covers the largest allowed setting. Caddy has no response timeout by default, and the guide sets none (`deploy/windows/README.md`, "Reverse proxy").

### 2. The app service gets a main-thread heap limit; the thread limits stay

- **`AccucutApp.xml`.** `<arguments>--max-old-space-size=1024 --env-file="{{ENV_FILE}}" server.js</arguments>`. The value is fixed in the release, not in `.env`, because `.env` is shared with the worker. `AccucutWorker.xml` is unchanged.
- **The thread heap stays 512 MB.** Every 500-node run completed under it. `maxThreads` stays 2, `maxLarge` 1 and `LARGE_EXPORT_PARTS` 100. These stay code constants.
- **The memory budget for the host.** The app ceiling is about **2.75 GB**:
  - 1,024 MB main heap;
  - 2 × (512 MB heap + about 64 MB young generation and code) for the threads;
  - about 350 MB outside the heaps, for one large build: about 100 MB of pictures in the model, and the 97.5 MB file held by the thread and again by the response, plus one small build;
  - about 150 MB of Node baseline.

  The rest of the host:

  | Part | About |
  |------|-------|
  | Worker and proxy | 0.4 GB |
  | PostgreSQL, at Windows installer defaults, 15 pool connections | 0.5 to 1 GB |
  | Windows Server 2022 with Desktop Experience | 2 to 2.5 GB |
  | **Total with the app** | **about 6.2 GB** |

  That fits A-39's 8 GB and leaves file cache. **8 GB is therefore the minimum supported RAM.** The ceiling is a worst case; the main heap normally runs far below 1 GB.
- **The rule from the reading.** QA records, from the same AC-2 output, the "largest process increase" (`ΔR`, what one large export adds to the process). QA also records the host's installed RAM, and the peak working set of `AccucutApp` after the 25-user load run (STORY-10.09, PRF-F-01), read with `Get-Process -Id (Get-CimInstance Win32_Service -Filter "Name='AccucutApp'").ProcessId | Select-Object PeakWorkingSet64`.
  - `ΔR` ≤ 1.5 GB, the load-run peak ≤ 512 MB, and RAM ≥ 8 GB: **nothing changes**.
  - The load-run peak above 512 MB: the main heap becomes the peak × 2, rounded up to 256 MB, and at least 1,024. It is a one-line fix to the service file, so a release with a new regression. Re-check the budget against the RAM.
  - `ΔR` above 1.5 GB, a run ended with `EXPORT_THREAD_EXITED` or `EXPORT_THREAD_FAILED`, or RAM below 8 GB: a revisit trigger (see below). The interim fix for a thread ended by its heap is `DEFAULT_HEAP_LIMIT_MB` = 768, which adds 0.5 GB to the ceiling and stays within 8 GB.
- **If the main heap is ever exhausted,** V8 ends the process and WinSW restarts it after 10 s (NFR-012). One process restart is the accepted failure mode. A host that pages, slowing PostgreSQL and every user, is not.

### 3. The request body cap (#410, PRF-F-06) is set at both layers

- **The proxy.** It refuses any request body over **1 MB** (Caddy `request_body max_size 1MB`; IIS `maxAllowedContentLength="1048576"`). This is the outer layer, and the install guide sets it. The largest known legitimate body is a picture upload: 256 KB plus multipart framing (`upload.ts`).
- **The app.** `experimental.proxyClientMaxBodySize` in `next.config.ts` is set by the developer in #410's lane. The value is 2x the largest legitimate JSON body they find by sizing each body route. It is at least 512 KB and at most the proxy's 1 MB, so the app normally decides first. If the sizing finds a legitimate body over 512 KB, both caps become 2x that body, rounded up to whole MB, in the same pull request, and the install guide's figure changes with them.

### 4. When to revisit (B or C becomes due)

Any one of these makes the cap (B) or streaming (C) a scope item for the product-manager and the solution-architect, not a hardening fix. It is listed at G8, and the delivery lead decides it.

1. `t_max` > 100 s on the target host.
2. `ΔR` > 1.5 GB, or a 500-node run ended by the thread heap at 768 MB.
3. The target host has less than 8 GB of RAM.
4. OQ-PM-05's answer names a larger realistic estimate than 500 nodes with pictures, or a time target at that size.

## Consequences

- Positive:
  - The largest export cannot be cut by a timeout set for a faster machine.
  - The app can no longer grow its main heap until the host pages.
  - The proxy, the thread and the browser agree on who waits longest.
  - The reading can be applied on the host after the freeze.
- Negative / trade-offs accepted:
  - The largest exports stay slow, a 97.5 MB file is held twice in memory, and a second large export waits for the first (503 `EXPORT_BUSY`).
  - A thread that hangs now holds its place for 240 s rather than 120 s. Only one large place exists, so a hung large build blocks other large exports for 4 minutes at most.
  - One more `.env` setting.
- Follow-up actions (with owners):
  1. Developer, in the next free lane (DL-276 ruling 5, "small config edits join the next free lane"):
     - add `EXPORT_TIMEOUT_SECONDS` (env schema, `ENV_VARIABLE_NAMES`, `.env.example`, composition), with a unit test of the bounds and of the value reaching the builder;
     - add `--max-old-space-size=1024` to `AccucutApp.xml`, pinned in `tests/unit/windows-deploy-files.test.ts`;
     - the service-file items of the install guide's checklist (`KEEP_ALIVE_TIMEOUT`, see "Reverse proxy");
     - correct the stale "clean-logs.ps1" comment in `AccucutApp.xml` while there.
  2. Developer, #410 lane: `proxyClientMaxBodySize` as in Decision 3.
  3. qa-engineer, for G8-C-NFR10 (b): record `t_max`, `ΔR`, the RAM, the load-run peak and the machine in the release notes, and apply the two rules. A changed `EXPORT_TIMEOUT_SECONDS` is written into `.env` on the target host by the IT person (one line; restart `AccucutApp`) and recorded in the release notes.
  4. Orchestrator: a trigger in "When to revisit" goes to the delivery lead as a G8 decision, one question at a time (section 9 item 7).

## Verification

- **Unit tests:**
  - the setting's bounds, where 119 and 301 fail the start, and absent gives 240;
  - `composition` passes `timeoutMs` of 240,000 when unset;
  - the service file's arguments hold `--max-old-space-size=1024` before `--env-file`.
- **Existing tests stay green:** `thread-runner` timeout and the 512 MB heap tests, and `tests/perf` AC-3 (one file and one 503).
- **The target-host reading (G8-C-NFR10 (b)):**
  - AC-1 p95 ≤ 10 s, or it is a defect;
  - AC-2's `t_max` and `ΔR`, with the rules above applied and recorded;
  - one 500-node export through the public address completes, not cut by the proxy.
- **Review date:** at G8. Again if the host changes, or if OQ-PM-05 is answered.
