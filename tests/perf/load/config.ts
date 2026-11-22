import { randomBytes } from 'node:crypto';

/**
 * The settings of the load script, read from the environment (test strategy 8.2; STORY-10.09 AC-10). The base address and the sizes have defaults that are the figures of NFR-010 and NFR-011; the
 * invented Admin's e-mail and password have none and come from the same two variables as the other performance scripts (`MEASUREMENT_ADMIN_EMAIL`, `MEASUREMENT_ADMIN_PASSWORD`). The script never
 * prints a password. A message here names a variable, never its value.
 *
 * A smaller run for a laptop is made with the sizes (`LOAD_REQUESTS_PER_LINE`, `LOAD_THINK_MS`, `LOAD_CUSTOMERS`, `LOAD_PARTS` and so on); the figures of such a run are not the NFR figures.
 */

export const PHASES = ['volume', 'mix-low', 'mix-high', 'export', 'password'] as const;
export type Phase = (typeof PHASES)[number];

export interface LoadConfig {
  /** The portal's own origin, with no trailing slash. It must be the origin the portal is configured with (`APP_ORIGIN`): a state-changing call carries it as `Origin`. */
  readonly baseUrl: string;
  readonly adminEmail: string;
  readonly adminPassword: string;
  /** The loads of NFR-010 and NFR-011: 25 virtual users, then 50. */
  readonly usersLow: number;
  readonly usersHigh: number;
  /** Counted requests per user per line (40 gives 1,000 samples at 25 users). */
  readonly requestsPerLine: number;
  readonly thinkMs: number;
  /** The master-data volume of NFR-011: 500 customers, 50 Process Master items in all (35 added), 200 materials, 50 Treatment / Color entries. */
  readonly customers: number;
  readonly processItemsTotal: number;
  readonly materials: number;
  readonly treatments: number;
  /** Tasks in the queue, over and above the two estimates. */
  readonly queueTasks: number;
  /** Parts of each of the two estimates (the first nodes of the `tree500` fixture). */
  readonly parts: number;
  /** The estimates the part saves go to, each of `parts` parts: user n writes estimate n mod this. Saves to one estimate wait for each other (its lock), so 25 people all saving into one estimate is a harsher case than 25 people each at their own work. */
  readonly saveEstimates: number;
  /** At least this many 500-part exports run back to back while the page reads run (AC-4), and they go on until `exportMinSeconds` have passed. */
  readonly exportRuns: number;
  readonly exportMinSeconds: number;
  /** Parts of estimate A that carry a picture of 199 KB (the largest the portal accepts), so the export has what a real one has. */
  readonly exportPictures: number;
  /** Own-password changes in series (AC-2: at least 20), after 2 warm-up changes. */
  readonly passwordRuns: number;
  readonly phases: ReadonlySet<Phase>;
  /** True on the CI runner: the own-password figure is reported against its line and not judged (test strategy 8.2; AC-2). The production host's run judges it. */
  readonly passwordReportOnly: boolean;
  /** Two invented passwords the own-password line alternates between (test strategy 8.2). Made at random when not given. */
  readonly passwordA: string;
  readonly passwordB: string;
}

export class LoadConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoadConfigError';
  }
}

type Env = Readonly<Record<string, string | undefined>>;

const DEFAULT_BASE_URL = 'http://localhost:3000';
const SEED_PROCESS_ITEMS = 15;
const TREE_NODES = 500;
const DEFAULT_EXPORT_PICTURES = 50;

function required(env: Env, name: string): string {
  const value = env[name];
  if (value === undefined || value === '') throw new LoadConfigError(`${name} is not set`);
  return value;
}

function whole(env: Env, name: string, fallback: number, min: number, max: number): number {
  const text = env[name];
  if (text === undefined || text === '') return fallback;
  const value = Number(text);
  if (!Number.isInteger(value) || value < min || value > max) throw new LoadConfigError(`${name} must be a whole number from ${min} to ${max}`);
  return value;
}

function baseUrlOf(env: Env): string {
  const text = (env['LOAD_BASE_URL'] ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new LoadConfigError('LOAD_BASE_URL is not a web address');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new LoadConfigError('LOAD_BASE_URL must start with http:// or https://');
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') throw new LoadConfigError('LOAD_BASE_URL must be the origin only, with no path');
  return url.origin;
}

function phasesOf(env: Env): ReadonlySet<Phase> {
  const text = env['LOAD_PHASES'];
  if (text === undefined || text === '') return new Set(PHASES);
  const chosen = new Set<Phase>();
  for (const name of text.split(',').map((part) => part.trim())) {
    const phase = PHASES.find((candidate) => candidate === name);
    if (phase === undefined) throw new LoadConfigError(`LOAD_PHASES names "${name}", which is not one of ${PHASES.join(', ')}`);
    chosen.add(phase);
  }
  return chosen;
}

/** An invented password that passes the portal's rule (10 or more characters, a number and a symbol, not an e-mail address, not a common one). Never printed. */
export function inventedPassword(): string {
  return `Ld-${randomBytes(12).toString('hex')}-9!`;
}

export function readConfig(env: Env): LoadConfig {
  const passwordA = env['LOAD_PASSWORD_A'] === undefined || env['LOAD_PASSWORD_A'] === '' ? inventedPassword() : env['LOAD_PASSWORD_A'];
  const passwordB = env['LOAD_PASSWORD_B'] === undefined || env['LOAD_PASSWORD_B'] === '' ? inventedPassword() : env['LOAD_PASSWORD_B'];
  if (passwordA === passwordB) throw new LoadConfigError('LOAD_PASSWORD_A and LOAD_PASSWORD_B must differ');
  const parts = whole(env, 'LOAD_PARTS', TREE_NODES, 2, TREE_NODES);
  const config = {
    baseUrl: baseUrlOf(env),
    adminEmail: required(env, 'MEASUREMENT_ADMIN_EMAIL'),
    adminPassword: required(env, 'MEASUREMENT_ADMIN_PASSWORD'),
    usersLow: whole(env, 'LOAD_USERS_LOW', 25, 1, 200),
    usersHigh: whole(env, 'LOAD_USERS_HIGH', 50, 1, 200),
    requestsPerLine: whole(env, 'LOAD_REQUESTS_PER_LINE', 40, 1, 1_000),
    thinkMs: whole(env, 'LOAD_THINK_MS', 1_000, 0, 60_000),
    customers: whole(env, 'LOAD_CUSTOMERS', 500, 1, 5_000),
    processItemsTotal: whole(env, 'LOAD_PROCESS_ITEMS', 50, SEED_PROCESS_ITEMS, 200),
    materials: whole(env, 'LOAD_MATERIALS', 200, 1, 5_000),
    treatments: whole(env, 'LOAD_TREATMENTS', 50, 0, 1_000),
    queueTasks: whole(env, 'LOAD_QUEUE_TASKS', 300, 1, 100_000),
    parts,
    saveEstimates: whole(env, 'LOAD_SAVE_ESTIMATES', 5, 1, 50),
    exportRuns: whole(env, 'LOAD_EXPORT_RUNS', 2, 1, 20),
    exportMinSeconds: whole(env, 'LOAD_EXPORT_MIN_SECONDS', 30, 0, 600),
    exportPictures: whole(env, 'LOAD_EXPORT_PICTURES', Math.min(DEFAULT_EXPORT_PICTURES, parts), 0, TREE_NODES),
    passwordRuns: whole(env, 'LOAD_PASSWORD_RUNS', 20, 1, 200),
    phases: phasesOf(env),
    passwordReportOnly: env['LOAD_PASSWORD_REPORT_ONLY'] === '1',
    passwordA,
    passwordB,
  };
  // Each virtual user saves into a part of its own, so two users never write the same part (a 409 would be a fault of the script, not a reading).
  if (config.parts * config.saveEstimates < Math.max(config.usersLow, config.usersHigh)) {
    throw new LoadConfigError('LOAD_PARTS times LOAD_SAVE_ESTIMATES must be at least as many as the virtual users');
  }
  if (config.exportPictures > config.parts) throw new LoadConfigError('LOAD_EXPORT_PICTURES must not be more than LOAD_PARTS');
  return config;
}
