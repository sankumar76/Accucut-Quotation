/**
 * Runs the JS budget check over a running portal and the build it was started from (STORY-10.10 AC-1, AC-2).
 * The entry point `scripts/check-js-budget.ts` starts the server, calls this, and writes the report.
 */
import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

import { z } from 'zod';

import { HIDDEN_IN_PRODUCTION, APP_PATHS_MANIFEST } from './production-routes';
import type { LimitEntry, StaticReader } from './js-budget';
import { checkTargets, type RouteRow } from './js-budget-check';
import { createPageFetcher, type CredentialsProvider } from './js-budget-http';
import { buildTargets, pageRoutesFromAppPaths, type RouteSource } from './js-budget-routes';

const appPathsSchema = z.record(z.string(), z.string());

/** Reads a file under `<buildDir>/.next/static`, and nothing outside it. */
export function staticReader(buildDir: string): StaticReader {
  const root = resolve(buildDir, '.next', 'static');
  return (relativePath) => {
    const file = resolve(join(root, relativePath));
    if (!file.startsWith(root + sep)) return undefined;
    try {
      return readFileSync(file);
    } catch {
      return undefined;
    }
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The routes of the build, from its list of app paths. Throws when the list is missing or is not the shape Next.js writes. */
export function routesOfBuild(buildDir: string): RouteSource {
  let text: string;
  try {
    text = readFileSync(resolve(buildDir, APP_PATHS_MANIFEST), 'utf8');
  } catch {
    throw new Error(`the build has no ${APP_PATHS_MANIFEST} in ${buildDir}: run the production build first`);
  }
  const parsed = appPathsSchema.safeParse(parseJson(text));
  if (!parsed.success) throw new Error(`${APP_PATHS_MANIFEST} is not a list of app paths, so the routes cannot be read`);
  return pageRoutesFromAppPaths(parsed.data);
}

export interface BudgetRunConfig {
  /** The folder that holds `.next`, the production build the server was started from. */
  readonly buildDir: string;
  /** Where the server listens, without a trailing slash. */
  readonly baseUrl: string;
  readonly credentialsFor: CredentialsProvider;
  /** Records made from invented data for dynamic routes. None exists until a screen has a dynamic segment. */
  readonly recordPaths?: Readonly<Record<string, string>>;
  readonly limits?: Readonly<Record<string, LimitEntry>>;
  readonly fetchImpl?: typeof fetch;
  /** Replaces the build's route list: the route manifest, once it exists (STORY-01.02). */
  readonly source?: RouteSource;
}

/** Requests every route and the not-found page, and returns one row each. Rejects only when the build cannot be read. */
export async function runBudgetCheck(config: BudgetRunConfig): Promise<RouteRow[]> {
  const source = config.source ?? routesOfBuild(config.buildDir);
  const hidden = new Set(HIDDEN_IN_PRODUCTION.map((entry) => entry.route));
  const targets = buildTargets(source, config.recordPaths ?? {}, hidden);
  const fetchPage = createPageFetcher({
    baseUrl: config.baseUrl.replace(/\/+$/, ''),
    credentialsFor: config.credentialsFor,
    ...(config.fetchImpl === undefined ? {} : { fetchImpl: config.fetchImpl }),
  });
  return checkTargets(targets, fetchPage, {
    read: staticReader(config.buildDir),
    origin: new URL(config.baseUrl).origin,
    ...(config.limits === undefined ? {} : { limits: config.limits }),
  });
}
