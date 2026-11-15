import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

import ts from 'typescript';

/**
 * The static check behind the overlay rule of architecture section 10 (AQP-188, ADR-016): an overlay opened by a user action (Sheet, Dialog, AlertDialog, DropdownMenu, Popover) is not
 * in a route's first load. The trigger is a plain button, and the overlay's module is fetched by `import()` on the first press. Until now only the bundle-size check (CI stage 11b) noticed a
 * breach, long after the code was written: it was how `parts-tree-area.tsx` carried Radix Dialog into every width of the estimate page.
 *
 * A module "holds an overlay" when it imports one of the shadcn overlay modules with a plain `import`. A module is "lazy" when some component fetches it with `import()` (the drawers, dialogs,
 * panels and in-page parts that architecture section 10 lists, and any added later). The rule: no holder and no lazy module is reachable from a route (`src/app`) through plain imports alone.
 * `import type` and `import()` break the chain. So a lazy panel that holds its own dialogs statically (masters, users) is fine, because the route reaches the panel only through `import()`.
 *
 * The analysis is a pure function of `{ path: source }`, so a test can show it fail on a planted source as well as pass on the real tree. Paths are posix and start with `src/`.
 */

/** The shadcn modules that bring in Radix Dialog, Dropdown Menu or Popover (`@/components/ui/<name>`). */
export const OVERLAY_UI_MODULES: ReadonlyArray<string> = ['sheet', 'dialog', 'alert-dialog', 'dropdown-menu', 'popover'];

export interface ModuleReference {
  readonly specifier: string;
  readonly line: number;
}

export type BreachReason = 'holds-an-overlay' | 'is-loaded-lazily';

export interface OverlayBreach {
  /** The module that must stay out of the first load. */
  readonly module: string;
  readonly reason: BreachReason;
  /** The module in the first load that imports it with a plain `import`. */
  readonly importer: string;
  readonly line: number;
  /** The file under `src/app` the importer is reached from. */
  readonly root: string;
}

const EXTENSIONS = ['.ts', '.tsx'] as const;

/** A source is parsed once however many of the walks below ask for it: the whole of `src` is a few seconds to parse, and the walks run in one test file. */
const parsed = new Map<string, ts.SourceFile>();

function parse(path: string, source: string): ts.SourceFile {
  const key = `${path}\0${source}`;
  const known = parsed.get(key);
  if (known !== undefined) return known;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  parsed.set(key, file);
  return file;
}

/** Every plain (value) static import or re-export of a source. `import type`, `export type` and `import()` are left out: they put nothing in the bundle. */
export function staticImportsOf(path: string, source: string): ReadonlyArray<ModuleReference> {
  const file = parse(path, source);
  const found: ModuleReference[] = [];
  const add = (specifier: ts.Expression | undefined, at: ts.Node): void => {
    if (specifier === undefined || !ts.isStringLiteral(specifier)) return;
    found.push({ specifier: specifier.text, line: file.getLineAndCharacterOfPosition(at.getStart(file)).line + 1 });
  };
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly !== true) add(statement.moduleSpecifier, statement);
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) add(statement.moduleSpecifier, statement);
  }
  return found;
}

/** Every `import('...')` with a literal specifier in a source, at any depth. */
export function dynamicImportsOf(path: string, source: string): ReadonlyArray<ModuleReference> {
  const file = parse(path, source);
  const found: ModuleReference[] = [];
  const visit = (node: ts.Node): void => {
    const [argument] = ts.isCallExpression(node) ? node.arguments : [];
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && argument !== undefined && ts.isStringLiteral(argument)) {
      found.push({ specifier: argument.text, line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** The path of the source a specifier names, or null for a package or a file that is not in `known`. Understands `@/` (src) and relative specifiers. */
export function resolveSpecifier(from: string, specifier: string, known: ReadonlySet<string>): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = posix.join('src', specifier.slice(2));
  else if (specifier.startsWith('.')) base = posix.join(posix.dirname(from), specifier);
  else return null;
  for (const candidate of [...EXTENSIONS.map((extension) => `${base}${extension}`), ...EXTENSIONS.map((extension) => posix.join(base, `index${extension}`))]) {
    if (known.has(candidate)) return candidate;
  }
  return null;
}

type Sources = Readonly<Record<string, string>>;

/** The modules of `src/components` (not the shadcn layer itself) that import an overlay module of the shadcn layer with a plain `import`. */
export function overlayHolders(sources: Sources): ReadonlyArray<string> {
  const overlayModules = new Set(OVERLAY_UI_MODULES.map((name) => `src/components/ui/${name}.tsx`));
  const known = new Set(Object.keys(sources));
  return Object.keys(sources)
    .filter((path) => path.startsWith('src/components/') && !path.startsWith('src/components/ui/'))
    .filter((path) =>
      staticImportsOf(path, sources[path] ?? '').some((item) => {
        const target = resolveSpecifier(path, item.specifier, known);
        return target !== null && overlayModules.has(target);
      }),
    );
}

/** The modules that a component fetches with `import()`: what the first load must leave alone (`src/components` only: a page's own server-side `import()` is not a lazy component). */
export function lazyModules(sources: Sources): ReadonlyArray<string> {
  const known = new Set(Object.keys(sources));
  const lazy = new Set<string>();
  for (const path of Object.keys(sources).filter((candidate) => candidate.startsWith('src/components/'))) {
    for (const item of dynamicImportsOf(path, sources[path] ?? '')) {
      const target = resolveSpecifier(path, item.specifier, known);
      if (target !== null) lazy.add(target);
    }
  }
  return [...lazy].sort();
}

/** Walks plain imports from every file under `src/app`, calling `onEdge` for each plain import found, once per importing file. Returns the files reached, each with the route file it was reached from. */
function walkFirstLoad(sources: Sources, onEdge: (edge: { readonly importer: string; readonly target: string; readonly line: number; readonly root: string }) => void): ReadonlyMap<string, string> {
  const known = new Set(Object.keys(sources));
  const roots = Object.keys(sources)
    .filter((path) => path.startsWith('src/app/'))
    .sort();
  const reachedFrom = new Map<string, string>(roots.map((root) => [root, root]));
  const queue = [...roots];
  for (let at = 0; at < queue.length; at += 1) {
    const path = queue[at] ?? '';
    const root = reachedFrom.get(path) ?? path;
    for (const item of staticImportsOf(path, sources[path] ?? '')) {
      const target = resolveSpecifier(path, item.specifier, known);
      if (target === null) continue;
      onEdge({ importer: path, target, line: item.line, root });
      if (!reachedFrom.has(target)) {
        reachedFrom.set(target, root);
        queue.push(target);
      }
    }
  }
  return reachedFrom;
}

/** Every module of `src` that the first load of some route carries: reached from a file under `src/app` by plain imports alone. */
export function firstLoadModules(sources: Sources): ReadonlySet<string> {
  return new Set(walkFirstLoad(sources, () => undefined).keys());
}

/**
 * The holders and lazy modules that the first load of some route reaches through plain imports alone, found by walking from every file under `src/app` (the routes, their layouts and
 * their pages). A module behind an `import()` is not reached, and a module only ever fetched lazily is never walked into. Each breach names the importing file and line, and the route file
 * it was reached from.
 */
export function overlayBreaches(sources: Sources): ReadonlyArray<OverlayBreach> {
  const reasons = new Map<string, BreachReason>(lazyModules(sources).map((path) => [path, 'is-loaded-lazily']));
  for (const holder of overlayHolders(sources)) reasons.set(holder, 'holds-an-overlay');
  const breaches: OverlayBreach[] = [];
  walkFirstLoad(sources, ({ importer, target, line, root }) => {
    const reason = reasons.get(target);
    if (reason !== undefined) breaches.push({ module: target, reason, importer, line, root });
  });
  return breaches;
}

/** The words of one breach for a failed test: the file and line to change, and what to do. */
export function describeBreach(breach: OverlayBreach): string {
  const what = breach.reason === 'holds-an-overlay' ? 'holds an overlay' : 'is fetched with import() elsewhere';
  return `${breach.importer}:${breach.line} imports ${breach.module} with a plain import, but it ${what}, and ${breach.importer} is in the first load of ${breach.root}. Fetch it on first open or after mount (useFirstOpen or useLazyComponent, with import()), or use import type`;
}

/** Reads every .ts and .tsx file under `root/src` into a `{ posix path: source }` map. */
export function readSources(root: string): Record<string, string> {
  const sources: Record<string, string> = {};
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) sources[relative(root, full).split(sep).join('/')] = readFileSync(full, 'utf8');
    }
  };
  walk(join(root, 'src'));
  return sources;
}
