-- STORY-03.05 (AQP-293): the immutable record of every Calculate and Recalculate, and the foreign key that waited for it
-- (FR-031, FR-065, NFR-026, NFR-002, NFR-007; ADR-007; architecture sections 4.2, 4.8 and 5.1).
--
-- Additive only (two new tables, their indexes and constraints, one foreign key on a column that already exists): the previous image keeps running
-- during a rollback, because it neither reads nor writes these tables.
-- Rollback note, for use only before a Calculate has stored a record; restore from backup after that, because dropping the tables drops the records:
--   ALTER TABLE "estimates" DROP CONSTRAINT "fk_estimates_current_calculation_id"; DROP TABLE "calculation_rows"; DROP TABLE "calculations";
--   (this order: the estimate points at a calculation, and a row belongs to one; the shared function "forbid_immutable_change" stays, other tables use it)
--
-- The tables are created EMPTY. No "updated_at" on either, by design: a row is never changed after it is inserted (the immutable-table exception to the
-- rule that every table has created_at and updated_at, coding standards section 10 "SQL", architecture section 5.1).
--
-- "calculation_rows"."node_id", "parent_id" and "image_id" are plain UUIDs with NO foreign key, on purpose (assumption A-1 of the story): a node deleted
-- or an image replaced later must not break a stored record, and "estimate_nodes" and "part_images" are created by later stories.
--
-- The foreign key from "estimates"."current_calculation_id" is added here (STORY-04.01 left the column without one until "calculations" existed). Nothing
-- writes that column yet, so every row holds NULL and the constraint is satisfied; were a value ever present, the migration would stop, loudly, and that
-- is wanted.

-- CreateTable
CREATE TABLE "calculations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estimate_id" UUID NOT NULL,
    "config_version_id" UUID NOT NULL,
    "inputs_revision" INTEGER NOT NULL,
    "master_snapshot" JSONB NOT NULL,
    "product_values" JSONB NOT NULL,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_rows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calculation_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "parent_id" UUID,
    "sort_index" INTEGER NOT NULL,
    "sl_no" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "image_id" UUID,
    "outputs" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_calculations_estimate_id" ON "calculations"("estimate_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_calculation_rows_calculation_id" ON "calculation_rows"("calculation_id", "sort_index");

-- CreateIndex
CREATE UNIQUE INDEX "uq_calculation_rows_calculation_id_node_id" ON "calculation_rows"("calculation_id", "node_id");

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "fk_estimates_current_calculation_id" FOREIGN KEY ("current_calculation_id") REFERENCES "calculations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calculations" ADD CONSTRAINT "fk_calculations_estimate_id" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calculations" ADD CONSTRAINT "fk_calculations_config_version_id" FOREIGN KEY ("config_version_id") REFERENCES "config_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calculations" ADD CONSTRAINT "fk_calculations_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calculation_rows" ADD CONSTRAINT "fk_calculation_rows_calculation_id" FOREIGN KEY ("calculation_id") REFERENCES "calculations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written from here (Prisma cannot express these).
--
-- 1. What the tables keep whoever writes to them. A revision is a count, so it is not negative. The JSON columns hold the shape the code reads: an object for
--    the snapshot, the product figures, a row's inputs and its outputs, and an array for the warnings. A sort index is not negative and a Sl. No is not blank.
ALTER TABLE "calculations" ADD CONSTRAINT "ck_calculations_inputs_revision_not_negative" CHECK ("inputs_revision" >= 0);
ALTER TABLE "calculations" ADD CONSTRAINT "ck_calculations_master_snapshot_is_object" CHECK (jsonb_typeof("master_snapshot") = 'object');
ALTER TABLE "calculations" ADD CONSTRAINT "ck_calculations_product_values_is_object" CHECK (jsonb_typeof("product_values") = 'object');
ALTER TABLE "calculations" ADD CONSTRAINT "ck_calculations_warnings_is_array" CHECK (jsonb_typeof("warnings") = 'array');
ALTER TABLE "calculation_rows" ADD CONSTRAINT "ck_calculation_rows_sort_index_not_negative" CHECK ("sort_index" >= 0);
ALTER TABLE "calculation_rows" ADD CONSTRAINT "ck_calculation_rows_sl_no_not_blank" CHECK ("sl_no" ~ '\S');
ALTER TABLE "calculation_rows" ADD CONSTRAINT "ck_calculation_rows_inputs_is_object" CHECK (jsonb_typeof("inputs") = 'object');
ALTER TABLE "calculation_rows" ADD CONSTRAINT "ck_calculation_rows_outputs_is_object" CHECK (jsonb_typeof("outputs") = 'object');

-- 2. Grants (ADR-007). The runtime role reads and adds and nothing else: no UPDATE, no DELETE, no TRUNCATE, so it is refused before a trigger is reached.
--    The role script's default privileges give the four row rights; this removes two and states the list, so a later change to the defaults cannot widen it.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "calculations" FROM "accucut_app";
GRANT SELECT, INSERT ON TABLE "calculations" TO "accucut_app";
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "calculation_rows" FROM "accucut_app";
GRANT SELECT, INSERT ON TABLE "calculation_rows" TO "accucut_app";

-- 3. Triggers, the backstop for every role, the owner included. They use the function of the config_versions migration. The owner could still drop a trigger
--    with DDL; that is a schema change, made only by a migration, and the runtime role cannot do it (architecture section 9.5, ARCH-R8).
CREATE TRIGGER "trg_calculations_forbid_change"
    BEFORE UPDATE OR DELETE ON "calculations"
    FOR EACH ROW EXECUTE FUNCTION "forbid_immutable_change"();

CREATE TRIGGER "trg_calculations_forbid_truncate"
    BEFORE TRUNCATE ON "calculations"
    FOR EACH STATEMENT EXECUTE FUNCTION "forbid_immutable_change"();

CREATE TRIGGER "trg_calculation_rows_forbid_change"
    BEFORE UPDATE OR DELETE ON "calculation_rows"
    FOR EACH ROW EXECUTE FUNCTION "forbid_immutable_change"();

CREATE TRIGGER "trg_calculation_rows_forbid_truncate"
    BEFORE TRUNCATE ON "calculation_rows"
    FOR EACH STATEMENT EXECUTE FUNCTION "forbid_immutable_change"();
