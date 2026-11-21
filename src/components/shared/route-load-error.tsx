'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startTransition } from 'react';

import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** The label of the retry button on every load error (UX spec section 6.0 "Error (load)"). */
export const TRY_AGAIN_LABEL = 'Try again';

export interface RouteLoadErrorProps {
  /** The page header kept above the error, so the person still knows where they are. */
  readonly pageTitle: string;
  /** "We could not load ...". */
  readonly title: string;
  /** The sentence under the title; the state's standard "Nothing was changed." when it is left out (true of a read). */
  readonly description?: string;
  /** The `reset` that Next.js hands to an `error.tsx`. */
  readonly reset: () => void;
}

/**
 * The body of a route-level `error.tsx` for a data screen (STORY-10.07 AC-4, ux-spec section 6.0 "Error (load)"): the page header, then the shared error
 * state in a card, with focus on its title and one Try again button. It shows the words it is given and nothing the error carries (no message, no stack, no
 * digest): what failed is in the server's log (NFR-024). A page that failed while the server rendered it is not drawn again by `reset` alone, because the
 * failed answer is still the one the client holds, so Try again asks the server for the route again and then resets the boundary.
 *
 * This file is part of the first load of every page that uses it: it imports only the shared parts the other error pages already load (NFR-009).
 */
export function RouteLoadError({ pageTitle, title, description, reset }: Readonly<RouteLoadErrorProps>) {
  const router = useRouter();
  const retry = (): void => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };
  return (
    <>
      <PageHeader title={pageTitle} />
      <Card>
        <ErrorState
          title={title}
          {...(description === undefined ? {} : { description })}
          focusOnMount
          action={
            <Button onClick={retry}>
              <Icon icon={RotateCcw} />
              {TRY_AGAIN_LABEL}
            </Button>
          }
        />
      </Card>
    </>
  );
}
