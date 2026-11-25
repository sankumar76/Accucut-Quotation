# Review Report — PR #669 (QLT-C-01..03, DEF-078) — Combined security and quality

| Field | Value |
|-------|-------|
| Reviewer | reviewer-quality (one combined security-and-quality review, CLAUDE.md §9 item 2: the change touches approval and unlock) |
| Review round | 1 |
| Base…branch | `master...fix/AQP-1-final-review-quality-minors` (PR [#669](https://github.com/sankumar76/Accucut-Quotation/pull/669)) |
| Commit reviewed | `76137d37` (the merge of `origin/master` that the developer is doing adds no change to the PR's own diff) |
| Date | 2026-11-24 |
| **Verdict** | **APPROVE WITH COMMENTS**: no Blocker, Critical or Major finding. Merge condition: CI fully green (see Checks Run) |

## Summary

The PR fixes the three final-review Minors and DEF-078 in 13 files: SCR-10 shows an ignored estimate as a state, not a fault (QLT-C-01); the Engineer's locked notice says "Quoted and locked." on a Quoted estimate (QLT-C-02); the `approval.unlocked` entry stores the status the estimate left (QLT-C-03); and the Engineer's page draws no status banner while the task is ignored (DEF-078). Each fix is the one the finding asked for and stays inside its scope. The approval and unlock area is sound. Who may unlock is unchanged (Lead and Admin by the manifest row, `withRoute`, `assertMayUnlock` and the state machine). The new audit field is written in the unlock's own transaction under the row lock and validated by the strict write schema. A missing or wrong status fails the write and rolls the unlock back. No cost reaches an Engineer. The new tests catch the defects they fix: against the base source, 15 of them fail.

Two Minors remain. The status written is derived with a fallback that would hide a future state-machine change from the strict schema (QLT-669-01). And the legacy-read comment is not accurate: from #624 (2026-11-22) until this merge, Quoted estimates could already be unlocked, so those entries will read "Approved at" (QLT-669-02). There are also two Info notes.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 2 |

## Checks Run

| Check | Command | Result |
|-------|---------|--------|
| Unit tests of the 5 touched unit files, at `76137d37` | `vitest run tests/unit/audit-events.test.ts tests/unit/approval/unlock.test.ts tests/unit/estimate-workspace-locked-notice.test.ts tests/unit/export-page.test.ts tests/unit/unlock-route.test.ts` (in a throwaway detached worktree, removed afterwards) | **268 passed**, 0 failed |
| Do the tests fail without the change? | The same run with the 6 `src` files put back to the merge base | **15 failed**, 253 passed: every new QLT-C-01, -02, -03 and DEF-078 case fails, plus the updated AC-2 unlock cases. The tests catch the defects they fix |
| Integration tests (`tests/integration/approval/unlock.test.ts`, `estimates/mark-quoted.test.ts`) | Not run locally (they need Postgres; heavy suites run in CI per §9 item 5) | CI "Stages 1 to 11b": **pass** |
| CI on PR head `76137d37` (run 45318168404) | `gh pr checks 669` | Stages 1 to 11b pass; E2E shards 1 to 3 pass; **E2E shard 4 fail**: 1 failed, 551 passed. The failure is `tests/e2e/users.spec.ts:58` (user list, AC-1/AC-7 axe and sideways scroll) on both tries, with `[WebServer] Error: aborted` in the log. This PR touches no user code, and master `1ab13781` is green. It is outside this diff, but under §9 item 1 the PR **must not merge until CI is fully green** (the re-run after the merge of master will show whether it is a flake) |
| Lint, type-check | Not run locally | Covered by CI Stages 1 to 11b (pass) |

## Findings

| ID | Severity | File:line | Rule / NFR / AC | Issue | Impact | Suggested fix |
|----|----------|-----------|-----------------|-------|--------|---------------|
| QLT-669-01 | Minor | `src/server/services/unlock-service.ts:145` | NFR-007 (audit is what was done); coding standards §3 (no silent fallbacks) | `const leaving = estimate.status === 'QUOTED' ? 'QUOTED' : 'APPROVED'` turns **every** status other than QUOTED into APPROVED. That is right today, because the machine allows UNLOCK from APPROVED and QUOTED only. But the strict write schema (`z.enum(['APPROVED','QUOTED'])`, `audit-events.ts:168`) can then never refuse a wrong value: if a future cell allows UNLOCK from another status, the entry silently records "Approved" | No effect today (the case is unreachable). It is a latent wrong audit record, and it defeats the fail-closed write check this PR adds | Narrow with the existing guard and fail closed: `if (!isLocked(estimate.status)) throw new Error('An unlock left a status that is not locked.');` then `before: { approvedPrice: live.approvedPrice, status: estimate.status }` (`isLocked` narrows to `'APPROVED' \| 'QUOTED'`). **Test:** the existing `it.each(['APPROVED','QUOTED'])` stays green; a stub that lets UNLOCK through from PREPARED must reject and write nothing |
| QLT-669-02 | Minor | `src/server/services/audit-events.ts:172-175` | NFR-007; FR-110; immutable audit log | The LEGACY READ comment says that before this change "only an Approved estimate could be unlocked (Quoted came with CR-01)". But master has allowed UNLOCK from QUOTED since #624 (AQP-399, 2026-11-22, `allow('QUOTED','DRAFT')`). Those Quoted unlocks were stored as `{approvedPrice}` alone, and the read default turns them into "Approved at ₹ …". The default is a guess for that window, not a fact | No production database exists yet (G8 and deployment are still human). So the mislabelled entries are only in dev, CI and demo databases (e.g. the local customer-review demo of master), and a reader of those can be told "Approved" for a quote that was taken back. After the first deployment, every stored entry has the status, so the default only matters for data written before this merge | Correct the comment to state the window ("#624 (2026-11-22) until this PR: a Quoted unlock was stored without status and reads as Approved; no production data existed then"), so nobody later relies on it as fact. Optional: describe a missing status neutrally (e.g. "At ₹ 4,750.00"), with `status` optional in the read schema. **Test:** the existing legacy case (`audit-events.test.ts`) pins whichever words are chosen |
| QLT-669-03 | Info | `src/components/features/estimate-workspace/estimate-texts.ts:111` | coding standards §6 (types say the domain) | `lockedNoticeTitle(status: EstimateStatus)` returns "Approved and locked." for DRAFT and PREPARED as well. It is only called under `isLocked(status)`, so nothing is wrong today | A future caller could draw "Approved" for an unlocked status | Take `status: 'APPROVED' \| 'QUOTED'` (what `isLocked` narrows to), with a `switch` and `assertNever`, so a new locked status fails to compile until it has its words |
| QLT-669-04 | Info | `src/app/(portal)/estimates/[code]/export/page.tsx:38` | coding standards §6 | The page tells the ignored result from the summary by `'ignored' in summary`. That is safe today, because `exportSummarySchema` is strict with no `ignored` key, but it relies on that schema never gaining such a key | None today | A tagged result (`{ kind: 'ignored', message }` / `{ kind: 'summary', summary }`) would make the branch explicit. Not required |

## Security and authorisation notes (the §9 item 2 focus)

- **Who may unlock:** unchanged. The manifest row `/api/v1/estimates/[id]/unlock` lists `ADMIN_AND_LEAD`; `withRoute` refuses an Engineer before the ID is read; `assertMayUnlock` (closed by `assertNever`) and `decideTransition(…,'UNLOCK',role)` refuse again. Unlock has no step-up in the architecture, and this PR adds none and removes none.
- **Audit completeness:** the entry is written in the unlock's transaction after `transition` and `markUnlocked`, under the estimate's row lock. `status` comes from the row read under that same lock, so it is the status the machine decided on. The audit writer validates `before` against the strict write schema (`audit-service.ts:155-159`): a write without `status`, or with any value other than APPROVED or QUOTED, is refused, and the whole unlock rolls back. An ignored estimate cannot be unlocked (machine `ESTIMATE_IGNORED`), and a QUOTED one cannot be ignored, so no ignored state can reach this code.
- **Legacy entries:** `readBefore` uses the existing mechanism (`describeStored`, as `approval.cancelled` does for `SUBMITTED`); stored rows are never rewritten. See QLT-669-02 for how accurate the default is.
- **NFR-002 (no cost to an Engineer):** the new SCR-10 ignored state is behind `authorizePage` (Engineer 403 before any read) and shows only the 409 sentence and a link, with no figure (asserted: no `₹`, no table). The Engineer's notice change is words only. The unlock entry already held `approvedPrice`; this PR adds only a status word, and audit is Lead/Admin only.
- **Error paths:** `summaryOf` turns only `ConflictError` with code `ESTIMATE_IGNORED` into a state; any other conflict and any plain error still reach the error page (tested). The ignored check in `getSummary` is inside the snapshot transaction, before any figure is read.
- **DEF-078:** `!frozen` on both banners covers the server-side ignored flag and a 409 received mid-session (`refusedAsIgnored`). The test covers DRAFT, PREPARED, APPROVED and QUOTED, both with and without the layer.

## Reviewer-specific tables

### Finding → code → test

| Finding | Code | Test (fails without the change) | Result |
|---------|------|----------------------------------|--------|
| QLT-C-01 (SCR-10 ignored state) | `export/page.tsx:38-54`; `estimate-export.tsx:361-378` | `tests/unit/export-page.test.ts` "QLT-C-01, as LEAD/ADMIN" (fail on base); "only the ignored refusal is turned into a state" (negative path) | Met |
| QLT-C-02 (Quoted notice words) | `estimate-texts.ts:108-111`; `estimate-workspace.tsx:154-160` | `tests/unit/estimate-workspace-locked-notice.test.ts` "a Quoted estimate …" (fails on base); Approved kept; Draft/Prepared none | Met (ux-expert sign-off on the words was asked for in the finding; not seen in this PR, so it is for QA/ux to confirm) |
| QLT-C-03 (unlock entry keeps status) | `unlock-service.ts:144-151`; `audit-events.ts:167-177`, `:585-586` | unit `approval/unlock.test.ts` `it.each` APPROVED/QUOTED; `audit-events.test.ts` Quoted words, legacy read, writer refusals; integration `mark-quoted.test.ts:279-280` (`status: 'QUOTED'`), `approval/unlock.test.ts:202-203` | Met (QLT-669-01, -02 Minor) |
| DEF-078 (no banner while ignored) | `estimate-workspace.tsx:146`, `:154` | `estimate-workspace-locked-notice.test.ts` DEF-078 block (3 cases fail on base) | Met |

## Issues for other roles

- **solution-architect:** architecture v0.65 line 919 (records-u; on master the confirmed-events list is near line 1237) says "An unlock or cancel from QUOTED writes the existing `approval.unlocked` and `approval.cancelled` entries. Their stored status may now be `QUOTED`." Before this PR that was **not true** of `approval.unlocked`, which had no status field. With this PR, code and text **agree**. Suggest making it exact: "`approval.unlocked` `before` holds `{approvedPrice, status}`, with status APPROVED or QUOTED (QLT-C-03, PR #669); an entry stored without status reads as APPROVED". Also state the #624 to #669 window from QLT-669-02. The confirmed-events list (master ~1237, records-u 1484) names events only and needs no change.
- **ux-expert:** confirm the words "Quoted and locked." (QLT-C-02) and the SCR-10 ignored state (refusal sentence plus "Back to the estimate", QLT-C-01), as the final review asked.
- **orchestrator:** E2E shard 4 (`users.spec.ts:58`) must be green on the re-run before the squash-merge (§9 item 1).

## Previous Findings (re-review only)

| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| QLT-C-01 | Minor | Fixed | As suggested (catch `ESTIMATE_IGNORED`, read-only notice, link back) |
| QLT-C-02 | Minor | Fixed | Words pending ux confirmation |
| QLT-C-03 | Minor | Fixed | With QLT-669-01 and -02 as small follow-ups |
| DEF-078 (Sev-3) | — | Fixed (developer); QA to verify | |
