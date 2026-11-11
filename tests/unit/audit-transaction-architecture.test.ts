import { fileURLToPath } from 'node:url';

import type ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  type AuditTransactionReport,
  checkAuditTransactions,
  createServicesProgram,
  MAX_HELPER_STEPS,
  serviceFilesUnder,
} from '../support/audit-transaction-check';

/**
 * STORY-10.18 (GitHub #104; architecture section 6): every `.record(` call in `src/server/services` runs in the transaction of the
 * change it records. `AuditService.record` takes the change's `Transaction`; this test reads the services with the TypeScript type
 * checker (the options of `tsconfig.json`) and refuses a `record` that is not inside a `.run(` callback of a `TransactionRunner`,
 * or whose callback passes its transaction to no repository call other than `record`. The rule is in
 * `tests/support/audit-transaction-check.ts`; the lint half (only `transaction.ts` and `tests/**` may import
 * `createTransactionHandle`) is `tests/unit/lint/transaction-handle-rule.test.ts`.
 *
 * What this test cannot see, so nobody reads a pass as more than it proves (AC-5):
 *  - a chain longer than 3 steps (it fails, it is not followed), and a helper whose callers are in another file: only the calls in
 *    the helper's own file are followed, so an exported helper called elsewhere with any handle is not seen;
 *  - a `.run(` callback the checker does not type as `TransactionRunner` (it fails, it is not guessed at);
 *  - that a write or an order is required: any call on a repository with the transaction among its arguments (a lock, a read, a
 *    write) counts as the change, and the entry may stand before the change in the same callback. Only a failure forced at that
 *    exact point sees that order: the shared late-failure runner of #130 does it for the audited masters;
 *  - a closure inside the callback that is kept and run later, and a `record` reached by destructuring (`const { record } = audit`).
 *
 * The cases below run the same check on small in-memory services, one per form of the fault (the plants of AC-3) and one per edge
 * case of the chain, so a check that has gone too loose or too strict is seen here and not only on the real code.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** `.record(` calls in the services at master b3403e3 (AQP-123 and AQP-130 added to the 11 that AC-4 counted at 023e17d). */
const RECORD_CALLS_AT_BASE = 15;

const THING_REPOSITORY = `import type { Transaction } from './transaction';

export interface ThingRepository {
  add(name: string, tx?: Transaction): Promise<void>;
}
`;

const PRELUDE = `import type { AuditRepository } from '../../repositories/audit-repository';
import type { ThingRepository } from '../../repositories/fixture-thing-repository';
import type { Transaction, TransactionRunner } from '../../repositories/transaction';

interface Recorder {
  record(tx: Transaction, entry: { event: string }): Promise<void>;
}
interface LocalStore {
  add(name: string, tx: Transaction): Promise<void>;
}
interface HomeMadeRunner {
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
}
declare const transactions: TransactionRunner;
declare const homeMade: HomeMadeRunner;
declare const things: ThingRepository;
declare const store: LocalStore;
declare const rows: AuditRepository;
declare const row: Parameters<AuditRepository['append']>[0];
declare const audit: Recorder;
declare const stray: Transaction;
`;

interface Case {
  readonly name: string;
  readonly code: string;
  /** How many `.record(` calls the file holds. */
  readonly records: number;
  /** One fragment per finding, in order. Empty when the file passes. */
  readonly findings: readonly string[];
}

const PASSING: readonly Case[] = [
  {
    name: 'a record after a repository call, in the .run( callback',
    code: `export async function direct() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await audit.record(tx, { event: 'created' });
      });
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'a callback whose parameter has another name',
    code: `export async function renamed() {
      await transactions.run(async (handle) => {
        await things.add('a', handle);
        await audit.record(handle, { event: 'created' });
      });
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'two .run( callbacks in one function, each with its own entry',
    code: `export async function twice() {
      await transactions.run(async (first) => {
        await things.add('a', first);
        await audit.record(first, { event: 'created' });
      });
      await transactions.run(async (second) => {
        await things.add('b', second);
        await audit.record(second, { event: 'created' });
      });
    }`,
    records: 2,
    findings: [],
  },
  {
    name: 'a repository call written x["m"](tx)',
    code: `export async function bracket() {
      await transactions.run(async (tx) => {
        await things['add']('a', tx);
        await audit.record(tx, { event: 'created' });
      });
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'a helper called from two callbacks, with a renamed parameter in one',
    code: `async function addThing(name: string, tx: Transaction) {
      await things.add(name, tx);
      await audit.record(tx, { event: 'created' });
    }
    export async function helper() {
      await transactions.run((tx) => addThing('a', tx));
      await transactions.run((handle) => addThing('b', handle));
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'a helper declared as a const arrow function',
    code: `const addThing = async (tx: Transaction, name: string) => {
      await things.add(name, tx);
      await audit.record(tx, { event: 'created' });
    };
    export async function helper() {
      await transactions.run((tx) => addThing(tx, 'a'));
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'a repository call in the callback and the record in the helper (the repository call is on the chain)',
    code: `const note = (tx: Transaction) => audit.record(tx, { event: 'created' });
    export async function chain() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await note(tx);
      });
    }`,
    records: 1,
    findings: [],
  },
  {
    name: `a chain of ${MAX_HELPER_STEPS} steps`,
    code: `async function third(tx: Transaction) {
      await things.add('a', tx);
      await audit.record(tx, { event: 'created' });
    }
    const second = (tx: Transaction) => third(tx);
    const first = (tx: Transaction) => second(tx);
    export async function deep() {
      await transactions.run((tx) => first(tx));
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'a record inside a nested arrow function in the callback',
    code: `export async function nested() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await Promise.all(['a', 'b'].map((event) => audit.record(tx, { event })));
      });
    }`,
    records: 1,
    findings: [],
  },
];

const FAILING: readonly Case[] = [
  {
    name: 'P1: a record in a .run( of its own before the change',
    code: `export async function before() {
      await transactions.run((tx) => audit.record(tx, { event: 'created' }));
      await transactions.run((tx) => things.add('a', tx));
    }`,
    records: 1,
    findings: ['passes its transaction to no repository call other than record'],
  },
  {
    name: 'P2: a record after the callback returned, with the handle kept',
    code: `export async function after() {
      let kept: Transaction | undefined;
      await transactions.run(async (tx) => {
        kept = tx;
        await things.add('a', tx);
      });
      if (kept !== undefined) await audit.record(kept, { event: 'created' });
    }`,
    records: 1,
    findings: ['is not a parameter of a function around the call'],
  },
  {
    name: 'P2: a record given a handle that is not the callback parameter',
    code: `export async function other() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await audit.record(stray, { event: 'created' });
      });
    }`,
    records: 1,
    findings: ['is not a parameter of a function around the call'],
  },
  {
    name: 'P3: a callback that calls record and passes its handle to no other repository call',
    code: `export async function lonely() {
      await transactions.run(async (tx) => {
        await audit.record(tx, { event: 'created' });
      });
    }`,
    records: 1,
    findings: ['passes its transaction to no repository call other than record'],
  },
  {
    name: 'P3b: a callback whose only other call with the handle is on the AuditRepository',
    code: `export async function auditOnly() {
      await transactions.run(async (tx) => {
        await rows.append(row, tx);
        await audit.record(tx, { event: 'created' });
      });
    }`,
    records: 1,
    findings: ['passes its transaction to no repository call other than record'],
  },
  {
    name: 'P5: a helper also called by a function nothing calls',
    code: `async function addThing(tx: Transaction, name: string) {
      await things.add(name, tx);
      await audit.record(tx, { event: 'created' });
    }
    export async function inside() {
      await transactions.run((tx) => addThing(tx, 'a'));
    }
    export function outside(handle: Transaction) {
      return addThing(handle, 'b');
    }`,
    records: 1,
    findings: ['outside is never called in this file'],
  },
  {
    name: 'P5: a helper also called once with a handle that is no parameter',
    code: `async function addThing(tx: Transaction, name: string) {
      await things.add(name, tx);
      await audit.record(tx, { event: 'created' });
    }
    export async function inside() {
      await transactions.run((tx) => addThing(tx, 'a'));
      await addThing(stray, 'b');
    }`,
    records: 1,
    findings: ['does not pass a parameter of an enclosing function in position 1'],
  },
  {
    name: 'a helper that nothing in the file calls',
    code: `export async function addThing(tx: Transaction) {
      await things.add('a', tx);
      await audit.record(tx, { event: 'created' });
    }`,
    records: 1,
    findings: ['is never called in this file'],
  },
  {
    name: 'a helper used as a value, not called',
    code: `async function addThing(tx: Transaction) {
      await things.add('a', tx);
      await audit.record(tx, { event: 'created' });
    }
    export async function byName() {
      await transactions.run(addThing);
    }`,
    records: 1,
    findings: ['is used other than by a direct call'],
  },
  {
    name: `a chain of ${MAX_HELPER_STEPS + 1} steps`,
    code: `async function fourth(tx: Transaction) {
      await things.add('a', tx);
      await audit.record(tx, { event: 'created' });
    }
    const third = (tx: Transaction) => fourth(tx);
    const second = (tx: Transaction) => third(tx);
    const first = (tx: Transaction) => second(tx);
    export async function deeper() {
      await transactions.run((tx) => first(tx));
    }`,
    records: 1,
    findings: [`is more than ${MAX_HELPER_STEPS} calls away`],
  },
  {
    name: 'a cycle between two helpers',
    code: `async function first(tx: Transaction) {
      await things.add('a', tx);
      await audit.record(tx, { event: 'created' });
      await second(tx);
    }
    async function second(tx: Transaction) {
      await first(tx);
    }
    export async function start() {
      await transactions.run((tx) => first(tx));
    }`,
    records: 1,
    findings: ['a cycle'],
  },
  {
    name: 'a runner the checker does not type as TransactionRunner',
    code: `export async function homemade() {
      await homeMade.run(async (tx) => {
        await things.add('a', tx);
        await audit.record(tx, { event: 'created' });
      });
    }`,
    records: 1,
    findings: ['is not a .run( callback of a TransactionRunner'],
  },
  {
    name: 'a call on an object that is not declared under src/server/repositories',
    code: `export async function local() {
      await transactions.run(async (tx) => {
        await store.add('a', tx);
        await audit.record(tx, { event: 'created' });
      });
    }`,
    records: 1,
    findings: ['passes its transaction to no repository call other than record'],
  },
  {
    name: 'a repository call that does not receive the callback handle',
    code: `export async function elsewhere() {
      await transactions.run(async (tx) => {
        await things.add('a', stray);
        await audit.record(tx, { event: 'created' });
      });
    }`,
    records: 1,
    findings: ['passes its transaction to no repository call other than record'],
  },
  {
    name: 'a record call with no transaction argument',
    code: `export async function bare() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await audit.record();
      });
    }`,
    records: 1,
    findings: ['is not a parameter of a function around the call'],
  },
  {
    name: 'one bad record among good ones is named, the good ones are not',
    code: `export async function mixed() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await audit.record(tx, { event: 'created' });
      });
      await audit.record(stray, { event: 'created' });
    }`,
    records: 2,
    findings: ['is not a parameter of a function around the call'],
  },
];

const fixturePath = (name: string): string => `src/server/services/fixtures/${name.replaceAll(/\W+/g, '-').toLowerCase()}.ts`;

describe('every audit.record call runs in the change\'s transaction (STORY-10.18; architecture section 6)', () => {
  let program: ts.Program;
  let serviceFiles: string[];
  let today: AuditTransactionReport;
  let definition: AuditTransactionReport;
  const fixtures = Object.fromEntries([...PASSING, ...FAILING].map(({ name, code }) => [fixturePath(name), `${PRELUDE}\n${code}\n`]));

  beforeAll(() => {
    program = createServicesProgram({
      root: ROOT,
      virtualFiles: { 'src/server/repositories/fixture-thing-repository.ts': THING_REPOSITORY, ...fixtures },
    });
    serviceFiles = serviceFilesUnder(ROOT);
    // The slow part (building the program and asking the type checker about the real services) runs once, in the hook (DL-057).
    today = checkAuditTransactions(program, ROOT, serviceFiles);
    definition = checkAuditTransactions(
      program,
      ROOT,
      serviceFiles.filter((path) => path.endsWith('/audit-service.ts')),
    );
  }, 120_000);

  it('finds the services it is meant to read', () => {
    expect(serviceFiles.length).toBeGreaterThan(0);
    expect(serviceFiles.some((path) => path.endsWith('/audit-service.ts'))).toBe(true);
  });

  it(`AC-4: today's services pass with no allow-list, and at least ${RECORD_CALLS_AT_BASE} record calls were checked`, () => {
    expect(today.findings.map(({ file, line, message }) => `${file}:${line}: ${message}`)).toEqual([]);
    expect(today.checked).toBeGreaterThanOrEqual(RECORD_CALLS_AT_BASE);
  });

  it('the definition of record in audit-service.ts is not checked as a call', () => {
    expect(definition).toEqual({ checked: 0, findings: [] });
  });

  it('refuses a path the program does not hold, so a typo cannot make the check visit nothing', () => {
    expect(() => checkAuditTransactions(program, ROOT, ['src/server/services/no-such-service.ts'])).toThrow(/not part of the program/);
  });

  describe('AC-2: forms that pass', () => {
    it.each(PASSING)('$name', ({ name, records, findings }) => {
      const report = checkAuditTransactions(program, ROOT, [`${ROOT}${fixturePath(name)}`.replaceAll('\\', '/')]);
      expect(report.findings.map(({ message }) => message)).toEqual(findings);
      expect(report.checked).toBe(records);
    });
  });

  describe('AC-3: forms that fail (the plants), and the edge cases of the chain', () => {
    it.each(FAILING)('$name', ({ name, records, findings }) => {
      const report = checkAuditTransactions(program, ROOT, [`${ROOT}${fixturePath(name)}`.replaceAll('\\', '/')]);
      expect(report.checked).toBe(records);
      expect(report.findings.map(({ message }) => message)).toEqual(findings.map((fragment) => expect.stringContaining(fragment)));
    });
  });
});
