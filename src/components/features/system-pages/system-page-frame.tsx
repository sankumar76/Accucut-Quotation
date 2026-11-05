import type { ReactNode } from 'react';

import { BrandLockup } from '@/components/shared/brand-lockup';
import { SkipLink } from '@/components/shared/skip-link';

/**
 * The plain page around a system page that is shown outside the portal's own frame: an address no route serves
 * (`app/not-found.tsx`) and a page that failed while rendering (`app/error.tsx`). It has the skip link, the brand and
 * a `main`, like the sign-in page, and no menu: it does not know who is asking, and shows no name, role or menu item.
 * Inside the portal frame the same card is shown by `(portal)/forbidden.tsx` and `(portal)/not-found.tsx`.
 */
export function SystemPageFrame({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="border-b border-border bg-surface p-s-4 md:px-s-5">
        <BrandLockup />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-120 flex-1 flex-col gap-s-5 px-s-4 py-s-5 outline-none md:py-s-7">
        {children}
      </main>
    </div>
  );
}
