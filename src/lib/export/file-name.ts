import { istDayMonthYearOf } from '../time';

/**
 * The name of the exported workbook (CR-01 item 9, AQP-391; architecture section 4.11 c; replaces FR-071): `<Customer Short Name>_<Subject>_<DD-MM-YYYY>.xlsx`, for example
 * `MAS_Feed-hopper_21-11-2026.xlsx`, **in full: it is never cut** (OQ-PM-11, answered by the delivery lead: "Don't limit the characters"). The date is the IST date of the download.
 *
 * Pure, so the browser and the server share it, and it is the **only** place the name is made. Both parts are typed by a person, so each is cleaned before it reaches a header (and a file system):
 * Unicode NFC; every whitespace character and each of `/ \ : * ? " < > |` becomes one hyphen (runs are not collapsed, the rule is literal); control, format (bidirectional overrides, zero-width), lone
 * surrogate and other default-ignorable (invisible) characters are removed; each leading dot of the short name becomes a hyphen. Letters, digits, `_`, `-`, `.` and non-ASCII letters are kept. `isExportFileName` is the one check of a finished name, used wherever a name is read back.
 */

/** What the short name is when there is none, or nothing of it is left after the clean-up. */
export const CUSTOMER_FALLBACK = 'Customer';

const FILE_NAME_EXTENSION = '.xlsx';
const PART_SEPARATOR = '_';
/** Whitespace and the characters a file system or a path would give a meaning to; each becomes one hyphen. */
const TO_HYPHEN = /[\s/\\:*?"<>|]/gu;
/**
 * Control characters, format characters (bidirectional overrides, zero-width), lone surrogates and the other default-ignorable characters (Hangul fillers U+3164, the combining grapheme joiner,
 * variation selectors, which Cf does not cover and which draw nothing, so a part made of them would look empty); each is removed.
 */
const REMOVED = /[\p{Cc}\p{Cf}\p{Cs}\p{Default_Ignorable_Code_Point}]/gu;
/** What a finished stem must never hold: whitespace, the reserved characters of `TO_HYPHEN`, and every character `REMOVED` removes. `;`, `'`, `%` and the like are allowed in a name: the header builder encodes them. */
const REFUSED_IN_STEM = /[\s/\\:*?"<>|\p{Cc}\p{Cf}\p{Cs}\p{Default_Ignorable_Code_Point}]/u;
/** A name that starts with a dot is a hidden file on macOS, Linux and Android, and Chromium trims leading dots, so the saved name would differ from the one on the card. */
const LEADING_DOTS = /^\.+/u;

/** One typed part, cleaned as the module comment says. May be empty. */
function cleanPart(text: string | null): string {
  return (text ?? '').normalize('NFC').replace(TO_HYPHEN, '-').replace(REMOVED, '');
}

export interface ExportFileNameInput {
  /** The customer's short name (AQP-390), or `null` while the estimate has no customer or the customer has none. */
  readonly customerShortName: string | null;
  /** The task's subject (AQP-390), or `null` for a task that has none. */
  readonly subject: string | null;
  /** The task code, `Q-2026-0001`. It stands in for a missing subject and is cleaned like one. */
  readonly taskCode: string;
  /** The moment of the download: the date in the name is its IST date. */
  readonly now: Date;
}

export function exportFileName({ customerShortName, subject, taskCode, now }: ExportFileNameInput): string {
  // Each leading dot of the short name (the start of the name) becomes one hyphen, the rule of the other reserved characters; a dot at the start of the subject sits after the separator and is harmless.
  const shortName = cleanPart(customerShortName).replace(LEADING_DOTS, (dots) => '-'.repeat(dots.length)) || CUSTOMER_FALLBACK;
  const subjectOrCode = cleanPart(subject) || cleanPart(taskCode);
  if (subjectOrCode === '') throw new RangeError('exportFileName needs a subject or a usable task code.');
  return `${shortName}${PART_SEPARATOR}${subjectOrCode}${PART_SEPARATOR}${istDayMonthYearOf(now)}${FILE_NAME_EXTENSION}`;
}

/**
 * Whether a name is one the export could have made: ends `.xlsx`, a non-empty stem that does not start with a dot, and no whitespace, control, format, invisible or reserved character in it.
 * There is no length limit (OQ-PM-11: "Don't limit the characters"); the name is bounded only by the form limits of the fields it is made of: the short name (10) and the subject (80) plus 17 characters
 * (two separators, the date and `.xlsx`), so at most 107 characters, inside the 255 of Windows (`tests/unit/limits-single-source.test.ts` keeps that true, in the UTF-16 worst case as well). The one check
 * for the server's schemas, the header builder and the browser's reading of the header.
 */
export function isExportFileName(name: string): boolean {
  if (!name.endsWith(FILE_NAME_EXTENSION)) return false;
  const stem = name.slice(0, -FILE_NAME_EXTENSION.length);
  return stem !== '' && !REFUSED_IN_STEM.test(stem) && !LEADING_DOTS.test(stem);
}
