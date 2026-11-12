# Consolidated review: AQP-81 (STORY-01.05 password rule and own-password change), PR #341

| Field | Value |
|---|---|
| Story | AQP-81 (STORY-01.05), Jira In Review |
| PR / head | #341 at c4517e6 (`feat/AQP-81-password-rule-2`, base `master` 3f22672; re-cut from `feat/AQP-81-password-rule` after the Gitleaks incident, DL-188) |
| Route | Full three-reviewer route |
| CI (G5) | 43235390390 attempt 1, 5 of 5 + fan-in. Against 3f22672's push run 43197966408: unit 3,350 (+156), all levels 5,758 (+200), E2E 284 + 282 + 269 = 835 (+15), skipped 24 (+0); changed-code coverage 96.0 %; JS budget 10 rows within 200,000 (`/account` 169,341). Path 6:08 at three shards (base 5:40). The median of five (DL-190 (4)) is being taken by the orchestrator |
| Merge order | DL-190: AQP-142 before AQP-81 in every case (11 shared files; the developer merges `master` into #341 after #297 merges); AQP-276 before AQP-81 unless a DL-190 (3) trigger fires |
| Compiled by | orchestrator, 2026-11-12 |

## Verdicts

| Reviewer | Verdict | Blocker | Critical | Major | Minor | Info | Source |
|---|---|---|---|---|---|---|---|
| reviewer-standards | REQUEST CHANGES | 0 | 0 | 1 | 5 | 5 | `standards.md`, Jira 11694 |
| reviewer-quality | REQUEST CHANGES | 0 | 0 | 2 | 4 | 6 | `quality.md`, review 5876524066, Jira 11700, control #343 (closed unmerged) |
| reviewer-performance | APPROVE WITH COMMENTS | 0 | 0 | 0 | 3 | 1 | `performance.md`, Jira 11697 |
| **Total** | | **0** | **0** | **3** | **12** | **12** | |

Overlaps, which are kept as separate IDs because the reviewers state them differently:
- **QLT-03 = the reset-throttle point** raised by reviewer-performance under "For other roles". It carries no PRF ID.
- **STD-07 (Info) and open question 2:** both cover the missing audit event for an own-password change. reviewer-quality also judges it acceptable against FR-011.
- **PRF-03 is not a code finding.** It is the CI path reading, so it is a measurement condition and holds nothing (DL-173 (3)).

## Findings (sorted by severity)

| ID | Severity | Where | Finding | Proposed fix / owner |
|---|---|---|---|---|
| QLT-01 | **Major** | `src/server/services/account-service.ts:87-95`; `src/lib/auth/change-password.ts:31-42` | A new password equal to the current one is accepted. A must-change person can re-enter the Admin's temporary password and clear the flag, which breaks FR-004 ("temporary") and the story's purpose | Developer: refuse new = current on the server and the page. ux-expert supplies the message. The `tests/support/route-calls.ts:88` recipe must change |
| QLT-02 | **Major** | `src/lib/auth/common-passwords.ts:10033-10045` | The stripped check removes digits as well as symbols from both ends, so list entries that start or end with a digit never match. Probe: `1234567890!`, `123456789!`, `11111111111!`, `1qaz2wsx!!` pass. This is the case architecture §8 says the stripped check exists to catch | Developer: add a check with only symbols stripped from both ends, plus tests for the probe values |
| STD-01 | **Major** | `src/lib/auth/common-passwords.ts:4-6` | The bundled SecLists list is MIT-licensed, but only a copyright line and URL are kept, not the MIT permission notice | Developer: add `src/lib/auth/LICENSE-SecLists-MIT.txt` beside the list (as the fonts already do) |
| QLT-03 | Minor | `src/server/services/user-service.ts:213` | The Admin reset clears the sign-in throttle key but not the password-change key. A reset person can get a 429 on "Set a new password", their only open page, for up to 15 minutes | Developer: also clear `passwordChangeThrottleKey`, plus a test |
| QLT-04 | Minor | `change-password-form.tsx:126-132` | A 409 "changed elsewhere" is shown as "check your connection"; the server's wording is dropped | Developer |
| QLT-05 | Minor | `src/lib/auth/password-rule.ts:14` | AC-1 says "one zod rule", but the rule is a plain function, and the deviation is not recorded | Developer: record it in the Dev Record. solution-architect: §8 wording |
| QLT-06 | Minor | `src/server/http/route-manifest.ts:78` (with `:192-193`) | No test pins which routes are open to a must-change user. Control C2 (opening `GET /api/v1/options/materials`) stayed green | Developer: a test that pins the allow-list |
| STD-02 | Minor | `common-passwords.ts:18` | The 10,046-line list has no note that the size is intended | Developer |
| STD-03 | Minor | `common-passwords.ts:11-14` | Nothing enforces "server only" for the list | Developer: `import 'server-only'` (reviewer-performance supports this) |
| STD-04 | Minor | `change-password-form.tsx:71-235` | `ChangePasswordForm` is 165 lines with repeated blocks | Developer: split or justify |
| STD-05 | Minor | `src/lib/auth/account-client.ts:13-14` | `CURRENT_PASSWORD_WRONG_RESPONSE` is exported but unused, and it duplicates codes in `src/lib/errors.ts` | Developer |
| STD-06 | Minor | `change-password.ts:15`, `errors.ts:72`, `texts.ts:22` | "15 minutes" is typed into messages instead of being derived from `THROTTLE_POLICY.blockMilliseconds` | Developer |
| PRF-01 | Minor (PRD gap) | `account-service.ts:87-94` | Verify plus hash takes about 515 ms on a development machine, above NFR-010's proposed 500 ms for saves. The PRD does not say whether password routes count. Cold path, so no code change | product-manager with the solution-architect |
| PRF-02 | Minor | `tests/e2e/account.spec.ts:218` | The AC-6 block test reads no layout but runs at three widths; `@one-width` would save about 16.8 s of test time | Developer (subject to the `@one-width` allow-list rules) |
| PRF-03 | Minor (measurement) | run 43235390390 | Path 6:08 against 5:40 at three shards; a median of five is due (§10.5 item 5) | Orchestrator, running now (DL-190 (4)) |
| STD-07 | Info | `route.ts:22` | No log or audit trace of a successful own-password change (open question 2) | product-manager: audit follow-up |
| STD-08 | Info | `src/server/views/schemas/account.ts:4` | The account schema imports password constants from the Users module | Developer, optional |
| STD-09 | Info | `session-harness.ts:133`, `account-route.test.ts:40` | A test secret literal is typed twice | Developer, optional |
| STD-10 | Info | `.env.example:39-41` | No comment about the password rule (file not in the diff) | Developer, optional |
| STD-11 | Info | commit 84cae81 | The `wip:` prefix is not a Conventional Commits type; moot under squash | None |
| QLT-07 to QLT-12 | Info | see `quality.md` | Session cookie notes (ADR-009 meaning of `signedAt`), wording, service structure | See `quality.md`; solution-architect for ADR-009 |
| PRF-04 | Info | `route.ts:20` | `withRoute` logs no duration | Follow-up, optional |

## Open questions of the developer (reviewers' view)

All five are judged acceptable by reviewer-quality, with these notes:
- (1) The blocked wording is true and fits. ux-expert to adopt it.
- (2) No audit event: matches FR-011. product-manager to decide on a follow-up (STD-07).
- (3) The product words are refused anywhere in a password. This is stricter and safer; product-manager to confirm that `quotation` stays.
- (4) The fresh cookie comes from the route, not next-auth `update`, which deviates from A-3. This is safer; the solution-architect records it in ADR-009 / §8.
- (5) The extra wording is fine except the 409 case (QLT-04). ux-expert to adopt it.

## For master (G6)

- 0 Blocker, 0 Critical; 3 Major (QLT-01, QLT-02, STD-01), each with a stated small fix.
- Fix round: any developer push cancels a running re-run, so it waits until the orchestrator's median of five on c4517e6 is complete.
- After the fix round, the reviewers whose blocking findings were raised re-review only the new diff: standards (STD-01) and quality (QLT-01, QLT-02, plus re-plants as needed).
