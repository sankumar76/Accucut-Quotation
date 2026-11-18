import { PRICE_REMOVED_NOTICE_ID } from '@/components/features/estimate-remove-price/remove-ids';
import { Notice } from '@/components/shared/notice';
import { formatIst } from '@/lib/time';
import type { CostsView } from '@/server/views/schemas/costs';

import { PRICE_REMOVED_APPROVE_AGAIN, PRICE_REMOVED_AUDIT_KEEPS, priceRemovedNoticeTitle } from './review-texts';

/**
 * The notice of a removed price (STORY-06.13 AC-3; UX spec SCR-06 state "Price removed"): who removed the approved price and when (IST), that the audit log keeps it, and how a price comes back. BO reads "Not set yet"
 * beside it. It is drawn from the costs view's `priceRemoved`, which holds who and when and **never the price** (AC-6), and it is the same for the Admin and a Lead. It holds focus when a removal has just worked
 * (`tabIndex` -1). A Server Component with no script.
 */

export interface PriceRemovedNoticeProps {
  /** `null` while the latest approval's price stands (or there is none): nothing is drawn. */
  readonly removed: CostsView['priceRemoved'];
}

export function PriceRemovedNotice({ removed }: PriceRemovedNoticeProps) {
  if (removed === null) return null;
  return (
    <div id={PRICE_REMOVED_NOTICE_ID} tabIndex={-1} className="rounded-md">
      <Notice tone="info" role="status" title={priceRemovedNoticeTitle(formatIst(new Date(removed.at)), removed.byName)}>
        <p>{PRICE_REMOVED_AUDIT_KEEPS}</p>
        <p>{PRICE_REMOVED_APPROVE_AGAIN}</p>
      </Notice>
    </div>
  );
}
