'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';

import { Notice } from '@/components/shared/notice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { blockedSummary, CALCULATE_MESSAGE } from '@/lib/estimate/calculate-words';
import { canEditInputs } from '@/lib/estimate/can-edit-inputs';
import { isLocked, type EstimateStatus } from '@/lib/estimate/state-machine';
import { askToLeave } from '@/lib/estimates/leave-registry';
import { createSaveGate } from '@/lib/estimates/save-gate';

import type { AutosaveProps } from './autosave';
import type { CalculateBarProps } from './calculate-bar';
import type { CalculateSummaryProps } from './calculate-summary';
import { APPROVED_LOCKED_BODY, APPROVED_LOCKED_TITLE, CALCULATE_BAR_FAILED_TITLE, CALCULATE_FAILED_TITLE, CALCULATE_PREPARED_TITLE, CALCULATE_UNSAVED_TITLE, FAILED_BODY, FORM_AREA_TITLE, FORM_AREA_TITLE_ID, LEAVE_GUARD_FAILED_TITLE } from './estimate-texts';
import { focusFirstField } from './focus-field';
import type { LeaveGuardProps } from './leave-guard';
import { PartForm } from './part-form';
import { PartsTreeArea } from './parts-tree-area';
import { useCalculate } from './use-calculate';
import { useLazyComponent } from './use-lazy-component';
import type { SavedPart } from './use-part-form';
import { usePartsTree, type PartsTreeState } from './use-parts-tree';
import { WorkspaceHeader, type WorkspaceHeaderView } from './workspace-header';

/**
 * SCR-05 "Estimate workspace", the Engineer's page (STORY-05.01 AC-1 to AC-4; CR-01 item 6, AQP-390): the task's header, which shows the customer, its short name and the subject read-only, and the area where the
 * parts tree (STORY-05.02) and the form open. The customer is set when the task is assigned and changed only by a Lead or an Admin on SCR-06, so there is no "choose the customer first" step here: the area is open
 * whether or not a customer is set (an estimate made before CR-01 may have none; Calculate then refuses, in the server's words). It decides nothing: the estimate's state is the server's.
 *
 * **Calculate (STORY-05.09).** The action bar at the bottom presses it. A blocked answer is a summary at the top with each part and field as a link, a triangle on each part in the tree, the words
 * under each blank field and a triangle on each card and in the section strip; a good one turns the page to "Prepared": the badge, the sentence, inputs read-only, part actions hidden and
 * the button "Prepared" (`canEditInputs`, the same rule the server asks again). The page holds the status from the answer, not a guess: the server decided it.
 */

/** The code of the three parts that nobody needs before the page is up, each fetched after it is (`use-lazy-component.ts`; NFR-009: this page's first load has no room left in 200 KB). */
const loadBar = () => import('./calculate-bar').then((module) => module.CalculateBar);
const loadSummary = () => import('./calculate-summary').then((module) => module.CalculateSummary);
/** The warning on leaving (STORY-05.08): typing is possible only once the form's code is here, and this is asked for on mount beside it. Its dialog is an overlay, so it is never imported with a plain import. */
const loadGuard = () => import('./leave-guard').then((module) => module.LeaveGuard);
/** The 30-second save (STORY-05.10): the one timer of the page, in the form's lazy part, asked for on mount beside the form's own code. */
const loadAutosave = () => import('./autosave').then((module) => module.Autosave);
const stay = (): void => undefined;

/**
 * The reserved drawing region (STORY-10.06, FR-087, NFR-023, UD-4): the third track of the form area, after the tree and the form, for a drawing viewer that a later release docks here (FR-093 is
 * "Won't" now, so it is empty, hidden from assistive technology, not a landmark and not focusable). Its width is the one token `--drawing-region-width` (0px now, 340px when a viewer exists); the
 * browser test sets it and no component or setting does. Below 1024 px it is `hidden`: no box, no accessibility tree.
 * Two traps are handled here and nowhere else, so the form and the tree stay as they were:
 * 1. A zero-width flex item still takes the row's gap, so the margin `min(0, width - gap)` gives the gap back while the region is narrower than one gap and is 0 from one gap of width.
 * 2. The token never squeezes the form below one section card (14.5rem, the minimum of the card grid in `part-fields.tsx`): the region is held to what is left after the tree, one card and the
 *    two gaps. At 1024 px a 340px region therefore shows as less, and the cards stay 232 px wide; from 1280 px it has its whole width.
 * The Tailwind spacing scale is replaced (`globals.css`), so the sums are written with the tokens as arbitrary values (`_` is a space).
 */
const DRAWING_REGION = 'hidden lg:block lg:shrink-0 lg:w-(--drawing-region-width) lg:ml-[min(0px,calc(var(--drawing-region-width)_-_var(--s-4)))] lg:max-w-[calc(100%_-_var(--tree-w)_-_14.5rem_-_2*var(--s-4))]';

/** The alert of an estimate that was ignored while the Engineer worked (CR-01 item 7D): fetched only when the server says so, by a bare `import()`, so it is in no first load (NFR-009). */
const loadIgnoredAlert = () => import('../estimate-ignore/engineer-ignored-alert').then((module) => module.EngineerIgnoredAlert);

export interface EstimateWorkspaceProps {
  readonly header: WorkspaceHeaderView;
  readonly estimateId: string;
  /** The Ignored layer is set over the estimate (CR-01 item 7D, AQP-401 AC-8): the page is read-only, with no action bar, and the badge says so. */
  readonly ignored?: boolean;
  /**
   * The Engineer's notice of an ignored task, **server-rendered** and handed in as an element, so it is drawn at first paint outside this client form and adds no client code (NFR-009). Absent while the estimate is not ignored.
   */
  readonly notice?: ReactNode;
}

export function EstimateWorkspace({ header, estimateId, ignored = false, notice }: EstimateWorkspaceProps) {
  // The status is the server's: it starts as the page was rendered and becomes PREPARED when Calculate says it did.
  const [status, setStatus] = useState<EstimateStatus>(header.status);
  // A save, an auto-save or a Calculate was refused 409 because the estimate was ignored while the Engineer worked (CR-01 item 7D): the page turns read-only on the spot, stops its timer and says so in one alert.
  const [refusedAsIgnored, setRefusedAsIgnored] = useState(false);
  const serverIgnored = useCallback((): void => setRefusedAsIgnored(true), []);
  const frozen = ignored || refusedAsIgnored;
  // This page is the Engineer's (a Lead or an Admin sees the short header until SCR-06), so the Engineer's rule is the one asked. The Ignored layer is the page's, as the server rendered it, and the server's 409 above.
  const editable = canEditInputs({ status, ignored: frozen }, 'ENGINEER');
  // The tree lives here: the form beside it is for the part chosen in it, and a save of the form gives the tree the part's new revision.
  const tree = usePartsTree(estimateId, serverIgnored);
  const selected = tree.selected === null ? null : { id: tree.selected.id, slNo: tree.selected.slNo, revision: tree.selected.revision };
  // What Calculate waits for: the part form's saves in flight, and the fields that show a value that is not saved (review SQR-01 of AQP-317).
  const [saves] = useState(createSaveGate);
  const calculation = useCalculate({ estimateId, onPrepared: () => setStatus('PREPARED'), onServerIgnored: serverIgnored, settle: saves.settle });
  const [IgnoredAlert, setIgnoredAlert] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (!refusedAsIgnored) return;
    void loadIgnoredAlert().then(
      (loaded) => setIgnoredAlert(() => loaded),
      () => undefined,
    );
  }, [refusedAsIgnored]);
  const bar = useLazyComponent<CalculateBarProps>(loadBar, true);
  const summary = useLazyComponent<CalculateSummaryProps>(loadSummary, calculation.blocked !== null);
  const Bar = bar.Component;
  const Summary = summary.Component;
  const guard = useLazyComponent<LeaveGuardProps>(loadGuard, true);
  const Guard = guard.Component;
  const autosave = useLazyComponent<AutosaveProps>(loadAutosave, false);
  const Autosave = autosave.Component;
  /**
   * Another part, or a new one, takes the form that shows the part now away, with whatever was typed into it and is not saved (STORY-05.08 AC-4, AC-5). So while anything is unsaved the person is asked
   * first, once the saves in flight have finished; with nothing unsaved the choice goes through at once, as before.
   */
  const guarded = (go: () => void): void => (saves.isDirty() ? askToLeave({ proceed: go, cancel: stay }) : go());
  const guardedTree: PartsTreeState = { ...tree, select: (next) => guarded(() => tree.select(next)), addUnder: (parentId, nodeKind) => guarded(() => tree.addUnder(parentId, nodeKind)) };
  const preparedNotice = useRef<HTMLDivElement>(null);
  // The press that prepared the estimate: the button has become "Prepared" and is off, so focus goes to the notice. A reload of a prepared estimate steals nothing (`done` is null).
  useEffect(() => {
    if (calculation.done !== null) preparedNotice.current?.focus();
  }, [calculation.done]);
  const missingFields = useMemo(() => new Map((calculation.blocked ?? []).map((part) => [part.nodeId, new Set(part.fields.map((field) => field.fieldId))])), [calculation.blocked]);
  const missingParts = useMemo(() => new Set(missingFields.keys()), [missingFields]);
  const noFields: ReadonlySet<string> = useMemo(() => new Set<string>(), []);

  /** A save went through: the tree takes the part's revision and icon, and the summary drops the fields that now have a value. */
  const saved = (part: SavedPart): void => {
    tree.applySaved(part);
    calculation.filled(part.id, part.inputs);
  };

  return (
    <>
      <WorkspaceHeader view={{ ...header, status, ignored: frozen }} notice={notice} />
      {refusedAsIgnored && !ignored && IgnoredAlert !== null ? <IgnoredAlert /> : null}
      {Autosave === null ? null : <Autosave gate={saves} enabled={editable} calculating={calculation.busy} />}
      {Guard !== null ? (
        <Guard gate={saves} />
      ) : guard.failed ? (
        // The warning on leaving could not be fetched: the page then has no protection for what is typed, and says so instead of looking as if it had (review SQR-05).
        <Notice tone="danger" title={LEAVE_GUARD_FAILED_TITLE} />
      ) : null}
      {calculation.blocked === null ? null : Summary === null ? (
        // The list's code is on its way (or could not be fetched): the sentence is the server's, and it is never missing.
        <Notice tone="danger" title={blockedSummary(calculation.blocked.length)} />
      ) : (
        <Summary parts={calculation.blocked} onChoosePart={guardedTree.select} focusRequest={calculation.focusRequest} />
      )}
      {calculation.problem === null ? null : (
        <Notice tone="danger" title={calculation.problem.kind === 'refused' ? calculation.problem.message : calculation.problem.kind === 'unsaved' ? CALCULATE_UNSAVED_TITLE : CALCULATE_FAILED_TITLE}>
          {calculation.problem.kind === 'failed' ? FAILED_BODY : null}
        </Notice>
      )}
      {status === 'PREPARED' ? (
        // The state "Prepared": the one sentence the server answers with and nothing else. No number from the calculation is anywhere (NFR-002). Focus comes here after the press that prepared it.
        <div ref={preparedNotice} tabIndex={-1} data-calculate-prepared="" className="rounded-md">
          <Notice tone="success" title={CALCULATE_PREPARED_TITLE}>
            {calculation.done ?? CALCULATE_MESSAGE}
          </Notice>
        </div>
      ) : null}
      {isLocked(status) ? (
        // The state "Approved": the words of the G3 screen and nothing else, so no price and no figure is anywhere (NFR-002). Inputs are read-only because `canEditInputs` says so, and the server refuses a write.
        <Notice tone="success" title={APPROVED_LOCKED_TITLE}>
          {APPROVED_LOCKED_BODY}
        </Notice>
      ) : null}
      <Card role="group" aria-labelledby={FORM_AREA_TITLE_ID}>
        <CardHeader>
          <CardTitle id={FORM_AREA_TITLE_ID}>{FORM_AREA_TITLE}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-s-4 lg:flex-row">
          <PartsTreeArea tree={guardedTree} editable={editable} onOpenPart={focusFirstField} missingIds={missingParts} />
          <PartForm estimateId={estimateId} part={selected} editable={editable} onSaved={saved} onChanged={tree.readAgain} onServerIgnored={serverIgnored} missing={selected === null ? noFields : (missingFields.get(selected.id) ?? noFields)} gate={saves} />
          <div data-drawing-region="" aria-hidden="true" className={DRAWING_REGION} />
        </CardContent>
      </Card>
      {isLocked(status) || frozen ? null : Bar !== null ? (
        <Bar prepared={status === 'PREPARED'} calculation={calculation} gate={saves} onChoosePart={guardedTree.select} />
      ) : bar.failed ? (
        // The button's code could not be fetched: the person is told so and what to do, never left with no button and no word (review SQR-06 of AQP-317).
        <Notice tone="danger" title={CALCULATE_BAR_FAILED_TITLE} />
      ) : null}
    </>
  );
}
