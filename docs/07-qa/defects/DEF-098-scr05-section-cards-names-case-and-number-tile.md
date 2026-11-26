# DEF-098: SCR-05 section cards use title case, short names and a plain number; the design is sentence case, the AC and ux-spec names (not the SPEC 7.1 names, see Ruling check), a green number tile and the range tag on one line (conformance; Product; Sev-2; Jira AQP-455, GitHub #748)

| Field | Value |
|-------|-------|
| Story / AC | AQP-303, AQP-304, AQP-388; SCR-05 (all widths); the ux-expert's batch 1, item F. The mock-up and spec text quoted below. |
| Severity | **Sev-2, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-3 (the ux-expert's word: Major); the AC check and master's grade move it to Sev-2. |
| Priority | P2 (Jira High) (labels `sev-2`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-2; lane 1.** Open. |
| Jira / GitHub | [AQP-455](https://sankumar76.atlassian.net/browse/AQP-455) / [#748](https://github.com/sankumar76/Accucut-Quotation/issues/748) (labels bug, sev-2, ai-delivery, final-review, conformance; Jira also aiid-DEF-098, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
Sentence case; the AC and ux-spec names, which differ from SPEC 7.1 (see Ruling check) ('Part details', 'Welding, drilling and tapping', 'Surface treatment', 'Other costs and remarks'); a green number tile; the range tag and '4 of 4' on one line.

## Build (what the ux-expert saw)
Title case with short names ('01 Part Details', '03 Cutting Process', '06 Welding', '07 Surface Treatment', '08 Other Costs and Remarks'); a plain number; '4 of 4 complete' on its own line.

## Ruling check
No conflicting ruling found.

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** **AC check, 26 Nov: RAISED from Sev-3 to Sev-2 under DL-414 (1) (an AC names the element).** AQP-304 AC-1 names the cards "03 Cutting" and "06 Welding, drilling and tapping", and AQP-303 AC-1 names "01 Part details" and "02 Material and dimensions"; the build shows "03 Cutting Process" and "06 Welding" (the other names differ in letter case only). **Correction to the filing text:** SPEC section 7.1 (`ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md`, table at lines 259 to 299) names the sections "Part Details", "Material and Dimensions", "Cutting Process", "Bending", "Fasteners", "Welding", "Surface Treatment" and "Other Costs and Remarks", which is what the build shows (seeded in `prisma/seed/config/seed-sections-and-stages.ts:31-39`). The names "Part details" and "Welding, drilling and tapping" are in the two story ACs and in ux-spec line 637 (which says "Section order is SPEC section 7.1" but uses different names), not in the SPEC. So the real conflict is **AC and design against SPEC section 7.1**, and the story Trace of AQP-303 and AQP-304 cites both. **For master and the product-owner:** (a) the Sev-2 follows the literal AC and the delivery lead's build-to-design instruction; if master reads SPEC 7.1 as governing, the grade is Sev-3 or lower and the ACs are amended instead; (b) section names are configuration data (STORY-08.08 registry), so a fix is a seed change plus a configuration change for an existing database, not only a text edit. Letter case, the green number tile and the one-line range tag remain the Sev-3 part.

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-2, lane 1 |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-455 and GitHub issue #748, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
