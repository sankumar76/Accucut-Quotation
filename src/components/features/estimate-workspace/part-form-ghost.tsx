import type { CSSProperties, ReactNode } from 'react';

import {
  CARD_GRID,
  CARD_HEADER,
  CARD_SHARE,
  CARD_TITLE,
  CONTROL_HEIGHT,
  FIELD_BOX,
  FIELDS,
  FORM_ROOT,
  HEAD_LINES,
  HINT_TEXT,
  PICTURE_ZONE_HEIGHT,
  PICTURE_ZONE_HEIGHT_READONLY,
  PICTURE_ZONE_HEIGHT_UNHINTED,
  PROGRESS_BAR_WIDTH,
  PROGRESS_ROW,
  COUNT_TEXT,
  RANGE_CHIP,
  STRIP_BOX,
  STRIP_ITEM,
  STRIP_LINK,
  STRIP_LIST,
  TEXTAREA_HEIGHT,
} from '@/components/shared/form-layout';
import { Notice } from '@/components/shared/notice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { parseForm, parsePartInputs, type FormField, type FormSection, type FormView } from '@/lib/estimates/form-client';
import { decodeTreatment, isOtherTreatment } from '@/lib/estimate/treatment-value';
import { sectionProgress, sectionWeight, shownSections } from '@/lib/estimates/form-shown';

import { FORM_LOADING, sectionLinkText } from './estimate-texts';
import { reviewField } from './review-look';
import { TreatmentChips } from './surface-chips';
import { SURFACE_HINT } from './surface-texts';

/**
 * The part form's loading ghost (DEF-145; `rulings/partform-placeholder-shape-2026-11-28.md`, PF-1 to PF-15): **the form itself without its values**, drawn from the form's own definition with the form's own class
 * strings (`shared/form-layout.ts`, PF-4), so the browser lays it out as it will lay out the form: the same cards, in the same rows, at any width. It has real words where the words are known (the notice, the strip's
 * items, each card's name and column range, each field's hint) and grey blocks where a person's data or a control will be (PF-3). **It shows no value, no count and no figure.**
 *
 * **No hooks, no `'use client'`, no client component** (PF-6): the same function is drawn on the server for the page and in the lazy chunk for the second wait (`PartFields`), and the shell imports it nowhere, so
 * Stage 11b's first-load JavaScript is untouched. **It is one busy region** (PF-9): the root is a `status` named "Loading the form", with no `aria-busy` (the review's figure tiles hide their figures while any `aria-busy=true` is on the page, `figure-tiles.tsx`, so an `aria-busy` here would blank the Totals until the form arrives: QLT-833-05), and one fixed visually hidden line; the drawn blocks are `inert` and hidden from
 * assistive technology, and carry no id, name, href, tabindex, heading or form marker, only the ghost's own (`data-part-ghost`, `data-ghost-wide`, `data-ghost-picture`, `data-ghost-grid`). A second ghost for the same
 * part (`silent`) says nothing. The grey blocks are `Skeleton`s, whose shimmer `prefers-reduced-motion` already switches off (PF-10). There is no delay and no fade (PF-8).
 */
export interface PartFormGhostProps {
  /** The form's definition: the sections and their fields, in order. */
  readonly form: FormView;
  /** The part's saved values where the page holds them (the Lead's seeded part), so a field the definition hides for them is not drawn (PF-5.2); nothing for an Engineer's form (the defaults). */
  readonly texts?: Readonly<Record<string, string>> | undefined;
  /** The read-only notice's words (the Lead's block always has one; the Engineer's form only when locked): drawn as the real notice, so its height is the real one. */
  readonly notice?: string | undefined;
  /** The Engineer's form draws its own title and eyebrow above the lines; the review draws them on the server, outside the form. */
  readonly head: 'lead' | 'engineer';
  /** The second ghost for the same part (the fields' own wait): it says nothing, the first one has said it (PF-9.2). */
  readonly silent?: boolean;
  /** The page can change the part (`canEditInputs`): the picture's box is the editable control's, or, when it cannot, the thumbnail's alone (PF-17). */
  readonly editable?: boolean;
}

type CardShare = CSSProperties & Record<'--n', number>;

/** The ghost carries none of the form's own markers (PF-9.4): the shared `Card` and `Skeleton` set `data-slot`, and a prop of `undefined` after it leaves the attribute out. */
const NO_SLOT = { 'data-slot': undefined } as const;
const Grey = ({ className, children }: { readonly className: string; readonly children?: ReactNode }) => (
  <Skeleton {...NO_SLOT} className={className}>
    {children}
  </Skeleton>
);

/** The control a field will have, as a grey block of the control's own height (PF-3); the picture, a multi-line box and the surface treatments are the ones that take the whole row or more. */
function ghostControl(field: FormField, texts: Readonly<Record<string, string>>, editable: boolean): { readonly control: ReactNode; readonly marker: 'wide' | 'picture' | null } {
  switch (field.rule.type) {
    case 'picture':
      return { control: <Grey className={!editable ? PICTURE_ZONE_HEIGHT_READONLY : field.hint === null ? PICTURE_ZONE_HEIGHT_UNHINTED : PICTURE_ZONE_HEIGHT} />, marker: 'picture' };
    case 'treatment': {
      // The "Other" box under the list shows only when "Other" is the part's choice (`TreatmentSelect`).
      const chosen = decodeTreatment(texts[field.id] ?? '');
      return { control: chosen !== null && isOtherTreatment(chosen.id) ? <><Grey className={CONTROL_HEIGHT} /><Grey className={CONTROL_HEIGHT} /></> : <Grey className={CONTROL_HEIGHT} />, marker: null };
    }
    case 'text':
      return field.rule.multiline ? { control: <Grey className={TEXTAREA_HEIGHT} />, marker: 'wide' } : { control: <Grey className={CONTROL_HEIGHT} />, marker: null };
    default:
      return { control: <Grey className={CONTROL_HEIGHT} />, marker: null };
  }
}

function GhostField({ field: own, review, texts, editable }: { readonly field: FormField; readonly review: boolean; readonly texts: Readonly<Record<string, string>>; readonly editable: boolean }) {
  // The review's form shows a field as `reviewField` says (no hint but the quantity's, `review-look.ts`), so its ghost does: the same lines, the same height.
  const field = review ? reviewField(own) : own;
  const { control, marker } = ghostControl(field, texts, editable);
  return (
    <div {...(marker === 'wide' ? { 'data-ghost-wide': '' } : marker === 'picture' ? { 'data-ghost-picture': '' } : {})} className={FIELD_BOX}>
      <Grey className="h-s-5 w-1/2" />
      {control}
      {field.hint === null ? null : <p className={HINT_TEXT}>{field.hint}</p>}
    </div>
  );
}

/**
 * The surface treatments of a card are one field, not one box per flag. The Lead's form shows the chosen ones as chips (or "None selected"): the same component draws them here. The Engineer's form shows a
 * list button, with the hint under it, whose words are the form's own.
 */
function GhostTreatments({ flags, review, texts }: { readonly flags: ReadonlyArray<FormField>; readonly review: boolean; readonly texts: Readonly<Record<string, string>> }) {
  if (review) return <TreatmentChips fields={flags} texts={texts} marker={{ 'data-ghost-wide': '' }} />;
  return (
    <div data-ghost-wide="" className={FIELD_BOX}>
      <Grey className="h-s-5 w-1/2" />
      <Grey className={CONTROL_HEIGHT} />
      <p className={HINT_TEXT}>{SURFACE_HINT}</p>
    </div>
  );
}

function GhostCard({ section, review, texts, editable, head }: { readonly section: FormSection; readonly review: boolean; readonly texts: Readonly<Record<string, string>>; readonly editable: boolean; readonly head: 'lead' | 'engineer' }) {
  const share: CardShare = { '--n': sectionWeight(section) };
  const flags = section.fields.filter((field) => field.rule.type === 'flag');
  const counts = sectionProgress(section, texts, {});
  return (
    <Card {...NO_SLOT} style={share} className={CARD_SHARE}>
      <CardHeader {...NO_SLOT} className={CARD_HEADER}>
        <CardTitle {...NO_SLOT} as="div" className={CARD_TITLE}>
          <Grey className="size-s-6 shrink-0 rounded-md" />
          <span className="min-w-0">{section.name}</span>
        </CardTitle>
        <span className={RANGE_CHIP}>{section.columnRange}</span>
        {counts.total === 0 ? null : (
          // The card's count ("4 of 4"), as a grey block the width of its words: the header wraps by what it holds, so a block of the wrong width wraps it differently (360 px, DEF-145). The words are invisible and carry no value; the form shows the count, the ghost its place.
          <p className={COUNT_TEXT}>
            <Grey className="w-fit">
              <span className="invisible">{`${String(head === 'engineer' ? 0 : counts.complete)} of ${String(counts.total)}`}</span>
            </Grey>
          </p>
        )}
      </CardHeader>
      <CardContent {...NO_SLOT} className={FIELDS}>
        {flags.length > 0 ? <GhostTreatments flags={flags} review={review} texts={texts} /> : null}
        {section.fields.map((field) => (field.rule.type === 'flag' ? null : <GhostField key={field.id} field={field} review={review} texts={texts} editable={editable} />))}
      </CardContent>
    </Card>
  );
}

export function PartFormGhost({ form, texts = {}, notice, head, silent = false, editable = true }: PartFormGhostProps) {
  // Every card the form draws, with the fields it shows for what is typed (the form draws a card whose fields are all hidden too): the same list `PartFields` walks.
  const sections = shownSections(form.sections, texts);
  return (
    <div role="status" aria-label={FORM_LOADING} data-part-ghost="" className="flex min-w-0 flex-1 flex-col">
      {silent ? null : <span className="sr-only">{FORM_LOADING}</span>}
      <div inert aria-hidden="true" className={FORM_ROOT}>
        <div className={HEAD_LINES}>
          {head === 'engineer' ? (
            <>
              <Grey className="h-s-4 w-1/4" />
              <Grey className="h-(--lh-sub) w-1/2" />
            </>
          ) : null}
          <div className={PROGRESS_ROW}>
            <Grey className={cn('h-s-2', PROGRESS_BAR_WIDTH)} />
            <Grey className="h-s-4 w-24" />
          </div>
          <Grey className="h-s-4 w-1/3" />
        </div>
        {notice === undefined ? null : <Notice tone="info">{notice}</Notice>}
        <div className={STRIP_BOX}>
          <ul className={STRIP_LIST}>
            {sections.map((section) => (
              <li key={section.id} className={STRIP_ITEM}>
                <span className={STRIP_LINK}>{sectionLinkText(section.number, section.shortName)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div data-ghost-grid="" className={CARD_GRID}>
          {sections.map((section) => (
            <GhostCard key={section.id} section={section} review={head === 'lead'} texts={texts} editable={editable} head={head} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The ghost for a page that holds the form's wire body (and, for the Lead, the part's): the same readers the form uses (`parseForm`, `parsePartInputs`), so a body the form would refuse draws no ghost and the three bars
 * stand in (DEF-145, PF-5.2: a field the definition hides for the part's saved values is not drawn; without a part's values, the defaults). A server-side helper: the page calls it, the shell never does.
 */
export function ghostOf({ form, part, notice, head, editable }: { readonly form: unknown; readonly part?: unknown; readonly notice?: string | undefined; readonly head: 'lead' | 'engineer'; readonly editable: boolean }): ReactNode {
  const view = parseForm(form);
  if (view === null) return undefined;
  const saved = part === undefined ? null : parsePartInputs(part);
  return <PartFormGhost form={view} texts={saved === null ? undefined : saved.inputs} notice={notice} head={head} editable={editable} />;
}
