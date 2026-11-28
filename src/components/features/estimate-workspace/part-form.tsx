'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PartFormSeed } from '@/lib/estimates/part-form-seed';
import type { SaveGate } from '@/lib/estimates/save-gate';
import type { PartItem } from '@/lib/estimates/tree-client';

import { FAILED_BODY, FORM_LOAD_FAILED_TITLE, FORM_LOADING, FORM_NO_PART, TRY_AGAIN } from './estimate-texts';
import type { PartFieldsProps } from './part-fields';
import type { PartReview } from './review-look';
import { partFormShown } from './tree-controls-ready';
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
  /** The tree as it is now: the form's head names the row and where it sits. */
  readonly nodes: ReadonlyArray<PartItem> | null;
  /** A save went through: the tree takes the part's new revision and how complete it is. Left out by the Lead's read-only view, which saves nothing (AQP-488), and which a server component draws: it hands over only what can be sent. */
  readonly onSaved?: ((saved: SavedPart) => void) | undefined;
  /** The server says the part is not as the person saw it: the tree is read again. */
  readonly onChanged?: (() => void) | undefined;
  /** Description or Part No. was left with a new text: the tree's row takes the name (AQP-447). */
  readonly onNamed?: ((id: string, label: string) => void) | undefined;
  /** A save was refused because the estimate was ignored (CR-01 item 7D): the page shows its alert. */
  readonly onServerIgnored?: (() => void) | undefined;
  /** The IDs of this part's fields that Calculate found blank (STORY-05.09). */
  readonly missing?: ReadonlySet<string> | undefined;
  /** What Calculate waits for: the saves in flight and the fields that show a value that is not saved (STORY-05.09). */
  readonly gate?: SaveGate | undefined;
  /** Called once the form has something to show for the part (its fields, or the notice that they could not be read): the workspace then lets the tree-width controls load, so their code never competes with the form's (AQP-426, DEF-085). */
  readonly onShown?: () => void;
  /** The Lead's and the Admin's read-only view (AQP-488, DEF-131 Stage 1), with `editable` false: the same form with the review look. Absent for the Engineer. */
  readonly review?: PartReview | undefined;
  /** The form's data as the page handed it over (the Lead's review, DEF-141): the definition, the materials, the part's values and the treatments, as the routes send them. The form then reads nothing from the server to start (the Engineer's page too, DEF-085). Absent when the page's reads failed. */
  readonly seed?: PartFormSeed | undefined;
  /**
   * The loading ghost, **drawn on the server** and handed in as an element, as `cards` and `notice` are, so none of its code is in the first load (DEF-145, PF-6): the form without its values, in the form's own cards and rows (`PartFormGhost`).
   * It is what the form area shows from the first paint until the form replaces it, in the same place. Absent where the page could not draw one (its read of the definition failed): the three bars then stand in.
   */
  readonly ghost?: ReactNode;
  /** The Engineer's tree has not been read yet and has not failed (PF-7): there is no part to show because there is no tree, not because none was chosen, so the ghost stands in and "Choose a part" is not said. */
  readonly treeUnread?: boolean | undefined;
}

/**
 * The part form of SCR-05 (STORY-05.03): the sections 01 Part details and 02 Material and dimensions for the part chosen in the tree. The form's definition and the materials are
 * read once for the estimate (`useFormDefinition`); each part's fields and values live under a key of the part's ID (`PartFields`), so choosing another part shows its own values and
 * nothing typed into one can land in another. Skeleton cards while it loads, a notice with "Try again" when it cannot be read. No rate, cost or formula is requested, held or drawn: the
 * server's form has none, and the materials are IDs and names.
 */
export function PartForm({ estimateId, part, editable, nodes, onSaved, onChanged, onNamed, onServerIgnored, missing, gate, onShown, review, seed, ghost, treeUnread = false }: PartFormProps) {
  const definition = useFormDefinition(estimateId, seed);
  // The part's values in the seed are for the first showing of that part only (the Engineer edits): once another part has been shown, the first is read from the server again (DEF-085).
  const [left, setLeft] = useState(false);
  if (!left && seed !== undefined && part !== null && part.id !== seed.partId) setLeft(true);
  // A row was chosen after the page was drawn (the review's view): the form's title takes the focus, the choice is said once and the tree folds. The first paint does none of it.
  const [seen, setSeen] = useState(part?.id);
  const [chosen, setChosen] = useState(false);
  if (seen !== part?.id) {
    setSeen(part?.id);
    setChosen(true);
  }
  const fields = useLazyComponent<PartFieldsProps>(loadFields, true);
  const Fields = fields.Component;
  const shown = partFormShown({ hasPart: part !== null, definition: definition.form.status, fieldsCodeFailed: fields.failed, fieldsCodeHere: Fields !== null });
  useEffect(() => {
    if (shown) onShown?.();
  }, [shown, onShown]);

  // The three bars stand in for a ghost the page could not draw (a fault, or no rows): while the tree is unread, never the untrue "Choose a part" (PF-7).
  const bars = (
    <div role="status" aria-label={FORM_LOADING} className="flex min-w-0 flex-1 flex-col gap-s-3">
      <Skeleton className="h-(--control-h)" />
      <Skeleton className="h-(--control-h)" />
      <Skeleton className="h-(--control-h)" />
    </div>
  );
  if (part === null) return treeUnread ? (ghost ?? bars) : <p className="min-w-0 flex-1 text-body text-ink-2">{FORM_NO_PART}</p>;
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
    return ghost ?? bars;
  }

  return (
    <Fields
      key={part.id}
      estimateId={estimateId}
      part={part}
      editable={editable}
      nodes={nodes}
      form={definition.form.value}
      materials={definition.materials}
      lastSavedAt={definition.lastSavedAt}
      onSaved={onSaved}
      onChanged={onChanged}
      onNamed={onNamed}
      onServerIgnored={onServerIgnored}
      onWrote={definition.wrote}
      onReadMaterialsAgain={definition.readAgain}
      missing={missing}
      gate={gate}
      review={review === undefined ? undefined : { ...review, chosen }}
      seed={left && seed !== undefined ? { ...seed, part: null } : seed}
    />
  );
}
