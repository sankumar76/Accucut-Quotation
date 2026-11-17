-- STORY-06.08 (AQP-325), precondition SQR-12 of the review of AQP-323: an unlock, a cancel and a removal of an approval are each one act that freezes whole once its time is set (architecture sections 4.8, 4.10 and 5.1).
--
-- The trigger of 20261116120000_approvals made each unlock, cancel and remove column write-once **one column at a time**: null until set, then fixed. That left a gap. A reason that was NULL when the act was stored
-- (`unlock_reason`, `cancel_reason`) could still be filled in later, and so could be written after the fact by anyone who can update the column, the runtime role included. This migration closes it two ways.
--
--   1. The trigger now freezes the **whole act** once its time column is set: from then on neither the person, the time nor the reason can change, whether it was null or not. A removal has no reason; its
--      person and time freeze together the same way.
--   2. A reason without an act is refused by a CHECK, so a reason cannot be put on a row before its time and then be rewritten when the time is set (the trigger leaves an act open until its time is set).
--
-- The approve columns stay as they were: a change of any of them is refused for every role. Nothing is read or written by the previous image differently (it never wrote these columns), so this is additive and a
-- rollback is a new migration that restores the previous function body and drops the two constraints:
--   ALTER TABLE "approvals" DROP CONSTRAINT "ck_approvals_unlock_reason_needs_unlock", DROP CONSTRAINT "ck_approvals_cancel_reason_needs_cancel";
-- (and `CREATE OR REPLACE FUNCTION "forbid_approval_core_change"` with the body of 20261116120000_approvals).
--
-- The runtime role's column grants are unchanged (the unlock, cancel and remove columns only), and the trigger itself is not recreated: `CREATE OR REPLACE` swaps the function it calls.

-- 1. A reason belongs to an act: it is there only when the act's time is. Every existing row has none of these columns set, so the constraints hold for all of them.
ALTER TABLE "approvals" ADD CONSTRAINT "ck_approvals_unlock_reason_needs_unlock" CHECK ("unlock_reason" IS NULL OR "unlocked_at" IS NOT NULL);
ALTER TABLE "approvals" ADD CONSTRAINT "ck_approvals_cancel_reason_needs_cancel" CHECK ("cancel_reason" IS NULL OR "cancelled_at" IS NOT NULL);

-- 2. The trigger function, whole act at a time.
CREATE OR REPLACE FUNCTION "forbid_approval_core_change"() RETURNS trigger
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
    -- An act is stored once, whole: its time is set together with its person and, for an unlock and a cancel, its reason (null or not). From the moment the time is set, no part of the act can be written,
    -- rewritten or cleared. So a reason that was null when the act was stored stays null, an unlock or a cancel cannot be erased or re-attributed, and a removed price cannot be brought back by clearing
    -- "removed_at". A later act on the same estimate is a new row. The row's "_by" and "_at" are null or set together (the CHECK constraints of 20261116120000_approvals), so the time is the one test.
    IF (OLD."unlocked_at" IS NOT NULL
            AND (NEW."unlocked_by" IS DISTINCT FROM OLD."unlocked_by" OR NEW."unlocked_at" IS DISTINCT FROM OLD."unlocked_at" OR NEW."unlock_reason" IS DISTINCT FROM OLD."unlock_reason"))
        OR (OLD."cancelled_at" IS NOT NULL
            AND (NEW."cancelled_by" IS DISTINCT FROM OLD."cancelled_by" OR NEW."cancelled_at" IS DISTINCT FROM OLD."cancelled_at" OR NEW."cancel_reason" IS DISTINCT FROM OLD."cancel_reason"))
        OR (OLD."removed_at" IS NOT NULL
            AND (NEW."removed_by" IS DISTINCT FROM OLD."removed_by" OR NEW."removed_at" IS DISTINCT FROM OLD."removed_at")) THEN
        RAISE EXCEPTION 'An unlock, a cancel or a removal of an approval cannot be changed once it is set.'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;
