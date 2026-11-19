'use client';

import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Notice } from '@/components/shared/notice';
import type { InsertOptions, InsertPreviewView } from '@/lib/config/insert-field-client';
import type { InsertKind } from '@/lib/config/insert-field-form';
import { newFieldNames } from '@/lib/config/insert-field-form';

import { InputFields } from './insert-field-input-fields';
import { LetterChangesTable, LettersAfterInsert, useLettersAfterInsert } from './insert-field-letters';
import { CostFields, SingleOutputFields } from './insert-field-output-fields';
import {
  COST_HEADING,
  INPUT_HEADING,
  NEW_FORMULAS_HEADING,
  NO_MOVES_LINE,
  NOTICES,
  NOTICES_TITLE,
  OUTPUT_HEADING,
  PREVIEW_NOTE,
  previewLead,
  SAME_RESULTS_LINE,
  TYPE_LEGEND,
  TYPE_OPTIONS,
} from './insert-field-texts';
import type { InsertWizard } from './use-insert-wizard';

/**
 * The three steps of SCR-19 (STORY-08.03 AC-2, AC-3): what to add, its details with the live list of letters beside the formula, and the preview of every letter that changes. Each draws what the wizard hands it
 * and holds no rule; the buttons and the headings are the wizard's frame.
 */

const TYPE_LABEL_ID = 'insert-type-label';

/** Step 1: three cards, one radio button each, so the keyboard chooses with the arrow keys and Next goes on. */
export function StepType({ value, onChange }: { readonly value: InsertKind; readonly onChange: (kind: InsertKind) => void }) {
  return (
    <div className="flex flex-col gap-s-3">
      <span id={TYPE_LABEL_ID} className="text-label font-semibold text-ink-2">
        {TYPE_LEGEND}
      </span>
      <RadioGroup
        value={value}
        onValueChange={(next) => {
          const chosen = TYPE_OPTIONS.find((option) => option.value === next);
          if (chosen !== undefined) onChange(chosen.value);
        }}
        aria-labelledby={TYPE_LABEL_ID}
      >
        {TYPE_OPTIONS.map((option) => (
          <div
            key={option.value}
            className="flex items-start gap-s-1 rounded-lg border border-border-strong p-s-2 has-[[data-state=checked]]:border-primary-ink has-[[data-state=checked]]:bg-primary-soft"
          >
            <RadioGroupItem value={option.value} id={`insert-type-${option.value}`} aria-describedby={`insert-type-${option.value}-text`} />
            <div className="flex min-w-0 flex-col gap-s-1 py-s-2">
              <Label htmlFor={`insert-type-${option.value}`} className="text-body font-semibold text-ink">
                {option.title}
              </Label>
              <p id={`insert-type-${option.value}-text`} className="text-ink-2">
                {option.text}
              </p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

function Block({ heading, children }: { readonly heading: string; readonly children: ReactNode }) {
  return (
    <section aria-label={heading} className="flex flex-col gap-s-4">
      <h3 className="text-sub font-semibold text-ink">{heading}</h3>
      {children}
    </section>
  );
}

/** Step 2: the details of the kind chosen. The "Letters after this insert" list sits beside the formula (and, for an input, which has none, at the end). */
export function StepDetails({ wizard, options }: { readonly wizard: InsertWizard; readonly options: InsertOptions }) {
  const { form, errors } = wizard;
  const lettersState = useLettersAfterInsert(form);
  const letters = <LettersAfterInsert state={lettersState} />;
  const after = { value: form.afterFieldId, onChange: wizard.setAfter };
  return (
    <div className="flex flex-col gap-s-5">
      <Notice tone="info" title={NOTICES_TITLE}>
        <ul className="mt-s-1 list-disc pl-s-5">
          {NOTICES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Notice>
      {form.kind === 'output' ? (
        <Block heading={OUTPUT_HEADING}>
          <SingleOutputFields options={options} value={form.output} onChange={wizard.patchOutput} errors={errors} after={after} aside={letters} />
        </Block>
      ) : (
        <>
          <Block heading={INPUT_HEADING}>
            <InputFields options={options} value={form.input} onChange={wizard.patchInput} errors={errors} after={after} />
            {form.kind === 'input' ? letters : null}
          </Block>
          {form.kind === 'pair' ? (
            <Block heading={COST_HEADING}>
              <CostFields options={options} value={form.cost} onChange={wizard.patchCost} errors={errors} aside={letters} />
            </Block>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Step 3: the new fields, the formula of a new output with its final letters, and the table of every letter that changes, product cells included. */
export function StepPreview({ preview }: { readonly preview: InsertPreviewView }) {
  return (
    <div className="flex flex-col gap-s-4">
      <p>
        {previewLead(newFieldNames(preview))} {preview.moved.length === 0 ? NO_MOVES_LINE : SAME_RESULTS_LINE}
      </p>
      {preview.formulas.length === 0 ? null : (
        <div className="flex flex-col gap-s-2">
          <h3 className="text-label font-semibold text-ink-2">{NEW_FORMULAS_HEADING}</h3>
          <ul className="flex flex-col gap-s-1">
            {preview.formulas.map((formula) => (
              <li key={formula.letter} className="[overflow-wrap:anywhere]">
                <span className="font-semibold">
                  {formula.letter} {formula.label}
                </span>
                {': '}
                <code className="font-mono">{formula.formula}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
      <LetterChangesTable preview={preview} />
      <p className="text-ink-2">{PREVIEW_NOTE}</p>
    </div>
  );
}
