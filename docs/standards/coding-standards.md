# Coding Standards

> **Customise this file for your company.** It is the rule-book reviewer-standards
> enforces and the developer follows. Keep the section headings; replace or extend the
> rules. Language-specific sections marked `<<...>>` should be completed per stack.

## 1. General Principles
- Readability over cleverness. Code is read far more often than it is written.
- Single Responsibility: a function does one thing; a module has one reason to change.
- Small units: functions ≤ <<40>> lines, files ≤ <<400>> lines, cyclomatic complexity ≤ <<10>> (justify exceptions inline).
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
- Coverage threshold on changed code: <<80>> %.

## 7. Performance
- Avoid N+1 queries; batch and paginate; index columns used in filters/joins.
- No unbounded loops/collections over external data; stream large payloads.
- Cache only with a defined invalidation strategy and TTL.
- Budgets: <<p95 API latency ≤ 300 ms, page LCP ≤ 2.5 s, memory per instance ≤ X>>.

## 8. Documentation
- Public functions/classes have doc comments describing purpose, params, returns, errors.
- Comments explain *why*, not *what*.
- ADR for every significant or hard-to-reverse technical decision.

## 9. Version Control
- Branch: `feat/<story-id>-short-name`, `fix/<defect-id>-short-name`.
- Commits: Conventional Commits (`feat(auth): add token refresh [STORY-02.04]`).
- One logical change per commit; no generated artefacts or secrets committed.

## 10. Language-Specific Rules
### <<Language 1, e.g. TypeScript>>
- <<strict mode on; no `any` without justification; prefer `readonly`; exhaustive switch on unions>>
### <<Language 2, e.g. SQL>>
- <<migrations via tool X; naming of tables/indexes; no SELECT *>>
### <<Frontend framework>>
- <<component conventions, state management rules, a11y lint rules>>

## 11. Tooling (must pass in CI)
- Formatter: <<prettier / black / gofmt>>
- Linter: <<eslint / ruff / golangci-lint>> — zero errors, warnings justified
- Type checker: <<tsc / mypy>>
- Security scan: <<npm audit / pip-audit / Snyk / Semgrep>>
