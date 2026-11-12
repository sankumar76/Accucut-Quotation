import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';

/**
 * The check behind `tests/unit/audit-transaction-architecture.test.ts` (STORY-10.18, GitHub #104; architecture section 6, "An audit
 * entry commits with its change, or not at all"). It reads the services with the TypeScript type checker and refuses every use of
 * `AuditService.record` that does not run in the transaction of the change it records.
 *
 * The rule (architecture section 6 "The two checks as built", AQP-237 comment 11263, and DL-156):
 *  - Which calls: a use of the member `record` whose receiver the checker types as `AuditService` (`src/server/services/audit-service.ts`).
 *    `z.record(...)` is not one. A receiver typed `any` fails, because it cannot be told from one. A use that is not the callee of a
 *    direct call (`audit.record.call(...)`, `.bind`, `const write = audit.record`) fails: the check cannot follow it.
 *  - (a) The function F that LEXICALLY holds the call (the nearest function around it, not any function further out) has the call's `tx`
 *    argument as one of its own parameters P, and the call is awaited, returned or the body of an arrow function. Then either F is a
 *    `.run(` callback (a function passed to `r.run(...)` where the checker types `r` as `TransactionRunner`), or every call to F in the
 *    same file passes, in P's position, a parameter of the function that lexically holds THAT call, which qualifies in the same way, and
 *    that call is awaited, returned or an arrow body too. The chain from F up to the callback follows at most `MAX_HELPER_STEPS` calls,
 *    and a function that is already on the chain is a cycle and fails.
 *  - (b) On that chain there is "another repository call": a call `x.m(...)` or `x['m'](...)` where the checker types `x` with a type
 *    declared under `src/server/repositories/` (not `transaction.ts`, not `audit-repository.ts`) and one argument is the transaction
 *    parameter of that step. Any method counts (a lock, a read or a write).
 *
 * A step is one call followed: F called by G is one step, G called by the callback another. The callback itself is not a step, so a
 * helper three calls below the callback passes and one four calls below fails.
 *
 * What it does not see, so a pass is never read as more than it proves. Each form is either accepted (a case in the test shows it
 * passes) or fails here (a case shows it fails, and the message says why):
 *  - ACCEPTED: an exported helper that holds `record` and is called from another file with any handle (only the calls in the helper's
 *    own file are followed; Q4, QLT-07);
 *  - ACCEPTED: a repository call with the transaction inside a nested function that is never run, which satisfies (b) (Q5, QLT-04;
 *    GitHub #259);
 *  - ACCEPTED: that a write or an order is required: a lock or a read on the transaction satisfies (b), and the entry may come before the
 *    change inside the same callback. The late-failure runner of tests/support (#130) is what forces a failure at that point;
 *  - ACCEPTED: `record` reached through destructuring (`const { record } = audit`) or a computed key (`audit[name]`), which are not
 *    uses of the member that the check looks at;
 *  - ACCEPTED: a `record` whose error is caught and not rethrown inside the callback; error handling is outside this check (X1, QLT-08);
 *  - FAILS: a chain longer than `MAX_HELPER_STEPS`, a cycle, a helper that is never called in its file or is used other than by a direct
 *    call, a `.run(` callback the checker does not type as `TransactionRunner` (an `any`, a class that only implements the interface, a
 *    callback given by name), a `record` in a nested function, a call that is not awaited or returned (`void`, a forgotten `await`).
 */

/** Calls followed from the function that holds `record` up to the `.run(` callback. */
export const MAX_HELPER_STEPS = 3;

/** Types whose declarations here are not "another repository": the handle's own file, and the audit repository the entry goes to. */
const NOT_ANOTHER_REPOSITORY = new Set(['transaction.ts', 'audit-repository.ts']);
const REPOSITORIES_DIRECTORY = 'src/server/repositories/';
const AUDIT_SERVICE_FILE = '/src/server/services/audit-service.ts';
const AUDIT_SERVICE_TYPE = 'AuditService';
const AUDIT_RECORD_METHOD = 'record';
const RUNNER_RUN_METHOD = 'run';
const TRANSACTION_RUNNER = 'TransactionRunner';

export interface Finding {
  /** The file, relative to the root, with forward slashes. */
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

export interface AuditTransactionReport {
  /** How many uses of `AuditService.record` were visited. A check that visits none proves nothing, so the test states and pins this number. */
  readonly checked: number;
  readonly findings: readonly Finding[];
}

type FunctionNode = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | ts.MethodDeclaration;

interface ParameterRef {
  readonly fn: FunctionNode;
  readonly index: number;
  readonly symbol: ts.Symbol;
}

/** What the functions below need to ask the type checker, and to print a path. */
interface Context {
  readonly checker: ts.TypeChecker;
  /** Forward slashes, none at the end. */
  readonly rootDir: string;
}

/** Where the walk from `record` up to the callback has been. */
interface Trail {
  readonly steps: number;
  readonly path: readonly FunctionNode[];
  readonly repositoryCallSeen: boolean;
}

/** `undefined`: not a use of `AuditService.record`. Otherwise it was visited, and `problem` is why it fails (undefined when it passes). */
type Verdict = { readonly problem: string | undefined } | undefined;

const toForwardSlashes = (path: string): string => path.replaceAll('\\', '/');
const rootOf = (root: string): string => toForwardSlashes(root).replace(/\/+$/, '');

function isFunctionNode(node: ts.Node): node is FunctionNode {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node);
}

/** `a.b` or `a['b']`: the member name and the object it is read from. */
function memberAccess(node: ts.Node): { readonly name: string; readonly target: ts.Expression } | undefined {
  if (ts.isPropertyAccessExpression(node)) return { name: node.name.text, target: node.expression };
  if (!ts.isElementAccessExpression(node)) return undefined;
  const key = node.argumentExpression;
  return ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key) ? { name: key.text, target: node.expression } : undefined;
}

function typeConstituents(type: ts.Type): readonly ts.Type[] {
  return type.isUnionOrIntersection() ? type.types : [type];
}

/** Whether a declaration of the type (or of its alias) satisfies `test`. */
function isDeclaredWhere(type: ts.Type, test: (declaration: ts.Declaration) => boolean): boolean {
  return typeConstituents(type).some((part) => [part.aliasSymbol, part.getSymbol()].some((symbol) => (symbol?.declarations ?? []).some(test)));
}

function relativePathOf(context: Context, declaration: ts.Node): string {
  return toForwardSlashes(relative(context.rootDir, toForwardSlashes(declaration.getSourceFile().fileName)));
}

function lineOf(node: ts.Node): number {
  return node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

/** The services the check reads: every TypeScript file under `src/server/services`, at any depth. */
export function serviceFilesUnder(root: string): string[] {
  const base = join(root, 'src', 'server', 'services');
  return readdirSync(base, { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.(?:ts|tsx|mts)$/.test(name))
    .map((name) => toForwardSlashes(join(base, name)))
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

  const memory = new Map(Object.entries(virtualFiles).map(([path, text]) => [`${rootDir}/${toForwardSlashes(path)}`, text]));
  const host = ts.createCompilerHost(options, true);
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = (path) => memory.has(toForwardSlashes(path)) || fileExists(path);
  host.readFile = (path) => memory.get(toForwardSlashes(path)) ?? readFile(path);
  host.getSourceFile = (path, languageVersion, ...rest) => {
    const text = memory.get(toForwardSlashes(path));
    return text === undefined ? getSourceFile(path, languageVersion, ...rest) : ts.createSourceFile(path, text, languageVersion, true);
  };

  return ts.createProgram({ rootNames: [...serviceFilesUnder(root), ...memory.keys()], options, host });
}

/** The parameter an argument is, when the argument is a plain name that resolves to a parameter of a function. */
function parameterOf(context: Context, argument: ts.Expression | undefined): ParameterRef | undefined {
  let expression = argument;
  while (expression !== undefined && ts.isParenthesizedExpression(expression)) expression = expression.expression;
  if (expression === undefined || !ts.isIdentifier(expression)) return undefined;
  const symbol = context.checker.getSymbolAtLocation(expression);
  const declaration = symbol?.valueDeclaration;
  if (symbol === undefined || declaration === undefined || !ts.isParameter(declaration) || !isFunctionNode(declaration.parent)) return undefined;
  return { fn: declaration.parent, index: declaration.parent.parameters.indexOf(declaration), symbol };
}

/** The nearest function around a node: the one that lexically holds it. */
function holderOf(node: ts.Node): ts.Node | undefined {
  for (let outer = node.parent; outer !== undefined; outer = outer.parent) if (ts.isFunctionLike(outer)) return outer;
  return undefined;
}

/** The call is awaited, returned, or the body of an arrow function, so the callback does not return before it is done. */
function isAwaitedOrReturned(call: ts.CallExpression): boolean {
  let node: ts.Node = call;
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  const { parent } = node;
  return ts.isAwaitExpression(parent) || ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === node);
}

/** Why a call is not placed where the rule wants it, or undefined: lexically in the function whose parameter it passes, and awaited. */
function problemWithPlacement(context: Context, call: ts.CallExpression, parameter: ParameterRef, what: string): string | undefined {
  if (holderOf(call) !== parameter.fn) {
    return `${what} sits in a nested function, not in ${nameOf(context, parameter.fn)}, whose parameter it passes`;
  }
  return isAwaitedOrReturned(call) ? undefined : `${what} is not awaited or returned, so it can run after the .run( callback has returned`;
}

function isTransactionRunner(type: ts.Type): boolean {
  return isDeclaredWhere(type, (declaration) => {
    const declared = ts.isTypeAliasDeclaration(declaration) || ts.isInterfaceDeclaration(declaration) || ts.isClassDeclaration(declaration);
    return declared && declaration.name?.text === TRANSACTION_RUNNER && toForwardSlashes(declaration.getSourceFile().fileName).endsWith(`/${REPOSITORIES_DIRECTORY}transaction.ts`);
  });
}

/** A function passed as the first argument of `r.run(...)`, where `r` is typed as `TransactionRunner`. */
function isRunCallback(context: Context, fn: FunctionNode): boolean {
  const call = fn.parent;
  if (!ts.isCallExpression(call) || call.arguments[0] !== fn) return false;
  const member = memberAccess(call.expression);
  return member !== undefined && member.name === RUNNER_RUN_METHOD && isTransactionRunner(context.checker.getTypeAtLocation(member.target));
}

/** Declared under `src/server/repositories/`, other than the handle's file and the audit repository. */
function isAnotherRepository(context: Context, type: ts.Type): boolean {
  return isDeclaredWhere(type, (declaration) => {
    const path = relativePathOf(context, declaration);
    return path.startsWith(REPOSITORIES_DIRECTORY) && !NOT_ANOTHER_REPOSITORY.has(path.slice(path.lastIndexOf('/') + 1));
  });
}

/** `x.m(..., tx, ...)` where `x` is typed with a repository and `tx` is the parameter `symbol`. */
function isRepositoryCallWith(context: Context, node: ts.Node, symbol: ts.Symbol): boolean {
  if (!ts.isCallExpression(node)) return false;
  const member = memberAccess(node.expression);
  return (
    member !== undefined &&
    isAnotherRepository(context, context.checker.getTypeAtLocation(member.target)) &&
    node.arguments.some((argument) => parameterOf(context, argument)?.symbol === symbol)
  );
}

/** Whether `fn` makes "another repository call" with the parameter `symbol` among its arguments (anywhere inside it). */
function callsAnotherRepository(context: Context, fn: FunctionNode, symbol: ts.Symbol): boolean {
  // forEachChild stops at the first truthy result, so `false` is mapped to `undefined` to keep scanning
  const visit = (node: ts.Node): boolean => isRepositoryCallWith(context, node, symbol) || ts.forEachChild(node, (child) => visit(child) || undefined) === true;
  return fn.body !== undefined && visit(fn.body);
}

/** The symbol a named helper is called by: `function f`, or `const f = (...) => ...`. */
function helperSymbol(context: Context, fn: FunctionNode): ts.Symbol | undefined {
  if (ts.isFunctionDeclaration(fn) && fn.name !== undefined) return context.checker.getSymbolAtLocation(fn.name);
  const holder = fn.parent;
  if (ts.isVariableDeclaration(holder) && holder.initializer === fn && ts.isIdentifier(holder.name)) return context.checker.getSymbolAtLocation(holder.name);
  return undefined;
}

function nameOf(context: Context, fn: FunctionNode): string {
  const named = helperSymbol(context, fn)?.name ?? (fn.name !== undefined && ts.isIdentifier(fn.name) ? fn.name.text : undefined);
  return named ?? `the function at line ${lineOf(fn)}`;
}

/** Every use of the helper's name in its own file, other than the declaration. */
function usesOf(context: Context, symbol: ts.Symbol, source: ts.SourceFile): ts.Identifier[] {
  const uses: ts.Identifier[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && isUseOf(context, node, symbol)) uses.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return uses;
}

function isUseOf(context: Context, identifier: ts.Identifier, symbol: ts.Symbol): boolean {
  const { parent } = identifier;
  const resolved =
    ts.isShorthandPropertyAssignment(parent) && parent.name === identifier
      ? context.checker.getShorthandAssignmentValueSymbol(parent)
      : context.checker.getSymbolAtLocation(identifier);
  const declares = (ts.isFunctionDeclaration(parent) || ts.isVariableDeclaration(parent)) && parent.name === identifier;
  return resolved === symbol && !declares;
}

function problemAtCallback(parameter: ParameterRef, repositoryCallSeen: boolean): string | undefined {
  if (parameter.index !== 0) return 'the transaction is not the first parameter of the .run( callback';
  return repositoryCallSeen ? undefined : 'the .run( callback passes its transaction to no repository call other than record';
}

/** Why the function that holds a transaction parameter does not qualify, or undefined when it does. */
function chainProblem(context: Context, parameter: ParameterRef, trail: Trail): string | undefined {
  const { fn } = parameter;
  if (trail.path.includes(fn)) return `${nameOf(context, fn)} is reached through its own callers (a cycle), so no .run( callback can be found`;
  const repositoryCallSeen = trail.repositoryCallSeen || callsAnotherRepository(context, fn, parameter.symbol);
  if (isRunCallback(context, fn)) return problemAtCallback(parameter, repositoryCallSeen);
  if (trail.steps >= MAX_HELPER_STEPS) return `${nameOf(context, fn)} is more than ${MAX_HELPER_STEPS} calls away from its .run( callback`;
  return problemWithCallers(context, parameter, { ...trail, repositoryCallSeen });
}

function problemWithCallers(context: Context, parameter: ParameterRef, trail: Trail): string | undefined {
  const { fn } = parameter;
  const symbol = helperSymbol(context, fn);
  if (symbol === undefined) return `${nameOf(context, fn)} is not a .run( callback of a TransactionRunner and not a named function whose calls can be followed`;
  const uses = usesOf(context, symbol, fn.getSourceFile());
  if (uses.length === 0) return `${nameOf(context, fn)} is never called in this file, so no .run( callback can be found`;
  const next: Trail = { ...trail, steps: trail.steps + 1, path: [...trail.path, fn] };
  for (const use of uses) {
    const problem = problemWithUse(context, parameter, use, next);
    if (problem !== undefined) return problem;
  }
  return undefined;
}

/** One call to the helper: a direct, awaited call from the function that holds it, passing that function's own parameter. */
function problemWithUse(context: Context, parameter: ParameterRef, use: ts.Identifier, next: Trail): string | undefined {
  const name = nameOf(context, parameter.fn);
  const call = use.parent;
  if (!ts.isCallExpression(call) || call.expression !== use) return `${name} is used other than by a direct call (line ${lineOf(use)})`;
  const caller = parameterOf(context, call.arguments[parameter.index]);
  if (caller === undefined) {
    return `the call to ${name} at line ${lineOf(call)} does not pass a parameter of an enclosing function in position ${parameter.index + 1}`;
  }
  return problemWithPlacement(context, call, caller, `the call to ${name} at line ${lineOf(call)}`) ?? chainProblem(context, caller, next);
}

function problemWithRecord(context: Context, call: ts.CallExpression): string | undefined {
  const parameter = parameterOf(context, call.arguments[0]);
  if (parameter === undefined) return 'the transaction passed to record is not a parameter of the function that holds the call';
  return problemWithPlacement(context, call, parameter, 'the record call') ?? chainProblem(context, parameter, { steps: 0, path: [], repositoryCallSeen: false });
}

/** `AuditService.record`, the member of the interface in `audit-service.ts`. */
function isAuditServiceRecord(receiver: ts.Type): boolean {
  return (receiver.getProperty(AUDIT_RECORD_METHOD)?.declarations ?? []).some(
    (declaration) =>
      ts.isInterfaceDeclaration(declaration.parent) &&
      declaration.parent.name.text === AUDIT_SERVICE_TYPE &&
      toForwardSlashes(declaration.getSourceFile().fileName).endsWith(AUDIT_SERVICE_FILE),
  );
}

/** Whether a node is a use of `AuditService.record`, and if so why it fails. */
function verdictOn(context: Context, node: ts.Node): Verdict {
  const access = memberAccess(node);
  if (access === undefined || access.name !== AUDIT_RECORD_METHOD) return undefined;
  // `audit?.record(...)` has a receiver typed `AuditService | undefined`: ask about the part that has the member.
  const receiver = context.checker.getNonNullableType(context.checker.getTypeAtLocation(access.target));
  if ((receiver.flags & ts.TypeFlags.Any) !== 0) return { problem: 'the receiver of record is typed any, so the call cannot be told from another record' };
  if (!isAuditServiceRecord(receiver)) return undefined;
  const call = node.parent;
  if (!ts.isCallExpression(call) || call.expression !== node) {
    return { problem: 'AuditService.record is used other than as the callee of a direct call (.call, .bind or an alias), which the check cannot follow' };
  }
  return { problem: problemWithRecord(context, call) };
}

function checkSource(context: Context, source: ts.SourceFile): AuditTransactionReport {
  const file = relativePathOf(context, source);
  const findings: Finding[] = [];
  let checked = 0;
  const visit = (node: ts.Node): void => {
    const verdict = verdictOn(context, node);
    if (verdict !== undefined) checked += 1;
    if (verdict?.problem !== undefined) findings.push({ file, line: lineOf(node), message: verdict.problem });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { checked, findings };
}

/**
 * Checks every use of `AuditService.record` in `files` (paths as the program knows them). A file the program does not hold is an
 * error, not a pass, so a typo in a path cannot make the check visit nothing.
 */
export function checkAuditTransactions(program: ts.Program, root: string, files: readonly string[]): AuditTransactionReport {
  const context: Context = { checker: program.getTypeChecker(), rootDir: rootOf(root) };
  const reports = files.map((name) => {
    const source = program.getSourceFile(name);
    if (source === undefined) throw new Error(`${name} is not part of the program, so its record calls were not checked`);
    return checkSource(context, source);
  });
  return { checked: reports.reduce((sum, report) => sum + report.checked, 0), findings: reports.flatMap((report) => report.findings) };
}
