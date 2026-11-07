-- STORY-02.01 (AQP-113): the Process Master, the named rates the calculation uses (FR-011, FR-012; architecture sections 5.1,
-- 5.5 and 5.6).
--
-- Additive only (a new table, its indexes and 15 rows): the previous image keeps running during a rollback.
-- Rollback note, for use only before the Admin has typed any value; restore from backup after that:
--   DROP TABLE "process_items";   -- also drops its indexes; no other table refers to it yet
--
-- The 15 rows below are the seed items of SPEC section 4.1 (D-38), inserted on every environment with the fixed IDs of
-- prisma/seed/config/seed-ids.ts and a default value of 0 (architecture section 5.6, "What every install starts with"). They
-- carry names and units, which are structure, and **no rate value** (ADR-014): the Admin types the values in at first use, and
-- development, CI and staging update these rows by ID from prisma/seed/placeholders/. tests/integration/masters compares the
-- rows with seed-ids.ts, so the two cannot drift apart.

-- CreateTable
CREATE TABLE "process_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "default_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_process_items_name" ON "process_items"("name");

-- Hand-written from here (Prisma cannot express these).
--
-- 1. A name is unique without regard to letter case (AC-2): "Foam Cost" and "foam cost" are one rate to the Admin. The
--    formula engine matches a name exactly, so the stricter rule is for people, and this index is its backstop when two
--    requests race for the same name.
CREATE UNIQUE INDEX "uq_process_items_name_lower" ON "process_items" (lower("name"));

-- 2. A rate is never negative (AC-2: "a number of 0 or more"), and a name is never blank.
ALTER TABLE "process_items" ADD CONSTRAINT "ck_process_items_default_value_not_negative" CHECK ("default_value" >= 0);
ALTER TABLE "process_items" ADD CONSTRAINT "ck_process_items_name_not_blank" CHECK (char_length(btrim("name")) > 0);

-- 3. The 15 seed items, in SPEC order. The IDs are opaque and fixed: seed formulas store {{rate:<id>}} before this table exists.
INSERT INTO "process_items" ("id", "name", "unit", "default_value") VALUES
    ('00000000-0000-4000-8000-000400000001', 'Cutting-Rate-per-Sec', 'per second', 0),
    ('00000000-0000-4000-8000-000400000002', 'Bending-Rate-per-stroke', 'per stroke', 0),
    ('00000000-0000-4000-8000-000400000003', 'Drilling-Tapping-Rate', 'per hole', 0),
    ('00000000-0000-4000-8000-000400000004', 'Welding-rate-per-kg', 'per kg', 0),
    ('00000000-0000-4000-8000-000400000005', 'Dip-Galvanizing-Cost-per-kg', 'per kg', 0),
    ('00000000-0000-4000-8000-000400000006', 'Primer-rate-per-sqft', 'per sq ft', 0),
    ('00000000-0000-4000-8000-000400000007', 'Shot-Blasting-rate-per-kg', 'per kg', 0),
    ('00000000-0000-4000-8000-000400000008', 'Polishing-rate-per-sqin', 'per sq in', 0),
    ('00000000-0000-4000-8000-000400000009', 'Plating-rate-per-sqin', 'per sq in', 0),
    ('00000000-0000-4000-8000-000400000010', 'Powder-rate-per-sqft', 'per sq ft', 0),
    ('00000000-0000-4000-8000-000400000011', 'Foam Cost', 'per sq ft', 0),
    ('00000000-0000-4000-8000-000400000012', 'Soft-Anodize-rate-per-sqin', 'per sq in', 0),
    ('00000000-0000-4000-8000-000400000013', 'OH Profit %', '%', 0),
    ('00000000-0000-4000-8000-000400000014', 'Transport %', '%', 0),
    ('00000000-0000-4000-8000-000400000015', 'Inspection & Packing %', '%', 0);

-- 4. Grants for the runtime role: it reads, adds, changes and deletes rates (the Admin deletes an unused one, AC-4), and
--    cannot truncate the table. The default privileges of the role script already give it the four row rights; this says so.
REVOKE TRUNCATE ON TABLE "process_items" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "process_items" TO "accucut_app";
