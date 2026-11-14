import { Check } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import type { FormSection } from '@/lib/estimates/form-client';

import { SECTION_COMPLETE_TEXT, SECTION_STRIP_LABEL, sectionLinkText } from './estimate-texts';
import { sectionTitleId } from './section-card';

export interface SectionStripItem {
  readonly section: Pick<FormSection, 'id' | 'number' | 'shortName'>;
  /** Everything the card asks for is filled: a check follows the name. A card with nothing to fill never has one. */
  readonly complete: boolean;
}

export interface SectionStripProps {
  readonly items: ReadonlyArray<SectionStripItem>;
}

/** The link takes the keyboard to the card's heading and scrolls it into view clear of the sticky bars (the page's `scroll-padding` follows them). Without script it is a plain jump to the id. */
function jumpTo(event: { preventDefault: () => void }, sectionId: string): void {
  const heading = document.getElementById(sectionTitleId(sectionId));
  if (heading === null) return;
  event.preventDefault();
  heading.focus();
}

/**
 * The section strip (STORY-05.04 AC-6; UX spec SCR-05 "Layout rules": "a sticky row of 8 jump links with a check, a triangle (missing), or nothing"): one link to each card of the form, in
 * order, which stays under the top bar while the form scrolls. A card whose fields are all filled has a check, spoken as "All filled in"; the triangle for a field that Calculate found
 * missing is STORY-05.09's. It is a measured sticky bar (`data-sticky-bar`), so a focused field is never hidden behind it (WCAG 2.4.11). On a phone it scrolls sideways inside its own
 * strip and the page does not. Each link is 44 px tall.
 */
export function SectionStrip({ items }: SectionStripProps) {
  return (
    <nav
      aria-label={SECTION_STRIP_LABEL}
      data-sticky-bar="top"
      data-section-strip=""
      className="sticky top-(--topbar-h) z-(--z-bar) min-w-0 rounded-md border border-border bg-surface px-s-2 shadow-card"
    >
      <ul className="flex min-w-0 gap-s-1 overflow-x-auto py-s-1">
        {items.map(({ section, complete }) => (
          <li key={section.id} className="shrink-0">
            <a
              href={`#${sectionTitleId(section.id)}`}
              onClick={(event) => jumpTo(event, section.id)}
              className="inline-flex min-h-(--control-h) items-center gap-s-1 rounded-md px-s-2 text-body whitespace-nowrap text-ink no-underline hover:bg-surface-2"
            >
              {sectionLinkText(section.number, section.shortName)}
              {complete ? (
                <>
                  <Icon icon={Check} size="small" className="text-success-ink" />
                  <span className="sr-only">{` ${SECTION_COMPLETE_TEXT}`}</span>
                </>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
