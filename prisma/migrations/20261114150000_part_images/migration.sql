-- STORY-05.07 (AQP-315): the part pictures, stored whole in PostgreSQL, and the foreign key that waited for them
-- (FR-047, FR-065, FR-067, NFR-005, NFR-026; ADR-013; architecture sections 5.1 `part_images` and 8).
--
-- Additive only (one new table, its index and constraints, one foreign key and one trigger on a column that already exists): the previous image keeps running during a
-- rollback, because it neither reads nor writes this table and leaves "estimate_nodes"."image_id" NULL.
-- Rollback note, for use only before a picture has been added; restore from backup after that, because dropping the table drops the pictures:
--   DROP TRIGGER "trg_estimate_nodes_image_in_same_estimate" ON "estimate_nodes"; DROP FUNCTION "estimate_nodes_image_in_same_estimate"();
--   ALTER TABLE "estimate_nodes" DROP CONSTRAINT "fk_estimate_nodes_image_id"; DROP TABLE "part_images";
--   (the shared function "forbid_immutable_change" stays, other tables use it)
--
-- The table is created EMPTY. No "updated_at", by design: a row is never changed after it is inserted (the immutable-table exception to the rule that every table has
-- created_at and updated_at, coding standards section 10 "SQL", architecture section 5.1).
--
-- "calculation_rows"."image_id" stays a plain UUID with NO foreign key, on purpose (STORY-03.05 assumption A-1): the record must never depend on a live row.
-- "estimate_nodes"."image_id" gets its foreign key here (STORY-05.02 left it without one until the pictures existed). Every row holds NULL, so the constraint is satisfied.

-- CreateTable
CREATE TABLE "part_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estimate_id" UUID NOT NULL,
    "sha256" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One row per distinct picture of an estimate: the same bytes added again are found, not stored twice (ADR-013). It also serves the lookup of a picture by its estimate.
CREATE UNIQUE INDEX "uq_part_images_estimate_id_sha256" ON "part_images"("estimate_id", "sha256");

-- AddForeignKey
ALTER TABLE "part_images" ADD CONSTRAINT "fk_part_images_estimate_id" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estimate_nodes" ADD CONSTRAINT "fk_estimate_nodes_image_id" FOREIGN KEY ("image_id") REFERENCES "part_images"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written from here (Prisma cannot express these).
--
-- 1. What the table keeps whoever writes to it. The hash is 64 lower-case hex digits; the type is one of the four the content check accepts (SVG is not one); the size is
--    positive, strictly under 200 x 1024 bytes (assumption A-06) and is the length of the bytes; the name is 1 to 100 characters of display text.
ALTER TABLE "part_images" ADD CONSTRAINT "ck_part_images_sha256_is_hex" CHECK ("sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "part_images" ADD CONSTRAINT "ck_part_images_mime_accepted" CHECK ("mime" IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp'));
ALTER TABLE "part_images" ADD CONSTRAINT "ck_part_images_size_in_range" CHECK ("size_bytes" > 0 AND "size_bytes" < 204800);
ALTER TABLE "part_images" ADD CONSTRAINT "ck_part_images_size_is_length" CHECK ("size_bytes" = octet_length("bytes"));
ALTER TABLE "part_images" ADD CONSTRAINT "ck_part_images_file_name_length" CHECK (char_length("file_name") BETWEEN 1 AND 100);

-- 2. A part's picture belongs to the part's own estimate. A row-level check cannot see another table, so this is a trigger, like the one that keeps a parent in the same
--    estimate. It reads the picture in the snapshot of the statement, which is enough: a picture's estimate never changes (the row is immutable).
CREATE FUNCTION "estimate_nodes_image_in_same_estimate"() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog
AS $$
BEGIN
    IF NEW."image_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public."part_images" image WHERE image."id" = NEW."image_id" AND image."estimate_id" = NEW."estimate_id"
    ) THEN
        RAISE EXCEPTION 'The picture of a part must belong to the same estimate.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_estimate_nodes_image_in_same_estimate"
    BEFORE INSERT OR UPDATE OF "image_id", "estimate_id" ON "estimate_nodes"
    FOR EACH ROW EXECUTE FUNCTION "estimate_nodes_image_in_same_estimate"();

-- 3. Grants (ADR-013). The runtime role reads and adds and nothing else: no UPDATE, no DELETE, no TRUNCATE, so it is refused before a trigger is reached.
--    The role script's default privileges give the four row rights; this removes two and states the list, so a later change to the defaults cannot widen it.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "part_images" FROM "accucut_app";
GRANT SELECT, INSERT ON TABLE "part_images" TO "accucut_app";

-- 4. Triggers, the backstop for every role, the owner included. They use the function of the config_versions migration. The owner could still drop a trigger with DDL;
--    that is a schema change, made only by a migration, and the runtime role cannot do it (architecture section 9.5, ARCH-R8).
CREATE TRIGGER "trg_part_images_forbid_change"
    BEFORE UPDATE OR DELETE ON "part_images"
    FOR EACH ROW EXECUTE FUNCTION "forbid_immutable_change"();

CREATE TRIGGER "trg_part_images_forbid_truncate"
    BEFORE TRUNCATE ON "part_images"
    FOR EACH STATEMENT EXECUTE FUNCTION "forbid_immutable_change"();
