# DEF-142: Next 16.4.5 Turbopack dev-server panic 'transient_ref_count underflow' aborted the E2E server mid-shard (#824's PR run 45950934549, shard 1: 402 failed) (Environment; Sev-3 proposed; Jira AQP-499, GitHub #826)

| Field | Value |
|-------|-------|
| Story / AC | CI tooling (the E2E web server is `next dev` on Next 16.4.5 with Turbopack); RISK-031 (E2E under load); seen on #824 (DEF-140's split) |
| Severity | **Sev-3 proposed by QA; master grades** |
| Priority | P3 (Jira Medium; labels `sev-3`, `environment`, `ci`) |
| Type | **Environment** (an upstream tooling panic; not shown to be product) |
| Status | **Open (new), 2026-11-27 (qa-engineer).** No owner yet; master assigns. |
| Jira / GitHub | [AQP-499](https://sankumar76.atlassian.net/browse/AQP-499) / [#826](https://github.com/sankumar76/Accucut-Quotation/issues/826) (labels bug, sev-3, ai-delivery; Jira also aiid-DEF-142, agent-qa-engineer, environment, ci). Searched first: JQL on `aiid-DEF-142` and the panic text, and a GitHub search: nothing earlier. |
| Found by / date | qa-engineer, 2026-11-27, from #824's PR run log, after the orchestrator's question about 'destination stream errored' |
| Build / commit | #824 head `ad241979` (based on `ffd02f7d`; test-only change to `approve-override.spec.ts`), CI 45950934549 |
| Environment | CI, `Stage 12: E2E (shard 1 of 4)` (Chromium at three widths, `next dev` on port 3100) |

## What happened
At 06:22:25Z, during `compact-layout.spec.ts:162` [mobile], the web server printed: `thread '<unnamed>' (3895) panicked at turbopack/crates/turbo-tasks-backend/src/backend/operation/mod.rs:1293:14: transient_ref_count underflow`, `note: run with RUST_BACKTRACE=1 ...`, `fatal runtime error: failed to initiate panic, error 5, aborting`. The server died. Every later test in the shard failed: the first at 30 s (`apiRequestContext.post` to `/api/v1/config/versions/<id>/revert` in `checkpoints.spec.ts:251`, spec line 260), the retries on `page.goto: net::ERR_CONNECTION_RESET at http://localhost:3100/config/fields`. **Shard 1: `402 failed, 7 skipped, 23 did not run, 168 passed (9.2m)`**: among them `checkpoints:251`, `compact-layout:135`, `config-fields:40/:70/:85/:119/:142/:154`, `cost-details:205/:320` and about 390 more, none of them touched by the PR. Shards 2 and 3 were clean (`581 passed (14.9m)`, `595 passed (13.1m)`); shard 4 `1 failed, 3 flaky, 22 skipped, 574 passed (21.6m)`: `estimate-tree-names.spec.ts:327` [desktop] (the known press case) and the DEF-085 family (`estimate-form-choice:88`, `:109`, `estimate-form-sections:64`).

## Not the 'destination stream errored' lines (the orchestrator's question)
`[WebServer] Error: The destination stream errored while writing data` and `Error: aborted` / `uncaughtException` lines are present on **every log QA holds, in every shard**, including green `master` pushes. Counts of 'destination stream errored' per shard (1, 2, 3, 4): `c30b349f` 4 3 5 1; `0cce6691` 7 5 3 2; `d5e352f9` 2 3 5 2; `7753cdff` 5 5 5 2; #800's run of record 2 6 5 0; `2e11c44d` 3 3 1 0; `1b30b17f` 4 6 5 0; `73143e7e` 2 3 3 0; #812's run 2 6 4 1; `ffd02f7d` 3 4 2 0; #824's run 2 3 4 1. They are the dev server's log of a browser closing a stream, **a known background signature, not a failure**. **The panic line (`transient_ref_count underflow`, `turbo-tasks-backend`) appears in none of the other 26 logs** (11 older, 5 in between, #800's run of record, `2e11c44d`, `1b30b17f`, `73143e7e`, #812's run, `ffd02f7d`, the reference run): **new, one occurrence.**

## Impact and handling
A PR run goes red with hundreds of failures for a reason that has nothing to do with the diff; **no R-rule covers it** (R18 and R19 need the only failures to be the named toolbar and shard-3 cases); DL-436 forbids merging on red, so a re-run of the failed shard job is the only way forward, and it needs master's allowance. On a `master` push it would block every merge (and could not be re-run). **Proposed:** (1) Sev-3, Environment, master grades; (2) a narrow PR-run-only re-run allowance, one re-run of the failed shard job per head when the log shows the `transient_ref_count underflow` panic followed by `ERR_CONNECTION_RESET` failures (an objective signature), recorded on RISK-031's re-run list, never for a `master` push; (3) QA counts the panic across all logs it reads and reports a second occurrence the same day. **Suspected area:** the Turbopack dev server's task backend (an upstream panic). **Not shown:** the cause. QA suggests a search of the Next.js and Turbopack trackers for the exact panic string (no project data sent) and whether a patch release after 16.4.5 fixes it; whether CI should serve the E2E run from a production build is a CI tooling change that section 9 (4) freezes until after G8 (master's call).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Graded (type, severity, owner) | master | | |
| Re-run allowance ruled | master | | |
| Upstream search and version check | developer | | |
| Verified (no second occurrence in N logs) | qa-engineer | | |

## Records
Jira Bug AQP-499 and GitHub issue #826, created 2026-11-27 and cross-linked; test plan 0.3.119. Related: RISK-031, DEF-140 and #824 (held, DL-451), DEF-085 (the shard-4 flaky family seen in the same run).
