'use client';

import { Notice } from '@/components/shared/notice';
import { NativeSelect } from '@/components/ui/native-select';
import { Label } from '@/components/ui/label';
import type { FedFieldView, SampleRowView } from '@/lib/config/formula-editor-client';
import { formatCount, NO_FIGURE } from '@/lib/money';

import {
  NO_SAMPLE_LINE,
  NO_SAMPLE_TITLE,
  PREVIEW_HEADING,
  PREVIEW_RESULT_LABEL,
  PREVIEW_WAITING,
  SAMPLE_FAILED_LINE,
  SAMPLE_ROW_LABEL,
  sampleRowOption,
  sampleRowsLine,
  USED_BY_HEADING,
  USED_BY_NONE,
  WHOLE_ESTIMATE_LINE,
} from './formula-editor-texts';
import type { CheckState } from './use-formula-check';

/**
 * The preview and the "Used by" list beside the editor (STORY-08.02 AC-1, AC-3, AC-8; SCR-18): the result of the formula on a row of the latest calculated estimate, the values it was worked out from, and the
 * fields that read this column. "The preview changes nothing" is in the words and in the code: it only shows what the check answered. A division by zero is the dash (AC-8).
 */

export type SampleState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly estimateCode: string | null; readonly rows: ReadonlyArray<SampleRowView>; readonly operandNames: ReadonlyArray<string> }
  | { readonly kind: 'failed' };

export interface FormulaPreviewProps {
  readonly sample: SampleState;
  readonly rowId: string | null;
  readonly onRow: (id: string) => void;
  readonly check: CheckState;
  /** True for a formula with one value for the whole estimate, which has no row to choose. */
  readonly wholeEstimate: boolean;
  /** The fields that read this column, from the last valid check, or `null` before there is one. */
  readonly usedBy: ReadonlyArray<FedFieldView> | null;
}

/** An operand's value as the preview prints it: at most four decimals, no trailing zeros, the dash for no figure. */
function operandText(value: string | null): string {
  return formatCount(value === null ? null : value.replace(/(\.\d{4})\d+$/, '$1'));
}

function RowPicker({ rows, rowId, onRow }: { readonly rows: ReadonlyArray<SampleRowView>; readonly rowId: string | null; readonly onRow: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-s-2">
      <Label htmlFor="sample-row">{SAMPLE_ROW_LABEL}</Label>
      <NativeSelect id="sample-row" value={rowId ?? rows[0]?.id ?? ''} onChange={(event) => onRow(event.target.value)}>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {sampleRowOption(row.slNo, row.name)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function Result({ check }: { readonly check: CheckState }) {
  if (check.kind !== 'valid' || check.view.preview === null) return <p className="text-label text-ink-3">{PREVIEW_WAITING}</p>;
  const { preview } = check.view;
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-s-4 gap-y-s-2" aria-label={PREVIEW_HEADING}>
      {preview.operands.map((operand) => (
        <div key={operand.name} className="contents">
          <dt className="min-w-0 text-ink-2 [overflow-wrap:anywhere]">{operand.name}</dt>
          <dd className="text-right font-mono tabular-nums">{operandText(operand.value)}</dd>
        </div>
      ))}
      <dt className="font-semibold text-ink">{PREVIEW_RESULT_LABEL}</dt>
      <dd className="text-right font-mono font-semibold tabular-nums text-ink" data-testid="preview-result">
        {preview.value === null ? NO_FIGURE : preview.shown}
      </dd>
    </dl>
  );
}

function PreviewBody({ sample, rowId, onRow, check, wholeEstimate }: Omit<FormulaPreviewProps, 'usedBy'>) {
  if (sample.kind === 'loading') return null;
  if (sample.kind === 'failed') return <Notice tone="info">{SAMPLE_FAILED_LINE}</Notice>;
  if (sample.estimateCode === null || sample.rows.length === 0) {
    return (
      <Notice tone="info" title={NO_SAMPLE_TITLE}>
        {NO_SAMPLE_LINE}
      </Notice>
    );
  }
  return (
    <>
      {wholeEstimate ? <p className="text-label text-ink-2">{WHOLE_ESTIMATE_LINE}</p> : <RowPicker rows={sample.rows} rowId={rowId} onRow={onRow} />}
      <Result check={check} />
      <p className="text-label text-ink-3">{sampleRowsLine(sample.estimateCode)}</p>
    </>
  );
}

export function FormulaPreview(props: FormulaPreviewProps) {
  const { usedBy } = props;
  return (
    <div className="flex flex-col gap-s-4">
      <h2 className="text-sub font-semibold text-ink">{PREVIEW_HEADING}</h2>
      <PreviewBody sample={props.sample} rowId={props.rowId} onRow={props.onRow} check={props.check} wholeEstimate={props.wholeEstimate} />
      <hr className="border-border" />
      <div className="flex flex-col gap-s-2">
        <h3 className="text-label font-semibold tracking-wide text-ink-2 uppercase">{USED_BY_HEADING}</h3>
        {usedBy === null ? null : usedBy.length === 0 ? (
          <p className="text-ink-2">{USED_BY_NONE}</p>
        ) : (
          <ul className="flex flex-col gap-s-2">
            {usedBy.map((fed) => (
              <li key={fed.letter} className="flex items-center gap-s-2">
                <span className="inline-flex h-s-5 items-center rounded-sm bg-surface-2 px-s-1 font-mono text-label font-medium text-ink-2">{fed.letter}</span>
                <span className="min-w-0 [overflow-wrap:anywhere]">{fed.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
