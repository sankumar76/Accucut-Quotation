import 'server-only';

import { assertNever } from '../assert-never';
import { Decimal } from '../decimal';

import { BINARY_OPERATORS, type BinaryOperator, type Condition, type Expression } from './ast';
import { errorAt, FormulaError, type FormulaIssueCode } from './errors';
import { MAX_NESTING_DEPTH, MAX_ROUND_PLACES, type FunctionName } from './names';
import { tokenize, type Span, type Token, type TokenSource } from './tokenizer';

/**
 * A Pratt parser (ADR-005) over the tokens of `tokenizer.ts`. The grammar:
 *
 * ```
 * expression := operand (('+' | '-' | '*' | '/') operand)*        '*' and '/' bind tighter; left to right
 * operand    := number | reference | '-' operand | '(' expression ')' | call
 * call       := SUM '(' column ')' | MIN '(' list ')' | MAX '(' list ')'
 *             | ROUND '(' expression ',' places ')' | IF '(' condition ',' expression ',' expression ')'
 * condition  := expression ('>' | '>=' | '<' | '<=' | '=' | '<>') expression
 * ```
 *
 * A comparison is a `condition` and nothing else: it appears only as the first argument of `IF`, so a
 * comparison anywhere else is refused (SPEC section 8.2). `ROLLUP` is not a function. Every error is a
 * `FormulaError` with the character position, and its message holds no text from the formula.
 */

type EndToken = Span & { readonly kind: 'end' };
type ParserToken = Token | EndToken;
type FunctionToken = Span & { readonly kind: 'function'; readonly name: FunctionName };

const POWER = { additive: 1, multiplicative: 2, unary: 3 } as const;

const BINARY_POWER: Readonly<Record<BinaryOperator, number>> = {
  '+': POWER.additive,
  '-': POWER.additive,
  '*': POWER.multiplicative,
  '/': POWER.multiplicative,
};

const ARGUMENTS_OF_IF = 3;
const ARGUMENTS_OF_ROUND = 2;

function binaryOperatorOf(token: ParserToken): BinaryOperator | undefined {
  return token.kind === 'symbol' ? BINARY_OPERATORS.find((operator) => operator === token.symbol) : undefined;
}

function fail(code: FormulaIssueCode, message: string, token: Span): FormulaError {
  return errorAt(code, message, token.start, token.end);
}

function isSymbol(token: ParserToken, symbol: string): boolean {
  return token.kind === 'symbol' && token.symbol === symbol;
}

/** The error for a token that cannot appear where it was found. */
function unexpected(token: ParserToken, expected: 'operand' | 'operator'): FormulaError {
  if (token.kind === 'end') return fail('UNEXPECTED_END', 'The formula ends before it is complete', token);
  if (token.kind === 'comparison') {
    return fail('COMPARISON_OUTSIDE_IF', 'A comparison is allowed only as the condition of IF', token);
  }
  if (isSymbol(token, ')') && expected === 'operator') {
    return fail('UNEXPECTED_CLOSING_BRACKET', 'This bracket closes nothing', token);
  }
  return expected === 'operator'
    ? fail('EXPECTED_OPERATOR', 'An operator is expected between two operands', token)
    : fail('EXPECTED_OPERAND', 'An operand is expected', token);
}

class Parser {
  private readonly tokens: ReadonlyArray<Token>;
  private readonly endToken: EndToken;
  private index = 0;
  private depth = 0;

  constructor(tokens: ReadonlyArray<Token>, textLength: number) {
    this.tokens = tokens;
    this.endToken = { kind: 'end', start: textLength, end: textLength };
  }

  parseFormula(): Expression {
    if (this.peek().kind === 'end') throw new FormulaError({ code: 'EMPTY', message: 'A formula cannot be empty.' });
    const expression = this.parseExpression(0);
    const rest = this.peek();
    if (rest.kind !== 'end') throw unexpected(rest, 'operator');
    return expression;
  }

  private peek(): ParserToken {
    return this.tokens[this.index] ?? this.endToken;
  }

  private next(): ParserToken {
    const token = this.peek();
    if (token.kind !== 'end') this.index += 1;
    return token;
  }

  private parseExpression(minimumPower: number): Expression {
    this.enter();
    let left = this.parseOperand();
    for (;;) {
      const operator = binaryOperatorOf(this.peek());
      if (operator === undefined || BINARY_POWER[operator] <= minimumPower) break;
      this.next();
      const right = this.parseExpression(BINARY_POWER[operator]);
      left = { kind: 'binary', operator, left, right };
    }
    this.depth -= 1;
    return left;
  }

  private enter(): void {
    this.depth += 1;
    if (this.depth > MAX_NESTING_DEPTH) {
      throw fail('TOO_DEEP', `A formula can be nested at most ${MAX_NESTING_DEPTH} levels deep`, this.peek());
    }
  }

  private parseOperand(): Expression {
    const token = this.next();
    switch (token.kind) {
      case 'number':
        return { kind: 'number', value: new Decimal(token.text) };
      case 'reference':
        return { kind: 'reference', reference: token.reference };
      case 'function':
        return this.parseCall(token);
      case 'symbol':
        if (token.symbol === '-') return { kind: 'negate', operand: this.parseExpression(POWER.unary) };
        if (token.symbol === '(') return this.parseBracketed(token);
        throw unexpected(token, 'operand');
      case 'comparison':
      case 'end':
        throw unexpected(token, 'operand');
      default:
        return assertNever(token, 'token');
    }
  }

  private parseBracketed(open: Span): Expression {
    const inner = this.parseExpression(0);
    this.expectClose(open);
    return inner;
  }

  /** Consumes the `)` that closes the bracket opened at `open`. */
  private expectClose(open: Span): void {
    const token = this.next();
    if (isSymbol(token, ')')) return;
    if (token.kind === 'end') throw fail('UNCLOSED_BRACKET', 'A bracket is opened and not closed', open);
    throw unexpected(token, 'operator');
  }

  private parseCall(name: FunctionToken): Expression {
    const open = this.next();
    if (!isSymbol(open, '(')) throw unexpected(open, 'operand');
    this.enter();
    const call = this.parseCallBody(name, open);
    this.depth -= 1;
    return call;
  }

  private parseCallBody(name: FunctionToken, open: Span): Expression {
    switch (name.name) {
      case 'IF':
        return this.parseIf(name, open);
      case 'SUM':
        return this.parseSum(name, open);
      case 'MIN':
        return { kind: 'min', args: this.parseList(open) };
      case 'MAX':
        return { kind: 'max', args: this.parseList(open) };
      case 'ROUND':
        return this.parseRound(name, open);
      default:
        return assertNever(name.name, 'function');
    }
  }

  /** Arguments separated by commas, up to and including the closing bracket. At least one. */
  private parseList(open: Span): Expression[] {
    const args = [this.parseExpression(0)];
    while (isSymbol(this.peek(), ',')) {
      this.next();
      args.push(this.parseExpression(0));
    }
    this.closeCall(open);
    return args;
  }

  /** The `)` of a call whose arguments have all been read. A comma here means there are too many. */
  private closeCall(open: Span): void {
    const token = this.peek();
    if (isSymbol(token, ',')) throw fail('WRONG_ARGUMENT_COUNT', 'This function was given too many arguments', token);
    this.expectClose(open);
  }

  private parseSum(name: Span, open: Span): Expression {
    const args = this.parseList(open);
    const [column] = args;
    if (args.length !== 1) throw fail('WRONG_ARGUMENT_COUNT', 'SUM takes one argument: a column', name);
    if (column?.kind !== 'reference' || column.reference.kind !== 'field') {
      throw fail('SUM_NEEDS_COLUMN', 'SUM takes a column', name);
    }
    return { kind: 'sum', fieldId: column.reference.id };
  }

  private parseRound(name: Span, open: Span): Expression {
    const args = this.parseList(open);
    const [value, places] = args;
    if (args.length !== ARGUMENTS_OF_ROUND || value === undefined || places === undefined) {
      throw fail('WRONG_ARGUMENT_COUNT', 'ROUND takes two arguments: a value and a number of decimal places', name);
    }
    const count = places.kind === 'number' ? places.value : undefined;
    if (count === undefined || !count.isInteger() || count.greaterThan(MAX_ROUND_PLACES)) {
      throw fail('ROUND_NEEDS_PLACES', `ROUND needs a whole number of places from 0 to ${MAX_ROUND_PLACES}`, name);
    }
    return { kind: 'round', value, places: count.toNumber() };
  }

  private parseIf(name: Span, open: Span): Expression {
    const condition = this.parseCondition();
    this.expectSeparator(name);
    const whenTrue = this.parseExpression(0);
    this.expectSeparator(name);
    const whenFalse = this.parseExpression(0);
    this.closeCall(open);
    return { kind: 'if', condition, whenTrue, whenFalse };
  }

  /** A comma between the arguments of `IF`. A `)` here means an argument is missing. */
  private expectSeparator(name: Span): void {
    const token = this.peek();
    if (isSymbol(token, ',')) {
      this.next();
      return;
    }
    if (isSymbol(token, ')')) {
      throw fail('WRONG_ARGUMENT_COUNT', `IF takes ${ARGUMENTS_OF_IF} arguments: a condition and two results`, name);
    }
    throw unexpected(token, 'operator');
  }

  private parseCondition(): Condition {
    const start = this.peek();
    const left = this.parseExpression(0);
    const comparison = this.next();
    if (comparison.kind !== 'comparison') {
      throw fail('IF_NEEDS_COMPARISON', 'The first argument of IF must be a comparison', start);
    }
    const right = this.parseExpression(0);
    const extra = this.peek();
    if (extra.kind === 'comparison') throw unexpected(extra, 'operator');
    return { operator: comparison.operator, left, right };
  }
}

/**
 * Parses `text` into a tree. Throws `FormulaError` (with the character position in `issue`) for text that is
 * empty, cannot be read, or breaks the grammar. This checks the shape of one formula only: cycles and the
 * row/product scope rule need the other formulas and are checked in `graph.ts`.
 */
export function parseFormula(text: string, source: TokenSource): Expression {
  return parseTokens(tokenize(text, source), text.length);
}

/** Parses tokens that `tokenize` produced from a text of `textLength` characters. */
export function parseTokens(tokens: ReadonlyArray<Token>, textLength: number): Expression {
  return new Parser(tokens, textLength).parseFormula();
}
