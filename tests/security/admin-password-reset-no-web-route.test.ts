import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ROUTE_MANIFEST } from '@/server/http/route-manifest';

/**
 * STORY-01.10 AC-8 (AQP-428; DL-380 (2)(a); architecture section 8 "Emergency Admin password reset"): **the emergency reset of the Admin's password has no way in from the web.**
 * The two service methods the command calls (`resetAdminPasswordOnServer`, `findAdminForServerReset`) are named in the one file that defines them and in the one that
 * calls them, and in no page, route, component or other service; nothing under `src/app` imports the command's code (`scripts/**`); and the route manifest holds no route
 * for it. A new importer fails this test until it is classed here, which is a decision for the combined review and not for the one who adds it (the AQP-328 rule).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** The only source files that may name the two methods: where they are defined, and the runner of the server command. */
const DEFINITION = 'src/server/services/user-service.ts';
const RUNNER = 'scripts/lib/admin-password-reset-cli.ts';
const MAY_NAME_THE_METHODS: ReadonlyArray<string> = [DEFINITION, RUNNER];
const METHODS = ['resetAdminPasswordOnServer', 'findAdminForServerReset'] as const;

/** Source files, depth first, under a folder of the repository (not the generated client). */
function sourcesUnder(folder: string, found: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, folder))) {
    const path = join(ROOT, folder, name);
    const relativePath = relative(ROOT, path).replaceAll('\\', '/');
    if (relativePath === 'src/generated') continue;
    if (statSync(path).isDirectory()) sourcesUnder(relativePath, found);
    else if (/\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(name)) found.push(relativePath);
  }
  return found;
}

const SOURCES = [...sourcesUnder('src'), ...sourcesUnder('scripts')];
const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

describe('AC-8: no HTTP route for the emergency Admin password reset', () => {
  it.each(METHODS)('%s is named in the user service and in the runner of the command, and nowhere else under src or scripts', (method) => {
    const naming = SOURCES.filter((file) => read(file).includes(method));
    expect([...naming].sort()).toEqual([...MAY_NAME_THE_METHODS].sort());
  });

  it('nothing under src/app, and no route handler anywhere, names either method or imports the command', () => {
    const inApp = SOURCES.filter((file) => file.startsWith('src/app/'));
    expect(inApp.length).toBeGreaterThan(0);
    for (const file of inApp) {
      const source = read(file);
      for (const method of METHODS) expect(source, `${file} names ${method}`).not.toContain(method);
      expect(source, `${file} imports the command`).not.toMatch(/admin-password-reset-cli|scripts\/lib|bootstrap-admin/);
    }
  });

  it('nothing under src imports from scripts: the web code never reaches the command', () => {
    for (const file of SOURCES.filter((entry) => entry.startsWith('src/'))) {
      expect(read(file), file).not.toMatch(/from\s+['"][^'"]*\/scripts\/|from\s+['"]@\/scripts\//);
    }
  });

  it('the runner is wired into the packaged step: bootstrap-admin.ts is the one file that imports it', () => {
    const importers = SOURCES.filter((file) => /from\s+['"][^'"]*admin-password-reset-cli['"]/.test(read(file)));
    expect(importers).toEqual(['scripts/bootstrap-admin.ts']);
  });

  it('the route manifest has no route about resetting the Admin on the server, and only the one reset the Admin already had', () => {
    const paths = ROUTE_MANIFEST.map((row) => row.path);
    expect(paths.filter((path) => /emergency|server-reset|reset-admin|admin-password/i.test(path))).toEqual([]);
    // The web reset of someone else's password (STORY-01.04) and the e-mailed link's routes (STORY-09.07) are the only password-reset routes.
    expect(paths.filter((path) => /password/i.test(path)).sort()).toEqual(
      [
        '/api/v1/account/password',
        '/api/v1/account/password/forgot',
        '/api/v1/account/password/reset',
        '/api/v1/users/[id]/password-reset',
        '/forgot-password',
        '/reset-password',
      ].sort(),
    );
  });
});
