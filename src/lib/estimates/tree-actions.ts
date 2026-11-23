import type { RoleName } from '../auth/roles';
import { canEditInputs } from '../estimate/can-edit-inputs';
import { ALLOWED_CHILDREN, type NodeKind } from '../estimate/node-kinds';
import type { EstimateState } from '../estimate/state-machine';

/**
 * What the row actions of the parts tree offer (CR-01 item 3C, AQP-405; UX spec section 0.9 row 3; SPEC 14.30, 14.33, 14.35 as ruled by the product-manager). Pure code, read by the browser; the server decides
 * every one of these again (`assertEditable`, `ALLOWED_CHILDREN`), so what is offered here is what the server accepts and nothing is hidden by the screen alone.
 */

/**
 * Whether the row actions ("+", "-", Add main assembly) are offered: **exactly when the person can change the inputs** (PM ruling, 2026-11-22), so an Engineer on their own Draft, a Lead or an Admin on a Draft or a
 * Prepared estimate, and nobody on an Approved or a Quoted one, nor on an Ignored one (the rule follows `canEditInputs`, so a status or a layer added later is decided there once). A structure change on a
 * Prepared estimate raises `inputs_revision`, clears the figures and waits for a recalculation (FR-100).
 */
export function treeActionsOffered(state: EstimateState, role: RoleName): boolean {
  return canEditInputs(state, role);
}

/** What the "+" of a row does: nothing (a Fastener holds nothing), adds the one kind allowed at once, or opens a menu of the allowed kinds. */
export type AddAction = { readonly kind: 'none' } | { readonly kind: 'direct'; readonly nodeKind: NodeKind } | { readonly kind: 'menu'; readonly nodeKinds: ReadonlyArray<NodeKind> };

/** The "+" of a row of this kind, from the one table the server also reads (`ALLOWED_CHILDREN`): the menu offers exactly what the server accepts. */
export function addActionOf(parent: NodeKind): AddAction {
  const allowed = ALLOWED_CHILDREN[parent];
  const [only] = allowed;
  if (only === undefined) return { kind: 'none' };
  return allowed.length === 1 ? { kind: 'direct', nodeKind: only } : { kind: 'menu', nodeKinds: allowed };
}

/** The tooltip and the spoken name of a "+" that opens a menu: the row it is under. */
export const addUnderLabel = (slNo: string, name: string): string => `Add under ${slNo} ${name}`;
/** The tooltip and the spoken name of a "+" that adds the Fastener at once (UX row 3: "Add fastener under <row>"). */
export const addFastenerLabel = (slNo: string, name: string): string => `Add fastener under ${slNo} ${name}`;
/** The tooltip and the spoken name of a "-": the row whose confirmation it opens. */
export const deleteRowLabel = (slNo: string, name: string): string => `Delete ${slNo} ${name}`;
/** The button at the foot of the tree that adds another top-level Main Assembly. */
export const ADD_MAIN_ASSEMBLY = 'Add main assembly';
