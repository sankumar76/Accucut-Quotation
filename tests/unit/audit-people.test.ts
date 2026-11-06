import { describe, expect, it } from 'vitest';

import type { UserSummary } from '@/server/repositories/user-repository';
import { auditPeople } from '@/server/views/audit-people';

/**
 * STORY-01.07 AC-6 (architect, comment 11091): the choices of the Who filter are every user, deactivated ones included, sorted by
 * name, and each is an ID and a name and nothing else. Every name and address is invented.
 */

function person(id: string, name: string, overrides: Partial<UserSummary> = {}): UserSummary {
  return { id, name, email: `${id}@example.test`, role: 'ENGINEER', isActive: true, ...overrides };
}

describe('AC-6: the people of the Who filter', () => {
  it('keeps only the ID and the name of each person: no e-mail address, role or active flag', () => {
    const people = auditPeople([person('a', 'Arjun Rao', { role: 'ADMIN' })]);
    expect(people).toEqual([{ id: 'a', name: 'Arjun Rao' }]);
    expect(Object.keys(people[0] ?? {}).sort()).toEqual(['id', 'name']);
    expect(JSON.stringify(people)).not.toMatch(/example\.test|ADMIN|isActive|role|email/);
  });

  it('lists everyone, deactivated people included, sorted by name and not by role or status', () => {
    const people = auditPeople([
      person('1', 'Zed Last', { role: 'ADMIN' }),
      person('2', 'Meera Iyer', { isActive: false }),
      person('3', 'Arjun Rao', { role: 'LEAD' }),
    ]);
    expect(people.map((entry) => entry.name)).toEqual(['Arjun Rao', 'Meera Iyer', 'Zed Last']);
  });

  it('puts two people of one name in a fixed order, by ID, so the list does not change between page loads', () => {
    const first = auditPeople([person('b', 'Same Name'), person('a', 'Same Name')]);
    const second = auditPeople([person('a', 'Same Name'), person('b', 'Same Name')]);
    expect(first.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(second).toEqual(first);
  });

  it('does not change the list it was given', () => {
    const given = [person('2', 'B'), person('1', 'A')];
    auditPeople(given);
    expect(given.map((entry) => entry.id)).toEqual(['2', '1']);
  });
});
