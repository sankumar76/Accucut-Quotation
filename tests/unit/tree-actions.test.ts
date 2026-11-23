import { describe, expect, it } from 'vitest';

import type { RoleName } from '@/lib/auth/roles';
import { canEditInputs } from '@/lib/estimate/can-edit-inputs';
import { ALLOWED_CHILDREN, NODE_KINDS, type NodeKind } from '@/lib/estimate/node-kinds';
import { ESTIMATE_STATUSES, type EstimateStatus } from '@/lib/estimate/state-machine';
import { ADD_MAIN_ASSEMBLY, actionsLabel, addActionOf, addFastenerLabel, addUnderLabel, deleteRowLabel, moveRowLabel, treeActionsOffered } from '@/lib/estimates/tree-actions';

/**
 * AQP-405 (CR-01 item 3C; SPEC 14.30, 14.33, 14.35 as ruled by the product-manager): what the row actions of the parts tree offer. The "+" offers exactly the kinds of `ALLOWED_CHILDREN` for the row
 * (a menu for two or more, the one kind at once for one, nothing for a Fastener), and the actions are offered exactly when the person may change the inputs (`canEditInputs`). Every role and status is
 * written out, so a status added later (Quoted, Ignored) fails here until someone decides.
 */

describe('treeActionsOffered (AC-6): exactly when the person can edit the inputs', () => {
  const ROLES: ReadonlyArray<RoleName> = ['ENGINEER', 'LEAD', 'ADMIN'];
  const STATUSES: ReadonlyArray<EstimateStatus> = ESTIMATE_STATUSES;
  const LAYERS: ReadonlyArray<boolean> = [false, true];

  it.each(ROLES.flatMap((role) => STATUSES.flatMap((status) => LAYERS.map((ignored) => ({ role, status, ignored })))))(
    '$role on $status (ignored: $ignored) is the same answer as canEditInputs',
    ({ role, status, ignored }) => {
      expect(treeActionsOffered({ status, ignored }, role)).toBe(canEditInputs({ status, ignored }, role));
    },
  );

  it('is: an Engineer on a Draft only; a Lead or an Admin on a Draft and on a Prepared estimate; nobody on an Approved or a Quoted one', () => {
    const offered = ROLES.flatMap((role) => STATUSES.filter((status) => treeActionsOffered({ status, ignored: false }, role)).map((status) => `${role} ${status}`));
    expect(offered).toEqual(['ENGINEER DRAFT', 'LEAD DRAFT', 'LEAD PREPARED', 'ADMIN DRAFT', 'ADMIN PREPARED']);
  });

  it('is: nobody on an ignored estimate, whatever its status underneath (7B, DL-300 (1)): the tree is read-only until it is restored', () => {
    const offered = ROLES.flatMap((role) => STATUSES.filter((status) => treeActionsOffered({ status, ignored: true }, role)).map((status) => `${role} ${status}`));
    expect(offered).toEqual([]);
  });
});

describe('addActionOf (AC-1, AC-2, 14.30): what the "+" of a row does', () => {
  it('opens a menu of exactly the allowed kinds under a Main Assembly and a Sub-Assembly, in the table\'s order', () => {
    expect(addActionOf('MAIN_ASSEMBLY')).toEqual({ kind: 'menu', nodeKinds: ['SUB_ASSEMBLY', 'PART', 'FASTENER'] });
    expect(addActionOf('SUB_ASSEMBLY')).toEqual({ kind: 'menu', nodeKinds: ['PART', 'FASTENER'] });
  });

  it('adds the Fastener at once, with no menu, under a Part or a Sub-part', () => {
    expect(addActionOf('PART')).toEqual({ kind: 'direct', nodeKind: 'FASTENER' });
  });

  it('has no "+" on a Fastener', () => {
    expect(addActionOf('FASTENER')).toEqual({ kind: 'none' });
  });

  it.each(NODE_KINDS)('offers for %s exactly what ALLOWED_CHILDREN says, never another kind', (kind: NodeKind) => {
    const action = addActionOf(kind);
    const offered = action.kind === 'menu' ? action.nodeKinds : action.kind === 'direct' ? [action.nodeKind] : [];
    expect(offered).toEqual(ALLOWED_CHILDREN[kind]);
  });
});

describe('the words of the row actions', () => {
  it('names the "+" and the "-" after their row, so a screen reader and the tooltip say which row', () => {
    expect(addUnderLabel('1', 'Hopper')).toBe('Add under 1 Hopper');
    expect(addFastenerLabel('1.1.1', 'Plate')).toBe('Add fastener under 1.1.1 Plate');
    expect(deleteRowLabel('1.2', 'Frame')).toBe('Delete 1.2 Frame');
    // The move handle's name (CR-01 item 3D): the row it moves, as in the UX mock-up.
    expect(moveRowLabel('1.1', 'Base frame')).toBe('Move 1.1 Base frame');
    // The group that holds the three buttons of a row (AQP-418): its number and name, as in the button names.
    expect(actionsLabel('1.1', 'Frame')).toBe('Actions for 1.1 Frame');
  });

  it('says "Add main assembly" at the foot of the tree', () => {
    expect(ADD_MAIN_ASSEMBLY).toBe('Add main assembly');
  });
});
