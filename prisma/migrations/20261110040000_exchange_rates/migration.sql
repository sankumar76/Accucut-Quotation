-- STORY-02.04 (AQP-123): the Exchange Rate Master, 1 US dollar and 1 euro in rupees (FR-016; SPEC sections 4.4 and 7.4; architecture
-- sections 5.1 and 6).
--
-- Additive only (a new table, its constraints and one foreign key): the previous image keeps running during a rollback.
-- Rollback note, for use only before the Admin has typed any rate; restore from backup after that:
--   DROP TABLE "exchange_rates";   -- also drops its constraints; no other table refers to it
--
-- The table is created EMPTY and holds no rate (ADR-014): the Admin types the two rates in. A rate that was never set has no row, and the
-- screen says "Not set yet". Both rows are written together by one save, with the same stamp (`updated_by`, `updated_at`).

-- CreateTable
CREATE TABLE "exchange_rates" (
    "currency" TEXT NOT NULL,
    "inr_value" DECIMAL(18,4) NOT NULL,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("currency")
);

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "fk_exchange_rates_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written from here (Prisma cannot express these).
--
-- 1. There are two currencies, and a rate is 0 or more (AC-2, assumption A-1: 0 is accepted so that the division-by-zero case CE-8 can run).
--    The server refuses a negative rate with 422; this is the same rule one level down.
ALTER TABLE "exchange_rates" ADD CONSTRAINT "ck_exchange_rates_currency" CHECK ("currency" IN ('USD', 'EUR'));
ALTER TABLE "exchange_rates" ADD CONSTRAINT "ck_exchange_rates_inr_value_not_negative" CHECK ("inr_value" >= 0);

-- 2. Grants for the runtime role: it reads, adds and changes the two rows. It has no DELETE (a rate is changed, never removed) and cannot
--    truncate the table. The default privileges of the role script give it the four row rights; this takes two back.
REVOKE DELETE, TRUNCATE ON TABLE "exchange_rates" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "exchange_rates" TO "accucut_app";
