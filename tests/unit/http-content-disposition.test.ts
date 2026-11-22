import { describe, expect, it } from 'vitest';

import { exportFileName } from '@/lib/export/file-name';
import { attachmentDisposition } from '@/server/http/content-disposition';
import { fileResponse } from '@/server/http/file-response';

/**
 * The header that names a downloaded file (CR-01 item 9, AQP-391 AC-5, AC-9; RFC 6266 with RFC 8187): an ASCII `filename=` for old clients and a percent-encoded `filename*=UTF-8''` for the real name.
 * The name reaches the header from a text a person typed, so a hostile name must not be able to add a quote, a semicolon, a line break or another header. Every value is invented.
 */

const NOON_UTC = new Date('2026-11-21T12:00:00.000Z');
const nameOf = (customerShortName: string | null, subject: string | null): string => exportFileName({ customerShortName, subject, taskCode: 'Q-2026-0001', now: NOON_UTC });

describe('attachmentDisposition', () => {
  it('writes an ASCII-only name as the same name twice, plain and encoded', () => {
    expect(attachmentDisposition('MAS_Feed-hopper_21-11-2026.xlsx')).toBe(`attachment; filename="MAS_Feed-hopper_21-11-2026.xlsx"; filename*=UTF-8''MAS_Feed-hopper_21-11-2026.xlsx`);
  });

  it('keeps only A-Z a-z 0-9 . _ - in the ASCII fallback, and percent-encodes the UTF-8 bytes of the real name', () => {
    const header = attachmentDisposition(nameOf('MAS', 'Kühler Ø 40 – 工场'));
    expect(header).toBe(
      'attachment; filename="MAS_Khler--40--_21-11-2026.xlsx"; ' +
        "filename*=UTF-8''MAS_K%C3%BChler-%C3%98-40-%E2%80%93-%E5%B7%A5%E5%9C%BA_21-11-2026.xlsx",
    );
  });

  it('encodes a character outside the BMP as its four UTF-8 bytes', () => {
    expect(attachmentDisposition('M_🔧_21-11-2026.xlsx')).toContain("filename*=UTF-8''M_%F0%9F%94%A7_21-11-2026.xlsx");
  });

  it('decodes back to the name it was given', () => {
    const name = nameOf('MAS', 'Kühler Ø 40 – 工场 🔧');
    const encoded = /filename\*=UTF-8''([^;]+)$/.exec(attachmentDisposition(name))?.[1] ?? '';
    expect(decodeURIComponent(encoded)).toBe(name);
  });

  it('gives a plain name when the whole stem is outside the ASCII set', () => {
    expect(attachmentDisposition('工场.xlsx')).toBe(`attachment; filename="download.xlsx"; filename*=UTF-8''%E5%B7%A5%E5%9C%BA.xlsx`);
  });

  it('encodes a semicolon, a percent sign and an apostrophe, and leaves them out of the ASCII fallback', () => {
    expect(attachmentDisposition("M_a;b%c'd_21-11-2026.xlsx")).toBe(`attachment; filename="M_abcd_21-11-2026.xlsx"; filename*=UTF-8''M_a%3Bb%25c%27d_21-11-2026.xlsx`);
  });

  it('has exactly two parameters and no character that could end one early, whatever the typed text', () => {
    const header = attachmentDisposition(nameOf('MAS"\r\n', 'a"\r\nX-Injected: y; filename=evil.exe\\\'()*%'));
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.split(';')).toHaveLength(3);
    expect(header).toMatch(/^attachment; filename="[A-Za-z0-9._-]+\.xlsx"; filename\*=UTF-8''[A-Za-z0-9._%-]+\.xlsx$/);
  });

  it.each([
    ['a quote', 'a"b.xlsx'],
    ['a line break', 'a\r\nX: y.xlsx'],
    ['a NUL', 'a\u0000b.xlsx'],
    ['a bidirectional override', 'a‮b.xlsx'],
    ['a path', '../a.xlsx'],
    ['another extension', 'a.exe'],
    ['no name', ''],
  ])('refuses a name with %s: a name that is not one the export makes is a mistake in the code', (_label, name) => {
    expect(() => attachmentDisposition(name)).toThrow(Error);
  });

  it('does not repeat the refused name in its error', () => {
    expect(() => attachmentDisposition('secret"\r\n.xlsx')).toThrow(/^(?!.*secret)/);
  });
});

describe('fileResponse (the one place a portal-made name reaches a header)', () => {
  const BYTES = new Uint8Array([1, 2, 3]);

  it('sends an attachment with both name parameters for a file the portal names', () => {
    const response = fileResponse({ mime: 'application/octet-stream', bytes: BYTES, fileName: nameOf('MAS', 'Kühler') }, 'req-1');
    expect(response.headers.get('Content-Disposition')).toBe(`attachment; filename="MAS_Khler_21-11-2026.xlsx"; filename*=UTF-8''MAS_K%C3%BChler_21-11-2026.xlsx`);
  });

  it('keeps the inline answer with no name for a picture', () => {
    expect(fileResponse({ mime: 'image/png', bytes: BYTES }, 'req-1').headers.get('Content-Disposition')).toBe('inline');
  });

  it('throws for a name holding a control character, a quote or a path (a mistake in the code)', () => {
    for (const fileName of ['a\r\nb.xlsx', 'a"b.xlsx', '../b.xlsx', 'a\u0000.xlsx']) {
      expect(() => fileResponse({ mime: 'application/octet-stream', bytes: BYTES, fileName }, 'req-1')).toThrow(Error);
    }
  });
});
