# Review Report: AQP-216 (STORY-10.16), Quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality |
| Review round | 1 |
| Base…branch | `master...feat/AQP-216-ci-cache-warm` (PR #100) |
| Commit reviewed | 7bda9e0db983077f9b820c3c55277a2fcff3466b |
| Date | 2026-11-06 |
| Reviewed against | ACs 1 to 9, revision 3 (architect 11079; DL-105); developer 11107; evidence on throwaway PR #101 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
**Stage 12a on a miss now:**
- reads the package list from Playwright's dry run, using a parser that understands both the install-command shape and the 1.64.1 "Missing system dependencies (N):" report;
- downloads in up to three bounded tries (45 s update, 90 s download; tries 2 and 3 on archive.ubuntu.com);
- installs offline;
- fails naming the mirrors.

An unreadable dry run warns and falls back to the AQP-206 path. The nightly warm-up job runs stage 12a on the CI shards' label with the CI key formula, pinned word for word. The Lighthouse job uses the same script on `ubuntu-24.04`.

**The evidence on #101 matches the logs:**
- forced miss: 19 s and 13 s;
- hit: 3 s and 3 s;
- fallback: 35 s and 55 s;
- all mirrors dead: failed at 53 s and 63 s;
- a natural 90 s download stall recovered on try 2.

**One Minor finding:** the `mirror+file:` rewrite, which is what makes the fallback work on the real runner, has no test.

The local work was kept light at the coordinator's request, because the machine is low on memory: no Docker, no full suites, only the four affected unit files. Nothing was left running from the stalled session, and the two `aqp*` containers present are not mine.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 3 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Code reading | `git diff origin/master...origin/pr-100` (8 files) | see Findings |
| Evidence | Actions API (stage 12a duration per shard) and `gh run view --log --job` for 42204272850, 42204925707, 42205780147, 42206740125 and 42207530048 | As in the summary; the error message names "the mirror of the runner image, 192.0.2.1, 192.0.2.1" (QLT-94) |
| Unit tests (a light `git archive` copy of 7bda9e0) | `npx vitest run tests/unit/playwright-deps-packages.test.ts tests/unit/playwright-system-deps.test.ts tests/unit/nightly-workflow.test.ts tests/unit/ci-workflow.test.ts` | 81 of 81 passed |
| Planted-fault probe | 7 parser, 6 script and 2 nightly faults, each against its own test file (3 re-run in a corrected form) | 14 of 15 caught; the `mirror+file:` rewrite deleted survived (QLT-93) |

## Findings
| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-93 | Minor | `scripts/ci/playwright-system-deps.sh:87` | AC-4, AC-6; test adequacy | The runner's sources are `mirror+file:`, and this `sed` rule switches them to archive.ubuntu.com for tries 2 and 3. Deleting it passes all tests; the fake sources hold only `http(s)://…ubuntu.com/ubuntu` entries. | The fallback could silently stop working on the real runner (tries 2 and 3 on the same dead mirror); only a live control would show it. | Add a deb822 `.sources` file with `URIs: mirror+file:/etc/apt/apt-mirrors.txt` to the fake sources; assert it is rewritten, and that a non-Ubuntu source is left alone. |
| QLT-94 | Info | `scripts/ci/playwright-system-deps.sh:77` | AC-5 (names the mirrors) | `first_mirror` finds no `http(s)` Ubuntu host on the runner and prints "the mirror of the runner image" (all evidence logs); the fallback appears twice. | The operator does not learn which runner mirror failed. | Read the first URL from the `mirror+file:` list and print its host; list each mirror once. |
| QLT-95 | Info | `scripts/ci/playwright-system-deps.sh:104` | AC-4 (update failure ends the try) | On the runner, `apt-get update` against a dead source exits 0 (17 to 18 s in the logs); the download then fails at once (status 100). The rule is tested with a stubbed `apt-get` only. | None today: the try still ends quickly. The stub test is adequate for the logic, and the same `timeout` wrapper is shown live by the natural 90 s stall. | Consider `apt-get update --error-on=any` so the rule engages for real (one control run to check its effect on the other repositories). |
| QLT-96 | Info | `scripts/ci/playwright-deps-packages.sh:48` | AC-3, AC-6 | The report's count (N) is not compared with the names collected. | A future output change that splits or wraps lines could yield a short list that is cached, failing only at test time and on every hit until the key changes. | Exit 1 (warn and take the bounded path) when the count differs; add one parser test. |

## Reviewer-specific tables
**Quality: AC conformance**

| AC | Result | Evidence |
|----|--------|----------|
| AC-1 warm-up job (stage 12a only, same keys and label, timeouts) | Met | `nightly-workflow.test.ts` pins the steps word for word against `ci.yml`, `CACHE_EPOCH` equality and the label (faults caught) |
| AC-2 Lighthouse on `ubuntu-24.04`, script, no `--with-deps` | Met | Tests |
| AC-3 healthy miss ≤ 90 s; parser; fallback on an unreadable dry run | Met | 19 s and 13 s; the 1.64.1 report shape parsed; faults caught |
| AC-4 fallback ≤ 4 min; update failure ends the try; tries 2 and 3 on archive | Met (QLT-93, QLT-95) | 35 s and 55 s; natural stall 118 s |
| AC-5 three failed tries fail inside 8 min, naming the mirrors | Met (QLT-94) | 53 s and 63 s; message present; 6.75 min is arithmetic (adequate) |
| AC-6 tests | Met (QLT-93) | Parser, script and workflow tests; 45, 90 and 8 pinned |
| AC-7 evidence on a throwaway PR | Met | #101 runs above |
| AC-8 master-scope proof | After the merge (QA) | — |
| AC-9 security and resource guard | Met per the workflow tests | Triggers unchanged, actions pinned, values through `env:` |

## Previous Findings (re-review only)
n/a (first quality review of this PR).

---

## Round 2: 7bda9e0..ebd83be (master 11114; architect 11115; developer 11121)

| Field | Value |
|-------|-------|
| Commit reviewed | ebd83be876744145fe7e713b1e261b55531583dc (ab1d6a2 per-try apt view and `--error-on=any`; ebd83be removes the view with `sudo`) |
| Local work | Light (the disk is nearly full): `playwright-system-deps.test.ts`, `playwright-deps-packages.test.ts` and `ci-workflow.test.ts` only, 62 of 62 at baseline; evidence read from the Actions API and job logs |
| **Verdict** | APPROVE WITH COMMENTS. New findings: Blocker 0 · Critical 0 · Major 0 · Minor 0 · Info 1 |

**Previous findings**

| ID | Prior severity | Status | Evidence |
|----|----------------|--------|----------|
| QLT-93 | Minor | **Fixed** | The system-sources rewrite is removed; each try's view is a copy of `ubuntu.sources`, and the fallback rewrites `URIs:` (including `mirror+file:`) in every stanza. Pinned by a test. Faults caught: fallback left on the runner mirror (6 fail), `Signed-By` dropped (1), system file edited in place (1). CI control 42233860764: 6 script tests fail |
| QLT-94 | Info | **Addressed** | The message prints `mirror+file:/etc/apt/apt-mirrors.txt` as written |
| QLT-95 | Info | **Fixed** (confirmed per master 11114) | `apt-get update --error-on=any` inside the view only; the download and the offline install take the same three `-o` options. Live 42233000524: "apt-get update failed with status 100 after 17 s; ending this try", then try 2 on archive.ubuntu.com (update 13 s, download 4 s, 9 cached). Faults caught: flag removed (11), download outside the view (11), offline install outside the view (9), system list still read (12), lists shared (12) |
| QLT-96 | Info | Unchanged | Not in scope for this round |

**The checks requested**
- **/etc/apt sources untouched.** `-o Dir::Etc::SourceList=/dev/null`, `Dir::Etc::SourceParts` set to the view, `Dir::State::Lists` set to the view's lists; no in-place edit remains, and "nothing under the runner's sources.list.d changes" is tested. The AQP-206 `apt.conf.d/99-ci-bounds` write is unchanged; it is configuration, not a source.
- **Signatures.** The stanza is copied whole; the fallback changes only `URIs:`; `Signed-By` is kept in every stanza (tested; the fault is caught).
- **sudo cleanup scope.** `view` comes only from `mktemp -d` (or `""` before the first try); `sudo rm -rf -- "${view}"` removes that directory or nothing; nothing external reaches it. Regression test pins `sudo` (the fault is caught).
- **Fallback without `ubuntu.sources`.** It warns and takes the bounded path (the fault is caught).

**New finding (round 2)**

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-97 | Info | `scripts/ci/playwright-system-deps.sh` (trap, `make_view`) | Defensive scoping of `sudo rm -rf` | Safe as written (`view` only from `mktemp -d`). | A later edit that assigns `view` elsewhere would widen a root removal. | Guard with `[[ "${view}" == "${TMPDIR:-/tmp}"/tmp.* ]]` before `sudo rm -rf`. |

**Checks run (round 2)**

| Check | Result |
|-------|--------|
| Three affected unit files (a refreshed light scratch copy) | 62 of 62 passed |
| Planted-fault probe (10 faults, `playwright-system-deps.test.ts`) | 10 of 10 caught |
| Evidence #105 (42232188426, 42233000524, 42233860764, 42234600018) | Dead mirror: try 1 status 100 at 17 s, then try 2 success; fault controls red in stage 6 with the expected tests |

The scratch copies' `node_modules` links were removed; deleting the copies themselves was not permitted, so they remain in the scratchpad.
