-- CR-01 item 3A (AQP-403; architecture section 4.12 b and e; ADR-020 K1): every row of a parts tree has a kind, one of Main Assembly, Sub-Assembly, Part and Fastener.
-- "Sub-part" is NOT a stored kind: it is how a PART is named when its parent holds two or more PARTs, derived on read, so it can never go stale.
--
-- One transaction (Prisma runs the file in one): create the enum, add the column nullable, backfill every existing row from the shape of its tree, then set it NOT NULL. A failure
-- anywhere rolls the whole file back and the database is as before.
--
-- Backfill rule (deterministic, one recursive statement over every estimate's nodes):
--   * depth 1 (no parent)                              -> MAIN_ASSEMBLY
--   * depth 2 with at least one child                  -> SUB_ASSEMBLY
--   * every other row (a leaf at depth 2, anything at depth 3 or more) -> PART
-- No Fastener is ever produced: a Fastener cannot be told from a part by shape, so the Engineer adds those from now on. No row is added, removed or moved, and no revision,
-- sort_index, inputs or updated_at changes, so counts, figures, fingerprints and exports are as before (the calculation does not read the kind). A legacy tree deeper than the
-- kinds allow (a PART with PART children at depth 3 or more) stays as it is: readable, calculable and exported as today. Only NEW adds are checked against the allowed-children rule
-- (src/lib/estimate/node-kinds.ts), which spans rows and so lives in the service, not in a CHECK. The release note says so.
--
-- A row that the walk from the top cannot reach (a parent chain that never ends at a top row; the schema and the service make that impossible, the statement below only
-- refuses to fail on it) is given PART, so the NOT NULL never rolls a release back over data that was already unreachable and is not shown.
--
-- Safe as one release only because no production database exists before G8 (assumption A-CR01-A1): the previous image would insert rows without a kind. If CR-01 has not merged
-- when the first production install happens, split this file into expand (the nullable column and the backfill, the app writes the column) and contract (SET NOT NULL).
--
-- Rollback note (the architecture's section 5.6 asks one for each migration with a destructive effect). Run with the previous release:
--   ALTER TABLE "estimate_nodes" DROP COLUMN "node_kind";
--   DROP TYPE "estimate_node_kind";
-- Lost on rollback: the kinds, including every Fastener added since (the previous release has no such row kind; they remain as parts). Restore from the pre-update backup is the fallback.

-- CreateEnum
CREATE TYPE "estimate_node_kind" AS ENUM ('MAIN_ASSEMBLY', 'SUB_ASSEMBLY', 'PART', 'FASTENER');

-- AlterTable
ALTER TABLE "estimate_nodes" ADD COLUMN "node_kind" "estimate_node_kind";

-- Backfill: the kind of every existing row, from the shape of its tree.
WITH RECURSIVE "walk" ("id", "depth") AS (
    SELECT "id", 1 FROM "estimate_nodes" WHERE "parent_id" IS NULL
  UNION ALL
    SELECT "child"."id", "walk"."depth" + 1
    FROM "estimate_nodes" "child"
    JOIN "walk" ON "child"."parent_id" = "walk"."id"
)
UPDATE "estimate_nodes" "node"
SET "node_kind" = (
  CASE
    WHEN "walk"."depth" = 1 THEN 'MAIN_ASSEMBLY'
    WHEN "walk"."depth" = 2 AND EXISTS (SELECT 1 FROM "estimate_nodes" "kid" WHERE "kid"."parent_id" = "node"."id") THEN 'SUB_ASSEMBLY'
    ELSE 'PART'
  END
)::"estimate_node_kind"
FROM "walk"
WHERE "walk"."id" = "node"."id";

-- Unreachable rows (see above) are parts.
UPDATE "estimate_nodes" SET "node_kind" = 'PART' WHERE "node_kind" IS NULL;

-- AlterTable
ALTER TABLE "estimate_nodes" ALTER COLUMN "node_kind" SET NOT NULL;
