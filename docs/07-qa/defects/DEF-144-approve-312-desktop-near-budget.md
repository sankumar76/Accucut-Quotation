# DEF-144: approve.spec.ts 'locks the estimate' (:312) [desktop] reads 25 s or more at attempt 1 and has timed out outside a ruled wave: DL-267's Bug line met (Test; Sev-3; DL-449; Jira AQP-501, GitHub #830)

| Field | Value |
|-------|-------|
| Story / AC | AQP-478 (DEF-121 added assertions to the case); DEF-140 (the same family, `approve-override.spec.ts:314`); DEF-141 (AQP-498, the Lead's review page: the suspected cause); RISK-031 |
| Severity | **Sev-3 (DL-449 (3)(c)); not a G8 blocker on its own (section 9 (3))** |
| Priority | P3 (Jira Medium; labels `sev-3`, `test`, `near-budget`) |
| Type | **Test** (a spec case that runs too close to its 30 s budget), **with the same product question as DEF-140** |
| Status | **VERIFIED and CLOSED 2026-11-27 (qa-engineer, DL-460 as amended by DL-462 (D)): closed as caused by DEF-141, with no split: two qualifying pushes after #827, `7aa23c44` and `60ca5a08`, all readings under 25 s with no wave ruled, none against. Jira AQP-501 Done, GitHub #830 closed.** Earlier status: **Open, 2026-11-27 (qa-engineer, DL-449 (3)(c)); the HOLD is ADOPTED by master (DL-459), on DEF-140's terms.** The test-only DL-430 split (authorised in advance) waits until DEF-141's step 1 (#827) is on `master`; QA then re-reads `approve.spec.ts` 'locks the estimate' (`:312`) at every width on the next two `master` pushes: **all readings under 25 s at a normal draw: DEF-144 closes as caused by DEF-141, with no split; any reading of 25 s or more: the split goes ahead, or DEF-144 goes to G8 open.** Until then `:312` stays on the near-budget watch and in R19's named cases. |
| Jira / GitHub | [AQP-501](https://sankumar76.atlassian.net/browse/AQP-501) / [#830](https://github.com/sankumar76/Accucut-Quotation/issues/830) (labels bug, sev-3, ai-delivery; Jira also aiid-DEF-144, agent-qa-engineer, test, near-budget); linked 'relates to' AQP-478, AQP-497 and AQP-498; RISK-031 in the body. Searched first: JQL on `aiid-DEF-144`: nothing earlier. |
| Found by / date | qa-engineer, 2026-11-27, counting on the logs of `master` pushes and runs of record since #800 (DL-449 (3)(b)) |
| Build / commit | the logs of #800's run of record 45922705204, `2e11c44d`, `1b30b17f`, `73143e7e`, `ffd02f7d`, `e0153858`, `c83e57b0`, `a51103e0`, `864ecb0f`, `d35ad821`, `3c561ce1`, #812's run 45945851576, #824's run 45950934549 |
| Environment | CI, `next dev`, Stage 12 (desktop in shard 3, tablet in shard 2, mobile in shard 1) |

## DL-267's line, counted since #800 (DL-449 (3)(b))
**[desktop], MET:** an attempt-1 time-out OUTSIDE a ruled wave: **#800's run of record, 31.6 s** (shard 3 median 1.48, margin 0.02 over shard 2's 1.46: W1 (d)'s margin test fails). Passing attempt-1 readings of 25 s or more: **28.1 s (`1b30b17f`), 26.4 s (`d35ad821`), 27.3 s (`3c561ce1`)**: three. (Inside a ruled wave: `73143e7e` 30.4 s, #812's run 32.7 s then 31.2 s.) **[tablet], not met:** readings 28.3 s (#800's run), 29.6 s (`a51103e0`), 27.8 s (`3c561ce1`), but both attempt-1 time-outs (`864ecb0f` 30.3 s; #786's run f2c65a30 30.1 s and 32.8 s) were inside a ruled wave (shard 2 at 1.62 and 1.61). **[mobile], not met:** 1 outside-wave time-out (#800's run 30.3 s), 1 reading (25.1 s on `e0153858`).

## Attempt-1 durations ([desktop] / [tablet] / [mobile], s)
| Run | [desktop] | [tablet] | [mobile] |
|-----|----------:|---------:|---------:|
| `c30b349f` | 20.7 | 25.8 | 14.8 |
| `0cce6691` | 16.8 | 17.5 | 24.2 |
| `d5e352f9` | 15.3 | 12.1 | 19.2 |
| `7753cdff` | 17.9 | 14.0 | 17.1 |
| `1b30b17f` | **28.1** | 18.4 | 18.0 |
| `73143e7e` | **30.4 (time-out; retry 24.9)** | 21.6 | 23.2 |
| `2e11c44d` | 19.2 | 18.4 | 16.1 |
| `ffd02f7d` | 18.9 | 22.0 | 19.5 |
| `e0153858` | 17.4 | 15.9 | 25.1 |
| `c83e57b0` | 20.9 | 16.3 | 24.9 |
| `a51103e0` | 22.5 | **29.6** | 22.5 |
| `864ecb0f` | 22.3 | **30.3 (time-out; retry 20.8)** | 17.9 |
| `d35ad821` | **26.4** | 22.0 | 24.6 |
| `3c561ce1` | **27.3** | **27.8** | 18.4 |
| #800's run of record | **31.6 (time-out)** | 28.3 | **30.3 (time-out)** |
| #812's run | **32.7 and 31.2 (both attempts)** | 17.3 | 23.2 |
| #824's run | 24.1 | 15.5 | 17.1 |
| #786's run (f2c65a30) | 26.1 | **30.1 and 32.8 (both attempts)** | 26.9 |
On a normal draw the desktop case takes 15 to 22 s; it reaches 25 s and more on slow draws and on some normal ones (27.3 s on `3c561ce1`, shard 3 at 1.23).

## Product question (DL-449 (3)(e))
The case opens the Lead's review page, so it crosses the four browser reads after hydration and the action delay found for DEF-141 (AQP-498). Before #800 it read 15 to 21 s on normal draws (`c30b349f` to `7753cdff`); since #800 it reads up to 28 s on normal ones. QA's reading: **the cause is the same as DEF-140's, so a split is not the fix until DEF-141's step 1 is on `master`; the case is then re-read on two `master` pushes, and the split merges only if it still reads 25 s or more at a normal draw (DL-455 (4)). Master rules.**

## Fix (authorised, DL-449 (3)(c))
A test-only split on DL-430's terms: **every assertion kept, in the original order, on one page (a serial pair on a shared page if needed); each case under 25 s at a normal draw (1.10 or less) on attempt 1 at all three widths; the person ledger stays at +0 (DL-422); the PR body maps each assertion before and after; no wait, `force`, retry or budget change; no time-out raised (DL-404).** Due by the end of Wed 2 Dec 2026; if not merged by the freeze it goes to G8 open and is named in the recommendation.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Master's ruling: hold or split | master | | |
| Split PR, or the re-read after DEF-141's step 1 | developer / qa-engineer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-501 and GitHub issue #830, created 2026-11-27 and cross-linked (Jira linked to AQP-478, AQP-497 and AQP-498); test plan 0.3.132.

## DL-459 applied (qa-engineer, 2026-11-27; test plan 0.3.133; records-u 37bf60a3 and b817391e)
**The HOLD is adopted on DEF-140's terms.** After #827 is on `master`, QA reads `approve.spec.ts` 'locks the estimate' ([desktop], [tablet] and [mobile]) on the next two `master` pushes: all nine attempt-1 readings under 25 s at a normal draw (1.10 or less, DL-449 (3)(c); QA notes that most clean pushes read 1.13 to 1.25 on the shard that carries a project, so a reading at such a draw is reported with its draw and master reads it) closes DEF-144 as caused by DEF-141 with no split; any reading of 25 s or more splits it, or sends DEF-144 to G8 open. **Until then `:312` stays on the near-budget watch and in R19's named cases (R19 stays as written: shard 3, the named cases, until DEF-141's step 1; DL-455 (6)).**

## DL-460 applied: how the re-read after #827 counts its draws (qa-engineer, 2026-11-27; test plan 0.3.134; records-u 48636c94)
**'Normal draw' stays 1.10 or less (DL-449); no standing definition changes. For this re-read ONLY (`approve.spec.ts` 'locks the estimate' `:312` at EVERY width) a reading is read ONE-SIDEDLY, and no reading is scaled by its draw:** **(a) COUNTS FOR CLOSING: under 25 s at any draw below the W1 line (under 1.4, no wave ruled);** **(b) COUNTS AGAINST: 25 s or more at a draw of 1.10 or less;** **(c) INCONCLUSIVE, skipped: 25 s or more at a draw above 1.10, or any reading inside a ruled wave.** **DEF-144 closes on TWO pushes after #827's squash (not necessarily consecutive) whose readings all count under (a) and none under (b); inconclusive pushes are skipped. A single reading under (b) sends this Bug's pre-authorised split ahead at once (DL-449 (3)(c), DL-450 (3)).** **If the end of Wed 2 Dec comes first with fewer than two qualifying pushes and no (b): there is NO split; the Bug stays open; the case is read in the final regression on the same one-sided terms; the G8 recommendation names the result.** QA reports every reading with its shard's draw and whether a wave was ruled (the shard that carries the project: [desktop] shard 3, [tablet] shard 2, [mobile] shard 1 in the logs read so far). Rejected by master: scaling a reading by its draw; comparing against the case's own pre-#800 median.

## DL-460 re-read after #827: `635e7f7a` (qa-engineer, 2026-11-27; test plan 0.3.138)
`approve.spec.ts` 'locks the estimate' attempt 1: **[desktop] 25.8 s at shard 3's 1.43: (c) inconclusive (25 s or more at a draw above 1.10); [tablet] 19.3 s at shard 2's 1.32: (a); [mobile] 13.4 s at shard 1's 0.71: (a).** The push does not qualify (the [desktop] reading is (c)); no (b); no qualifying push yet.

## DL-460 re-read, push 2 `7aa23c44` (qa-engineer, 2026-11-27; test plan 0.3.139)
`approve.spec.ts` 'locks the estimate' attempt 1: **[desktop] 17.9 s at shard 3's 1.12, [tablet] 15.0 s at shard 2's 1.08, [mobile] 21.2 s at shard 1's 0.92: all under 25 s, no wave ruled: all (a); none (b): a QUALIFYING push (the first for DEF-144; `635e7f7a` had none, its [desktop] reading 25.8 s at 1.43 being (c)).** DEF-144 needs two qualifying pushes after #827; one more. If the end of Wed 2 Dec comes first with fewer than two and no (b): no split, the Bug stays open, the final regression reads the case, the G8 recommendation names it.

## CLOSED as caused by DEF-141 (qa-engineer, 2026-11-27; test plan 0.3.142)
**Qualifying push 2: `60ca5a08` (#806): `approve.spec.ts` 'locks the estimate' attempt 1: [desktop] 22.7 s at shard 3's 1.50 (margin 0.09: no wave), [tablet] 23.6 s at shard 2's 1.59 (margin 0.09: no wave), [mobile] 18.7 s at shard 1's 0.83: all under 25 s with no wave ruled: all (a); none (b).** With push 1 (`7aa23c44`: 17.9 / 15.0 / 21.2 s) that is two qualifying pushes after #827: **DEF-144 closes as caused by DEF-141, with no split (DL-460, DL-462 (D)).** Jira AQP-501: Done. GitHub #830: closed (completed). The case stays on the near-budget watch until G8 and is read in the final regression.
