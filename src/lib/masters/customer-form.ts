import {
  customerBody,
  customerFieldProblem,
  CUSTOMER_FIELD_NAMES,
  detailChangesFrom,
  differsFromDefault,
  rateProblem,
  rateText,
  type CustomerRate,
  type CustomerValues,
} from './customers';
import type { CustomerChangesBody, CustomerRow, RateChange } from './customers-client';

/**
 * What the edit page of SCR-12 holds and checks before it sends anything (STORY-02.02 AC-1, AC-2, AC-8). Pure, so the rules are tested without a browser
 * and the page only draws. Only the shape is checked here (the server states the same rules from the same functions); whether a name is free and whether a
 * rate still exists are the server's.
 *
 * One map of messages serves the whole page: a detail field is keyed by its name (`name`, `phone`, `email`, `address`) and a rate by `rate:<Process
 * Master item ID>` (`rateErrorKey`), so the page can put each message under its own control and move focus to the first one that has a message.
 */

/** The text in each rate input, by the Process Master item's ID. */
export type RateInputs = Readonly<Record<string, string>>;

/** The messages under the controls, by `CustomerFieldName` or `rateErrorKey`. */
export type EditErrors = Readonly<Partial<Record<string, string>>>;

/** The start of the key of a rate's message; a detail field's key is its name. */
export const RATE_KEY_PREFIX = 'rate:';

export const rateErrorKey = (processItemId: string): string => `${RATE_KEY_PREFIX}${processItemId}`;

/** The rate inputs as a customer's stored values: the text the server sent. */
export function initialRateInputs(rates: ReadonlyArray<CustomerRate>): RateInputs {
  return Object.fromEntries(rates.map((rate) => [rate.processItemId, rate.value]));
}

/** The keys of every control in the order of the page (the details, then the rates in table order), so focus goes to the first one with a message. */
export function editFieldOrder(rates: ReadonlyArray<CustomerRate>): ReadonlyArray<string> {
  return [...CUSTOMER_FIELD_NAMES, ...rates.map((rate) => rateErrorKey(rate.processItemId))];
}

/** The messages for what was typed: the four details, and each rate against its own unit (a whole number for a percent rate). */
export function customerEditProblems(values: CustomerValues, rates: ReadonlyArray<CustomerRate>, inputs: RateInputs): EditErrors {
  const found: Record<string, string> = {};
  for (const field of CUSTOMER_FIELD_NAMES) {
    const problem = customerFieldProblem(field, values[field]);
    if (problem !== null) found[field] = problem;
  }
  for (const rate of rates) {
    const problem = rateProblem(inputs[rate.processItemId] ?? '', rate.unit);
    if (problem !== null) found[rateErrorKey(rate.processItemId)] = problem;
  }
  return found;
}

/** The rates whose typed value differs from the customer's, as the PATCH sends them. Call it only when `customerEditProblems` found nothing. */
export function changedRateInputs(rates: ReadonlyArray<CustomerRate>, inputs: RateInputs): ReadonlyArray<RateChange> {
  return rates.flatMap((rate) => {
    const typed = inputs[rate.processItemId];
    return typed !== undefined && rateText(typed) !== rateText(rate.value) ? [{ processItemId: rate.processItemId, value: rateText(typed) }] : [];
  });
}

/** What the person changed on the page; an empty object for nothing. Spaces around a detail do not count. */
export function customerEditChanges(original: CustomerRow, values: CustomerValues, inputs: RateInputs): CustomerChangesBody {
  const details = detailChangesFrom(original, customerBody(values));
  const rates = changedRateInputs(original.rates, inputs);
  return rates.length > 0 ? { ...details, rates } : details;
}

/** The server's messages for the controls this page has: a detail field by name, and `rates.<index>.value` as the rate it was the index of in what was sent. */
export function serverEditErrors(fields: Readonly<Record<string, string>>, sent: ReadonlyArray<RateChange> = []): EditErrors {
  const found: Record<string, string> = {};
  for (const [field, message] of Object.entries(fields)) {
    const index = /^rates\.(\d+)\.value$/.exec(field)?.[1];
    const rate = index === undefined ? undefined : sent[Number(index)];
    if (rate !== undefined) found[rateErrorKey(rate.processItemId)] = message;
    else if (CUSTOMER_FIELD_NAMES.some((name) => name === field)) found[field] = message;
  }
  return found;
}

/** The errors without the one for `key`, once the person has changed that control. */
export function withoutEditError(errors: EditErrors, key: string): EditErrors {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== key));
}

/** Does the rate, as typed, differ from its default? A value that is not a number yet is judged by what the server holds. */
export function typedDiffers(rate: CustomerRate, typed: string | undefined): boolean {
  if (typed === undefined || rateProblem(typed, rate.unit) !== null) return differsFromDefault(rate);
  return differsFromDefault({ defaultValue: rate.defaultValue, value: typed });
}
