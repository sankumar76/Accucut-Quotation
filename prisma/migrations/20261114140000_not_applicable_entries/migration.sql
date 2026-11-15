-- STORY-02.06 (AQP-305): the hidden "Not applicable" entries and the guard on every system row (FR-017, FR-018; SPEC section 18 D-17; architecture
-- sections 4.9 and 5.1, "System rows").
--
-- Additive for the running application: it adds two rows, one function and two triggers, and replaces one CHECK by a looser one on the same
-- name, so the previous image keeps running during a rollback (it never lists a hidden row and never changes a system one). Hand-written, because
-- Prisma cannot express a trigger or a regular-expression CHECK.
--
-- Rollback note (a hand-made script, for use only if this migration must be undone; nothing in it touches an Admin's own entries):
--   DROP TRIGGER "trg_materials_refuse_system_row_change" ON "materials";
--   DROP TRIGGER "trg_treatments_refuse_system_row_change" ON "treatments";
--   DROP FUNCTION "refuse_system_row_change"();
--   ALTER TABLE "treatments" DROP CONSTRAINT "ck_treatments_name_not_blank";
--   ALTER TABLE "treatments" ADD CONSTRAINT "ck_treatments_name_not_blank" CHECK (char_length(btrim("name")) > 0);
--   -- The two rows stay: they are hidden and harmless. They can be removed (after the triggers are dropped) with
--   --   DELETE FROM "materials" WHERE "id" = '00000000-0000-4000-8000-000500000001';
--   --   DELETE FROM "treatments" WHERE "id" = '00000000-0000-4000-8000-000700000002';
--   -- but only while no estimate part holds either ID. A listed entry that step 1 renamed is not renamed back (its old name is not kept).
--
-- Order matters: the names are freed (1), the rows are inserted (2), and only then is the trigger created (4), so the migration itself is never
-- refused by it. The rows are inserted here and not by the seed (architecture section 4.9): the seed refuses to run in production and these rows
-- hold no real data. The IDs are fixed so that an estimate can hold them and the code can name them (`src/lib/masters/system-entries.ts`).

-- 1. Free the name. A material or a treatment that already has the name "Not applicable" (in any letter case or spacing) would stop the insert below
--    on the unique index of its table, and would imitate the hidden entry on a screen. Story 02.05 already refused the name for a treatment; a material
--    could be given it before this story. Such an entry is renamed, not deleted, so no estimate loses its choice (a part holds the ID). The rename writes
--    no audit entry (a migration is not a person's change); it is named in the story's Dev Record, and the ID in the new name says which entry it was.
UPDATE "materials"
   SET "material_in_drawing" = left("material_in_drawing", 80) || ' (renamed ' || left("id"::text, 8) || ')', "updated_at" = now()
 WHERE "id" <> '00000000-0000-4000-8000-000500000001'
   AND lower(btrim(regexp_replace("material_in_drawing", '\s+', ' ', 'g'))) = 'not applicable';

UPDATE "treatments"
   SET "name" = left("name", 80) || ' (renamed ' || left("id"::text, 8) || ')', "updated_at" = now()
 WHERE "id" <> '00000000-0000-4000-8000-000700000002'
   AND lower(btrim(regexp_replace("name", '\s+', ' ', 'g'))) = 'not applicable';

-- 2. The two hidden rows. Every value is 0 and the material has no Material Considered (SPEC D-17); the table's CHECKs exempt a hidden row from a
--    specific gravity above 0 and from a non-blank Material Considered. `ON CONFLICT` keeps the statements safe to repeat.
INSERT INTO "materials" ("id", "material_in_drawing", "material_considered", "price_per_kg", "specific_gravity", "scrap_rate", "is_system", "is_hidden")
VALUES ('00000000-0000-4000-8000-000500000001', 'Not applicable', NULL, 0, 0, 0, true, true)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "treatments" ("id", "name", "is_system", "is_hidden")
VALUES ('00000000-0000-4000-8000-000700000002', 'Not applicable', true, true)
ON CONFLICT ("id") DO NOTHING;

-- 3. QLT-08 of AQP-130: `btrim` trims spaces only, so a name of tabs or line breaks passed the old CHECK. `\S` asks for one character that is not white
--    space. Every stored name already passes: the service trims all white space (`canonicalTreatmentName`), and the statement checks the stored rows.
ALTER TABLE "treatments" DROP CONSTRAINT "ck_treatments_name_not_blank";
ALTER TABLE "treatments" ADD CONSTRAINT "ck_treatments_name_not_blank" CHECK ("name" ~ '\S');

-- 4. The guard on every system row (GitHub #202, ruling 2026-11-10): one function on both tables, for every role, the owner included. It refuses an
--    UPDATE or a DELETE of a row whose `is_system` or `is_hidden` is true (the two "Not applicable" rows and "Other"), and an UPDATE that would change
--    either flag, so an ordinary row cannot be made a system row. An INSERT is not guarded: only migrations insert system rows and no service sets
--    the flags. A later migration that must change a system row disables and re-enables the trigger inside itself. The message names no row.
CREATE FUNCTION "refuse_system_row_change"() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog
AS $$
BEGIN
    IF OLD."is_system" OR OLD."is_hidden" THEN
        RAISE EXCEPTION 'A system row of table "%" cannot be changed or deleted.', TG_TABLE_NAME
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    IF NEW."is_system" <> OLD."is_system" OR NEW."is_hidden" <> OLD."is_hidden" THEN
        RAISE EXCEPTION 'A row of table "%" cannot be made a system row.', TG_TABLE_NAME
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_materials_refuse_system_row_change"
    BEFORE UPDATE OR DELETE ON "materials"
    FOR EACH ROW EXECUTE FUNCTION "refuse_system_row_change"();

CREATE TRIGGER "trg_treatments_refuse_system_row_change"
    BEFORE UPDATE OR DELETE ON "treatments"
    FOR EACH ROW EXECUTE FUNCTION "refuse_system_row_change"();
