# Review Report — AQP-188 (STORY-10.13: lazy account menu and drawer, DEF-013 early tap) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards (security included) |
| Review round | 1 |
| Base…branch | `master (f5af00a)...feat/AQP-188-lazy-account-menu-and-drawer` (PR #75) |
| Commit reviewed | 3142157cc6a01f6d22445c9ab0e42638492f1f78 |
| Date | 2026-11-05 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The account menu panel and the mobile drawer now load on first open through one shared loader that uses literal `import()` calls and lets a later press retry a failed load. A tap made before hydration is kept by a small inline script and replayed once the page is interactive.

The security-relevant parts conform:
- the inline script is a server-rendered constant with no injection path and no user data;
- the client frame receives exactly the props it had before, built in one function and tested;
- sign-out is still the CSRF-protected POST;
- no dependency is added.

The temporary CI edit was reverted, so the net diff leaves `.github` untouched. There is one Minor finding: the new E2E spec is over 400 lines.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 1 |
| Info | 5 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| Full diff | `git fetch origin pull/75/head` (no branch switched), then `git diff f5af00a 3142157` | 23 files; security-relevant source read in full |
| Net workflow change | `git diff 2b10890^ 3142157 -- .github` and `git diff --stat f5af00a 3142157 -- .github package.json package-lock.json` | Empty: no workflow, dependency or lockfile change |
| Dynamic imports | `git grep "import("` | Literal paths only (`./portal-account-panel`, `./menu-drawer`) |
| Hygiene | Reading the added lines | No `console.*`, TODO, `eslint-disable`, `any`, type assertion or secret |
| CI | run 41975770162 | Green; step 11b: `/` 160,593 B, `/queue` 161,706 B |
| Local lint / type-check | not run | The main folder holds another branch; CI covers them |

## Security checklist
| Area | Result |
|------|--------|
| Inline early-intent script | A constant; only `JSON.stringify` of constants is interpolated; rendered server-side via `dangerouslySetInnerHTML` from that constant only; no request, storage, cookie or user data; listeners removed and global deleted at hydration. No CSP yet; when the CSP is built, allow it by nonce or SHA-256 hash, never by `'unsafe-inline'` (STD-01) |
| Loader with retry | Literal `import()`; a failure becomes visible state; retry only on a new press; pure reducer unit-tested (STD-04) |
| Client and server boundary | `portalFrameProps` picks name, e-mail, role label and navigation only; no id, no `mustChangePassword`; tested (STD-05) |
| Sign-out | `signOutOfPortal()`: CSRF-protected `POST /api/auth/signout`, unchanged; only its load timing moved |
| Dependencies | None added |
| Hydration warnings | `suppressHydrationWarning` only on the two controls whose `aria-busy` the early script may set |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Info | `src/lib/ui/early-intent-script.ts:20-29` | §5; architecture §10 (CSP) | The inline script will need the CSP nonce or a hash once a CSP exists | Risk that the CSP story reaches for `'unsafe-inline'` | Export or test the script's SHA-256; record a follow-up for the CSP story: nonce or hash, never `'unsafe-inline'` |
| STD-02 | Minor | `tests/e2e/shell-lazy-load.spec.ts` (whole file, 447 lines) | §1 file size | Over the 400-line limit | Hard to review; it will grow | Split by concern (load, menu and drawer vs first-open and early tap); helpers are already in `support/lazy-load.ts` |
| STD-03 | Info | `tests/e2e/shell-lazy-load.spec.ts:243, 264` | Test strategy §10 | `timeout: SLOW_REQUEST_MILLISECONDS * 3` on expectations | Acceptable (derived from the scenario delay), but it reads like a raised limit | Name the constant and comment that it is not a speed limit |
| STD-04 | Info | `src/components/shared/use-first-open.ts:68-85` | §4, ADR-010 | The loader conforms; the rejection reason is dropped; module-level `pendingControl` | No operator visibility of chunk-load failures | Report the failure (name only) when a client error reporter exists |
| STD-05 | Info | `src/app/(portal)/portal-frame-props.tsx:43-54` | ADR-008, NFR-002 | Good practice: one explicit projection; sign-out unchanged; no dependency | — | — |
| STD-06 | Info | Commits 2b10890 and 3142157 | §9 version control | A temporary required-workflow edit and its revert; the revert subject is git's default, not a Conventional Commit | No net change; evidence recorded (run 41974232482) | Squash-merge; use a throwaway PR or `workflow_dispatch` for evidence runs in future |

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-188/standards.md` (local, uncommitted)
- Jira / GitHub updates: PR #75 COMMENT review (5 inline comments plus the summary); label `review:standards-approved` added (other labels kept); hand-off comment on Jira AQP-188
- Open questions: none
- Risks raised: CSP follow-up for the inline script (STD-01)
- Recommended next agent: master, for the G6 decision; the developer can do STD-02 (a file split) cheaply; the merge should be a squash merge (STD-06)
