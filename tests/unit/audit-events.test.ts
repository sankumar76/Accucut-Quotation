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

const WIRED_USER: ReadonlyArray<AuditEventName> = ['user.created', 'user.renamed', 'user.role_changed', 'user.deactivated', 'user.activated', 'user.password_reset'];
/** STORY-02.01: the three events of the Process Master. */
const WIRED_MASTER: ReadonlyArray<AuditEventName> = ['master.created', 'master.edited', 'master.deleted'];
/** STORY-05.12: a Calculate that went ahead past a warning. */
const WIRED_CALCULATION: ReadonlyArray<AuditEventName> = ['calculation.warning_acknowledged'];
/** STORY-06.06: an estimate approved and locked; STORY-06.07: a price that differs from the calculated total. Registry order puts them before the quantity warning. */
const WIRED_APPROVAL: ReadonlyArray<AuditEventName> = ['approval.approved', 'approval.price_overridden'];
const WIRED: ReadonlyArray<AuditEventName> = [...WIRED_USER, ...WIRED_MASTER, ...WIRED_APPROVAL, ...WIRED_CALCULATION];
const RESERVED: ReadonlyArray<AuditEventName> = ['approval.unlocked', 'approval.cancelled', 'approval.price_removed'];

describe('AC-3: what is wired and what is declared', () => {
  it('wires exactly the six user events of the Users screen, the three events of the Process Master, the approval and the price override, and the quantity warning of Calculate', () => {
    expect(wiredEvents()).toEqual(WIRED);
  });

  it('declares the events of the later stories and wires none of them: unlock, cancel, remove price', () => {
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

  it('puts the six user events under "User change" and the others each under their own', () => {
    expect(eventsInCategory('user_change')).toEqual(WIRED_USER);
    expect(eventsInCategory('master_data')).toEqual(WIRED_MASTER);
    expect(eventsInCategory('price_override')).toEqual(['approval.price_overridden']);
    expect(eventsInCategory('approval_cancelled')).toEqual(['approval.cancelled']);
    expect(eventsInCategory('price_removed')).toEqual(['approval.price_removed']);
    expect(eventsInCategory('quantity_warning')).toEqual(['calculation.warning_acknowledged']);
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

  it('gives no words for stored values that do not fit the event (an older shape, a damaged row), and the screen shows a dash', () => {
    expect(describeOf('user.created', { role: 'ENGINEER' }, { role: 'ENGINEER', isActive: true })).toBeNull();
    expect(describeOf('user.role_changed', { role: 'OWNER' }, { role: 'LEAD' })).toBeNull();
    expect(describeOf('user.deactivated', { isActive: false }, { isActive: false })).toBeNull();
    expect(describeOf('user.password_reset', null, null)).toBeNull();
    expect(NO_DETAIL).toEqual({ before: '—', after: '—' });
  });

  it('gives a declared event no words yet, whatever it holds', () => {
    expect(describeOf('approval.cancelled', { price: 1 }, null)).toEqual(NO_DETAIL);
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

describe('AC-4: the shapes name their fields, so a secret has no place to go', () => {
  it('refuses an extra key on every wired user event, before and after (the Process Master events are held in masters-audit-events.test.ts)', () => {
    const valid: Record<string, readonly [unknown, unknown]> = {
      'user.created': [null, { role: 'ENGINEER', isActive: true }],
      'user.renamed': [{ name: 'Arjun Rai' }, { name: 'Arjun Rao' }],
      'user.role_changed': [{ role: 'ENGINEER' }, { role: 'LEAD' }],
      'user.deactivated': [{ isActive: true }, { isActive: false }],
      'user.activated': [{ isActive: false }, { isActive: true }],
      'user.password_reset': [{ mustChangePassword: false }, { mustChangePassword: true }],
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
