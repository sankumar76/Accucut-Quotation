-- STORY-01.07 (AQP-74): the permanent audit record (FR-011, NFR-007; architecture sections 5.1 and 8).
--
-- Additive only (a new table, two indexes, a foreign key, two triggers; the shared function from the config_versions
-- migration is reused): the previous image keeps running during a rollback.
-- Rollback note, for use only before any entry exists; restore from backup after that:
--   DROP TABLE "audit_log";   -- also drops its two triggers and its indexes
--
-- No "updated_at" column, by design: an entry is never changed after it is inserted (append-only tables are the
-- exception to the rule that every table has created_at and updated_at, coding standards section 10, "SQL").

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" UUID NOT NULL,
    "object_label" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "request_id" TEXT NOT NULL,
    -- Stamped by the database, at the millisecond: application code cannot back-date an entry, and the cursor of the
    -- audit screen (time, id) is the same value in JavaScript and in PostgreSQL.
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT date_trunc('milliseconds'::text, clock_timestamp()),

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: newest first, the order of the screen (the id breaks a tie between entries of the same millisecond).
CREATE INDEX "idx_audit_log_created_at" ON "audit_log"("created_at" DESC, "id" DESC);

-- CreateIndex: one person's entries, newest first (the "Who" filter).
CREATE INDEX "idx_audit_log_actor_id" ON "audit_log"("actor_id", "created_at" DESC, "id" DESC);

-- AddForeignKey: a user is deactivated and never deleted, so there is no cascade.
ALTER TABLE "audit_log" ADD CONSTRAINT "fk_audit_log_actor_id" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written: an entry can never be changed or removed (architecture section 5.1).
--
-- 1. Grants. The runtime role keeps SELECT and INSERT (from the default privileges of the role script) and loses
--    UPDATE, DELETE and TRUNCATE, so it is refused before the trigger is reached.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "audit_log" FROM "accucut_app";

-- 2. Triggers, the backstop for every role, the owner included. They use the function of the config_versions
--    migration. The owner could still drop a trigger with DDL; that is a schema change, made only by a migration,
--    and the runtime role cannot do it (architecture section 9.5, ARCH-R8, states what the log is and is not).
CREATE TRIGGER "trg_audit_log_forbid_change"
    BEFORE UPDATE OR DELETE ON "audit_log"
    FOR EACH ROW EXECUTE FUNCTION "forbid_immutable_change"();

CREATE TRIGGER "trg_audit_log_forbid_truncate"
    BEFORE TRUNCATE ON "audit_log"
    FOR EACH STATEMENT EXECUTE FUNCTION "forbid_immutable_change"();
