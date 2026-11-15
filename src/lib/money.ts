/**
 * How a stored figure is written on a screen (STORY-06.02; FR-027, SPEC section 8.2; UX spec 6.0 "Figures"): two decimals, a tie rounded away from zero as Excel does, Indian
 * grouping (12,34,567.89) and a dash for no figure. It works on the stored decimal **text** with whole-number arithmetic, so no JavaScript number takes part (ADR-005) and it
 * carries no decimal library, which keeps it light enough for a client script. It holds no figure itself.
 */

/** What a person sees where a figure cannot be worked out (the same dash as `NO_FIGURE_TEXT` of the calculator, which a client file may not import). */
export const NO_FIGURE = '—';

/** The rupee sign and a space, as the tiles and the table print it. */
export const RUPEE_PREFIX = '₹ ';

const DECIMAL_TEXT = /^(-?)(\d+)(?:\.(\d+))?$/;
const PLACES = 2;
const FIRST_DIGIT_THAT_ROUNDS_UP = '5'.charCodeAt(0);
const INDIAN_LAST_GROUP = 3;
const INDIAN_GROUP = 2;

/** Groups the digits of a whole number the Indian way: the last three together, then pairs (`1234567` is `12,34,567`). */
export function groupIndian(digits: string): string {
  if (digits.length <= INDIAN_LAST_GROUP) return digits;
  const head = digits.slice(0, -INDIAN_LAST_GROUP);
  const pairs: string[] = [];
  for (let end = head.length; end > 0; end -= INDIAN_GROUP) pairs.unshift(head.slice(Math.max(0, end - INDIAN_GROUP), end));
  return `${pairs.join(',')},${digits.slice(-INDIAN_LAST_GROUP)}`;
}

/** The text of a stored decimal, or `null` when it is not one (a stored figure always is; a value that is not is shown as no figure and never thrown on a screen). */
function parts(text: string): { readonly negative: boolean; readonly whole: string; readonly fraction: string } | null {
  const match = DECIMAL_TEXT.exec(text.trim());
  if (match === null) return null;
  return { negative: match[1] === '-', whole: match[2] ?? '0', fraction: match[3] ?? '' };
}

/** A stored decimal rounded half away from zero to two places, as plain text (`1234.565` gives `1234.57`), or `null` when the text is no decimal. */
export function toTwoPlaces(text: string): string | null {
  const found = parts(text);
  if (found === null) return null;
  const kept = BigInt(`${found.whole}${found.fraction.slice(0, PLACES).padEnd(PLACES, '0')}`);
  const roundsUp = found.fraction.length > PLACES && found.fraction.charCodeAt(PLACES) >= FIRST_DIGIT_THAT_ROUNDS_UP;
  const rounded = roundsUp ? kept + 1n : kept;
  const digits = rounded.toString().padStart(PLACES + 1, '0');
  const written = `${digits.slice(0, -PLACES)}.${digits.slice(-PLACES)}`;
  return found.negative && rounded !== 0n ? `-${written}` : written;
}

/** A figure as a screen prints it: two decimals with Indian grouping (`12,34,567.89`), or a dash for no figure (`null`, or text that is no decimal). */
export function formatFigure(text: string | null): string {
  const rounded = text === null ? null : toTwoPlaces(text);
  if (rounded === null) return NO_FIGURE;
  const sign = rounded.startsWith('-') ? '-' : '';
  const [whole = '0', fraction = '00'] = rounded.replace('-', '').split('.');
  return `${sign}${groupIndian(whole)}.${fraction}`;
}

/** A figure in rupees (`₹ 12,34,567.89`), or a dash. */
export function formatRupees(text: string | null): string {
  const figure = formatFigure(text);
  return figure === NO_FIGURE ? NO_FIGURE : `${RUPEE_PREFIX}${figure}`;
}

/** A count as typed, without the trailing zeros of its stored form (`24.00` is `24`, `2.50` is `2.5`), grouped the Indian way, or a dash when there is none. */
export function formatCount(text: string | null): string {
  const found = text === null ? null : parts(text);
  if (found === null) return NO_FIGURE;
  const fraction = found.fraction.replace(/0+$/, '');
  const whole = groupIndian(found.whole.replace(/^0+(?=\d)/, ''));
  return `${found.negative ? '-' : ''}${whole}${fraction === '' ? '' : `.${fraction}`}`;
}
