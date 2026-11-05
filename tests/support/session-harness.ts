import { vi } from 'vitest';

import type { RoleName } from '../../src/lib/auth/roles';

import { createFakeUserRepository, type FakeUserRepository } from './fake-auth-repositories';
import { defined } from './defined';

/**
 * A signed-in caller for the tests that run the real routes and pages (`tests/security`), without a database or a
 * server. One invented person per role sits in a fake user repository, and `signInAs(role)` makes the next request come
 * from that person (`signInAs(null)` from nobody). The session itself is the real one: `getCurrentUser`, `requireUser`,
 * `requireUserOrRedirect` and `requireRole` run against the fake repository, so a deactivation or a role change in the
 * test is seen at the next request exactly as it is in the portal. Only the edges are replaced: `getServerSession`,
 * the request headers, `redirect`, `forbidden`, `notFound` and the composition root.
 *
 * Use it through `vi.mock` factories that import this file (see `role-matrix.test.ts`), because `vi.mock` is hoisted
 * above ordinary imports. Every name and address here is invented.
 */

export const REDIRECT_PREFIX = 'NEXT_REDIRECT:';
export const FORBIDDEN_SIGNAL = 'NEXT_FORBIDDEN';
export const NOT_FOUND_SIGNAL = 'NEXT_NOT_FOUND';

const PEOPLE: ReadonlyArray<{ readonly role: RoleName; readonly name: string; readonly email: string }> = [
  { role: 'ADMIN', name: 'Invented Admin', email: 'invented.admin@example.test' },
  { role: 'LEAD', name: 'Invented Lead', email: 'invented.lead@example.test' },
  { role: 'ENGINEER', name: 'Invented Engineer', email: 'invented.engineer@example.test' },
];

export interface SessionHarness {
  readonly users: FakeUserRepository;
  /** The id of each role's person. */
  readonly idOf: Readonly<Record<RoleName, string>>;
  /** Who the next request comes from; `null` for nobody. */
  signInAs(role: RoleName | null): void;
  /** The address `proxy.ts` would record for the request, or `null` for none. */
  recordReturnPath(path: string | null): void;
  readonly getServerSession: ReturnType<typeof vi.fn>;
  readonly headers: () => Promise<Headers>;
  readonly redirect: (path: string) => never;
  readonly forbidden: () => never;
  readonly notFound: () => never;
}

export function createSessionHarness(): SessionHarness {
  const users = createFakeUserRepository(
    PEOPLE.map((person) => ({ name: person.name, email: person.email, passwordHash: 'invented-hash', role: person.role, mustChangePassword: false })),
  );
  const idFor = (role: RoleName): string => defined(users.records.find((record) => record.role === role)).id;
  const idOf: Readonly<Record<RoleName, string>> = { ADMIN: idFor('ADMIN'), LEAD: idFor('LEAD'), ENGINEER: idFor('ENGINEER') };
  const state: { callerId: string | null; returnPath: string | null } = { callerId: null, returnPath: null };

  return {
    users,
    idOf,
    signInAs(role) {
      state.callerId = role === null ? null : idOf[role];
    },
    recordReturnPath(path) {
      state.returnPath = path;
    },
    getServerSession: vi.fn(() =>
      Promise.resolve(state.callerId === null ? null : { expires: 'x', userId: state.callerId, sessionVersion: 0, signedAt: Date.now() / 1_000 }),
    ),
    headers: () => Promise.resolve(new Headers(state.returnPath === null ? {} : { 'x-return-path': state.returnPath })),
    redirect: (path) => {
      throw new Error(`${REDIRECT_PREFIX}${path}`);
    },
    forbidden: () => {
      throw new Error(FORBIDDEN_SIGNAL);
    },
    notFound: () => {
      throw new Error(NOT_FOUND_SIGNAL);
    },
  };
}

/** The one harness of a test file; the mock factories and the test share it through this module. */
export const harness: SessionHarness = createSessionHarness();
