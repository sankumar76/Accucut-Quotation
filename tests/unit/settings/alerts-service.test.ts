import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FieldValidationError, MailTestFailedError, NO_SENDER_CODE, NotFoundError, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { SENDER_ADDRESS_INVALID, SENDER_ADDRESS_REQUIRED, SENDER_NAME_REQUIRED } from '@/lib/settings/validation';
import { createSettingsService } from '@/server/services/settings-service';

import { failure, fakeSettingsDependencies, type FakeSettingsWorld } from '../../support/fake-settings';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

/**
 * STORY-09.02 at the service, with the settings row, the users and the mail in memory (the SQL and the real transport are tested in `tests/integration/settings/alerts-settings.test.ts`).
 * AC-2 (the four fields, `emailEnabled` from the flag), AC-3 (save, the rules, one info line with no address, no audit), AC-4 (the recipient is the Admin's own address read by ID) and AC-5
 * (the failure codes). Every address is invented (example.com).
 */

const ADMIN = { id: 'admin-1' };
const ADMIN_ADDRESS = 'admin.own@example.com';
const OTHER_ADDRESS = 'someone.else@example.com';

let world: FakeSettingsWorld;
let emailOn = false;
const service = () => createSettingsService({ ...world, emailEnabled: () => emailOn });

const account = (email: string) => ({ id: ADMIN.id, name: 'Invented Admin', email, role: 'ADMIN' as const, isActive: true, sessionVersion: 1, mustChangePassword: false });

beforeEach(() => {
  emailOn = false;
  world = fakeSettingsDependencies({ users: { findAccountById: (id) => Promise.resolve(id === ADMIN.id ? account(ADMIN_ADDRESS) : null) } });
  vi.mocked(logger.info).mockClear();
});

describe('AC-2: reading the alerts', () => {
  it('answers the switch, the sender and whether this server sends e-mail, and nothing else', async () => {
    world.settings.current = { alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' };
    emailOn = true;
    expect(await service().getAlertSettings()).toEqual({ alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com', emailEnabled: true });
  });

  it('a new install is OFF with an empty sender, and emailEnabled follows the flag', async () => {
    expect(await service().getAlertSettings()).toEqual({ alertsEnabled: false, senderName: '', senderAddress: '', emailEnabled: false });
    emailOn = true;
    expect((await service().getAlertSettings()).emailEnabled).toBe(true);
  });
});

describe('AC-3: saving', () => {
  it('saves the three values trimmed and answers the row as saved', async () => {
    const saved = await service().updateAlertSettings({ alertsEnabled: true, senderName: '  Accucut Portal ', senderAddress: ' portal@example.com ' }, ADMIN);
    expect(world.settings.writes).toEqual([{ alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' }]);
    expect(saved).toEqual({ alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com', emailEnabled: false });
  });

  it('refuses a wrong name and a wrong address together, one message per field, and saves nothing', async () => {
    const error = await service()
      .updateAlertSettings({ alertsEnabled: true, senderName: '', senderAddress: 'nope' }, ADMIN)
      .catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ httpStatus: 422, fields: [{ field: 'senderName', message: SENDER_NAME_REQUIRED }, { field: 'senderAddress', message: SENDER_ADDRESS_INVALID }] });
    expect(world.settings.writes).toEqual([]);
  });

  it('turning alerts ON with no sender address is refused; OFF with none is saved', async () => {
    await expect(service().updateAlertSettings({ alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: '' }, ADMIN)).rejects.toMatchObject({
      fields: [{ field: 'senderAddress', message: SENDER_ADDRESS_REQUIRED }],
    });
    expect(world.settings.writes).toEqual([]);
    await service().updateAlertSettings({ alertsEnabled: false, senderName: 'Accucut Portal', senderAddress: '' }, ADMIN);
    expect(world.settings.writes).toHaveLength(1);
  });

  it.each([
    ['name', { senderName: 'Portal\r\nBcc: x@example.com', senderAddress: 'portal@example.com' }],
    ['address', { senderName: 'Portal', senderAddress: 'portal@example.com\r\nBcc: x@example.com' }],
    ['address with a comma', { senderName: 'Portal', senderAddress: 'portal@example.com,x@example.com' }],
  ])('refuses a header-injection attempt in the %s', async (_label, values) => {
    await expect(service().updateAlertSettings({ alertsEnabled: true, ...values }, ADMIN)).rejects.toBeInstanceOf(FieldValidationError);
    expect(world.settings.writes).toEqual([]);
  });

  it('writes one info line, with who and the switch and no name or address (decision D-i), and no other trace', async () => {
    await service().updateAlertSettings({ alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' }, ADMIN);
    expect(logger.info).toHaveBeenCalledTimes(1);
    const [fields, message] = vi.mocked(logger.info).mock.calls[0] ?? [];
    expect(fields).toEqual({ userId: ADMIN.id, alertsEnabled: true });
    expect(JSON.stringify([fields, message])).not.toMatch(/portal@example\.com|Accucut Portal/);
  });

  it('writes no log line for a save that was refused', async () => {
    await service()
      .updateAlertSettings({ alertsEnabled: true, senderName: '', senderAddress: '' }, ADMIN)
      .catch(() => undefined);
    expect(logger.info).not.toHaveBeenCalled();
  });
});

describe('AC-4: the test e-mail', () => {
  beforeEach(() => {
    world.settings.current = { alertsEnabled: false, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' };
  });

  it("goes to the Admin's own address, read by ID, as one direct message, and answers that address", async () => {
    const answer = await service().sendTestEmail(ADMIN.id);
    expect(answer).toEqual({ sentTo: ADMIN_ADDRESS });
    expect(world.fakeMail.sent).toHaveLength(1);
    const [message] = world.fakeMail.sent;
    expect(message?.to).toBe(ADMIN_ADDRESS);
    expect(message?.subject).toMatch(/test e-mail/i);
    expect(message?.bodyText).toMatch(/test e-mail/i);
    expect(message?.bodyHtml).toContain('<');
  });

  it('is sent to nobody but that address, whatever the saved sender says', async () => {
    world.settings.current = { alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: OTHER_ADDRESS };
    await service().sendTestEmail(ADMIN.id);
    expect(world.fakeMail.sent.map((message) => message.to)).toEqual([ADMIN_ADDRESS]);
  });

  it('a person who is not in the database gets 404 and nothing is sent', async () => {
    await expect(service().sendTestEmail('missing')).rejects.toBeInstanceOf(NotFoundError);
    expect(world.fakeMail.sent).toEqual([]);
  });
});

describe('AC-5: failures', () => {
  it.each(['SENDER_NOT_ALLOWED', 'AUTH_FAILED', 'CONNECTION', 'UNKNOWN'] as const)('%s is a 502 that carries the class code and nothing of the server', async (code) => {
    world.fakeMail.result = failure(code);
    const error = await service()
      .sendTestEmail(ADMIN.id)
      .catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(MailTestFailedError);
    expect(error).toMatchObject({ code, httpStatus: 502 });
  });

  it('NO_SENDER is a 422 of its own, because it is the Admin to fix on this page and not the mail server', async () => {
    const error = await service()
      .sendTestEmail(ADMIN.id)
      .catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ code: NO_SENDER_CODE, httpStatus: 422 });
  });
});
