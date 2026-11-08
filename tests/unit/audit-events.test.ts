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
const WIRED: ReadonlyArray<AuditEventName> = [...WIRED_USER, ...WIRED_MASTER];
const RESERVED: ReadonlyArray<AuditEventName> = [
  'approval.approved',
  'approval.unlocked',
  'approval.price_overridden',
  'calculation.warning_acknowledged',
  'approval.cancelled',
  'approval.price_removed',
];

describe('AC-3: what is wired and what is declared', () => {
  it('wires exactly the six user events of the Users screen and the three events of the Process Master', () => {
    expect(wiredEvents()).toEqual(WIRED);
  });

  it('declares the events of the later stories and wires none of them: approval, unlock, price override, quantity warning, cancel, remove price', () => {
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
