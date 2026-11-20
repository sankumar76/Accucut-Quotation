'use client';

import { RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';

import { useLazyComponent } from '@/components/features/estimate-workspace/use-lazy-component';
import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { ErrorState, SkeletonBlock } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { loadInsertOptions, type InsertOptions } from '@/lib/config/insert-field-client';

import {
  INSERT_DESCRIPTION,
  INSERT_TITLE,
  LOAD_ERROR_TITLE,
  LOAD_RETRY,
  LOADING_LABEL,
  WIZARD_FAILED_TITLE,
  WIZARD_LOADING_LABEL,
} from './insert-field-texts';
import type { InsertFieldWizardProps } from './insert-field-wizard';

/**
 * SCR-19 "Insert field" at `/config/fields/new` (STORY-08.03): the part of the page that is in its first load. It asks the Admin-only route for what the wizard offers (the columns, the sections, the stages and the
 * version it opens on) and shows the wizard, whose code is **fetched after the page is up** (`useLazyComponent`; NFR-009: the route is held to 200 KB of first-load JavaScript, and the three steps are not needed to
 * draw the title). It decides nothing: what may be inserted, and every sentence of a refusal, are the server's.
 *
 * The options carry **the version the wizard is opened on**: the save sends it back, so an insert never lands on a version the Admin has not seen (a newer one is the 409).
 */

type Loaded = { readonly kind: 'loading' } | { readonly kind: 'error' } | { readonly kind: 'ready'; readonly options: InsertOptions };

/** The wizard's code: a bare `import()`, so a failed request can be tried again (a rejected `React.lazy` cannot). */
const loadWizard = (): Promise<ComponentType<InsertFieldWizardProps>> => import('./insert-field-wizard').then((module) => module.InsertFieldWizard);

function useInsertOptions(): { readonly loaded: Loaded; readonly retry: () => void } {
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  // Each press of "Try again" is a new attempt, so the read starts again.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void loadInsertOptions().then((outcome) => {
      if (live) setLoaded(outcome.status === 'ok' ? { kind: 'ready', options: outcome.value } : { kind: 'error' });
    });
    return () => {
      live = false;
    };
  }, [attempt]);
  const retry = useCallback((): void => {
    setLoaded({ kind: 'loading' });
    setAttempt((count) => count + 1);
  }, []);
  return { loaded, retry };
}

function Frame({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <PageHeader title={INSERT_TITLE} description={INSERT_DESCRIPTION} />
      <Card>{children}</Card>
    </>
  );
}

function RetryState({ title, onRetry }: { readonly title: string; readonly onRetry: () => void }) {
  return (
    <Frame>
      <ErrorState
        title={title}
        focusOnMount
        action={
          <Button onClick={onRetry}>
            <Icon icon={RotateCcw} />
            {LOAD_RETRY}
          </Button>
        }
      />
    </Frame>
  );
}

function LoadedWizard({ options, afterId }: InsertFieldWizardProps) {
  const { Component: Wizard, failed, retry } = useLazyComponent<InsertFieldWizardProps>(loadWizard, true);
  if (Wizard !== null) return <Wizard options={options} afterId={afterId} />;
  if (failed) return <RetryState title={WIZARD_FAILED_TITLE} onRetry={retry} />;
  return (
    <Frame>
      <SkeletonBlock rows={4} label={WIZARD_LOADING_LABEL} />
    </Frame>
  );
}

export function InsertFieldScreen({ afterId }: { readonly afterId: string | null }) {
  const { loaded, retry } = useInsertOptions();
  if (loaded.kind === 'ready') return <LoadedWizard options={loaded.options} afterId={afterId} />;
  if (loaded.kind === 'error') return <RetryState title={LOAD_ERROR_TITLE} onRetry={retry} />;
  return (
    <Frame>
      <SkeletonBlock rows={4} label={LOADING_LABEL} />
    </Frame>
  );
}
