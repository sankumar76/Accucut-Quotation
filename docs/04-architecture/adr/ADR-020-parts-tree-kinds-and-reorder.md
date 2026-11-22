# ADR-020: Parts tree kinds stored on the node, and reorder by dragging without a library

| Field | Value |
|-------|-------|
| Status | Proposed (2026-11-22), for `master` to log |
| Date | 2026-11-22 |
| Deciders | solution-architect (+ Santhosh, delivery lead) |
| Related | CR-01 item 3 (UX spec 0.34 section 0.9 row 3); FR-043, FR-044; NFR-009, NFR-017, NFR-018 (WCAG 2.2 SC 2.5.7); ADR-016; architecture sections 4.8, 4.12 e and 5.1 |

## Context

CR-01 item 3 gives the parts tree five kinds of row: Main Assembly, Sub-Assembly, Part, Sub-part and Fastener.
- **Allowed children:** a Main Assembly holds a Sub-Assembly, a Part or a Fastener. A Sub-Assembly holds a Part or a Fastener. A Part or Sub-part holds a Fastener.
- **Naming:** "Part" when it is the only part under its parent, "Sub-part" when there are two or more.
- **Reorder:** drag a row among its siblings (A-CR01-5), with Move up / Move down as the way without dragging (SC 2.5.7).

Today `estimate_nodes` holds only the place (`parent_id`, `sort_index`), and the Sl. No is derived. `/estimates/[code]` is the tightest route for first-load JavaScript (ADR-016), and no drag library is installed.

## Decision Drivers

- A Fastener cannot be told from the tree's shape, so the kind must be a fact somewhere.
- Existing trees must get a kind with no data loss (section 4.12 b).
- First-load JavaScript on `/estimates/[code]` (NFR-009, ADR-016): nothing that is not visible at first paint may be in the first load.
- No new dependency without a clear benefit (coding standards; licence and vulnerability review).
- Touch and keyboard use (NFR-017, NFR-018).

## Considered Options

### Kind: Option K1, a stored enum on the node, with Sub-part derived (chosen)
`estimate_node_kind` holds `MAIN_ASSEMBLY`, `SUB_ASSEMBLY`, `PART` and `FASTENER`. The kind never changes after the add. "Sub-part" is the derived name of a PART with PART siblings.
- Pros: one fact per node, and the add rules come from one table shared by the server and the browser. The derived name cannot go stale.
- Cons: a migration with a backfill. Legacy trees that break the new rules remain (readable, and only new adds are checked).

### Kind: Option K2, all five kinds stored, Sub-part included
- Cons: every add and delete must rewrite the siblings' kind between Part and Sub-part, which is a write the UX rule does not need, and a stale kind is possible. Rejected.

### Kind: Option K3, kind derived from depth only
- Cons: it cannot express a Fastener next to a Part, or a Part directly under a Main Assembly. Rejected.

### Reorder: Option R1, an own pointer-events reorder, loaded lazily (chosen)
A small module, `tree-reorder.ts` (an estimated 150 lines, under 3 KB gzip). It is loaded on the first pointer-down on a row's move handle. Its scope:
- one axis, among the siblings of one parent;
- a red drop line and auto-scroll at the panel's edges;
- on release, the existing `POST /tree/move` with the new index.
The Move up / Move down menu (lazy, through `first-open`) is the full way without dragging.
- Pros: no dependency, nothing in the first load, and the narrow scope that A-CR01-5 allows.
- Cons: touch dragging (scroll versus drag) is our own code to get right.

### Reorder: Option R2, `@dnd-kit/core` and `@dnd-kit/sortable` (MIT), loaded lazily
- Pros: proven touch and keyboard sensors, and screen-reader announcements.
- Cons: a new dependency family (licence and audit review, Dependabot traffic) and about 15 to 20 KB gzip of lazy code for a one-axis sibling reorder. Its keyboard sorting duplicates the Move up / Move down menu that UX already requires.

### Reorder: Option R3, the HTML5 drag-and-drop API
- Cons: weak and uneven on touch screens, especially phones; no control of the drop line. Rejected.

## Decision

- **Kind:** Option K1.
- **Reorder:** Option R1, with the server refusing a move across parents (422 `MOVE_ACROSS_PARENTS`) while A-CR01-5 holds.
- **Trigger to revisit R1 for R2:** if the customer answers A-CR01-5 with "allow other parents" (drops across levels with the allowed-children check), or if R1's touch E2E proves unreliable.

## Consequences

- Positive: the add menu offers exactly what the server accepts, and no new dependency is added. The first load grows only by the visible row parts (an estimated 2 KB or less, confirmed per pull request).
- Negative / trade-offs accepted:
  - Our own drag code on touch screens.
  - Legacy trees deeper than the kinds allow are kept as they are.
  - The `role="tree"` keyboard model is withdrawn for the UX's `nav` > `ul` list (the tree's arrow keys of STORY-05.02 AC-9 go).
- Follow-up actions (with owners):
  - developer (3A to 3D): as section 4.12 e and g list them.
  - product-owner: update STORY-05.02 AC-9.
  - None for the product-manager: OQ-ARCH-CR01-3 is closed. They ruled on 2026-11-22 that the Excel file gets no kind column, and that the structure actions follow `canEditInputs`.

## Verification

- Unit tests of `ALLOWED_CHILDREN` and `nodeKindLabel`.
- An integration test of the backfill on a copy of the demo database: every node gets a kind, and the counts and figures are unchanged.
- E2E at three widths: a mouse drag, a touch drag at the phone width, and Move up / Move down by keyboard.
- The route's first-load figure in each pull request (ADR-016).
