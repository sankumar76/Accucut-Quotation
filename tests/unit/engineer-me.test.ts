import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '@/server/auth/resolve-session-user';
import { buildMe } from '@/server/views/engineer-me';
import { meResponseSchema } from '@/server/views/schemas';

/**
 * STORY-01.02 AC-7 (BR-003): `GET /api/v1/me` returns the name, e-mail, role, navigation and overdue count, through a
 * strict schema, and no field of the user beyond those.
 */

function person(role: AuthenticatedUser['role']): AuthenticatedUser {
  return { id: '00000000-0000-4000-8000-00000000f00d', name: 'Invented Person', email: 'invented.person@example.test', role, mustChangePassword: true };
}

describe('AC-7: the projection', () => {
  it('holds only the five fields of the schema, and nothing from the user beyond them', () => {
    const me = buildMe(person('LEAD'), { includeHiddenInProduction: true, overdueCount: 0 });
    expect(Object.keys(me).sort()).toEqual(['email', 'name', 'navigation', 'overdueCount', 'role']);
    expect(JSON.stringify(me)).not.toContain('00000000-0000-4000-8000-00000000f00d');
    expect(JSON.stringify(me)).not.toContain('mustChangePassword');
  });

  it('is accepted by its own strict schema, for each role', () => {
    for (const role of ['ADMIN', 'LEAD', 'ENGINEER'] as const) {
      expect(meResponseSchema.safeParse(buildMe(person(role), { includeHiddenInProduction: true, overdueCount: 0 })).success).toBe(true);
    }
  });

  it('the strict schema refuses a key it does not name, such as a cost', () => {
    const me = buildMe(person('ENGINEER'), { includeHiddenInProduction: true, overdueCount: 0 });
    expect(meResponseSchema.safeParse({ ...me, unitCost: 1 }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...me, navigation: [{ group: 'Work', label: 'x', href: '/x', icon: 'house' }] }).success).toBe(false);
  });

  it('the menu is the same list the page frame draws: an Engineer has no Admin or Lead entry', () => {
    const engineer = buildMe(person('ENGINEER'), { includeHiddenInProduction: false, overdueCount: 0 });
    expect(engineer.navigation).toEqual([
      { group: 'Work', label: 'My tasks', href: '/queue' },
      { group: 'Work', label: 'Home', href: '/' },
    ]);
    expect(buildMe(person('ADMIN'), { includeHiddenInProduction: false, overdueCount: 0 }).navigation[0]).toEqual({ group: 'Work', label: 'Task queue', href: '/queue' });
  });

  it('the overdue count is the one the route read for the caller\'s role (STORY-04.03 AC-2), copied as it is', () => {
    expect(buildMe(person('ADMIN'), { includeHiddenInProduction: false, overdueCount: 4 }).overdueCount).toBe(4);
    expect(buildMe(person('ENGINEER'), { includeHiddenInProduction: false, overdueCount: 0 }).overdueCount).toBe(0);
  });

  it('is a whole number that is not negative, as its schema says, for every role', () => {
    for (const role of ['ADMIN', 'LEAD', 'ENGINEER'] as const) {
      expect(meResponseSchema.safeParse(buildMe(person(role), { includeHiddenInProduction: false, overdueCount: 3 })).success).toBe(true);
    }
    const me = buildMe(person('LEAD'), { includeHiddenInProduction: false, overdueCount: 3 });
    expect(meResponseSchema.safeParse({ ...me, overdueCount: -1 }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...me, overdueCount: 1.5 }).success).toBe(false);
  });
});
