import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuditList } from '@/components/features/audit/audit-list';
import { AUDIT_DESCRIPTION, AUDIT_META_DESCRIPTION, EMPTY_UNFILTERED_DESCRIPTION, EMPTY_UNFILTERED_TITLE } from '@/components/features/audit/texts';
import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { fetchAuditPage, type AuditEntryRow } from '@/lib/audit/audit-client';
import { auditCategoryLabel } from '@/lib/audit/categories';
import { auditPageSchema } from '@/server/views/schemas/audit';
import { AUDIT_EVENTS, auditEventNames, eventsInCategory, NO_DETAIL, type AuditEventName } from '@/server/services/audit-events';
import { createAuditService, type AuditService } from '@/server/services/audit-service';

import { createFakeAuditWorld, type FakeAuditWorld } from '../support/fake-audit';
import { defined } from '../support/defined';

/**
 * STORY-08.07 (AC-1 to AC-5, AC-8): the history of configuration changes is the audit screen with the "Configuration change" category. What is checked
 * here is the registry (every configuration event has its kind, its words and its shapes, and a new one without them fails), the entry the service
 * returns (the kind of the entry, only for a configuration event), the filters over configuration entries (Who, From, To, paging), the page texts,
 * and the list drawn with a 2,000-character formula. The same over a real database is in tests/integration/audit/config-history-database.test.ts.
 * Every name and formula is invented.
 */

const ADMIN_ONE = '00000000-0000-4000-8000-abcdef0000a1';
const ADMIN_TWO = '00000000-0000-4000-8000-abcdef0000a2';
const FIELD = '00000000-0000-4000-8000-abcdef0000f1';
const REQUEST_ID = 'req-0a0b0c0d';

interface Sample {
  readonly before: unknown;
  readonly after: unknown;
  /** The Object of the entry, as the story that writes it words it. */
  readonly object: string;
  /** The Event column. */
  readonly kind: string;
  /** What the screen shows for "Before to after". */
  readonly words: { readonly before: string; readonly after: string };
}

const NEW_INPUT = { letter: 'AY', label: 'Invented Notch Count', kind: 'input', follows: 'AX', formula: null } as const;

/**
 * One valid sample for each configuration event: the table a configuration event must have a row in (AC-1). A new event in the category without a
 * row here fails the first test below, so its words are checked against its story before it ships. The words are the ones of 08.02, 08.03, 08.04 and 08.06.
 */
const SAMPLES: Readonly<Record<string, Sample>> = {
  'config.formula_changed': {
    before: { formula: 'P * Cutting-Rate-per-Sec' },
    after: { formula: 'P * Cutting-Rate-per-Sec * 2', version: 10 },
    object: 'AL Cutting Cost',
    kind: 'Formula edit',
    words: { before: 'P * Cutting-Rate-per-Sec', after: 'P * Cutting-Rate-per-Sec * 2 (configuration version 10)' },
  },
  'config.field_inserted': {
    before: null,
    after: { fields: [NEW_INPUT], moved: [{ from: 'AY', to: 'BO', by: 1 }], version: 10 },
    object: 'AY Invented Notch Count',
    kind: 'Field insert',
    words: { before: 'Not in the worksheet', after: 'Added as AY after AX. Columns AY to BO moved one to the right (configuration version 10)' },
  },
  'config.field_deleted': {
    before: { letter: 'AY', label: 'Invented Notch Cost', kind: 'output', formula: 'AX * 2' },
    after: { moved: [{ from: 'AZ', to: 'BP', by: 1 }], version: 11 },
    object: 'AY Invented Notch Cost',
    kind: 'Field delete',
    words: { before: 'Column AY, Invented Notch Cost, formula AX * 2', after: 'Deleted. Columns AZ to BP moved one to the left (configuration version 11)' },
  },
  'config.reverted': {
    before: { version: 8 },
    after: { version: 9, copiedFrom: 7 },
    object: 'Checkpoint "Before AY insert"',
    kind: 'Checkpoint revert',
    words: { before: 'Version 8', after: 'Version 9 (from version 7)' },
  },
};

const CONFIG_EVENTS = eventsInCategory('config_change');

describe('AC-1: every configuration event shows who, when, the object, the old and the new', () => {
  it('knows the four kinds of change: the formula, the insert, the delete and the revert', () => {
    expect([...CONFIG_EVENTS]).toEqual(['config.formula_changed', 'config.field_inserted', 'config.field_deleted', 'config.reverted']);
    expect(auditCategoryLabel('config_change')).toBe('Configuration change');
  });

  it.each(CONFIG_EVENTS)('%s is wired, has a kind label, a sample of this test, schemas that accept it and words that are not the "no detail" dash', (name) => {
    const definition = AUDIT_EVENTS[name];
    const sample = SAMPLES[name];
    expect(definition.status).toBe('wired');
    expect(definition.kindLabel, `${name} has no kindLabel`).toEqual(expect.any(String));
    expect(definition.kindLabel?.trim(), `${name} has an empty kindLabel`).not.toBe('');
    expect(sample, `${name} has no sample in config-history.test.ts: add the row, with the words of its story`).toBeDefined();
    expect(definition.before.safeParse(sample?.before).success, `${name} before`).toBe(true);
    expect(definition.after.safeParse(sample?.after).success, `${name} after`).toBe(true);
    const words = definition.describeStored(sample?.before, sample?.after);
    expect(words, `${name} words`).not.toBeNull();
    expect(words?.before.trim(), `${name} before words`).not.toBe('');
    expect(words?.after.trim(), `${name} after words`).not.toBe('');
    expect(words).not.toEqual(NO_DETAIL);
    expect(words?.before).not.toBe(NO_DETAIL.before);
    expect(words?.after).not.toBe(NO_DETAIL.after);
  });

  it('gives each kind its own label, so the Event column tells the kinds apart', () => {
    const labels = CONFIG_EVENTS.map((name) => AUDIT_EVENTS[name].kindLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(Object.entries(SAMPLES))('%s: the kind, the old and the new are the words of its story', (name, sample) => {
    expect(auditEventNames()).toContain(name);
    const definition = AUDIT_EVENTS[name as AuditEventName];
    expect(definition.kindLabel).toBe(sample.kind);
    expect(definition.describeStored(sample.before, sample.after)).toEqual(sample.words);
  });

  it('an event outside the category may have no kind label: the Event column then shows its category', () => {
    const others = auditEventNames().filter((name) => AUDIT_EVENTS[name].category !== 'config_change');
    expect(others.length).toBeGreaterThan(0);
    for (const name of others) expect(AUDIT_EVENTS[name].kindLabel, name).toBeUndefined();
  });
});

describe('AC-2, AC-4: the entry carries its kind, for configuration entries only', () => {
  let world: FakeAuditWorld;
  let service: AuditService;

  beforeEach(() => {
    world = createFakeAuditWorld();
    service = createAuditService({ audit: world.audit });
  });

  async function record(event: AuditEventName, actorId = ADMIN_ONE): Promise<void> {
    const sample = defined(SAMPLES[event]);
    await world.transactions.run((tx) =>
      // The call is checked against the event's own schemas at run time; the sample is the table above.
      service.record(tx, { event, actorId, actorLabel: 'Invented Admin', requestId: REQUEST_ID, object: { id: FIELD, label: sample.object }, before: sample.before, after: sample.after } as never),
    );
  }

  it('lists each kind of configuration entry with its kind, its object and its old to new, in the category "Configuration change"', async () => {
    for (const name of CONFIG_EVENTS) await record(name);
    const page = await service.list({ limit: 50, category: 'config_change' });
    expect(page.total).toBe(CONFIG_EVENTS.length);
    for (const entry of page.entries) {
      const sample = defined(SAMPLES[entry.event]);
      expect(entry).toMatchObject({ kindLabel: sample.kind, category: { id: 'config_change', label: 'Configuration change' }, objectLabel: sample.object, who: 'Invented Admin', change: sample.words });
    }
  });

  it('shows a revert as "Version 8 to Version 9 (from version 7)", the object being the checkpoint or, for an undo, the version', async () => {
    await record('config.reverted');
    await world.transactions.run((tx) =>
      service.record(tx, { event: 'config.reverted', actorId: ADMIN_ONE, actorLabel: 'Invented Admin', requestId: REQUEST_ID, object: { id: FIELD, label: 'Version 8' }, before: { version: 10 }, after: { version: 11, copiedFrom: 8 } }),
    );
    const [undo, checkpoint] = (await service.list({ limit: 50, event: 'config.reverted' })).entries;
    expect(checkpoint).toMatchObject({ objectLabel: 'Checkpoint "Before AY insert"', change: { before: 'Version 8', after: 'Version 9 (from version 7)' } });
    expect(undo).toMatchObject({ objectLabel: 'Version 8', change: { before: 'Version 10', after: 'Version 11 (from version 8)' } });
  });

  it('leaves the kind out of every entry that is not a configuration entry: the Event column shows its category', async () => {
    world.clock.set(new Date('2026-11-05T09:00:00.000Z'));
    await world.transactions.run((tx) =>
      service.record(tx, { event: 'user.deactivated', actorId: ADMIN_ONE, actorLabel: 'Invented Admin', requestId: REQUEST_ID, object: { id: FIELD, label: 'Invented Person' }, before: { isActive: true }, after: { isActive: false } }),
    );
    const [entry] = (await service.list({ limit: 50 })).entries;
    expect(entry).toMatchObject({ event: 'user.deactivated', category: { id: 'user_change', label: 'User change' } });
    expect(entry).not.toHaveProperty('kindLabel');
  });

  it('keeps the answer strict: the schema takes the kind and refuses any other new key', async () => {
    for (const name of CONFIG_EVENTS) await record(name);
    const page = await service.list({ limit: 50 });
    expect(auditPageSchema.safeParse(page).success).toBe(true);
    const withExtra = { ...page, entries: page.entries.map((entry) => ({ ...entry, before: { formula: 'P' } })) };
    expect(auditPageSchema.safeParse(withExtra).success).toBe(false);
  });
});

describe('AC-3: configuration entries filtered by Who, From and To, and paged', () => {
  let world: FakeAuditWorld;
  let service: AuditService;

  beforeEach(() => {
    world = createFakeAuditWorld();
    service = createAuditService({ audit: world.audit });
  });

  async function formulaChange(at: string, actorId: string, label: string): Promise<void> {
    world.clock.set(new Date(at));
    await world.transactions.run((tx) =>
      service.record(tx, {
        event: 'config.formula_changed',
        actorId,
        actorLabel: actorId === ADMIN_ONE ? 'Invented Admin One' : 'Invented Admin Two',
        requestId: REQUEST_ID,
        object: { id: FIELD, label },
        before: { formula: 'P' },
        after: { formula: 'P * 2', version: 3 },
      }),
    );
  }

  async function approvalNoise(at: string): Promise<void> {
    world.clock.set(new Date(at));
    await world.transactions.run((tx) =>
      service.record(tx, { event: 'user.deactivated', actorId: ADMIN_ONE, actorLabel: 'Invented Admin One', requestId: REQUEST_ID, object: { id: FIELD, label: 'Invented Person' }, before: { isActive: true }, after: { isActive: false } }),
    );
  }

  const labels = (page: { readonly entries: ReadonlyArray<{ readonly objectLabel: string }> }): string[] => page.entries.map((entry) => entry.objectLabel);

  beforeEach(async () => {
    // IST days: 23:30 IST on the 4th is 18:00 UTC on the 4th; 00:01 IST on the 5th is 18:31 UTC on the 4th; 11:30 IST on the 6th is 06:00 UTC.
    await formulaChange('2026-11-03T06:00:00.000Z', ADMIN_ONE, 'Day3 One');
    await formulaChange('2026-11-04T18:00:00.000Z', ADMIN_TWO, 'Day4 late');
    await formulaChange('2026-11-04T18:31:00.000Z', ADMIN_ONE, 'Day5 early');
    await formulaChange('2026-11-06T06:00:00.000Z', ADMIN_TWO, 'Day6 Two');
    await approvalNoise('2026-11-04T06:00:00.000Z');
  });

  it('the category lists only configuration entries, of every Admin', async () => {
    const page = await service.list({ limit: 50, category: 'config_change' });
    expect(labels(page)).toEqual(['Day6 Two', 'Day5 early', 'Day4 late', 'Day3 One']);
    expect(page.total).toBe(4);
  });

  it('combined with Who, it finds the person by ID', async () => {
    expect(labels(await service.list({ limit: 50, category: 'config_change', who: ADMIN_TWO }))).toEqual(['Day6 Two', 'Day4 late']);
    expect(labels(await service.list({ limit: 50, category: 'config_change', who: ADMIN_ONE }))).toEqual(['Day5 early', 'Day3 One']);
  });

  it('combined with From and To, the day boundaries are the IST ones: an entry at 23:30 IST on the 4th is on the 4th, and 00:01 IST is on the 5th', async () => {
    expect(labels(await service.list({ limit: 50, category: 'config_change', from: '2026-11-04', to: '2026-11-04' }))).toEqual(['Day4 late']);
    expect(labels(await service.list({ limit: 50, category: 'config_change', from: '2026-11-05', to: '2026-11-05' }))).toEqual(['Day5 early']);
    expect(labels(await service.list({ limit: 50, category: 'config_change', from: '2026-11-04' }))).toEqual(['Day6 Two', 'Day5 early', 'Day4 late']);
    expect(labels(await service.list({ limit: 50, category: 'config_change', to: '2026-11-04' }))).toEqual(['Day4 late', 'Day3 One']);
  });

  it('combined with Who, From and To, only the matching entries return; none matching is an empty page with a total of zero', async () => {
    expect(labels(await service.list({ limit: 50, category: 'config_change', who: ADMIN_TWO, from: '2026-11-05' }))).toEqual(['Day6 Two']);
    expect(await service.list({ limit: 50, category: 'config_change', who: ADMIN_ONE, from: '2026-11-06' })).toEqual({ entries: [], total: 0, nextCursor: null });
  });

  it('pages 120 configuration entries by cursor with no gap, no repeat and a total that stays whole', async () => {
    const many = createFakeAuditWorld();
    const manyService = createAuditService({ audit: many.audit });
    many.clock.set(new Date('2026-11-10T06:00:00.000Z'));
    for (let index = 0; index < 120; index += 1) {
      await many.transactions.run((tx) =>
        manyService.record(tx, { event: 'config.formula_changed', actorId: ADMIN_ONE, actorLabel: 'Invented Admin One', requestId: REQUEST_ID, object: { id: FIELD, label: `Entry ${String(index)}` }, before: { formula: 'P' }, after: { formula: 'P * 2', version: index + 2 } }),
      );
    }
    const seen: string[] = [];
    let cursor: Awaited<ReturnType<AuditService['list']>>['nextCursor'] = null;
    let pages = 0;
    const { decodeAuditCursor } = await import('@/server/services/audit-cursor');
    do {
      const decoded = cursor === null ? undefined : (decodeAuditCursor(cursor) ?? undefined);
      const page = await manyService.list({ limit: 50, category: 'config_change', cursor: decoded });
      pages += 1;
      expect(page.total).toBe(120);
      seen.push(...labels(page));
      cursor = page.nextCursor;
    } while (cursor !== null && pages < 10);
    expect(pages).toBe(3);
    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
  });
});

describe('AC-5: the page text', () => {
  it('lists configuration changes in the description, and says no more than SCR-16 says', () => {
    expect(AUDIT_DESCRIPTION).toBe(
      'A record of approvals, unlocks, price overrides, cancelled approvals, removed prices, quantity warnings gone ahead on, master data, user, task and configuration changes. The portal has no way to edit or delete an entry.',
    );
  });

  it('leaves the page meta description and the "No entries yet" text as they were', () => {
    expect(AUDIT_META_DESCRIPTION).toBe('A record of approvals, unlocks, price overrides, master data and user changes.');
    expect(EMPTY_UNFILTERED_TITLE).toBe('No entries yet');
    expect(EMPTY_UNFILTERED_DESCRIPTION).toBe('Changes to users, masters and approvals are recorded here as they happen.');
  });
});

describe('AC-2: the browser reads the kind', () => {
  const ENTRY = {
    id: '10000000-0000-4000-8000-000000000001',
    createdAt: '2026-11-05T09:00:00.000Z',
    who: 'Invented Admin',
    event: 'config.formula_changed',
    category: { id: 'config_change', label: 'Configuration change' },
    objectLabel: 'AL Cutting Cost',
    change: { before: 'P', after: 'P * 2 (configuration version 3)' },
  };

  async function read(entry: unknown) {
    const outcome = await fetchAuditPage({ who: '', category: '', from: '', to: '' }, undefined, () =>
      Promise.resolve(new Response(JSON.stringify({ entries: [entry], total: 1, nextCursor: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    );
    return outcome.status === 'ok' ? outcome.value.entries[0] : undefined;
  }

  it('keeps the kind of an entry that has one', async () => {
    expect(await read({ ...ENTRY, kindLabel: 'Formula edit' })).toEqual({ ...ENTRY, kindLabel: 'Formula edit' });
  });

  it('reads an entry with no kind as before, and refuses a kind that is not text (a broken answer is a failure, not an empty list)', async () => {
    expect(await read(ENTRY)).toEqual(ENTRY);
    expect(await read({ ...ENTRY, kindLabel: 7 })).toBeUndefined();
  });
});

describe('AC-2, AC-4, AC-8: the list draws the kind, the revert words and a 2,000-character formula', () => {
  const LONG_FORMULA = `P * ${'Invented-Rate '.repeat(150)}`.trim().slice(0, 2_000);
  const configEntry: AuditEntryRow = {
    id: '10000000-0000-4000-8000-000000000001',
    createdAt: '2026-11-05T09:00:00.000Z',
    who: 'Invented Admin',
    event: 'config.formula_changed',
    category: { id: 'config_change', label: 'Configuration change' },
    kindLabel: 'Formula edit',
    objectLabel: 'AL Cutting Cost',
    change: { before: LONG_FORMULA, after: `${LONG_FORMULA} * 2 (configuration version 3)` },
  };
  const revertEntry: AuditEntryRow = {
    id: '10000000-0000-4000-8000-000000000002',
    createdAt: '2026-11-05T09:05:00.000Z',
    who: 'Invented Admin',
    event: 'config.reverted',
    category: { id: 'config_change', label: 'Configuration change' },
    kindLabel: 'Checkpoint revert',
    objectLabel: 'Checkpoint "Before AY insert"',
    change: { before: 'Version 8', after: 'Version 9 (from version 7)' },
  };
  const userEntry: AuditEntryRow = {
    id: '10000000-0000-4000-8000-000000000003',
    createdAt: '2026-11-05T09:10:00.000Z',
    who: 'Invented Admin',
    event: 'user.created',
    category: { id: 'user_change', label: 'User change' },
    objectLabel: 'Invented Person',
    change: { before: 'Not added', after: 'Added as Engineer' },
  };

  function html(entries: ReadonlyArray<AuditEntryRow>): string {
    return renderToStaticMarkup(createElement(AuditList, { entries, total: entries.length, hasMore: false, loadingMore: false, onShowMore: () => undefined, footerRef: null }));
  }

  /** The table and the card list of the markup, which are drawn from the same entries. */
  function parts(markup: string): { readonly table: string; readonly cards: string } {
    const cardsAt = markup.indexOf('<ul');
    return { table: markup.slice(0, cardsAt), cards: markup.slice(cardsAt) };
  }

  it('shows the kind in the Event column of the table and on the phone card, and the category for every other entry', () => {
    const { table, cards } = parts(html([configEntry, revertEntry, userEntry]));
    for (const part of [table, cards]) {
      expect(part).toContain('Formula edit');
      expect(part).toContain('Checkpoint revert');
      expect(part).toContain('User change');
      expect(part).not.toContain('>Configuration change<');
    }
  });

  it('reads a revert as Version 8, an arrow icon with the screen-reader word "to", then Version 9 (from version 7)', () => {
    const { table, cards } = parts(html([revertEntry]));
    for (const part of [table, cards]) {
      expect(part).toContain('Checkpoint &quot;Before AY insert&quot;');
      expect(part).toMatch(/Version 8 <svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg><span class="sr-only"> to <\/span> Version 9 \(from version 7\)/);
    }
  });

  it('lets the before and after text of a 2,000-character formula wrap, in the table and on the card (no sideways scroll of the page)', () => {
    expect(LONG_FORMULA).toHaveLength(2_000);
    const { table, cards } = parts(html([configEntry]));
    for (const part of [table, cards]) {
      expect(part).toContain(LONG_FORMULA);
      // The cell or the block that holds the old and the new carries the wrapping class.
      const around = part.slice(Math.max(0, part.indexOf(LONG_FORMULA) - 400), part.indexOf(LONG_FORMULA));
      expect(around).toContain(BREAK_LONG_NAMES);
    }
    // The table stays inside its own focusable, named region.
    expect(table).toMatch(/role="region"[^>]*aria-label="Audit log, newest first, scrollable"[^>]*tabindex="0"|tabindex="0"[^>]*role="region"/);
  });

  it('has no control that edits or deletes an entry: the only button is "Show more entries", and only when there is more', () => {
    const markup = renderToStaticMarkup(createElement(AuditList, { entries: [configEntry, revertEntry], total: 9, hasMore: true, loadingMore: false, onShowMore: () => undefined, footerRef: null }));
    expect([...markup.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((match) => match[1])).toEqual(['Show more entries']);
    expect(markup).not.toMatch(/<a |<input|<form|contenteditable/i);
  });
});
