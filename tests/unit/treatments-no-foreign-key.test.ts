import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * STORY-05.06 AC-4 (architecture section 5.1 "A treatment on an estimate", QLT-09): no table refers to `treatments` by a foreign key, in the Prisma schema or in any migration, so a delete of a
 * treatment never fails on a reference and never reaches the Admin as a 500: an estimate keeps the treatment's words. A story that wants such a key comes back to the architect first. The same
 * is read from the database itself in `tests/integration/estimates/treatment.test.ts`; this one needs no database and holds the source.
 */

const ROOT = join(__dirname, '..', '..', 'prisma');

describe('no foreign key references treatments', () => {
  it('the Prisma schema has no relation to the Treatment model and the model has none to another', () => {
    const schema = readFileSync(join(ROOT, 'schema.prisma'), 'utf8');
    const model = /model Treatment \{[^}]*\}/.exec(schema)?.[0] ?? '';
    expect(model).not.toBe('');
    expect(model).not.toMatch(/@relation|\bTreatment\[\]/);
    expect(schema.replace(model, '')).not.toMatch(/\bTreatment\b\??\s+@relation|\bTreatment\??\s*$/m);
  });

  it('no migration declares a REFERENCES "treatments" clause', () => {
    const folders = readdirSync(join(ROOT, 'migrations'), { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(folders.length).toBeGreaterThan(0);
    for (const folder of folders) {
      const sql = readFileSync(join(ROOT, 'migrations', folder.name, 'migration.sql'), 'utf8');
      // A comment may name the table; a clause that makes a key does not appear outside one.
      const code = sql.replace(/--.*$/gm, '');
      expect(code, folder.name).not.toMatch(/REFERENCES\s+"?(public"?\."?)?treatments"?/i);
    }
  });
});
