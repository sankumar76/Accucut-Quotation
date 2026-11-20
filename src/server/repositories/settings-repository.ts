import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';

/**
 * The one row of `settings` for the Settings page (STORY-09.02; architecture sections 5.1 and 6). The table holds the alerts switch, the sender name and the sender mailbox, and nothing
 * else: never a credential of any kind (the mail server's password or secret is in the server's environment, architecture section 4.7). The runtime role may SELECT and UPDATE the row
 * and nothing more (STORY-09.01), so there is no insert and no delete here, and the one UPDATE matches `id = 1`.
 *
 * `sender_mailbox` is the column's name (09.01); the page and the API call the same value "sender address".
 */

export interface AlertSettings {
  readonly alertsEnabled: boolean;
  readonly senderName: string;
  readonly senderAddress: string;
}

export interface SettingsRepository {
  /** The row. If it is somehow absent (the migration seeds it), alerts are off and the sender is empty. */
  readAlertSettings(): Promise<AlertSettings>;
  /** Saves the three values and returns the row as it is now, in one statement. */
  updateAlertSettings(settings: AlertSettings): Promise<AlertSettings>;
}

const ABSENT: AlertSettings = { alertsEnabled: false, senderName: '', senderAddress: '' };

const rowSchema = z.object({ alerts_enabled: z.boolean(), sender_name: z.string(), sender_mailbox: z.string() });

function toSettings(row: z.infer<typeof rowSchema> | undefined): AlertSettings {
  return row === undefined ? ABSENT : { alertsEnabled: row.alerts_enabled, senderName: row.sender_name, senderAddress: row.sender_mailbox };
}

export function createSettingsRepository(db: PrismaClient): SettingsRepository {
  return {
    readAlertSettings: () =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`SELECT alerts_enabled, sender_name, sender_mailbox FROM settings WHERE id = 1`;
        return toSettings(z.array(rowSchema).parse(rows)[0]);
      }),

    updateAlertSettings: (settings) =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`
          UPDATE settings
          SET alerts_enabled = ${settings.alertsEnabled}, sender_name = ${settings.senderName}, sender_mailbox = ${settings.senderAddress}, updated_at = now()
          WHERE id = 1
          RETURNING alerts_enabled, sender_name, sender_mailbox`;
        const row = z.array(rowSchema).parse(rows)[0];
        // The migration seeds the row and nothing deletes it. If it is gone, say so: a save must never answer "saved" for a change that was not made.
        if (row === undefined) throw new Error('The settings row is missing.');
        return toSettings(row);
      }),
  };
}
