import { PROTECTED_FIELD_KEYS } from './types';

/**
 * Whether a field may never be deleted (STORY-08.04 AC-5, architecture section 4.5): it has a system role (A, H, BG, BL, BM, BO), or the code finds it by key and would fail without it
 * (`PROTECTED_FIELD_KEYS`). SCR-17 draws the lock tag "System" on exactly these, and the delete refuses them (409 `SYSTEM_FIELD`). Only the two properties the rule reads are asked for, so a row of the list and a
 * field of the registry both fit.
 */
export function isProtectedField(field: { readonly systemRole: string | null; readonly key: string }): boolean {
  return field.systemRole !== null || PROTECTED_FIELD_KEYS.includes(field.key);
}
