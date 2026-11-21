import { detectImageType, type ImageMime } from './signature';

/**
 * The rules of a part picture (STORY-05.07; FR-047, NFR-005; ADR-013; assumption A-06) and the words of its refusals (UX spec SCR-05), in one place for the server, which judges,
 * and the browser, which gives a quick answer before it sends anything. Pure: no Node or browser API.
 *
 * **The limit.** "200 KB" is 200 x 1024 bytes and the picture must be **strictly under** it (A-06): 204,799 bytes is accepted and 204,800 is not. A body is larger than its picture,
 * by the multipart framing and the name, so the whole upload has its own, larger ceiling (`MAX_UPLOAD_BODY_BYTES`), which the server enforces **while it reads**, before anything
 * is parsed or held, so a huge upload cannot use up the process's memory.
 */

const BYTES_PER_KB = 1024;
export const MAX_PICTURE_KB = 200;
/** A picture is refused at this size and above. */
export const MAX_PICTURE_BYTES = MAX_PICTURE_KB * BYTES_PER_KB;
/**
 * The most bytes the whole upload may have (the multipart framing, the field names and the file name included): 256 KB, a little over the picture limit plus the framing of one
 * file. Over it, the server stops reading and answers 413 without buffering the rest (STORY-05.07, "Careful").
 */
export const MAX_UPLOAD_BODY_BYTES = 256 * BYTES_PER_KB;

/** The longest file name that is kept, in characters; a longer one is cut, keeping its ending (the extension). */
export const MAX_FILE_NAME_LENGTH = 100;
/** What a picture with no usable name is called. */
export const FALLBACK_FILE_NAME = 'picture';

/** The `code` of the 413 and of the 415 of a picture the rules refuse. */
export const PICTURE_TOO_LARGE_CODE = 'PICTURE_TOO_LARGE';
export const PICTURE_TYPE_CODE = 'PICTURE_TYPE_REFUSED';

export const PICTURE_TYPE_MESSAGE = 'Only PNG, JPG, GIF or WebP pictures are accepted.';
export const PICTURE_UPLOAD_FAILED_MESSAGE = 'The picture could not be added. Try again.';

/** The size in whole kilobytes, rounded up, so a file that is over the limit never reads as "200 KB". */
export const kilobytesOf = (bytes: number): number => Math.ceil(bytes / BYTES_PER_KB);

/** "cabinet-photo.png" is 312 KB. Pictures must be under 200 KB. Choose a smaller picture. (UX spec SCR-05.) `fileName` is shown as text, and sanitised before it gets here. */
export function pictureTooLargeMessage(fileName: string, bytes: number): string {
  return `"${fileName}" is ${String(kilobytesOf(bytes))} KB. Pictures must be under ${String(MAX_PICTURE_KB)} KB. Choose a smaller picture.`;
}

/** The words of a body that went over the ceiling before its file could be read: its size is not known, so none is named. */
export const UPLOAD_TOO_LARGE_MESSAGE = `Pictures must be under ${String(MAX_PICTURE_KB)} KB. Choose a smaller picture.`;

/** What may not be in a file name that is stored and shown: control and invisible characters (the bidirectional ones included), but not the joiners that scripts such as Devanagari need. */
const INVISIBLE_CHARACTERS = /(?![‌‍])[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
/** Characters that are markup, a quote or part of a path or a drive: not kept, so the name is text and nothing else wherever it is shown. */
const UNSAFE_CHARACTERS = /[<>"'`&:*?|]/g;
const PATH_SEPARATORS = /[\\/]/;
const LONGEST_EXTENSION = 10;

/** The name cut to `MAX_FILE_NAME_LENGTH` characters (whole characters, never half of one), keeping the extension. */
function shortened(name: string): string {
  const characters = Array.from(name);
  if (characters.length <= MAX_FILE_NAME_LENGTH) return name;
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 && name.length - dot <= LONGEST_EXTENSION ? Array.from(name.slice(dot)) : [];
  return [...characters.slice(0, MAX_FILE_NAME_LENGTH - extension.length), ...extension].join('');
}

/**
 * The file name as it is stored and shown (STORY-05.07 AC-7): its last path segment only, with control and invisible characters, markup, quotes and path or drive characters taken
 * out, white space folded to single spaces, leading dots dropped, and no more than `MAX_FILE_NAME_LENGTH` characters. It is **display text**: it is never used as a path, a header
 * value or markup, and the page shows it as text. A name with nothing left is `picture`.
 */
export function sanitiseFileName(raw: string): string {
  const lastSegment = raw.split(PATH_SEPARATORS).pop() ?? '';
  const cleaned = lastSegment.normalize('NFC').replace(INVISIBLE_CHARACTERS, '').replace(UNSAFE_CHARACTERS, '').replace(/\s+/g, ' ').replace(/^[.\s]+/, '').trim();
  const name = shortened(cleaned);
  return name === '' ? FALLBACK_FILE_NAME : name;
}

/** The answer of the rules for one file: its kind, or why it is refused (the status is that of the route's answer). */
export type PictureCheck =
  | { readonly ok: true; readonly mime: ImageMime }
  | { readonly ok: false; readonly status: 413 | 415; readonly code: typeof PICTURE_TOO_LARGE_CODE | typeof PICTURE_TYPE_CODE; readonly message: string };

/**
 * Judges a file by its size, then by its content. The size comes first and costs nothing: a file at or over the limit is "too large" whatever it holds. An empty file, a file that is
 * not one of the four kinds and one that is cut short or has something appended are all "wrong type".
 *
 * **A WebP is refused as the wrong type too** (DL-237, OQ-PM-10, architecture section 8): the browser converts a WebP to a PNG or a JPEG before it is sent, so the Excel file can hold the picture, and the
 * server makes sure no WebP is ever stored. The kind is still **found** (`detectImageType` says `image/webp`, so the screen can tell a WebP and the picker can offer one); it is only not accepted here. The
 * size check stays first, so a WebP of 200 KB or more is "too large", and the words are the existing ones.
 */
export function checkPicture(fileName: string, bytes: Uint8Array): PictureCheck {
  if (bytes.length >= MAX_PICTURE_BYTES) return { ok: false, status: 413, code: PICTURE_TOO_LARGE_CODE, message: pictureTooLargeMessage(fileName, bytes.length) };
  const mime = detectImageType(bytes);
  // DL-237 / OQ-PM-10: a WebP is converted in the browser; one that arrives unconverted is never stored.
  if (mime === null || mime === 'image/webp') return { ok: false, status: 415, code: PICTURE_TYPE_CODE, message: PICTURE_TYPE_MESSAGE };
  return { ok: true, mime };
}
