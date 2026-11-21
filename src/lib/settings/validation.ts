/**
 * The rules for the sender of the e-mail alerts (STORY-09.02 AC-3; FR-019), written once and used by the form (to show a message at once) and by the server (which decides). The file has
 * no import, so the page does not carry zod (NFR-009).
 *
 * The limits are the story's: a sender name of 1 to 100 characters, a sender address of at most 254 (the RFC maximum for an address). Neither may hold a line break, and the address no
 * comma, so a value can never add a header or a second recipient to a message (header injection, TB-4). Both are trimmed first. The words are SCR-15's where it has them; the others are
 * proposals for the ux-expert's end review (Dev Record of AQP-349).
 */

export const SENDER_NAME_MAX_LENGTH = 100;
export const SENDER_ADDRESS_MAX_LENGTH = 254;

/** What a person types, and what a PUT carries. */
export interface AlertSettingsInput {
  readonly alertsEnabled: boolean;
  readonly senderName: string;
  readonly senderAddress: string;
}

export type SenderField = 'senderName' | 'senderAddress';

/** One message per field that is wrong, all of them at once. */
export type SenderProblems = Partial<Record<SenderField, string>>;

export const SENDER_NAME_REQUIRED = 'Enter a sender name.';
export const SENDER_NAME_TOO_LONG = `The sender name can have at most ${SENDER_NAME_MAX_LENGTH} characters.`;
export const SENDER_NAME_LINE_BREAK = 'The sender name must be on one line.';
export const SENDER_ADDRESS_REQUIRED = 'Enter a sender e-mail address before you turn e-mail alerts ON.';
export const SENDER_ADDRESS_TOO_LONG = `The sender e-mail address can have at most ${SENDER_ADDRESS_MAX_LENGTH} characters.`;
export const SENDER_ADDRESS_LINE_BREAK = 'The sender e-mail address must be on one line.';
export const SENDER_ADDRESS_COMMA = 'Enter one e-mail address, with no comma.';
export const SENDER_ADDRESS_INVALID = 'Enter a valid e-mail address, for example portal@example.com.';

/** The same pattern as zod's default `z.email()`, which the mailer checks the sender with, so an address saved here is never refused there. `tests/unit/settings/alerts-validation.test.ts` holds the two together. */
const ADDRESS_PATTERN = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
const LINE_BREAK_CODES: ReadonlySet<number> = new Set([10, 13, 0x2028, 0x2029]);

/** A line feed, a carriage return or one of the two Unicode line separators: anything that could end a header line. */
function hasLineBreak(value: string): boolean {
  return [...value].some((character) => LINE_BREAK_CODES.has(character.codePointAt(0) ?? 0));
}

export function isValidSenderAddress(value: string): boolean {
  return ADDRESS_PATTERN.test(value);
}

/** The value as it is saved: no space at either end. */
export function trimmedSender(input: AlertSettingsInput): AlertSettingsInput {
  return { alertsEnabled: input.alertsEnabled, senderName: input.senderName.trim(), senderAddress: input.senderAddress.trim() };
}

function nameProblem(name: string): string | undefined {
  // The line break is looked for in the raw value: `trim` would hide one at the end.
  if (hasLineBreak(name)) return SENDER_NAME_LINE_BREAK;
  if (name.trim() === '') return SENDER_NAME_REQUIRED;
  if (name.trim().length > SENDER_NAME_MAX_LENGTH) return SENDER_NAME_TOO_LONG;
  return undefined;
}

function addressProblem(address: string, alertsEnabled: boolean): string | undefined {
  if (hasLineBreak(address)) return SENDER_ADDRESS_LINE_BREAK;
  const trimmed = address.trim();
  // An empty address is allowed while alerts are OFF (the state of a new install), and refused when they are turned ON.
  if (trimmed === '') return alertsEnabled ? SENDER_ADDRESS_REQUIRED : undefined;
  if (trimmed.length > SENDER_ADDRESS_MAX_LENGTH) return SENDER_ADDRESS_TOO_LONG;
  if (trimmed.includes(',')) return SENDER_ADDRESS_COMMA;
  if (!isValidSenderAddress(trimmed)) return SENDER_ADDRESS_INVALID;
  return undefined;
}

/** The problems of a form, one message per field, name first. An empty object means the values may be saved. */
export function senderProblems(input: AlertSettingsInput): SenderProblems {
  const found: { senderName?: string; senderAddress?: string } = {};
  const name = nameProblem(input.senderName);
  if (name !== undefined) found.senderName = name;
  const address = addressProblem(input.senderAddress, input.alertsEnabled);
  if (address !== undefined) found.senderAddress = address;
  return found;
}
