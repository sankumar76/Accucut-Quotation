# DEF-092: the "+" menu on a Main Assembly or Sub-Assembly offers "Part" with no "Sub-part"; SCR-05's Part item carries the hint "Called Sub-part when there are two or more here" (Product; Sev-3 proposed; Jira AQP-449, GitHub #740)

| Field | Value |
|-------|-------|
| Story / AC | Found in the delivery lead's demo of master e3dc5b0b (26 Nov). Stories: AQP-403 (STORY-CR01.3A, node kinds), AQP-405 (STORY-CR01.3C, the '+' menu). SPEC 6.1; ADR-020 K1; ux-spec section 0.9 row 3. |
| Severity | **Sev-3, type Product, for tracking (master, DL-410 (B), DL-412 (2) (a)).** DL-409 had graded it a Product defect; DL-410 found the build matches FR-043 and ADR-020 and regraded it a change; **the delivery lead then decided it (DL-412), so it is tracked as a change decided by the delivery lead** and closes on the fix and its proof. (Proposed at filing by the orchestrator: Sev-3.) |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`) |
| Type | **Product** (a change decided by the delivery lead; **as designed** before the decision, DL-410 (B)). |
| Status | **Open, decided (DL-412), 2026-11-26.** Fix in lane 3 (merges first). Not yet built or proved. |
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

## Ruling (master; 2026-11-26; recorded by QA from DL-409 to DL-413, read on records-u 02f10cd4)
- **The delivery lead's decision (DL-412; selection checked by master in the main-session log, 06:50:33Z): option A.** The '+' menu's Part item reads **'Sub-part' when the parent already holds a Part, and 'Part' when it holds none.** It is the same item and adds the same stored kind (PART); no data changes; the automatic renaming of SPEC 6.1 and ADR-020 K1 is unchanged. Declined: B (keep 'Part' with a hint) and C (a stored Sub-part kind).
- **Build (lane 3, test-first):** `add-node-menu-panel.tsx` (and `tree-actions.ts` if the label is computed there): the item's visible label and spoken name read 'Sub-part' when the parent already holds one or more PART children, otherwise 'Part', and both send `PART`. The ux-expert words the label and hint for both states (the conformance ruling, item 4). **No combined review** (the stored kind and the write path are unchanged); the first-load figure stated, within 191,608 B; the DL-370 (5), DL-386 and DL-388 (D) bindings apply.
- **Wording routed:** the product-manager adds one sentence to FR-043 ('the add menu names the Part item for what it will be called: Sub-part when the parent already holds a Part'); the ux-expert updates ux-spec section 0.9 row 3 and SCR-05's '+' menu state in the CR-01 UX hand-over (G8-C-UX05).
- **Proof (DL-412 (2) (b)):** unit tests for the label with a parent holding 0, 1 and 2 PART children, on a Main Assembly and on a Sub-Assembly; E2E for both states at three widths, with an assertion that the new row's kind label matches what the menu said.
- Cut-offs (DL-370 (E)): start by the end of Mon 30 Nov, merge by the end of Wed 2 Dec; every fix is test-first, with E2E at three widths for what the delivery lead saw, every existing assertion kept; lanes: lane 1 DEF-089 and DEF-090, lane 2 DEF-091, lane 3 DEF-092; merge order lane 3, then lane 2, then lane 1 (DL-410 (1)). The delivery lead's instruction that the build works as designed (DL-409 (1)) applies.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Ruled (type, grade, route) | master | 2026-11-26 | DL-409 to DL-413 |
| Design reference | ux-expert, solution-architect | | |
| Fixed | developer | | |
| Regression test added | developer | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-449 and GitHub issue #740, created 2026-11-26 and cross-linked. Related: AQP-1; the neighbours DEF-089 to DEF-092 were filed together from the same demo (AQP-446, AQP-447, AQP-448, AQP-449); DL-377 (item 8); DEF-081 (AQP-424), DEF-075, DEF-076; test plan 0.3.64. Detail and evidence are read from `origin/master` e3dc5b0b (code read, not run); QA ran no browser for this record. Master's and the architect's causes and the ux-expert's design reference follow on the Jira Bug.
