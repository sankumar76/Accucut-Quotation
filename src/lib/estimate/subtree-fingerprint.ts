/**
 * A fingerprint of the parts a delete would remove (STORY-05.02, review SQR-01): the part and every sub-part, each with its `revision`. The browser computes it from
 * the tree the delete dialog showed and sends it with the delete; the server computes it again under the estimate's row lock from what is stored. A part moved in or out,
 * replaced by another, or typed into since the person looked changes the fingerprint, so a delete of parts the person did not see is refused (409, nothing deleted).
 *
 * The same function runs in both places, so the two cannot differ. It is **a change detector, not a security token**, so it is a 64-bit FNV-1a hash and not SHA-256:
 * `crypto.subtle` exists only in a secure context (HTTPS or localhost), and the portal may be served to the office over plain HTTP. Two different sets sharing a
 * fingerprint by accident has a chance of about 1 in 2^64.
 */

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;
const HEX_DIGITS = 16;

/** The shape of a fingerprint: 16 lower-case hexadecimal digits. */
export const FINGERPRINT_PATTERN = /^[0-9a-f]{16}$/;

/** The fingerprint of a set of parts, whatever order they are given in. IDs are compared in lower case, as the database writes them. */
export function subtreeFingerprint(parts: ReadonlyArray<{ readonly id: string; readonly revision: number }>): string {
  const text = parts
    .map((part) => `${part.id.toLowerCase()}:${part.revision}`)
    .sort()
    .join(',');
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash ^ BigInt(text.charCodeAt(index))) * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(HEX_DIGITS, '0');
}
