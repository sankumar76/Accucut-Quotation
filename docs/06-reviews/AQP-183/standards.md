# Review Report — AQP-183 (DEF-008) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards |
| Review round | 2 (DEF-010 round, `0a5b10d..0cfaf78` including the merge from master); round 1 kept below |
| Base…branch | `master...docs/AQP-183-pressed-state` (PR #56) |
| Commit reviewed | round 1: 64bef0dceabd314377849801be0057bf577c057d · round 2: 0cfaf78f169ed5b0664a06a9a163296936322a10 |
| Date | 2026-11-04 |
| **Verdict** | APPROVE WITH COMMENTS (both rounds) |

## Round 2 (DEF-010: 0a5b10d..0cfaf78)

### Summary
The round applies UX spec v0.10 §7.3.1, with values from the ux-expert (AQP-185 comment 10849):
- two darker pressed tokens, `--primary-pressed` and `--danger-pressed`;
- an instant press (`active:transition-none`) with a 200 ms ease-out fade on release;
- `select-none` on every button;
- `-webkit-touch-callout:none` on the real `<button>` only.

It conforms, with one Minor naming finding. The merge from master is clean: there are no conflict hunks, and it brings only AQP-38, already reviewed on PR #58. There is no security impact.

| Severity (new code) | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 3 |

### Checks run (round 2)
| Check | Command | Result |
|-------|---------|--------|
| Round diff | `git fetch origin docs/AQP-183-pressed-state`, then `git diff 0a5b10d 0cfaf78` (no branch switched) | Code, tests, tokens and UX documents read |
| Merge | `git show --cc d01352c`; `git diff --stat 85c699f 0cfaf78` | No conflict hunks; net PR against master is still only the AQP-183 files |
| CI | run 41873955569 | Green, stages 1 to 12 |
| Hygiene | Reading the added lines | No secret, `console.*`, `any`, assertion or TODO; no dependency |
| Commits | `git log` | `docs(ux): … [AQP-183]`, `fix(ui): … [AQP-183]` (with bodies), and a default merge message |

### Previous findings
| ID | Prior severity | Status | Note |
|----|----------------|--------|------|
| STD-01 | Minor | Still applies, not fixable | Branch stays `docs/`; master records PR #56 as a code PR merged by the delivery lead |
| STD-02 | Info | Fixed | a13f194: shared hook limit; the one-letter name is gone; thread resolved |
| STD-03 | Info | n/a | No finding |
| STD-04 | Info | Not changed | `cn.ts:6` long doc line; optional |
| STD-05 | Info | n/a | Security notes; the iOS question is answered by the delivery lead's own test |

### New findings (round 2)
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-06 | Minor | `src/components/ui/button.tsx:45-50` (use at :94) | §2 names reveal intent | `BUTTON_ONLY` names where the class goes, not what it does | The use site `cn(classes, BUTTON_ONLY)` does not say "no iOS callout" | Rename to `NO_TOUCH_CALLOUT` |
| STD-07 | Info | `src/components/ui/button.tsx:14-24` | §2 consistency (no formatter) | A doc line of about 125 characters; a base `cva` string of about 400 characters | Hard-to-read diffs | Optional: an array of class groups joined with `' '` |
| STD-08 | Info | `src/app/globals.css:81-82` (and :99, the `@theme` entries) | §5, §10 | Tokens, contrast, label, merge and security reviewed | None: naming follows the family, values match `screens.css`, contrast documented, label now accurate, merge clean, no security surface | None |
| STD-09 | Info | `tests/unit/button-pressed.test.ts:41` | Test strategy §10, §6 | Conforms: shared hook limit; checks the transition rule rather than timing it; retrying checks after release | `classesOfMarkup` takes the first `class=` (fine for `<button>`, fragile if the markup changes) | Anchor on `<button` or parse with a DOM if extended |

### Notes
- The PR now shows `mergeable_state: behind` (master has moved on since the merge). It must be brought up to date before merge; that is for the orchestrator or the delivery lead, not a finding.

### Hand-off (round 2)
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-183/standards.md` (local, uncommitted)
- Jira / GitHub updates: PR #56 COMMENT re-review (4 inline comments); STD-01, 02 and 04 threads replied to (STD-02 resolved); label `review:standards-approved` kept (labels re-read; no write needed); hand-off comment on Jira AQP-183
- Open questions: none
- Risks raised: none new
- Recommended next agent: master, for the G6 decision; record PR #56 as a code PR (STD-01). The developer can fix STD-06 by renaming one constant.

---

## Round 1 (64bef0d)

## Summary
The pressed state for every button variant is implemented cleanly:
- `active:` styles are outside the hover media query and come after hover.
- `disabled:active:` resets the look on disabled and loading buttons.
- A new `--shadow-pressed` token is registered with tailwind-merge.

The tests read the CSS that Tailwind builds and the computed style in a real browser at three widths. The only standards finding is version-control hygiene: the code fix is on a `docs/` branch. There is no security finding.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 4 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Full diff | GitHub `pull_request_read` (files, commits, comments) | 12 files. Code: `button.tsx`, `globals.css`, `cn.ts`. Tests: 2 new, 1 changed, 1 new support file. Docs/UX: 5 files, read for consistency only |
| Lint / type-check / build / unit / integration / E2E | CI run 41831621385 | Green, stages 1 to 12. Merge state CLEAN |
| Local lint / type-check | not run | The main folder holds another branch, so the review was done through GitHub only |
| Secret / debug scan | Reading the added lines | No secret, `console.*`, TODO, `eslint-disable`, `any` or type assertion |
| Dependencies | `package.json` / lockfile in the diff | Unchanged |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `src/components/ui/button.tsx:14-19` (PR-level) | Coding Standards §9; CLAUDE.md §7.3 | The code fix is on branch `docs/AQP-183-pressed-state`; bug fixes go on `fix/<KEY>-<slug>` | Under `MERGE_POLICY = docs-auto, code-human` the prefix signals docs-only. The playbook's path check should still stop an auto-merge, but the name misleads, and the Jira development panel files the work as docs | Do not rename (renaming an open PR's head closes the PR). Master records PR #56 as a code PR, merged by the delivery lead. In future, put the code on a `fix/` branch |
| STD-02 | Info | `tests/unit/button-pressed.test.ts:40-43, 51, 82` | Test strategy §10, DL-057; §2 | A per-file hook limit of 60 s is lower than the shared `hookTimeout` of 120 s. One-letter name `d` | A Tailwind compile on a loaded machine could fail only here | Remove the `60_000` argument; rename `d` to `declaration` |
| STD-03 | Info | `src/app/globals.css:212-214` | §10 | `--shadow-pressed: var(--shadow-pressed)` in `@theme inline` refers to itself | None: the unlayered `:root` value wins (radius pattern, QLT-10), and CI stage 12 checks that the shadow paints | None |
| STD-04 | Info | `src/lib/cn.ts:6` | §2 consistency | Doc line of about 170 characters; no formatter configured | Readability | Re-wrap at about 115 characters |
| STD-05 | Info | `tests/support/css-declarations.ts:29-35` (PR-level) | §5 | Security review | No finding. Styling-only change: no new input, data flow or dependency; first-load JS +272 bytes, under NFR-009. The test loader reads only files from the repo and `node_modules`. Pressed contrast pairs are documented at 4.5 : 1 or more. The iOS `:active` question is routed to the solution-architect; any listener must be `{ passive: true }` in a client component | None |

<details><summary>Detailed notes & code suggestions</summary>

### STD-02
**Current**
```ts
beforeAll(async () => {
  ...
}, 60_000);
```
**Suggested**
```ts
beforeAll(async () => {
  ...
});
```
</details>

## Reviewer-specific tables
Not applicable to the standards review.

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-183/standards.md`
- Jira / GitHub updates: PR #56 COMMENT review (5 inline comments) and label `review:standards-approved`; hand-off comment on Jira AQP-183
- Open questions: none (the iOS `:active` question is already with the solution-architect)
- Risks raised: none new
- Recommended next agent: master, for the G6 decision; it should record PR #56 as a code PR (STD-01)
