import type { HttpMethod } from '../../src/server/http/route-manifest';

import { HARNESS_PASSWORD } from './harness-password';
import type { ValidCall } from './route-calls';

/**
 * The valid calls of the checkpoint and revert routes (STORY-08.06 AC-9), kept apart because `route-calls.ts` is at its line limit. Each is the call that **stores nothing and answers the same at every state of the
 * harness and of a real database**, for the one role that may make it:
 *   - `GET /config/checkpoints` is a read, 200;
 *   - `POST /config/checkpoints` with an empty name is refused 422 "Enter a name for this checkpoint." by content before anything is stored, so the call repeats as often as the scan needs;
 *   - `POST /config/versions/{id}/revert` names the first version with a base that is not the latest: 409 `CONFIG_VERSION_CHANGED` before any password is asked for or any version stored.
 * A save that really writes, the password step and the other refusals are `config-checkpoint-routes.test.ts`'s and `tests/integration/config/checkpoints-revert.test.ts`'s. The answers name checkpoints and
 * versions: Admin only, and the scan reads the refusals.
 */

/** The ID of the first configuration version of the harness's in-memory world (`fake-config.ts`'s `FAKE_CONFIG_VERSION_ID`, written out because the Playwright process lists these recipes and cannot load the registry). */
const FIRST_VERSION_ID = '00000000-0000-4000-8000-0ccc0000f001';
const STALE_BASE = 9_999;

export function checkpointCall(method: HttpMethod, path: string): ValidCall | undefined {
  switch (`${method} ${path}`) {
    case 'GET /api/v1/config/checkpoints':
      return { id: FIRST_VERSION_ID, status: 200 };
    case 'POST /api/v1/config/checkpoints':
      return { id: FIRST_VERSION_ID, body: { name: '' }, status: 422 };
    case 'POST /api/v1/config/versions/[id]/revert':
      return { id: FIRST_VERSION_ID, body: { password: HARNESS_PASSWORD, baseVersion: STALE_BASE }, status: 409 };
    default:
      return undefined;
  }
}
