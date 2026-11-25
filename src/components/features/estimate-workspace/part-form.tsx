'use client';

import { useEffect } from 'react';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SaveGate } from '@/lib/estimates/save-gate';

import { FAILED_BODY, FORM_LOAD_FAILED_TITLE, FORM_LOADING, FORM_NO_PART, TRY_AGAIN } from './estimate-texts';
import type { PartFieldsProps } from './part-fields';
import { useFormDefinition } from './use-form-definition';
import { useLazyComponent } from './use-lazy-component';
import type { PartTarget, SavedPart } from './use-part-form';

/** The fields' code: a bare `import()` behind a type-only import above, so none of it is in the first load (NFR-009, ADR-016 E1). Asked for as soon as the form is on the page, in step with the two reads that gate it. */
const loadFields = () => import('./part-fields').then((module) => module.PartFields);

export interface PartFormProps {
  readonly estimateId: string;
  /** The part chosen in the tree, or null while the tree has none. */
  readonly part: PartTarget | null;
  /** False once the estimate may no longer be changed by this person (the server refuses a save regardless). */
  readonly editable: boolean;
  /** A save went through: the tree takes the part's new revision and how complete it is. */
  readonly onSaved: (saved: SavedPart) => void;
  /** The server says the part is not as the person saw it: the tree is read again. */
  readonly onChanged: () => void;
  /** A save was refused because the estimate was ignored (CR-01 item 7D): the page shows its alert. */
  readonly onServerIgnored: () => void;
  /** The IDs of this part's fields that Calculate found blank (STORY-05.09). */
  readonly missing: ReadonlySet<string>;
  /** What Calculate waits for: the saves in flight and the fields that show a value that is not saved (STORY-05.09). */
  readonly gate: SaveGate;
  /** Called once the form has something to show for the part (its fields, or the notice that they could not be read): the workspace then lets the tree-width controls load, so their code never competes with the form's (AQP-426, DEF-085). */
  readonly onShown?: () => void;
}

/**
 * The part form of SCR-05 (STORY-05.03): the sections 01 Part details and 02 Material and dimensions for the part chosen in the tree. The form's definition and the materials are
 * read once for the estimate (`useFormDefinition`); each part's fields and values live under a key of the part's ID (`PartFields`), so choosing another part shows its own values and
 * nothing typed into one can land in another. Skeleton cards while it loads, a notice with "Try again" when it cannot be read. No rate, cost or formula is requested, held or drawn: the
 * server's form has none, and the materials are IDs and names.
 */
export function PartForm({ estimateId, part, editable, onSaved, onChanged, onServerIgnored, missing, gate, onShown }: PartFormProps) {
  const definition = useFormDefinition(estimateId);
  const fields = useLazyComponent<PartFieldsProps>(loadFields, true);
  const Fields = fields.Component;
  const shown = part !== null && (definition.form.status === 'failed' || fields.failed || (definition.form.status === 'ready' && Fields !== null));
  useEffect(() => {
    if (shown) onShown?.();
  }, [shown, onShown]);

  if (part === null) return <p className="min-w-0 flex-1 text-body text-ink-2">{FORM_NO_PART}</p>;
  if (definition.form.status === 'failed') {
    return (
      <Notice tone="danger" title={FORM_LOAD_FAILED_TITLE}>
        <p>{FAILED_BODY}</p>
        <Button variant="secondary" className="mt-s-2" onClick={definition.readAgain}>
          {TRY_AGAIN}
        </Button>
      </Notice>
    );
  }
  if (fields.failed) {
    // The fields' code did not come: the same notice, and "Try again" asks for the code again.
    return (
      <Notice tone="danger" title={FORM_LOAD_FAILED_TITLE}>
        <p>{FAILED_BODY}</p>
        <Button variant="secondary" className="mt-s-2" onClick={fields.retry}>
          {TRY_AGAIN}
        </Button>
      </Notice>
    );
  }
  if (definition.form.status === 'loading' || Fields === null) {
    return (
      <div role="status" aria-label={FORM_LOADING} className="flex min-w-0 flex-1 flex-col gap-s-3">
        <Skeleton className="h-(--control-h)" />
        <Skeleton className="h-(--control-h)" />
        <Skeleton className="h-(--control-h)" />
      </div>
    );
  }

  return (
    <Fields
      key={part.id}
      estimateId={estimateId}
      part={part}
      editable={editable}
      form={definition.form.value}
      materials={definition.materials}
      lastSavedAt={definition.lastSavedAt}
      onSaved={onSaved}
      onChanged={onChanged}
      onServerIgnored={onServerIgnored}
      onWrote={definition.wrote}
      onReadMaterialsAgain={definition.readAgain}
      missing={missing}
      gate={gate}
    />
  );
}
