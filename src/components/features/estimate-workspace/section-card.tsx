import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FormSection } from '@/lib/estimates/form-client';

import { columnRangeLabel, sectionRegionLabel } from './estimate-texts';

export interface SectionCardProps {
  readonly section: Pick<FormSection, 'id' | 'number' | 'name' | 'columnRange'>;
  readonly children: ReactNode;
}

/**
 * One section of the part form (STORY-05.03 AC-1; UX spec SCR-05 "Layout rules", "Accessibility"): a labelled region whose header shows the section number, its name and the
 * tag of its column range, taken from the registry ("01 Part Details", "A, B, D, H"). A screen reader reads the tag as "Excel columns ..." and not as a string of letters. The
 * fields stack inside; the cards sit in the form's grid, one column on a phone and more as the width allows.
 */
export function SectionCard({ section, children }: SectionCardProps) {
  const titleId = `part-section-${section.id}`;
  return (
    <Card role="region" aria-labelledby={titleId} className="self-start">
      <CardHeader className="justify-between">
        <CardTitle id={titleId} as="h3">
          {sectionRegionLabel(section.number, section.name)}
        </CardTitle>
        <span className="rounded-sm bg-surface-2 px-s-1 font-mono text-label text-ink-2">
          <span className="sr-only">{columnRangeLabel(section.columnRange)}</span>
          <span aria-hidden="true">{section.columnRange}</span>
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-s-4">{children}</CardContent>
    </Card>
  );
}
