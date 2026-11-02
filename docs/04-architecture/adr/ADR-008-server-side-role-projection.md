# ADR-008: Cost confidentiality by server-side role projection

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-11-01 |
| Deciders | solution-architect (+ Santhosh at G3) |
| Related | FR-007, 008, 051, 055, 070; NFR-001, 002; SPEC §3, §14.1; ADR-001, ADR-010 |

## Context
An Engineer must never receive any calculated value, material rate, exchange rate, customer rate or formula, in any page, API response or file. In the App Router, a danger is easy to miss: props passed from a Server Component to a Client Component are serialised into the page's RSC payload, so hiding a value in the UI still sends it. A single careless prop would break the product's main promise.

## Decision Drivers
- NFR-002: 0 occurrences, tested on every build
- SPEC §3: filtering must happen on the server
- FR-008: Engineers keep seeing what they typed, including Machining, Plating and Tool Cost
- A failure must be caught by the build, not by a reviewer's eye

## Considered Options
### Option A — Defence in layers: data kept apart, allow-list projections, build rules, canary test
- Pros: each layer works alone; a mistake in one fails a test rather than leaking
- Cons: an extra projection per role
- Cost / effort: small and front-loaded

### Option B — One shared DTO with fields stripped per role (deny-list)
- Pros: less code
- Cons: a new field leaks by default, which is the wrong failure direction
- Cost / effort: low now, high risk

### Option C — PostgreSQL row-level or column-level security per application role
- Pros: enforced by the database
- Cons: the app uses one connection role; per-user roles mean a heavy pool design; it still does not stop a Lead-loaded value being passed to a wrong component
- Cost / effort: high

## Decision
We will enforce confidentiality in five layers.

1. **Data.** `estimate_nodes.inputs` holds typed values only. Column I and all outputs are never written there. Everything Restricted is in `calculations`, `calculation_rows`, `approvals` and masters.
2. **Code boundary.** `src/server/views/engineer-*.ts` and Engineer pages may not import cost repositories, `lib/formula` or `lib/rollup`. ESLint fails the build on such an import. Engine modules start with `import 'server-only'`.
3. **Allow-list output.** Engineer responses are built from named fields and parsed with `.strict()` zod schemas. `engineerVisible` is refused on everything except inputs and F. Masters reach Engineers only through `/options/*`, which return IDs and names, plus Material Considered. **A route an Engineer can call has exactly one response schema, with no cost field, whoever calls it.** Lead and Admin figures come from routes an Engineer cannot call. The first version of the API let `/tree` add figures by role; the UX reconciliation removed that, as a role branch inside a shared route is exactly where a mistake leaks a value.
4. **Transport.** Every authenticated response is `private, no-store`. No Next.js data caching on role-dependent routes. Engineer and Lead views at one address are separate component trees with separate loaders.
5. **Proof.** On every build, a canary test seeds every Restricted value with a unique invented sentinel, runs the Engineer journeys, and scans every response (HTML, RSC payload, JSON, chunks) for those sentinels and for formula and rate text.

Calculate returns the fixed message and status only. Task codes are sequential and so can be guessed. An Engineer asking for another Engineer's task, or one that does not exist, gets an identical response: 404 from the API, and SCR-26 "no access" from the page (UX-22).

## Consequences
- Positive: the leak path is closed at several independent points, and a new field is hidden by default.
- Negative / trade-offs accepted: two views of an estimate to maintain; no live cost preview, which only Admin and Lead could have had anyway (SPEC §12).
- Follow-up actions (with owners): qa-engineer runs the canary suite on every build; reviewers check that new Engineer routes appear in it.

## Verification
SPEC §14.1 acceptance test; `test-strategy.md` section 6. A deliberately leaking test route must make the suite fail, proving the scanner works.
