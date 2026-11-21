import { BrandLockup } from '@/components/shared/brand-lockup';
import { Card, CardContent } from '@/components/ui/card';
import { ABOUT_COPYRIGHT, ABOUT_DESCRIPTION, ABOUT_VERSION } from '@/lib/about-text';

/**
 * SCR-24 "About" (STORY-01.08 AC-1): the logo and name as the top bar shows them, the approved description, the version and the copyright line, in one card.
 * It holds no data and no heading (the page's title is its one `h1`), and it is a server component: no script is sent for it. The words are in `src/lib/about-text.ts`.
 */
export function AboutCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-s-4 md:gap-s-5">
        <BrandLockup alwaysShowSubtitle />
        <p className="text-ink">{ABOUT_DESCRIPTION}</p>
        <hr className="border-border" />
        <div className="flex flex-col gap-s-2">
          <p className="text-ink">{ABOUT_VERSION}</p>
          <p className="text-ink">{ABOUT_COPYRIGHT}</p>
        </div>
      </CardContent>
    </Card>
  );
}
