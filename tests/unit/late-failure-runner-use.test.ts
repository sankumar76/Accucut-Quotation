import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Tech-debt #130, requirement 2: every audited master's integration test makes its late failure with the shared runner
 * (`tests/support/late-failure-runner.ts`) and never with a runner of its own. A local runner that throws after every `run` rolls back a
 * second transaction opened inside the change as well, so a bypass passes (OBS-1 of the AQP-122 G7 report, DEF-017 class, DL-107).
 *
 * The check parses each test file with the TypeScript compiler API (QLT-01 of the review of PR #139: a text match was passed by a
 * renamed parameter, `async`, a method, a shorthand `{ transactions }`, or a file that also imports the shared helper). It looks at
 * the syntax, so a comment or a string that says "run:" is not a finding. A file is refused when
 *  - it defines a member named `run` (property, method, accessor or shorthand, in any form): that is what a transaction runner is. A
 *    **call** such as `real.run(work)` is not a definition;
 *  - it hands the masters service a `transactions` (any form, including the shorthand) or declares a function returning a
 *    `TransactionRunner`, and never calls `createLateFailingRunner(`.
 */

const MASTERS_TESTS = join(process.cwd(), 'tests', 'integration', 'masters');
const SERVICE_BUILDERS = new Set(['buildMastersService', 'createMastersService']);
const SHARED_RUNNER = 'createLateFailingRunner';

/** The text of a member name, also for `'run'` and `['run']`; `undefined` for a name that is computed at run time. */
function memberName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && (ts.isStringLiteral(name.expression) || ts.isNoSubstitutionTemplateLiteral(name.expression))) {
    return name.expression.text;
  }
  return undefined;
}

/** The name a call is made to: `f(...)` gives `f`, `a.b.f(...)` gives `f`. */
function calleeName(call: ts.CallExpression): string | undefined {
  if (ts.isIdentifier(call.expression)) return call.expression.text;
  if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
  return undefined;
}

function isNamedMember(node: ts.Node, wanted: string): boolean {
  if (ts.isShorthandPropertyAssignment(node)) return node.name.text === wanted;
  if (ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
    return memberName(node.name) === wanted;
  }
  return false;
}

/** The problems in one test file's text, as short sentences. Empty when the file is clean. */
function localRunnerProblems(source: string): string[] {
  const file = ts.createSourceFile('masters.test.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const seen = { definesRun: false, injectsRunner: false, callsSharedRunner: false };

  const visit = (node: ts.Node): void => {
    if (isNamedMember(node, 'run')) seen.definesRun = true;
    if (ts.isCallExpression(node)) {
      const callee = calleeName(node);
      if (callee === SHARED_RUNNER) seen.callsSharedRunner = true;
      if (callee !== undefined && SERVICE_BUILDERS.has(callee)) {
        for (const argument of node.arguments) {
          if (ts.isObjectLiteralExpression(argument) && argument.properties.some((property) => isNamedMember(property, 'transactions'))) {
            seen.injectsRunner = true;
          }
        }
      }
    }
    if (ts.isFunctionLike(node) && node.type !== undefined && ts.isTypeReferenceNode(node.type)) {
      if (ts.isIdentifier(node.type.typeName) && node.type.typeName.text === 'TransactionRunner') seen.injectsRunner = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  const problems: string[] = [];
  if (seen.injectsRunner && !seen.callsSharedRunner) problems.push('uses a runner without createLateFailingRunner');
  if (seen.definesRun) problems.push('declares a run method of its own');
  return problems;
}

describe('the masters integration tests use the shared late-failure runner (#130)', () => {
  const files = readdirSync(MASTERS_TESTS).filter((name) => name.endsWith('.test.ts'));

  it('finds the masters integration tests it is meant to guard', () => {
    expect(files).toEqual(expect.arrayContaining(['materials.test.ts', 'process-items.test.ts']));
  });

  it.each(files)('%s has no runner of its own', (name) => {
    expect(localRunnerProblems(readFileSync(join(MASTERS_TESTS, name), 'utf8'))).toEqual([]);
  });

  describe('the check itself (a plant per form of the fault)', () => {
    const IMPORT = `import { createLateFailingRunner } from '../../support/late-failure-runner';\n`;
    const RUN_OF_ITS_OWN = ['declares a run method of its own'];
    const NO_SHARED_RUNNER = ['uses a runner without createLateFailingRunner'];
    const wired = 'const service = db.buildMastersService({ transactions: failing() });';

    const local = `function failingAfterTheLastStep(): TransactionRunner {
      const real = createTransactionRunner(db.prisma);
      return { run: (work) => real.run(async (tx) => { await work(tx); throw new Error('late'); }) };
    }
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });`;

    it('refuses a local runner that throws after every run', () => {
      expect(localRunnerProblems(local)).toEqual([...NO_SHARED_RUNNER, ...RUN_OF_ITS_OWN]);
    });

    it.each([
      ['a parameter with another name', 'const failing = () => ({ run: (unit) => real.run(unit) });'],
      ['an async arrow', 'const failing = () => ({ run: async (work) => real.run(work) });'],
      ['a method', 'const failing = () => ({ run(fn) { return real.run(fn); } });'],
      ['an async method', 'const failing = () => ({ async run(fn) { return real.run(fn); } });'],
      ['a generic method', 'const failing = () => ({ run<R>(fn) { return real.run(fn); } });'],
      ['a quoted name', "const failing = () => ({ 'run': (fn) => real.run(fn) });"],
      ['a computed string name', "const failing = () => ({ ['run']: (fn) => real.run(fn) });"],
      ['a shorthand member', 'const run = (fn) => real.run(fn); const failing = () => ({ run });'],
      ['a class method', 'class Failing { async run(fn) { return real.run(fn); } }'],
    ])('refuses %s, even when the shared runner is also imported and used', (_form, definition) => {
      const source = `${IMPORT}const shared = createLateFailingRunner(real, new Error('late'));\n${definition}\n${wired}`;
      expect(localRunnerProblems(source)).toEqual(RUN_OF_ITS_OWN);
    });

    it('refuses a service given a runner by the shorthand { transactions }', () => {
      expect(localRunnerProblems('const transactions = someRunner; const s = db.buildMastersService({ transactions });')).toEqual(NO_SHARED_RUNNER);
    });

    it('refuses a service given a runner the file did not take from the shared helper', () => {
      expect(localRunnerProblems('const s = db.buildMastersService({ transactions: someRunner });')).toEqual(NO_SHARED_RUNNER);
    });

    it('refuses the shared runner only imported (named but never called)', () => {
      expect(localRunnerProblems(`${IMPORT}const s = db.buildMastersService({ transactions: someRunner });`)).toEqual(NO_SHARED_RUNNER);
    });

    it('does not flag a call to run: real.run(work), db.transactions.run(...) and runner.run(...) define nothing', () => {
      const calls = `${IMPORT}const failing = createLateFailingRunner(real, new Error('late'));
      const forwarded = (work) => real.run(work);
      await db.transactions.run((tx) => db.audit.record(tx, entry));
      await failing.run(async () => undefined);`;
      expect(localRunnerProblems(calls)).toEqual([]);
    });

    it('does not read a comment or a string as a definition', () => {
      expect(localRunnerProblems("// run: (work) => ...\nconst text = 'run: async (work) =>';")).toEqual([]);
    });

    it('accepts the shared runner', () => {
      const shared = `${IMPORT}
      function failingAfterTheLastStep(): TransactionRunner { return createLateFailingRunner(real, new Error('late')); }
      const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });`;
      expect(localRunnerProblems(shared)).toEqual([]);
    });
  });
});
