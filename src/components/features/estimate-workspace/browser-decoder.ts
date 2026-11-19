import type { ConvertDeps, DecodedPicture, EncodedType } from '@/lib/images/convert-webp';

/**
 * The browser's own decoder and canvas for `convertWebp` (STORY-05.07 with STORY-07.02, review SQR-01 of AQP-332): `createImageBitmap` decodes the WebP, a canvas draws it and `toBlob` encodes it as a
 * PNG or a JPEG. Nothing leaves the browser until the person's picture is whole, and nothing here is judged: the steps are `lib/images/convert-webp.ts`'s (pure, tested), and the server judges the file
 * that is sent. This file touches the DOM, so it is out of the unit tests' coverage scope (`src/components/**`) and is run by `tests/e2e/estimate-picture.spec.ts`.
 *
 * A very large picture is first drawn no larger than `LONGEST_SIDE` pixels on its longest side: a photograph of 8,000 x 6,000 pixels would need over 190 MB of canvas, and a part picture under 200 KB
 * never needs it.
 */

const LONGEST_SIDE = 4_096;
const OPAQUE = 255;

function drawn(bitmap: ImageBitmap, scale: number, onWhite: boolean): HTMLCanvasElement {
  const fit = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * fit * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * fit * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('The browser gave no drawing surface.');
  // A JPEG has no transparency: the picture is drawn on white, as a printed page would show it.
  if (onWhite) {
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('The browser gave no drawing surface.');
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  // Every fourth value is a pixel's alpha.
  for (let index = 3; index < data.length; index += 4) if ((data[index] ?? OPAQUE) < OPAQUE) return true;
  return false;
}

export const browserDecoder: ConvertDeps = {
  async decode(file: File): Promise<DecodedPicture> {
    const bitmap = await createImageBitmap(file);
    try {
      const transparent = hasTransparency(drawn(bitmap, 1, false));
      return {
        transparent,
        encode: (type: EncodedType, { scale, quality }) => new Promise<Blob | null>((resolve) => drawn(bitmap, scale, type === 'image/jpeg').toBlob(resolve, type, quality)),
        close: () => bitmap.close(),
      };
    } catch (error) {
      bitmap.close();
      throw error;
    }
  },
};
