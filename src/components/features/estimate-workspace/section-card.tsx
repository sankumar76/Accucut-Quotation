import { TriangleAlert } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { Icon } from '@/components/shared/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { FormSection } from '@/lib/estimates/form-client';
import type { SectionProgress } from '@/lib/estimates/form-values';

import { columnRangeLabel, progressText, TREE_MISSING_INPUTS, sectionRegionLabel } from './estimate-texts';

export interface SectionCardProps {
  readonly section: Pick<FormSection, 'id' | 'number' | 'name' | 'columnRange'>;
  /** How many of its fields are filled ("2 of 5 complete"); null for a card with nothing to fill, which shows no count (STORY-05.04 AC-6). */
  readonly progress: SectionProgress | null;
  /** Calculate found a field of this card blank (STORY-05.09): the card says so, in words and an icon, as its fields do. */
  readonly missing?: boolean;
  /** How much of the row the card takes (`sectionWeight`): the compact layout gives each card a share of its row that follows its number of fields. */
  readonly weight: number;
  readonly children: ReactNode;
}

/** A card's share of its row follows its weight (`--n`), and a card never overflows the row (`min-w-0`, in `Card`); below 768 px it takes the whole row. */
const CARD_SHARE = 'flex-[var(--n)_1_calc(var(--n)_*_var(--compact-weight-unit))] max-md:flex-[1_1_100%]';

/** The fields of a card: 12 px padding and gaps, an auto-fill grid with a least column, a multi-line box, the treatments and the picture across the row (the picture two columns, the whole row on a phone). */
const FIELDS =
  'grid grid-cols-[repeat(auto-fill,minmax(var(--compact-column-min),1fr))] gap-s-3 p-s-3 md:p-s-3 [&>:has([data-slot=textarea])]:col-span-full [&>[data-treatments]]:col-span-full [&>:has([data-picture-zone])]:col-span-full min-[480px]:[&>:has([data-picture-zone])]:col-span-2';

/** The weight as a custom property of the card's style, which the share of its row is worked out from. */
type CardShare = CSSProperties & Record<'--n', number>;

/** The id of a card's heading: the section strip jumps to it and the card is labelled by it. */
export const sectionTitleId = (sectionId: string): string => `part-section-${sectionId}`;

/**
 * One section of the part form (STORY-05.03 AC-1, STORY-05.04 AC-1; UX spec SCR-05 "Layout rules", "Accessibility"): a labelled region whose header shows the section number, its name,
 * the tag of its column range, taken from the registry ("01 Part Details", "A–D, G, H"), and "n of m complete". A screen reader reads the tag as "Excel columns ..." and not as a
 * string of letters. The heading can take focus (the section strip's links jump to it). The fields flow inside; the cards sit side by side in the form's wrapping rows, each one's share of
 * a row following its weight (its number of fields, `--n`, 150 px each), and one to a row on a phone; its fields flow in rows of columns never narrower than 140 px, and what holds a multi-line box, the surface
 * treatments or the picture takes the whole row (the picture two columns, and the whole row below 480 px). The numbers are the tokens of the compact layout in `globals.css` (CR-01 item 1; AQP-388).
 */
export function SectionCard({ section, progress, missing = false, weight, children }: SectionCardProps) {
  const titleId = sectionTitleId(section.id);
  const share: CardShare = { '--n': weight };
  return (
    <Card role="region" aria-labelledby={titleId} style={share} className={cn(CARD_SHARE, missing && 'border-danger-line')}>
      <CardHeader className="justify-between px-s-3 py-s-2 md:px-s-3">
        <CardTitle id={titleId} as="h3" tabIndex={-1}>
          {sectionRegionLabel(section.number, section.name)}
        </CardTitle>
        <span className="rounded-sm bg-surface-2 px-s-1 font-mono text-label text-ink-2">
          <span className="sr-only">{columnRangeLabel(section.columnRange)}</span>
          <span aria-hidden="true">{section.columnRange}</span>
        </span>
        {progress === null ? null : <p className="w-full text-label text-ink-2">{progressText(progress.complete, progress.total)}</p>}
        {missing ? (
          <p className="flex w-full items-center gap-s-1 text-label font-semibold text-danger">
            <Icon icon={TriangleAlert} size="hint" className="shrink-0" />
            {TREE_MISSING_INPUTS}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className={FIELDS}>{children}</CardContent>
    </Card>
  );
}
