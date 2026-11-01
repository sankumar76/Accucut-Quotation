# Coding Standards

> **Customise this file for your company.** It is the rule-book reviewer-standards
> enforces and the developer follows. Keep the section headings; replace or extend the
> rules. Language-specific sections marked `<<...>>` should be completed per stack.

## 1. General Principles

- Readability over cleverness. Code is read far more often than it is written.
- Single Responsibility: a function does one thing; a module has one reason to change.
- Small units: functions ≤ 40 lines, files ≤ 400 lines, cyclomatic complexity ≤ 10 (justify exceptions inline).
- DRY, but prefer duplication over the wrong abstraction (rule of three).
- Fail fast and loudly at boundaries; never swallow exceptions silently.
- No magic numbers or strings — use named constants or configuration.

## 2. Naming

- Names reveal intent; avoid abbreviations except widely known ones (`id`, `url`, `http`).
- Booleans read as predicates: `isActive`, `hasAccess`, `shouldRetry`.
- Functions are verbs (`calculateTotal`), classes/types are nouns (`InvoiceRepository`).
- <<Casing conventions per language, e.g. camelCase for TS variables, PascalCase for types, snake_case for Python, kebab-case for file names>>

## 3. Structure & Architecture

- Follow the layering and source tree defined in `docs/04-architecture/architecture.md`.
- Dependencies point inward (domain must not import infrastructure/UI).
- No business logic in controllers/handlers or UI components.
- Cross-cutting concerns (logging, auth, validation) use the shared modules — do not re-implement.

## 4. Error Handling & Logging

- Use the project's error types; include actionable context, never sensitive data.
- Log at the right level: `error` (needs action), `warn` (degraded), `info` (business events), `debug` (diagnostics).
- Structured logs with correlation/request IDs. Never log secrets, tokens, passwords or PII.

## 5. Security (baseline — OWASP ASVS L1 minimum)

- Validate and sanitise all external input at the boundary; use allow-lists.
- Parameterised queries only; no string-built SQL/NoSQL/shell commands.
- Encode output for its context (HTML, URL, JS, SQL).
- AuthN/AuthZ checks on every protected operation; deny by default.
- Secrets come from the secrets manager / environment — never committed.
- Dependencies: no new library without architect approval (licence + vulnerability check).

## 6. Testing

- Test pyramid: many unit, fewer integration, few end-to-end.
- Tests are deterministic, isolated, and fast; no network calls in unit tests.
- Arrange–Act–Assert structure; one behaviour per test; descriptive names
  (`should_reject_expired_token_when_validating`).
- Test data via builders/factories; no real personal data.
- Coverage thresholds (industry default, e.g. SonarQube "Sonar way" gate): ≥ 80% on changed code
  in every PR, and ≥ 80% for the whole package.

## 7. Performance

- Avoid N+1 queries; batch and paginate; index columns used in filters/joins.
- No unbounded loops/collections over external data; stream large payloads.
- Cache only with a defined invalidation strategy and TTL.

## 8. Documentation

- Public functions/classes have doc comments describing purpose, params, returns, errors.
- Comments explain *why*, not *what*.
- ADR for every significant or hard-to-reverse technical decision.

## 9. Version Control

- Branch: `feat/<story-id>-short-name`, `fix/<defect-id>-short-name`.
- Commits: Conventional Commits (`feat(auth): add token refresh [STORY-02.04]`).
- One logical change per commit; no generated artefacts or secrets committed.

## 10. Language-Specific Rules

### TypeScript

- `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride` and `exactOptionalPropertyTypes` in `tsconfig.json`.
- No `any`. Use `unknown` and narrow it. If `any` is truly unavoidable, add a `// eslint-disable-next-line` with a one-line reason.
- No non-null assertions (`!`) or `as` casts to silence the compiler. Validate external data (forms, API bodies, env vars, Excel input) with **zod** and infer types from the schemas.
- Prefer `readonly` properties and `ReadonlyArray`; never mutate function arguments.
- Model states as discriminated unions (e.g. `EstimateStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED'`, field `kind`/`dataType`). Every `switch` on a union is exhaustive, with an `assertNever(x)` default.
- **Money and rates:** never use JS floating point for stored or calculated money. Use `Prisma.Decimal` / decimal.js in the formula engine. Round to 2 dp only for display and export.
- **Formula engine:** pure functions only (tokenizer → parser → AST → evaluator) with no I/O. No `eval`, `new Function` or dynamic `import` of user input. Test coverage ≥ 95% for `lib/formula/**`.
- **Column letters** are always derived via `indexToColumnLetter()` / `columnLetterToIndex()`. Never hard-code letters outside the seed configuration and tests.
- **Dates:** store UTC and display/schedule in `Asia/Kolkata` through one shared helper (`lib/time.ts`). No bare `new Date().toLocaleString()`.
- Named exports only (except Next.js route files). One module = one responsibility. Do not leave `console.log` in committed code; use the shared logger.
- Errors: throw typed errors (`AppError` subclasses) and map them to HTTP responses in one place. Never swallow errors silently.

### SQL (PostgreSQL via Prisma)

- All schema changes go through **Prisma Migrate** (`prisma migrate dev` locally, `prisma migrate deploy` in CI/CD). Never edit an applied migration, and never change the database by hand.
- Naming: Prisma models in `PascalCase` singular, mapped to `snake_case` plural tables (`@@map("field_definitions")`). Columns are `snake_case` (`@map`). Primary key `id` (UUID). Foreign keys `<entity>_id`. Indexes `idx_<table>_<columns>`, unique constraints `uq_<table>_<columns>`.
- Every table has `created_at` and `updated_at` (`timestamptz`). Audit tables are append-only (no UPDATE/DELETE).
- Money, rates and quantities use `Decimal(18,4)`; percentages are stored as entered (e.g. `12.00` = 12%).
- No `SELECT *`. Use Prisma `select` to fetch only needed fields. **Cost, rate and formula fields must never be
