/**
 * The invented values that STORY-02.01 puts into the cost-confidentiality scan (AC-6; BR-003, NFR-001, NFR-002, test strategy
 * section 4): distinctive Process Master numbers and a name that no other test uses, so that finding one in what an Engineer was
 * sent can only mean a rate leaked. They follow the invented pattern `n.37` (ADR-014); none is a rate of Accucut's.
 *
 * The scan of story 01.03 (`canaryMasters`, AQP-57) takes these values from here when it lands: it owns the file that lists every
 * master's canary, and this file is what 02.01 contributes to it. Until then `tests/security/process-master-confidential.test.ts`
 * looks for them in every answer a Lead or an Engineer gets from the Process master's routes and pages.
 */

export const PROCESS_MASTER_CANARY_NAME = 'Canary-Process-Rate-per-Mark';

/** Distinct values, none of which any test or fixture uses elsewhere. */
export const PROCESS_MASTER_CANARY_VALUES: ReadonlyArray<string> = ['771.37', '772.37', '773.37'];

/** Everything an answer must not hold: the name and each value. */
export const PROCESS_MASTER_CANARIES: ReadonlyArray<string> = [PROCESS_MASTER_CANARY_NAME, ...PROCESS_MASTER_CANARY_VALUES];
