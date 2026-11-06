import type { NextAuthOptions } from 'next-auth';

import { loadAppEnv } from '../lib/env';
import { systemClock } from '../lib/time';

import { buildAuthOptions } from './auth/options';
import { passwordHasher } from './auth/password-hasher';
import { createAuditRepository } from './repositories/audit-repository';
import { getPrismaClient } from './repositories/prisma-client';
import { createThrottleRepository } from './repositories/throttle-repository';
import { createTransactionRunner } from './repositories/transaction';
import { createUserRepository, type UserRepository } from './repositories/user-repository';
import { type AuditService, createAuditService } from './services/audit-service';
import { type AuthService, createAuthService } from './services/auth-service';
import { createUserService, type UserService } from './services/user-service';

/**
 * Where the pieces are put together for the web process (a composition root). Services and repositories take
 * their dependencies as arguments, so tests build them over a test database; this is the one place that picks
 * the real ones: the shared runtime-role database client, the system clock, the real hasher and `AUTH_SECRET`.
 *
 * Everything is built on first use, not at import, so `next build` (which has no settings) can load the modules.
 */

let userRepository: UserRepository | undefined;
let authService: AuthService | undefined;
let userService: UserService | undefined;
let auditService: AuditService | undefined;
let authOptions: NextAuthOptions | undefined;

function runtimeClient() {
  return getPrismaClient('app', loadAppEnv().DATABASE_URL);
}

export function getUserRepository(): UserRepository {
  userRepository ??= createUserRepository(runtimeClient());
  return userRepository;
}

export function getAuthService(): AuthService {
  authService ??= createAuthService({
    users: getUserRepository(),
    throttles: createThrottleRepository(runtimeClient()),
    hasher: passwordHasher,
    clock: systemClock,
    keySecret: loadAppEnv().AUTH_SECRET,
  });
  return authService;
}

/** The audit log: appended in a caller's transaction, read by the Admin's screen (STORY-01.07). */
export function getAuditService(): AuditService {
  auditService ??= createAuditService({ audit: createAuditRepository(runtimeClient()) });
  return auditService;
}

/**
 * User management by the Admin (STORY-01.04). Shares the runtime-role client, the real hasher and the throttle table of sign-in.
 * Every change runs in one transaction with its audit entry (STORY-01.07).
 */
export function getUserService(): UserService {
  userService ??= createUserService({
    users: getUserRepository(),
    throttles: createThrottleRepository(runtimeClient()),
    hasher: passwordHasher,
    transactions: createTransactionRunner(runtimeClient()),
    audit: getAuditService(),
    keySecret: loadAppEnv().AUTH_SECRET,
  });
  return userService;
}

/**
 * The next-auth options for the running process. `NEXTAUTH_URL` is set from `APP_ORIGIN` so next-auth builds its
 * addresses from the portal's own origin, whatever host header arrives, and never from a request header.
 */
export function getAuthOptions(): NextAuthOptions {
  if (authOptions === undefined) {
    const env = loadAppEnv();
    process.env.NEXTAUTH_URL = env.APP_ORIGIN;
    authOptions = buildAuthOptions({
      authService: getAuthService(),
      clock: systemClock,
      secret: env.AUTH_SECRET,
      production: process.env.NODE_ENV === 'production',
    });
  }
  return authOptions;
}
