# DEF-092: the "+" menu on a Main Assembly or Sub-Assembly offers "Part" with no "Sub-part"; SCR-05's Part item carries the hint "Called Sub-part when there are two or more here" (Product; Sev-3 proposed; Jira AQP-449, GitHub #740)

| Field | Value |
|-------|-------|
| Story / AC | Found in the delivery lead's demo of master e3dc5b0b (26 Nov). Stories: AQP-403 (STORY-CR01.3A, node kinds), AQP-405 (STORY-CR01.3C, the '+' menu). SPEC 6.1; ADR-020 K1; ux-spec section 0.9 row 3. |
| Severity | **Sev-3 as proposed by the orchestrator**; **master rules.** QA flags that the kinds offered match the rule of record; the gap is the hint and, through DEF-089, the missing 'Sub-part' word. |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`) |
| Type | Product |
| Status | **Open (new), 2026-11-26 (qa-engineer, on the orchestrator's relay of the delivery lead's finding).** Not yet ruled by master. |
| Jira / GitHub | [AQP-449](https://sankumar76.atlassian.net/browse/AQP-449) / [#740](https://github.com/sankumar76/Accucut-Quotation/issues/740) (labels bug, sev-3, ai-delivery, final-review; Jira also aiid-DEF-092, agent-qa-engineer). Relates to AQP-1 and the stories above. Searched first: JQL on `aiid-DEF-092` and the title words, and a GitHub search: nothing. |
| Found by / date | The delivery lead, in the demo at master e3dc5b0b (26 Nov 2026), relayed by the orchestrator; read and logged by qa-engineer, 2026-11-26 |
| Build / commit | `master` `e3dc5b0b` (code read with `git show origin/master:<path>`; no browser run by QA) |
| Environment | The delivery lead's demo copy of master (not the CI) |

## Steps to Reproduce
Open an estimate with several rows on the estimate screen (SCR-05) and read the tree as in "What" below.

## Expected Result
The Part item shows the SCR-05 hint; with two PARTs under a parent both rows' kind name reads 'Sub-part', and 'Part' again after one is deleted.

## Actual Result
The menu item reads 'Part' with no hint; 'Sub-part' appears nowhere in text.

## What
The '+' on a Main Assembly or a Sub-Assembly offers only 'Part', not 'Sub-part'.

## Evidence (code read, not run; no secrets or personal data)
- `src/lib/estimate/node-kinds.ts`: **four kinds are stored** (MAIN_ASSEMBLY, SUB_ASSEMBLY, PART, FASTENER); **'Sub-part' is not stored: it is how a PART is named when its parent holds two or more PARTs** (`nodeKindLabel`, derived on read). `ALLOWED_CHILDREN`: Main Assembly: Sub-Assembly, Part, Fastener; Sub-Assembly: Part, Fastener; Part: Fastener; Fastener: none. The menu offers those (`add-node-menu-panel.tsx`, items from `NODE_KIND_NAMES`, 'Part').
- **SCR-05 (`docs/03-ux/screens/SCR-05.html`) and ux-spec section 0.9 row 3:** 'A part is named "Part" when it is the only part under its parent and "Sub-part" when there are two or more, so the name changes by itself as parts are added or deleted.' In the mock-up's add menu the **Part item carries a hint: 'Called "Sub-part" when there are two or more here'**; the built menu item has **no hint**.
- The row's kind name ('Part' or 'Sub-part') reaches the screen only as the icon's tooltip and spoken name (`tree-node.tsx` `kindLabel`); the row's visible text is its name, 'Part' for every row (DEF-089), so **'Sub-part' is not visible anywhere**.

## Suspected Area (leads, not findings; the architect and developer decide)
A separate 'Sub-part' menu item would be a new kind the rule of record does not have: if the delivery lead wants it, it is a requirement change for the product-manager. The design reference is coming from the ux-expert.

## Proof (proposed; master rules)
The Part item shows the hint as in SCR-05; two PARTs under a parent read 'Sub-part' (tooltip and spoken name) and 'Part' again after one is deleted; the kinds offered stay equal to `ALLOWED_CHILDREN`.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Ruled (type, grade, route) | master | | |
| Design reference | ux-expert, solution-architect | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-449 and GitHub issue #740, created 2026-11-26 and cross-linked. Related: AQP-1; the neighbours DEF-089 to DEF-092 were filed together from the same demo (AQP-446, AQP-447, AQP-448, AQP-449); DL-377 (item 8); DEF-081 (AQP-424), DEF-075, DEF-076; test plan 0.3.64. Detail and evidence are read from `origin/master` e3dc5b0b (code read, not run); QA ran no browser for this record. Master's and the architect's causes and the ux-expert's design reference follow on the Jira Bug.
