import { diffRates, type RateChangeCounts } from '../../lib/estimate/rate-diff';
import type { PlanCache } from '../../lib/formula';
import type { MasterSnapshot } from '../repositories/calculation-repository';

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
