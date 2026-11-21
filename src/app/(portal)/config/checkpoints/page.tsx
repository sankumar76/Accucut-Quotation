import { CheckpointsScreen } from '@/components/features/config/checkpoints-screen';
import { CHECKPOINTS_META_DESCRIPTION, CHECKPOINTS_TITLE } from '@/components/features/config/checkpoints-texts';
import { authorizePage } from '@/server/http/page-access';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata(CHECKPOINTS_TITLE, CHECKPOINTS_META_DESCRIPTION);

/**
 * SCR-21 "Checkpoints and versions" (STORY-08.06 AC-3, AC-9, AC-10): the Admin saves a named checkpoint of the configuration, lists them and reverts to one with their password. The page checks the role first, with its
 * own address, before it reads anything: a Lead and an Engineer get SCR-26 "no access" with HTTP 403 and no page data (`authorizePage`, CR-33), a signed-out visitor is sent to the sign-in page. A checkpoint is a name
 * and a version number, and a revert reads whole snapshots, so the page reads none of it: the screen asks `GET /api/v1/config/checkpoints` and `GET /api/v1/config/current` after it has opened.
 *
 * There is deliberately no `loading.tsx` beside this page, for the reason given on the Users page: it would turn the 403 of a refused role into a streamed 200 (QLT-72,
 * `tests/security/loading-boundaries.test.ts`). The Loading state of SCR-21 is the screen's own skeleton while it asks the routes.
 */
export default async function CheckpointsPage() {
  await authorizePage('/config/checkpoints');
  return <CheckpointsScreen />;
}
