-- STORY-02.05 (AQP-130): the Treatment / Color list, the surface treatments and colours an Engineer chooses from (FR-017; SPEC section
-- 4.5; architecture sections 4.9, 5.1, 5.6 and 6).
--
-- Additive only (a new table, its indexes and one row): the previous image keeps running during a rollback.
-- Rollback note, for use only before the Admin has typed any treatment; restore from backup after that:
--   DROP TABLE "treatments";   -- also drops its indexes and checks; no other table refers to it yet
--
-- The one row below is "Other" (architecture section 5.6, assumption A-1 of the story, confirmed): inserted on every environment with a
-- fixed ID, `is_system` true and `is_hidden` false, so it stays on the Admin's list, locked. It carries a name and no value (ADR-014). The
-- service and the API refuse to change or delete it (AC-3); the hidden-row guard trigger of story 02.06 does not cover it, because it is not
-- hidden. `is_hidden` is created here for the "Not applicable" row that story 02.06 adds: the repository lists only rows where it is false
-- (architecture section 4.9). A treatment is removed with DELETE (there is no `deleted_at`: the architecture gives `treatments` none).

-- CreateTable
CREATE TABLE "treatments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_treatments_name" ON "treatments"("name");

-- Hand-written from here (Prisma cannot express these).
--
-- 1. A name is unique without regard to letter case (AC-2): "Powder coat" and "powder coat" are one treatment to the Admin. The index is the
--    backstop when two requests race for the same name.
CREATE UNIQUE INDEX "uq_treatments_name_lower" ON "treatments" (lower("name"));

-- 2. A name is not blank.
ALTER TABLE "treatments" ADD CONSTRAINT "ck_treatments_name_not_blank" CHECK (char_length(btrim("name")) > 0);

-- 3. "Other" (FR-017): the entry that keeps the choice open. The ID is opaque and fixed, so the estimate form (story 05.06) can name it.
INSERT INTO "treatments" ("id", "name", "is_system", "is_hidden") VALUES ('00000000-0000-4000-8000-000700000001', 'Other', true, false);

-- 4. Grants for the runtime role: it reads, adds, renames and deletes treatments. It cannot truncate the table. The default privileges of the
--    role script give it the four row rights and not TRUNCATE; this states them, so the list is plain and a later change to the defaults cannot widen it.
REVOKE TRUNCATE ON TABLE "treatments" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "treatments" TO "accucut_app";
