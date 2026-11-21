# DEF-054: No page response carries a CSP, frame-ancestors, nosniff or Permissions-Policy, although architecture section 8 and ADR-010 require them

| Field | Value |
|-------|-------|
| Story / AC | AQP-28 (STORY-10.02, origin of follow-up #37); no story owns it. Requirement: `architecture.md` section 8 "Security headers" and threat rows TB-1; ADR-010 ("`proxy.ts` ... sets security headers") |
| Severity | **Sev-2 Major** (qa-engineer, 2026-11-21). A required security control is absent on every page; the workaround is a reverse proxy that adds the headers (not documented, not installed by the Windows package) |
| Priority | P2. **Blocks G8** under CLAUDE.md section 9 item 3 unless fixed or waived by the delivery lead in their own words |
| Type | Product |
| Status | New (logged 2026-11-21) |
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
| Fixed | developer | | `fix/AQP-384-<slug>`; solution-architect for the nonce and the hash |
| Regression test added | developer | | a header test per route kind (page, JSON, file) and an E2E and axe run showing nothing breaks |
| Verified | qa-engineer | | `curl -I` on the release candidate, then CI |
