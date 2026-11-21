-- STORY-08.06 (AQP-361): named checkpoints of the configuration (SPEC section 8.3 "Checkpoints", FR-078; architecture sections 5.1 `config_checkpoints`
-- and 5.6 "the seed checkpoint").
--
-- Additive only (a new table and its triggers): the previous image keeps running during a rollback, and no existing table or row is touched. Version 1 and every estimate are left as they are.
-- Rollback note, for use only before the first checkpoint is saved by a person (the seed checkpoint is derived from version 1 and can be made again); restore from backup after that:
--   DROP TABLE "config_checkpoints";   -- also drops its indexes, constraints and two triggers
-- The shared function "forbid_immutable_change" stays: other tables use it.

-- CreateTable
CREATE TABLE "config_checkpoints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "config_version_id" UUID NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_config_checkpoints_config_version_id" ON "config_checkpoints"("config_version_id");

-- AddForeignKey: no cascade. A version is never removed, and a person is deactivated and never deleted (architecture section 5.1), so there is nothing to cascade from.
ALTER TABLE "config_checkpoints" ADD CONSTRAINT "fk_config_checkpoints_config_version_id" FOREIGN KEY ("config_version_id") REFERENCES "config_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "config_checkpoints" ADD CONSTRAINT "fk_config_checkpoints_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written: Prisma cannot declare these two.
-- 1. The name is unique ignoring letter case (the masters' rule, A-4), so two requests that race for one name cannot both win, and two names that differ only by case are one.
CREATE UNIQUE INDEX "uq_config_checkpoints_name_lower" ON "config_checkpoints"(lower("name"));
-- 2. The name is 1 to 100 characters, counted in code points as `char_length` counts them. The service trims it and refuses an empty one first; this is the backstop for any other writer.
ALTER TABLE "config_checkpoints" ADD CONSTRAINT "ck_config_checkpoints_name_length" CHECK (char_length("name") BETWEEN 1 AND 100);

-- Hand-written: a checkpoint can never be changed, renamed or removed (SPEC section 8.3 lists save, list and revert only), as a configuration version cannot (architecture section 5.1).
--
-- 1. Grants. The runtime role keeps SELECT and INSERT (from the default privileges of the role script) and loses UPDATE, DELETE and TRUNCATE, so it is refused before the trigger is reached.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "config_checkpoints" FROM "accucut_app";

-- 2. Triggers, the backstop for every role, the owner included, through the function `config_versions` made.
CREATE TRIGGER "trg_config_checkpoints_forbid_change"
    BEFORE UPDATE OR DELETE ON "config_checkpoints"
    FOR EACH ROW EXECUTE FUNCTION "forbid_immutable_change"();

CREATE TRIGGER "trg_config_checkpoints_forbid_truncate"
    BEFORE TRUNCATE ON "config_checkpoints"
    FOR EACH STATEMENT EXECUTE FUNCTION "forbid_immutable_change"();

-- The seed checkpoint (architecture section 5.6): an install that already holds version 1, which is every Release 1 install, gets a checkpoint on it, so there is always one known state to return to. It has no
-- person (`created_by` null), like version 1. A new install has no version yet: `ensure-seed-version` inserts version 1 and this checkpoint together. Running this twice leaves one (the unique name settles it).
INSERT INTO "config_checkpoints" ("name", "config_version_id", "created_by")
SELECT 'Original configuration', "id", NULL FROM "config_versions" WHERE "number" = 1
ON CONFLICT DO NOTHING;
