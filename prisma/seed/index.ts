/**
 * Seed entry point (`prisma db seed`). Loads invented placeholders only, and refuses to run in
 * production. There is no path from this folder to real data (ADR-014).
 */
import { assertSeedAllowed } from './guard';

assertSeedAllowed(process.env);

// No table exists yet; the stories that add the masters load `placeholderMasters` here.
process.stdout.write('Seed: nothing to load yet.\n');
