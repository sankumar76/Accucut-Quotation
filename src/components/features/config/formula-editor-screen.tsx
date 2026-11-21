'use client';

import { RotateCcw, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useLazyComponent } from '@/components/features/estimate-workspace/use-lazy-component';
import { Icon } from '@/components/shared/icon';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listConfigFields, type ConfigFieldRow } from '@/lib/config/fields-client';
import { readConfigVersionNumber } from '@/lib/config/formula-editor-client';

import {
  BACK_LABEL,
  EDITOR_FAILED_TITLE,
  EDITOR_LOADING_LABEL,
  FORMULA_EDITOR_DESCRIPTION,
  FORMULA_EDITOR_TITLE,
  LOAD_ERROR_TITLE,
  LOAD_RETRY,
  LOADING_LABEL,
  NO_FORMULA_LINE,
  NO_FORMULA_TITLE,
} from './formula-editor-texts';
import type { FormulaEditorProps } from './formula-editor';

/**
 * SCR-18 "Formula editor" at `/config/fields/<id>/formula` (STORY-08.02): the part of the page that is in its first load. It reads the version in force and the list of fields, finds the one named in the
 * address, and shows the editor, whose code is **fetched after the page is up** (`useLazyComponent`; NFR-009: the route is held to 200 KB of first-load JavaScript, and the suggestions, the preview and the
 * password dialog are not needed to draw the title). It decides nothing: whether this field has a formula, and every sentence of the check and the save, are the server's.
 *
 * **The version is read first, then the fields.** If another save lands between the two reads the editor holds an older number than its formulas, so a save is refused with the 409 and never writes over a
 * newer version without the Admin having seen it.
 */

type Loaded =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'no-formula' }
  | { readonly kind: 'ready'; readonly field: ConfigFieldRow; readonly fields: ReadonlyArray<ConfigFieldRow>; readonly version: number };

/** The editor's code: a bare `import()`, so a failed request can be tried again (a rejected `React.lazy` cannot). */
const loadEditor = (): Promise<React.ComponentType<FormulaEditorProps>> => import('./formula-editor').then((module) => module.FormulaEditor);

/** The two reads, in this order, and what the screen shows for their answers. */
async function readEditorData(fieldId: string): Promise<Loaded> {
  const version = await readConfigVersionNumber();
  if (version.status !== 'ok') return { kind: 'error' };
  const fields = await listConfigFields();
  if (fields.status !== 'ok') return { kind: 'error' };
  const field = fields.value.find((row) => row.id === fieldId);
  if (field === undefined || !field.canEditFormula || field.formula === null) return { kind: 'no-formula' };
  return { kind: 'ready', field, fields: fields.value, version: version.value };
}

function useEditorData(fieldId: string): { readonly loaded: Loaded; readonly retry: () => void } {
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  // Each press of "Try again" is a new attempt, so the reads start again.
  const [attempt, setAttempt] = useState(0);
  // The first read starts when the screen opens: the state is `loading` already, so nothing is set first.
  useEffect(() => {
    let live = true;
    void readEditorData(fieldId).then((next) => {
      if (live) setLoaded(next);
    });
    return () => {
      live = false;
    };
  }, [fieldId, attempt]);
  const retry = useCallback((): void => {
    setLoaded({ kind: 'loading' });
    setAttempt((count) => count + 1);
  }, []);
  return { loaded, retry };
}

function Frame({ children, title = FORMULA_EDITOR_TITLE, description }: { readonly children: React.ReactNode; readonly title?: string; readonly description?: string }) {
  return (
    <>
      <PageHeader title={title} {...(description === undefined ? {} : { description })} />
      <Card>{children}</Card>
    </>
  );
}

function LoadedEditor({ field, fields, version }: FormulaEditorProps) {
  const { Component: Editor, failed, retry } = useLazyComponent<FormulaEditorProps>(loadEditor, true);
  if (Editor !== null) return <Editor field={field} fields={fields} version={version} />;
  if (failed) {
    return (
      <Frame>
        <ErrorState
          title={EDITOR_FAILED_TITLE}
          focusOnMount
          action={
            <Button onClick={retry}>
              <Icon icon={RotateCcw} />
              {LOAD_RETRY}
            </Button>
          }
        />
      </Frame>
    );
  }
  return (
    <Frame>
      <SkeletonBlock rows={4} label={EDITOR_LOADING_LABEL} />
    </Frame>
  );
}

export function FormulaEditorScreen({ fieldId }: { readonly fieldId: string }) {
  const { loaded, retry } = useEditorData(fieldId);
  if (loaded.kind === 'ready') return <LoadedEditor field={loaded.field} fields={loaded.fields} version={loaded.version} />;
  if (loaded.kind === 'error') {
    return (
      <Frame description={FORMULA_EDITOR_DESCRIPTION}>
        <ErrorState
          title={LOAD_ERROR_TITLE}
          focusOnMount
          action={
            <Button onClick={retry}>
              <Icon icon={RotateCcw} />
              {LOAD_RETRY}
            </Button>
          }
        />
      </Frame>
    );
  }
  if (loaded.kind === 'no-formula') {
    return (
      <Frame>
        <div role="status">
          <EmptyState
            icon={<Icon icon={SearchX} size="state" />}
            title={NO_FORMULA_TITLE}
            description={NO_FORMULA_LINE}
            action={
              <Button asChild variant="secondary">
                <Link href="/config/fields">{BACK_LABEL}</Link>
              </Button>
            }
          />
        </div>
      </Frame>
    );
  }
  return (
    <Frame description={FORMULA_EDITOR_DESCRIPTION}>
      <SkeletonBlock rows={4} label={LOADING_LABEL} />
    </Frame>
  );
}
