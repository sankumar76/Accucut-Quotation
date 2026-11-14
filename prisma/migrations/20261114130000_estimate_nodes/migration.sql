-- STORY-05.02 (AQP-302): the parts tree of an estimate, one row per part (FR-043, FR-044; architecture sections 4.8 and 5.1 `estimate_nodes`).
--
-- Additive only (one table, its indexes, constraints and one trigger): the previous image keeps running during a rollback.
-- Rollback note, for use only before an Engineer has added a part; restore from backup after that:
--   DROP TABLE "estimate_nodes"; DROP FUNCTION "estimate_nodes_parent_in_same_estimate"();
--
-- The table is created EMPTY. The Sl. No is derived from the tree and is never a column. `inputs` holds only what a person typed; no rate, cost or formula
-- is ever written to it (architecture section 5.1, ADR-008). `image_id` has no foreign key until the pictures exist (STORY-05.07).

-- CreateTable
CREATE TABLE "estimate_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estimate_id" UUID NOT NULL,
    "parent_id" UUID,
    "sort_index" INTEGER NOT NULL,
    "inputs" JSONB NOT NULL DEFAULT '{}',
    "image_id" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_estimate_nodes_estimate_id" ON "estimate_nodes"("estimate_id");

-- CreateIndex
-- Beyond the one index architecture section 5.1 names: the parent's foreign key is checked against this column on every delete of a part.
CREATE INDEX "idx_estimate_nodes_parent_id" ON "estimate_nodes"("parent_id");

-- AddForeignKey
-- No cascade on either: the service names every row a delete removes, so a part is never removed by accident of a cascade.
ALTER TABLE "estimate_nodes" ADD CONSTRAINT "fk_estimate_nodes_estimate_id" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estimate_nodes" ADD CONSTRAINT "fk_estimate_nodes_parent_id" FOREIGN KEY ("parent_id") REFERENCES "estimate_nodes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written from here (Prisma cannot express these).
--
-- 1. What the table keeps whoever writes to it: a place is not negative, a revision starts at 1, `inputs` is an object (never a list or a bare value), and a
--    part is never its own parent. A part and a parent in two estimates would hang one estimate's tree off another's, so the trigger below refuses that too.
ALTER TABLE "estimate_nodes" ADD CONSTRAINT "ck_estimate_nodes_sort_index_not_negative" CHECK ("sort_index" >= 0);
ALTER TABLE "estimate_nodes" ADD CONSTRAINT "ck_estimate_nodes_revision_positive" CHECK ("revision" >= 1);
ALTER TABLE "estimate_nodes" ADD CONSTRAINT "ck_estimate_nodes_inputs_is_object" CHECK (jsonb_typeof("inputs") = 'object');
ALTER TABLE "estimate_nodes" ADD CONSTRAINT "ck_estimate_nodes_not_own_parent" CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

-- 2. The parent belongs to the same estimate. A row-level check cannot see another row, so this is a trigger. It reads the parent in the snapshot of the
--    statement, which is enough: a parent's estimate never changes.
CREATE FUNCTION "estimate_nodes_parent_in_same_estimate"() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog
AS $$
BEGIN
    IF NEW."parent_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public."estimate_nodes" parent WHERE parent."id" = NEW."parent_id" AND parent."estimate_id" = NEW."estimate_id"
    ) THEN
        RAISE EXCEPTION 'The parent of a part must belong to the same estimate.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_estimate_nodes_parent_in_same_estimate"
    BEFORE INSERT OR UPDATE OF "parent_id", "estimate_id" ON "estimate_nodes"
    FOR EACH ROW EXECUTE FUNCTION "estimate_nodes_parent_in_same_estimate"();

-- 3. Grants for the runtime role: it reads, adds, changes and deletes parts (a delete removes a part and its sub-parts), and cannot truncate the table. The default
--    privileges of the role script give the four row rights; this states the list, so a later change to the defaults cannot widen it.
REVOKE TRUNCATE ON TABLE "estimate_nodes" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "estimate_nodes" TO "accucut_app";
