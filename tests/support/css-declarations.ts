import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compile } from 'tailwindcss';

/**
 * Builds the CSS that Tailwind makes from `src/app/globals.css` for a list of class names, and reads it back as
 * declarations with the rules and at-rules they sit inside. Used by the tests that must look at the generated CSS
 * (which media query a state is in, which rule comes later) and not at the class strings.
 *
 * `compile` returns each utility inside its layer and at-rules (`@layer utilities` > `@media (hover: hover)` >
 * `.hover\:bg-x:hover`), so a declaration here carries that whole path, outermost first.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const GLOBALS = resolve(ROOT, 'src/app/globals.css');

export interface Declaration {
  /** Layers, at-rules and the selector, outermost first: `@layer utilities`, `@media (hover: hover)`, `.hover\:bg-x:hover`. */
  readonly path: readonly string[];
  readonly property: string;
  readonly value: string;
  /** Position of the declaration in the output, to tell which of two rules comes later. */
  readonly order: number;
}

/** Resolves `@import` ids the way a bundler does for this file: `tailwindcss` and `tailwindcss/x.css` in node_modules, relative ids from the importer. */
async function loadStylesheet(id: string, base: string): Promise<{ path: string; base: string; content: string }> {
  let path: string;
  if (id === 'tailwindcss') path = resolve(ROOT, 'node_modules/tailwindcss/index.css');
  else if (id.startsWith('tailwindcss/')) path = resolve(ROOT, 'node_modules', id.endsWith('.css') ? id : `${id}.css`);
  else path = resolve(base, id);
  return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
}

/** The CSS Tailwind generates for these class names on top of the project's token file. */
export async function buildCss(candidates: readonly string[]): Promise<string> {
  const compiler = await compile(readFileSync(GLOBALS, 'utf8'), {
    base: dirname(GLOBALS),
    from: GLOBALS,
    loadStylesheet,
  });
  return compiler.build([...candidates]);
}

/** Every `property: value;` of a stylesheet with the nested rules and at-rules around it. Strings and parentheses are skipped over. */
export function declarationsOf(css: string): Declaration[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found: Declaration[] = [];
  const stack: string[] = [];
  let current = '';
  let depth = 0;
  let quote = '';
  for (const char of text) {
    if (quote !== '') {
      current += char;
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === '(') {
      depth += 1;
      current += char;
    } else if (char === ')') {
      depth -= 1;
      current += char;
    } else if (depth > 0) {
      current += char;
    } else if (char === '{') {
      stack.push(current.trim().replace(/\s+/g, ' '));
      current = '';
    } else if (char === ';' || char === '}') {
      const statement = current.trim();
      const colon = statement.indexOf(':');
      if (statement !== '' && colon > 0 && !statement.startsWith('@')) {
        found.push({
          path: [...stack],
          property: statement.slice(0, colon).trim(),
          value: statement.slice(colon + 1).trim().replace(/\s+/g, ' '),
          order: found.length,
        });
      }
      current = '';
      if (char === '}') stack.pop();
    } else {
      current += char;
    }
  }
  return found;
}

/** A Tailwind class name as it appears in a selector: `active:bg-border` is `.active\:bg-border`. */
export function selectorOf(className: string): string {
  return `.${className.replace(/[:/[\]()]/g, (character) => `\\${character}`)}`;
}

/** Declarations of the rule for one class name, whatever pseudo-classes follow it (`.active\:bg-border:active`). */
export function declarationsOfClass(all: readonly Declaration[], className: string): Declaration[] {
  const selector = selectorOf(className);
  return all.filter((declaration) => {
    const rule = declaration.path.at(-1) ?? '';
    return rule === selector || rule.startsWith(`${selector}:`);
  });
}

/** The selector of the rule a declaration is in, e.g. `.active\:bg-border:active`. */
export function ruleOf(declaration: Declaration): string {
  return declaration.path.at(-1) ?? '';
}

/** True when any at-rule on the declaration's path is the "device can hover" media query. */
export function isInsideHoverQuery(declaration: Declaration): boolean {
  return declaration.path.some((part) => part.startsWith('@media') && part.includes('hover: hover'));
}
