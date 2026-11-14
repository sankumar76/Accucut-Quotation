import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FormSection } from '@/lib/estimates/form-client';
import type { SectionProgress } from '@/lib/estimates/form-values';

import { columnRangeLabel, progressText, sectionRegionLabel } from './estimate-texts';

export interface SectionCardProps {
  readonly section: Pick<FormSection, 'id' | 'number' | 'name' | 'columnRange'>;
  /** How many of its fields are filled ("2 of 5 complete"); null for a card with nothing to fill, which shows no count (STORY-05.04 AC-6). */
  readonly progress: SectionProgress | null;
  readonly children: ReactNode;
}

/** The id of a card's heading: the section strip jumps to it and the card is labelled by it. */
export const sectionTitleId = (sectionId: string): string => `part-section-${sectionId}`;

/**
 * One section of the part form (STORY-05.03 AC-1, STORY-05.04 AC-1; UX spec SCR-05 "Layout rules", "Accessibility"): a labelled region whose header shows the section number, its name,
 * the tag of its column range, taken from the registry ("01 Part Details", "A, B, D, G, H"), and "n of m complete". A screen reader reads the tag as "Excel columns ..." and not as a
 * string of letters. The heading can take focus (the section strip's links jump to it). The fields stack inside; the cards sit in the form's grid, one column on a phone and more as
 * the width allows.
 */
export function SectionCard({ section, progress, children }: SectionCardProps) {
  const titleId = sectionTitleId(section.id);
  return (
    <Card role="region" aria-labelledby={titleId} className="self-start">
      <CardHeader className="justify-between">
        <CardTitle id={titleId} as="h3" tabIndex={-1}>
          {sectionRegionLabel(section.number, section.name)}
        </CardTitle>
        <span className="rounded-sm bg-surface-2 px-s-1 font-mono text-label text-ink-2">
          <span className="sr-only">{columnRangeLabel(section.columnRange)}</span>
          <span aria-hidden="true">{section.columnRange}</span>
        </span>
        {progress === null ? null : <p className="w-full text-label text-ink-2">{progressText(progress.complete, progress.total)}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-s-4">{children}</CardContent>
    </Card>
  );
}
