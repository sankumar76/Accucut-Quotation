'use client';

import { RotateCcw } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { ErrorState, SkeletonBlock } from '@/components/shared/states';
import type { FirstOpenControl } from '@/components/shared/use-first-open';
import { Button } from '@/components/ui/button';

import { EXCHANGE_ERROR_TITLE, EXCHANGE_LOADING_LABEL } from './exchange-rate-texts';
import type { ExchangeRatesPanelProps } from './exchange-rates-panel';
import { ERROR_RETRY } from './process-texts';

/**
 * Where the Exchange rates panel goes in the tab shell (STORY-02.04; PRF-01 of GitHub issue 121): the panel's code is fetched the first time the
 * tab is opened, through the shared first-open loader (architecture section 10, AQP-188), and is not in the first load of the page. Until the
 * code is here the slot shows the skeleton; if the request for it failed it says so, with Try again, which asks again.
 */

export interface ExchangeRatesSlotProps {
  readonly loader: FirstOpenControl<ExchangeRatesPanelProps>;
}

export function ExchangeRatesSlot({ loader }: ExchangeRatesSlotProps) {
  const Panel = loader.shown ? loader.Overlay : null;
  if (Panel !== null) return <Panel />;
  if (loader.failed) {
    return (
      <ErrorState
        title={EXCHANGE_ERROR_TITLE}
        focusOnMount
        action={
          <Button onClick={() => loader.activate(false)}>
            <Icon icon={RotateCcw} />
            {ERROR_RETRY}
          </Button>
        }
      />
    );
  }
  return <SkeletonBlock rows={2} label={EXCHANGE_LOADING_LABEL} />;
}
