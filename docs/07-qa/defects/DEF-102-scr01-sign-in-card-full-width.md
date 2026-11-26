# DEF-102: SCR-01 sign-in card spans the full content width at 768 and 1366 px (design: a centred column of about 480 px); minor: a separate reveal-password button and an e-mail placeholder (conformance; Product; Sev-3 proposed; Jira AQP-459, GitHub #752)

| Field | Value |
|-------|-------|
| Story / AC | AQP-38 (STORY-01.01); SCR-01 Sign in (768 and 1366 px); the ux-expert's batch 1, item K. The mock-up and spec text quoted below. |
| Severity | **Sev-3 proposed by QA** (the ux-expert's word: Major + Minor); **master grades.** |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** Not yet graded by master. |
| Jira / GitHub | [AQP-459](https://sankumar76.atlassian.net/browse/AQP-459) / [#752](https://github.com/sankumar76/Accucut-Quotation/issues/752) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-102, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
A centred column of about 480 px. Minor: the E-mail field with an icon inside the field and no placeholder (the ux-expert states no design for the reveal-password control beyond the field).

## Build (what the ux-expert saw)
The card spans the full content width, left aligned. Minor: the reveal-password control is a separate square button beside the field; E-mail has the placeholder 'name@company.com'.

## Ruling check
Not counted (accepted): 'Forgot your password? Ask the Admin to reset it.' (e-mail off, DL-378).

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-459 and GitHub issue #752, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
