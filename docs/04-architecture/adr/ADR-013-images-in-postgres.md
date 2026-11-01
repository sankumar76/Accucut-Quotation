# ADR-013: Part images in PostgreSQL

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-047, 067; NFR-005, 013; SPEC §2; ADR-007 |

## Context
SPEC §2 allows `bytea` or a local volume for images under 200 KB. Images must stay available to approved estimates forever (FR-065) and export needs them all at once.

## Decision Drivers
- NFR-013: one backup, one restore
- FR-065: an approved estimate's image cannot go missing
- Small files: fewer than 200 KB each

## Considered Options
### Option A — `bytea` in a separate `part_images` table
- Pros: one backup artefact, transactional, no path handling, access control in one place
- Cons: a larger database and dumps; images pass through the app
- Cost / effort: lowest

### Option B — Local Docker volume
- Pros: smaller database
- Cons: two things to back up in step, orphan files, a volume to mount in `app`
- Cost / effort: low, higher operational risk

### Option C — Object storage
- Pros: scales well
- Cons: a new service for a small need; Q-18 is open
- Cost / effort: medium

## Decision
We will store images in a separate `part_images` table with `bytes` as `bytea`, `sha256`, `mime`, `size_bytes`, and a sanitised `file_name` for display on SCR-05 (added at UX reconciliation). Queries that do not need bytes never touch that table, so a tree read stays small. Rows are immutable. A replaced image creates a new row, so an older calculation record still shows the old one.

Validation is by content: a small signature check for PNG, JPEG, GIF and WebP in `src/lib/images`, with no dependency needed, and under 200 × 1024 bytes (A-06). SVG is not accepted. Images are served with the stored MIME, `nosniff`, and the same ownership check as the estimate, and are never decoded on the server.

## Consequences
- Positive: backup and restore stay single-step. No orphaned file can break an approved estimate.
- Negative / trade-offs accepted: nightly dumps grow with images. Unreferenced rows are not pruned (TD-03).
- Follow-up actions (with owners): the IT contact sizes off-host backup storage once volumes are known.

## Verification
FR-047 fit tests at 199 × 1024 and 201 × 1024 bytes; renamed text file refused; restore rehearsal includes images.
