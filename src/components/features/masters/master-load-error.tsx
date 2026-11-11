'use client';

import { RotateCcw } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';

import { ERROR_RETRY } from './master-texts';

/**
 * The load error of a masters screen (UX spec section 6.0 "Error (load)"; SCR-11 and the three tabs of SCR-13): the title, the standard line
 * "Check your connection and try again. Nothing was changed." or the screen's own, and a "Try again" button. It takes focus on its title when it
 * appears, so a person who pressed Save or Try again and got an error hears it (DEF-020; `useReadAgain` leaves focus alone for that reason).
 * One component for every masters list and tab, so they cannot drift apart.
 */

export interface MasterLoadErrorProps {
  /** For example "We could not load the rates". */
  readonly title: string;
  /** Asks again. */
  readonly onRetry: () => void;
  /**
   * Replaces the standard line when it would be untrue: after a change that was saved, "Nothing was changed." must not sit under a
   * "Saved" notice.
   */
  readonly description?: string | undefined;
}

export function MasterLoadError({ title, onRetry, description }: MasterLoadErrorProps) {
  return (
    <ErrorState
      title={title}
      {...(description === undefined ? {} : { description })}
      focusOnMount
      action={
        <Button onClick={onRetry}>
          <Icon icon={RotateCcw} />
          {ERROR_RETRY}
        </Button>
      }
    />
  );
}
