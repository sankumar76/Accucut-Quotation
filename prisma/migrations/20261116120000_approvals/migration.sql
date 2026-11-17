-- STORY-06.06 (AQP-323): the approvals table, where the Approved Quote Price (BO) lives (FR-062, FR-064, NFR-007, NFR-026; ADR-007, ADR-008; architecture sections 4.8, 4.10 and 5.1).
--
-- Additive only (one new table, its indexes, constraints, triggers and grants): the previous image keeps running during a rollback, because it neither reads nor writes this table.
-- Rollback note, for use only before an approval has been stored; restore from backup after that, because dropping the table drops the prices:
--   DROP TABLE "approvals"; DROP FUNCTION "forbid_approval_core_change";
--
-- "calculated_bl" is the calculated total (BL) **rounded to rupees and paise by the same rule the dialog pre-fills its price with** (half away from zero, `toTwoPlaces`), so the two always agree and
-- STORY-06.07 compares the price with it directly; the full-precision BL stays in the immutable calculation the row points at (SQR-03 of the review of AQP-323).
--
-- One row per approval cycle. The approve columns (price, calculated total, calculation, approver, time, and the override pair that STORY-06.07 fills) are written once, by INSERT, and never
-- changed. The unlock, cancel and remove columns are null until STORY-06.08, 06.12 and 06.13 set them, so the table is created whole now and those stories add no migration. BO is the latest
-- row of an estimate that has not been removed (architecture section 4.8).
--
-- No "created_at" and no "updated_at", by design: "approved_at" is when the row was made, and each later change has its own time (the exception to the rule that every table has both, coding
-- standards section 10 "SQL", for a table that is added to and changed only in named columns).

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estimate_id" UUID NOT NULL,
    "calculation_id" UUID NOT NULL,
    "approved_price" DECIMAL(18,2) NOT NULL,
    "calculated_bl" DECIMAL(18,2) NOT NULL,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "approved_by" UUID NOT NULL,
    "approved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlocked_by" UUID,
    "unlocked_at" TIMESTAMPTZ(6),
    "unlock_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "removed_by" UUID,
    "removed_at" TIMESTAMPTZ(6),

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_approvals_estimate_id" ON "approvals"("estimate_id", "approved_at" DESC);

-- CreateIndex
CREATE INDEX "idx_approvals_calculation_id" ON "approvals"("calculation_id");

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "fk_approvals_estimate_id" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "fk_approvals_calculation_id" FOREIGN KEY ("calculation_id") REFERENCES "calculations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "fk_approvals_approved_by" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "fk_approvals_unlocked_by" FOREIGN KEY ("unlocked_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "fk_approvals_cancelled_by" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "fk_approvals_removed_by" FOREIGN KEY ("removed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written from here (Prisma cannot express these).
--
-- 1. What the table keeps whoever writes to it. A price and a total are not negative. The reason for a different price is at most 500 characters (D-18) and exists only on an override. Each act
--    (unlock, cancel, remove) names who and when together, or neither.
ALTER TABLE "approvals" ADD CONSTRAINT "ck_approvals_approved_price_not_negative" CHECK ("approved_price" >= 0);
ALTER TABLE "approvals" ADD CONSTRAINT "ck_approvals_calculated_bl_not_negative" CHECK ("calculated_bl" >= 0);
ALTER TABLE "approvals" ADD CONSTRAINT "ck_approvals_override_reason_length" CHECK ("override_reason" IS NULL OR char_length("override_reason") <= 500);
ALTER TABLE "approvals" ADD CONSTRAINT "ck_approvals_override_reason_needs_override" CHECK ("override_reason" IS NULL OR "is_override");
ALTER TABLE "approvals" ADD CONSTRAINT "ck_approvals_unlock_by_and_at_together" CHECK (("unlocked_by" IS NULL) = ("unlocked_at" IS NULL));
ALTER TABLE "approvals" ADD CONSTRAINT "ck_approvals_cancel_by_and_at_together" CHECK (("cancelled_by" IS NULL) = ("cancelled_at" IS NULL));
ALTER TABLE "approvals" ADD CONSTRAINT "ck_approvals_remove_by_and_at_together" CHECK (("removed_by" IS NULL) = ("removed_at" IS NULL));

-- 2. One live approval per estimate (AC-6): a row that is not unlocked, cancelled or removed. The estimate's row lock and the state machine already make a second approval of an approved estimate a 409;
--    this is the backstop that holds even if a caller skipped them, so "exactly one approvals row" is a fact of the data and not only of the code.
CREATE UNIQUE INDEX "uq_approvals_one_live_per_estimate" ON "approvals" ("estimate_id") WHERE "unlocked_at" IS NULL AND "cancelled_at" IS NULL AND "removed_at" IS NULL;

-- 3. Grants (ADR-007). The runtime role reads and adds, and changes the unlock, cancel and remove columns only (AC-3): it has no table-wide UPDATE, so "approved_price" can never be changed by it,
--    even by a fault in the service, and no DELETE or TRUNCATE. The role script's default privileges give the four row rights; this removes them and states the list, so a later change to the
--    defaults cannot widen it.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "approvals" FROM "accucut_app";
GRANT SELECT, INSERT ON TABLE "approvals" TO "accucut_app";
GRANT UPDATE ("unlocked_by", "unlocked_at", "unlock_reason", "cancelled_by", "cancelled_at", "cancel_reason", "removed_by", "removed_at") ON TABLE "approvals" TO "accucut_app";

-- 4. Triggers, the backstop for every role, the owner included. A change of any approve column is refused (the approved values stand), a column of the unlock, cancel and remove acts is write-once, and so is every DELETE and TRUNCATE. The owner could still drop
--    a trigger with DDL; that is a schema change, made only by a migration, and the runtime role cannot do it (architecture section 9.5, ARCH-R8).
CREATE FUNCTION "forbid_approval_core_change"() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog
AS $$
BEGIN
    IF NEW."id" IS DISTINCT FROM OLD."id"
        OR NEW."estimate_id" IS DISTINCT FROM OLD."estimate_id"
        OR NEW."calculation_id" IS DISTINCT FROM OLD."calculation_id"
        OR NEW."approved_price" IS DISTINCT FROM OLD."approved_price"
        OR NEW."calculated_bl" IS DISTINCT FROM OLD."calculated_bl"
        OR NEW."is_override" IS DISTINCT FROM OLD."is_override"
        OR NEW."override_reason" IS DISTINCT FROM OLD."override_reason"
        OR NEW."approved_by" IS DISTINCT FROM OLD."approved_by"
        OR NEW."approved_at" IS DISTINCT FROM OLD."approved_at" THEN
        RAISE EXCEPTION 'The approved values of an approval cannot be changed.'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    -- The unlock, cancel and remove columns are write-once (SQR-02 of the review of AQP-323): null until their story sets them, then fixed. A value that was set cannot be rewritten or cleared,
    -- so a removed price cannot be brought back by clearing "removed_at", and an unlock or a cancel cannot be erased or re-attributed. A later act on the same estimate is a new row.
    IF (OLD."unlocked_by" IS NOT NULL AND NEW."unlocked_by" IS DISTINCT FROM OLD."unlocked_by")
        OR (OLD."unlocked_at" IS NOT NULL AND NEW."unlocked_at" IS DISTINCT FROM OLD."unlocked_at")
        OR (OLD."unlock_reason" IS NOT NULL AND NEW."unlock_reason" IS DISTINCT FROM OLD."unlock_reason")
        OR (OLD."cancelled_by" IS NOT NULL AND NEW."cancelled_by" IS DISTINCT FROM OLD."cancelled_by")
        OR (OLD."cancelled_at" IS NOT NULL AND NEW."cancelled_at" IS DISTINCT FROM OLD."cancelled_at")
        OR (OLD."cancel_reason" IS NOT NULL AND NEW."cancel_reason" IS DISTINCT FROM OLD."cancel_reason")
        OR (OLD."removed_by" IS NOT NULL AND NEW."removed_by" IS DISTINCT FROM OLD."removed_by")
        OR (OLD."removed_at" IS NOT NULL AND NEW."removed_at" IS DISTINCT FROM OLD."removed_at") THEN
        RAISE EXCEPTION 'An unlock, a cancel or a removal of an approval cannot be changed once it is set.'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_approvals_forbid_core_change"
    BEFORE UPDATE ON "approvals"
    FOR EACH ROW EXECUTE FUNCTION "forbid_approval_core_change"();

CREATE TRIGGER "trg_approvals_forbid_delete"
    BEFORE DELETE ON "approvals"
    FOR EACH ROW EXECUTE FUNCTION "forbid_immutable_change"();

CREATE TRIGGER "trg_approvals_forbid_truncate"
    BEFORE TRUNCATE ON "approvals"
    FOR EACH STATEMENT EXECUTE FUNCTION "forbid_immutable_change"();
