import { FieldValidationError, MailTestFailedError, NO_SENDER_CODE, NotFoundError, ValidationError, type FieldProblem } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { SendFailureCode } from '../../lib/mail/codes';
import { MAIL_FAILURE_WINDOW_DAYS } from '../../lib/mail/failure-window';
import { deriveBackupStatus } from '../../lib/settings/backup-status';
import { senderProblems, trimmedSender, type AlertSettingsInput } from '../../lib/settings/validation';
import { type Clock, MILLISECONDS_PER_DAY } from '../../lib/time';
import { renderMail } from '../mail/layout';
import type { MailService } from '../mail/mail-service';
import type { EmailOutboxRepository } from '../repositories/email-outbox-repository';
import type { JobRunRepository } from '../repositories/job-run-repository';
import type { SettingsRepository } from '../repositories/settings-repository';
import type { UserRepository } from '../repositories/user-repository';

/**
 * The Settings page (SCR-15): the backups and the server disk (STORY-02.09; FR-105, NFR-013) and the e-mail alerts (STORY-09.02; FR-019).
 *
 * Backups. It asks `job_runs` two questions (the newest good backup, the newest free-space reading of either job) and lets `deriveBackupStatus` decide "late", "nearly full" and "stale"
 * against the clock it was given, so a test sets the time. It answers with times as ISO text, the shape the API sends and the page draws. It reads nothing else of a row: no path, volume
 * name or other key a writer put in `result` can reach a caller.
 *
 * E-mail alerts. `getAlertSettings` reads the one `settings` row (the switch, the sender name and address) and says whether this server sends e-mail (`FEATURE_EMAIL`).
 * `updateAlertSettings` checks the three values with the shared rules (every problem at once, one message per field), saves them and writes one info line: who, and the switch, and no
 * address. A change is not an audit event (decision D-i, AQP-349). The row holds no credential of any kind, and none can reach a caller: the answer is built field by field.
 * `sendTestEmail(adminId)` sends one message at once to the address of the person who pressed the button, which it reads from the database by their ID. It takes no address from anywhere
 * else, so no request can name another recipient (architecture section 4.7). It goes through `sendNow` with the saved sender, and a failure is a class code, never the server's words.
 *
 * Failed e-mail (STORY-09.06 AC-8). `getMailFailures` asks the outbox how many rows failed for good in the last 7 days and what the newest one's class code was, and answers that and the time, or null
 * when none did. It reads no address, subject or ID, and the answer is built field by field, so none can reach a caller.
 *
 * Admin only, and the routes and the page that call it are in the manifest for the Admin alone; it is listed as a service an Engineer view may not import
 * (`tests/security/engineer-import-rule.test.ts`).
 */

export interface DiskReadingView {
  /** Whole percent of the disk that is free, rounded down. */
  readonly freePercent: number;
  readonly readAt: string;
  readonly ageSeconds: number;
  readonly stale: boolean;
}

export interface BackupStatusView {
  /** When the newest good backup finished, or null when none has finished yet. */
  readonly lastGoodBackupAt: string | null;
  readonly backupLate: boolean;
  readonly diskReading: DiskReadingView | null;
  readonly diskNearlyFull: boolean;
}

export interface AlertSettingsView {
  readonly alertsEnabled: boolean;
  readonly senderName: string;
  readonly senderAddress: string;
  /** True when `FEATURE_EMAIL=on`: this server sends e-mail. Saving and the test e-mail work either way. */
  readonly emailEnabled: boolean;
}

/** E-mails that could not be sent in the last 7 days: how many, the newest one's class code and when it failed. Never an address, a subject or an ID. */
export interface MailFailuresView {
  readonly count: number;
  readonly lastCode: SendFailureCode;
  readonly lastAt: string;
}

export interface SettingsService {
  getBackupStatus(): Promise<BackupStatusView>;
  /** The e-mails that failed in the last 7 days, or null when none did. */
  getMailFailures(): Promise<MailFailuresView | null>;
  getAlertSettings(): Promise<AlertSettingsView>;
  /** Saves the switch and the sender. Throws a `FieldValidationError` (422) naming each field that is wrong, and saves nothing then. */
  updateAlertSettings(input: AlertSettingsInput, actor: { readonly id: string }): Promise<AlertSettingsView>;
  /** Sends the test e-mail to the Admin's own address, read by ID, and answers that address. Throws a 422 `NO_SENDER` or a 502 whose code is the class of the failure. */
  sendTestEmail(adminId: string): Promise<{ readonly sentTo: string }>;
}

export interface SettingsServiceDependencies {
  readonly jobRuns: JobRunRepository;
  readonly outbox: Pick<EmailOutboxRepository, 'failedSince'>;
  readonly settings: SettingsRepository;
  readonly users: Pick<UserRepository, 'findAccountById'>;
  readonly mail: Pick<MailService, 'sendNow'>;
  /** Whether this server sends e-mail (`FEATURE_EMAIL=on`), asked each time so a test can change it. */
  readonly emailEnabled: () => boolean;
  readonly clock: Clock;
}

const TEST_SUBJECT = 'Accucut Quotation Portal: test e-mail';
const NO_SENDER_MESSAGE = 'Save a sender e-mail address first. The test e-mail is sent from it.';

function testMessage(to: string) {
  const { html, text } = renderMail({
    heading: 'Test e-mail',
    paragraphs: ['This is a test e-mail from the Accucut Quotation Portal.', 'If you can read it, the mail server accepted the sender saved in Settings. You do not need to reply.'],
  });
  return { to, subject: TEST_SUBJECT, bodyHtml: html, bodyText: text };
}

function toFieldProblems(problems: ReturnType<typeof senderProblems>): ReadonlyArray<FieldProblem> {
  return Object.entries(problems).map(([field, message]) => ({ field, message }));
}

/** No sender saved is the Admin's to fix on this page, not a fault of the mail server: a 422 with its own words. Any other class is the mail server's: a 502 with that code. */
function failureOf(code: SendFailureCode): Error {
  if (code === 'NO_SENDER') return new ValidationError(NO_SENDER_MESSAGE, { code: NO_SENDER_CODE });
  return new MailTestFailedError(code);
}

export function createSettingsService({ jobRuns, outbox, settings, users, mail, emailEnabled, clock }: SettingsServiceDependencies): SettingsService {
  async function alertSettings(): Promise<AlertSettingsView> {
    const row = await settings.readAlertSettings();
    return { alertsEnabled: row.alertsEnabled, senderName: row.senderName, senderAddress: row.senderAddress, emailEnabled: emailEnabled() };
  }

  return {
    async getBackupStatus() {
      const [lastGoodBackupAt, diskReading] = await Promise.all([jobRuns.latestGoodBackupAt(), jobRuns.latestDiskReading()]);
      const status = deriveBackupStatus({ lastGoodBackupAt, diskReading }, clock.now());
      return {
        lastGoodBackupAt: status.lastGoodBackupAt === null ? null : status.lastGoodBackupAt.toISOString(),
        backupLate: status.backupLate,
        diskReading:
          status.diskReading === null
            ? null
            : { freePercent: status.diskReading.freePercent, readAt: status.diskReading.readAt.toISOString(), ageSeconds: status.diskReading.ageSeconds, stale: status.diskReading.stale },
        diskNearlyFull: status.diskNearlyFull,
      };
    },

    async getMailFailures() {
      const summary = await outbox.failedSince(new Date(clock.now().getTime() - MAIL_FAILURE_WINDOW_DAYS * MILLISECONDS_PER_DAY));
      return summary === null ? null : { count: summary.count, lastCode: summary.lastCode, lastAt: summary.lastAt.toISOString() };
    },

    getAlertSettings: alertSettings,

    async updateAlertSettings(input, actor) {
      const problems = senderProblems(input);
      if (Object.keys(problems).length > 0) throw new FieldValidationError(toFieldProblems(problems));
      const saved = trimmedSender(input);
      await settings.updateAlertSettings(saved);
      // The one trace of a change (decision D-i): who, and whether the switch is ON, never the name or the address. The time is the log line's own.
      logger.info({ userId: actor.id, alertsEnabled: saved.alertsEnabled }, 'settings changed: e-mail alerts');
      return alertSettings();
    },

    async sendTestEmail(adminId) {
      const admin = await users.findAccountById(adminId);
      if (admin === null) throw new NotFoundError();
      const result = await mail.sendNow(testMessage(admin.email));
      if (result.ok) return { sentTo: admin.email };
      throw failureOf(result.code);
    },
  };
}
