'use client';

import { SkeletonBlock } from '@/components/shared/states';
import type { FirstOpenControl } from '@/components/shared/use-first-open';

import { MasterLoadError } from './master-load-error';

/**
 * Where the panel of a lazily loaded tab of SCR-13 goes in the tab shell (the Exchange rates tab of STORY-02.04 and the Treatment / Color tab of
 * STORY-02.05; PRF-01 of GitHub issue 121): the panel's code is fetched the first time the tab is opened, through the shared first-open loader
 * (architecture section 10, AQP-188), and is not in the first load of the page. Until the code is here the slot shows the skeleton; if the request
 * for it failed it says so, with Try again, which asks again. One component for both tabs, so the two cannot drift apart.
 */

/** A lazily loaded tab panel reads its own data, so it takes no props. */
export type LazyPanelProps = Record<string, never>;

export interface LazyTabSlotProps {
  readonly loader: FirstOpenControl<LazyPanelProps>;
  /** The title of the error shown when the panel's code could not be fetched, for example "We could not load the exchange rates". */
  readonly errorTitle: string;
  /** Read out while the panel's code is on its way, for example "Loading the exchange rates". */
  readonly loadingLabel: string;
  readonly skeletonRows?: number;
}

export function LazyTabSlot({ loader, errorTitle, loadingLabel, skeletonRows = 2 }: LazyTabSlotProps) {
  const Panel = loader.shown ? loader.Overlay : null;
  if (Panel !== null) return <Panel />;
  if (loader.failed) return <MasterLoadError title={errorTitle} onRetry={() => loader.activate(false)} />;
  return <SkeletonBlock rows={skeletonRows} label={loadingLabel} />;
}
