import { describe, expect, it } from 'vitest';

import { AUDIT_CATEGORIES, auditCategoryLabel, isAuditCategoryId } from '@/lib/audit/categories';
import {
  AUDIT_EVENTS,
  auditEventNames,
  eventsInCategory,
  isAuditEventName,
  NO_DETAIL,
  wiredEvents,
  type AuditEventName,
} from '@/server/services/audit-events';

/**
 * STORY-01.07 T2 (AC-3, assumption A-2): the registry of events. It is the one place an event name, its subject, its category,
 * the shape of what it keeps and the words it shows are written, so these tests pin what the story promises: six user events are
 * wired, the others are declared and unused, every event belongs to a category the filter offers, and the words are the screen's.
 */

/** The six events of the Users screen (STORY-01.04) and, from STORY-01.09, the Admin hand-over: one entry for the one act. */
const WIRED_USER: ReadonlyArray<AuditEventName> = [
  'user.created',
  'user.renamed',
  'user.role_changed',
  'user.deactivated',
  'user.activated',
  'user.password_reset',
  'user.admin_handed_over',
];
/** STORY-02.01: the three events of the Process Master. */
const WIRED_MASTER: ReadonlyArray<AuditEventName> = ['master.created', 'master.edited', 'master.deleted'];
/** STORY-05.12: a Calculate that went ahead past a warning. */
const WIRED_CALCULATION: ReadonlyArray<AuditEventName> = ['calculation.warning_acknowledged'];
/** STORY-06.06: an estimate approved and locked; STORY-06.07: a price that differs from the calculated total; STORY-06.08: an approved estimate unlocked; STORY-06.12: an approval cancelled; STORY-06.13: the price of a cancelled approval removed. Registry order puts them before the quantity warning. */
const WIRED_APPROVAL: ReadonlyArray<AuditEventName> = ['approval.approved', 'approval.price_overridden', 'approval.unlocked', 'approval.cancelled', 'approval.price_removed'];
/** STORY-08.02: a formula of the field registry changed. Registry order puts it after the approval events and before the calculation event. */
const WIRED_CONFIG: ReadonlyArray<AuditEventName> = ['config.formula_changed', 'config.field_inserted', 'config.field_deleted', 'config.reverted'];
/** CR-01 item 6: the customer of an estimate changed (registry order puts it before the reassign); STORY-04.07: a task given to another Engineer, a new deadline, or both. */
const WIRED_TASK: ReadonlyArray<AuditEventName> = ['estimate.customer_changed', 'task.reassigned'];
const WIRED: ReadonlyArray<AuditEventName> = [...WIRED_USER, ...WIRED_MASTER, ...WIRED_APPROVAL, ...WIRED_CONFIG, ...WIRED_CALCULATION, ...WIRED_TASK];
/** With STORY-06.13 no event is declared and left unwired. */
const RESERVED: ReadonlyArray<AuditEventName> = [];

describe('AC-3: what is wired and what is declared', () => {
  it('wires exactly the six user events of the Users screen and the Admin hand-over, the three events of the Process Master, the approval, the price override, the unlock, the cancel and the price removal, and the quantity warning of Calculate', () => {
    expect(wiredEvents()).toEqual(WIRED);
  });

  it('declares no event that is not wired: every event of Release 1 has code behind it', () => {
    expect(auditEventNames().filter((name) => !WIRED.includes(name))).toEqual(RESERVED);
    for (const name of RESERVED) expect(AUDIT_EVENTS[name].status, name).toBe('reserved');
  });

  it('keeps the event names the architecture already uses', () => {
    expect(auditEventNames()).toEqual(expect.arrayContaining(['calculation.warning_acknowledged', 'approval.cancelled', 'approval.price_removed']));
  });

  it('knows a registered name and no other', () => {
    expect(isAuditEventName('user.created')).toBe(true);
    for (const name of ['user.exploded', '', 'USER.CREATED', 'constructor', '__proto__', 'toString']) expect(isAuditEventName(name), name).toBe(false);
  });
});

describe('AC-3: every event has a subject and a category the filter offers', () => {
  it.each(auditEventNames())('%s', (name) => {
    const definition = AUDIT_EVENTS[name];
    expect(definition.objectType).not.toBe('');
    expect(isAuditCategoryId(definition.category)).toBe(true);
  });

  it('every category of the filter holds at least one event, so choosing it can find something', () => {
    for (const category of AUDIT_CATEGORIES) expect(eventsInCategory(category.id).length, category.id).toBeGreaterThan(0);
  });

  it('puts the user events (the hand-over, AQP-356, too) under "User change" and the others each under their own', () => {
    expect(eventsInCategory('user_change')).toEqual(WIRED_USER);
    expect(eventsInCategory('master_data')).toEqual(WIRED_MASTER);
    expect(eventsInCategory('price_override')).toEqual(['approval.price_overridden']);
    expect(eventsInCategory('approval_cancelled')).toEqual(['approval.cancelled']);
    expect(eventsInCategory('price_removed')).toEqual(['approval.price_removed']);
    expect(eventsInCategory('quantity_warning')).toEqual(['calculation.warning_acknowledged']);
    expect(eventsInCategory('task_change')).toEqual(WIRED_TASK);
    expect(auditCategoryLabel('task_change')).toBe('Task change');
    expect(eventsInCategory('config_change')).toEqual(WIRED_CONFIG);
    expect(auditCategoryLabel('config_change')).toBe('Configuration change');
    expect(auditCategoryLabel('user_change')).toBe('User change');
    expect(auditCategoryLabel('master_data')).toBe('Master data edit');
    expect(auditCategoryLabel('configuration')).toBeNull();
  });

  it('the words of the filter are the UX spec\'s for SCR-16, in its order', () => {
    expect(AUDIT_CATEGORIES.map((category) => category.label)).toEqual([
      'Approval',
      'Unlock',
      'Price override',
      'Approval cancelled',
      'Price removed',
      'Quantity warning',
      'Master data edit',
      'User change',
      'Task change',
      'Configuration change',
    ]);
  });
});

describe('AC-3: the words of "Before to after" for the user events', () => {
  const describeOf = (name: AuditEventName, before: unknown, after: unknown) => AUDIT_EVENTS[name].describeStored(before, after);

  it('says what was added, and as which role', () => {
    expect(describeOf('user.created', null, { role: 'ENGINEER', isActive: true })).toEqual({ before: 'Not added', after: 'Added as Engineer' });
    expect(describeOf('user.created', null, { role: 'LEAD', isActive: true })?.after).toBe('Added as Lead');
  });

  it('says the old name and the new one, with nothing in front of them (ux-spec v0.16)', () => {
    expect(describeOf('user.renamed', { name: 'Arjun Rai' }, { name: 'Arjun Rao' })).toEqual({ before: 'Arjun Rai', after: 'Arjun Rao' });
    expect(describeOf('user.renamed', { name: '' }, { name: 'Arjun Rao' })).toBeNull();
    expect(describeOf('user.renamed', { name: 'Arjun Rai' }, null)).toBeNull();
  });

  it('says the role before and after', () => {
    expect(describeOf('user.role_changed', { role: 'ENGINEER' }, { role: 'LEAD' })).toEqual({ before: 'Engineer', after: 'Lead' });
  });

  it('says Active to Deactivated, and back', () => {
    expect(describeOf('user.deactivated', { isActive: true }, { isActive: false })).toEqual({ before: 'Active', after: 'Deactivated' });
    expect(describeOf('user.activated', { isActive: false }, { isActive: true })).toEqual({ before: 'Deactivated', after: 'Active' });
  });

  it('says a temporary password was set, and says nothing of the password', () => {
    const words = describeOf('user.password_reset', { mustChangePassword: false }, { mustChangePassword: true });
    expect(words).toEqual({ before: 'Earlier password', after: 'Temporary password set' });
  });

  it('says who the Admin was and who the Admin is now, by name (STORY-01.09 AC-4, SCR-16 style)', () => {
    const arjun = { adminId: '00000000-0000-4000-8000-0000000000a1', adminName: 'Arjun Rai' };
    const meera = { adminId: '00000000-0000-4000-8000-0000000000a2', adminName: 'Meera Nair' };
    expect(describeOf('user.admin_handed_over', arjun, meera)).toEqual({ before: 'Admin was Arjun Rai', after: 'Admin is now Meera Nair' });
    expect(describeOf('user.admin_handed_over', arjun, { adminId: 'not-an-id', adminName: 'Meera Nair' })).toBeNull();
    expect(describeOf('user.admin_handed_over', arjun, { ...meera, adminName: '' })).toBeNull();
    expect(describeOf('user.admin_handed_over', null, meera)).toBeNull();
  });

  it('gives no words for stored values that do not fit the event (an older shape, a damaged row), and the screen shows a dash', () => {
    expect(describeOf('user.created', { role: 'ENGINEER' }, { role: 'ENGINEER', isActive: true })).toBeNull();
    expect(describeOf('user.role_changed', { role: 'OWNER' }, { role: 'LEAD' })).toBeNull();
    expect(describeOf('user.deactivated', { isActive: false }, { isActive: false })).toBeNull();
    expect(describeOf('user.password_reset', null, null)).toBeNull();
    expect(NO_DETAIL).toEqual({ before: '—', after: '—' });
  });

});

describe('STORY-05.12 AC-3: the quantity warning event names the rows and holds no figure', () => {
  const event = AUDIT_EVENTS['calculation.warning_acknowledged'];
  const rows = [
    { code: 'QTY_ZERO', nodeId: 'node-1', slNo: '1.1', label: 'Invented top cover' },
    { code: 'QTY_ZERO', nodeId: 'node-2', slNo: '1.1.1', label: '' },
  ];

  it('is wired, about the estimate, under the "Quantity warning" filter', () => {
    expect(event).toMatchObject({ status: 'wired', objectType: 'estimate', category: 'quantity_warning' });
  });

  it('says which rows the person went ahead with, by Sl. No and name, and the Sl. No alone for a part with no name', () => {
    expect(event.describeStored(null, { warnings: rows })).toEqual({ before: 'No warning', after: 'Went ahead with QTY per Assy 0 on 1.1 Invented top cover, 1.1.1' });
  });

  it.each([
    ['an extra key on the event', null, { warnings: rows, total: '917373.37' }],
    ['an extra key on a row', null, { warnings: [{ ...(rows[0] ?? {}), cost: '5.00' }] }],
    ['a code that is not QTY_ZERO', null, { warnings: [{ ...(rows[0] ?? {}), code: 'OTHER' }] }],
    ['no rows', null, { warnings: [] }],
    ['a before that is not null', { warnings: rows }, { warnings: rows }],
    ['no warnings key', null, {}],
  ])('refuses %s, so nothing but the rows can be kept', (_name, before, after) => {
    expect(event.describeStored(before, after)).toBeNull();
  });
});

describe('STORY-06.06 AC-2, STORY-06.07 AC-2: the approval event keeps the price, the calculated total, the approver and whether it is an override, and nothing else', () => {
  const event = AUDIT_EVENTS['approval.approved'];
  const after = { approvedPrice: '12600.00', calculatedTotal: '12629.9876', approver: 'Invented Lead', isOverride: false };

  it('is wired, about the estimate, under the "Approval" filter', () => {
    expect(event).toMatchObject({ status: 'wired', objectType: 'estimate', category: 'approval' });
    expect(eventsInCategory('approval')).toEqual(['approval.approved']);
  });

  it('says what was approved, at what price, against which total and by whom', () => {
    expect(event.describeStored(null, after)).toEqual({ before: 'Not approved', after: 'Approved at ₹ 12,600.00, the calculated total was ₹ 12,629.99, by Invented Lead' });
  });

  it.each([
    ['an extra key (a rate has no place here)', null, { ...after, rate: '0.37' }],
    ['a price as a number', null, { ...after, approvedPrice: 12600 }],
    ['a negative price', null, { ...after, approvedPrice: '-1.00' }],
    ['no approver', null, { approvedPrice: after.approvedPrice, calculatedTotal: after.calculatedTotal, isOverride: false }],
    ['no flag', null, { approvedPrice: after.approvedPrice, calculatedTotal: after.calculatedTotal, approver: after.approver }],
    ['a flag that is not a boolean', null, { ...after, isOverride: 'yes' }],
    ['the reason (it belongs to the override entry)', null, { ...after, isOverride: true, reason: 'Rounded.' }],
    ['an empty approver', null, { ...after, approver: '' }],
    ['a before that is not null', { approvedPrice: '1.00' }, after],
  ])('refuses %s', (_name, before, stored) => {
    expect(event.describeStored(before, stored)).toBeNull();
  });

  it('says the same words whether or not the price is an override: the override has its own entry', () => {
    expect(event.describeStored(null, { ...after, isOverride: true })).toEqual({ before: 'Not approved', after: 'Approved at ₹ 12,600.00, the calculated total was ₹ 12,629.99, by Invented Lead' });
  });
});

describe('STORY-06.07 AC-2, AC-3 (SCR-16): the price-override event keeps the calculated total, the price and the reason, and nothing else', () => {
  const event = AUDIT_EVENTS['approval.price_overridden'];
  const before = { calculatedTotal: '12629.99' };
  const after = { approvedPrice: '12600.00', reason: 'Rounded down to a whole hundred for the customer quote.' };

  it('is wired, about the estimate, under the "Price override" filter', () => {
    expect(event).toMatchObject({ status: 'wired', objectType: 'estimate', category: 'price_override' });
    expect(auditCategoryLabel('price_override')).toBe('Price override');
  });

  it('reads as the spec gives it: "Calculated ₹ 12,629.99 to Approved ₹ 12,600.00. Reason: …"', () => {
    expect(event.describeStored(before, after)).toEqual({
      before: 'Calculated ₹ 12,629.99',
      after: 'Approved ₹ 12,600.00. Reason: Rounded down to a whole hundred for the customer quote.',
    });
  });

  it('says "No reason given." when the Lead gave none (UX-31)', () => {
    expect(event.describeStored(before, { ...after, reason: null })).toEqual({ before: 'Calculated ₹ 12,629.99', after: 'Approved ₹ 12,600.00. No reason given.' });
  });

  it('shows a reason as typed, markup and spreadsheet signs included: the screen draws text', () => {
    expect(event.describeStored(before, { ...after, reason: '<b>=SUM(A1)</b>' })?.after).toBe('Approved ₹ 12,600.00. Reason: <b>=SUM(A1)</b>');
  });

  it('keeps a reason of exactly 500 characters, counted as the column counts them: 500 emoji are 500 characters, 501 are not', () => {
    expect(event.describeStored(before, { ...after, reason: 'x'.repeat(500) })).not.toBeNull();
    expect(event.describeStored(before, { ...after, reason: '😀'.repeat(500) })).not.toBeNull();
    expect(event.describeStored(before, { ...after, reason: '😀'.repeat(501) })).toBeNull();
  });

  it.each([
    ['an extra key (a rate has no place here)', before, { ...after, rate: '0.37' }],
    ['an extra key in the before', { ...before, approver: 'Invented Lead' }, after],
    ['no reason key (null is how none is said)', before, { approvedPrice: after.approvedPrice }],
    ['an empty reason (none is null)', before, { ...after, reason: '' }],
    ['a reason over 500 characters', before, { ...after, reason: 'x'.repeat(501) }],
    ['a reason that is not text', before, { ...after, reason: 12 }],
    ['a price as a number', before, { ...after, approvedPrice: 12600 }],
    ['a negative price', before, { ...after, approvedPrice: '-1.00' }],
    ['no calculated total', {}, after],
    ['a before that is null', null, after],
  ])('refuses %s', (_name, stored, storedAfter) => {
    expect(event.describeStored(stored, storedAfter)).toBeNull();
  });
});

describe('STORY-06.08 AC-2: the unlock event keeps the price it stood at and the reason, and nothing else', () => {
  const event = AUDIT_EVENTS['approval.unlocked'];
  const before = { approvedPrice: '12600.00' };
  const after = { reason: 'The customer asked for a thicker plate.' };

  it('is wired, about the estimate, under the "Unlock" filter', () => {
    expect(event).toMatchObject({ status: 'wired', objectType: 'estimate', category: 'unlock' });
    expect(eventsInCategory('unlock')).toEqual(['approval.unlocked']);
  });

  it('says what the approval stood at and why it was unlocked', () => {
    expect(event.describeStored(before, after)).toEqual({ before: 'Approved at ₹ 12,600.00', after: 'Unlocked. Reason: The customer asked for a thicker plate.' });
  });

  it.each([
    ['an extra key in the before (a rate has no place here)', { ...before, rate: '0.37' }, after],
    ['an extra key in the after', before, { ...after, rate: '0.37' }],
    ['a price as a number', { approvedPrice: 12600 }, after],
    ['a negative price', { approvedPrice: '-1.00' }, after],
    ['no reason', before, {}],
    ['an empty reason', before, { reason: '' }],
    ['a reason over 500 characters', before, { reason: 'x'.repeat(501) }],
    ['a before that is null', null, after],
    ['an after that is null', before, null],
  ])('refuses %s', (_name, storedBefore, storedAfter) => {
    expect(event.describeStored(storedBefore, storedAfter)).toBeNull();
  });

  it('accepts a reason of exactly 500 characters', () => {
    expect(event.describeStored(before, { reason: 'x'.repeat(500) })).not.toBeNull();
  });
});

describe('STORY-06.12 AC-3, AC-7, AC-10: the cancel event keeps the price it stood at, the reason and the status before and after, and nothing else', () => {
  const event = AUDIT_EVENTS['approval.cancelled'];
  const before = { approvedPrice: '4750.00', status: 'APPROVED' };
  const after = { reason: 'The wrong customer was priced.', status: 'DRAFT' };

  it('is wired, about the estimate, under the "Approval cancelled" filter', () => {
    expect(event).toMatchObject({ status: 'wired', objectType: 'estimate', category: 'approval_cancelled' });
    expect(eventsInCategory('approval_cancelled')).toEqual(['approval.cancelled']);
  });

  it('says what the approval stood at and why it was cancelled (SCR-16: "Approved at ₹ 4,750.00 to Cancelled. Reason: …")', () => {
    expect(event.describeStored(before, after)).toEqual({ before: 'Approved at ₹ 4,750.00', after: 'Cancelled. Reason: The wrong customer was priced.' });
  });

  it.each([
    ['DRAFT', 'a Draft'],
    ['SUBMITTED', 'Submitted'],
  ])('says so when the estimate stayed %s (AC-10): the entry shows that the status did not change', (status, words) => {
    expect(event.describeStored({ ...before, status }, { ...after, status })).toEqual({
      before: 'Approved at ₹ 4,750.00',
      after: `Cancelled, the estimate stayed ${words}. Reason: The wrong customer was priced.`,
    });
  });

  it.each([
    ['an extra key in the before (a rate has no place here)', { ...before, rate: '0.37' }, after],
    ['an extra key in the after (the password has no place here)', before, { ...after, password: 'x' }],
    ['a price as a number', { ...before, approvedPrice: 4750 }, after],
    ['a status that is none', { ...before, status: 'CLOSED' }, after],
    ['no status in the after', before, { reason: after.reason }],
    ['no reason', before, { status: 'DRAFT' }],
    ['an empty reason', before, { ...after, reason: '' }],
    ['a reason over 500 characters', before, { ...after, reason: 'x'.repeat(501) }],
    ['a before that is null', null, after],
    ['an after that is null', before, null],
  ])('refuses %s', (_name, storedBefore, storedAfter) => {
    expect(event.describeStored(storedBefore, storedAfter)).toBeNull();
  });

  it('accepts a reason of exactly 500 characters, counted as code points', () => {
    expect(event.describeStored(before, { ...after, reason: 'x'.repeat(500) })).not.toBeNull();
    expect(event.describeStored(before, { ...after, reason: '😀'.repeat(500) })).not.toBeNull();
  });
});

describe('STORY-06.13 AC-3, AC-6, AC-7: the price-removed event keeps the price that was removed, and nothing else', () => {
  const event = AUDIT_EVENTS['approval.price_removed'];
  const before = { approvedPrice: '4750.00' };

  it('is wired, about the estimate, under the "Price removed" filter', () => {
    expect(event).toMatchObject({ status: 'wired', objectType: 'estimate', category: 'price_removed' });
    expect(eventsInCategory('price_removed')).toEqual(['approval.price_removed']);
  });

  it('says what was removed (SCR-16: "Price ₹ 4,750.00 removed from the estimate. The audit log keeps it")', () => {
    expect(event.describeStored(before, null)).toEqual({ before: 'Price ₹ 4,750.00', after: 'Removed from the estimate. The audit log keeps it' });
  });

  it.each([
    ['an extra key in the before (the password has no place here)', { ...before, password: 'x' }, null],
    ['a price as a number', { approvedPrice: 4750 }, null],
    ['a price with a currency sign', { approvedPrice: '₹ 4,750.00' }, null],
    ['no price', {}, null],
    ['an after that is not null', before, { reason: 'x' }],
    ['a before that is null', null, null],
  ])('refuses %s', (_name, storedBefore, storedAfter) => {
    expect(event.describeStored(storedBefore, storedAfter)).toBeNull();
  });
});

describe('AC-4: the shapes name their fields, so a secret has no place to go', () => {
  it('refuses an extra key on every wired user event, before and after (the Process Master events are held in masters-audit-events.test.ts)', () => {
    const valid: Record<string, readonly [unknown, unknown]> = {
      'user.created': [null, { role: 'ENGINEER', isActive: true }],
      'user.renamed': [{ name: 'Arjun Rai' }, { name: 'Arjun Rao' }],
      'user.role_changed': [{ role: 'ENGINEER' }, { role: 'LEAD' }],
      'user.deactivated': [{ isActive: true }, { isActive: false }],
      'user.activated': [{ isActive: false }, { isActive: true }],
      'user.password_reset': [{ mustChangePassword: false }, { mustChangePassword: true }],
      'user.admin_handed_over': [
        { adminId: '00000000-0000-4000-8000-0000000000a1', adminName: 'Arjun Rai' },
        { adminId: '00000000-0000-4000-8000-0000000000a2', adminName: 'Meera Nair' },
      ],
    };
    for (const name of WIRED_USER) {
      const [before, after] = valid[name] ?? [];
      expect(AUDIT_EVENTS[name].describeStored(before, after), name).not.toBeNull();
      const withHash = (value: unknown) => (typeof value === 'object' && value !== null ? { ...value, passwordHash: '$argon2id$x' } : value);
      // `user.created` has no "before" at all (null), so there is nothing to add a key to.
      if (before !== null) expect(AUDIT_EVENTS[name].describeStored(withHash(before), after), `${name} before`).toBeNull();
      expect(AUDIT_EVENTS[name].describeStored(before, withHash(after)), `${name} after`).toBeNull();
    }
  });
});

describe('STORY-08.02 AC-5: the words and the shapes of the formula change', () => {
  const event = AUDIT_EVENTS['config.formula_changed'];

  it('is wired, in the "Configuration change" category, about a field', () => {
    expect(event).toMatchObject({ status: 'wired', category: 'config_change', objectType: 'field' });
  });

  it('says the old formula and the new one, with the number of the version it made', () => {
    expect(event.describeStored({ formula: 'P * Cutting-Rate-per-Sec' }, { formula: 'P * Cutting-Rate-per-Sec * 2', version: 10 })).toEqual({
      before: 'P * Cutting-Rate-per-Sec',
      after: 'P * Cutting-Rate-per-Sec * 2 (configuration version 10)',
    });
  });

  it('refuses an empty formula, a version that is no number, and any other key (a password has no place to go)', () => {
    expect(event.describeStored({ formula: '' }, { formula: 'P', version: 2 })).toBeNull();
    expect(event.describeStored({ formula: 'P' }, { formula: 'P', version: 0 })).toBeNull();
    expect(event.before.safeParse({ formula: 'P', password: 'x' }).success).toBe(false);
    expect(event.after.safeParse({ formula: 'P', version: 2, password: 'x' }).success).toBe(false);
  });
});

describe('STORY-08.03 AC-9: the words and the shapes of a field insert', () => {
  const event = AUDIT_EVENTS['config.field_inserted'];
  const NEW_INPUT = { letter: 'AY', label: 'Invented Notch Count', kind: 'input', follows: 'AX', formula: null } as const;
  const NEW_COST = { letter: 'AZ', label: 'Invented Notch Cost', kind: 'output', follows: 'AY', formula: 'AY * 2' } as const;

  it('is wired, in the "Configuration change" category, about a field', () => {
    expect(event).toMatchObject({ status: 'wired', category: 'config_change', objectType: 'field' });
  });

  it('says the new column and what moved, with the number of the version it made (SPEC 14.6: AY, and AY to BO one to the right)', () => {
    expect(event.describeStored(null, { fields: [NEW_INPUT], moved: [{ from: 'AY', to: 'BO', by: 1 }], version: 10 })).toEqual({
      before: 'Not in the worksheet',
      after: 'Added as AY after AX. Columns AY to BO moved one to the right (configuration version 10)',
    });
  });

  it('reads a pair side by side as one, and says "two" for the places the later columns moved', () => {
    expect(event.describeStored(null, { fields: [NEW_INPUT, NEW_COST], moved: [{ from: 'AY', to: 'BO', by: 2 }], version: 11 })).toEqual({
      before: 'Not in the worksheet',
      after: 'Added as AY and AZ after AX. Columns AY to BO moved two to the right (configuration version 11)',
    });
  });

  it('names each place when the cost column is not next to its input, and says so when nothing moved (an insert after the last column)', () => {
    const apart = { ...NEW_COST, follows: 'BC' };
    expect(event.describeStored(null, { fields: [NEW_INPUT, apart], moved: [], version: 12 })?.after).toBe('Added as AY after AX and AZ after BC. No other column moved (configuration version 12)');
  });

  it('keeps the formula typed for an output (the log is read by the Admin alone) and has no key a password, a figure or a rate value could use', () => {
    expect(event.after.safeParse({ fields: [NEW_INPUT, NEW_COST], moved: [], version: 2 }).success).toBe(true);
    expect(event.after.safeParse({ fields: [NEW_INPUT], moved: [], version: 2, password: 'x' }).success).toBe(false);
    expect(event.after.safeParse({ fields: [{ ...NEW_INPUT, rate: 1 }], moved: [], version: 2 }).success).toBe(false);
  });

  it('keeps a formula longer than 2,000 characters: the display form of a rate name is longer than the stored form (review SQR-02)', () => {
    const long = `AY * ${'Invented-Rate '.repeat(190)}`.trim();
    expect(long.length).toBeGreaterThan(2_500);
    expect(event.after.safeParse({ fields: [NEW_INPUT, { ...NEW_COST, formula: long }], moved: [], version: 2 }).success).toBe(true);
    expect(event.after.safeParse({ fields: [{ ...NEW_COST, formula: '' }], moved: [], version: 2 }).success).toBe(false);
  });

  it('has no "before" (the field did not exist), no empty or three-field entry, and no version that is not a positive whole number', () => {
    expect(event.before.safeParse({}).success).toBe(false);
    expect(event.after.safeParse({ fields: [], moved: [], version: 2 }).success).toBe(false);
    expect(event.after.safeParse({ fields: [NEW_INPUT, NEW_COST, NEW_COST], moved: [], version: 2 }).success).toBe(false);
    expect(event.describeStored(null, { fields: [NEW_INPUT], moved: [], version: 0 })).toBeNull();
  });
});

describe('CR-01 item 6, AC-17 (SCR-16 "Task change"): the customer-changed event keeps the two companies by name and short name, and nothing else', () => {
  const event = AUDIT_EVENTS['estimate.customer_changed'];
  const BWC = { name: 'Brightwater Controls', shortName: 'BWC' };
  const MAS = { name: 'Marlow Agro Systems', shortName: 'MAS' };

  it('is wired, about the estimate, under the "Task change" filter', () => {
    expect(event).toMatchObject({ status: 'wired', objectType: 'estimate', category: 'task_change' });
  });

  it('says the customer before and after with its short name, and "No customer" for an estimate that had none', () => {
    expect(event.describeStored({ customer: BWC }, { customer: MAS })).toEqual({ before: 'Brightwater Controls (BWC)', after: 'Marlow Agro Systems (MAS)' });
    expect(event.describeStored({ customer: null }, { customer: MAS })).toEqual({ before: 'No customer', after: 'Marlow Agro Systems (MAS)' });
  });

  it('has no key for a rate, a figure, a contact detail or an ID: a state with one is refused, and an empty name is refused', () => {
    expect(event.after.safeParse({ customer: { ...MAS, rate: '1.00' } }).success).toBe(false);
    expect(event.after.safeParse({ customer: { ...MAS, phone: '+99 555 0142' } }).success).toBe(false);
    expect(event.after.safeParse({ customer: { ...MAS, id: '00000000-0000-4000-8000-0000000000c1' } }).success).toBe(false);
    expect(event.after.safeParse({ customer: { name: '', shortName: 'MAS' } }).success).toBe(false);
    expect(event.after.safeParse({ customer: MAS, extra: true }).success).toBe(false);
    expect(event.describeStored({ customer: BWC }, { customer: { name: 'x' } })).toBeNull();
  });
});

describe('STORY-04.07 AC-4 (SCR-16 "Task change"): the reassign event keeps the Engineer and the deadline, and nothing else', () => {
  const event = AUDIT_EVENTS['task.reassigned'];
  const ARJUN = { id: '00000000-0000-4000-8000-0000000000e1', name: 'Arjun Rao' };
  const MEERA = { id: '00000000-0000-4000-8000-0000000000e2', name: 'Meera Nair' };
  /** 17:00 IST on 03 November, and 12:00 IST on 04 November. */
  const FIRST = '2026-11-03T11:30:00.000Z';
  const SECOND = '2026-11-04T06:30:00.000Z';

  it('is wired, about the task, under the "Task change" filter', () => {
    expect(event).toMatchObject({ status: 'wired', objectType: 'task', category: 'task_change' });
  });

  it('says the two times in IST for a new deadline, as the spec gives them', () => {
    expect(event.describeStored({ engineer: ARJUN, deadlineAt: FIRST }, { engineer: ARJUN, deadlineAt: SECOND })).toEqual({
      before: '03 Nov 2026, 17:00 IST',
      after: '04 Nov 2026, 12:00 IST',
    });
  });

  it('says the two names for a new Engineer, as the spec gives them', () => {
    expect(event.describeStored({ engineer: ARJUN, deadlineAt: FIRST }, { engineer: MEERA, deadlineAt: FIRST })).toEqual({ before: 'Arjun Rao', after: 'Meera Nair' });
  });

  it('says both for a change of both, the Engineer and then the deadline on each side', () => {
    expect(event.describeStored({ engineer: ARJUN, deadlineAt: FIRST }, { engineer: MEERA, deadlineAt: SECOND })).toEqual({
      before: 'Arjun Rao, 03 Nov 2026, 17:00 IST',
      after: 'Meera Nair, 04 Nov 2026, 12:00 IST',
    });
  });

  it('writes a 23:30 IST deadline as 23:30 on that IST day, not as the next UTC day', () => {
    expect(event.describeStored({ engineer: ARJUN, deadlineAt: FIRST }, { engineer: ARJUN, deadlineAt: '2026-11-09T18:00:00.000Z' })?.after).toBe('09 Nov 2026, 23:30 IST');
  });

  it.each([
    ['an extra key (an e-mail address has no place here)', { engineer: ARJUN, deadlineAt: FIRST }, { engineer: { ...MEERA, email: 'a@b.test' }, deadlineAt: FIRST }],
    ['an extra key on the state (a folder path has no place here)', { engineer: ARJUN, deadlineAt: FIRST, folderPath: 'invented-path' }, { engineer: MEERA, deadlineAt: FIRST }],
    ['a deadline that is not an instant', { engineer: ARJUN, deadlineAt: FIRST }, { engineer: MEERA, deadlineAt: 'tomorrow' }],
    ['an Engineer with no name', { engineer: ARJUN, deadlineAt: FIRST }, { engineer: { id: MEERA.id, name: '' }, deadlineAt: FIRST }],
    ['a before that is null', null, { engineer: MEERA, deadlineAt: FIRST }],
    ['an after that is null', { engineer: ARJUN, deadlineAt: FIRST }, null],
  ])('refuses %s', (_name, storedBefore, storedAfter) => {
    expect(event.describeStored(storedBefore, storedAfter)).toBeNull();
  });
});
