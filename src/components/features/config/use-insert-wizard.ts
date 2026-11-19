'use client';

import { useState } from 'react';

import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import { previewInsert, saveInsert, type InsertOptions, type InsertPreviewView, type InsertSavedView } from '@/lib/config/insert-field-client';
import {
  buildSpec,
  controlId,
  fieldOrder,
  formatFor,
  initialForm,
  type CostDetails,
  type InputDetails,
  type InsertForm,
  type InsertKind,
  type SingleOutputDetails,
} from '@/lib/config/insert-field-form';

import type { Errors } from './insert-field-controls';
import { decidePreview, decideSave, type WizardNotice } from './insert-field-outcome';
import { stepAnnouncement } from './insert-field-texts';

/**
 * What the insert wizard does (SCR-19; STORY-08.03 AC-2 to AC-4, AC-7, AC-10): the three steps, the typed form, the preview and the save. It decides nothing: every rule and every sentence of a refusal is the
 * server's, and this puts a refusal under the control it names, in the error summary, and moves focus to the first. A refusal at the save sends the Admin back to step 2 with the same typed values; a version
 * that moved on is a notice that can only be answered by starting again; an answer that never came says it is not known whether the fields went in (the portal may have stored them).
 */

export type Step = 1 | 2 | 3;

export type { WizardNotice };

export interface InsertWizard {
  readonly step: Step;
  readonly form: InsertForm;
  readonly errors: Errors;
  readonly preview: InsertPreviewView | null;
  readonly busy: 'previewing' | 'saving' | null;
  readonly notice: WizardNotice | null;
  readonly saved: InsertSavedView | null;
  /** What the polite live region says: the step the Admin is on, and the success. */
  readonly status: string;
  /** Counts the moves the Admin made between steps; the frame puts focus on the new step's heading when it grows (a refusal that sends the Admin back to step 2 puts focus on a control instead). */
  readonly headingRequest: number;
  readonly setKind: (kind: InsertKind) => void;
  readonly setAfter: (id: string) => void;
  readonly patchInput: (patch: Partial<InputDetails>) => void;
  readonly patchOutput: (patch: Partial<SingleOutputDetails>) => void;
  readonly patchCost: (patch: Partial<CostDetails>) => void;
  readonly next: () => void;
  readonly back: () => void;
  readonly showPreview: () => Promise<void>;
  readonly save: () => Promise<void>;
}

function focusControl(field: string): void {
  document.getElementById(controlId(field))?.focus();
}

/** The names a patch changes, as the server names them: `label` of the input is `input.label`. */
const namesOf = (prefix: string, patch: object): string[] => Object.keys(patch).map((key) => `${prefix}.${key}`);

function without(errors: Errors, names: ReadonlyArray<string>): Errors {
  const kept = Object.entries(errors).filter(([name]) => !names.includes(name) && name !== 'document');
  return kept.length === Object.keys(errors).length ? errors : Object.fromEntries(kept);
}

/** The messages of a refusal with no empty slot (the focus hook's type allows one). */
function definedOnly(errors: Readonly<Partial<Record<string, string>>>): Errors {
  return Object.fromEntries(Object.entries(errors).flatMap(([name, message]) => (message === undefined ? [] : [[name, message]])));
}

export function useInsertWizard(options: InsertOptions, afterId: string | null): InsertWizard {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<InsertForm>(() => initialForm(options, afterId));
  const [errors, setErrors] = useState<Errors>({});
  const [preview, setPreview] = useState<InsertPreviewView | null>(null);
  const [busy, setBusy] = useState<InsertWizard['busy']>(null);
  const [notice, setNotice] = useState<WizardNotice | null>(null);
  const [saved, setSaved] = useState<InsertSavedView | null>(null);
  const [status, setStatus] = useState('');
  const [headingRequest, setHeadingRequest] = useState(0);
  const refuse = useFocusOnRefusal(fieldOrder(form.kind), focusControl, (next) => setErrors(definedOnly(next)));

  const goTo = (next: Step): void => {
    setStep(next);
    setStatus(stepAnnouncement(next));
    setHeadingRequest((count) => count + 1);
  };
  const edited = (names: ReadonlyArray<string>): void => {
    setErrors((current) => without(current, names));
    setNotice(null);
  };

  /** The controls a refusal names show their messages and the first gets focus; the Admin is back at step 2, where they are. */
  const refusedAt = (fields: Errors): void => {
    setNotice(null);
    refuse(fields);
    setStep(2);
  };

  const showPreview = async (): Promise<void> => {
    setBusy('previewing');
    setNotice(null);
    const decision = decidePreview(await previewInsert(buildSpec(form), false));
    setBusy(null);
    if (decision.kind === 'preview') {
      setErrors({});
      setPreview(decision.view);
      return goTo(3);
    }
    return decision.kind === 'fields' ? refusedAt(decision.fields) : setNotice(decision.notice);
  };

  const save = async (): Promise<void> => {
    setBusy('saving');
    setNotice(null);
    const decision = decideSave(await saveInsert(buildSpec(form), options.version));
    setBusy(null);
    if (decision.kind === 'saved') {
      setSaved(decision.saved);
      return setStatus(decision.saved.message);
    }
    return decision.kind === 'fields' ? refusedAt(decision.fields) : setNotice(decision.notice);
  };

  return {
    step,
    form,
    errors,
    preview,
    busy,
    notice,
    saved,
    status,
    headingRequest,
    setKind: (kind) => {
      setForm((current) => ({ ...current, kind }));
      setErrors({});
      setNotice(null);
    },
    setAfter: (afterFieldId) => {
      setForm((current) => ({ ...current, afterFieldId }));
      edited(['afterFieldId']);
    },
    patchInput: (patch) => {
      // A text input is drawn as text and a number as a number; the Admin can still change the format after choosing the type.
      const withFormat = patch.dataType !== undefined && patch.numFmt === undefined ? { ...patch, numFmt: formatFor(options, patch.dataType) } : patch;
      setForm((current) => ({ ...current, input: { ...current.input, ...withFormat } }));
      edited(namesOf('input', withFormat));
    },
    patchOutput: (patch) => {
      setForm((current) => ({ ...current, output: { ...current.output, ...patch } }));
      edited(namesOf('output', patch));
    },
    patchCost: (patch) => {
      setForm((current) => ({ ...current, cost: { ...current.cost, ...patch } }));
      edited(namesOf('cost', patch));
    },
    next: () => goTo(2),
    back: () => goTo(step === 3 ? 2 : 1),
    showPreview,
    save,
  };
}
