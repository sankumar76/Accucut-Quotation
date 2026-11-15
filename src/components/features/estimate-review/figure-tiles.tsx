import type { ReactNode } from 'react';

import { ColumnTag } from '@/components/shared/column-tag';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFigure, formatRupees } from '@/lib/money';
import type { CostsView } from '@/server/views/schemas/costs';

import {
  APPROVED_NOT_SET,
  APPROVED_NOT_SET_CLEARED_HINT,
  APPROVED_NOT_SET_HINT,
  BL_CLEARED_HINT,
  BL_NAME,
  BN_CLEARED_HINT,
  BN_HINT,
  BN_NAME,
  BO_NAME,
  CLEARED,
  fileCell,
  NOT_CALCULATED,
  noToolCost,
  TILES_LABEL,
} from './review-texts';

/**
 * The three tiles of SCR-06 (STORY-06.02 AC-1, AC-6; UX spec SCR-06 "Content"): BL, BN and BO, each with its plain name, its letter tag and "File cell XX2", **once each**. The figure is only
 * ever what the server handed over for a `current` state; in the other states the tile says "Not calculated" or "Cleared" in words, never an empty box (UX spec SCR-06 "Accessibility").
 * BO is "Not set yet": an approval is STORY-06.06's. A server component with no script, so it adds nothing to the first load.
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

export interface FigureTilesProps {
  readonly state: CostsView['state'];
  readonly letters: CostsView['letters'];
  readonly totals: CostsView['totals'];
}

export function FigureTiles({ state, letters, totals }: FigureTilesProps) {
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
      <Tile name={BO_NAME} letter={letters.approvedPrice} note={state === 'out-of-date' ? APPROVED_NOT_SET_CLEARED_HINT : APPROVED_NOT_SET_HINT}>
        {APPROVED_NOT_SET}
      </Tile>
    </section>
  );
}
