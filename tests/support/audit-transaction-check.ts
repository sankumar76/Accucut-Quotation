import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';

/**
 * The check behind `tests/unit/audit-transaction-architecture.test.ts` (STORY-10.18, GitHub #104; architecture section 6, "An audit
 * entry commits with its change, or not at all"). It reads the services with the TypeScript type checker and refuses every
 * `.record(` call that does not run in the transaction of the change it records.
 *
 * The rule, as the solution-architect fixed it ("The two checks as built", AQP-237 comment 11263):
 *  - (a) The function F that holds the call has the call's `tx` argument as one of its own parameters P, and either F is a `.run(`
 *    callback (a function passed to `r.run(...)` where the checker types `r` as `TransactionRunner`), or every call to F in the same
 *    file passes, in P's position, a parameter of a function that qualifies in the same way. The chain from F up to the callback
 *    follows at most `MAX_HELPER_STEPS` calls, and a function that is already on the chain is a cycle and fails.
 *  - (b) On that chain there is "another repository call": a call `x.m(...)` or `x['m'](...)` other than `record`, where the checker
 *    types `x` with a type declared under `src/server/repositories/` (not `transaction.ts`, not `audit-repository.ts`) and one
 *    argument is the transaction parameter of that step. Any method counts (a lock, a read or a write).
 *
 * A step is one call followed: F called by G is one step, G called by the callback another. The callback itself is not a step, so
 * a helper three calls below the callback passes and one four calls below fails.
 *
 * What it cannot see, so a pass is never read as more than it proves:
 *  - a chain longer than `MAX_HELPER_STEPS`, or a helper whose callers are in another file (only the calls in the same file are
 *    followed, so an exported helper that another file calls with any handle is not seen);
 *  - a `.run(` callback the checker does not type as `TransactionRunner` (a runner held in an `any`, or a class that only
 *    implements the interface), or one given by name (`r.run(work)`): both fail here, they are not accepted;
 *  - that a write or an order is required: a lock or a read on the transaction satisfies (b), and the entry may come before the
 *    change inside the same callback. The late-failure runner of tests/support (#130) is what forces a failure at that point;
 *  - a closure inside the callback that is kept and run after the callback returned (it is inside F, so it is accepted);
 *  - a `record` called through a destructured name (`const { record } = audit`), which is not a `.record(` call.
 */

/** Calls followed from the function that holds `record` up to the `.run(` callback. */
export const MAX_HELPER_STEPS = 3;

/** Types whose declarations here are not "another repository": the handle's own file, and the audit repository the entry goes to. */
const NOT_ANOTHER_REPOSITORY = new Set(['transaction.ts', 'audit-repository.ts']);
const REPOSITORIES = 'src/server/repositories/';
const TRANSACTION_RUNNER = 'TransactionRunner';

export interface Finding {
  /** The file, relative to the root, with forward slashes. */
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

export interface AuditTransactionReport {
  /** How many `.record(` calls were visited. A check that visits none proves nothing, so the test states and pins this number. */
  readonly checked: number;
  readonly findings: readonly Finding[];
}

type FunctionNode = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | ts.MethodDeclaration;

interface ParameterRef {
  readonly fn: FunctionNode;
  readonly index: number;
  readonly symbol: ts.Symbol;
}

const slashes = (path: string): string => path.replaceAll('\\', '/');
/** The root as the compiler spells paths: forward slashes, none at the end. */
const rootOf = (root: string): string => slashes(root).replace(/\/+$/, '');

function isFunctionNode(node: ts.Node): node is FunctionNode {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node);
}

/** `a.b` or `a['b']` as a callee: the member name and the object it is read from. */
function memberOf(callee: ts.Expression): { readonly name: string; readonly target: ts.Expression } | undefined {
  if (ts.isPropertyAccessExpression(callee)) return { name: callee.name.text, target: callee.expression };
  if (
    ts.isElementAccessExpression(callee) &&
    (ts.isStringLiteral(callee.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(callee.argumentExpression))
  ) {
    return { name: callee.argumentExpression.text, target: callee.expression };
  }
  return undefined;
}

function parts(type: ts.Type): readonly ts.Type[] {
  return type.isUnionOrIntersection() ? type.types : [type];
}

/** The services the check reads: every TypeScript file under `src/server/services`, at any depth. */
export function serviceFilesUnder(root: string): string[] {
  const base = join(root, 'src', 'server', 'services');
  return readdirSync(base, { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.(?:ts|tsx|mts)$/.test(name))
    .map((name) => slashes(join(base, name)))
    .sort();
}

export interface ProgramOptions {
  readonly root: string;
  /** Source files that exist only in memory, by path relative to the root (fixtures for the unit cases of the check). */
  readonly virtualFiles?: Readonly<Record<string, string>>;
}

/** A program over the services (and the in-memory files), with the compiler options of `tsconfig.json` and a type checker. */
export function createServicesProgram({ root, virtualFiles = {} }: ProgramOptions): ts.Program {
  const rootDir = rootOf(root);
  const configPath = join(root, 'tsconfig.json');
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error !== undefined) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, rootDir, undefined, configPath);
  // Nothing is emitted and no build-info file is read or written: the program is only asked questions.
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true, incremental: false };

  const memory = new Map(Object.entries(virtualFiles).map(([path, text]) => [`${rootDir}/${slashes(path)}`, text]));
  const host = ts.createCompilerHost(options, true);
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = (path) => memory.has(slashes(path)) || fileExists(path);
  host.readFile = (path) => memory.get(slashes(path)) ?? readFile(path);
  host.getSourceFile = (path, languageVersion, ...rest) => {
    const text = memory.get(slashes(path));
    return text === undefined ? getSourceFile(path, languageVersion, ...rest) : ts.createSourceFile(path, text, languageVersion, true);
  };

  return ts.createProgram({ rootNames: [...serviceFilesUnder(root), ...memory.keys()], options, host });
}

/**
 * Checks every `.record(` call in `files` (paths as the program knows them). A file the program does not hold is an error, not a
 * pass, so a typo in a path cannot make the check visit nothing.
 */
export function checkAuditTransactions(program: ts.Program, root: string, files: readonly string[]): AuditTransactionReport {
  const checker = program.getTypeChecker();
  const rootDir = rootOf(root);
  const findings: Finding[] = [];
  let checked = 0;

  /** The parameter an argument is, when the argument is a plain name that resolves to a parameter of a function. */
  function parameterOf(argument: ts.Expression | undefined): ParameterRef | undefined {
    let expression = argument;
    while (expression !== undefined && ts.isParenthesizedExpression(expression)) expression = expression.expression;
    if (expression === undefined || !ts.isIdentifier(expression)) return undefined;
    const symbol = checker.getSymbolAtLocation(expression);
    const declaration = symbol?.valueDeclaration;
    if (symbol === undefined || declaration === undefined || !ts.isParameter(declaration) || !isFunctionNode(declaration.parent)) return undefined;
    return { fn: declaration.parent, index: declaration.parent.parameters.indexOf(declaration), symbol };
  }

  function isTransactionRunner(type: ts.Type): boolean {
    return parts(type).some((part) =>
      [part.aliasSymbol, part.getSymbol()].some(
        (symbol) =>
          symbol?.name === TRANSACTION_RUNNER && (symbol.declarations ?? []).some((d) => slashes(d.getSourceFile().fileName).endsWith(`/${REPOSITORIES}transaction.ts`)),
      ),
    );
  }

  /** A function passed as the first argument of `r.run(...)`, where `r` is typed as `TransactionRunner`. */
  function isRunCallback(fn: FunctionNode): boolean {
    const call = fn.parent;
    if (!ts.isCallExpression(call) || call.arguments[0] !== fn) return false;
    const member = memberOf(call.expression);
    return member !== undefined && member.name === 'run' && isTransactionRunner(checker.getTypeAtLocation(member.target));
  }

  /** Declared under `src/server/repositories/`, other than the handle's file and the audit repository. */
  function isAnotherRepository(type: ts.Type): boolean {
    return parts(type).some((part) =>
      [part.aliasSymbol, part.getSymbol()].some((symbol) =>
        (symbol?.declarations ?? []).some((declaration) => {
          const path = relative(rootDir, slashes(declaration.getSourceFile().fileName)).replaceAll('\\', '/');
          const name = path.slice(path.lastIndexOf('/') + 1);
          return path.startsWith(REPOSITORIES) && !NOT_ANOTHER_REPOSITORY.has(name);
        }),
      ),
    );
  }

  /** Whether `fn` makes "another repository call" with the parameter `symbol` among its arguments (anywhere inside it). */
  function callsAnotherRepository(fn: FunctionNode, symbol: ts.Symbol): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
      if (found) return;
      if (ts.isCallExpression(node)) {
        const member = memberOf(node.expression);
        if (
          member !== undefined &&
          member.name !== 'record' &&
          isAnotherRepository(checker.getTypeAtLocation(member.target)) &&
          node.arguments.some((argument) => parameterOf(argument)?.symbol === symbol)
        ) {
          found = true;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    if (fn.body !== undefined) visit(fn.body);
    return found;
  }

  /** The symbol a named helper is called by: `function f`, or `const f = (...) => ...`. */
  function helperSymbol(fn: FunctionNode): ts.Symbol | undefined {
    if (ts.isFunctionDeclaration(fn) && fn.name !== undefined) return checker.getSymbolAtLocation(fn.name);
    const holder = fn.parent;
    if (ts.isVariableDeclaration(holder) && holder.initializer === fn && ts.isIdentifier(holder.name)) return checker.getSymbolAtLocation(holder.name);
    return undefined;
  }

  /** Every use of the helper's name in its own file, other than the declaration. */
  function usesOf(symbol: ts.Symbol, source: ts.SourceFile): ts.Identifier[] {
    const uses: ts.Identifier[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        const parent = node.parent;
        const resolved =
          ts.isShorthandPropertyAssignment(parent) && parent.name === node ? checker.getShorthandAssignmentValueSymbol(parent) : checker.getSymbolAtLocation(node);
        const declares = (ts.isFunctionDeclaration(parent) || ts.isVariableDeclaration(parent)) && parent.name === node;
        if (resolved === symbol && !declares) uses.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return uses;
  }

  const lineOf = (node: ts.Node): number => node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const nameOf = (fn: FunctionNode): string => {
    const named = helperSymbol(fn)?.name ?? (fn.name !== undefined && ts.isIdentifier(fn.name) ? fn.name.text : undefined);
    return named ?? `the function at line ${lineOf(fn)}`;
  };

  /** Why the function that holds a transaction parameter does not qualify, or undefined when it does. */
  function chainProblem(parameter: ParameterRef, steps: number, path: readonly FunctionNode[], repositoryCallSeen: boolean): string | undefined {
    const { fn } = parameter;
    if (path.includes(fn)) return `${nameOf(fn)} is reached through its own callers (a cycle), so no .run( callback can be found`;
    const seen = repositoryCallSeen || callsAnotherRepository(fn, parameter.symbol);

    if (isRunCallback(fn)) {
      if (parameter.index !== 0) return 'the transaction is not the first parameter of the .run( callback';
      return seen ? undefined : 'the .run( callback passes its transaction to no repository call other than record';
    }
    if (steps >= MAX_HELPER_STEPS) return `${nameOf(fn)} is more than ${MAX_HELPER_STEPS} calls away from its .run( callback`;
    const symbol = helperSymbol(fn);
    if (symbol === undefined) return `${nameOf(fn)} is not a .run( callback of a TransactionRunner and not a named function whose calls can be followed`;

    const uses = usesOf(symbol, fn.getSourceFile());
    if (uses.length === 0) return `${nameOf(fn)} is never called in this file, so no .run( callback can be found`;
    for (const use of uses) {
      const call = use.parent;
      if (!ts.isCallExpression(call) || call.expression !== use) return `${nameOf(fn)} is used other than by a direct call (line ${lineOf(use)})`;
      const caller = parameterOf(call.arguments[parameter.index]);
      if (caller === undefined) {
        return `the call to ${nameOf(fn)} at line ${lineOf(call)} does not pass a parameter of an enclosing function in position ${parameter.index + 1}`;
      }
      const problem = chainProblem(caller, steps + 1, [...path, fn], seen);
      if (problem !== undefined) return problem;
    }
    return undefined;
  }

  function problemWithRecord(call: ts.CallExpression): string | undefined {
    const parameter = parameterOf(call.arguments[0]);
    if (parameter === undefined) return 'the transaction passed to record is not a parameter of a function around the call';
    return chainProblem(parameter, 0, [], false);
  }

  for (const name of files) {
    const source = program.getSourceFile(name);
    if (source === undefined) throw new Error(`${name} is not part of the program, so its record calls were not checked`);
    const file = relative(rootDir, slashes(source.fileName)).replaceAll('\\', '/');
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && memberOf(node.expression)?.name === 'record') {
        checked += 1;
        const message = problemWithRecord(node);
        if (message !== undefined) findings.push({ file, line: lineOf(node), message });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { checked, findings };
}
