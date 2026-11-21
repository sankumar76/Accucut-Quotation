import { createFixedClock, type FixedClock } from '../../src/lib/time';
import type { MailService } from '../../src/server/mail/mail-service';
import type { PasswordResetRepository } from '../../src/server/repositories/password-reset-repository';
import type { OutboxMessage } from '../../src/server/repositories/email-outbox-repository';
import { createTransactionHandle, type TransactionRunner } from '../../src/server/repositories/transaction';
import { normaliseEmail } from '../../src/server/repositories/user-repository';
import { createPasswordResetService, type PasswordResetService } from '../../src/server/services/password-reset-service';

import { defined } from './defined';
import {
  createCountingHasher,
  createFakeThrottleRepository,
  createFakeUserRepository,
  type CountingHasher,
  type FakeThrottleRepository,
  type FakeUserRepository,
} from './fake-auth-repositories';

/**
 * The world of the unit tests of the reset by e-mailed link (STORY-09.07): three invented people in an in-memory user repository (one of them deactivated), an in-memory token table that claims
 * a token the way the SQL statement does, an in-memory outbox that keeps every message the service queues, a counting hasher, a controlled clock, and the REAL service over them. A statement
 * counter records every call the service makes to the token repository inside its transaction, so a test can show that a request for a real person and one for no one make the same number.
 * The SQL itself (the atomic claim, the unique index, the grants) is tested against PostgreSQL in `tests/integration/auth/password-reset.test.ts`. Every name, address and password is invented.
 */

export const RESET_KEY_SECRET = 'invented-throttle-key-material';
export const APP_ORIGIN = 'https://portal.example.test';
export const START = new Date('2026-11-21T10:00:00.000Z');
export const OLD_PASSWORD = 'Tn4#vLm8@Qz-current';
export const NEW_PASSWORD = 'Pr9$kWd3!Rx-fresh';

export interface FakeTokenRow {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  usedAt: Date | null;
  readonly createdAt: Date;
}

export interface FakeResetWorld {
  readonly users: FakeUserRepository;
  readonly throttles: FakeThrottleRepository;
  readonly hasher: CountingHasher;
  readonly clock: FixedClock;
  readonly tokens: FakeTokenRow[];
  /** Every message the service queued, with the transaction it was queued in. */
  readonly queued: OutboxMessage[];
  /** The operations the service ran inside its transactions, in order (`issue`, `simulateIssue`, `enqueue`, `claim`, ...). */
  readonly statements: string[];
  readonly service: PasswordResetService;
  readonly state: { emailEnabled: boolean };
  readonly personId: string;
  readonly leadId: string;
  readonly deactivatedId: string;
  /** The text of the last link in the last queued message. */
  linkOfLastMessage(): string;
  /** Rebuilds the service with a repository or two replaced (a racing or failing one). */
  build(overrides?: { readonly resets?: Partial<PasswordResetRepository> }): PasswordResetService;
}

export function createFakeResetWorld(): FakeResetWorld {
  const users = createFakeUserRepository([
    { name: 'Invented Person', email: 'Invented.Person@Example.TEST', passwordHash: `hash:${OLD_PASSWORD}`, role: 'ENGINEER', mustChangePassword: true },
    { name: 'Invented Lead', email: 'invented.lead@example.test', passwordHash: `hash:${OLD_PASSWORD}`, role: 'LEAD', mustChangePassword: false },
    { name: 'Invented Former', email: 'invented.former@example.test', passwordHash: `hash:${OLD_PASSWORD}`, role: 'ENGINEER', mustChangePassword: false },
  ]);
  const deactivated = defined(users.records[2]);
  deactivated.isActive = false;
  const throttles = createFakeThrottleRepository();
  const hasher = createCountingHasher();
  const clock = createFixedClock(START);
  const tokens: FakeTokenRow[] = [];
  const queued: OutboxMessage[] = [];
  const statements: string[] = [];
  const state = { emailEnabled: true };
  let nextId = 1;

  const resets: PasswordResetRepository = {
    findRequester(email) {
      const found = users.records.find((record) => record.email === normaliseEmail(email) && record.isActive);
      return Promise.resolve(found === undefined ? null : { id: found.id, name: found.name });
    },
    issue(_tx, { userId, tokenHash, expiresAt, now }) {
      statements.push('issue');
      const id = `00000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`;
      nextId += 1;
      tokens.push({ id, userId, tokenHash, expiresAt, usedAt: null, createdAt: now });
      return Promise.resolve(id);
    },
    simulateIssue() {
      statements.push('simulateIssue-1', 'simulateIssue-2');
      return Promise.resolve();
    },
    findUsable(tokenHash, now) {
      const row = tokens.find((token) => token.tokenHash === tokenHash && token.usedAt === null && token.expiresAt.getTime() > now.getTime());
      const person = row === undefined ? undefined : users.records.find((record) => record.id === row.userId && record.isActive);
      return Promise.resolve(row === undefined || person === undefined ? null : { userId: row.userId, email: person.email });
    },
    claim(_tx, tokenHash, now) {
      statements.push('claim');
      const row = tokens.find((token) => token.tokenHash === tokenHash && token.usedAt === null && token.expiresAt.getTime() > now.getTime());
      const person = row === undefined ? undefined : users.records.find((record) => record.id === row.userId && record.isActive);
      if (row === undefined || person === undefined) return Promise.resolve(null);
      row.usedAt = now;
      return Promise.resolve(row.userId);
    },
    invalidateOthers(_tx, userId, now) {
      statements.push('invalidateOthers');
      const others = tokens.filter((token) => token.userId === userId && token.usedAt === null);
      for (const token of others) token.usedAt = now;
      return Promise.resolve(others.length);
    },
  };

  const mail: Pick<MailService, 'enqueue'> = {
    enqueue(_tx, message) {
      statements.push('enqueue');
      queued.push(message);
      return Promise.resolve('queued');
    },
  };

  // A transaction that keeps what it did, as the fake has no way to roll back: the one rollback that matters (a deactivated person) is tested against PostgreSQL.
  const transactions: TransactionRunner = { run: (work) => work(createTransactionHandle()) };

  function build(overrides: { readonly resets?: Partial<PasswordResetRepository> } = {}): PasswordResetService {
    return createPasswordResetService({
      resets: { ...resets, ...overrides.resets },
      users,
      throttles,
      hasher,
      transactions,
      mail,
      clock,
      keySecret: RESET_KEY_SECRET,
      appOrigin: () => APP_ORIGIN,
      emailEnabled: () => state.emailEnabled,
    });
  }

  const service = build();
  return {
    users,
    throttles,
    hasher,
    clock,
    tokens,
    queued,
    statements,
    service,
    state,
    personId: defined(users.records[0]).id,
    leadId: defined(users.records[1]).id,
    deactivatedId: deactivated.id,
    linkOfLastMessage() {
      const text = defined(queued.at(-1)).bodyText;
      const link = /https?:\/\/\S+/.exec(text)?.[0];
      return defined(link, 'a link in the message');
    },
    build,
  };
}

/** The token in a link `…/reset-password?token=<token>`. */
export function tokenOf(link: string): string {
  return defined(new URL(link).searchParams.get('token'), 'a token in the link');
}
