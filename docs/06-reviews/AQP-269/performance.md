# Review Report — AQP-269 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...fix/AQP-269-dialog-focus-jump` (PR #167; also covers AQP-270 and AQP-271, DEF-024 to DEF-026) |
| Commit reviewed | 69805d1 (base 322cd8e) |
| Date | 2026-11-10 |
| **Verdict** | **APPROVE** |

## Summary
The fix moves focus on a refusal through one request held in state, instead of an effect keyed on the errors object. A key press no longer runs any effect from this hook, so the per-key work goes down, not up. First-load JavaScript for the three screens is unchanged to within 3 bytes. The nine new E2E instances cost 23.9 s of worker time in total, of which 10.1 s is on shard 3, the shard that sets the CI path. That is about 2.5 s of path (estimate), against a spread between shards of about 70 s on this very run. The cost is proportionate to the story. One Info finding records the measured cost for the path ledger; nothing is asked of the story.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 1 |

## Checks Run
Nothing was run locally (machine limit). Evidence is the diff, the CI logs of run 42852617579 and the GitHub API.

| Check | Command | Result |
|-------|---------|--------|
| Diff read in full (7 files) | `gh pr diff 167` | Hook of 30 lines added, three duplicated effects removed, three E2E tests added |
| Stage 11b JS budget | `gh run view 42852617579 --log` | 9 of 9 rows pass; see the table below |
| Stage 12 per shard, per new test | same log, `✓ … (Ns)` lines | Seconds per instance below; 5 of 5 jobs green, no flaky, no retry |
| Cache states | same log | Hit on `node_modules`, Next.js build cache, Playwright browsers and system packages in every job; no miss or fallback, so the run is a hit run |
| Baseline for the JS budget | `gh run view 42849365337 --log` (head a6bf7f2 of AQP-123, whose squash is base 322cd8e) | Used as proxy: the base's own run, 42850365032, is still in progress and has no log yet |
| Run-to-run comparison | step times of runs 42846533197, 42847539067, 42849365337 | See "CI cost" |

## 1. Render cost of `useFocusOnRefusal` (reasoned from the code; render counts not measured)
| Moment | Before (effect on `[errors]`) | After (effect on `[request]`) |
|--------|-------------------------------|-------------------------------|
| Each key in a field that has a message | `setErrors` makes a new object, so the effect ran: a `find` over 3 to 4 field names and a `getElementById` or a ref read, and, in the fault, a `focus()` on the next refused field | No hook work. `request` does not change, so the effect does not run, and the hook adds no state update |
| Each key in a field without a message | Effect ran only if `setErrors` returned a new object | No hook work |
| A refusal (submit or server answer) | One `setErrors`, one effect | `setErrors` plus `setRequest({ field })`, one extra state update batched in the same commit (React 19.3.1 batches after an `await` as well), then one effect and one `focus()` |

- Re-renders per key stay what they were: the dialog re-renders for its own `setValues` and `setErrors`. The hook adds none, and its state is read only by its own effect.
- `useEffectEvent` keeps `focusField` out of the dependency list, so the effect cannot re-run because a form passed a new arrow function on each render. The returned function is a new closure on each render. It is called only from handlers in the three forms (no `memo` child, no dependency array), so that costs nothing.
- Allocation: one `{ field }` object per refusal; in the user dialog one 4-entry object per call to `focusField`. Both are on a path that runs a few times per form.
- A second refusal of the same field makes a new object and so moves focus again; that is a correctness point, and it costs one extra commit only on a refusal.
- No timer, listener or cache is added, so there is nothing to leak.

## 2. First-load JavaScript (NFR-009, stage 11b, limit 200,000 B gzip)
| Route | Base proxy (a6bf7f2) | This head (69805d1) | Change | Headroom now |
|-------|----------------------|---------------------|--------|--------------|
| `/masters/materials` | 187,115 | 187,115 | 0 | 12,885 |
| `/masters/process` | 173,881 | 173,879 | -2 | 26,121 |
| `/users` | 170,136 | 170,139 | +3 | 29,861 |

The three routes are unchanged to within 3 bytes. The hook is small, and the three removed effects offset it, so no dependency is added. `/masters/materials` is the thinnest at 6.4 % headroom; that is the standing position of the route and not caused by this story.

## 3. CI cost of the 9 new instances (run 42852617579, hit run)
Seconds per instance, from the `✓ … (Ns)` lines:

| Shard (mostly) | Materials DEF-024 | Process DEF-025 | Users DEF-026 | Worker time added | E2E step of the shard |
|----------------|-------------------|-----------------|---------------|-------------------|-----------------------|
| 1 (mobile 360) | 2.0 | 2.0 | 2.8 | 6.8 s | 2:43 |
| 2 (tablet 768) | 1.8 | 2.2 | 3.0 | 7.0 s | 2:52 |
| 3 (desktop 1366) | 2.7 | 2.9 | 4.5 | 10.1 s | 3:57 |
| Total | | | | **23.9 s** | |

- **Path.** Shard 3 ended at 16:19:52, about a minute after shards 1 and 2 (16:18:52 and 16:18:55), so shard 3 sets the path of 5:05 (16:15:04 to 16:20:09). Instances on shards 1 and 2 add nothing to the path.
- **Added to shard 3.** 10.1 s of worker time over 4 workers with `fullyParallel` is about 2.5 s of wall time if the work packs evenly (estimate), and 10.1 s at the very most. That is 0.8 % to 3.3 % of 305 s. As a per-instance figure it is about 0.8 s of path per desktop instance. The ledger of test strategy section 10.5 uses 0.47 s (estimate), which would give 1.4 s for these three. These tests are heavier than the average, because each opens a dialog, submits, types and tabs.
- **Runner variance in the same run.** The same set-up tests (same code on every shard) took 22.5 s on shard 1, 23.8 s on shard 2 and 29.2 s on shard 3, so the runner of shard 3 was about 6 s slower before any new test ran. Desktop table-action tests on shard 3 took 8.5 to 9.4 s each.
- **Spread of the same shard in earlier runs.** E2E step times, with different test sets, so this is a spread and not a clean control: shard 1 at 3:21 to 3:47, shard 2 at 2:12 to 3:27, shard 3 at 2:53 to 3:51 (runs 42846533197, 42847539067, 42849365337). This run has more tests than those, and shard 1 is faster (2:43) than in any of them, while shard 3 is the slowest of the four (3:57). A move of 2.5 s cannot be read out of a spread of 60 to 90 s, and I do not claim to.
- **Against 5:00 and 5:30.** 5:05 is one first-attempt reading, not the median of five hit runs that test strategy v0.30 section 10.5 item 9 asks for, so it does not count against either line. If it were read as it stands, it is 25 s under 5:30, and the story's share of that is at most 2.5 s (about a tenth). AQP-244 is measuring the path now (base 322cd8e, head PR #166); RISK-023 stays at 6 (DL-134), and this story gives no reason to change it.
- **No cut is available inside the story.** The tests press Tab, which section 10.5 counts as focus order, so they are not eligible for `@one-width`; and tagging in a feature PR is out of scope there ("any `@one-width` tag or pin change"). Nine instances is the rulebook's number for three widths.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Info | `tests/e2e/materials.spec.ts:181` (same shape at `process-master.spec.ts:136`, `users.spec.ts:142`) | Test strategy 10.5 (ledger of path per instance); RISK-023 | Keyboard-typing dialog tests measured 1.8 to 4.5 s each, about 0.8 s of path per desktop instance, against the ledger's 0.47 s (estimate, one run) | 9 instances add 23.9 s of worker time and at most about 2.5 s of path; proportionate | None for this story. For the solution-architect and AQP-244: use about 0.8 s per instance for tests that open a dialog, type and tab, when the ledger is next updated |

## NFR impact
| NFR / line | Risk | Findings |
|------------|------|----------|
| NFR-009 (first-load JS ≤ 200,000 B gzip per route) | None: 0, -2 and +3 B on the three routes; `/masters/materials` headroom stays 12,885 B | none |
| NFR-016 (E2E at three widths) | None: three tests per dialog run at 360, 768 and 1366 px | PRF-01 (cost only) |
| RISK-023 / test strategy 10.5 (CI path; not an NFR) | Low: at most about 2.5 s of path (estimate); the reading is AQP-244's | PRF-01 |

## Not applicable
Algorithmic complexity (loops of at most 4 fields), database access, I/O and network, caching, concurrency and observability: the diff touches none of them.

## Previous Findings (re-review only)
None; this is round 1.

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE
- Findings: Blocker 0, Critical 0, Major 0, Minor 0, Info 1 (PRF-01)
- Open questions: none
- Risks raised: none new; RISK-023 unchanged
- Recommended next agent: master (G6 decision, with the standards and quality reviews)
