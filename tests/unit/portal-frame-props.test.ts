import { describe, expect, it } from 'vitest';

import { portalFrameProps } from '@/app/(portal)/portal-frame-props';
import type { AuthenticatedUser } from '@/server/auth/session';

/**
 * AQP-188 AC-9 (NFR-001, NFR-002, BR-003): the layout builds the props of the frame's client components in one
 * function. Given a user with every field of `AuthenticatedUser`, the output holds only the name, the e-mail, the role label
 * and the role's navigation entries (label, address, icon). The id and `mustChangePassword` are absent.
 */

const USER: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-00000000f00d',
  name: 'Invented Person',
  email: 'invented.person@example.test',
  role: 'LEAD',
  mustChangePassword: true,
};

/** Every key and every string in a value, however deep (React elements included). */
function collect(value: unknown, keys: Set<string>, strings: Set<string>, seen = new Set<object>()): void {
  if (typeof value === 'string') strings.add(value);
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value);
  for (const [key, inner] of Object.entries(value)) {
    keys.add(key);
    collect(inner, keys, strings, seen);
  }
}

describe('portal frame props (AC-9)', () => {
  const props = portalFrameProps(USER);

  it('holds the name, the e-mail and the role label for the account menu', () => {
    expect(props.account).toEqual({ name: 'Invented Person', email: 'invented.person@example.test', role: 'Lead' });
  });

  it('holds only label, address and icon for each navigation entry, grouped as before', () => {
    expect(props.navGroups.length).toBeGreaterThan(0);
    for (const group of props.navGroups) {
      expect(Object.keys(group).sort()).toEqual(['items', 'label']);
      for (const item of group.items) expect(Object.keys(item).sort()).toEqual(['href', 'icon', 'label']);
    }
    expect(props.navGroups[0]?.label).toBe('Work');
    expect(props.navGroups[0]?.items.map((item) => item.href)).toEqual(['/queue', '/']);
  });

  it('carries neither the id nor mustChangePassword anywhere, in a key or in a value', () => {
    const keys = new Set<string>();
    const strings = new Set<string>();
    collect(props, keys, strings);
    expect(keys.has('id')).toBe(false);
    expect(keys.has('mustChangePassword')).toBe(false);
    expect([...strings].some((text) => text.includes(USER.id))).toBe(false);
  });

  it('shows each role its own queue title and the same account fields', () => {
    const engineer = portalFrameProps({ ...USER, role: 'ENGINEER' });
    const admin = portalFrameProps({ ...USER, role: 'ADMIN' });
    expect(engineer.navGroups[0]?.items[0]?.label).not.toBe(admin.navGroups[0]?.items[0]?.label);
    expect(engineer.account.role).toBe('Engineer');
    expect(admin.account.role).toBe('Admin');
  });
});
