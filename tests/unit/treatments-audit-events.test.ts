import { describe, expect, it } from 'vitest';

import { AUDIT_EVENTS, NO_DETAIL, type AuditEventName } from '@/server/services/audit-events';

/**
 * STORY-02.05 T2 (AC-6): the Treatment / Color list raises the generic master events (`master.created`, `master.edited`, `master.deleted`) with
 * `object_type` `treatment`, as architecture section 8 rules (AQP-74); AC-6's `master.treatment.*` is read with that ruling. The shape of what they
 * keep, the words the audit screen shows, and that the words are chosen by the entry's object type. Names are invented.
 */

const WORDS = (name: AuditEventName, before: unknown, after: unknown, objectType = 'treatment') => AUDIT_EVENTS[name].describeStored(before, after, objectType);

describe('master.created / master.edited / master.deleted for a treatment (AC-6)', () => {
  it('say the name: "Not added" to the name, the old name to the new one, the name to "Deleted"', () => {
    expect(WORDS('master.created', null, { name: 'Invented powder coat' })).toEqual({ before: 'Not added', after: 'Invented powder coat' });
    expect(WORDS('master.edited', { name: 'Invented powder coat' }, { name: 'Invented hard coat' })).toEqual({
      before: 'Invented powder coat',
      after: 'Invented hard coat',
    });
    expect(WORDS('master.deleted', { name: 'Invented hard coat' }, null)).toEqual({ before: 'Invented hard coat', after: 'Deleted' });
  });

  it('chooses the words by the entry\'s object type, never by the keys: a treatment state under another master\'s type shows a dash', () => {
    expect(WORDS('master.created', null, { name: 'Invented powder coat' }, 'process_item')).toEqual(NO_DETAIL);
    expect(WORDS('master.created', null, { name: 'Invented powder coat' }, 'material')).toEqual(NO_DETAIL);
    expect(WORDS('master.created', null, { name: 'Invented powder coat' }, 'customer')).toEqual(NO_DETAIL);
  });

  it('gives no words for stored values that do not fit (a blank name, an extra key, a missing name)', () => {
    expect(WORDS('master.created', null, { name: '' })).toBeNull();
    expect(WORDS('master.created', null, { name: 'Invented powder coat', unit: 'per kg' })).toBeNull();
    expect(WORDS('master.edited', { name: 'Invented powder coat' }, {})).toBeNull();
  });
});
