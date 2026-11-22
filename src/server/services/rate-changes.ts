import { ConflictError, NotFoundError } from '../../lib/errors';
import { CUSTOMER_DELETED_CODE, MATERIAL_DELETED_CODE } from '../../lib/estimate/calculate-words';
import { diffRates, nothingChanged, type RateChangeCounts } from '../../lib/estimate/rate-diff';
import { isLocked } from '../../lib/estimate/state-machine';
import type { PlanCache } from '../../lib/formula';
import type { CalculationRepository, MasterSnapshot } from '../repositories/calculation-repository';
import type { EstimateRepository } from '../repositories/estimate-repository';

import { readMasters, type CalculationMasters, type DeletedWords } from './calculation-masters';
import type { ConfigVersion } from './config-service';

/**
 * How many rates changed since a calculation was made (STORY-06.08 AC-8, STORY-06.11 AC-8; architecture section 4.8): the one read the unlock preview and the Lead's "Rates changed" notice share, so the two cannot
 * disagree. It reads the masters as they are now **for the very customer, materials and rates the calculation used** (the same read Calculate makes: `readMasters`, restricted to the rates the formulas of the
 * calculation's configuration version read) and hands the stored snapshot and that one to the pure `lib/estimate/rate-diff.ts`, which answers counts by kind and nothing else (NFR-002).
 *
 * **Restricted** (ADR-008, NFR-002): it reads the rates and prices of a stored snapshot and of the masters, so it is blocked for every Engineer view (`tests/security/engineer-import-rule.test.ts`) and only
 * the two services for the Lead and the Admin call it. A customer or a material deleted since is `readMasters`' 409 in the words it is given; the notice turns that into "no notice" and the unlock into its own refusal.
 */

export interface RateChangeReads {
  readonly masters: CalculationMasters;
  /** Compiled plans by version, for the set of rates the calculation's formulas read. */
  readonly plans: PlanCache;
}

/**
 * The counts of what changed in the masters since the calculation that stored `stored` was made with `version`. Three keyed reads (the customer with its rates, every material in one statement, the exchange
 * rates) and no write.
 */
export async function countRateChanges(reads: RateChangeReads, stored: MasterSnapshot, version: Pick<ConfigVersion, 'id' | 'document'>, words?: DeletedWords): Promise<RateChangeCounts> {
  const plan = reads.plans.get(version.id, version.document.fields);
  const now = await readMasters(
    reads.masters,
    stored.customer.id,
    stored.materials.map((material) => material.id),
    plan.referencedRateIds,
    undefined,
    words,
  );
  return diffRates(stored, now.snapshot, plan.referencedRateIds);
}

/** The masters, named here so the review service names them through this file alone (see `ratesChangedSince`). */
export type { CalculationMasters } from './calculation-masters';

export interface RatesChangedReads extends RateChangeReads {
  readonly calculations: Pick<CalculationRepository, 'findMasterSnapshot'>;
  readonly estimates: Pick<EstimateRepository, 'findEstimateAccess'>;
}

/**
 * The counts for the Lead's "Rates changed" notice (STORY-06.11 AC-1, AC-3, AC-4, AC-6), or `null` when there is nothing to tell: the estimate is locked, approved or quoted (its figures stand), nothing changed in the masters the
 * calculation used, or one of them was deleted since or is missing. The caller asks only while the figures are `current`.
 *
 * **The only place the review of an estimate reads the masters, and never for an approved one.** The status is read first and an APPROVED estimate returns before the snapshot or any master is read (STORY-06.09,
 * NFR-026: an approved estimate is read from its own record alone), which `tests/unit/estimate-review-rates.test.ts` pins by counting the reads. The review service reaches the masters through this file alone, so
 * `tests/unit/approved-read-architecture.test.ts` keeps its rule that the review service imports no master reader directly.
 */
export async function ratesChangedSince(reads: RatesChangedReads, estimateId: string, calculationId: string, version: Pick<ConfigVersion, 'id' | 'document'>): Promise<RateChangeCounts | null> {
  const access = await reads.estimates.findEstimateAccess(estimateId);
  // An estimate that is not there any more is the caller's 404, not this notice's.
  if (access === null || isLocked(access.status)) return null;
  const stored = await reads.calculations.findMasterSnapshot(calculationId);
  if (stored === null) throw new Error('The calculation linked to the estimate could not be read.');
  try {
    const counts = await countRateChanges(reads, stored.masterSnapshot, version);
    return nothingChanged(counts) ? null : counts;
  } catch (error) {
    // A customer or a material that was deleted since (409) or that is not there at all (404) cannot be counted. The notice is a help beside the figures, never a reason to lose them: the page is drawn without it,
    // and Calculate or Unlock says what is wrong with the master in its own words (architecture section 4.8).
    if (error instanceof NotFoundError || (error instanceof ConflictError && (error.code === CUSTOMER_DELETED_CODE || error.code === MATERIAL_DELETED_CODE))) return null;
    throw error;
  }
}
