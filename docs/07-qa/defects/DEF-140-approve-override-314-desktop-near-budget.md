# DEF-140: approve-override.spec.ts:314 [desktop] 'the price itself' reads 25 s or more at attempt 1 and times out at 30 s on slow shard 3 (Test; Sev-3; DL-267's Bug line met under DL-450; Jira AQP-497, GitHub #823)

| Field | Value |
|-------|-------|
| Story / AC | AQP-478 (DEF-121 changed the approval dialog; related); RISK-031 (the attempt-1 time-outs of shard 3 are occurrences); the case 'AC-6, AC-8: the price itself: text is refused with the spec's sentence and no reason field; a price of 0 is accepted as an override' |
| Severity | **Sev-3 Medium** (master, DL-450 (B)); not a G8 blocker on its own (section 9 item 3) |
| Priority | P3 (Jira Medium; labels `sev-3`, `test`, `near-budget`) |
| Type | **Test** (a spec case that runs too close to its 30 s budget; no product fault shown; the DL-450 cause step may still find one) |
| Status | **Open, 2026-11-27 (qa-engineer).** Fix **authorised now**: a test-only split on DL-430's terms (DL-449 (3)(c), DL-450 (3)); the orchestrator gives it to lane 3; merge by the end of **Wed 2 Dec 2026**, else the Bug goes to G8 open and is named in the recommendation. |
| Jira / GitHub | [AQP-497](https://sankumar76.atlassian.net/browse/AQP-497) / [#823](https://github.com/sankumar76/Accucut-Quotation/issues/823) (labels bug, sev-3, ai-delivery; Jira also aiid-DEF-140, agent-qa-engineer, test, near-budget); linked 'relates to' AQP-478. Searched first: JQL on `aiid-DEF-140` and a GitHub search: nothing earlier. |
| Found by / date | qa-engineer, 2026-11-27, from the run logs of the pushes and runs of record below; ruled by master in DL-450 |
| Build / commit | `master` 1b30b17f and 73143e7e, #800's run of record 45922705204 (6aa4dfbd), #818's PR run 45926666383 (df95bf21), #812's run 45945851576 (dae95c35) |
| Environment | CI, Stage 12 shard 3 of 4 (Chromium at three widths) |

## DL-267's line, met (DL-450 (A), (B))
**Attempt-1 time-outs outside a ruled wave** ([desktop]): `73143e7e` **30.2 s** (retry 31.3 s); #812's run 45945851576 **30.3 s then 31.0 s** (both attempts, 'waiting for the Totals region text', spec line 329). Shard 3 is *persistently slow* (a median of 1.4 or more against `31015cce` on at least 3 of its last 5 readings: 1.48, 1.03, 1.45, 1.47, 1.58), so by DL-450 (A) its time-outs do not count as inside a ruled wave. **Passing attempt-1 readings of 25 s or more** ([desktop]): **26.9 s** (#800's run of record), **25.8 s** (`1b30b17f`), **26.8 s** (#818's PR run): three of three.

## Attempt-1 durations (DL-449 (3)(c): the last five green `master` runs before #819, and `73143e7e`)
| Run | [desktop] s | [tablet] s | [mobile] s | Shard-3 median vs `31015cce` |
|-----|------------:|-----------:|-----------:|------:|
| `c30b349f` (CI 45854831021) | 15.9 | 16.5 | 12.5 | 1.15 |
| `0cce6691` (45867671660) | 17.6 | 13.7 | 13.2 | 1.19 |
| `d5e352f9` (45912452682) | 12.6 | 14.5 | 15.4 | 0.96 |
| `7753cdff` (45922731756) | 12.8 | 14.6 | 9.7 | 0.95 |
| `1b30b17f` (45939075231) | **25.8** | 17.6 | 15.4 | 1.45 |
| `73143e7e` (45942580583) | **30.2 (time-out; retry 31.3)** | 21.3 | 17.7 | 1.47 |
Other readings: #800's run of record 26.9 / 23.2 / 25.4 s (desktop / tablet / mobile; shard-3 1.48); #818's PR run 26.8 / 14.3 / 11.6 s; #820's PR run 20.1 / 21.6 / 14.0 s; #812's run 30.3 and 31.0 s (desktop, both attempts), tablet 15.7 s, mobile 18.0 s (shard-3 1.58). **On a normal draw the desktop case takes 12.6 to 17.6 s; on a slow shard 3 it takes 25.8 s and more (about twice, against a median of 1.45), so the case is more sensitive to the draw than the shard as a whole.** The case goes to the 30 s budget through its Totals-region text wait (line 329) and the approval dialog's response.

## Fix (authorised; lane 3 by the orchestrator)
A **test-only split** on DL-430's terms: **every assertion kept, in the original order, on one page (a serial pair on a shared page if needed); each case under 25 s on attempt 1 at all three widths at a normal draw (1.10 or less); the person ledger stays at +0 (DL-422); the PR body maps each assertion before and after; no wait, `force`, retry or budget change; no time-out raised (DL-404).** **If the DL-450 cause step shows a product cause (the slowdown following the Lead's pages), a split is not the fix, and master rules the same day** (DL-449 (3)(e): if the case is slower on fast draws since #819 at the server steps, it comes to master the same day as a possible product question). QA's proof: the split cases at attempt 1 at three widths on two runs, the original assertions found one for one, the ledger.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Split PR | developer (lane 3) | | |
| Regression proof | qa-engineer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-497 and GitHub issue #823, created 2026-11-27 and cross-linked (Jira linked to AQP-478). DL-449 (3), DL-450; test plan 0.3.114; `approve.spec.ts:312` stays on the watch (1 of 3 passing readings), no split.

## DL-455 applied (qa-engineer, 2026-11-27; test plan 0.3.123)
**The cause is product (DEF-141), so under DL-451 (4) #824 (the split) stays HELD until the DEF-141 fix (step 1: server props) is on `master`. QA then re-reads `approve-override.spec.ts:314` on the next two `master` pushes: if it reads under 25 s at a normal draw on both, DEF-140 closes as caused by DEF-141 and #824 closes unmerged; if it still reads 25 s or more at a normal draw, #824 merges when green.** DEF-140 stays open Sev-3 Test, due by the end of Wed 2 Dec as before. Latest readings before the fix: `:314` [desktop] 22.2 s (`ffd02f7d`, shard 3 at 1.13) and 17.7 s (`e0153858`, shard 3 at 1.03; [mobile] 23.0 s).

## DL-460 applied: how the re-read after #827 counts its draws (qa-engineer, 2026-11-27; test plan 0.3.134; records-u 48636c94)
**'Normal draw' stays 1.10 or less (DL-449); no standing definition changes. For this re-read ONLY (`approve-override.spec.ts:314` [desktop]) a reading is read ONE-SIDEDLY, and no reading is scaled by its draw:** **(a) COUNTS FOR CLOSING: under 25 s at any draw below the W1 line (under 1.4, no wave ruled);** **(b) COUNTS AGAINST: 25 s or more at a draw of 1.10 or less;** **(c) INCONCLUSIVE, skipped: 25 s or more at a draw above 1.10, or any reading inside a ruled wave.** **DEF-140 closes on TWO pushes after #827's squash (not necessarily consecutive) whose readings all count under (a) and none under (b); inconclusive pushes are skipped. A single reading under (b) sends this Bug's pre-authorised split ahead at once (DL-449 (3)(c), DL-450 (3)).** **If the end of Wed 2 Dec comes first with fewer than two qualifying pushes and no (b): there is NO split; the Bug stays open; the case is read in the final regression on the same one-sided terms; the G8 recommendation names the result.** QA reports every reading with its shard's draw and whether a wave was ruled (the shard that carries the project: [desktop] shard 3, [tablet] shard 2, [mobile] shard 1 in the logs read so far). Rejected by master: scaling a reading by its draw; comparing against the case's own pre-#800 median.

## DL-460 re-read after #827: `635e7f7a` (qa-engineer, 2026-11-27; test plan 0.3.138)
`approve-override.spec.ts:314` [desktop] read **21.8 s at shard 3's draw of 1.43** (no wave ruled: margin 0.12). Under 25 s, but the draw is above the 1.4 line, so it is not (a) (under 1.4); it is not (b) (25 s or more at 1.10 or less) or (c) as worded. **QA does not count it and asks master how to read it.** No qualifying push yet; no (b).
