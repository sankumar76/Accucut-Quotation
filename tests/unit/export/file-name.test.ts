import { describe, expect, it } from 'vitest';

import { CUSTOMER_FALLBACK, customerPart, exportFileName, MAX_CUSTOMER_PART } from '@/lib/export/file-name';
import { istIsoDateOf } from '@/lib/time';

const TASK_CODE = 'Q-2026-0001';
/** 14 Nov 2026, 12:00 UTC: 17:30 IST the same day. */
const NOON_UTC = new Date('2026-11-14T12:00:00.000Z');

describe('exportFileName (STORY-07.01 AC-2)', () => {
  it('is Quotation_<Customer>_<TaskId>_<date>.xlsx, with spaces in the customer name as underscores', () => {
    expect(exportFileName({ customerName: 'Acme Tools', taskCode: TASK_CODE, now: NOON_UTC })).toBe('Quotation_Acme_Tools_Q-2026-0001_2026-11-14.xlsx');
  });

  it('drops every other character outside A-Z a-z 0-9 _ - , including quotes, slashes, dots, line breaks and emoji', () => {
    expect(customerPart('Acme & Sons, Ltd.')).toBe('Acme__Sons_Ltd');
    expect(customerPart('a/b\\c"d\r\ne.f')).toBe('abcdef');
    expect(customerPart('Tool 🔧 Works')).toBe('Tool__Works');
    expect(customerPart('Ünïcode Café')).toBe('ncode_Caf');
    expect(customerPart('Keep_these-0K')).toBe('Keep_these-0K');
  });

  it('cuts the customer part to 60 characters', () => {
    const part = customerPart('A'.repeat(200));
    expect(part).toHaveLength(MAX_CUSTOMER_PART);
    expect(customerPart(`${'B '.repeat(100)}`)).toHaveLength(MAX_CUSTOMER_PART);
  });

  it('is "Customer" when nothing is left, or when there is no customer', () => {
    expect(customerPart('🔧🔧')).toBe(CUSTOMER_FALLBACK);
    expect(customerPart('   ')).toBe('___');
    expect(customerPart('')).toBe(CUSTOMER_FALLBACK);
    expect(customerPart(null)).toBe(CUSTOMER_FALLBACK);
    expect(exportFileName({ customerName: '***', taskCode: TASK_CODE, now: NOON_UTC })).toBe('Quotation_Customer_Q-2026-0001_2026-11-14.xlsx');
  });

  it('uses the IST date of the download: 19:00 UTC on the 14th is already the 15th in IST', () => {
    expect(exportFileName({ customerName: 'Acme', taskCode: TASK_CODE, now: new Date('2026-11-14T19:00:00.000Z') })).toContain('_2026-11-15.xlsx');
    expect(exportFileName({ customerName: 'Acme', taskCode: TASK_CODE, now: new Date('2026-11-14T18:29:59.999Z') })).toContain('_2026-11-14.xlsx');
  });

  it('cleans the task code too, so no code can carry a character into a header', () => {
    expect(exportFileName({ customerName: 'Acme', taskCode: 'Q-2026-0001"\r\nX: y', now: NOON_UTC })).toBe('Quotation_Acme_Q-2026-0001Xy_2026-11-14.xlsx');
  });

  it('only ever holds A-Z a-z 0-9 _ - and the one dot of the extension', () => {
    const name = exportFileName({ customerName: '"; filename=evil.exe; \r\n<script>', taskCode: TASK_CODE, now: NOON_UTC });
    expect(name).toMatch(/^[A-Za-z0-9_-]+\.xlsx$/);
  });
});

describe('istIsoDateOf', () => {
  it('reads an instant in IST', () => {
    expect(istIsoDateOf(new Date('2026-12-31T18:29:59.999Z'))).toBe('2026-12-31');
    expect(istIsoDateOf(new Date('2026-12-31T18:30:00.000Z'))).toBe('2027-01-01');
  });

  it('refuses a date that is not one', () => {
    expect(() => istIsoDateOf(new Date(Number.NaN))).toThrow(RangeError);
  });
});
