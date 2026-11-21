# DEF-054: No page response carries a CSP, frame-ancestors, nosniff or Permissions-Policy, although architecture section 8 and ADR-010 require them

| Field | Value |
|-------|-------|
| Story / AC | AQP-28 (STORY-10.02, origin of follow-up #37); no story owns it. Requirement: `architecture.md` section 8 "Security headers" and threat rows TB-1; ADR-010 ("`proxy.ts` ... sets security headers") |
| Severity | **Sev-2 Major** (qa-engineer, 2026-11-21). A required security control is absent on every page; the workaround is a reverse proxy that adds the headers (not documented, not installed by the Windows package) |
| Priority | P2. **Blocks G8** under CLAUDE.md section 9 item 3 unless fixed or waived by the delivery lead in their own words |
| Type | Product |
| Status | **Closed 2026-11-21 (qa-engineer).** Fixed by PR #583 (squash `c0cf1d21`, combined security-and-quality review APPROVE WITH COMMENTS, 0 open above Info). Verified on the first `master` push run after the merge, 44924430846 (all jobs green; Windows package 44924430870 green): `security-headers.spec.ts` 21 of 21 on attempt 1. Jira AQP-384 Done, GitHub #37 closed. The live `curl -I` behind the real reverse proxy stays on the release-round list (section 8 of the final regression report); it is not a gate for this Bug |
| Jira / GitHub | [AQP-384](https://sankumar76.atlassian.net/browse/AQP-384) / [#37](https://github.com/sankumar76/Accucut-Quotation/issues/37) (existing follow-up, relabelled `bug`, `sev-2`). Same gap as reviewer-standards STD-F-01 (`docs/06-reviews/final/standards.md`); related STD-F-02 (#576, proxy requirements undocumented) |
| Found by / date | qa-engineer, final regression, 2026-11-21, by reading code (no live app) |
| Build / commit | master `242c21f7` |
| Environment | Read-only worktree; no run. A live header check is on the release-round list |

## Steps to Reproduce
1. Read `src/proxy.ts` (78 lines): it sets `Cache-Control` and `X-Robots-Tag` only.
2. Read `next.config.ts`: headers only for the logo (cache) and the two reset pages (`Referrer-Policy`, `Cache-Control`); no `headers()` for portal pages.
3. Search `src`, `deploy`, `scripts`, `.github` for `frame-ancestors`, `X-Frame-Options`, `Strict-Transport-Security`, `Permissions-Policy`, `Content-Security-Policy`: hits only in `src/server/http/file-response.ts` and `tests/unit/image-routes.test.ts` (file downloads and images). No test asserts a page header.
4. Live check for the release round: `curl -I` on `/sign-in` and a signed-in page; expect the section 8 headers.

## Expected Result
Every page and JSON response carries: CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, nonce or hash for scripts, `img-src 'self' blob:`, `style-src-attr 'unsafe-inline'` for Radix), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`; HSTS from the app or documented as the TLS proxy's job.

## Actual Result
None of them on any page. Any site can frame sign-in and the Approve, Unlock, Cancel and step-up dialogs (clickjacking). No CSP limits script injection if a later defect allows one.

## Evidence
`src/proxy.ts`, `next.config.ts` lines 12 to 56, the repo-wide search above, `docs/06-reviews/final/standards.md` STD-F-01.

## Suspected Area
`src/proxy.ts` or `next.config.ts`; `src/lib/ui/early-intent-script.ts` (the inline script needs the hash or nonce, STD-01 of AQP-188).

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Fixed | developer | 2026-11-21 | `fix/AQP-384-security-headers`, PR #583, squash `c0cf1d21`; header split per the architect (docs PR #581): the app sends CSP, nosniff, Referrer-Policy, Permissions-Policy; HSTS is the reverse proxy's only |
| Regression test added | developer | 2026-11-21 | `tests/unit/security-headers.test.ts` (44 tests: nine answer kinds, nonce per request, `NODE_ENV` switch, hash of the early-tap script), `tests/unit/auth-proxy.test.ts` (54), `tests/e2e/security-headers.spec.ts` (7 cases x 3 widths, production build) |
| Verified | qa-engineer | 2026-11-21 | `master` push run 44924430846 on `c0cf1d21`: unit 441 files / 9,792 tests and integration 595 files / 15,185 tests passed; JS budget passed; E2E 4 shards green (534 / 527 / 528 / 513 passed), the 21 header cases passed on attempt 1; 1 flaky (`customers.spec.ts:262` [desktop], not a header case). Windows package 44924430870 green. Live `curl -I` on a release candidate behind the proxy: release round, not run |

## Close-out (qa-engineer, 2026-11-21)
- **Expected result met:** every page (sign-in, forgot and reset password, the signed-in frame), redirect, JSON answer, static file and the picture download carries the section 8 headers. The page CSP has a nonce per request (a second request gets another), `frame-ancestors 'none'`, no `unsafe-inline` and no `unsafe-eval` in `script-src`, `style-src-attr 'unsafe-inline'` for Radix and `img-src 'self' blob:`. Also `nosniff`, `X-Frame-Options: DENY` (kept beside `frame-ancestors`), `Referrer-Policy` (`no-referrer` on the two reset pages) and `Permissions-Policy` (camera, microphone, geolocation and others off). HSTS: the app never sends it (a test pins that); the reverse proxy sets it (architecture section 8, P3).
- **Nothing broke:** a violation recorder (event and console) read an empty list on the pages and on the signed-in frame with the menu drawer and the account menu (the scroll-lock style element); a control test shows the recorder does see a violation. Framing from another origin is refused (a control frame proves the check). The picture download keeps `sandbox` on the wire (SQR-01 of the review).
- **Not part of this Bug and still open:** STD-F-02 (#576, install-guide section on the reverse proxy: X-Forwarded-For, HSTS, token kept out of access logs, body cap), built in PR #590 and written in docs PR #581 (neither merged at this close-out); the live header check behind the real proxy on the rehearsal install (release round). Review Info items SQR-05 (the section 8 table, in #581) and SQR-09 (name `/api/auth` in the public-path check) belong to the architect and the developer.
- **Watch raised by this run:** `customers.spec.ts:262` [desktop] failed attempt 1 at 19.4 s (an `expect(alertdialog).toBeVisible()` ran out on its own 15 s, not a budget cut) and the retry passed in 11.6 s. It is the first occurrence in the six `master` push runs QA read (44907312557 to 44924430846) and the first `master` run with the CSP. No CSP violation is shown and the header cases pass. Recorded in test plan section 7.1 as a watch item for master.
