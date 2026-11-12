'use client';

import { useEffect, useRef } from 'react';

import { Notice } from '@/components/shared/notice';
import { revealNearest } from '@/lib/ui/reveal';

import { FAILED_DIALOGS_MESSAGE } from './master-texts';

/**
 * What a masters screen shows when the code of its dialogs did not arrive (`loader.failed` of `useDialogOpener`): a danger notice, brought into
 * view if it is off the screen (UX spec v0.14, SCR-25). The next press of the button tries again. The title is the screen's: a confirmation
 * ("The confirmation did not open.") or a form ("The form did not open.").
 */
export function MasterDialogsFailed({ title }: { readonly title: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    revealNearest(box.current);
  }, []);
  return (
    <div ref={box}>
      <Notice tone="danger" title={title}>
        {FAILED_DIALOGS_MESSAGE}
      </Notice>
    </div>
  );
}
