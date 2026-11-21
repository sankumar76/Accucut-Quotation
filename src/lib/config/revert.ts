import { fieldsThatDoNotRoundTrip } from '../fields/formula-round-trip';
import { fieldLetter } from '../fields/registry';
import type { ConfigDocument } from '../fields/schema';
import type { RateReference } from '../formula';

/**
 * The rules of a revert, pure (STORY-08.06 AC-4, AC-5, AC-8; FR-077, FR-078, FR-079, FR-080; SPEC section 14 item 8; architecture sections 4.5 and 8). A revert never edits a version: it stores **a copy of the
 * target's snapshot as the next number**, so "restores the exact earlier configuration" is a deep-equality, and the service stores the very snapshot this returns.
 *
 * Two things can stop it before the password: the target is what is current already (nothing to revert), or it can no longer be used (a formula reads a rate the Process master has since lost). Both are decided here
 * from the two snapshots and the rates, so they are tested with no database, and a refusal costs the Admin no password attempt.
 */

/** A configuration version as the rules need it: which one it is and its stored snapshot. */
export interface RevertVersion {
  readonly id: string;
  readonly number: number;
  /** The stored document, as the table holds it. */
  readonly snapshot: unknown;
}

/** One field of the target that cannot be used today, as the Admin reads it: its column letter and label in the target. */
export interface UnusableField {
  readonly letter: string;
  readonly label: string;
}

export type RevertPlan =
  | { readonly ok: true; /** The snapshot to store as the next version: the target's, unchanged. */ readonly snapshot: unknown }
  | { readonly ok: false; readonly reason: 'nothing-to-revert' }
  | { readonly ok: false; readonly reason: 'unusable'; readonly fields: ReadonlyArray<UnusableField> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep equality of two stored documents: the same keys with equal values, in any key order (a database may give keys back in an order of its own), and the same items in the same order. `undefined` is not a
 * JSON value, so a key that holds it is not the same as a missing key.
 */
export function documentsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => documentsEqual(item, b[index]));
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && documentsEqual(a[key], b[key]));
}

/**
 * Whether the target can be stored as the next version. `document` is the target's snapshot, parsed (the caller parses it, which is also the check that it is still a valid registry). The order is the story's:
 * a target that is the current configuration is refused first, then one whose formulas no longer read under today's Process master.
 */
export function planRevert({ current, target, document, rates }: { readonly current: RevertVersion; readonly target: RevertVersion; readonly document: ConfigDocument; readonly rates: ReadonlyArray<RateReference> }): RevertPlan {
  if (documentsEqual(current.snapshot, target.snapshot)) return { ok: false, reason: 'nothing-to-revert' };
  const broken = fieldsThatDoNotRoundTrip(document, rates);
  if (broken.size > 0) {
    const fields = document.fields.filter((field) => broken.has(field.id)).map((field) => ({ letter: fieldLetter(field), label: field.label }));
    return { ok: false, reason: 'unusable', fields };
  }
  return { ok: true, snapshot: target.snapshot };
}

/** The words of the 422 for one field of the target: its column and label, and why. No rate name and no value. */
export function unusableMessage({ letter, label }: UnusableField): string {
  return `${letter} ${label} uses a rate that is no longer in the Process master.`;
}

/** The audit entry's Object is at most this long (the audit log keeps 200 characters of it). */
const OBJECT_LABEL_MAX_LENGTH = 200;

/** `Checkpoint "Before AY insert"` when the target has a checkpoint name, `Version 8` when it has none (an undo). */
export function revertAuditObjectLabel(checkpointName: string | null, targetNumber: number): string {
  const label = checkpointName === null ? `Version ${String(targetNumber)}` : `Checkpoint "${checkpointName}"`;
  return label.slice(0, OBJECT_LABEL_MAX_LENGTH);
}

/** What the audit entry keeps as before: the version that was current. A number only: no formula, figure or password has a key to sit in. */
export interface RevertAuditBefore {
  readonly version: number;
}

/** What it keeps as after: the version the revert made and the one it copied. */
export interface RevertAuditAfter {
  readonly version: number;
  readonly copiedFrom: number;
}

/** `Version 8` (UX-19). */
export function describeRevertBefore(before: RevertAuditBefore): string {
  return `Version ${String(before.version)}`;
}

/** `Version 9 (from version 7)` (UX-19). */
export function describeRevertAfter(after: RevertAuditAfter): string {
  return `Version ${String(after.version)} (from version ${String(after.copiedFrom)})`;
}

/** The `reason` line of the new version, which the history of story 08.07 shows. */
export function revertReason(checkpointName: string | null, targetNumber: number): string {
  return checkpointName === null ? `Reverted to version ${String(targetNumber)}` : `Reverted to checkpoint "${checkpointName}" (version ${String(targetNumber)})`;
}
