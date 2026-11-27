import { formatRupees } from '@/lib/money';

import { calculatedTotalLabel, CUSTOMER_LABEL, NO_CUSTOMER } from './approve-texts';

/**
 * The two rows SCR-08 shows under its lead-in before the price field (the mock-up, AQP-478 DEF-121): the calculated total (BL) the price starts as, and the estimate's customer. The lead-in itself is the dialog's
 * `DialogDescription` (it describes the dialog for a screen reader). Both values are what the Lead's page already shows (the BL tile and the customer line) and the field below starts as the total; the Excel
 * letter comes from the configuration version the figures belong to and is never typed (UX-26). A customer is plain text, so a name that holds markup is shown, never run.
 */

export interface ApproveSummaryProps {
  /** The Excel letter of the calculated total. */
  readonly totalLetter: string;
  /** The calculated total, as the price field starts. */
  readonly calculatedTotal: string;
  /** The estimate's customer, or `null` for one made before it had one. */
  readonly customerName: string | null;
}

export function ApproveSummary({ totalLetter, calculatedTotal, customerName }: ApproveSummaryProps) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-s-4 gap-y-s-1 text-body">
      <dt className="text-ink-2">{calculatedTotalLabel(totalLetter)}</dt>
      <dd className="font-semibold text-ink tabular-nums">{formatRupees(calculatedTotal)}</dd>
      <dt className="text-ink-2">{CUSTOMER_LABEL}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere] text-ink">{customerName ?? NO_CUSTOMER}</dd>
    </dl>
  );
}
