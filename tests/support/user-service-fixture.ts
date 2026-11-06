import { createAuditService, type AuditContext } from '../../src/server/services/audit-service';
import type { UserRepository } from '../../src/server/repositories/user-repository';
import { createUserService, type UserService } from '../../src/server/services/user-service';

import { defined } from './defined';
import { createFakeAuditWorld, type FakeAuditWorld } from './fake-audit';
import {
  createCountingHasher,
  createFakeThrottleRepository,
  createFakeUserRepository,
  type CountingHasher,
  type FakeThrottleRepository,
  type FakeUserRepository,
} from './fake-auth-repositories';

/**
 * The world of the unit tests of `user-service`: three invented people (an Admin, a Lead and an Engineer) in an in-memory user
 * repository, an in-memory audit log with its transaction runner, a counting hasher, and the real service over them. Shared by
 * `user-service.test.ts` (the rules of STORY-01.04) and `user-service-audit.test.ts` (the entries of STORY-01.07), so the two
 * files stay under the length limit without a second copy of the set-up.
 */

export const KEY_SECRET = 'invented-throttle-key-material';
export const REQUEST_ID = 'req-0a0b0c0d';

export interface UserServiceFixture {
  readonly users: FakeUserRepository;
  readonly throttles: FakeThrottleRepository;
  readonly hasher: CountingHasher;
  readonly world: FakeAuditWorld;
  /** The real service over the fakes above. */
  readonly service: UserService;
  /** The same service over another user repository (a racing or failing one). */
  build(repository?: UserRepository): UserService;
  /** The Admin (or whoever) making a change, on one request, under the name the fake repository holds for them. */
  by(actorId: string): AuditContext;
  readonly adminId: string;
  readonly leadId: string;
  readonly engineerId: string;
}

export function createUserServiceFixture(): UserServiceFixture {
  const users = createFakeUserRepository([
    { name: 'Invented Admin', email: 'admin@example.test', passwordHash: 'hash:x', role: 'ADMIN', mustChangePassword: false },
    { name: 'Invented Lead', email: 'lead@example.test', passwordHash: 'hash:x', role: 'LEAD', mustChangePassword: false },
    { name: 'Invented Engineer', email: 'engineer@example.test', passwordHash: 'hash:x', role: 'ENGINEER', mustChangePassword: false },
  ]);
  const throttles = createFakeThrottleRepository();
  const hasher = createCountingHasher();
  const world = createFakeAuditWorld();
  const build = (repository: UserRepository = users): UserService =>
    createUserService({
      users: repository,
      throttles,
      hasher,
      transactions: world.transactions,
      audit: createAuditService({ audit: world.audit }),
      keySecret: KEY_SECRET,
    });
  const idOf = (role: 'ADMIN' | 'LEAD' | 'ENGINEER'): string => defined(users.records.find((record) => record.role === role)).id;
  return {
    users,
    throttles,
    hasher,
    world,
    service: build(),
    build,
    by: (actorId) => ({
      actorId,
      // The name the request's signed-in user has: the person's own name (the ID in any letter case), or an invented one.
      actorLabel: users.records.find((record) => record.id.toLowerCase() === actorId.toLowerCase())?.name ?? 'Invented Unknown',
      requestId: REQUEST_ID,
    }),
    adminId: idOf('ADMIN'),
    leadId: idOf('LEAD'),
    engineerId: idOf('ENGINEER'),
  };
}

/** The error a promise rejects with; fails if it resolves. */
export async function refusal(action: Promise<unknown>): Promise<unknown> {
  return action.then(
    () => {
      throw new Error('expected a refusal');
    },
    (error: unknown) => error,
  );
}
