# DEF-144: approve.spec.ts 'locks the estimate' (:312) [desktop] reads 25 s or more at attempt 1 and has timed out outside a ruled wave: DL-267's Bug line met (Test; Sev-3; DL-449; Jira AQP-501, GitHub #830)

| Field | Value |
|-------|-------|
| Story / AC | AQP-478 (DEF-121 added assertions to the case); DEF-140 (the same family, `approve-override.spec.ts:314`); DEF-141 (AQP-498, the Lead's review page: the suspected cause); RISK-031 |
| Severity | **Sev-3 (DL-449 (3)(c)); not a G8 blocker on its own (section 9 (3))** |
| Priority | P3 (Jira Medium; labels `sev-3`, `test`, `near-budget`) |
| Type | **Test** (a spec case that runs too close to its 30 s budget), **with the same product question as DEF-140** |
| Status | **Open, 2026-11-27 (qa-engineer, DL-449 (3)(c)).** Fix authorised in advance (DL-449 (3)(c)): a test-only split on DL-430's terms, merged by the end of Wed 2 Dec 2026. **QA proposes it is HELD until DEF-141's step 1 (#827) is on `master` and the case is re-read on two `master` pushes (as DL-455 (4) did for DEF-140); master rules.** |
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
