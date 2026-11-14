/**
 * The network folder of a task (STORY-04.01 AC-3, AC-4; FR-033; architecture section 8, input validation). The portal never reads the share: it keeps the
 * path as text, shows it as a link plus "Copy path", and builds the `file:` link itself from a path that is a UNC path, so a `javascript:` or any other
 * scheme cannot be made from what a person types.
 */

/** A UNC path starts with two backslashes. */
const UNC_PREFIX = '\\\\';
const SEPARATOR = '\\';

/** The longest path the portal keeps. Windows paths are normally under 260 characters; this leaves room for a long share and folder names. */
export const FOLDER_PATH_MAX_LENGTH = 500;

/** `file:` and an empty host, then the server's two slashes: the form `file:////server/share/folder` that a browser on Windows opens as `\\server\share\folder`. */
const FILE_URL_PREFIX = 'file:////';

const FIRST_PRINTABLE = 0x20;
const DELETE_CODE = 0x7f;
/** What Windows does not allow in a name, and a slash, which a UNC path does not use. Also refused so the path is one line of plain text. */
const ILLEGAL_CHARACTERS = '<>:"/|?*';

function hasIllegalCharacter(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code < FIRST_PRINTABLE || code === DELETE_CODE || ILLEGAL_CHARACTERS.includes(character)) return true;
  }
  return false;
}

/** The server, the share and the folders below it, as a UNC path names them, or `null` when the text is not a UNC path. A trailing backslash is allowed. */
function segmentsOf(path: string): ReadonlyArray<string> | null {
  if (!path.startsWith(UNC_PREFIX) || path.length > FOLDER_PATH_MAX_LENGTH) return null;
  const rest = path.slice(UNC_PREFIX.length);
  if (hasIllegalCharacter(rest)) return null;
  const parts = rest.split(SEPARATOR);
  // One trailing backslash leaves an empty last part; any other empty part is a doubled backslash.
  const segments = parts.at(-1) === '' ? parts.slice(0, -1) : parts;
  const isWellFormed = segments.length >= 2 && segments.every((segment) => segment.trim() !== '');
  return isWellFormed ? segments : null;
}

/** Is this text a UNC path: two backslashes, a server, a share, and optionally folders, with no character Windows refuses? */
export function isUncPath(path: string): boolean {
  return segmentsOf(path) !== null;
}

/**
 * The `file:` link for a UNC path, built here and nowhere else. The scheme is a constant, and each part of the path is percent-encoded, so a space or a
 * letter outside ASCII is safe in the address. `null` for a text that is not a UNC path: there is no link for it.
 */
export function folderUrlOf(path: string): string | null {
  const segments = segmentsOf(path);
  return segments === null ? null : `${FILE_URL_PREFIX}${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;
}
