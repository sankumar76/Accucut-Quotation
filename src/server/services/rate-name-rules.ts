import { FieldValidationError, NAME_REFUSED_CODE, NAME_TAKEN_CODE } from '../../lib/errors';
import { fieldsBrokenByChange } from '../../lib/fields/formula-round-trip';
import type { ConfigDocument } from '../../lib/fields/schema';
import { ambiguousRateNames, RATE_SET_AMBIGUOUS_MESSAGE, rateNameIssues, type RateReference } from '../../lib/formula';
import { NAME_TAKEN_MESSAGE, ROUND_TRIP_MESSAGE } from '../../lib/masters/process-items';

/**
 * What decides whether a rate may have a name (STORY-02.01 AC-2, AC-3; DEF-006 and GitHub #49; QLT-01, QLT-15 and QLT-17 of the G6 of
 * AQP-113). A rate's name is used in display form, where a formula is read longest name first and never backs up, so a name can make a
 * stored formula come back as different rates. Four questions are asked in order, and the first "no" is the answer:
 *
 *   1. Does another rate already have this name, ignoring letter case (AC-2)?
 *   2. Can the name itself be read as column letters, numbers, operators or other rate names (`rateNameIssues`)?
 *   3. Does the change make a name of the set ambiguous that was not (`ambiguousRateNames`, before against after: a set that was
 *      already unsafe does not refuse every later change)? Guards for the formulas that are not written yet.
 *   4. **Does any formula the configuration stores stop coming back unchanged from its display form** under the names the change
 *      would leave (`fieldsBrokenByChange`)? This asks the question of the formulas that exist, and it is the property that matters:
 *      no rule about names alone can be both complete and free of false refusals. Again a formula that was already broken is not
 *      the change's doing.
 *
 * Every refusal is a 422 on the `name` field with `RATE_NAME_REFUSED` or `NAME_TAKEN`, and none of the messages names a rate or a
 * formula (STD-05). Pure: it reads nothing, and the service passes it what it read before the transaction and under the table lock.
 */

/** A rate that is not stored yet has no ID; formulas cannot refer to it, so any ID that no formula holds will do. */
const NEW_RATE_ID = '00000000-0000-4000-8000-0fffffffffff';

/** A change to the rate names: the new name, every other rate, the rate being renamed (null for an add), and the configuration. */
export interface NameChange {
  readonly name: string;
  /** Every rate except the one being changed. */
  readonly others: ReadonlyArray<RateReference>;
  /** The rate being renamed, as it is now; null when the rate is being added. */
  readonly renamed: RateReference | null;
  /** The configuration the formulas are read from: the current version, read before the transaction opened. */
  readonly document: ConfigDocument;
}

function refusal(message: string, code: string): FieldValidationError {
  return new FieldValidationError([{ field: 'name', message }], { code });
}

function namesOf(rates: ReadonlyArray<RateReference>): string[] {
  return rates.map((rate) => rate.name);
}

/** Throws unless the new name may be used. See the four questions above. */
export function assertNameUsable({ name, others, renamed, document }: NameChange): void {
  const otherNames = namesOf(others);
  const lower = name.toLowerCase();
  if (otherNames.some((other) => other.toLowerCase() === lower)) throw refusal(NAME_TAKEN_MESSAGE, NAME_TAKEN_CODE);
  const [own] = rateNameIssues(name, otherNames);
  if (own !== undefined) throw refusal(own.message, NAME_REFUSED_CODE);

  const before = renamed === null ? others : [...others, renamed];
  const after = [...others, { id: renamed?.id ?? NEW_RATE_ID, name }];
  const wasAmbiguous = new Set(ambiguousRateNames(namesOf(before)));
  if (ambiguousRateNames(namesOf(after)).some((ambiguous) => !wasAmbiguous.has(ambiguous))) throw refusal(RATE_SET_AMBIGUOUS_MESSAGE, NAME_REFUSED_CODE);
  if (fieldsBrokenByChange(document, before, after).length > 0) throw refusal(ROUND_TRIP_MESSAGE, NAME_REFUSED_CODE);
}
