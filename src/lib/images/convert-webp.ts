import { MAX_PICTURE_BYTES } from './picture-rules';

/**
 * A WebP picture, made into a PNG or a JPEG **in the browser, before it is uploaded** (STORY-05.07 with STORY-07.02; review SQR-01 of AQP-332; the delivery lead's decision of 2026-11-18, option A).
 *
 * **Why:** the portal takes WebP pictures (SPEC section 7.1), but the Excel file cannot embed one (ExcelJS holds PNG, JPEG and GIF), so a part whose picture is a WebP would have an empty picture cell. The
 * browser decodes a WebP and re-encodes it, so what is stored is a kind the file can hold. **The server never stores a WebP** (OQ-PM-10, architecture section 8): `checkPicture` refuses one that arrives
 * unconverted, from a client other than the portal's page, with the existing 415 words. **ADR-013 holds:** the server still never decodes a picture; it still *finds* the kind from the bytes, which is how the
 * screen knows a file is a WebP.
 *
 * **Which kind:** a picture with any transparent pixel becomes a PNG (a JPEG has no transparency and would turn it black); every other picture becomes a JPEG on a white ground.
 * **How small:** the result must be **strictly under** 200 KB (A-06). A JPEG is tried at each quality of `ENCODE_QUALITIES` from the best down, at full size; if none is small enough the size is stepped down
 * (`ENCODE_SCALES`) and the qualities are tried again from the best. A PNG has no quality, so only the size is stepped. If nothing is small enough the answer is "too large", and the person is told.
 *
 * The browser's decoder and canvas are **passed in** (`ConvertDeps`), so this file is pure and its steps are tested exactly; the real ones are
 * `components/features/estimate-workspace/browser-decoder.ts`. A decoded picture is always let go (`close`), whatever the outcome.
 */

/** JPEG qualities tried at one size, best first. */
export const ENCODE_QUALITIES: ReadonlyArray<number> = [0.92, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35];
/** Sizes tried, as a fraction of the decoded picture's own, largest first. */
export const ENCODE_SCALES: ReadonlyArray<number> = [1, 0.75, 0.5, 0.35, 0.25];

export type EncodedType = 'image/png' | 'image/jpeg';

/** A picture the browser has decoded. */
export interface DecodedPicture {
  /** Whether any pixel is not fully opaque. */
  readonly transparent: boolean;
  /** Draws the picture at `scale` (on a white ground for a JPEG) and encodes it. `null` when the browser cannot encode that type. `quality` is for a JPEG only. */
  encode(type: EncodedType, options: { readonly scale: number; readonly quality?: number }): Promise<Blob | null>;
  /** Lets go of the decoded picture's memory. */
  close(): void;
}

export interface ConvertDeps {
  /** Decodes the file with the browser's own decoder; rejects for a file it cannot decode. */
  decode(file: File): Promise<DecodedPicture>;
}

export type Converted =
  | { readonly ok: true; readonly file: File }
  | { readonly ok: false; readonly reason: 'unreadable' }
  /** `bytes` is the size of the smallest file that was tried, which the person is told (it is 204,800 bytes or more). */
  | { readonly ok: false; readonly reason: 'too-large'; readonly bytes: number };

const EXTENSIONS: Readonly<Record<EncodedType, 'png' | 'jpg'>> = { 'image/png': 'png', 'image/jpeg': 'jpg' };
const FALLBACK_NAME = 'picture';
const WEBP_EXTENSION = /\.webp$/i;

/** The file's name with the extension of its new kind: "front.webp" is "front.jpg", a name with no extension gets one, and a name that was only the extension is "picture". */
export function convertedName(name: string, extension: 'jpg' | 'png'): string {
  const stem = name.replace(WEBP_EXTENSION, '');
  return `${stem === '' ? FALLBACK_NAME : stem}.${extension}`;
}

/** The sizes and qualities to try for a kind, in order: a JPEG at every quality of each size, a PNG at each size alone. */
function steps(type: EncodedType): ReadonlyArray<{ readonly scale: number; readonly quality?: number }> {
  return ENCODE_SCALES.flatMap((scale) => (type === 'image/png' ? [{ scale }] : ENCODE_QUALITIES.map((quality) => ({ scale, quality }))));
}

export async function convertWebp(file: File, deps: ConvertDeps): Promise<Converted> {
  let picture: DecodedPicture;
  try {
    picture = await deps.decode(file);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  try {
    const type: EncodedType = picture.transparent ? 'image/png' : 'image/jpeg';
    let smallest = Number.POSITIVE_INFINITY;
    for (const step of steps(type)) {
      const blob = await picture.encode(type, step);
      if (blob === null) return { ok: false, reason: 'unreadable' };
      if (blob.size < MAX_PICTURE_BYTES) return { ok: true, file: new File([blob], convertedName(file.name, EXTENSIONS[type]), { type }) };
      smallest = Math.min(smallest, blob.size);
    }
    return { ok: false, reason: 'too-large', bytes: smallest };
  } catch {
    // A canvas that is lost or a memory failure while drawing is a picture the browser could not convert, never a half-done upload.
    return { ok: false, reason: 'unreadable' };
  } finally {
    picture.close();
  }
}
