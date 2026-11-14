import { DECIMAL_TEXT_PATTERN, normaliseDecimalText } from '../masters/master-rules';

/**
 * The rule of one value typed into the part form (STORY-05.03 AC-4; SPEC section 7.3; architecture sections 4.8 and 8), read by the browser (to show the message
 * under the field and keep the typed text) and by the server (the only place that decides). Pure, with no zod, so the page does not carry it (NFR-009).
 *
 *   - **A blank is allowed while saving.** It clears the value: a value that is not there is not stored, so a part with nothing typed is `EMPTY`. That every
 *     input is filled is a check of Calculate (STORY-05.09), not of a save.
 *   - **A number** is digits with up to two decimals and no sign, separator or exponent (the API takes plain decimals only). It is stored as text with exactly two
 *     decimals and no leading zeros (`12.5` is `12.50`, `003.37` is `3.37`), so two spellings of one number are one stored value and a repeated save changes
 *     nothing (architecture section 4.8). It is never a JavaScript number.
 *   - **A text** is trimmed, at most `MAX_PART_TEXT_LENGTH` characters, and holds no control character (a line break only in a multi-line field).
 *     It is kept as typed otherwise: a text that starts with `=` is a value, and neutralising it for a spreadsheet is the export's job (STORY-08).
 */

/** The 422 and the field message of a number that is not 0 or more with up to 2 decimals (UX spec SCR-05 "Fields"). */
export const NUMBER_RULE_MESSAGE = 'Enter 0 or more, with up to 2 decimals.';

/** The most digits before the point (the shape of `DECIMAL_TEXT_PATTERN`, which keeps a value inside its column). */
export const MAX_NUMBER_DIGITS = 12;
export const NUMBER_TOO_LARGE_MESSAGE = `Use ${MAX_NUMBER_DIGITS} digits or fewer before the point.`;
const TOO_MANY_DIGITS = new RegExp(`^\\d{${MAX_NUMBER_DIGITS + 1},}(?:\\.\\d{1,2})?$`);

/**
 * The longest typed text of a part (Part No., Description, and the texts of the sections after them). An assumption, as the registry's own limit for a label is
 * 200 and no source gives a longer one: it bounds the row of `estimate_nodes.inputs` and what a tree and an export carry.
 */
export const MAX_PART_TEXT_LENGTH = 200;
export const TEXT_TOO_LONG_MESSAGE = `Use ${MAX_PART_TEXT_LENGTH} characters or fewer.`;
export const TEXT_CHARACTERS_MESSAGE = 'Use letters, numbers and punctuation only.';

/** The result of reading one typed value: the text to store (`null`: nothing, the value is cleared), or the words to show under the field. */
export type InputCheck = { readonly ok: true; readonly value: string | null } | { readonly ok: false; readonly message: string };

/**
 * Every control character (Unicode category Cc: C0, DEL and C1), every **format** character (Cf: the zero-width characters U+200B to U+200F, U+061C, U+2060 to U+2064, U+FEFF,
 * the bidirectional overrides, embeddings and isolates, the soft hyphen) and the line and paragraph separators (Zl, Zp). They are invisible or reorder what is shown, so a part number
 * could display other than it is stored (reviews SQR-04 and the security review). There is **no exception**: the zero-width joiner and non-joiner (U+200D, U+200C), which some Indian
 * scripts need, are blocked too, as no source asks for them. **Assumption, to be confirmed by the product owner if a script needs them.** A line feed is let through by the
 * multi-line rule below, after a carriage return is folded into it.
 */
const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const LINE_BREAKS = /\r\n?/g;
const LINE_FEED = /\n/g;

/** One typed number: blank clears, a valid one is stored normalised, anything else is refused with the words of the rule. */
export function validateNumberInput(typed: string): InputCheck {
  const text = typed.trim();
  if (text === '') return { ok: true, value: null };
  if (DECIMAL_TEXT_PATTERN.test(text)) return { ok: true, value: normaliseDecimalText(text) };
  // A number that has the right shape but too many digits is told so, not that its decimals are wrong (review SQR-11).
  return { ok: false, message: TOO_MANY_DIGITS.test(text) ? NUMBER_TOO_LARGE_MESSAGE : NUMBER_RULE_MESSAGE };
}

export interface TextRule {
  /** The text is entered over several lines (Remarks): a line break is part of it. */
  readonly multiline: boolean;
}

/** One typed text: blank clears, too long or holding a control character is refused. The stored text is trimmed. */
export function validateTextInput(typed: string, rule: TextRule): InputCheck {
  const text = (rule.multiline ? typed.replace(LINE_BREAKS, '\n') : typed).trim();
  if (text === '') return { ok: true, value: null };
  if (text.length > MAX_PART_TEXT_LENGTH) return { ok: false, message: TEXT_TOO_LONG_MESSAGE };
  const withoutLineFeeds = rule.multiline ? text.replace(LINE_FEED, '') : text;
  return CONTROL_CHARACTERS.test(withoutLineFeeds) ? { ok: false, message: TEXT_CHARACTERS_MESSAGE } : { ok: true, value: text };
}
