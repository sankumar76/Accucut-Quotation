'use client';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { FAILED_BODY, FORM_LOAD_FAILED_TITLE, FORM_LOADING, FORM_NO_PART, TRY_AGAIN } from './estimate-texts';
import { PartFields } from './part-fields';
import { useFormDefinition, type PartTarget, type SavedPart } from './use-part-form';

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
}

/**
 * The part form of SCR-05 (STORY-05.03): the sections 01 Part details and 02 Material and dimensions for the part chosen in the tree. The form's definition and the materials are
 * read once for the estimate (`useFormDefinition`); each part's fields and values live under a key of the part's ID (`PartFields`), so choosing another part shows its own values and
 * nothing typed into one can land in another. Skeleton cards while it loads, a notice with "Try again" when it cannot be read. No rate, cost or formula is requested, held or drawn: the
 * server's form has none, and the materials are IDs and names.
 */
export function PartForm({ estimateId, part, editable, onSaved, onChanged }: PartFormProps) {
  const definition = useFormDefinition(estimateId);

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
  if (definition.form.status === 'loading') {
    return (
      <div role="status" aria-label={FORM_LOADING} className="flex min-w-0 flex-1 flex-col gap-s-3">
        <Skeleton className="h-(--control-h)" />
        <Skeleton className="h-(--control-h)" />
        <Skeleton className="h-(--control-h)" />
      </div>
    );
  }

  return (
    <PartFields
      key={part.id}
      estimateId={estimateId}
      part={part}
      editable={editable}
      form={definition.form.value}
      materials={definition.materials}
      lastSavedAt={definition.lastSavedAt}
      onSaved={onSaved}
      onChanged={onChanged}
      onWrote={definition.wrote}
      onReadMaterialsAgain={definition.readAgain}
    />
  );
}
