'use client';

import { useEffect, useState, type ComponentType } from 'react';

import { PICTURE_ZONE_HEIGHT } from '@/components/shared/form-layout';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { PICTURE_LOAD_FAILED_TITLE, TRY_AGAIN } from './estimate-texts';
import type { PartPictureProps } from './part-picture';

/** The picture field's code: a bare `import()`, so a failed request can be tried again (a rejected `React.lazy` cannot). A type-only import above, so nothing of it is in the first load. */
const loadPicture = () => import('./part-picture').then((module) => module.PartPicture);

type Loaded = { readonly Control: ComponentType<PartPictureProps> } | 'failed' | null;

/**
 * What holds the picture's place until its control arrives (AQP-395, DEF-061; UX spec "Skeleton rows shaped like the content"): the control's three parts, so that nothing in the form moves when it
 * arrives. The label line (24 px, `s-5`), the box (a skeleton that carries `data-picture-zone`, so the card gives it the columns the box takes: `section-card.tsx`) and the hint line (16 px, `s-4`), 8 px
 * apart as in the control. The box is 2 px of border, 24 px of padding and the text column, whose lines wrap with the width: the box is 146 px high below 768 px, 130 px from 768 px and 114 px from
 * 1024 px (read from the control at 360, 768 and 1366 px, `tests/e2e/estimate-picture.spec.ts`, which holds the two within 2 px at those widths). A width between those is as near as its row of text.
 */
function PictureSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-s-2">
      <Skeleton className="h-s-5 w-1/2" />
      <Skeleton data-picture-zone="" className={PICTURE_ZONE_HEIGHT} />
      <Skeleton className="h-s-4 w-2/3" />
    </div>
  );
}

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

  if (loaded === null) return <PictureSkeleton />;
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
