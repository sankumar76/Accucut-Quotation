# G8-C-NEXTADV: does the Next.js "known security vulnerability" notice apply to production?

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards (dependency review, DL-474 (d)) |
| Question | The Next.js development server printed "known security vulnerability, upgrade Next.js". Does that apply to this project's production use of `next` at the version on `master`? |
| Read against | `origin/master` at `46490f27` (AQP-502, #833, 2026-11-27). Read-only: `git show`, `git grep`, `npm audit` on a copy of the two package files in the session scratch folder, `curl` GET/POST of public package names and versions, `gh api` (read). No install, no `npm audit fix`, no lockfile change, no server, nothing changed in any checkout. |
| Date | 2026-11-27 |
| Rule book | DL-474 (d), DL-344, `docs/standards/coding-standards.md` (dependency rules), CLAUDE.md section 9 |
| **Verdict** | **No advisory applies to `next` 16.4.5, in production or in development. Recommendation: no action (A, B and C are not triggered). Keep DL-344: 16.4.6 (#476) and the other bumps stay after G8.** The notice is explained by a stale local install (16.4.3), not by the pinned version. See STD-N-01. |

## 1. The version

| Where | `next` | Evidence |
|-------|--------|----------|
| `origin/master` `package.json` | `16.4.5` (exact pin) | `git show origin/master:package.json` |
| `origin/master` `package-lock.json` | `16.4.5`, `node_modules/next` | `git show origin/master:package-lock.json` |
| `origin/master` `eslint-config-next` (dev only) | `16.4.6` | same file; a one-patch mismatch with `next`, dev-time lint only, no advisory (STD-N-03) |
| The local ref `master` | **stale**: 259 commits behind `origin/master`, still says 16.4.3 | `git rev-list --count master..origin/master` = 259. Use `origin/master` for any "on master" statement. |
| Main checkout, `node_modules/next/package.json` | **16.4.3** (its `package.json` says 16.4.5) | read-only file read. See STD-N-01. |
| Worktrees `aqp-441`, `aqp-503` | 16.4.3 installed | same |
| All other worktrees that have `node_modules` | 16.4.5 | same |

Release dates (npm registry): 16.4.3 on 23 Oct, 16.4.4 on 2 Nov, **16.4.5 on 3 Nov**, 16.4.6 on 9 Nov (latest stable).

## 2. Where the notice comes from

It is not a hard-coded list. `node_modules/next/dist/lib/upgrade/nudge.js` and `prepare-upgrade.js` (16.4.5) show that `next dev` and `next build` run an "agent upgrade" check. The default policy is `agentUpgrade: 'security'` (`dist/server/config-shared.js:192`). The check POSTs the installed version to `https://registry.npmjs.org/-/npm/v1/security/advisories/bulk` and prints "Installed Next.js version X is affected by a known security vulnerability" only if that version falls in an advisory range. The check is called from `next dev` (`dist/cli/next-dev.js`, `dist/server/lib/router-server.js:174-202`) and `next build` (`dist/build/index.js:546-557`). `dist/cli/next-start.js` and `dist/server/lib/start-server.js` do not reference it, so `next start` and the standalone `server.js` never run it. The project does not override the policy (`next.config.ts` sets `agentRules: false` only; no `agentUpgrade` anywhere in `origin/master` outside the lockfile).

A fixed "forced for testing" message exists too (`__NEXT_AGENT_UPGRADE_FORCE_TERMINAL_FOR_TESTING=1`), but nothing in the repository sets it.

## 3. Result of the advisory read

| Source | Result for `next` 16.4.5 |
|--------|--------------------------|
| `npm audit --omit=dev --json` (on `origin/master`'s `package.json` and lock) | **0 vulnerabilities** (info 0, low 0, moderate 0, high 0, critical 0; 700 production dependencies audited) |
| `npm audit --json` (all dependencies, for comparison) | **0 vulnerabilities** (1,376 dependencies) |
| npm bulk advisory endpoint, the one `next dev` calls | `next@16.4.5` returns `{}`; `16.4.6` returns `{}`; `16.4.4` returns **7**; `16.4.3` returns the same 7 |
| GitHub Advisory Database (`gh api advisories?affects=next@16.4.5`) | no advisories |
| Next.js blog, "November 2026 Security Release" (3 Nov 2026) | 16.4.5 (Active LTS) and 15.5.29 are the patched releases. The advance notice of 27 Oct says "seven medium vulnerabilities" |
| context7 (`/vercel/next.js`) | used to confirm the runtime of `proxy.ts` (row 5 of section 4) |

**So 16.4.5 is the first patched version for all seven advisories of the November release. No advisory is open against 16.4.5 or 16.4.6 today.**

## 4. Advisory classification

The seven below are the only advisories the registry holds for the 16.4 line. All were fixed in 16.4.5. Against the pinned version each is **not applicable** (fixed). The right-hand columns show what would have applied had production been built on 16.4.3 or 16.4.4, so that the answer holds if someone asks "and if the build used the stale install?". The answer is the same: none of them reaches this project's code.

| # | ID (CVE) | Severity | Affected / fixed | Feature | Used in production by this project? | Class at 16.4.5 |
|---|----------|----------|------------------|---------|-------------------------------------|-----------------|
| 1 | GHSA-mfr8-8qww-v76h (CVE-2026-119790) | Medium in the GitHub DB; **High** in the Next.js blog post | 16.3.0 to 16.4.4 / 16.4.5 | Cache Components: `use cache` read through `unstable_cache` | No. `git grep` for `use cache`, `unstable_cache`, `cacheComponents`, `cacheLife`, `cacheTag` in `src/` and `next.config.ts`: no match. `next.config.ts` has `experimental: { authInterrupts, proxyClientMaxBodySize }` only. | **Not applicable** (fixed in 16.4.5; feature unused) |
| 2 | GHSA-vc7v-qv4w-wrv8 (CVE-2026-119351) | Medium | 16.2.0 to 16.4.4 / 16.4.5 | Cache Components: nested `use cache` | No: same grep, no match | **Not applicable** |
| 3 | GHSA-rhh4-g77r-r9qj (CVE-2026-119349) | Medium | 16.0.0 to 16.4.4 / 16.4.5 | `use cache` with binary arguments | No: same grep, no match | **Not applicable** |
| 4 | GHSA-vvgp-ww4w-46vf (CVE-2026-119350) | Medium | 16.4.0 to 16.4.4 / 16.4.5 | Cache Components shell poisoning under `next start` | No: Cache Components is off (no `cacheComponents` setting) and there is no `generateStaticParams` in `src/` | **Not applicable** |
| 5 | GHSA-f3mh-rxg3-f5g2 (CVE-2026-119346) | Medium | 16.0.0 to 16.4.4 / 16.4.5 | Edge-runtime route handlers: cookie values in the internal `x-middleware-set-cookie` header | No. No route sets `runtime = 'edge'` (`git grep` in `src/`: none). The one file near the edge, `src/proxy.ts`, is a Next.js 16 `proxy` file, which always runs on the Node.js runtime; Next.js rejects a `runtime` setting there (context7, `docs/.../proxy.mdx`). The advisory says Node.js route handlers were not affected. | **Not applicable** |
| 6 | GHSA-pc58-hwjq-p385 (CVE-2026-119348) | Medium | 16.0.0 to 16.4.4 / 16.4.5 | A route handler returns an attacker-controlled fetched `Response` unchanged, behind an HTTP/1.1 pipelining proxy | No. `git grep "fetch("` in `src/`: no call (no outbound fetch to forward). Routes are built with `withRoute` and return their own JSON. | **Not applicable** |
| 7 | GHSA-7qx7-33qx-rqx2 (CVE-2026-119347) | Medium | 16.0.0 to 16.4.4 / 16.4.5 | Image optimisation (SVG rejection bypass) | No. `next.config.ts` sets `images: { unoptimized: true }`; no `next/image` import in `src/` (`src/components/shared/brand-lockup.tsx:21` says why); `/_next/image` is excluded in the proxy matcher (`src/proxy.ts:119`) | **Not applicable** |

None of the seven is "dev-only"; all seven were server-side features. None is "applies to production" for this project.

Production deployment context (DL-474 asks for it): R1 is the standalone `server.js` in a release zip on a local Windows server behind the reverse proxy (`deploy/windows/services/AccucutApp.xml`, `deploy/windows/README.md`), built by CI from `package-lock.json` with `npm ci`. So the version that ships is the lockfile's 16.4.5, not any developer's `node_modules`.

## 5. Findings

| ID | Severity | Where | Finding |
|----|----------|-------|---------|
| STD-N-01 | Minor | The checkout where `next dev` printed the notice (most likely the main checkout, `C:\Users\sanku\Documents\Accucut - Quotation App`; also worktrees `aqp-441` and `aqp-503`) | **Stale install.** `package.json` says 16.4.5, but `node_modules/next/package.json` says **16.4.3**, which is inside the range of all seven advisories. A `next dev` there would print exactly the notice quoted, and it would be right for what is installed. I cannot prove which checkout printed it (no server run, by constraint), but this is the only source I found: 16.4.5 returns no advisory from any database. *Why it matters:* a developer or the delivery lead would be running (and testing the demo on) a build that the lockfile does not describe, and the notice trains people to ignore it. *Fix:* in that checkout run `node -p "require('next/package.json').version"`; if it prints 16.4.3, run `npm ci` there (the same command CI uses, so it installs the lockfile as it is and bumps nothing). The worktrees `aqp-441` and `aqp-503` are old and can be pruned under the housekeeping rule. This is housekeeping, not an upgrade. |
| STD-N-02 | Info | `.github/workflows/ci.yml:237` | CI Stage 7 runs `npm audit --omit=dev --audit-level=high`. All seven advisories on 16.4.4 and earlier are Medium in the GitHub DB, so this gate would **not** have failed a build on 16.4.3. (The blog rates the first one High; the database does not.) The gate works as written and is green now. After G8, consider `--audit-level=moderate`, so that a Medium advisory on `next` shows as a red check and not only as a dev-server message. No change before G8. |
| STD-N-03 | Info | `package.json` (`eslint-config-next` 16.4.6, `next` 16.4.5) | The two are one patch apart. `eslint-config-next` is dev-time only and has no advisory. It travels with #476 / #632 after G8 (DL-344). No action now. |
| STD-N-04 | Info | Residual risk | The advisory databases move: all seven advisories were published 16 to 19 Nov, after the 3 Nov release of 16.4.5, so a new one can still appear before G8. The read above is a snapshot of 2026-11-27. *Cheap re-check:* on the day of the last merge, run `npm audit --omit=dev --audit-level=high` (CI stage 7 already does this on every PR) and `curl -s -X POST -H "content-type: application/json" -d '{"next":["16.4.5"]}' https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`; `{}` means none. If either is non-empty, the DL-474 question (A, B or C) is asked then, with that advisory's text. |

No Blocker, Critical or Major. Counts: Blocker 0, Critical 0, Major 0, Minor 1, Info 3.

## 6. Answer to the question, in the DL-474 terms

- **Applies to `next start` in production?** No. No advisory is open for 16.4.5, and the seven that were open for 16.4.4 and earlier cover features this project does not use (section 4).
- **Applies to R1's deployment (local Windows server, private network)?** No, for the same reason. Each of the seven also needs a feature the project does not use (Cache Components, Edge routes, image optimisation, forwarded fetched responses), so none would have applied even on 16.4.3.
- **First patched version?** 16.4.5, which is already the pin. Nothing newer is needed for security (16.4.6 has no security fixes: DL-320 (1), and the registry returns no advisory for it either).
- **Human question (A, B, C)?** Not asked. It was to be asked only if an advisory applies to production.

**One-line recommendation: no action. Do not upgrade; leave DL-344 as it is; run `npm ci` in the checkout that printed the notice (STD-N-01); repeat the two-command check on the day of the last merge (STD-N-04).**

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/final-cr01/g8-c-nextadv.md` (records-u worktree, branch `docs/AQP-1-records-u`)
- Jira / GitHub updates: none made by this review; the orchestrator posts the Jira comment. No GitHub issue created (no finding at Major or above).
- Open questions: none (the A/B/C question is not triggered)
- Risks raised: none new. Residual: STD-N-04 (a new advisory could still appear before G8; re-check on the last-merge day).
- Recommended next agent: orchestrator, to record "G8-C-NEXTADV: no action" against DL-474 (d), and to tell the delivery lead about the stale install (STD-N-01) in the daily update.
