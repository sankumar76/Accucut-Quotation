import Link from 'next/link';

import { cn } from '@/lib/cn';

export interface BrandLockupProps {
  /** Where the logo links to. Omit for a lockup that is only shown, not clickable. */
  readonly href?: string;
  readonly className?: string;
}

/**
 * The brand in the top bar (FR-086, STORY-10.02 AC-2): the supplied logo file, unaltered, then
 * "ACCUCUT LASERS" in the logo red in Tinos Bold, with "Quotation Portal" beneath it. The logo is
 * `public/accucut-logo.jpg`, byte-identical to docs/03-ux/assets/accucut-logo.jpg (a unit test compares the
 * hashes). It is never redrawn, recoloured, cropped or stretched. "Quotation Portal" is hidden on phones,
 * as in the mock-up, to leave room for the bell and the account menu.
 *
 * A plain `<img>`, not `next/image` (AQP-74 PRF-01): images are `unoptimized` in this project (next.config.ts), so `next/image`
 * only added its client code, which the bundler then copied into the sign-in page and the not-found page more than once
 * (+18.8 KB on `/sign-in`). The file is already the right size, and `fetchPriority="high"` replaces `priority`.
 */
export function BrandLockup({ href, className }: BrandLockupProps) {
  const content = (
    <>
      <img
        src="/accucut-logo.jpg"
        alt="AccuCut logo"
        width={200}
        height={200}
        fetchPriority="high"
        className="block h-(--logo-size) w-(--logo-size) shrink-0"
      />
      <span className="min-w-0">
        <span className="block font-brand text-body leading-tight font-bold tracking-wider text-primary md:text-sub">
          ACCUCUT LASERS
        </span>
        <span className="hidden text-label font-semibold text-ink-2 md:block">Quotation Portal</span>
      </span>
    </>
  );
  const classes = cn('flex min-h-(--control-h) min-w-0 items-center gap-s-2 text-ink no-underline hover:text-ink md:gap-s-3', className);

  return href === undefined ? (
    <div className={classes}>{content}</div>
  ) : (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
