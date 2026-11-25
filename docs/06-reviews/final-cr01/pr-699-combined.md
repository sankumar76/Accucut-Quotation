# Review Report — PR #699 (AQP-312, fallback review Minors QLT-681-01..03) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (one combined security-and-quality review, CLAUDE.md §9 item 2: anything that can lose or corrupt data, here the database restore path) |
| Review round | 1 (of this PR; it re-verifies QLT-681-01..03 from the #681 review, `docs/06-reviews/AQP-312/fallback-combined.md`) |
| Base…branch | `master...fix/AQP-312-fallback-review-minors` (PR [#699](https://github.com/sankumar76/Accucut-Quotation/pull/699)), merge base `9e3111c0` (#681) |
| Commit reviewed | `54c31cbd` (one commit) |
| Date | 2026-11-24 |
| **Verdict** | **APPROVE WITH COMMENTS**: no Blocker, Critical or Major finding. CI run 45354415610 and Windows package run 45354415638 are fully green at the head |

## Summary

The PR fixes the three Minors from the #681 review, and each fix is real.

- **QLT-681-01 (exit-code assertion that could never fail): fixed.** `$null = $process.Handle` is read before the wait, and the assertion is now `Should -BeGreaterThan 0`. I probed this in Windows PowerShell 5.1. With the handle read, a child that runs `exit 0` gives `0` and one that runs `exit 7` gives `7`. Without it, both give `$null`. So the new line fails if the child ends with 0. The old line passed whatever the child did.
- **QLT-681-02 (exported `-Source` scriptblock seam): fixed** as suggested. A new internal `Get-AccucutWindowsIdentityName` is left out of `Export-ModuleMember`. `Get-AccucutRunningAccount` takes no parameter, and Pester mocks the helper with `-ModuleName`. Loading both modules confirms it: the base has the `Source` parameter, the head has none, and neither exports the helper. On stage 13 the real identity call still writes `Restore run by runnervmbpeip\runneradmin.` to `restore.log` and the event, in both the exercise and the Pester restore runs. This also closes a small record-integrity gap: no caller can now feed the "run by" record a made-up name.
- **QLT-681-03 (non-ASCII text on `-StdIn` silently re-encoded): fixed, with one latent gap.** The guard runs before any process starts and never echoes the text. The help states the contract. Every current `-StdIn` caller sends static SQL plus names checked with `-cmatch` ASCII patterns, so no restore, install or backup step can trip the new throw. **The gap (QLT-699-01, Minor):** `-match` ignores case, so .NET folds U+212A (Kelvin sign) and U+0130 (capital I with dot) to ASCII `k` and `i` and lets them through. The CP437 writer then turns them into `K` and `I`. I confirmed both on Windows PowerShell 5.1. The fix is one character (`-cmatch`), as the module already does for database names. No caller is affected today.

Restore safety is not weakened. The restore functions, confirmation, target-name checks, role handling and safety copies are unchanged. The only runtime change on the restore path is the identity lookup, which keeps its "never throws, `unknown account` fallback" behaviour (Pester cases at `Restore.Tests.ps1:994-1005`). There are no secrets in the diff; the only "secret" text is a test literal.

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
| Diff | `git diff 9e3111c0 54c31cbd` in worktree `aqp-398` (read-only) | 5 files, +60 −10. Matches the PR file list |
| CI | `gh run view 45354415610` | **success** at `54c31cbd`: Stages 1 to 11, 1 to 11b, E2E shards 1 to 4 |
| Windows package | `gh run view 45354415638 --log` | **success**. Pester **580 passed, 0 failed, 0 skipped**. The five new or changed cases pass (log lines 1729-1730, 2312-2314). The binding test passes in 383 ms (2095). `assert-install.ps1` and `exercise-backup.ps1` pass, including "the event names the account that ran it" (1086). Two full restores finish with "Restore run by runnervmbpeip\runneradmin." (2255, 2275, 2281, 2306) |
| Vitest at head | `node node_modules/vitest/vitest.mjs run tests/unit/windows-deploy-files.test.ts` (aqp-398) | **72 passed** |
| Red on base, QLT-681-02/03 | scratch probe: base and head `AccucutOps.psm1` imported in turn (`git show`) | Base: `Invoke-AccucutNative -StdIn '…₹'` on a missing program gives "cannot find the file", so the new Pester case is red. Base `Get-AccucutRunningAccount` has the `Source` parameter, so the "takes no parameter" case is red, and the mocks of a missing command fail. Head: the refusal message, no parameter, helper not exported |
| Red on base, QLT-681-01 | scratch probe: `Start-Process -PassThru -RedirectStandard*` with child `exit 0` / `exit 7`, with and without reading `.Handle` | with handle `0` / `7`; without `$null` / `$null`. So the new assertion can fail, and the old one could not |
| Guard completeness | scratch probe: `-match` and `-cmatch '[^\x00-\x7F]'` over U+212A, U+0130, U+017F, U+20B9, U+00E9, U+212B; CP437 round trip | `-match` is **False** for U+212A and U+0130 (`-cmatch` True). CP437 gives `K` and `I`. That is QLT-699-01 |
| Callers of `-StdIn` | `git grep -- -StdIn` over `deploy` | two: `Add-AccucutJobRun` (`:2233`, a static INSERT) and `Invoke-AccucutRestoreSql` (`:2786`). That one is called with static SQL plus names checked by `-cmatch '^accucut_(new\|old\|failed)_\d{14}$'` (`:2491`) or `-cmatch '^[a-z_][a-z0-9_]{0,62}$'` (`:1803`). The new throw cannot fire partway through a restore |
| Secrets | read the diff | none. The test text `secret-` is a literal, and the test asserts it is not echoed |
| Lint, type-check, build, E2E, full Pester locally | not run locally (CI is the record, CLAUDE.md §9 item 5; the PC is short of memory) | — |

Scratch files are in the session scratchpad: `probe699.ps1`, `probe699b.ps1` and `m699/`. No repository file was changed.

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-699-01 | Minor | `deploy/windows/AccucutOps.psm1:387`; `tests/unit/windows-deploy-files.test.ts:1000`; `deploy/windows/tests/AccucutOps.Tests.ps1:95` | QLT-681-03 (ASCII-only `-StdIn`) | **The ASCII guard ignores case, so two non-ASCII characters pass it.** PowerShell's `-match` ignores case. Under it, .NET folds U+212A (Kelvin sign) to `k` and U+0130 (capital I with dot) to `i`, both inside `\x00-\x7F`, so `[^\x00-\x7F]` does not match. Verified on Windows PowerShell 5.1.26100: `-match` False, `-cmatch` True. The CP437 writer then sends `K` and `I`: a silent change to another valid letter, which is the exact failure QLT-681-03 asked to close. | None today: every caller sends ASCII by construction. A later caller with such text (a pasted name, or a secret from a generator that is not ASCII-only) would be changed silently. Likelihood very low. | Use the case-sensitive operator, as the module does for database names (`:1803`, `:2795`): `if ($PSBoundParameters.ContainsKey('StdIn') -and $StdIn -cmatch '[^\x00-\x7F]') {`. Update the pinned string in the Vitest at `:1000`. In the Pester case, add `[char]0x212A` to `$text`, or add a second case with `'abc ' + [char]0x212A`. **Test that catches it:** that Pester case, which is red with `-match` and green with `-cmatch`. |
| QLT-699-02 | Info | `deploy/windows/AccucutOps.psm1:370`, `:388` | coding standards §8 (comments say why, accurately) | The help and the error say any other character "would be changed to '?'" in "code page 437". That is only partly right. The writer is CP437 only when the console encoding has a preamble; otherwise it is the console's own input code page. CP437 keeps some non-ASCII characters (`é` is 0x82, which psql then reads in its client encoding as something else), and it changes some to look-alikes (QLT-699-01). The ASCII-only contract is correct either way. | Readability only. A maintainer might think `é` is safe because it exists in CP437. | Reword, for example: "the standard input is written in a console code page (437 while the guard is on), so a character above 127 may be changed or read as a different one". |
| QLT-699-03 | Info | `deploy/windows/tests/install.Tests.ps1:897` | test determinism | `$null = $process.Handle` runs after `Start-Process` returns. In principle, a child that has already exited by then makes `.Handle` throw. That failure mode is a loud red, not a false green, and the child `powershell.exe` takes about 380 ms to bind (stage 13 log line 2095). | None in practice: at worst a rare red that a re-run clears. | None needed. If it is ever seen, use `Start-Process … -Wait -PassThru` in a background job with a timeout. |
| QLT-699-04 | Info | `deploy/windows/tests/AccucutOps.Tests.ps1:104-106` | naming | The variable `$more` holds the path of `findstr.exe`. It looks left over from a first draft with `more.com`. The test is right: `findstr ^` echoes every line, and the empty case uses `-AllowFailure` for findstr's exit code 1. | Readability only | Rename it to `$findstr`. This is reviewer-standards' area: a cross-reference, not a request. |

## Security and data-safety notes (the §9 item 2 focus)

| Check asked in the brief | Result | Evidence |
|--------------------------|--------|----------|
| QLT-681-01 really fixed | **Yes** | The handle is read before the wait; the assertion is `-BeGreaterThan 0`; the probe shows `0` and `7` are now read, where both were `$null` before. Stage 13: passes |
| QLT-681-02 really fixed | **Yes** | `Get-AccucutRunningAccount` has `param()` (`AccucutOps.psm1:2634-2650`), and the helper is not in `Export-ModuleMember` (`:3307-3330`). The Pester case at `Restore.Tests.ps1:1007-1010` and the Vitest at `:975-979` check both. The base and head modules were loaded and compared |
| QLT-681-03 really fixed | **Yes, with QLT-699-01** | The guard runs before `ProcessStartInfo` (Vitest `:1001` pins the order). The message holds no input text (Pester asserts it). The help states the contract. The case-folding gap is QLT-699-01 |
| Restore confirmation, target checks, role/privilege handling, data-loss paths unchanged | **Yes** | The diff changes no line of `Invoke-AccucutRestore`, `Get-AccucutRestoreChoice`, `New-/Switch-/Remove-AccucutRestoreDatabase`, `Assert-AccucutRestoreDatabaseName`, `Invoke-AccucutRestoreSql`, the role script or the safety copies. The only runtime change on the restore path is how the account name is read, and it still never throws (`unknown account` fallback). Stage 13 ran two full restores, the stop at the copy list, and the refused and rolled-back updates, all green |
| The new throw cannot interrupt a restore partway | **Yes** | Every `-StdIn` text is static SQL plus names validated with case-sensitive ASCII patterns before the first step (Checks Run, "Callers of `-StdIn`"). The account name, which can hold non-ASCII, goes to `restore.log` and the event log, never to `-StdIn` |
| Tests meaningful (fail on base) | **Yes** | QLT-681-02 and QLT-681-03 cases are red against the base module (probe). For QLT-681-01, the new assertion is shown to read the real code, where the old one read `$null`. The "passes ASCII" case is a regression guard and is green on both, as it should be |
| No secrets | **Yes** | none in the diff, the PR body or the test data |

## Reviewer-specific tables

### Prior findings (QLT-681-*) → status

| Finding | Severity | Status | Evidence |
|---------|----------|--------|----------|
| QLT-681-01 | Minor | **Fixed** | `install.Tests.ps1:897`, `:901`; scratch probe; stage 13 |
| QLT-681-02 | Minor | **Fixed** | `AccucutOps.psm1:2626-2650`; `Restore.Tests.ps1:994-1010`; Vitest `:975-979`; module comparison |
| QLT-681-03 | Minor | **Fixed**, with a latent gap → QLT-699-01 | `AccucutOps.psm1:370-371`, `:386-389`; `AccucutOps.Tests.ps1:92-107`; Vitest `:999-1002` |
| QLT-681-04 .. -08 | Info | Not in scope of this PR (unchanged) | — |

### Finding → code → test

| Finding | Code | Test that would catch it |
|---------|------|--------------------------|
| QLT-699-01 | `AccucutOps.psm1:387` | the QLT-681-03 Pester case with `[char]0x212A` in its text |
| QLT-699-02 | comment and message only | n/a |
| QLT-699-03 | `install.Tests.ps1:897` | n/a (fails loudly if ever hit) |
| QLT-699-04 | `AccucutOps.Tests.ps1:104` | n/a |

## Issues for other roles

- **developer:** QLT-699-01 is a one-character fix plus one pinned string and one test character. It can go in this PR before merge, or in the hardening window. It does not block the merge.
- **reviewer-standards:** QLT-699-04 (naming) is in your area if you want it. Pre-existing and outside this PR: `Test-AccucutBackupSetting 'pgHost'` (`AccucutOps.psm1:1801`) uses the case-insensitive `-match` with `[A-Za-z0-9]`. A Kelvin sign would pass it the same way, but the value goes to the psql command line, not `-StdIn`, and an odd host name only fails to resolve. Worth making `-cmatch` in the same sweep.

## Previous Findings (re-review only)

See "Prior findings (QLT-681-*) → status" above.

## Hand-off
- Status: COMPLETE
- Verdict: APPROVE WITH COMMENTS (Blocker 0, Critical 0, Major 0, Minor 1, Info 3). QLT-681-01..03 are fixed. Restore safety is unchanged. CI and stage 13 are green at `54c31cbd`.
- Recommended next agent: orchestrator. Merge per CLAUDE.md §9 (all required checks are green). QLT-699-01 is optional before merge (one-character `-cmatch`) or goes to the hardening window.
