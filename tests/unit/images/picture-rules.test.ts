import { describe, expect, it } from 'vitest';

import { FALLBACK_FILE_NAME, kilobytesOf, MAX_FILE_NAME_LENGTH, MAX_PICTURE_BYTES, MAX_UPLOAD_BODY_BYTES, pictureTooLargeMessage, sanitiseFileName } from '@/lib/images/picture-rules';

/**
 * STORY-05.07 T1 (AC-7, NFR-005): the file name is display text. It is sanitised when it is stored, so markup and path characters never reach the database or a page, and it is
 * shown as text. The ceilings: a picture under 200 x 1024 bytes, and a whole upload under 256 x 1024 bytes.
 */

describe('limits', () => {
  it('has a picture limit of 200 x 1024 bytes and an upload ceiling of 256 x 1024 bytes, above it', () => {
    expect(MAX_PICTURE_BYTES).toBe(204_800);
    expect(MAX_UPLOAD_BODY_BYTES).toBe(262_144);
    expect(MAX_UPLOAD_BODY_BYTES).toBeGreaterThan(MAX_PICTURE_BYTES);
  });

  it('rounds a size up to whole kilobytes', () => {
    expect([1, 1024, 1025, 204_800, 204_801].map(kilobytesOf)).toEqual([1, 1, 2, 200, 201]);
  });

  it('words the refusal of SCR-05', () => {
    expect(pictureTooLargeMessage('cabinet-photo.png', 312 * 1024)).toBe('"cabinet-photo.png" is 312 KB. Pictures must be under 200 KB. Choose a smaller picture.');
  });
});

describe('sanitiseFileName (AC-7)', () => {
  it('keeps an ordinary name as it is', () => {
    expect(sanitiseFileName('cabinet-photo.png')).toBe('cabinet-photo.png');
    expect(sanitiseFileName('Part 12 (front).JPG')).toBe('Part 12 (front).JPG');
  });

  it('takes the last segment of a path, of either kind', () => {
    expect(sanitiseFileName('C:\\Users\\invented\\Pictures\\front.png')).toBe('front.png');
    expect(sanitiseFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitiseFileName('/var/tmp/front.png')).toBe('front.png');
    expect(sanitiseFileName('folder/')).toBe(FALLBACK_FILE_NAME);
  });

  it('takes out markup, quotes and drive characters, so the name is text and nothing else', () => {
    expect(sanitiseFileName('<img src=x onerror=alert(1)>.png')).toBe('img src=x onerror=alert(1).png');
    // The slash of the closing tag is a path separator, so only what follows it is kept.
    expect(sanitiseFileName('"><script>alert(1)</script>.png')).toBe('script.png');
    expect(sanitiseFileName("a'b`c&d:e*f?g|h.png")).toBe('abcdefgh.png');
    for (const name of ['<b>x</b>.png', 'a"b.png', "a'b.png"]) expect(sanitiseFileName(name)).not.toMatch(/[<>"'`]/);
  });

  it('takes out control and invisible characters, the right-to-left override included, and keeps the joiners that scripts need', () => {
    expect(sanitiseFileName('a\u0000b\u001fc\u007fd.png')).toBe('abcd.png');
    expect(sanitiseFileName('photo\u202Egnp.exe')).toBe('photognp.exe');
    expect(sanitiseFileName('a\u200Bb\uFEFFc\u2028d.png')).toBe('abcd.png');
    expect(sanitiseFileName('क\u094D\u200Dष.png')).toContain('\u200D');
  });

  it('folds white space to single spaces, trims, and drops leading dots', () => {
    expect(sanitiseFileName('  a \t\n  b   c.png  ')).toBe('a b c.png');
    expect(sanitiseFileName('...hidden.png')).toBe('hidden.png');
    expect(sanitiseFileName('.. .png')).toBe('png');
  });

  it('is `picture` when nothing is left', () => {
    for (const name of ['', '   ', '<>', '\u0000\u0001', '.', '..', '...', '/', '\\']) expect(sanitiseFileName(name), JSON.stringify(name)).toBe(FALLBACK_FILE_NAME);
  });

  it('cuts a long name to 100 characters and keeps its extension, never splitting a character', () => {
    const long = `${'a'.repeat(300)}.png`;
    const cut = sanitiseFileName(long);
    expect(Array.from(cut)).toHaveLength(MAX_FILE_NAME_LENGTH);
    expect(cut.endsWith('.png')).toBe(true);
    const emoji = sanitiseFileName(`${'😀'.repeat(150)}.png`);
    expect(Array.from(emoji)).toHaveLength(MAX_FILE_NAME_LENGTH);
    expect(emoji).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    // No extension to keep (a long dot is not one): the first 100 characters.
    expect(Array.from(sanitiseFileName(`${'b'.repeat(120)}.${'c'.repeat(40)}`))).toHaveLength(MAX_FILE_NAME_LENGTH);
  });

  it('keeps a name of exactly 100 characters whole', () => {
    const exact = 'd'.repeat(MAX_FILE_NAME_LENGTH);
    expect(sanitiseFileName(exact)).toBe(exact);
  });
});
