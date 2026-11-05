# Review Report — AQP-169 — Performance

| Field | Value |
|-------|-------|
| Reviewer | reviewer-performance |
| Review round | 1 |
| Base…branch | `master...feat/AQP-169-nfr-009-guards` (PR #70) |
| Commit reviewed | 4ffc016 (updated from master); figures from CI run 41927088763 at 51b0954 |
| Date | 2026-11-04 |
| **Verdict** | APPROVE |

## Summary
STORY-10.10 automates the first-load JS budget (stage 11b on every PR) and adds a nightly Lighthouse and CI-time run. The budget check's figures match my own measurements, and its calibration at 6f66b97 reproduces to within 3 bytes. Stage 11b takes about 2 s and every wait in it is bounded. The CI job's p95 is 5 min 20 s against the 10-minute target. `@lhci/cli` has no measurable effect on install time once the npm cache is warm. No file under `src/` changed, so first-load JavaScript is unchanged. The one gap to carry forward: `KEY_SCREENS` is empty, so the Wi-Fi LCP and TBT gate asserts nothing until the queue story adds its screen.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Diff scope | `git diff 9d924a1 4ffc016` | CI, nightly workflow, scripts, tests, `lighthouserc.cjs`, `package.json` (+`@lhci/cli` dev), lockfile; nothing under `src/` |
| Stage 11b output | `gh run view 41927088763 --log` | `/` 197,116 (headroom 2,884); `/design-system` 404 as required; `/queue` 198,229 (1,771); `/sign-in` 160,490 (39,510); not-found 135,547 (64,453) |
| Calibration build | One Turbopack production build of 6f66b97 in a throwaway detached worktree under `.claude/worktrees/`. Only that worktree's config was changed (`turbopack.root` set to the repository, type-checking skipped), and it was removed afterwards | `/` 184,591 B (story 184,594); not-found 135,094 B (story 135,094) |
| Counting method | Read `scripts/lib/js-budget.ts` | `<script src>` without `nomodule`, plus `<link rel=preload/modulepreload as=script>`, deduplicated, gzip -9, read from `.next/static`. Inline RSC payload not counted |
| Bounds | Read `scripts/next-server.ts`, `scripts/lib/js-budget-http.ts` | Server ready within 90 s (polls every 250 ms, 2 s per poll); 30 s `AbortSignal` per request |
| CI time | `gh api .../actions/runs/<id>/jobs`, 17 first-attempt PR runs (41863891642 to 41930320078) | Job median 237 s, p95 320 s (5 min 20 s); this PR 3 min 57 s; step 11b 2 s |
| Install time | Stage 1 step timings in the same runs | This branch 17 to 18 s warm and 41 s cold (new lockfile); other branches 11 to 62 s (median about 22 s) |
| Lighthouse config | Read `lighthouserc.cjs`, `nightly.yml` | Wi-Fi 40 ms / 10,240 kbps / 4× CPU, Slow 4G 150 / 1,638.4 / 4×, 5 runs, median assertions on Wi-Fi key screens only; nightly at 01:17 UTC, 45 min limit, not a required check |
| Lighthouse run, tests | n/a | Not run: the machine is in use for the phone check |

**First-load JS: the check against my measurements (bytes, gzip -9)**

| Row | Stage 11b | Mine | Source of mine |
|---|---|---|---|
| `/` | 197,116 | 197,138 | AQP-38 review build (client code same as master) |
| `/queue` | 198,229 | 198,249 | Same |
| `/sign-in` | 160,490 | 160,502 | Same |
| not-found | 135,547 | n/a | Not rebuilt; consistent with the calibration |
| `/` at 6f66b97 | 184,594 (story) | 184,591 | Today's calibration build |
| not-found at 6f66b97 | 135,094 (story) | 135,094 | Same |

I count from the build manifests, not the HTML. My worktree path adds 0 to 27 B to the chunks. `/` and `/queue` equal the AQP-38 developer's HTML counts to the byte. A count that took every chunk URL from the inline flight payload would give 224,111 B for `/` at 6f66b97, because it picks up the `nomodule` polyfills and lazy chunks; the script's rule rightly leaves those out.

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| PRF-01 | Info | `scripts/lib/js-budget.ts:15` | NFR-009; test strategy 10.1; AC-1, AC-2 | The figures and the calibration verified by an independent method | The gate counts the right files; RISK-020's "no check" cause is closed | None |
| PRF-02 | Info | `.github/workflows/ci.yml:199` | Test strategy 10.3 | Stage 11b about 2 s; bounded by a 90 s ready limit and 30 s per request. The step comment says it "adds well under a minute" | No effect on the 10-minute p95 (5 min 20 s over 17 runs) | None (the comment is conservative) |
| PRF-03 | Info | `package.json:45` | Coding standards §7 (dependencies) | `@lhci/cli` dev dependency, about 3,370 lockfile lines | Install unchanged once the npm cache is warm; one cold run 41 s | STORY-10.04: build the image with `npm ci --omit=dev` (or prune) |
| PRF-04 | Info | `lighthouserc.cjs:32` | NFR-009 (LCP ≤ 2 s, TBT ≤ 200 ms); test strategy 10.2 | `KEY_SCREENS` is empty, so the Wi-Fi assertion step asserts nothing; `/` is report-only (first nightly: LCP 275 ms, TBT 21 ms) | LCP and TBT are not enforced until a key screen is listed | The first key-screen story (queue) adds `/queue` to `KEY_SCREENS`; put it in that story's definition of done |

## Reviewer-specific tables
**Performance: NFR impact**

| NFR | Risk | Findings |
|-----|------|----------|
| NFR-009 first-load JS ≤ 200,000 B | Lower than before: enforced on every PR. Headroom on master `/queue` 1,771 B, `/` 2,884 B; about 1,660 B on `/queue` once AQP-183 merges | PRF-01 |
| NFR-009 LCP / TBT | Unchanged until a key screen is listed | PRF-04 |
| CI feedback time | None: +2 s; p95 5 min 20 s | PRF-02, PRF-03 |

**RISK-020 (for master).** The "no budget check" part is resolved. The headroom part remains: under 1 % on `/queue` after AQP-183. Stage 11b now stops a breach at the PR, but the remedy, lazy-loading the closed Radix account menu and drawer (AQP-38 PRF-01, AQP-183 PRF-04), still needs an owner before the next portal UI story.

## Previous Findings (re-review only)
n/a (first round).
