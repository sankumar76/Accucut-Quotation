import 'server-only';

/**
 * The response and request contracts of the API, listed in one place (architecture section 6, "Contract testing"; ADR-008 layer 3).
 * The zod schemas are the contract: a handler parses its own answer with one of them, as `z.strictObject`, so a key the schema does
 * not name is an error and never reaches a client.
 *
 * A route an Engineer may call has exactly ONE response schema, whoever calls it, with no cost, rate or formula field in it
 * (architecture section 6, "One route, one schema"). Lead and Admin figures come from separate routes that an Engineer cannot
 * call. `tests/security/strict-schema.test.ts` walks the route manifest and holds every Engineer-reachable route to this.
 *
 * This barrel is for tests and for server code that wants the whole list. Routes import the one file they need (`schemas/me`), and an
 * `engineer-*` view may not import the barrel at all (`eslint.config.mjs`): it re-exports the Admin schemas, which pull in the audit
 * service. `server-only` keeps a client component from carrying zod and those services into the first-load bundle (NFR-009).
 */
export * from './account';
export * from './audit';
export * from './customers';
export * from './estimates';
export * from './exchange-rates';
export * from './materials';
export * from './me';
export * from './options';
export * from './process-items';
export * from './step-up';
export * from './tasks';
export * from './treatments';
export * from './users';
