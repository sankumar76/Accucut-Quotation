/**
 * The invented values that STORY-02.01 puts into the cost-confidentiality scan (AC-6; BR-003, NFR-001, NFR-002, test strategy
 * section 4): distinctive Process Master numbers and a name that no other test uses, so that finding one in what an Engineer was
 * sent can only mean a rate leaked. They follow the invented pattern `n.37` (ADR-014); none is a rate of Accucut's.
 *
 * This file is the single definition of these values. The scan of STORY-01.03 (AQP-57) imports them: `canaryMasters`
 * (`tests/support/canary-masters.ts`) takes the values and the name from here, and writes them into the Process Master of the E2E
 * database (`tests/e2e/canary-scan.spec.ts`). The interim check that STORY-02.01 shipped before the scan existed
 * (`process-master-confidential.test.ts`) was folded into `tests/security/engineer-refused-before-lookup.test.ts`, which holds the
 * same assertions for every route of the manifest, and into the scan.
 */

export const PROCESS_MASTER_CANARY_NAME = 'Canary-Process-Rate-per-Mark';

/** Distinct values, none of which any test or fixture uses elsewhere. */
export const PROCESS_MASTER_CANARY_VALUES: ReadonlyArray<string> = ['771.37', '772.37', '773.37'];

/** Everything an answer must not hold: the name and each value. */
export const PROCESS_MASTER_CANARIES: ReadonlyArray<string> = [PROCESS_MASTER_CANARY_NAME, ...PROCESS_MASTER_CANARY_VALUES];
