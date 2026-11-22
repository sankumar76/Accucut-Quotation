import { z } from 'zod';

import { buildTree500 } from '../../support/builders/tree500';
import { completePartInputs } from '../../support/complete-part';

import { call, jsonOf, mustCall, openSession, type Reply, type Session } from './client';
import type { LoadConfig } from './config';
import { FOLDER_PATH, acceptedPicture, addCallsFor, deadlineText, engineerEmail, mapLimit, runMark, taskTitle, wireValues } from './plan';
import type { MasterData } from './seed-masters';

/**
 * The people, tasks and estimates of the load run, made through the public API (test strategy 8.1 and 8.2; STORY-10.09 AC-3, AC-10):
 *   - one invented Engineer, added by the Admin with a first password, who sets their own at the first sign-in (that change is also the first own-password change of AC-2);
 *   - the queue's tasks, assigned to that Engineer;
 *   - estimate A: the `tree500` shape (500 parts, depth 6), every part complete, and calculated by its Engineer (Calculate is the Engineer's own action, STORY-05.09), so the cost reads answer
 *     with figures. The tree, form and cost-details reads of the load go to A, which nothing writes while the load runs;
 *   - estimates B1 to Bn (`LOAD_SAVE_ESTIMATES`, 5): the same shape with empty parts, which the part saves of the load write into, so a save never makes A's costs out of date.
 * Parts are added one call at a time because each add takes the estimate's lock; the two estimates are built side by side.
 */

const CREATED = 201;
const OK = 200;
const NO_CONTENT = 204;
const SEED_CONCURRENCY = 6;
const INPUT_CONCURRENCY = 4;

const idOnly = z.object({ id: z.string().min(1) });
const assigned = z.object({ id: z.string().min(1), estimate: z.object({ id: z.string().min(1) }) });
const added = z.object({ nodeId: z.string().min(1) });
const tree = z.object({ nodes: z.array(z.object({ id: z.string().min(1), revision: z.number().int() })) });

export interface PartRef {
  readonly id: string;
  readonly revision: number;
}

export interface OwnPasswordUser {
  readonly session: Session;
  /** The password the person has now: it changes at every own-password change. */
  current: string;
}

export interface EstimateWorld {
  readonly engineer: OwnPasswordUser;
  readonly estimateA: string;
  readonly partsA: ReadonlyArray<PartRef>;
  /** The estimates the part saves go to. Nothing reads them, so a save never makes the costs of A out of date. */
  readonly saveTargets: ReadonlyArray<{ readonly estimateId: string; readonly parts: ReadonlyArray<PartRef> }>;
}

function parse<T>(what: string, reply: Parameters<typeof jsonOf>[0], schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(jsonOf(reply));
  if (!parsed.success) throw new Error(`${what} answered in a shape the script does not know`);
  return parsed.data;
}

/** The own-password change (architecture section 6 "Change password"): 204, and a fresh session cookie that the session keeps. */
export async function changeOwnPassword(user: OwnPasswordUser, next: string): Promise<Reply> {
  const reply = await call(user.session, 'POST', '/api/v1/account/password', { json: { currentPassword: user.current, newPassword: next } });
  if (reply.status === NO_CONTENT) user.current = next;
  return reply;
}

async function makeEngineer(admin: Session, config: LoadConfig, mark: string): Promise<{ readonly id: string; readonly user: OwnPasswordUser }> {
  const email = engineerEmail(mark);
  const firstPassword = `${config.passwordB}-first`;
  const reply = await mustCall(admin, 'adding the Engineer', 'POST', '/api/v1/users', CREATED, {
    json: { name: 'Load Engineer', email, role: 'ENGINEER', password: firstPassword },
  });
  const { id } = parse('adding the Engineer', reply, idOnly);
  const session = await openSession(config.baseUrl, 'engineer', email, firstPassword);
  const user: OwnPasswordUser = { session, current: firstPassword };
  const change = await changeOwnPassword(user, config.passwordA);
  if (change.status !== NO_CONTENT) throw new Error(`the Engineer's first password change answered HTTP ${change.status}`);
  return { id, user };
}

async function assign(admin: Session, engineerId: string, customerId: string, title: string, deadline: string): Promise<z.infer<typeof assigned>> {
  const reply = await mustCall(admin, 'assigning a task', 'POST', '/api/v1/tasks', CREATED, {
    json: { engineerId, customerId, folderPath: FOLDER_PATH, deadline, title, subject: 'Invented subject', notes: 'Invented notes.' },
  });
  return parse('assigning a task', reply, assigned);
}

async function addParts(admin: Session, estimateId: string, parts: number): Promise<ReadonlyArray<string>> {
  const calls = addCallsFor(buildTree500().nodes.slice(0, parts));
  const ids: string[] = [];
  for (const step of calls) {
    const json = step.kind === 'item' ? { kind: 'item' } : { kind: 'sub-part', nodeId: ids[step.parentIndex] };
    const reply = await mustCall(admin, 'adding a part', 'POST', `/api/v1/estimates/${estimateId}/nodes`, CREATED, { json });
    ids.push(parse('adding a part', reply, added).nodeId);
  }
  return ids;
}

async function partRefs(admin: Session, estimateId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<PartRef>> {
  const reply = await mustCall(admin, 'reading the tree', 'GET', `/api/v1/estimates/${estimateId}/tree`, OK);
  const revisions = new Map(parse('reading the tree', reply, tree).nodes.map((node) => [node.id, node.revision]));
  return ids.map((id) => ({ id, revision: revisions.get(id) ?? 1 }));
}

async function makeEstimate(admin: Session, engineerId: string, customerId: string, config: LoadConfig, title: string): Promise<{ readonly estimateId: string; readonly parts: ReadonlyArray<PartRef> }> {
  const task = await assign(admin, engineerId, customerId, title, deadlineText(new Date()));
  const ids = await addParts(admin, task.estimate.id, config.parts);
  return { estimateId: task.estimate.id, parts: await partRefs(admin, task.estimate.id, ids) };
}

async function completeParts(admin: Session, estimateId: string, parts: ReadonlyArray<PartRef>, materialId: string): Promise<void> {
  const values = wireValues(completePartInputs(undefined, materialId));
  await mapLimit(parts, INPUT_CONCURRENCY, async (part) => {
    await mustCall(admin, 'typing into a part', 'PATCH', `/api/v1/estimates/${estimateId}/nodes/${part.id}/inputs`, OK, { json: { revision: part.revision, values } });
  });
}

/** A picture of 199 KB for each of the first `count` parts, through the public API (a multipart `PUT`, one file named `file`). Done before Calculate: a picture is an input change. */
async function addPictures(admin: Session, estimateId: string, parts: ReadonlyArray<PartRef>, count: number): Promise<void> {
  await mapLimit(parts.slice(0, count), INPUT_CONCURRENCY, async (part, index) => {
    const form = new FormData();
    form.set('file', new Blob([acceptedPicture(index)], { type: 'image/png' }), `part-${index + 1}.png`);
    await mustCall(admin, `adding picture ${index + 1}`, 'PUT', `/api/v1/estimates/${estimateId}/nodes/${part.id}/image`, OK, { form });
  });
}

/** Seeds the queue and the two estimates. The Admin's session is the one that sets everything up; the Engineer's presses Calculate. */
export async function seedEstimates(admin: Session, config: LoadConfig, masters: MasterData): Promise<EstimateWorld> {
  const engineer = await makeEngineer(admin, config, runMark(new Date()));
  const customerId = masters.customers[0]?.id;
  if (customerId === undefined) throw new Error('there is no customer for the estimates');
  const deadline = deadlineText(new Date());
  await mapLimit(Array.from({ length: config.queueTasks }, (_, n) => n + 1), SEED_CONCURRENCY, async (n) => {
    await assign(admin, engineer.id, customerId, taskTitle(n), deadline);
  });
  const [a, ...saves] = await Promise.all([
    makeEstimate(admin, engineer.id, customerId, config, 'Invented estimate A'),
    ...Array.from({ length: config.saveEstimates }, (_, n) => makeEstimate(admin, engineer.id, customerId, config, `Invented estimate B${n + 1}`)),
  ]);
  await completeParts(admin, a.estimateId, a.parts, masters.firstMaterialId);
  await addPictures(admin, a.estimateId, a.parts, config.exportPictures);
  // Typing into a part raises its revision, so A's parts are read again by the load: only the ids are used by the cost reads, and the saves go to B.
  await mustCall(engineer.user.session, 'pressing Calculate', 'POST', `/api/v1/estimates/${a.estimateId}/calculate`, OK);
  return { engineer: engineer.user, estimateA: a.estimateId, partsA: a.parts, saveTargets: saves.map((save) => ({ estimateId: save.estimateId, parts: save.parts })) };
}
