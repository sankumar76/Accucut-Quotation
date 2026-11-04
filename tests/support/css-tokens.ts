/**
 * Reads CSS custom properties from a stylesheet's text, for the token tests. It handles what the two token
 * files contain (`:root { --name: value; }` blocks, comments, nested at-rules) and nothing more.
 */

export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The text between the braces of every `selector { ... }` block, in file order. Braces are matched, so a block may hold others. */
export function blocksOf(css: string, selector: string): string[] {
  const text = stripComments(css);
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(`${selector} {`, from);
    if (start === -1) return blocks;
    const open = text.indexOf('{', start);
    let depth = 0;
    let end = open;
    for (; end < text.length; end += 1) {
      const char = text.charAt(end);
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (depth === 0) break;
    }
    blocks.push(text.slice(open + 1, end));
    from = end + 1;
  }
}

/** `--name: value;` declarations of one block, values normalised for comparison (lower case, single spaces, `.06` as `0.06`). */
export function customProperties(block: string): Map<string, string> {
  const properties = new Map<string, string>();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name === undefined || value === undefined) continue;
    properties.set(name, normaliseValue(value));
  }
  return properties;
}

export function normaliseValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[^\d])\.(\d)/g, '$10.$2');
}
