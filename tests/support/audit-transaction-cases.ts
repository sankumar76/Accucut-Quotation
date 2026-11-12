import { MAX_HELPER_STEPS } from './audit-transaction-check';

/**
 * Small in-memory services for `tests/unit/audit-transaction-architecture.test.ts` (STORY-10.18, T6): one case per form of the fault
 * (the plants P1 to P5 and the reviewer's Q1 to Q6), and one per edge of the chain, so a check that has gone too loose or too strict
 * is seen here and not only on the real services. Each case is the body of a file under `src/server/services/fixtures/` that the
 * program reads after `PRELUDE`; nothing is written to disk.
 */

export interface Case {
  readonly name: string;
  readonly code: string;
  /** A second file in the same directory, which imports the first by its name. */
  readonly companion?: (module: string) => string;
  /** How many uses of `AuditService.record` the files hold. */
  readonly records: number;
  /** One fragment per finding, in order. Empty when the files pass. */
  readonly findings: readonly string[];
}

const THING_REPOSITORY_PATH = 'src/server/repositories/fixture-thing-repository.ts';
const FIXTURES_DIRECTORY = 'src/server/services/fixtures';

const THING_REPOSITORY = `import type { Transaction } from './transaction';

export interface ThingRepository {
  add(name: string, tx?: Transaction): Promise<void>;
}
`;

const PRELUDE = `import { z } from 'zod';

import type { AuditRepository } from '../../repositories/audit-repository';
import type { ThingRepository } from '../../repositories/fixture-thing-repository';
import type { Transaction, TransactionRunner } from '../../repositories/transaction';
import type { AuditService } from '../audit-service';

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
declare const audit: AuditService;
declare const maybeAudit: AuditService | undefined;
declare const untyped: any;
declare const entry: Parameters<AuditService['record']>[1];
declare const stray: Transaction;
`;

const slug = (name: string): string => name.replaceAll(/\W+/g, '-').toLowerCase();

export const fixturePath = (name: string): string => `${FIXTURES_DIRECTORY}/${slug(name)}.ts`;
const companionPath = (name: string): string => `${FIXTURES_DIRECTORY}/${slug(name)}-caller.ts`;

/** The files of every case (and the repository they use) as the in-memory files of the program. */
export function fixtureSources(cases: readonly Case[]): Record<string, string> {
  const sources: Record<string, string> = { [THING_REPOSITORY_PATH]: THING_REPOSITORY };
  for (const { name, code, companion } of cases) {
    sources[fixturePath(name)] = `${PRELUDE}\n${code}\n`;
    if (companion !== undefined) sources[companionPath(name)] = `${PRELUDE}\n${companion(`./${slug(name)}`)}\n`;
  }
  return sources;
}

/** The files a case checks. */
export const filesOf = (root: string, { name, companion }: Case): string[] =>
  [fixturePath(name), ...(companion === undefined ? [] : [companionPath(name)])].map((path) => `${root}${path}`.replaceAll('\\', '/'));

export const PASSING: readonly Case[] = [
  {
    name: 'a record after a repository call, in the .run( callback',
    code: `export async function direct() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await audit.record(tx, entry);
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
        await audit.record(handle, entry);
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
        await audit.record(first, entry);
      });
      await transactions.run(async (second) => {
        await things.add('b', second);
        await audit.record(second, entry);
      });
    }`,
    records: 2,
    findings: [],
  },
  {
    name: 'a repository call written x["m"](tx) and a record written x["record"](tx)',
    code: `export async function bracket() {
      await transactions.run(async (tx) => {
        await things['add']('a', tx);
        await audit['record'](tx, entry);
      });
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'a record on a receiver that may be undefined (audit?.record)',
    code: `export async function optional() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        await maybeAudit?.record(tx, entry);
      });
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'a record that is returned',
    code: `export async function returned() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        return audit.record(tx, entry);
      });
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'a helper called from two callbacks, with a renamed parameter in one',
    code: `async function addThing(name: string, tx: Transaction) {
      await things.add(name, tx);
      await audit.record(tx, entry);
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
      await audit.record(tx, entry);
    };
    export async function helper() {
      await transactions.run((tx) => addThing(tx, 'a'));
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'a repository call in the callback and the record in an awaited helper (the repository call is on the chain)',
    code: `const note = (tx: Transaction) => audit.record(tx, entry);
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
      await audit.record(tx, entry);
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
    name: 'Q6: z.record in a service is not an audit record',
    code: `export const labels = z.record(z.string(), z.string());`,
    records: 0,
    findings: [],
  },
];

/** Forms the check accepts and the headers list as open. A case here is the proof that a pass says no more than the headers say. */
export const OPEN_LIMITS: readonly Case[] = [
  {
    name: 'Q4: an exported helper that another file calls with a kept handle (only the helper\'s own file is followed)',
    code: `export async function addThing(tx: Transaction) {
      await things.add('a', tx);
      await audit.record(tx, entry);
    }
    export async function inside() {
      await transactions.run((tx) => addThing(tx));
    }`,
    companion: (module) => `import { addThing } from '${module}';
    export async function later() {
      let kept: Transaction | undefined;
      await transactions.run(async (tx) => {
        kept = tx;
      });
      if (kept !== undefined) await addThing(kept);
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'Q5: a repository call in a closure that never runs satisfies (b) (GitHub #259)',
    code: `export async function deadClosure() {
      await transactions.run(async (tx) => {
        const never = () => things.add('a', tx);
        await audit.record(tx, entry);
      });
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'a record reached through destructuring is not seen',
    code: `export async function destructured() {
      await transactions.run(async (tx) => {
        const { record } = audit;
        await things.add('a', tx);
        await record(tx, entry);
      });
    }`,
    records: 0,
    findings: [],
  },
  {
    name: 'X1: a record whose error is caught and not rethrown inside the callback passes (QLT-08)',
    code: `export async function swallowed() {
      await transactions.run(async (tx) => {
        await things.add('a', tx);
        try {
          await audit.record(tx, entry);
        } catch {
          // dropped: the change commits without its entry
        }
      });
    }`,
    records: 1,
    findings: [],
  },
  {
    name: 'a record reached through a computed key is not seen',
    code: `export async function computed() {
      await transactions.run(async (tx) => {
        const key = 'rec' + 'ord';
        await things.add('a', tx);
        await audit[key as 'record'](tx, entry);
      });
    }`,
    records: 0,
    findings: [],
  },
];
