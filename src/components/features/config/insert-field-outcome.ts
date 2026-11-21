import type { Outcome, Refusal } from '@/lib/api-client';
import type { InsertPreviewView, InsertSavedView } from '@/lib/config/insert-field-client';
import { CONFIG_VERSION_CHANGED_CODE } from '@/lib/errors';

import { PREVIEW_FAILED_LINE, PREVIEW_FAILED_TITLE, REFUSED_TITLE, SAVE_UNCONFIRMED, SAVE_UNCONFIRMED_TITLE, STALE_TITLE } from './insert-field-texts';

/**
 * What the insert wizard does with the server's answer to the preview and to the save (SCR-19; STORY-08.03 AC-4, AC-7), as plain values, so each case is a unit test and the hook only acts on the answer.
 * Nothing here decides a rule: a refusal is the server's, in the server's words; this only says where it goes. A refusal that names controls goes under them; one that names none is a notice; a version that
 * moved on can only be answered by starting again; an answer that never came says so, and for a save says it is not known whether the fields went in (the portal may have stored them).
 */

export interface WizardNotice {
  readonly tone: 'danger' | 'warn';
  readonly title: string;
  readonly message?: string;
  /** The version moved on under the wizard: the only way on is to open it again. */
  readonly stale: boolean;
}

export type PreviewDecision =
  | { readonly kind: 'preview'; readonly view: InsertPreviewView }
  | { readonly kind: 'fields'; readonly fields: Readonly<Record<string, string>> }
  | { readonly kind: 'notice'; readonly notice: WizardNotice };

export type SaveDecision =
  | { readonly kind: 'saved'; readonly saved: InsertSavedView }
  | { readonly kind: 'fields'; readonly fields: Readonly<Record<string, string>> }
  | { readonly kind: 'notice'; readonly notice: WizardNotice };

/** A refusal that names controls goes under them; one that names none is a notice with the server's own title. */
function refusedAs(refusal: Refusal): { readonly kind: 'fields'; readonly fields: Readonly<Record<string, string>> } | { readonly kind: 'notice'; readonly notice: WizardNotice } {
  if (Object.keys(refusal.fields).length > 0) return { kind: 'fields', fields: refusal.fields };
  return { kind: 'notice', notice: { tone: 'danger', title: REFUSED_TITLE, message: refusal.title, stale: false } };
}

export function decidePreview(outcome: Outcome<InsertPreviewView>): PreviewDecision {
  if (outcome.status === 'ok') return { kind: 'preview', view: outcome.value };
  if (outcome.status === 'failed') return { kind: 'notice', notice: { tone: 'warn', title: PREVIEW_FAILED_TITLE, message: PREVIEW_FAILED_LINE, stale: false } };
  return refusedAs(outcome);
}

export function decideSave(outcome: Outcome<InsertSavedView>): SaveDecision {
  if (outcome.status === 'ok') return { kind: 'saved', saved: outcome.value };
  if (outcome.status === 'failed') return { kind: 'notice', notice: { tone: 'warn', title: SAVE_UNCONFIRMED_TITLE, message: SAVE_UNCONFIRMED, stale: false } };
  if (outcome.code === CONFIG_VERSION_CHANGED_CODE) return { kind: 'notice', notice: { tone: 'danger', title: STALE_TITLE, message: outcome.title, stale: true } };
  return refusedAs(outcome);
}
