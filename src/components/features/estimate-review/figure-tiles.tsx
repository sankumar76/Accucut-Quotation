import type { ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { ColumnTag } from '@/components/shared/column-tag';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { priceDifference } from '@/lib/estimate/approve-price';
import { formatFigure, formatRupees } from '@/lib/money';
import type { CostsView } from '@/server/views/schemas/costs';

import {
  APPROVED_NOT_SET,
  APPROVED_NOT_SET_CLEARED_HINT,
  APPROVED_NOT_SET_HINT,
  approvedByLine,
  BL_CLEARED_HINT,
  BL_NAME,
  BN_CLEARED_HINT,
  BN_HINT,
  BN_NAME,
  BO_NAME,
  CLEARED,
  fileCell,
  NO_REASON_GIVEN,
  NOT_CALCULATED,
  noToolCost,
  overrideLine,
  reasonGivenLine,
  TILES_LABEL,
} from './review-texts';

/**
 * The three tiles of SCR-06 (STORY-06.02 AC-1, AC-6; UX spec SCR-06 "Content"): BL, BN and BO, each with its plain name, its letter tag and "File cell XX2", **once each**. The figure is only
 * ever what the server handed over for a `current` state; in the other states the tile says "Not calculated" or "Cleared" in words, never an empty box (UX spec SCR-06 "Accessibility").
 * BO is "Not set yet" until an approval exists; then it is the approved price from the `approvals` row, with who approved it and when (STORY-06.06 AC-5, AC-9), **whatever the state of the figures**: BO is not a calculated
 * figure, so clearing them cannot change it (BL clears, BO stays). A server component with no script, so it adds nothing to the first load.
 *
 * **The skeleton while a recalculation is under way** (STORY-06.04 AC-9; UX spec SCR-06 "Loading: tile skeletons"): the bar's button is `aria-busy` while it works, the root of the review is a `group/review`, and
 * `:has()` finds the busy button, so each figure is hidden and a skeleton shows in its place by CSS alone (the class names are written out whole, for the style scanner). No script, no state, nothing sent to the browser.
 */

interface TileProps {
  readonly name: string;
  readonly letter: string;
  readonly children: ReactNode;
  readonly note?: ReactNode;
  /** False when the note already names the file cell (the BN sentence does), so a tile names it once (AC-1). */
  readonly fileCellLine?: boolean;
}

function Tile({ name, letter, children, note, fileCellLine = true }: TileProps) {
  return (
    <Card className="min-w-0">
      <CardContent className="flex flex-col gap-s-2">
        <p className="flex flex-wrap items-center gap-s-2 text-label font-semibold text-ink-2">
          <span>{name}</span>
          <ColumnTag letter={letter} kind="output" />
        </p>
        <p className="relative text-heading font-semibold tracking-tight text-ink [overflow-wrap:anywhere] tabular-nums">
          <span className="group-has-[[aria-busy=true]]/review:invisible">{children}</span>
          <Skeleton className="absolute inset-y-0 left-0 hidden w-2/3 group-has-[[aria-busy=true]]/review:block" />
        </p>
        {note === undefined ? null : <p className="text-label text-ink-2">{note}</p>}
        {fileCellLine ? <p className="text-label text-ink-3">{fileCell(letter)}</p> : null}
      </CardContent>
    </Card>
  );
}

const word = (text: string): ReactNode => <span className="italic">{text}</span>;

/**
 * The approval BO shows (STORY-06.06 AC-5, AC-9): the price as stored, who approved it and when (IST), read from the `approvals` row, never through the figure state. For a price that differs from the
 * calculated total (STORY-06.07 AC-3) it also holds the total the price was set against and the reason given, so BO can say how far it is from it and why, or that no reason was given.
 */
export interface ApprovedTileView {
  readonly price: string;
  readonly approverName: string;
  readonly approvedAtLabel: string;
  /** The calculated total (BL) the price was set against, rupees and paise. */
  readonly calculatedTotal: string;
  readonly isOverride: boolean;
  /** The reason given with the override, or `null` when none was given. */
  readonly reason: string | null;
}

/** What BO adds under the approver line for an override: the difference from the calculated total, and the reason or "No reason given." Nothing for an approval at the calculated total. */
function OverrideLines({ approval }: { readonly approval: ApprovedTileView }) {
  if (!approval.isOverride) return null;
  const difference = priceDifference(approval.price, approval.calculatedTotal);
  // An override is a price that differs at rupees and paise, so there is a difference; if the record ever said otherwise, nothing is claimed.
  if (difference === null) return null;
  return (
    <>
      <span className="mt-s-1 block">{overrideLine(difference.direction, formatRupees(difference.amount), formatRupees(approval.calculatedTotal))}</span>
      {/* Typed text, drawn as text: the line breaks the Lead typed are kept, and a long word wraps. */}
      <span className={cn('block whitespace-pre-line', BREAK_LONG_NAMES)}>{approval.reason === null ? NO_REASON_GIVEN : reasonGivenLine(approval.reason)}</span>
    </>
  );
}

export interface FigureTilesProps {
  readonly state: CostsView['state'];
  readonly letters: CostsView['letters'];
  readonly totals: CostsView['totals'];
  /** `null` before any approval: BO is then "Not set yet". Present in every state, cleared figures included (AC-9). */
  readonly approval?: ApprovedTileView | null;
}

export function FigureTiles({ state, letters, totals, approval = null }: FigureTilesProps) {
  const current = state === 'current' && totals !== null;
  const withheld = state === 'none' ? NOT_CALCULATED : CLEARED;
  // BN is a dash with the sentence when no Tool Cost was entered; the sentence names the file cell, so the tile's own line would name it twice.
  const noToolCostEntered = current && totals.pricePerToolCost === null;
  return (
    <section aria-label={TILES_LABEL} className="grid grid-cols-1 gap-s-4 md:grid-cols-3">
      <Tile name={BL_NAME} letter={letters.totalPrice} note={state === 'out-of-date' ? BL_CLEARED_HINT : undefined}>
        {current ? formatRupees(totals.totalPrice) : word(withheld)}
      </Tile>
      <Tile
        name={BN_NAME}
        letter={letters.pricePerToolCost}
        fileCellLine={!noToolCostEntered}
        note={noToolCostEntered ? noToolCost(letters.pricePerToolCost) : state === 'out-of-date' ? BN_CLEARED_HINT : BN_HINT(letters.totalPrice)}
      >
        {current ? formatFigure(totals.pricePerToolCost) : formatFigure(null)}
      </Tile>
      {approval === null ? (
        <Tile name={BO_NAME} letter={letters.approvedPrice} note={state === 'out-of-date' ? APPROVED_NOT_SET_CLEARED_HINT : APPROVED_NOT_SET_HINT}>
          {APPROVED_NOT_SET}
        </Tile>
      ) : (
        <Tile
          name={BO_NAME}
          letter={letters.approvedPrice}
          note={
            <>
              {approvedByLine(approval.approverName, approval.approvedAtLabel)}
              <OverrideLines approval={approval} />
            </>
          }
        >
          {formatRupees(approval.price)}
        </Tile>
      )}
    </section>
  );
}
