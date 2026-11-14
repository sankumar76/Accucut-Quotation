import { createFakeMasterRepository, type FakeMasterRepository } from './fake-masters';
import { MATERIAL_CANARIES } from './material-master-canary';
import { seedConfig } from './seed-config';

import type { EstimateDependencies } from '../../src/server/services/estimate-service';

/**
 * What `createEstimateService` needs besides the estimate and its parts (STORY-05.03): the Material Master, to check a part's material, and the field registry, which
 * the form is built from. Both are in memory here: the seed registry (the same module production seeds from) and the invented canary materials, whose names an Engineer
 * may be sent and whose numbers are never read. Every name and ID is invented.
 */
export type InputsDependencies = Pick<EstimateDependencies, 'materials' | 'currentConfiguration'>;

export function inputsDependencies(masters: FakeMasterRepository = createFakeMasterRepository(undefined, MATERIAL_CANARIES)): InputsDependencies {
  return { materials: masters, currentConfiguration: () => Promise.resolve(seedConfig) };
}
