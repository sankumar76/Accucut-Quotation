import { TriangleAlert } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { Icon } from '@/components/shared/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CARD_HEADER, CARD_SHARE, CARD_TITLE, COUNT_TEXT, FIELDS, NUMBER_TILE, RANGE_CHIP } from '@/components/shared/form-layout';
import { cn } from '@/lib/cn';
import type { FormSection } from '@/lib/estimates/form-client';
import type { SectionProgress } from '@/lib/estimates/form-values';

import { columnRangeLabel, TREE_MISSING_INPUTS } from './estimate-texts';

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
  const done = progress !== null && progress.total > 0 && progress.complete === progress.total;
  return (
    <Card role="region" aria-labelledby={titleId} style={share} className={cn(CARD_SHARE, missing && 'border-danger-line')}>
      <CardHeader className={CARD_HEADER}>
        {/* The heading holds the tile, so the region's name stays "01 Part Details": the number, then the name. */}
        <CardTitle id={titleId} as="h3" tabIndex={-1} className={CARD_TITLE}>
          <span data-section-no="" className={cn(NUMBER_TILE, missing ? 'bg-danger' : done ? 'bg-success' : 'bg-nav')}>
            {String(section.number).padStart(2, '0')}
          </span>{' '}
          <span className="min-w-0">{section.name}</span>
        </CardTitle>
        <span className={RANGE_CHIP}>
          <span className="sr-only">{columnRangeLabel(section.columnRange)}</span>
          <span aria-hidden="true">{section.columnRange}</span>
        </span>
        {progress === null ? null : (
          <p data-section-count="" className={COUNT_TEXT}>
            {progress.complete} of {progress.total}
            <span className="sr-only"> complete</span>
          </p>
        )}
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
