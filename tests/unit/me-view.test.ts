import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '@/server/auth/resolve-session-user';
import { buildMe } from '@/server/views/me-view';
import { meResponseSchema } from '@/server/views/schemas/me';

/**
 * STORY-01.02 AC-7 (BR-003): `GET /api/v1/me` returns the name, e-mail, role, navigation and overdue count, through a
 * strict schema, and no field of the user beyond those.
 */

function person(role: AuthenticatedUser['role']): AuthenticatedUser {
  return { id: '00000000-0000-4000-8000-00000000f00d', name: 'Invented Person', email: 'invented.person@example.test', role, mustChangePassword: true };
}

describe('AC-7: the projection', () => {
  it('holds only the five fields of the schema, and nothing from the user beyond them', () => {
    const me = buildMe(person('LEAD'), { includeHiddenInProduction: true });
    expect(Object.keys(me).sort()).toEqual(['email', 'name', 'navigation', 'overdueCount', 'role']);
    expect(JSON.stringify(me)).not.toContain('00000000-0000-4000-8000-00000000f00d');
    expect(JSON.stringify(me)).not.toContain('mustChangePassword');
  });

  it('is accepted by its own strict schema, for each role', () => {
    for (const role of ['ADMIN', 'LEAD', 'ENGINEER'] as const) {
      expect(meResponseSchema.safeParse(buildMe(person(role), { includeHiddenInProduction: true })).success).toBe(true);
    }
  });

  it('the strict schema refuses a key it does not name, such as a cost', () => {
    const me = buildMe(person('ENGINEER'), { includeHiddenInProduction: true });
    expect(meResponseSchema.safeParse({ ...me, unitCost: 1 }).success).toBe(false);
    expect(meResponseSchema.safeParse({ ...me, navigation: [{ group: 'Work', label: 'x', href: '/x', icon: 'house' }] }).success).toBe(false);
  });

  it('the menu is the same list the page frame draws: an Engineer has no Admin or Lead entry', () => {
    const engineer = buildMe(person('ENGINEER'), { includeHiddenInProduction: false });
    expect(engineer.navigation).toEqual([
      { group: 'Work', label: 'My tasks', href: '/queue' },
      { group: 'Work', label: 'Home', href: '/' },
    ]);
    expect(buildMe(person('ADMIN'), { includeHiddenInProduction: false }).navigation[0]).toEqual({ group: 'Work', label: 'Task queue', href: '/queue' });
  });

  it('the overdue count is 0 until story 04.03', () => {
    expect(buildMe(person('ADMIN'), { includeHiddenInProduction: false }).overdueCount).toBe(0);
  });
});
