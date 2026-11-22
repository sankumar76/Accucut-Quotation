import { istDayMonthYearOf } from '../time';

/**
 * The name of the exported workbook (CR-01 item 9, AQP-391; architecture section 4.11 c; replaces FR-071): `<Customer Short Name>_<Subject>_<DD-MM-YYYY>.xlsx`, for example
 * `MAS_Feed-hopper_21-11-2026.xlsx`. The date is the IST date of the download.
 *
 * Pure, so the browser and the server share it, and it is the **only** place the name is made. Both parts are typed by a person, so each is cleaned before it reaches a header (and a file system):
 * Unicode NFC; every whitespace character and each of `/ \ : * ? " < > |` becomes one hyphen (runs are not collapsed, the rule is literal); control, format (bidirectional overrides, zero-width), lone
 * surrogate and other default-ignorable (invisible) characters are removed; each leading dot of the short name becomes a hyphen. Letters, digits, `_`, `-`, `.` and non-ASCII letters are kept. `isExportFileName` is the one check of a finished name, used wherever a name is read back.
 */

/** The longest stem of a file name, everything before `.xlsx`, counted in Unicode code points. Never stored, so no database ceiling follows from it. */
export const EXPORT_FILE_NAME_STEM_MAX_LENGTH = 100;

/** What the short name is when there is none, or nothing of it is left after the clean-up. */
export const CUSTOMER_FALLBACK = 'Customer';

const FILE_NAME_EXTENSION = '.xlsx';
const PART_SEPARATOR = '_';
/** `DD-MM-YYYY`. */
const DATE_LENGTH = 10;
/** What is in the stem besides the two parts: the two separators and the date. */
const FIXED_STEM_LENGTH = 2 * PART_SEPARATOR.length + DATE_LENGTH;
/** The subject always keeps at least this much room, so the name never holds an empty part (a short name so long that nothing is left for it is cut instead). */
const MIN_SUBJECT_LENGTH = 1;

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

const codePointsOf = (text: string): string[] => Array.from(text);
const cut = (text: string, length: number): string => codePointsOf(text).slice(0, length).join('');

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

/**
 * Fits the two parts in the stem so the stem is at most `EXPORT_FILE_NAME_STEM_MAX_LENGTH` code points. **What is cut is the end of the subject**, so the short name and the date always survive
 * (working reading of "cut at 100", A-CR01-A3 / OQ-PM-11, to be confirmed with the customer: a literal cut of the joined name would drop part of the date). This one function is the place to change
 * if the reading changes. The subject's budget is the limit minus the short name minus the separators and the date; a short name so long that no room is left for a subject is itself cut, so the
 * subject keeps one character and neither part is ever empty.
 */
function fitParts(shortName: string, subject: string): { readonly shortName: string; readonly subject: string } {
  const fittedShortName = cut(shortName, EXPORT_FILE_NAME_STEM_MAX_LENGTH - FIXED_STEM_LENGTH - MIN_SUBJECT_LENGTH);
  const subjectBudget = EXPORT_FILE_NAME_STEM_MAX_LENGTH - FIXED_STEM_LENGTH - codePointsOf(fittedShortName).length;
  return { shortName: fittedShortName, subject: cut(subject, subjectBudget) };
}

export function exportFileName({ customerShortName, subject, taskCode, now }: ExportFileNameInput): string {
  // Each leading dot of the short name (the start of the name) becomes one hyphen, the rule of the other reserved characters; a dot at the start of the subject sits after the separator and is harmless.
  const shortName = cleanPart(customerShortName).replace(LEADING_DOTS, (dots) => '-'.repeat(dots.length)) || CUSTOMER_FALLBACK;
  const subjectOrCode = cleanPart(subject) || cleanPart(taskCode);
  if (subjectOrCode === '') throw new RangeError('exportFileName needs a subject or a usable task code.');
  const fitted = fitParts(shortName, subjectOrCode);
  return `${fitted.shortName}${PART_SEPARATOR}${fitted.subject}${PART_SEPARATOR}${istDayMonthYearOf(now)}${FILE_NAME_EXTENSION}`;
}

/**
 * Whether a name is one the export could have made: ends `.xlsx`, a stem of 1 to `EXPORT_FILE_NAME_STEM_MAX_LENGTH` code points that does not start with a dot, and no whitespace, control, format, invisible or reserved character in it.
 * The one check for the server's schemas, the header builder and the browser's reading of the header.
 */
export function isExportFileName(name: string): boolean {
  if (!name.endsWith(FILE_NAME_EXTENSION)) return false;
  const stem = name.slice(0, -FILE_NAME_EXTENSION.length);
  const length = codePointsOf(stem).length;
  return length >= 1 && length <= EXPORT_FILE_NAME_STEM_MAX_LENGTH && !REFUSED_IN_STEM.test(stem) && !LEADING_DOTS.test(stem);
}
