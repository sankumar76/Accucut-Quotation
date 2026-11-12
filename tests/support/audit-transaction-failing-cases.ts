import type { Case } from './audit-transaction-cases';
import { MAX_HELPER_STEPS } from './audit-transaction-check';

/**
 * The cases that must FAIL (`tests/unit/audit-transaction-architecture.test.ts`, AC-3): the plants P1 to P5, the reviewer's Q1 to Q3,
 * and the edge cases of the chain. Each has the fragments its findings must contain, in order. The fixtures and the cases that pass
 * are in `audit-transaction-cases.ts`.
 */

/** The message fragments the cases look for. */
const NOT_A_PARAMETER = 'is not a parameter of the function that holds the call';
const NO_REPOSITORY_CALL = 'passes its transaction to no repository call other than record';
const NESTED = 'sits in a nested function';
const NOT_AWAITED = 'is not awaited or returned';
const NOT_A_CALLEE = 'used other than as the callee of a direct call';
const TYPED_ANY = 'is typed any';

export const FAILING: readonly Case[] = [
  {
    name: 'P1: a record in a .run( of its own before the change',
    code: `export async function before() {
      await transactions.run((tx) => audit.record(tx, entry));
      await transactions.run((tx) => things.add('a', tx));
    }`,
    records: 1,
    findings: [NO_REPOSITORY_CALL],
  },
  {
    name: 'P2: a record after the callback returned, with the handle kept',
    code: `export async function after() {
      let kept: Transaction | undefined;
      await transactions.run(async (tx) => {
        kept = tx;
        await things.add('a', tx);
      });
      if (kept !== undefined) await audit.record(kept, entry);
    }`,
    records: 1,
    findings: [NOT_A_PARAMETER],
  },
  {
    name: 'P2: a record given a handle that is not the callback parameter',
    code: `export async function other() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await audit.record(stray, entry);
      });
    }`,
    records: 1,
    findings: [NOT_A_PARAMETER],
  },
  {
    name: 'P3: a callback that calls record and passes its handle to no other repository call',
    code: `export async function lonely() {
      await transactions.run(async (tx) => {
        await audit.record(tx, entry);
      });
    }`,
    records: 1,
    findings: [NO_REPOSITORY_CALL],
  },
  {
    name: 'P3b: a callback whose only other call with the handle is on the AuditRepository',
    code: `export async function auditOnly() {
      await transactions.run(async (tx) => {
        await rows.append(row, tx);
        await audit.record(tx, entry);
      });
    }`,
    records: 1,
    findings: [NO_REPOSITORY_CALL],
  },
  {
    name: 'P5: a helper also called by a function nothing calls',
    code: `async function addThing(tx: Transaction, name: string) {
      await things.add(name, tx);
      await audit.record(tx, entry);
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
      await audit.record(tx, entry);
    }
    export async function inside() {
      await transactions.run((tx) => addThing(tx, 'a'));
      await addThing(stray, 'b');
    }`,
    records: 1,
    findings: ['does not pass a parameter of an enclosing function in position 1'],
  },
  {
    name: 'Q1: a record with void',
    code: `export async function voided() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        void audit.record(tx, entry);
      });
    }`,
    records: 1,
    findings: [NOT_AWAITED],
  },
  {
    name: 'Q1b: a record with a forgotten await',
    code: `export async function forgotten() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        audit.record(tx, entry);
      });
    }`,
    records: 1,
    findings: [NOT_AWAITED],
  },
  {
    name: 'Q1c: a helper call (one step below the callback) that is not awaited',
    code: `const note = (tx: Transaction) => audit.record(tx, entry);
    export async function forgottenStep() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        note(tx);
      });
    }`,
    records: 1,
    findings: [NOT_AWAITED],
  },
  {
    name: 'Q2: a record in an async function passed to forEach, inside the callback',
    code: `export async function each() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        ['a', 'b'].forEach(async () => {
          await audit.record(tx, entry);
        });
      });
    }`,
    records: 1,
    findings: [NESTED],
  },
  {
    name: 'Q2: a record in a function given to Promise.all(map), inside the callback',
    code: `export async function all() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await Promise.all(['a', 'b'].map((event) => audit.record(tx, entry)));
      });
    }`,
    records: 1,
    findings: [NESTED],
  },
  {
    name: 'Q2b: a helper call (one step below the callback) in an async function passed to forEach',
    code: `const note = (tx: Transaction) => audit.record(tx, entry);
    export async function eachStep() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        ['a'].forEach(async () => {
          await note(tx);
        });
      });
    }`,
    records: 1,
    findings: [NESTED],
  },
  {
    name: 'Q3: record reached through .call',
    code: `export async function viaCall() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await audit.record.call(audit, tx, entry);
      });
    }`,
    records: 1,
    findings: [NOT_A_CALLEE],
  },
  {
    name: 'Q3b: record reached through .bind',
    code: `export async function viaBind() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        const write = audit.record.bind(audit);
        await write(tx, entry);
      });
    }`,
    records: 1,
    findings: [NOT_A_CALLEE],
  },
  {
    name: 'Q3c: record kept in an alias',
    code: `export async function viaAlias() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        const write = audit.record;
        await write.call(audit, tx, entry);
      });
    }`,
    records: 1,
    findings: [NOT_A_CALLEE],
  },
  {
    name: 'a record on a receiver typed any',
    code: `export async function untypedReceiver() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await untyped.record(tx, entry);
      });
    }`,
    records: 1,
    findings: [TYPED_ANY],
  },
  {
    name: 'a helper that nothing in the file calls',
    code: `export async function addThing(tx: Transaction) {
      await things.add('a', tx);
      await audit.record(tx, entry);
    }`,
    records: 1,
    findings: ['is never called in this file'],
  },
  {
    name: 'a helper used as a value, not called',
    code: `async function addThing(tx: Transaction) {
      await things.add('a', tx);
      await audit.record(tx, entry);
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
      await audit.record(tx, entry);
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
      await audit.record(tx, entry);
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
        await audit.record(tx, entry);
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
        await audit.record(tx, entry);
      });
    }`,
    records: 1,
    findings: [NO_REPOSITORY_CALL],
  },
  {
    name: 'a repository call that does not receive the callback handle',
    code: `export async function elsewhere() {
      await transactions.run(async (tx) => {
        await things.add('a', stray);
        await audit.record(tx, entry);
      });
    }`,
    records: 1,
    findings: [NO_REPOSITORY_CALL],
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
    findings: [NOT_A_PARAMETER],
  },
  {
    name: 'one bad record among good ones is named, the good ones are not',
    code: `export async function mixed() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await audit.record(tx, entry);
      });
      await audit.record(stray, entry);
    }`,
    records: 2,
    findings: [NOT_A_PARAMETER],
  },
];
