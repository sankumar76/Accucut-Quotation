import type { ReactNode } from 'react';

import { BrandLockup } from '@/components/shared/brand-lockup';
import { SkipLink } from '@/components/shared/skip-link';

export interface PublicPageFrameProps {
  /** The page's `h1`. */
  readonly title: string;
  /** The sentence under it. */
  readonly description: string;
  readonly children: ReactNode;
}

/**
 * The frame of a page a signed-out person uses, as SCR-01 draws it (STORY-09.07, SCR-02): the skip link, the white top bar with the brand, one narrow column with the heading and its
 * sentence, and the footer. It is the frame of the sign-in page, for the pages of the reset by e-mailed link. It loads nothing from another site and carries no script of its own.
 */
export function PublicPageFrame({ title, description, children }: PublicPageFrameProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      {/* White like the top bar of every other page: the logo red on it is the contrast the design tokens were checked for. */}
      <header className="border-b border-border bg-surface p-s-4 md:px-s-5">
        <BrandLockup />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-[calc(var(--column-w)+var(--s-4)*2)] flex-1 flex-col gap-s-5 px-s-4 py-s-5 outline-none md:py-s-7">
        <div className="flex flex-col gap-s-2">
          <h1 tabIndex={-1} className="text-heading font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="text-ink-2">{description}</p>
        </div>
        {children}
      </main>
      <footer className="p-s-4 text-center text-label text-ink-2">© Accucut Lasers Pvt Ltd. All rights reserved.</footer>
    </div>
  );
}
