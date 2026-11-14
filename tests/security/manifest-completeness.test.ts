import { describe, expect, it } from 'vitest';

import { ROUTE_MANIFEST, type RouteRow } from '@/server/http/route-manifest';

import { exportedMethods, findRouteProblems, methodsUsingWithRoute, OWN_PROTECTION, patternOf, readRouteFiles, type RouteFile } from '../support/route-files';

/**
 * STORY-01.02 AC-1 and AC-3 (ARCH-R2): every `route.ts` and `page.tsx` of the source tree has a row in the route
 * manifest, every API handler is declared with `withRoute`, every page that is not public calls `authorizePage` with its
 * own address, and a row and a file agree on whether the route exists. A route file added without a row fails here, so a
 * route outside the manifest cannot reach a build.
 */

const FILES = readRouteFiles();

describe('AC-3: the source tree and the manifest agree', () => {
  it('finds the route files (the scan is not empty)', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(5);
    expect(FILES.map((file) => file.pattern)).toEqual(expect.arrayContaining(['/', '/queue', '/sign-in', '/api/v1/me', '/api/auth/[...nextauth]']));
  });

  it('has no problem: every file has a row, every API handler uses withRoute, every page checks its role', () => {
    expect(findRouteProblems(FILES, ROUTE_MANIFEST)).toEqual([]);
  });

  it('only a public route skips withRoute, and only the two named here (next-auth, and the scan\'s negative control of STORY-01.03)', () => {
    expect(Object.keys(OWN_PROTECTION)).toEqual(['/api/auth/[...nextauth]', '/api/test-only/leak']);
    for (const path of Object.keys(OWN_PROTECTION)) {
      expect(ROUTE_MANIFEST.find((row) => row.path === path)?.roles).toBe('public');
    }
  });

  it('derives a pattern from a file the way Next.js does', () => {
    expect(patternOf('src/app/(portal)/page.tsx')).toBe('/');
    expect(patternOf('src/app/(portal)/estimates/[code]/costs/[slNo]/page.tsx')).toBe('/estimates/[code]/costs/[slNo]');
    expect(patternOf('src/app/api/v1/me/route.ts')).toBe('/api/v1/me');
    expect(patternOf('src/app/api/auth/[...nextauth]/route.ts')).toBe('/api/auth/[...nextauth]');
  });
});

describe('the architecture test can fail (planted faults)', () => {
  const meFile = FILES.find((file) => file.pattern === '/api/v1/me');
  const queueFile = FILES.find((file) => file.pattern === '/queue');
  if (meFile === undefined || queueFile === undefined) throw new Error('the scan did not find /api/v1/me and /queue');

  const plant = (extra: RouteFile) => findRouteProblems([...FILES, extra], ROUTE_MANIFEST);

  it('a new route file with no manifest row fails', () => {
    const problems = plant({ ...meFile, file: 'src/app/api/v1/invented-widgets/route.ts', pattern: '/api/v1/invented-widgets' });
    expect(problems.join('\n')).toContain('no api row for /api/v1/invented-widgets in the route manifest');
  });

  it('a new page file with no manifest row fails', () => {
    const problems = plant({ ...queueFile, file: 'src/app/(portal)/secret/page.tsx', pattern: '/secret' });
    expect(problems.join('\n')).toContain('no page row for /secret in the route manifest');
  });

  it('a handler declared without withRoute fails', () => {
    const bare: RouteFile = { ...meFile, source: "export async function GET() { return Response.json({ ok: true }); }" };
    const problems = findRouteProblems(FILES.map((file) => (file === meFile ? bare : file)), ROUTE_MANIFEST);
    expect(problems).toEqual(['src/app/api/v1/me/route.ts: GET is not declared with withRoute']);
  });

  it('a handler for a method the row does not list fails, and so does a row method with no handler', () => {
    const extra: RouteFile = { ...meFile, source: `${meFile.source}\nexport const POST = withRoute({});` };
    expect(findRouteProblems(FILES.map((file) => (file === meFile ? extra : file)), ROUTE_MANIFEST).join('\n')).toContain('exports POST, which the manifest row does not list');
    const missing: RouteFile = { ...meFile, source: 'export const HEAD = withRoute({});' };
    expect(findRouteProblems(FILES.map((file) => (file === meFile ? missing : file)), ROUTE_MANIFEST).join('\n')).toContain('lists GET, but the file does not export it');
  });

  it('a page that does not call authorizePage with its own address fails', () => {
    for (const source of ['export default function Page() { return null; }', "await authorizePage('/other');"]) {
      const bare: RouteFile = { ...queueFile, source };
      const problems = findRouteProblems(FILES.map((file) => (file === queueFile ? bare : file)), ROUTE_MANIFEST);
      expect(problems).toEqual(["src/app/(portal)/queue/page.tsx: a page that is not public must call authorizePage('/queue')"]);
    }
  });

  it('a row marked implemented with no file fails, and a planned row with a file fails', () => {
    const ghost: RouteRow = { path: '/ghost', kind: 'page', methods: ['GET'], roles: ['ADMIN'], status: 'implemented', stage: 'R1' };
    expect(findRouteProblems(FILES, [...ROUTE_MANIFEST, ghost])).toEqual(['page /ghost: marked implemented, but there is no route file']);
    const demoted = ROUTE_MANIFEST.map((row): RouteRow => (row.path === '/queue' ? { ...row, status: 'planned' } : row));
    expect(findRouteProblems(FILES, demoted).join('\n')).toContain('marked planned, but a route file exists');
  });

  it('a route that skips withRoute while not public fails, even if it is the next-auth path', () => {
    const closed = ROUTE_MANIFEST.map((row): RouteRow => (row.path === '/api/auth/[...nextauth]' ? { ...row, roles: ['ADMIN'] } : row));
    expect(findRouteProblems(FILES, closed).join('\n')).toContain('only a public route can skip withRoute');
  });
});

describe('the readers of a route file', () => {
  it('finds the methods exported in each form', () => {
    expect(exportedMethods('export const GET = a; export async function POST() {}')).toEqual(['GET', 'POST']);
    expect(exportedMethods('async function handle() {}\nexport { handle as GET, handle as POST };')).toEqual(['GET', 'POST']);
    expect(exportedMethods('export const dynamic = "force-dynamic";')).toEqual([]);
  });

  it('knows which methods are declared with withRoute', () => {
    expect(methodsUsingWithRoute('export const GET = withRoute({}); export const POST = other({});')).toEqual(['GET']);
  });
});
