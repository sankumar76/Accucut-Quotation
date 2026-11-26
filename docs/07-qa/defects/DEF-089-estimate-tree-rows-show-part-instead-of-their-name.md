# DEF-089: every parts-tree row shows "Part" instead of its real name (`viewsOf` sets `label: ''`, the row falls back to "Part"); the kind is not readable as designed (Product; Sev-2 proposed; Jira AQP-446, GitHub #737)

| Field | Value |
|-------|-------|
| Story / AC | Found in the delivery lead's demo of master e3dc5b0b (26 Nov). Stories: AQP-404 (STORY-CR01.3B, tree rows), AQP-302 (STORY-05.02, built the tree view), AQP-424 (DEF-081). SCR-05 and ux-spec section 0.9 row 3: each row reads an arrow, the kind's icon, then the number and the name. |
| Severity | **Sev-2 as proposed by the orchestrator** on the delivery lead's finding; **master rules.** A core screen shows wrong information (the design shows each row's name). |
| Priority | P2 (Jira High) (labels `sev-2`, `final-review`) |
| Type | Product |
| Status | **Open (new), 2026-11-26 (qa-engineer, on the orchestrator's relay of the delivery lead's finding).** Not yet ruled by master. |
| Jira / GitHub | [AQP-446](https://sankumar76.atlassian.net/browse/AQP-446) / [#737](https://github.com/sankumar76/Accucut-Quotation/issues/737) (labels bug, sev-2, ai-delivery, final-review; Jira also aiid-DEF-089, agent-qa-engineer). Relates to AQP-1 and the stories above. Searched first: JQL on `aiid-DEF-089` and the title words, and a GitHub search: nothing. |
| Found by / date | The delivery lead, in the demo at master e3dc5b0b (26 Nov 2026), relayed by the orchestrator; read and logged by qa-engineer, 2026-11-26 |
| Build / commit | `master` `e3dc5b0b` (code read with `git show origin/master:<path>`; no browser run by QA) |
| Environment | The delivery lead's demo copy of master (not the CI) |

## Steps to Reproduce
Open an estimate with several rows on the estimate screen (SCR-05) and read the tree as in "What" below.

## Expected Result
Each row's name is its `partNameOf` (Description, else Part No.), as on the review screen; the fallback only when nothing was typed.

## Actual Result
Every row shows 'Part'.

## What
Every row of the parts tree on the estimate screen reads "Part" where its real name should be; the kind of a row is not recognisable as the design shows it.

## Evidence (code read, not run; no secrets or personal data)
- `src/server/services/estimate-service.ts:244`, `viewsOf`: `buildTree(records).map(({ node, slNo }) => ({ id, parentId, slNo, label: '', nodeKind, completeness, revision ... }))`: **every row's `label` is the empty string**; so since STORY-05.02 (7d369e68, #384).
- `src/components/features/estimate-workspace/tree-node.tsx:58`: `{part.label === '' ? TREE_PART_NAME : part.label}` with `TREE_PART_NAME = 'Part'` (`estimate-texts.ts:80`); the same fallback in `row-actions.tsx:56` (the row's button names).
- The words of a part's name exist already: `src/lib/estimate/part-name.ts` `partNameOf(document, inputs)` = the typed **Description**, else **Part No.**, else empty. The estimate review (`estimate-review-service.ts:125`), the cost details (`cost-details-service.ts:95`) and the export use it; **the tree's view does not.**
- The kind: each row has an icon (`NodeKindIcon`) with the kind name as its label; with every name reading 'Part' the rows cannot be told apart. Whether the kind is also unclear beyond that is for the ux-expert (DEF-081 / #707 changed the icons and tints).

## Suspected Area (leads, not findings; the architect and developer decide)
`viewsOf` needs the configuration document to call `partNameOf` for each node (`EstimateDependencies.configurationById` and `currentConfiguration` are in the service already), and the tree's name must follow the form's Description as it is saved. Not for QA to change.

## Proof (proposed; master rules)
A row's text equals `partNameOf` on the estimate screen at three widths, for a part with a Description, one with only a Part No. and one with neither; the review, cost details and export names unchanged.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Ruled (type, grade, route) | master | | |
| Design reference | ux-expert, solution-architect | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-446 and GitHub issue #737, created 2026-11-26 and cross-linked. Related: AQP-1; the neighbours DEF-089 to DEF-092 were filed together from the same demo (AQP-446, AQP-447, AQP-448, AQP-449); DL-377 (item 8); DEF-081 (AQP-424), DEF-075, DEF-076; test plan 0.3.64. Detail and evidence are read from `origin/master` e3dc5b0b (code read, not run); QA ran no browser for this record. Master's and the architect's causes and the ux-expert's design reference follow on the Jira Bug.
