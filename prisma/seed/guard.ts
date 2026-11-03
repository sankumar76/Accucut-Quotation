/**
 * The placeholder seed must never run against a live install (architecture section 5.5, ADR-014):
 * it loads invented masters for development, CI and staging only.
 */

export const SEED_PRODUCTION_REFUSAL =
  'Refusing to seed: NODE_ENV is "production". Placeholder data is for development, CI and staging only (ADR-014).';

export function assertSeedAllowed(env: { readonly NODE_ENV?: string | undefined }): void {
  if (env.NODE_ENV === 'production') throw new Error(SEED_PRODUCTION_REFUSAL);
}
