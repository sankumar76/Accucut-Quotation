import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PartPicture, type PartPictureProps } from '@/components/features/estimate-workspace/part-picture';
import { REMOVE } from '@/components/features/estimate-workspace/picture-texts';
import type { Outcome } from '@/lib/api-client';
import type { PartPictureAnswer } from '@/lib/estimates/picture-client';

import { renderHook } from '../support/hook-harness';

// The control runs with no DOM: React's hooks are the harness's (`tests/support/hook-harness.ts`), and the server's answers are the test's own.
vi.mock('react', async () => (await import('../support/hook-harness')).reactHooks);

const calls = vi.hoisted(() => ({ send: vi.fn(), drop: vi.fn() }));
vi.mock('@/lib/estimates/picture-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/estimates/picture-client')>();
  return { ...original, sendPicture: (...args: unknown[]) => calls.send(...args) as unknown, dropPicture: (...args: unknown[]) => calls.drop(...args) as unknown };
});

/**
 * QLT-839-08 (follow-up #840): `change()` in `part-picture.tsx` tells the form whether THIS request changed the picture (`changed`), and the form takes the answer's revision only then (QLT-839-01). The form's
 * own cases hand `changed` in by hand, so a mutant `onChanged(result, true)` would pass them and bring the DEF-148 silent overwrite back. This pins the line itself: the control is run with an invented server,
 * and the `changed` it hands to `onChanged` is read for the same picture sent again (false), for another picture (true), for a first picture (true) and for a removal (true). Invented ids and files only.
 */

const PICTURE_ID = '00000000-0000-4000-8000-0000000000a1';
const OTHER_ID = '00000000-0000-4000-8000-0000000000a2';
const held = { id: PICTURE_ID, fileName: 'invented.gif', sizeBytes: 14 };

/** The smallest GIF the content rule accepts: the header, a screen descriptor and the trailer. */
const GIF_BYTES = Uint8Array.from([...Array.from('GIF89a', (character) => character.charCodeAt(0)), 1, 0, 1, 0, 0, 0, 0, 0x3b]);
const gif = (): File => new File([GIF_BYTES], 'invented.gif', { type: 'image/gif' });

const answer = (pictureId: string | null): Outcome<PartPictureAnswer> => ({
  status: 'ok',
  value: { id: 'part-1', revision: 2, completeness: 'PARTIAL', picture: pictureId === null ? null : { id: pictureId, fileName: 'invented.gif', sizeBytes: 14 } },
});

interface Node {
  readonly type?: unknown;
  readonly props?: { readonly children?: unknown; readonly onChange?: (event: unknown) => void; readonly onClick?: () => void; readonly type?: string };
}

/** The first element of the control's tree for which `matches` is true (the tree is what the component returned: objects, arrays and strings). */
function find(tree: unknown, matches: (node: Node) => boolean): Node | undefined {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = find(child, matches);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof tree !== 'object' || tree === null) return undefined;
  const node = tree as Node;
  if (matches(node)) return node;
  return find(node.props?.children, matches);
}

function openControl(picture: unknown, inTurn: PartPictureProps['inTurn'] = (job) => job()) {
  const onChanged = vi.fn();
  const props: PartPictureProps = {
    field: { id: 'part-model', letter: 'C', label: 'Part Model', kind: 'input', hint: null },
    estimateId: 'e1',
    partId: 'part-1',
    picture,
    editable: true,
    inTurn,
    onChanged,
    onConflict: () => undefined,
    onServerIgnored: () => undefined,
  };
  // `PartPicture` only chooses the control and its key; the control itself is the element's type.
  const element = PartPicture(props) as unknown as { type: (properties: unknown) => unknown; props: unknown };
  const hook = renderHook(element.type, element.props);
  return { onChanged, tree: () => hook.render() };
}

beforeEach(() => {
  calls.send.mockReset();
  calls.drop.mockReset();
  vi.stubGlobal('document', { addEventListener: () => undefined, removeEventListener: () => undefined });
});

describe('QLT-839-08: the control tells the form whether this request changed the picture', () => {
  it('the same picture sent again (the server answers the picture it already holds): changed is false', async () => {
    calls.send.mockResolvedValue(answer(PICTURE_ID));
    const { onChanged, tree } = openControl(held);
    const input = find(tree(), (node) => node.type === 'input' && node.props?.type === 'file');
    input?.props?.onChange?.({ target: { files: [gif()], value: '' } });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(onChanged.mock.calls[0]?.[1]).toBe(false);
  });

  it('another picture instead of the one held: changed is true', async () => {
    calls.send.mockResolvedValue(answer(OTHER_ID));
    const { onChanged, tree } = openControl(held);
    const input = find(tree(), (node) => node.type === 'input' && node.props?.type === 'file');
    input?.props?.onChange?.({ target: { files: [gif()], value: '' } });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(onChanged.mock.calls[0]?.[1]).toBe(true);
  });

  it('a first picture on a part that had none: changed is true', async () => {
    calls.send.mockResolvedValue(answer(OTHER_ID));
    const { onChanged, tree } = openControl(null);
    const input = find(tree(), (node) => node.type === 'input' && node.props?.type === 'file');
    input?.props?.onChange?.({ target: { files: [gif()], value: '' } });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(onChanged.mock.calls[0]?.[1]).toBe(true);
  });

  it('a removal (the part has no picture afterwards): changed is true', async () => {
    calls.drop.mockResolvedValue(answer(null));
    const { onChanged, tree } = openControl(held);
    const remove = find(tree(), (node) => node.props?.children === REMOVE && node.props?.onClick !== undefined);
    remove?.props?.onClick?.();
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(onChanged.mock.calls[0]?.[1]).toBe(true);
  });
});

describe('QLT-839-03: the form is told of the picture inside the turn, before the next queued save may start', () => {
  it('a job queued behind the picture change starts after onChanged has been called, so a save queued while the picture was uploading is sent with the new revision', async () => {
    calls.send.mockResolvedValue(answer(OTHER_ID));
    // The form's own queue, as `usePartValues.inTurn` keeps it: each job starts when the one before it has ended.
    let queue: Promise<void> = Promise.resolve();
    const inTurn: PartPictureProps['inTurn'] = (job) => {
      const turn = queue.then(job);
      queue = turn.then(
        () => undefined,
        () => undefined,
      );
      return turn;
    };
    const order: string[] = [];
    const { onChanged, tree } = openControl(held, inTurn);
    onChanged.mockImplementation(() => order.push('the form is told'));
    const input = find(tree(), (node) => node.type === 'input' && node.props?.type === 'file');
    input?.props?.onChange?.({ target: { files: [gif()], value: '' } });
    // A save of a value, queued while the picture is on its way.
    const next = inTurn(async () => {
      order.push('the next save starts');
    });
    await next;
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['the form is told', 'the next save starts']);
  });
});
