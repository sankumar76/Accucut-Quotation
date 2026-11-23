import { isRecord } from '../api-client';

/**
 * The marker of an estimate's Excel downloads as a screen draws it (STORY-CR01.7E, AQP-402; CR-01 item 7c): the plain shape of `downloadMarkerSchema` (`server/views/schemas/download-marker.ts`), with the instant as
 * ISO 8601 text, so a server page, the browser and the shared chip (`components/shared/download-chip.tsx`) read the same thing. It holds a count, a person's name and an instant: no price, no figure and no ID.
 * **For a Lead and an Admin only** (NFR-002): no screen an Engineer may open takes this type.
 */

export interface DownloadChipLast {
  readonly byName: string;
  /** An ISO 8601 instant in UTC; the chip writes it in IST. */
  readonly at: string;
}

export type DownloadChipData =
  | { readonly kind: 'none' }
  | { readonly kind: 'downloaded'; readonly count: number; readonly last: DownloadChipLast }
  | { readonly kind: 'changed'; readonly count: number; readonly last: DownloadChipLast };

function readLast(value: unknown): DownloadChipLast | null {
  if (!isRecord(value)) return null;
  const { byName, at } = value;
  return typeof byName === 'string' && byName !== '' && typeof at === 'string' && !Number.isNaN(new Date(at).getTime()) ? { byName, at } : null;
}

/** The marker an answer of `GET /api/v1/download-markers` holds for one task, or `null` for a value that is not one: a screen never draws a guess. */
export function readDownloadMarker(value: unknown): DownloadChipData | null {
  if (!isRecord(value)) return null;
  if (value['kind'] === 'none') return { kind: 'none' };
  const { kind, count } = value;
  if (kind !== 'downloaded' && kind !== 'changed') return null;
  const last = readLast(value['last']);
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || last === null) return null;
  return { kind, count, last };
}
