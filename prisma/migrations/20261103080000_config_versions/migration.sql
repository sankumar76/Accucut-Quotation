-- STORY-03.01 (AQP-97): the immutable versions of the field registry (ADR-004, NFR-026,
-- architecture sections 4.5, 5.1 and 5.6).
--
-- Additive only (a new table, a new function): the previous image keeps running during a rollback.
-- Rollback note, for use only before any version beyond the seed exists; restore from backup after that:
--   DROP TABLE "config_versions";            -- also drops its two triggers
--   DROP FUNCTION "forbid_immutable_change"; -- only if no later table uses it

-- CreateTable
CREATE TABLE "config_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_by" UUID,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_config_versions_number" ON "config_versions"("number");

-- Hand-written: a row of this table can never be changed or removed (architecture section 5.1).
--
-- 1. Grants. The runtime role keeps SELECT and INSERT (from the default privileges of the role script)
--    and loses UPDATE, DELETE and TRUNCATE, so it is refused before the trigger is reached.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "config_versions" FROM "accucut_app";

-- 2. Triggers, the backstop for every role, the owner included. The function is shared: the other
--    immutable tables (audit_log, calculations, calculation_rows) attach the same trigger in their own
--    migrations. The owner could still drop a trigger with DDL; that is a schema change, made only by a
--    migration, and the runtime role cannot do it.
CREATE FUNCTION "forbid_immutable_change"() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'Table "%" is immutable: % is not allowed.', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "trg_config_versions_forbid_change"
    BEFORE UPDATE OR DELETE ON "config_versions"
    FOR EACH ROW EXECUTE FUNCTION "forbid_immutable_change"();

CREATE TRIGGER "trg_config_versions_forbid_truncate"
    BEFORE TRUNCATE ON "config_versions"
    FOR EACH STATEMENT EXECUTE FUNCTION "forbid_immutable_change"();
