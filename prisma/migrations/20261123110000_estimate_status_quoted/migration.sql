-- CR-01 item 7B (AQP-399; architecture section 4.12 a and b; ADR-019 Option A): the estimate status gains QUOTED, the step after APPROVED that a Lead or an Admin marks when the quote
-- has gone to the customer (the button and the route are story 7C; this file adds the value only).
--
-- **One statement, in a file of its own.** PostgreSQL lets a value added by ALTER TYPE ... ADD VALUE be used only after the transaction that added it has committed, and Prisma runs
-- each migration file in one transaction. So no CHECK, default or index in this file may name 'QUOTED': the CHECKs that do are in the next file, 20261123120000_estimate_quoted_ignored.
--
-- Nothing is rewritten and no row changes status: no existing row can be QUOTED. The new value sorts after APPROVED.
--
-- Rollback note: PostgreSQL cannot drop an enum value, so QUOTED stays in the type after a rollback, unused, which is harmless. Before rolling the next file back, set every QUOTED row
-- back to APPROVED, **clearing the quote columns in the same statement** (ck_estimates_quoted, still in place at that point, refuses any other form). An approval stands behind a QUOTED
-- estimate, so APPROVED is the status it had. The quote marker is the only thing lost; the audit log keeps the entry of 7C:
--   UPDATE "estimates" SET "status" = 'APPROVED', "quoted_at" = NULL, "quoted_by" = NULL WHERE "status" = 'QUOTED';
-- Restore from the pre-update backup is the fallback.

-- AlterEnum
ALTER TYPE "estimate_status" ADD VALUE 'QUOTED';
