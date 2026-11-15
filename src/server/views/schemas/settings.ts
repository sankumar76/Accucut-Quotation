import { z } from 'zod';

/**
 * The contract of `GET /api/v1/settings` (STORY-02.09 AC-1 to AC-5; architecture section 6, "Settings"). The answer is a strict object, so a key the schema does not name cannot leave
 * (NFR-002): the last good backup time, whether it is late, the newest free-space reading (a whole percentage, when it was read and how old it is) and whether the disk is nearly
 * full. No file path, volume name or other key of a `job_runs` result is in it, and nothing here is a cost or a rate. The route has GET only: the alert switch and the sender
 * (`PUT /settings`, FR-019) are story 09.02.
 */

const diskReadingSchema = z.strictObject({
  freePercent: z.number().int().min(0).max(100),
  readAt: z.iso.datetime(),
  ageSeconds: z.number().int().min(0),
  stale: z.boolean(),
});

export const settingsSchema = z.strictObject({
  lastGoodBackupAt: z.iso.datetime().nullable(),
  backupLate: z.boolean(),
  diskReading: diskReadingSchema.nullable(),
  diskNearlyFull: z.boolean(),
});

export type SettingsResponse = z.infer<typeof settingsSchema>;
