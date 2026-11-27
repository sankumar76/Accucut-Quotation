import { Check, TriangleAlert } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { cn } from '@/lib/cn';
import { STRIP_BOX, STRIP_ITEM, STRIP_LINK, STRIP_LIST, STRIP_STICKY } from '@/components/shared/form-layout';
import type { FormSection } from '@/lib/estimates/form-client';

import { SECTION_COMPLETE_TEXT, TREE_MISSING_INPUTS, SECTION_STRIP_LABEL, sectionLinkText } from './estimate-texts';
import { sectionTitleId } from './section-card';

export interface SectionStripItem {
  readonly section: Pick<FormSection, 'id' | 'number' | 'shortName'>;
  /** Everything the card asks for is filled: a check follows the name. A card with nothing to fill never has one. */
  readonly complete: boolean;
  /** Calculate found a field of the card blank (STORY-05.09): a triangle follows the name, spoken as "Missing inputs". Never with a check. */
  readonly missing?: boolean;
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
      className={cn(STRIP_STICKY, STRIP_BOX)}
    >
      {/* `relative`, so the spoken-only words of a link ("All filled in", "Missing inputs", positioned absolutely) are clipped by this list's own scroll and do not reach the page: their containing block would otherwise be the sticky bar around it, which does not clip, and a link far along the strip pushed the page sideways. */}
      <ul className={STRIP_LIST}>
        {items.map(({ section, complete, missing = false }) => (
          <li key={section.id} className={STRIP_ITEM}>
            <a
              href={`#${sectionTitleId(section.id)}`}
              onClick={(event) => jumpTo(event, section.id)}
              className={cn(STRIP_LINK, 'hover:bg-surface-2')}
            >
              {sectionLinkText(section.number, section.shortName)}
              {missing ? (
                <>
                  <Icon icon={TriangleAlert} size="small" className="text-danger" />
                  <span className="sr-only">{` ${TREE_MISSING_INPUTS}`}</span>
                </>
              ) : complete ? (
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
