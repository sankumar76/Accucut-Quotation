import { z } from 'zod';

/**
 * The contract of `GET` and `PUT /api/v1/settings` and of `POST /api/v1/settings/test-email` (STORY-02.09 AC-1 to AC-5, STORY-09.02 AC-2 to AC-4; architecture section 6, "Settings"). The
 * answer is a strict object, so a key the schema does not name cannot leave (NFR-002): the last good backup time, whether it is late, the newest free-space reading (a whole
 * percentage, when it was read and how old it is), whether the disk is nearly full, and the e-mail alerts: the switch, the sender name and address, and whether this server sends
 * e-mail at all (`FEATURE_EMAIL=on`). No file path, volume name, mail server setting or credential is in it, and nothing here is a cost or a rate.
 */

const diskReadingSchema = z.strictObject({
  freePercent: z.number().int().min(0).max(100),
  readAt: z.iso.datetime(),
  ageSeconds: z.number().int().min(0),
  stale: z.boolean(),
});

/** The e-mail alerts as saved, and whether this server sends e-mail (a setting of the server, not of the Admin). */
const alertSettingsShape = {
  alertsEnabled: z.boolean(),
  senderName: z.string(),
  senderAddress: z.string(),
  emailEnabled: z.boolean(),
};

export const alertSettingsSchema = z.strictObject(alertSettingsShape);

export const settingsSchema = z.strictObject({
  lastGoodBackupAt: z.iso.datetime().nullable(),
  backupLate: z.boolean(),
  diskReading: diskReadingSchema.nullable(),
  diskNearlyFull: z.boolean(),
  ...alertSettingsShape,
});

export type SettingsResponse = z.infer<typeof settingsSchema>;

/**
 * The body of `PUT /api/v1/settings`: the three values and nothing else (strict). The shape is checked here (422 for a body that is not of this shape); the rules
 * of a name and an address are the service's, which answers one message per field, all at once (`src/lib/settings/validation.ts`).
 */
export const alertSettingsBodySchema = z.strictObject({
  alertsEnabled: z.boolean(),
  senderName: z.string(),
  senderAddress: z.string(),
});

/** `POST /api/v1/settings/test-email` answers with the address it was sent to: the signed-in Admin's own. The route takes no body. */
export const testEmailSchema = z.strictObject({ sentTo: z.string() });

export type TestEmailResponse = z.infer<typeof testEmailSchema>;
