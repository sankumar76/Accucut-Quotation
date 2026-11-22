import { isExportFileName } from '../../lib/export/file-name';

/**
 * The `Content-Disposition` of a file the portal makes and names itself (CR-01 item 9, AQP-391 AC-5; RFC 6266 with RFC 8187; architecture section 4.11 c). Pure.
 *
 *   `attachment; filename="<ASCII fallback>"; filename*=UTF-8''<percent-encoded name>`
 *
 * The name holds text a person typed (the customer's short name and the task's subject), so it can hold any letter, and an apostrophe, a semicolon or a percent sign. It reaches the header only through here:
 *   - a name that is not one the export makes (`isExportFileName`: no control, format or reserved character, no quote, no path) is a mistake in the code and **throws**, without repeating the name;
 *   - the ASCII fallback keeps only `A-Z a-z 0-9 . _ -`, so it can hold no quote, semicolon or line break;
 *   - `filename*` percent-encodes every UTF-8 byte outside that same set, which is inside RFC 8187's `attr-char` (a little stricter: `!#$&+^`|~` are encoded too), so no quote, semicolon, CR or LF can reach the header.
 */

/** What stays as it is in both parameters. */
const UNENCODED = /^[A-Za-z0-9._-]$/;
/** What the fallback's stem is when no character of the real one is ASCII (a name the builder makes always keeps its separators and date). */
const FALLBACK_STEM = 'download';
const EXTENSION_LENGTH = '.xlsx'.length;
const encoder = new TextEncoder();

/** `ü` is `%C3%BC`: every UTF-8 byte of a character outside the set, as upper-case hexadecimal. */
function percentEncoded(text: string): string {
  return Array.from(text, (character) =>
    UNENCODED.test(character) ? character : Array.from(encoder.encode(character), (byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join(''),
  ).join('');
}

/** The name with every character outside `A-Z a-z 0-9 . _ -` dropped. */
function asciiFallbackOf(fileName: string): string {
  const stem = Array.from(fileName.slice(0, -EXTENSION_LENGTH))
    .filter((character) => UNENCODED.test(character))
    .join('');
  return `${stem === '' ? FALLBACK_STEM : stem}${fileName.slice(-EXTENSION_LENGTH)}`;
}

export function attachmentDisposition(fileName: string): string {
  if (!isExportFileName(fileName)) throw new Error('A file name put in a header must be one the export makes: a stem of letters, digits and punctuation without whitespace, control or reserved characters, then .xlsx.');
  return `attachment; filename="${asciiFallbackOf(fileName)}"; filename*=UTF-8''${percentEncoded(fileName)}`;
}
