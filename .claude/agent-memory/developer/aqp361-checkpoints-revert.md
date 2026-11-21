---
name: aqp361-checkpoints-revert
description: AQP-361 (STORY-08.06) checkpoints and revert, PR 553 - separate checkpoint repository, test wiring list, local PG recipe with ROLES_SQL, traps
metadata:
  type: project
---

- Layout: `config-checkpoint-repository.ts` (separate from `config-repository.ts`, which the 08.05 guard reads as the one writer of config_versions), `config-checkpoint-service.ts`, pure `lib/config/checkpoint.ts` + `revert.ts`, SCR-21 in `components/features/config/checkpoints-*.tsx`, lazy `revert-dialog.tsx`.
- Wiring a new Admin-only service touches: session-harness (+ fake repo in `tests/support/fake-checkpoints.ts`), `getXService` line in 4 security tests' composition mocks (csrf, engineer-refused-before-lookup, role-matrix, strict-schema), route-loaders (API and PAGE), spec-access, a recipe (route-calls.ts is at its 400-line cap: new recipes go in `tests/support/checkpoint-calls.ts`, chained into `validCallFor`), engineer-import-rule (repository AND service), config-fields-confidentiality ALLOWED_IMPORTERS (every file importing `features/config/`, `lib/config/`, `schemas/config*`: list them with a grep), audit-events.test WIRED_CONFIG, audit-database TESTED_ELSEWHERE, js-budget-routes.test + integration/js-budget.test (new page), role-matrix RETURN_AFTER_STALE_SESSION.
- Making the last planned manifest row implemented breaks role-matrix "planned.length > 0".
- Local PG: `MSYS_NO_PATHCONV=1 docker run ... -e ROLES_SQL=/opt/accucut/db/create-roles.psql -v <wt>/docker/postgres-init:/docker-entrypoint-initdb.d:ro -v <wt>/deploy/db:/opt/accucut/db:ro postgres:17` (without the deploy/db mount and the no-pathconv flag the roles script fails). Port 55461, container aqp361-db. Drift check: `MIGRATE_DATABASE_URL=... prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`.
- Shell traps: backticks inside `node -e "..."` patches vanish (use the Edit tool or a Write-d script); regex backslashes get eaten the same way.
- Static markup tests cannot see a Radix dialog (portal): test the words from the texts module and leave states to E2E.
- Revert order (story): role, 404, base version, nothing to revert (deep-equal of parsed documents), usable target, verifyStepUp, one transaction. Password-lock test must run LAST in an integration file (the one Admin's step-up stays locked).
