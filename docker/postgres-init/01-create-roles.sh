#!/bin/sh
# Creates the two database roles (STORY-10.01 AC-9, assumption A-1; architecture sections 5.1, 5.6).
#
#   accucut_owner  runs migrations and owns the schema. Used by the `migrate` step only.
#   accucut_app    the runtime role used by `app` and `worker`. It can read and write rows but has
#                  no DDL rights: it cannot create, alter or drop anything.
#
# Runs once, on the first start of an empty data directory (docker-entrypoint-initdb.d), and is also
# used by CI against its Postgres service. Passwords come from the environment and are never printed.
# Needs: DB_OWNER_PASSWORD, DB_APP_PASSWORD, POSTGRES_USER, POSTGRES_DB (the image sets the last two).
set -eu

: "${DB_OWNER_PASSWORD:?DB_OWNER_PASSWORD is not set}"
: "${DB_APP_PASSWORD:?DB_APP_PASSWORD is not set}"

# CREATEDB on the owner is for `prisma migrate dev` (it needs a shadow database). Development only:
# the production owner role is created without it.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v owner_password="$DB_OWNER_PASSWORD" -v app_password="$DB_APP_PASSWORD" <<'SQL'
CREATE ROLE accucut_owner LOGIN CREATEDB PASSWORD :'owner_password';
CREATE ROLE accucut_app LOGIN PASSWORD :'app_password';

ALTER DATABASE accucut OWNER TO accucut_owner;
REVOKE ALL ON DATABASE accucut FROM PUBLIC;
GRANT CONNECT ON DATABASE accucut TO accucut_owner, accucut_app;

-- The schema belongs to the owner; the runtime role may use it but not create in it.
ALTER SCHEMA public OWNER TO accucut_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO accucut_app;

-- Whatever the owner creates later (migrations) is readable and writable by the runtime role.
-- Stories that need less (append-only audit, immutable calculations) revoke per table.
ALTER DEFAULT PRIVILEGES FOR ROLE accucut_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO accucut_app;
ALTER DEFAULT PRIVILEGES FOR ROLE accucut_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO accucut_app;
SQL
