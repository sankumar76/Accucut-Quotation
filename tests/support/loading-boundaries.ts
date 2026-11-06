import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { allowsRole, type RouteRow } from '../../src/server/http/route-manifest';
import type { RoleName } from '../../src/lib/auth/roles';

import type { RouteFile } from './route-files';

/**
 * QLT-72 (STORY-01.04, found by the production-build test TD-06): a `loading.tsx` wraps the page below it in a Suspense
 * boundary, so the server starts to stream the response with status 200 before the page runs. A page that refuses a role
 * with `forbidden()` then answers the "no access" page with HTTP 200, not 403 (CR-33). So no `loading.tsx` may sit at or above
 * a page that can refuse a role. `findLoadingProblems` is a function of the loading files, the page files and a manifest, so a
 * test can plant a file and require a problem (the guard must itself be able to fail).
 */

const ROLES: ReadonlyArray<RoleName> = ['ADMIN', 'LEAD', 'ENGINEER'];

/** Every `loading.tsx` under `src/app`, as a path relative to the repository with forward slashes. */
export function readLoadingFiles(root = 'src/app'): string[] {
  const walk = (directory: string): string[] =>
    readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  return walk(root)
    .filter((path) => path.split(sep).at(-1) === 'loading.tsx')
    .map((path) => relative('.', path).split(sep).join('/'));
}

/** Can the page's row refuse some role? A public page, or one open to every role, cannot. */
function canRefuse(row: RouteRow): boolean {
  return row.roles !== 'public' && ROLES.some((role) => !allowsRole(row, role));
}

export function findLoadingProblems(loadingFiles: ReadonlyArray<string>, pages: ReadonlyArray<RouteFile>, manifest: ReadonlyArray<RouteRow>): string[] {
  return loadingFiles.flatMap((loading) => {
    const directory = loading.slice(0, loading.lastIndexOf('/') + 1);
    return pages
      .filter((page) => page.kind === 'page' && page.file.startsWith(directory))
      .filter((page) => manifest.some((row) => row.kind === 'page' && row.path === page.pattern && canRefuse(row)))
      .map((page) => `${loading}: sits above ${page.file}, which can refuse a role; the response would be streamed with status 200 before forbidden() runs`);
  });
}
