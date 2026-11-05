import { z } from 'zod';

import { NAV_GROUP_ORDER } from '../../http/route-manifest';

/**
 * The answer of `GET /api/v1/me` (STORY-01.02 AC-7, architecture section 6): the signed-in person, the menu their role
 * may use and the count of overdue tasks. Strict: a key that is not named here is an error, so a field added to the user
 * cannot reach a client by being spread. There is no cost, rate or formula field in it for any role (BR-003, NFR-002).
 */

const NAV_GROUPS = z.enum(NAV_GROUP_ORDER);

export const meNavigationItemSchema = z.strictObject({
  group: NAV_GROUPS,
  label: z.string().min(1),
  href: z.string().startsWith('/'),
});

export const meResponseSchema = z.strictObject({
  name: z.string().min(1),
  email: z.string().min(1),
  role: z.enum(['ADMIN', 'LEAD', 'ENGINEER']),
  navigation: z.array(meNavigationItemSchema),
  /** Zero until the overdue count exists (STORY-04.03). */
  overdueCount: z.number().int().nonnegative(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
