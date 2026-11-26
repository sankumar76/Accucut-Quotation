# DEF-090: no way to name a new parts-tree row or to rename a row from the tree (the name is only the form's Description or Part No., which the tree does not show) (Product; Sev-2 proposed; Jira AQP-447, GitHub #738)

| Field | Value |
|-------|-------|
| Story / AC | Found in the delivery lead's demo of master e3dc5b0b (26 Nov). Stories: AQP-404, AQP-405 (STORY-CR01.3C, row actions). SCR-05's rows show names such as 'Control cabinet assembly' and 'Base frame' without showing how they are entered. |
| Severity | **Sev-2 as proposed by the orchestrator** (a needed function is missing, no workaround for naming from the tree); **master rules.** QA flags that this may be a requirement gap, not a build defect. |
| Priority | P2 (Jira High) (labels `sev-2`, `final-review`) |
| Type | Product (a requirement gap is possible; master rules) |
| Status | **Open (new), 2026-11-26 (qa-engineer, on the orchestrator's relay of the delivery lead's finding).** Not yet ruled by master. |
| Jira / GitHub | [AQP-447](https://sankumar76.atlassian.net/browse/AQP-447) / [#738](https://github.com/sankumar76/Accucut-Quotation/issues/738) (labels bug, sev-2, ai-delivery, final-review; Jira also aiid-DEF-090, agent-qa-engineer). Relates to AQP-1 and the stories above. Searched first: JQL on `aiid-DEF-090` and the title words, and a GitHub search: nothing. |
| Found by / date | The delivery lead, in the demo at master e3dc5b0b (26 Nov 2026), relayed by the orchestrator; read and logged by qa-engineer, 2026-11-26 |
| Build / commit | `master` `e3dc5b0b` (code read with `git show origin/master:<path>`; no browser run by QA) |
| Environment | The delivery lead's demo copy of master (not the CI) |

## Steps to Reproduce
Open an estimate with several rows on the estimate screen (SCR-05) and read the tree as in "What" below.

## Expected Result
(Delivery lead) A person can give a new row a name and rename an existing row.

## Actual Result
Neither from the tree; only via the form's Description, and the tree does not show it.

## What
There is no way to name a new row and no way to rename a row.

## Evidence (code read, not run; no secrets or personal data)
- `prisma/schema.prisma`, model EstimateNode: id, parentId, sortIndex, nodeKind, inputs, imageId, revision: **no name column.** A part's name is read from its inputs: the typed Description, else Part No. (`src/lib/estimate/part-name.ts`).
- `POST /api/v1/estimates/{id}/nodes` takes `AddPartRequest { parentId, nodeKind }` only (`estimate-service.ts:105`): **an add carries no name.**
- The only way to give a row a name today is to open the row and type its Description (or Part No.) in the form. **Because of DEF-089 the tree never shows that name**, so naming has no visible effect on the tree.
- QA found no inline rename or 'name this row' control in `docs/03-ux/screens/SCR-05.html` or in the ux-spec section 0.9 row 3.

## Suspected Area (leads, not findings; the architect and developer decide)
With DEF-089 fixed, naming works through the form's Description. Whether a name on the '+' add or an inline rename is wanted is not specified in SCR-05 or the ux-spec as QA read them: if wanted, it is a change for the product-manager and ux-expert (type Requirement). The ux-expert's and architect's design reference is coming.

## Proof (proposed; master rules)
To be set with the ruling.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Ruled (type, grade, route) | master | | |
| Design reference | ux-expert, solution-architect | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-447 and GitHub issue #738, created 2026-11-26 and cross-linked. Related: AQP-1; the neighbours DEF-089 to DEF-092 were filed together from the same demo (AQP-446, AQP-447, AQP-448, AQP-449); DL-377 (item 8); DEF-081 (AQP-424), DEF-075, DEF-076; test plan 0.3.64. Detail and evidence are read from `origin/master` e3dc5b0b (code read, not run); QA ran no browser for this record. Master's and the architect's causes and the ux-expert's design reference follow on the Jira Bug.
