import { Decimal } from '../decimal';

/**
 * What has changed in the masters since a calculation was made (STORY-06.08 AC-8; architecture sections 4.2 and 4.8): the unlock preview of SCR-09 now, and the Lead's rate notice of SCR-06 (STORY-06.11)
 * later. Pure code with no I/O: it compares two snapshots in the shape `calculations.master_snapshot` has, the one the calculation stored and one made from the masters as they are now, and answers **counts by kind
 * and nothing else**. No old or new value leaves it, so a caller cannot pass one on by mistake (NFR-002).
 *
 * **What it compares** is only what that calculation used. Rates are restricted to `referencedRateIds`, the set the formulas of the calculation's configuration version read (`CompiledPlan.referencedRateIds`), so a
 * record of either snapshot shape counts the same: an older record keeps every rate of the customer, and one that no formula reads must not count (architecture section 4.2, GitHub issue 432). Materials are the ones the
 * calculation stored, and the two exchange rates are always compared. A formula or a configuration change is not a rate and is not compared (A-34).
 *
 * **Changed means a different number**, compared as decimals, so `21.30` and `21.3` are the same and a master that was saved again with the same value counts for nothing. A value that is there now and was not then
 * (or the other way round) is a change. A rate counts once, a material counts once whichever of its three numbers changed, and each of the two exchange rates counts once.
 */

/** A value of a snapshot as decimal text, the way the calculation stored it. */
interface RateEntry {
  readonly id: string;
  readonly value: string;
}

interface MaterialEntry {
  readonly id: string;
  readonly pricePerKg: string;
  readonly specificGravity: string;
  readonly scrapRate: string;
}

/** The part of a master snapshot the comparison reads. A full `MasterSnapshot` fits it. */
export interface RateDiffSnapshot {
  readonly rates: ReadonlyArray<RateEntry>;
  readonly materials: ReadonlyArray<MaterialEntry>;
  readonly exchangeRates: { readonly usd: string | null; readonly eur: string | null };
}

/** How many entries of each kind changed. Counts only, by kind. */
export interface RateChangeCounts {
  /** Process rates (the customer's value of a rate a formula reads). */
  readonly processRates: number;
  /** Materials whose price, specific gravity or scrap rate changed. */
  readonly materialPrices: number;
  /** The exchange rates (US dollar, euro), each counted once. */
  readonly exchangeRates: number;
}

/** True when both are missing, or both are the same number. Text that is not a number is compared as text, so a malformed value can only ever count as a change. */
function sameValue(then: string | null | undefined, now: string | null | undefined): boolean {
  if (then === null || then === undefined || now === null || now === undefined) return (then ?? null) === (now ?? null);
  try {
    return new Decimal(then).eq(new Decimal(now));
  } catch {
    return then === now;
  }
}

const byLowerId = <T extends { readonly id: string }>(entries: ReadonlyArray<T>): Map<string, T> => new Map(entries.map((entry) => [entry.id.toLowerCase(), entry]));

function changedRates(then: RateDiffSnapshot, now: RateDiffSnapshot, referencedRateIds: ReadonlyArray<string>): number {
  const before = byLowerId(then.rates);
  const after = byLowerId(now.rates);
  // Each referenced rate once, whatever the order or the letter case of the IDs it was given in.
  const referenced = new Set(referencedRateIds.map((id) => id.toLowerCase()));
  let changed = 0;
  for (const id of referenced) if (!sameValue(before.get(id)?.value, after.get(id)?.value)) changed += 1;
  return changed;
}

function changedMaterials(then: RateDiffSnapshot, now: RateDiffSnapshot): number {
  const after = byLowerId(now.materials);
  return [...byLowerId(then.materials)].filter(([id, before]) => {
    const current = after.get(id);
    // A material the calculation used that has no value now is a change (the caller refuses a deleted one before it asks).
    return current === undefined || !sameValue(before.pricePerKg, current.pricePerKg) || !sameValue(before.specificGravity, current.specificGravity) || !sameValue(before.scrapRate, current.scrapRate);
  }).length;
}

function changedExchangeRates(then: RateDiffSnapshot, now: RateDiffSnapshot): number {
  return [sameValue(then.exchangeRates.usd, now.exchangeRates.usd), sameValue(then.exchangeRates.eur, now.exchangeRates.eur)].filter((same) => !same).length;
}

/**
 * Compares the snapshot a calculation stored (`then`) with one made from the masters as they are now (`now`), for the entries that calculation used, and counts what changed by kind.
 * `referencedRateIds` is the set of rate IDs the formulas of the calculation's configuration version read.
 */
export function diffRates(then: RateDiffSnapshot, now: RateDiffSnapshot, referencedRateIds: ReadonlyArray<string>): RateChangeCounts {
  return { processRates: changedRates(then, now, referencedRateIds), materialPrices: changedMaterials(then, now), exchangeRates: changedExchangeRates(then, now) };
}

/** True when nothing of any kind changed: the preview then says "Nothing has changed ... since approval." */
export const nothingChanged = (counts: RateChangeCounts): boolean => counts.processRates === 0 && counts.materialPrices === 0 && counts.exchangeRates === 0;
