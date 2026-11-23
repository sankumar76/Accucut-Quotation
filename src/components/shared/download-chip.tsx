import { FileCheck2, FileDown, TriangleAlert, type LucideIcon } from 'lucide-react';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { DownloadChipData } from '@/lib/export/download-marker-view';
import { formatIst } from '@/lib/time';

import { BREAK_LONG_NAMES } from './break-long-names';
import { CHANGED_EXPLANATION, CHANGED_SINCE_DOWNLOAD, DOWNLOAD_STATUS_UNAVAILABLE, downloadedLabel, lastDownloadLine, NOT_DOWNLOADED } from './download-chip-texts';
import { Icon } from './icon';

/**
 * The marker chip of an estimate's Excel downloads (STORY-CR01.7E AC-5, AC-7; UX spec section 0.9 row 7c: "a marker chip, not a status"): "Not downloaded", "Downloaded N×" with the last person and time, or amber
 * "Changed since download". **One component for every screen that shows it**: SCR-10, SCR-06's header, the rows of the Closed tab and the quote dialog, so they say the same words. The amber state is told in **words
 * and an icon**, never by colour alone (NFR-016 to NFR-018), and the chip wraps on a phone: the label is one badge and the last person and time a line of text beside or under it.
 *
 * **For a Lead and an Admin only** (NFR-002): the marker is Internal data of the download log. It takes the plain marker (`DownloadChipData`) and nothing else, so no price, approver or figure can be drawn through it,
 * and the only screens that import it are the Lead's and the Admin's. No script: it is drawn on the server and in the queue's client list alike.
 */

export interface DownloadChipProps {
  /** The marker, or `'unavailable'` when it could not be read: the chip then says so in words and draws no state (a screen never says "Not downloaded" for a marker it does not have). */
  readonly marker: DownloadChipData | 'unavailable';
  /** The sentence that says why an amber chip is amber (SCR-10). Left out in a list, where the words of the chip are enough. */
  readonly explain?: boolean;
  readonly className?: string;
}

const LOOK: Readonly<Record<DownloadChipData['kind'], { readonly tone: BadgeTone; readonly icon: LucideIcon }>> = {
  none: { tone: 'neutral', icon: FileDown },
  downloaded: { tone: 'info', icon: FileCheck2 },
  changed: { tone: 'warn', icon: TriangleAlert },
};

function labelOf(marker: DownloadChipData): string {
  switch (marker.kind) {
    case 'none':
      return NOT_DOWNLOADED;
    case 'downloaded':
      return downloadedLabel(marker.count);
    case 'changed':
      return CHANGED_SINCE_DOWNLOAD;
  }
}

export function DownloadChip({ marker, explain = false, className }: DownloadChipProps) {
  if (marker === 'unavailable') {
    return (
      <span data-slot="download-chip" data-marker="unavailable" className={cn('text-label text-ink-2', className)}>
        {DOWNLOAD_STATUS_UNAVAILABLE}
      </span>
    );
  }
  const { tone, icon } = LOOK[marker.kind];
  return (
    <span data-slot="download-chip" data-marker={marker.kind} className={cn('inline-flex max-w-full flex-wrap items-center gap-x-s-2 gap-y-s-1', className)}>
      <Badge tone={tone}>
        <Icon icon={icon} size="badge" />
        {labelOf(marker)}
      </Badge>
      {marker.kind === 'none' ? null : (
        <span className={cn('text-label text-ink-2', BREAK_LONG_NAMES)}>
          {marker.kind === 'changed' ? `${downloadedLabel(marker.count)}. ` : ''}
          {lastDownloadLine(marker.last.byName, formatIst(new Date(marker.last.at)))}
        </span>
      )}
      {marker.kind === 'changed' && explain ? <span className="basis-full text-label text-ink-2">{CHANGED_EXPLANATION}</span> : null}
    </span>
  );
}
