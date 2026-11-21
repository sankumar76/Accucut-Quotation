-- STORY-09.07 (AQP-354): the links that reset a password (FR-003, FR-098, FR-001; architecture sections 5.1, 6 and 8; ADR-009, ADR-011).
--
-- Additive only (one new table, a foreign key to users): the previous image keeps running during a rollback, because it neither reads nor writes it.
-- Rollback note, for use only if this migration must be undone (every link that was made is then lost, which only means a person asks for a new one):
--   DROP TABLE "password_reset_tokens";   -- also drops its indexes, its foreign key and its CHECK constraints
--
-- The raw token (32 random bytes, shown once in the e-mail) is never stored: "token_hash" is its SHA-256 as 64 lower-case hex digits, UNIQUE, and a CHECK keeps anything else out, so a
-- column that held the raw token by mistake would be refused. A token works once: the claim is one UPDATE that needs "used_at" IS NULL and "expires_at" in the future. A row is never
-- deleted, so "created_at" and "used_at" are the record of a reset by link (decision A-2: no audit entry, the caller is not signed in). Class Confidential.

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one row per token, and the claim finds its row by the hash.
CREATE UNIQUE INDEX "uq_password_reset_tokens_token_hash" ON "password_reset_tokens"("token_hash");

-- CreateIndex: "the person's other unused tokens" at a reset reads by person.
CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens"("user_id");

-- AddForeignKey: no cascade and no action on delete, so a person who has links on record cannot be deleted (users are deactivated, never deleted).
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "fk_password_reset_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Hand-written from here (Prisma cannot express these).
--
-- 1. What the table keeps whoever writes to it: a hash and nothing else in "token_hash".
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "ck_password_reset_tokens_token_hash_sha256" CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

-- 2. Grants. The runtime role (the web process and the worker both connect as "accucut_app", deploy/db/create-roles.psql) is given by default all four row rights on a new table; this
--    removes what it must not have and states the list, so a later change to the defaults cannot widen it: SELECT, INSERT and UPDATE, no DELETE and no TRUNCATE (the rows are the record).
REVOKE ALL ON TABLE "password_reset_tokens" FROM "accucut_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "password_reset_tokens" TO "accucut_app";
