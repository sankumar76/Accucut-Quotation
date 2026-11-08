import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import type { RouteRow } from '../../src/server/http/route-manifest';

/**
 * Reads the route files of `src/app` and says what is wrong with them against the manifest (STORY-01.02 AC-1 and AC-3).
 * The rules live in `findRouteProblems`, a function of a list of files and a manifest, so a test can hand it a planted
 * extra file and require a problem (the architecture test must itself be able to fail).
 */

export interface RouteFile {
  /** Relative to the repository, with forward slashes. */
  readonly file: string;
  readonly kind: 'page' | 'api';
  /** The Next.js route pattern: `/queue`, `/api/v1/me`. */
  readonly pattern: string;
  readonly source: string;
}

const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
const ROUTE_GROUP = /^\(.+\)$/;

/**
 * A route that does not go through `withRoute`, and why. Only a public route can be listed: next-auth answers its own
 * sign-in and sign-out and protects them with its own CSRF token (architecture sections 6 and 8).
 */
export const OWN_PROTECTION: Readonly<Record<string, string>> = {
  '/api/auth/[...nextauth]': 'next-auth: its own CSRF token and its own refusals',
  // STORY-01.03 AC-4: no session, no input, no data of its own: it returns an invented sentinel under NODE_ENV=test and 404 elsewhere.
  '/api/test-only/leak': 'negative control of the confidentiality scan: public, test-only, one invented sentinel (src/lib/negative-control-gate.ts)',
};

export function patternOf(file: string): string {
  const segments = file.split('/').slice(2, -1).filter((segment) => !ROUTE_GROUP.test(segment));
  return `/${segments.join('/')}`;
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Every `route.ts` and `page.tsx` under `src/app`. */
export function readRouteFiles(root = 'src/app'): RouteFile[] {
  return walk(root)
    .map((path) => relative('.', path).split(sep).join('/'))
    .flatMap((file): RouteFile[] => {
      const name = file.split('/').at(-1);
      if (name !== 'route.ts' && name !== 'page.tsx') return [];
      return [{ file, kind: name === 'route.ts' ? 'api' : 'page', pattern: patternOf(file), source: readFileSync(file, 'utf8') }];
    });
}

/** The HTTP methods a route file exports, by `export const GET`, `export async function GET` or `export { x as GET }`. */
export function exportedMethods(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:const|function)\s+([A-Z]+)\b/g)) found.add(match[1] ?? '');
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? '').split(',')) {
      const name = part.split(/\s+as\s+/).at(-1)?.trim() ?? '';
      found.add(name);
    }
  }
  return HTTP_METHODS.filter((method) => found.has(method));
}

/** The methods declared as `export const NAME = withRoute(`. */
export function methodsUsingWithRoute(source: string): string[] {
  return HTTP_METHODS.filter((method) => new RegExp(`export\\s+const\\s+${method}\\s*=\\s*withRoute\\s*\\(`).test(source));
}

function rowsFor(manifest: ReadonlyArray<RouteRow>, file: RouteFile): ReadonlyArray<RouteRow> {
  return manifest.filter((row) => row.path === file.pattern && row.kind === file.kind);
}

export function findRouteProblems(files: ReadonlyArray<RouteFile>, manifest: ReadonlyArray<RouteRow>): string[] {
  const problems: string[] = [];

  for (const file of files) {
    const rows = rowsFor(manifest, file);
    if (rows.length === 0) {
      problems.push(`${file.file}: no ${file.kind} row for ${file.pattern} in the route manifest`);
      continue;
    }
    const roles = rows.map((row) => row.roles);
    if (rows.some((row) => row.status !== 'implemented')) problems.push(`${file.file}: its row is not marked implemented, but the file exists`);
    if (file.kind === 'api') problems.push(...apiProblems(file, rows, roles));
    else problems.push(...pageProblems(file, roles));
  }

  for (const row of manifest) {
    const present = files.some((file) => file.pattern === row.path && file.kind === row.kind);
    if (row.status === 'implemented' && !present) problems.push(`${row.kind} ${row.path}: marked implemented, but there is no route file`);
    if (row.status === 'planned' && present) problems.push(`${row.kind} ${row.path}: marked planned, but a route file exists`);
  }
  return problems;
}

function apiProblems(file: RouteFile, rows: ReadonlyArray<RouteRow>, roles: ReadonlyArray<RouteRow['roles']>): string[] {
  const problems: string[] = [];
  const exported = exportedMethods(file.source);
  const declared = rows.flatMap((row) => row.methods).filter((method) => method !== 'HEAD');
  for (const method of exported) if (!declared.some((candidate) => candidate === method)) problems.push(`${file.file}: exports ${method}, which the manifest row does not list`);
  for (const method of declared) if (!exported.includes(method)) problems.push(`${file.file}: the manifest lists ${method}, but the file does not export it`);

  const exempt = Object.hasOwn(OWN_PROTECTION, file.pattern);
  if (exempt && !roles.every((role) => role === 'public')) problems.push(`${file.file}: only a public route can skip withRoute`);
  if (!exempt) {
    const guarded = methodsUsingWithRoute(file.source);
    for (const method of exported) if (!guarded.includes(method)) problems.push(`${file.file}: ${method} is not declared with withRoute`);
  }
  return problems;
}

function pageProblems(file: RouteFile, roles: ReadonlyArray<RouteRow['roles']>): string[] {
  if (roles.every((role) => role === 'public')) return [];
  const call = `authorizePage('${file.pattern}')`;
  return file.source.includes(call) ? [] : [`${file.file}: a page that is not public must call ${call}`];
}
