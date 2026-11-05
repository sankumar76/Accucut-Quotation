# Review Report — AQP-169 (STORY-10.10 NFR-009 guards) — Standards

| Field | Value |
|-------|-------|
| Reviewer | reviewer-standards (security included) |
| Review round | 1 |
| Base…branch | `master...feat/AQP-169-nfr-009-guards` (PR #70), PR diff at 51b0954; the update from master (head 4ffc016) is not reviewed |
| Commit reviewed | 51b0954 (review anchored on 4ffc01634b21101117fc009e9034d44500b4588c) |
| Date | 2026-11-04 |
| **Verdict** | APPROVE WITH COMMENTS |

## Summary
The story adds three things:
- a required JS-budget step (11b);
- a nightly Lighthouse run;
- a CI feedback-time report.

The supply chain for `@lhci/cli` 0.15.1 is clean: 276 dev-only packages, all from registry.npmjs.org, no install scripts, and no change to any existing package. The single licence exception is approved and tested. The CI workflows follow least privilege: read-only token, no secrets, SHA-pinned actions, and generated, masked credentials. Logging never prints a credential, token or database error.

There are three Minor findings:
- the measurement-user script inherits the test guard's staging allowance;
- a script imports test support;
- a header still names the old report-file pattern.

| Severity | Count |
|----------|-------|
| Blocker | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Info | 6 |

## Checks Run
| Check | Command | Result |
|-------|---------|--------|
| PR diff | GitHub `pull_request_read` (36 files; the large lockfile patch is omitted by GitHub) | All workflow, config, script and test source read |
| Lockfile | `git fetch` (no switch), `git show 51b0954:package-lock.json` and `9d924a1:package-lock.json`, compared package by package | 276 added (all `dev`), 0 changed, 0 removed, 0 `hasInstallScript`, all from registry.npmjs.org; licences 211 MIT, 26 Apache-2.0, 24 ISC, 8 BSD-3, 5 BSD-2, 1 0BSD, 1 none (`parse-cache-control`); 1 deprecated nested `rimraf@3.0.2` |
| CI | run 41927088763 | Green |
| Local lint / type-check / tests | not run | The main folder holds another branch; CI covers them |
| Hygiene | Reading the added lines | No secret, `console.*`, `any` or assertion; two `eslint-disable-next-line` lines with reasons (CommonJS `require`) |
| Commits | `git log 9d924a1..51b0954` | 9 Conventional Commits with `[AQP-169]` |

## Security checklist
| Area | Result |
|------|--------|
| New devDependency and supply chain | Exact pin, dev only, clean lockfile (above); audit highs dev-only, architect-accepted (#39) |
| Licence exception | `parse-cache-control`: named, reasoned, architect ruling (AQP-169 comment 10738, architecture §11), tested |
| `ci.yml` step 11b | Password from `openssl rand`, masked before use; invented e-mail; no secret |
| `nightly.yml` | `contents: read`, `actions: read`; no repository secret (`LIGHTHOUSE_B0` is a variable); `pull_request` only; SHA-pinned actions; `persist-credentials: false`; Postgres pinned by digest; database, measurement and `AUTH_SECRET` values generated and masked; reports to filesystem and a 30-day artefact; `--no-sandbox` justified |
| Measurement user | Invented, never printed, database errors not printed; refused for production by the guard; **allowed on staging** (STD-01) |
| Logging | Status and path only for GitHub API errors; no token, body or credential printed anywhere |
| File reads | `staticReader` confined to `.next/static` (path containment) |

## Findings
| ID | Severity | File:line | Rule | Issue | Impact | Suggested fix |
|----|----------|-----------|------|-------|--------|---------------|
| STD-01 | Minor | `scripts/ensure-measurement-user.ts:28-38` | §5 least privilege | Uses the test guard, which also allows `STAGING_DB_HOST` | Could create an active Admin on staging with a fixed e-mail, a test-cost hash and no forced password change | Allow loopback and the CI service host only; refuse `NODE_ENV=production`; optionally require `CI=true`; add a test |
| STD-02 | Minor | `scripts/ensure-measurement-user.ts:16-17` | §3 layering | `scripts/` imports `tests/support/db-guard` and `tests/support/builders/user` | A test-helper change silently alters a required CI step | Move both to a shared non-test module, or move the script under `tests/support` |
| STD-03 | Minor | `scripts/summarise-lighthouse.ts:4` | §8 accurate comments | Header says `lhr-*.json`; the code reads `*.report.json` (fixed in 44baebd) | Invites the old bug back | Update the header |
| STD-04 | Info | `scripts/ensure-measurement-user.ts:45-50` | §4, §10 | Printable errors chosen by `message.endsWith('is not set')` | Fragile, though fails safe | Throw `ConfigurationError` from `required()` |
| STD-05 | Info | `scripts/check-js-budget.ts:61-66` | §5 | `--base-url` sends the measurement credentials to any host, possibly over `http` | No risk in CI (option unused, invented credentials) | Accept only localhost or `https`, or document it |
| STD-06 | Info | `tests/integration/next-server.test.ts:71`, `tests/integration/summarise-lighthouse-script.test.ts:71` | Test strategy §10, DL-057 | Per-file `120_000` hook limits repeat the shared one | Diverge if the shared limit changes | Drop the argument |
| STD-07 | Info | `package.json:45` | §5 dependencies | Supply-chain review | No finding | — |
| STD-08 | Info | `.github/workflows/nightly.yml:42-44` | Architecture §8 TB-6 | CI security review | No finding; on a failed start the `next start` log is printed into a public log, so keep it free of anything not masked | — |
| STD-09 | Info | `scripts/lib/js-budget-run.ts:18-30` | §5, §10 | Good practice: path containment, credentials in memory only, invented server environment, validated repository name, zod on external JSON | — | — |

## Previous Findings (re-review only)
First round.

## Hand-off
- Status: COMPLETE
- Artefacts written/updated: `docs/06-reviews/AQP-169/standards.md` (local, uncommitted)
- Jira / GitHub updates: PR #70 COMMENT review (9 inline comments); label `review:standards-approved` added (other labels kept); hand-off comment on Jira AQP-169
- Open questions: none
- Risks raised: none new (STD-01 is a small hardening)
- Recommended next agent: master, for the G6 decision; the developer should take STD-01 to STD-03 (small)
