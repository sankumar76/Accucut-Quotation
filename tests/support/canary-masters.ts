import { Decimal } from 'decimal.js';

import { SEED_PROCESS_ITEMS } from '../../prisma/seed/config/seed-ids';

import { PROCESS_MASTER_CANARIES, PROCESS_MASTER_CANARY_NAME, PROCESS_MASTER_CANARY_VALUES } from './process-master-canary';

/**
 * `canaryMasters` (STORY-01.03 T1, AC-3, AC-6; ADR-008 layer 5; test strategy section 6): one invented sentinel for every
 * Restricted value of the product, each with a rare digit pattern, and the list of everything an Engineer must never be sent.
 *
 * Every value is invented (ADR-014): none is a rate of Accucut's and none comes from the sample workbook. A sentinel has at
 * least three digits before the point and ends `.37` or `.73`, a pattern no screen, style or script of the portal prints
 * for another reason, so finding one in what an Engineer was sent can only mean a rate leaked. Its two-decimal form is
 * itself rare, because a sentinel already has two decimals (a four-decimal sentinel such as 7.7373 would round to the
 * common-looking 7.74 and raise false alarms).
 *
 * How a later story extends it (AC-6, sprint plan cross-cutting rule 3): a story that adds a Restricted table adds its
 * sentinels to its own group below, in the same change, and the scan then looks for them in everything an Engineer is
 * sent. Nothing else changes: the scan iterates the route manifest, so a new Engineer route is covered with no edit to
 * the scanner. The Process Master's values and name are NOT defined here: `process-master-canary.ts` (STORY-02.01) is
 * their single definition, and this file takes them from it (AQP-57, comment 11141).
 */

export type RestrictedKind = 'process-rate' | 'customer-rate' | 'material-price' | 'specific-gravity' | 'scrap-rate' | 'exchange-rate';

/** One Restricted value with a sentinel for it. `value` is plain decimal text, as the database would hold it. */
export interface CanarySentinel {
  readonly kind: RestrictedKind;
  readonly label: string;
  readonly value: string;
}

/** The rare pattern every sentinel follows: three or more digits before the point and `.37` or `.73` after it. */
export const SENTINEL_PATTERN = /^\d{3,}\.(37|73)$/;

const sentinels = (kind: RestrictedKind, label: string, values: ReadonlyArray<string>): ReadonlyArray<CanarySentinel> =>
  values.map((value, index) => ({ kind, label: `${label} ${index + 1}`, value }));

/**
 * The Process Master canary rates, by name. The first is the name that STORY-02.01 defines; the other two are the same name
 * with a suffix, so a search for the name finds all three.
 */
export const PROCESS_CANARY_RATES: ReadonlyArray<{ readonly name: string; readonly unit: string; readonly value: string }> =
  PROCESS_MASTER_CANARY_VALUES.map((value, index) => ({
    name: index === 0 ? PROCESS_MASTER_CANARY_NAME : `${PROCESS_MASTER_CANARY_NAME}-${String.fromCharCode('A'.charCodeAt(0) + index)}`,
    unit: 'per kg',
    value,
  }));

/**
 * A sentinel for each of the 15 seed Process Master rates (test strategy section 6: "all 15 seed items,
 * `Plating-rate-per-sqin` included"). Unique, and none is one of the STORY-02.01 canary values. The calculation journeys of
 * the later stories write them into the rates before they calculate; the live scan of this story writes only the three
 * STORY-02.01 canary rates, so the seed rows other specs read keep their value of 0.
 */
export const SEED_RATE_SENTINELS: ReadonlyArray<{ readonly id: string; readonly name: string; readonly value: string }> = SEED_PROCESS_ITEMS.map(
  (item, index) => ({ id: item.id, name: item.name, value: `${601 + index * 3}.37` }),
);

/**
 * Every Restricted value and its sentinel. Customers, materials and the exchange rate have no table yet (stories 02.02 to
 * 02.05 add them); their sentinels are listed already so the forbidden list and the scan are complete from the first
 * Engineer route, and each of those stories adds the loader that writes its sentinels into its table.
 */
export const canaryMasters: ReadonlyArray<CanarySentinel> = [
  ...SEED_RATE_SENTINELS.map((rate): CanarySentinel => ({ kind: 'process-rate', label: `Process rate ${rate.name}`, value: rate.value })),
  ...sentinels('process-rate', 'Process master canary rate', PROCESS_MASTER_CANARY_VALUES),
  ...sentinels('customer-rate', 'Customer rate', ['881.37', '882.37']),
  // A six-digit and a seven-digit price, so the lakh and crore groupings of Indian number format are exercised.
  ...sentinels('material-price', 'Material price', ['917373.37', '9173737.73']),
  ...sentinels('specific-gravity', 'Specific gravity', ['737.37']),
  ...sentinels('scrap-rate', 'Material scrap rate', ['717.37']),
  ...sentinels('exchange-rate', 'Exchange rate', ['838.37', '839.73']),
];

/**
 * The one value the test-only route `/api/test-only/leak` leaks (AC-4). It is no Restricted value and appears in no list of
 * `canaryMasters`: it is a planted leak, there to be found, supplied to the route through the environment
 * (`CANARY_NEGATIVE_CONTROL`) so the source and the build never hold it.
 */
export const NEGATIVE_CONTROL_SENTINEL = '9393.37';

/**
 * Names that mean a rate or a formula operand, and fragments of formula text. A word like "cost" is allowed (the About page
 * says it, SCR-24); these are the names a person would only see in a cost view.
 */
const RATE_AND_OPERAND_NAMES: ReadonlyArray<string> = [
  ...SEED_PROCESS_ITEMS.map((item) => item.name),
  ...PROCESS_CANARY_RATES.map((rate) => rate.name),
  'Material-Price',
  'Material-Specific-Gravity',
  'Material-Scrap-Rate',
  'ExchangeRate-',
];

/** The markers of a formula stored in its internal form (architecture section 4.5). */
const FORMULA_MARKERS: ReadonlyArray<string> = ['{{f:', '{{rate:', '{{mat:', '{{fx:'];

export interface ForbiddenString {
  readonly text: string;
  /** What finding it would mean, for the failure message. */
  readonly reason: string;
}

function groupDigits(integerPart: string, groupSizes: ReadonlyArray<number>): string {
  const [firstSize = 3, ...rest] = groupSizes;
  if (integerPart.length <= firstSize) return integerPart;
  const groups: string[] = [integerPart.slice(-firstSize)];
  let remaining = integerPart.slice(0, -firstSize);
  const repeat = rest[0] ?? firstSize;
  while (remaining.length > repeat) {
    groups.unshift(remaining.slice(-repeat));
    remaining = remaining.slice(0, -repeat);
  }
  if (remaining.length > 0) groups.unshift(remaining);
  return groups.join(',');
}

/** `1234567.37` as `12,34,567.37`: the last three digits, then pairs (Indian number format). */
export function indianGrouping(plain: string): string {
  const [integerPart = '', fraction] = plain.split('.');
  const grouped = groupDigits(integerPart, [3, 2]);
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/** `1234567.37` as `1,234,567.37`: the usual groups of three. */
export function westernGrouping(plain: string): string {
  const [integerPart = '', fraction] = plain.split('.');
  const grouped = groupDigits(integerPart, [3, 3]);
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/** The forms a number can take on a screen: plain digits, two decimals, Indian grouping and the usual grouping of three. */
export function variantsOf(value: string): ReadonlyArray<{ readonly text: string; readonly form: string }> {
  const twoDecimals = new Decimal(value).toFixed(2);
  const candidates = [
    { text: value, form: 'plain digits' },
    { text: twoDecimals, form: 'two-decimal form' },
    { text: indianGrouping(twoDecimals), form: 'Indian grouping' },
    { text: westernGrouping(twoDecimals), form: 'grouping of three' },
  ];
  const seen = new Set<string>();
  return candidates.filter((candidate) => (seen.has(candidate.text) ? false : Boolean(seen.add(candidate.text))));
}

/** What the negative control must be found by: its sentinel in the same forms as any other. */
export function negativeControlForbidden(): ReadonlyArray<ForbiddenString> {
  return variantsOf(NEGATIVE_CONTROL_SENTINEL).map(({ text, form }) => ({ text, reason: `negative-control sentinel (${form})` }));
}

/**
 * Everything an Engineer must never be sent (test strategy section 6, "Forbidden list"): each sentinel in each form, the
 * rate and operand names, the formula markers, and any formula text the caller passes (the scan reads the stored registry).
 * The Process Master's own canary strings are included verbatim, so what STORY-02.01 forbids is forbidden here too.
 */
export function forbiddenStrings(formulaTexts: ReadonlyArray<string> = [], masters: ReadonlyArray<CanarySentinel> = canaryMasters): ReadonlyArray<ForbiddenString> {
  const list: ForbiddenString[] = [
    ...masters.flatMap((sentinel) => variantsOf(sentinel.value).map(({ text, form }) => ({ text, reason: `${sentinel.label} (${form})` }))),
    ...PROCESS_MASTER_CANARIES.map((text) => ({ text, reason: 'Process Master canary (STORY-02.01)' })),
    ...RATE_AND_OPERAND_NAMES.map((text) => ({ text, reason: 'rate or operand name' })),
    ...FORMULA_MARKERS.map((text) => ({ text, reason: 'formula marker' })),
    // Only a formula that refers to something is worth finding. A constant such as the Rejection's `0` is no secret and would match any digit.
    ...formulaTexts.filter((text) => text.includes(FORMULA_MARKERS[0] ?? '{{')).map((text) => ({ text, reason: 'formula text' })),
  ];
  const seen = new Set<string>();
  return list.filter((entry) => entry.text.length > 0 && (seen.has(entry.text) ? false : Boolean(seen.add(entry.text))));
}
