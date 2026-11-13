-- STORY-02.02 (AQP-142): the Customer Master, the customers an estimate is priced for, and each customer's own rate for every Process Master
-- item (FR-011, FR-012, FR-013; SPEC section 4.2; architecture sections 5.1 and 6).
--
-- Additive only (two new tables, their indexes and constraints): the previous image keeps running during a rollback.
-- Rollback note, for use only before the Admin has typed any customer; restore from backup after that:
--   DROP TABLE "customer_rates"; DROP TABLE "customers";   -- in this order: the first refers to the second; their indexes and checks go with them
--
-- The tables are created EMPTY and hold no rate value (ADR-014): the Admin adds the customers, and a customer's rates start as a copy of the
-- Process Master's defaults at the moment it is added (SPEC section 4.2 rule 1). A customer is removed by setting `deleted_at` (A-13, story
-- 02.07), so the runtime role is given no DELETE on `customers`. `customer_rates` is normalised (one row per customer and Process Master item),
-- so the synchronisation of SPEC section 4.2 rules 3 and 5 is plain SQL: the runtime role may delete a rate row, because an unused Process
-- Master item is deleted with its rows (AC-4).

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "process_item_id" UUID NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_customers_name" ON "customers"("name");

-- CreateIndex
CREATE INDEX "idx_customer_rates_customer_id" ON "customer_rates"("customer_id");

-- CreateIndex
CREATE INDEX "idx_customer_rates_process_item_id" ON "customer_rates"("process_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_rates_customer_id_process_item_id" ON "customer_rates"("customer_id", "process_item_id");

-- AddForeignKey
-- No cascade on either side: a customer is soft-deleted and never removed, and a Process Master item is deleted by a service that deletes its
-- customer rates first, in the same transaction (AC-4), so a delete that forgot the rates fails here and does not leave rows without an item.
ALTER TABLE "customer_rates" ADD CONSTRAINT "fk_customer_rates_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_rates" ADD CONSTRAINT "fk_customer_rates_process_item_id" FOREIGN KEY ("process_item_id") REFERENCES "process_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written from here (Prisma cannot express these).
--
-- 1. A name is unique without regard to letter case (AC-1): "Acme Works" and "acme works" are one customer to the Admin. The index is the
--    backstop when two requests race for the same name. `uq_customers_name` above is implied by it and mirrors the schema's `@@unique`:
--    do not drop it as a duplicate.
CREATE UNIQUE INDEX "uq_customers_name_lower" ON "customers" (lower("name"));

-- 2. A name is not blank, and a rate is 0 or more (AC-2).
ALTER TABLE "customers" ADD CONSTRAINT "ck_customers_name_not_blank" CHECK (char_length(btrim("name")) > 0);
ALTER TABLE "customer_rates" ADD CONSTRAINT "ck_customer_rates_value_not_negative" CHECK ("value" >= 0);

-- 3. Grants for the runtime role. `customers`: it reads, adds and changes customers, has no DELETE (a customer is removed by setting
--    `deleted_at`, story 02.07) and cannot truncate the table. `customer_rates`: it also deletes, for the delete of an unused Process Master
--    item (AC-4); it cannot truncate it. The default privileges of the role script give the four row rights; this states them, so a later
--    change to the defaults cannot widen the list.
REVOKE DELETE, TRUNCATE ON TABLE "customers" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "customers" TO "accucut_app";
REVOKE TRUNCATE ON TABLE "customer_rates" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "customer_rates" TO "accucut_app";
