import type { SendFailureCode, SendResult } from '../../src/lib/mail/codes';
import { createFixedClock } from '../../src/lib/time';
import type { AlertSettings, SettingsRepository } from '../../src/server/repositories/settings-repository';
import type { SettingsServiceDependencies } from '../../src/server/services/settings-service';
import type { DirectMessage } from '../../src/server/mail/mail-service';

import { createFakeJobRunRepository } from './fake-job-runs';

/**
 * In-memory stand-ins for what `createSettingsService` needs beyond `job_runs` (STORY-09.02), for the tests that run a route, the page or the service without a database or a mail server
 * (the role matrix, the refusal-before-lookup scan, the unit tests). The settings row is a plain object a test can read; the mail is a `sendNow` that records each message and answers
 * what the test chose. `tests/integration/settings/alerts-settings.test.ts` runs the real SQL and the real transport, so these cannot drift without a failing test. Every value is invented.
 */

export interface FakeSettingsRepository extends SettingsRepository {
  current: AlertSettings;
  readonly reads: { count: number };
  readonly writes: AlertSettings[];
}

export function createFakeSettingsRepository(initial: AlertSettings = { alertsEnabled: false, senderName: '', senderAddress: '' }): FakeSettingsRepository {
  const reads = { count: 0 };
  const writes: AlertSettings[] = [];
  const fake: FakeSettingsRepository = {
    current: initial,
    reads,
    writes,
    readAlertSettings() {
      reads.count += 1;
      return Promise.resolve(fake.current);
    },
    updateAlertSettings(settings) {
      writes.push(settings);
      fake.current = settings;
      return Promise.resolve(settings);
    },
  };
  return fake;
}

export interface FakeMail {
  /** What `sendNow` was given, in order. */
  readonly sent: DirectMessage[];
  /** What the next sends answer. Null (the default) behaves like the real transport in the case that matters here: no saved sender address is `NO_SENDER`, otherwise the message is sent. */
  result: SendResult | null;
  sendNow(message: DirectMessage): Promise<SendResult>;
}

export function createFakeMail(settings: SettingsRepository): FakeMail {
  const fake: FakeMail = {
    sent: [],
    result: null,
    async sendNow(message) {
      fake.sent.push(message);
      if (fake.result !== null) return fake.result;
      return (await settings.readAlertSettings()).senderAddress === '' ? failure('NO_SENDER') : { ok: true };
    },
  };
  return fake;
}

export const failure = (code: SendFailureCode): SendResult => ({ ok: false, code });

export interface FakeSettingsWorld extends SettingsServiceDependencies {
  readonly settings: FakeSettingsRepository;
  readonly fakeMail: FakeMail;
}

type Overridable = Partial<Pick<SettingsServiceDependencies, 'jobRuns' | 'outbox' | 'users' | 'emailEnabled' | 'clock'>>;

/** Dependencies for `createSettingsService` with every part in memory; a test overrides the jobs, the users, the feature flag or the clock, and reads the settings row and the mail it sent. */
export function fakeSettingsDependencies(overrides: Overridable = {}): FakeSettingsWorld {
  const settings = createFakeSettingsRepository();
  const fakeMail = createFakeMail(settings);
  return {
    jobRuns: createFakeJobRunRepository(),
    outbox: { failedSince: () => Promise.resolve(null) },
    settings,
    users: { findAccountById: () => Promise.resolve(null) },
    mail: fakeMail,
    fakeMail,
    emailEnabled: () => false,
    clock: createFixedClock(new Date('2026-11-19T10:00:00.000Z')),
    ...overrides,
  };
}
