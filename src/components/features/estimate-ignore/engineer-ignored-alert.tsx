'use client';

import { useEffect, useRef } from 'react';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';

import { ENGINEER_IGNORED_ALERT_ID } from './ignore-ids';
import { ENGINEER_IGNORED_ALERT, RELOAD_PAGE_LABEL } from './ignore-texts';

/**
 * The alert of SCR-05 when a save, an auto-save or a Calculate was refused with the 409 of an ignored estimate (CR-01 item 7D, AQP-401 AC-8; UX 12944 section 4): a Lead or an Admin ignored the task while the Engineer
 * worked, and **nothing the Engineer just typed was stored**. It says exactly that, takes focus when it appears so it is read, and offers **Reload page**, which draws the page again from the server: the notice with the
 * remarks. The page turns read-only and stops its timer at the same moment (`EstimateWorkspace`). It is said only for the server's 409, which is given before anything is saved; a lost answer keeps the generic
 * failed-write words. It is fetched by a bare `import()` only when the server says so, so it is in no first load (NFR-009). No figure is anywhere in it (NFR-002).
 */
export function EngineerIgnoredAlert() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
  }, []);
  return (
    <div id={ENGINEER_IGNORED_ALERT_ID} ref={box} tabIndex={-1} className="flex flex-col gap-s-3 rounded-md">
      <Notice tone="danger" role="alert">
        {ENGINEER_IGNORED_ALERT}
      </Notice>
      <div>
        <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
          {RELOAD_PAGE_LABEL}
        </Button>
      </div>
    </div>
  );
}
