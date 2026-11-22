-- CR-01 item 6 (AQP-390; architecture section 4.11 a): every customer has a short name, the first half of the Excel file name (CR01-9) and of the assignment's identity.
--
-- One transaction (Prisma runs the file in one): add the column nullable, give every existing customer a generated, unique short name, set it NOT NULL, then add the
-- CHECKs and the unique index. A failure anywhere rolls the whole file back and the database is as before.
--
-- Backfill rule (deterministic, so a copy of the database gets the same names): rows in created_at, id order; the base is the name with everything outside A-Z a-z 0-9 removed,
-- upper-cased and cut to 10 characters ("CUST" if nothing is left); if lower(base) is taken, the first free of left(base, 10 - len(k)) || k for k = 2, 3, ... is used. The literal
-- 10 is right here: a migration is frozen history and must not follow a constant that can change (the limit in code is CUSTOMER_SHORT_NAME_MAX_LENGTH). The generated names are
-- ordinary data that the Admin edits on SCR-12; the release note tells the Admin to check them before the first export. The backfill writes no audit entry (a migration, not a
-- person's act). No customer is renamed and no other column is touched.
--
-- Database ceiling 20, under the code's 10: raising the constant up to 20 is a code-only change. The unique index covers every row, soft-deleted ones included (the same scope as
-- uq_customers_name_lower), so a deleted customer's short name stays reserved; it is on lower(short_name) because Windows file names are case-insensitive.
--
-- Safe as one release only because no production database exists before G8 (assumption A-CR01-A1): the previous image would insert customers without a short name. If CR-01 has not
-- merged when the first production install happens, split this file into expand (the nullable column and the backfill, the app writes the column) and contract (SET NOT NULL).
--
-- Rollback note (the architecture's section 5.6 asks one for each migration with a destructive effect). Reverse order, then run with the previous release:
--   DROP INDEX "uq_customers_short_name_lower";
--   ALTER TABLE "customers" DROP CONSTRAINT "ck_customers_short_name_length", DROP CONSTRAINT "ck_customers_short_name_not_blank";
--   ALTER TABLE "customers" DROP COLUMN "short_name";
-- Lost on rollback: only the generated short names and any short name typed since. Restore from the pre-update backup is the fallback, as always.

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "short_name" TEXT;

-- Backfill: a generated, unique short name for every customer.
DO $$
DECLARE
  customer RECORD;
  base TEXT;
  candidate TEXT;
  suffix INTEGER;
BEGIN
  FOR customer IN SELECT "id", "name" FROM "customers" WHERE "short_name" IS NULL ORDER BY "created_at", "id" LOOP
    base := upper(left(regexp_replace(customer."name", '[^A-Za-z0-9]', '', 'g'), 10));
    IF base = '' THEN
      base := 'CUST';
    END IF;
    candidate := base;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM "customers" WHERE lower("short_name") = lower(candidate)) LOOP
      suffix := suffix + 1;
      candidate := left(base, 10 - char_length(suffix::text)) || suffix::text;
    END LOOP;
    UPDATE "customers" SET "short_name" = candidate WHERE "id" = customer."id";
  END LOOP;
END
$$;

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "short_name" SET NOT NULL;

-- Hand-written from here (Prisma cannot express these).
--
-- 1. A short name is unique without regard to letter case, over every row (soft-deleted included). The index is the backstop when two requests race for one short name.
CREATE UNIQUE INDEX "uq_customers_short_name_lower" ON "customers" (lower("short_name"));

-- 2. A short name is not blank, and at most 20 characters (the ceiling; the code's limit is lower and is changed without a migration).
ALTER TABLE "customers" ADD CONSTRAINT "ck_customers_short_name_not_blank" CHECK (btrim("short_name") <> '');
ALTER TABLE "customers" ADD CONSTRAINT "ck_customers_short_name_length" CHECK (char_length("short_name") <= 20);
