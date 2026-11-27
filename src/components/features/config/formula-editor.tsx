'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { ColumnTag } from '@/components/shared/column-tag';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import { listSampleRows } from '@/lib/config/formula-editor-client';
import type { ConfigFieldRow } from '@/lib/config/fields-client';
import { listProcessItems } from '@/lib/masters/process-items-client';

import {
  BACK_LABEL,
  BREADCRUMB_LABEL,
  BREADCRUMB_PARENT,
  CANCEL_LABEL,
  CARD_TITLE,
  CHECK_FAILED_LINE,
  CHECK_FAILED_TITLE,
  CHECKING_LINE,
  FORMULA_EDITOR_DESCRIPTION,
  FORMULA_EDITOR_HEADING,
  FORMULA_LABEL,
  NOTHING_TO_SHOW,
  OUTPUT_TAG,
  SAVE_HINT_UNCHANGED,
  SAVE_LABEL,
  SHOWS_IN_COST_DETAILS,
  STALE_ACTION,
} from './formula-editor-texts';
import { FormulaPasswordDialog } from './formula-password-dialog';
import { FormulaPreview, type SampleState } from './formula-preview';
import { FormulaInput } from './suggestions';
import { useFormulaCheck, type CheckState } from './use-formula-check';
import { useSaveFormula } from './use-save-formula';

/**
 * SCR-18 "Formula editor" (STORY-08.02 AC-1 to AC-10; FR-022, FR-023, FR-073, FR-080): a monospace box with suggestions, a live check after a 300 ms pause in a polite live region, "Used by" and a preview on a
 * sample row beside it, and Save, which asks for the Admin's password. It decides nothing: the sentences of the check, the preview and the save are the server's (`POST /config/formula-check`,
 * `PUT /config/fields/{id}/formula`), and Save is off until the server has called the formula valid and it differs from the saved one.
 *
 * This file is **fetched after the page is up** (`formula-editor-screen.tsx`; NFR-009: the route is held to 200 KB of first-load JavaScript), so the suggestions, the preview and the password dialog are not in
 * the first load. It is built for 360, 768 and 1366 px: the preview sits beside the editor from 1024 px and below it otherwise, and nothing is wider than its card.
 */

export interface FormulaEditorProps {
  /** The field being edited, as `GET /config/fields` sent it. */
  readonly field: ConfigFieldRow;
  /** Every field, for the suggestions. */
  readonly fields: ReadonlyArray<ConfigFieldRow>;
  /** The configuration version the editor was opened on. */
  readonly version: number;
}

const CHECK_REGION_ID = 'formula-check';
const FORMULA_ID = 'formula-text';

/** The sample rows of the latest calculated estimate, read once when the editor opens. */
function useSampleRows(): SampleState {
  const [state, setState] = useState<SampleState>({ kind: 'loading' });
  useEffect(() => {
    let live = true;
    void listSampleRows().then((outcome) => {
      if (!live) return;
      setState(
        outcome.status === 'ok'
          ? { kind: 'ready', estimateCode: outcome.value.estimateCode, rows: outcome.value.rows, operandNames: outcome.value.operandNames }
          : { kind: 'failed' },
      );
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** The Process Master's rate names, for the suggestions. A list that cannot be read only leaves the rates out of them. */
function useRateNames(): ReadonlyArray<string> {
  const [names, setNames] = useState<ReadonlyArray<string>>([]);
  useEffect(() => {
    let live = true;
    void listProcessItems().then((outcome) => {
      if (live && outcome.status === 'ok') setNames(outcome.value.map((item) => item.name));
    });
    return () => {
      live = false;
    };
  }, []);
  return names;
}

/** The breadcrumb of the page (the mock-up): back to the list, and the field being edited as the current page. */
function Breadcrumb({ letter, label }: { readonly letter: string; readonly label: string }) {
  return (
    <nav aria-label={BREADCRUMB_LABEL} className="flex flex-wrap items-center gap-s-2 text-body">
      <Link href="/config/fields" className="text-primary-ink underline-offset-2 hover:underline">
        {BREADCRUMB_PARENT}
      </Link>
      <span aria-hidden="true" className="text-ink-3">
        /
      </span>
      <span aria-current="page" className="font-semibold text-ink [overflow-wrap:anywhere]">
        {letter} {label}
      </span>
    </nav>
  );
}

/** "Shows in the cost details as <formula>": the formula as typed, read only, in the mono face; a faint dash while the formula is empty or does not check (nothing is stored and nothing is checked here). */
function ShowsIn({ text, shown }: { readonly text: string; readonly shown: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-s-4 gap-y-s-1 text-body">
      <span className="text-ink-2">{SHOWS_IN_COST_DETAILS}</span>
      {shown ? (
        <code className={cn('font-mono text-ink [overflow-wrap:anywhere]')}>{text}</code>
      ) : (
        <>
          <span aria-hidden="true" className="text-ink-3">
            —
          </span>
          <span className="sr-only">{NOTHING_TO_SHOW}</span>
        </>
      )}
    </div>
  );
}

/** What the live region says: the check on its way, the server's sentence for a valid or an invalid formula, or that no answer came. */
function CheckNotice({ check }: { readonly check: CheckState }) {
  switch (check.kind) {
    case 'checking':
      return (
        <Notice tone="info" role="status">
          {CHECKING_LINE}
        </Notice>
      );
    case 'valid':
      return (
        <Notice tone="success" role="status">
          {check.view.message}
        </Notice>
      );
    case 'invalid':
      return (
        <Notice tone="danger" role="status">
          {check.message}
        </Notice>
      );
    case 'failed':
      return (
        <Notice tone="warn" role="status" title={CHECK_FAILED_TITLE}>
          {CHECK_FAILED_LINE}
        </Notice>
      );
    default:
      return null;
  }
}

export function FormulaEditor({ field, fields, version }: FormulaEditorProps) {
  const savedFormula = field.formula ?? '';
  const [text, setText] = useState(savedFormula);
  const [savedText, setSavedText] = useState(savedFormula);
  const [baseVersion, setBaseVersion] = useState(version);
  const [rowId, setRowId] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const sample = useSampleRows();
  const rateNames = useRateNames();
  const { state: check, lastValid } = useFormulaCheck(field.id, text, rowId);
  const save = useSaveFormula({
    fieldId: field.id,
    text,
    baseVersion,
    onSaved: (saved) => {
      setSavedText(text);
      setBaseVersion(saved);
    },
  });

  const changed = text !== savedText;
  const canSave = check.kind === 'valid' && changed && save.notice?.stale !== true;
  // A formula with one value for the whole estimate (BL) has no row to try it on: the server answers its preview with no Sl. No.
  const wholeEstimate = lastValid?.preview != null && lastValid.preview.slNo === null;
  const source = { fields: fields.map(({ letter, label }) => ({ letter, label })), rateNames, operandNames: sample.kind === 'ready' ? sample.operandNames : [] };

  return (
    <>
      <Breadcrumb letter={field.letter} label={field.label} />
      <PageHeader title={FORMULA_EDITOR_HEADING(field.letter, field.label)} description={FORMULA_EDITOR_DESCRIPTION} />
      {save.notice === null ? null : (
        <Notice tone={save.notice.tone} role="status" {...(save.notice.title === undefined ? {} : { title: save.notice.title })}>
          {save.notice.message}
          {save.notice.tone === 'success' ? (
            <span className="mt-s-2 block">
              <Link href="/config/fields" className="font-semibold underline">
                {BACK_LABEL}
              </Link>
            </span>
          ) : null}
          {save.notice.stale ? (
            <Button className="mt-s-2" variant="secondary" onClick={() => window.location.reload()}>
              {STALE_ACTION}
            </Button>
          ) : null}
        </Notice>
      )}
      <div className="grid gap-s-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex items-center justify-between gap-s-3">
            <CardTitle>{CARD_TITLE}</CardTitle>
            <Badge tone="info">{OUTPUT_TAG}</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-s-4">
            <div className="flex flex-col gap-s-2">
              <Label htmlFor={FORMULA_ID} className="flex flex-wrap items-center gap-s-2">
                {FORMULA_LABEL}
                <ColumnTag letter={field.letter} kind="output" />
              </Label>
              <FormulaInput
                id={FORMULA_ID}
                value={text}
                onChange={setText}
                source={source}
                invalid={check.kind === 'invalid'}
                describedBy={CHECK_REGION_ID}
                inputRef={textarea}
              />
              {lastValid?.note == null ? null : <p className="max-w-prose text-label text-ink-2">{lastValid.note}</p>}
            </div>
            <div id={CHECK_REGION_ID} aria-live="polite" aria-atomic="true">
              <CheckNotice check={check} />
            </div>
            <ShowsIn text={text} shown={text.trim() !== '' && check.kind !== 'invalid'} />
            <div className="flex flex-wrap items-center justify-between gap-s-3 border-t border-border pt-s-4">
              <Button asChild variant="secondary">
                <Link href="/config/fields">{CANCEL_LABEL}</Link>
              </Button>
              <div className="flex flex-col items-end gap-s-1">
                <Button disabled={!canSave} onClick={() => save.setDialogOpen(true)}>
                  {SAVE_LABEL}
                </Button>
                {changed ? null : <span className="text-label text-ink-3">{SAVE_HINT_UNCHANGED}</span>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <FormulaPreview sample={sample} rowId={rowId} onRow={setRowId} check={check} wholeEstimate={wholeEstimate} usedBy={lastValid === null ? null : lastValid.feeds} />
          </CardContent>
        </Card>
      </div>
      <FormulaPasswordDialog open={save.dialogOpen} onOpenChange={save.setDialogOpen} pending={save.pending} error={save.error} onSubmit={save.submit} />
    </>
  );
}
