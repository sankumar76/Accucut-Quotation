'use client';

import { RotateCcw } from 'lucide-react';

import { errorReference, SystemPageCard } from '@/components/features/system-pages/system-page';
import { SystemPageFrame } from '@/components/features/system-pages/system-page-frame';
import { RETRY_BUTTON_CLASSES } from '@/components/features/system-pages/retry-button-classes';
import { Icon } from '@/components/shared/icon';
import { useRetryRead } from '@/components/shared/use-retry-read';

/**
 * SCR-26 "server error" (STORY-01.02 AC-8): the boundary for a page that failed while rendering. It shows a reference the
 * person can read out (`req-` and the digest that Next.js gives the failed render and writes to the server log) and
 * never the error's message or stack, which in a production build Next.js has already replaced. Its one action asks the server for the page
 * again (a refresh and then `reset`, DEF-033) and so does not draw the failed answer again.
 *
 * It is a client component, so it is part of every page's first load: keep it small (NFR-009, AQP-188, PRF-01). It imports
 * the shared card and frame, but not `Button`, `next/link` or the home action.
 */
export default function ErrorBoundary({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const retry = useRetryRead(reset);
  return (
    <SystemPageFrame>
      <SystemPageCard
        kind="error"
        reference={errorReference(error.digest)}
        action={
          <button type="button" data-slot="button" data-size="default" className={RETRY_BUTTON_CLASSES} onClick={retry}>
            <Icon icon={RotateCcw} /> Try again
          </button>
        }
      />
    </SystemPageFrame>
  );
}
