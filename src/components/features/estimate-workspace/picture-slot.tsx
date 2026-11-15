'use client';

import { useEffect, useState, type ComponentType } from 'react';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { PICTURE_LOAD_FAILED_TITLE, TRY_AGAIN } from './estimate-texts';
import type { PartPictureProps } from './part-picture';

/** The picture field's code: a bare `import()`, so a failed request can be tried again (a rejected `React.lazy` cannot). A type-only import above, so nothing of it is in the first load. */
const loadPicture = () => import('./part-picture').then((module) => module.PartPicture);

type Loaded = { readonly Control: ComponentType<PartPictureProps> } | 'failed' | null;

/**
 * Where the picture field goes in the part form (STORY-05.07; NFR-009: `/estimates/[code]` is held to 200 KB of first-load JavaScript and has about 1 KB left). The control is fetched
 * when the form opens, after the page is up, so it is in no script the page names; until it arrives a block holds its place, and when the request fails a notice says so and offers
 * "Try again" (the picture is optional, so the rest of the form works either way).
 */
export function PictureSlot(props: PartPictureProps) {
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadPicture().then(
      (Control) => {
        if (live) setLoaded({ Control });
      },
      () => {
        if (live) setLoaded('failed');
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  if (loaded === null) return <Skeleton className="h-s-7" />;
  if (loaded === 'failed') {
    return (
      <Notice tone="danger" title={PICTURE_LOAD_FAILED_TITLE}>
        <Button
          variant="secondary"
          onClick={() => {
            setLoaded(null);
            setAttempt((count) => count + 1);
          }}
        >
          {TRY_AGAIN}
        </Button>
      </Notice>
    );
  }
  const { Control } = loaded;
  return <Control {...props} />;
}
