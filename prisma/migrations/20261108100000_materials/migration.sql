-- STORY-02.03 (AQP-122): the Material Master, the materials an estimate's Material in Drawing list is made of (FR-015; SPEC section
-- 4.3; architecture sections 4.9, 5.1 and 6).
--
-- Additive only (a new table and its indexes): the previous image keeps running during a rollback.
-- Rollback note, for use only before the Admin has typed any material; restore from backup after that:
--   DROP TABLE "materials";   -- also drops its indexes and checks; no other table refers to it yet
--
-- The table is created EMPTY and holds no price (ADR-014): the Admin types the materials in. The hidden "Not applicable" row, the guard
-- trigger that refuses a change to it, and the reserved-name rule are story 02.06's; this story creates the `is_hidden` column they
-- need, and `master-repository` already lists only rows where it is false (architecture section 4.9). Delete is story 02.07's and is
-- soft (A-13): `deleted_at` is created here, and the runtime role is given no DELETE right.

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "material_in_drawing" TEXT NOT NULL,
    -- Null only for the hidden "Not applicable" row (section 4.9), which is story 02.06's; the CHECK below keeps it non-blank otherwise.
    "material_considered" TEXT,
    "price_per_kg" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "specific_gravity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    -- Material-Scrap-Rate, per kg (SPEC D-39); the column keeps the architecture's name (section 5.1).
    "scrap_rate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_materials_material_in_drawing" ON "materials"("material_in_drawing");

-- Hand-written from here (Prisma cannot express these).
--
-- 1. A name is unique without regard to letter case (AC-2): "MS sheet" and "ms sheet" are one material to the Admin. The index is the
--    backstop when two requests race for the same name.
CREATE UNIQUE INDEX "uq_materials_material_in_drawing_lower" ON "materials" (lower("material_in_drawing"));

-- 2. A price and a scrap rate are 0 or more (AC-2), a name is not blank, and a specific gravity is above 0 (UX-37, FR-015): the
--    server refuses 0 or below with 422, and this is the same rule one level down. The hidden row is exempt: its values are 0.
ALTER TABLE "materials" ADD CONSTRAINT "ck_materials_price_per_kg_not_negative" CHECK ("price_per_kg" >= 0);
ALTER TABLE "materials" ADD CONSTRAINT "ck_materials_scrap_rate_not_negative" CHECK ("scrap_rate" >= 0);
ALTER TABLE "materials" ADD CONSTRAINT "ck_materials_specific_gravity_above_zero" CHECK ("is_hidden" OR "specific_gravity" > 0);
ALTER TABLE "materials" ADD CONSTRAINT "ck_materials_material_in_drawing_not_blank" CHECK (char_length(btrim("material_in_drawing")) > 0);
ALTER TABLE "materials" ADD CONSTRAINT "ck_materials_material_considered_not_blank"
    CHECK ("is_hidden" OR ("material_considered" IS NOT NULL AND char_length(btrim("material_considered")) > 0));

-- 3. Grants for the runtime role: it reads, adds and changes materials. It has no DELETE (a material is removed by setting
--    `deleted_at`, story 02.07) and cannot truncate the table. The default privileges of the role script give it the four row
--    rights; this takes two back.
REVOKE DELETE, TRUNCATE ON TABLE "materials" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "materials" TO "accucut_app";
