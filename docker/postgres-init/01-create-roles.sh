#!/bin/sh
# Creates the two database roles (STORY-10.01 AC-9, assumption A-1; architecture sections 5.1, 5.6).
#
#   accucut_owner  runs migrations and owns the schema. Used by the `migrate` step only.
#   accucut_app    the runtime role used by `app` and `worker`. It can read and write rows but has
#                  no DDL rights: it cannot create, alter or drop anything.
#
# The SQL is deploy/db/create-roles.psql, the one source that deploy/windows/install.ps1 reads too
# (STORY-10.04, architecture section 9.9). This script only finds it and runs it with psql.
#
# Runs once, on the first start of an empty data directory (docker-entrypoint-initdb.d), and is also
# used by CI against its Postgres service. The passwords and the database name come from the
# environment and are read by psql itself (\getenv), so none of them appears on a command line, where
# `ps` and /proc/*/cmdline would show it. Nothing is printed.
# Needs: DB_OWNER_PASSWORD, DB_APP_PASSWORD, POSTGRES_USER, POSTGRES_DB (the image sets the last two),
# and a psql client of version 15 or later (\getenv); the image has 17 and the CI runner 16.
# ROLES_SQL names the SQL file. Without it the file is found from this script's own path (CI, a checkout).
# The image runs this script by sourcing it, so $0 is not the script there; compose.dev.yml sets ROLES_SQL.
set -eu

: "${DB_OWNER_PASSWORD:?DB_OWNER_PASSWORD is not set}"
: "${DB_APP_PASSWORD:?DB_APP_PASSWORD is not set}"

psql_major="$(psql --version | sed -n 's/^[^0-9]*\([0-9][0-9]*\).*/\1/p')"
if [ "${psql_major:-0}" -lt 15 ]; then
  echo "psql 15 or later is required (found ${psql_major:-unknown}): \getenv is not available." >&2
  exit 1
fi

roles_sql="${ROLES_SQL:-$(dirname "$0")/../../deploy/db/create-roles.psql}"
if [ ! -f "$roles_sql" ]; then
  echo "The role SQL file was not found. Set ROLES_SQL to deploy/db/create-roles.psql." >&2
  exit 1
fi

# CREATEDB on the owner is for `prisma migrate dev` (it needs a shadow database). Development only:
# the production owner role (deploy/windows/install.ps1) is created without it.
DB_OWNER_CREATEDB=on
export DB_OWNER_CREATEDB

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --file "$roles_sql"
