'use client';

import { RotateCcw } from 'lucide-react';

import { errorReference, SystemPageCard } from '@/components/features/system-pages/system-page';
import { SystemPageFrame } from '@/components/features/system-pages/system-page-frame';
import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';

/**
 * SCR-26 "server error" (STORY-01.02 AC-8): the boundary for a page that failed while rendering. It shows a reference the
 * person can read out (`req-` and the digest that Next.js gives the failed render and writes to the server log) and
 * never the error's message or stack, which in a production build Next.js has already replaced. Its one action tries the
 * page again.
 *
 * It is a client component, so it is part of every page's first load: keep it small (NFR-009, AQP-188).
 */
export default function ErrorBoundary({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <SystemPageFrame>
      <SystemPageCard
        kind="error"
        reference={errorReference(error.digest)}
        action={
          <Button variant="secondary" onClick={reset}>
            <Icon icon={RotateCcw} /> Try again
          </Button>
        }
      />
    </SystemPageFrame>
  );
}
