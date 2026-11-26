import type { Outcome } from '@/lib/api-client';
import type { PartInputs, SaveInputsRequest } from '@/lib/estimates/form-client';

/**
 * An invented server for one part, for the tests of `usePartValues`: it answers the read of the part and the save of values as the real routes do (a stale revision is 409 PART_CHANGED, a real change raises
 * the revision, a blank removes the value), keeps every save it was sent, and can hold the next save until the test lets it go, so a test can type while a save is in flight. Invented ids and values only.
 */

export const PART_ID = '00000000-0000-4000-8000-0000000000f1';

export interface SentSave {
  readonly revision: number;
  readonly values: Readonly<Record<string, string>>;
}

const state = {
  revision: 1,
  inputs: {} as Record<string, string>,
  sent: [] as SentSave[],
  /** For each save in `sent`, in order: was it asked to survive the page going away (`keepalive`)? */
  keepalive: [] as boolean[],
  hold: null as Promise<void> | null,
  /** The number (1 is the first save since `reset`) of the save that waits for `hold`, or 0 for the next one. */
  holdAt: 0,
  failNext: false,
  failAfterHold: false,
  refuseNext: false,
  ignoredNext: false,
  churn: false,
};

const view = (): PartInputs => ({ id: PART_ID, revision: state.revision, completeness: 'PARTIAL', inputs: { ...state.inputs }, picture: undefined });

export const partServer = {
  /** Starts again with this part: revision 1, these values, nothing sent. */
  reset(inputs: Record<string, string>): void {
    state.revision = 1;
    state.inputs = { ...inputs };
    state.sent = [];
    state.keepalive = [];
    state.hold = null;
    state.holdAt = 0;
    state.failNext = false;
    state.failAfterHold = false;
    state.refuseNext = false;
    state.ignoredNext = false;
    state.churn = false;
  },
  /** The nth save since `reset` (1 is the first) waits until the returned function is called. */
  holdSaveNumber(number: number): () => void {
    const release = this.holdNextSave();
    state.holdAt = number;
    return release;
  },
  /** The next save is lost on the way, as a dropped connection loses it: no answer came. */
  failNextSave(): void {
    state.failNext = true;
  },
  /** The next held save reaches the server and is lost when it is let go, as a dropped connection loses it: it was sent, and no answer came. */
  failAfterHold(): void {
    state.failAfterHold = true;
  },
  /** The next save is refused by the server's own rule (422) for the field it carries, though the text passed the screen's rule. */
  refuseNextSave(): void {
    state.refuseNext = true;
  },
  /** The next save is refused 409 `ESTIMATE_IGNORED`: a Lead or an Admin ignored the estimate while the person worked (CR-01 item 7D). Nothing is stored. */
  ignoreNextSave(): void {
    state.ignoredNext = true;
  },
  /** While on, somebody else saves just before every save of this tab arrives, so every save is refused with 409. */
  churn(on: boolean): void {
    state.churn = on;
  },
  /** Somebody else (another tab) saved these values: the part moves on a revision. */
  changeElsewhere(values: Record<string, string>): void {
    state.inputs = { ...state.inputs, ...values };
    state.revision += 1;
  },
  /** The next save waits until the returned function is called. */
  holdNextSave(): () => void {
    let release: () => void = () => undefined;
    state.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  },
  get sent(): ReadonlyArray<SentSave> {
    return state.sent;
  },
  get keepalive(): ReadonlyArray<boolean> {
    return state.keepalive;
  },
  get inputs(): Readonly<Record<string, string>> {
    return state.inputs;
  },
  get revision(): number {
    return state.revision;
  },
  load: (): Promise<Outcome<PartInputs>> => Promise.resolve({ status: 'ok', value: view() }),
  async save(_estimateId: string, _nodeId: string, request: SaveInputsRequest, _doFetch?: unknown, keepalive = false): Promise<Outcome<PartInputs>> {
    state.sent.push({ revision: request.revision, values: { ...request.values } });
    state.keepalive.push(keepalive);
    if (state.failNext) {
      state.failNext = false;
      return { status: 'failed' };
    }
    if (state.ignoredNext) {
      state.ignoredNext = false;
      return { status: 'refused', httpStatus: 409, code: 'ESTIMATE_IGNORED', title: 'This estimate is ignored. Restore it first.', fields: {}, body: {} };
    }
    if (state.refuseNext) {
      state.refuseNext = false;
      const fieldId = Object.keys(request.values)[0] ?? '';
      return { status: 'refused', httpStatus: 422, code: 'VALIDATION_FAILED', title: 'A value is not accepted.', fields: { [fieldId]: 'The server does not accept this value.' }, body: {} };
    }
    const waits = state.hold !== null && (state.holdAt === 0 || state.holdAt === state.sent.length);
    const held = waits ? state.hold : null;
    if (waits) {
      state.hold = null;
      state.holdAt = 0;
    }
    if (held !== null) await held;
    if (held !== null && state.failAfterHold) {
      state.failAfterHold = false;
      return { status: 'failed' };
    }
    if (state.churn) {
      state.inputs = { ...state.inputs, c: '1.00' };
      state.revision += 1;
    }
    if (request.revision !== state.revision) {
      return { status: 'refused', httpStatus: 409, code: 'PART_CHANGED', title: 'This part was changed by someone else.', fields: {}, body: {} };
    }
    const next = { ...state.inputs };
    for (const [fieldId, value] of Object.entries(request.values)) {
      if (value === '') delete next[fieldId];
      else next[fieldId] = value;
    }
    const changed = JSON.stringify(next) !== JSON.stringify(state.inputs);
    state.inputs = next;
    if (changed) state.revision += 1;
    return { status: 'ok', value: view() };
  },
};
