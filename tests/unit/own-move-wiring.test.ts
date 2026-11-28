import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * QLT-841-02 (AQP-505, follow-up 840): the hook cases call `ownMoved` by hand and the tree case reads `ownMove`, so nothing else would notice the wiring between them go: the workspace hands the tree's
 * `ownMove` to the form, the form hands it down, and the fields take it only when it is for their own part. A merge that drops one of these (the `<PartForm>` line of `estimate-workspace.tsx` is also edited by the
 * seed work) brings QLT-839-04 back, and a dropped id filter would hand another row's move revision to this form. These read the three files, as the project's other wiring tests do.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const source = (name: string): string => readFileSync(`${ROOT}src/components/features/estimate-workspace/${name}`, 'utf8').replaceAll('\r\n', '\n');
/** The opening tag of a component, from `<Name` to the `>` that ends it (props may span lines; none of them holds a `>` before it ends except arrow functions, which these tags have none of in a prop that matters here). */
const openingTag = (text: string, name: string): string => {
  const start = text.indexOf(`<${name}`);
  expect(start, `<${name}> is rendered`).toBeGreaterThanOrEqual(0);
  return text.slice(start, text.indexOf('/>', start) + 2);
};

describe('QLT-841-02: the tree hands the open part its own move, through the workspace, the form and the fields', () => {
  it('the workspace gives the form the tree\'s ownMove, on the same element that gives it the tree\'s other hand-overs', () => {
    const tag = openingTag(source('estimate-workspace.tsx'), 'PartForm');
    expect(tag).toContain('ownMove={tree.ownMove}');
    // Beside the props this line has always carried, so a resolution of the line that keeps one of them and drops the other is seen.
    expect(tag).toContain('onChanged={tree.readAgain}');
  });

  it('the form hands the fields the ownMove it was given', () => {
    const text = source('part-form.tsx');
    expect(text).toMatch(/export function PartForm\(\{[^}]*\bownMove\b[^}]*\}: PartFormProps\)/);
    expect(openingTag(text, 'Fields')).toContain('ownMove={ownMove}');
  });

  it('the fields take a move only when it is for their own part, and give it to the form\'s ownMoved once per move', () => {
    const text = source('part-fields.tsx');
    expect(text).toMatch(/export function PartFields\(\{[^}]*\bownMove\b[^}]*\}: PartFieldsProps\)/);
    expect(text).toContain('const moved = ownMove?.id === part.id ? ownMove : null;');
    expect(text).toMatch(/useEffect\(\(\) => \{\s*if \(moved !== null\) takeOwnMove\.current\(moved\);\s*\}, \[moved\]\);/);
  });

  it('the move is made in the tree from the direct answer only, with what it was sent with', () => {
    const text = source('use-parts-tree.ts');
    expect(text).toContain('const moved = direct ? answer.nodes.find((node) => node.id === id) : undefined;');
    expect(text).toContain('setOwnMove({ id, sent: revision, revision: moved.revision });');
  });
});
