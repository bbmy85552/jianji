/**
 * 轻量公式引擎，用于数据表公式字段。
 * 不使用 eval。仅支持白名单函数与基本运算，确保安全。
 */

export type FormulaContext = {
  fields: { id: string; name: string; type: string }[];
  current: Record<string, unknown>;
  records: Record<string, unknown>[];
};

export type FormulaValue = number | string | boolean | Date | null;

interface Token {
  type: 'num' | 'str' | 'ident' | 'op' | 'paren' | 'comma' | 'ref';
  value: string;
}

const OPS = new Set(['+', '-', '*', '/', '%', '=', '!', '<', '>', '&']);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i += 1;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ',' });
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let s = '';
      while (j < input.length && input[j] !== quote) {
        if (input[j] === '\\' && j + 1 < input.length) {
          s += input[j + 1];
          j += 2;
        } else {
          s += input[j];
          j += 1;
        }
      }
      if (j >= input.length) throw new Error('字符串未闭合');
      tokens.push({ type: 'str', value: s });
      i = j + 1;
      continue;
    }
    if (ch === '{') {
      const j = input.indexOf('}', i);
      if (j === -1) throw new Error('字段引用未闭合');
      const name = input.slice(i + 1, j).trim();
      if (!name) throw new Error('空的字段引用');
      tokens.push({ type: 'ref', value: name });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j += 1;
      tokens.push({ type: 'num', value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_\u4e00-\u9fa5]/.test(ch)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_\u4e00-\u9fa5]/.test(input[j])) j += 1;
      tokens.push({ type: 'ident', value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (OPS.has(ch)) {
      let j = i + 1;
      // 双字符运算符 == != >= <=
      if (j < input.length && OPS.has(input[j]) && /[=!<>]/.test(ch)) {
        tokens.push({ type: 'op', value: input.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    throw new Error(`无法识别的字符: ${ch}`);
  }
  return tokens;
}

type Node =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'ref'; name: string }
  | { type: 'unary'; op: string; arg: Node }
  | { type: 'binary'; op: string; left: Node; right: Node }
  | { type: 'call'; name: string; args: Node[] };

class Parser {
  pos = 0;
  constructor(public tokens: Token[]) {}
  peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }
  eat(): Token {
    const t = this.tokens[this.pos];
    this.pos += 1;
    return t;
  }
  expect(type: Token['type'], value?: string) {
    const t = this.tokens[this.pos];
    if (!t) throw new Error('意外的结尾');
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error(`期望 ${value ?? type}, 实际是 ${t.value}`);
    }
    this.pos += 1;
    return t;
  }
  parse(): Node {
    const node = this.parseExpr();
    if (this.pos !== this.tokens.length) {
      throw new Error(`多余的内容: ${this.tokens[this.pos].value}`);
    }
    return node;
  }
  parseExpr(): Node {
    return this.parseLogicalOr();
  }
  parseLogicalOr(): Node {
    let left = this.parseLogicalAnd();
    while (this.peek()?.type === 'op' && this.peek()!.value === '|') {
      // 我们用 || 和 && 表示逻辑;但这里 OPS 只包含单字符,因此这里跳过
      break;
    }
    return left;
  }
  parseLogicalAnd(): Node {
    return this.parseEquality();
  }
  parseEquality(): Node {
    let left = this.parseComparison();
    while (
      this.peek()?.type === 'op' &&
      (this.peek()!.value === '==' || this.peek()!.value === '!=' || this.peek()!.value === '=')
    ) {
      const op = this.eat().value;
      const right = this.parseComparison();
      left = { type: 'binary', op: op === '=' ? '==' : op, left, right };
    }
    return left;
  }
  parseComparison(): Node {
    let left = this.parseAddSub();
    while (
      this.peek()?.type === 'op' &&
      ['<', '>', '<=', '>='].includes(this.peek()!.value)
    ) {
      const op = this.eat().value;
      const right = this.parseAddSub();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }
  parseAddSub(): Node {
    let left = this.parseMulDiv();
    while (
      this.peek()?.type === 'op' &&
      (this.peek()!.value === '+' ||
        this.peek()!.value === '-' ||
        this.peek()!.value === '&')
    ) {
      const op = this.eat().value;
      const right = this.parseMulDiv();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }
  parseMulDiv(): Node {
    let left = this.parseUnary();
    while (
      this.peek()?.type === 'op' &&
      (this.peek()!.value === '*' ||
        this.peek()!.value === '/' ||
        this.peek()!.value === '%')
    ) {
      const op = this.eat().value;
      const right = this.parseUnary();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }
  parseUnary(): Node {
    if (this.peek()?.type === 'op' && (this.peek()!.value === '-' || this.peek()!.value === '+')) {
      const op = this.eat().value;
      return { type: 'unary', op, arg: this.parseUnary() };
    }
    return this.parsePrimary();
  }
  parsePrimary(): Node {
    const t = this.peek();
    if (!t) throw new Error('意外的结尾');
    if (t.type === 'num') {
      this.eat();
      return { type: 'num', value: Number(t.value) };
    }
    if (t.type === 'str') {
      this.eat();
      return { type: 'str', value: t.value };
    }
    if (t.type === 'ref') {
      this.eat();
      return { type: 'ref', name: t.value };
    }
    if (t.type === 'paren' && t.value === '(') {
      this.eat();
      const node = this.parseExpr();
      this.expect('paren', ')');
      return node;
    }
    if (t.type === 'ident') {
      this.eat();
      const upper = t.value.toUpperCase();
      if (upper === 'TRUE') return { type: 'bool', value: true };
      if (upper === 'FALSE') return { type: 'bool', value: false };
      if (this.peek()?.type === 'paren' && this.peek()!.value === '(') {
        this.eat();
        const args: Node[] = [];
        if (this.peek()?.type !== 'paren' || this.peek()!.value !== ')') {
          args.push(this.parseExpr());
          while (this.peek()?.type === 'comma') {
            this.eat();
            args.push(this.parseExpr());
          }
        }
        this.expect('paren', ')');
        return { type: 'call', name: upper, args };
      }
      throw new Error(`无法识别的标识符: ${t.value}`);
    }
    throw new Error(`意外的 token: ${t.value}`);
  }
}

function toNumber(v: FormulaValue): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return n;
}

function toString(v: FormulaValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toLocaleDateString();
  return String(v);
}

function toBool(v: FormulaValue): boolean {
  if (typeof v === 'boolean') return v;
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return v !== 0;
  return true;
}

function isDateLike(value: unknown): value is string | number | Date {
  if (value instanceof Date) return true;
  if (typeof value === 'string' && /\d{4}-\d{2}-\d{2}/.test(value)) return true;
  return false;
}

const FUNCTIONS: Record<string, (args: FormulaValue[], ctx: FormulaContext) => FormulaValue> = {
  SUM: (args) => args.reduce<number>((acc, v) => acc + toNumber(v), 0),
  AVG: (args) => {
    if (args.length === 0) return 0;
    return args.reduce<number>((acc, v) => acc + toNumber(v), 0) / args.length;
  },
  MAX: (args) => args.reduce<number>((acc, v, i) => (i === 0 ? toNumber(v) : Math.max(acc, toNumber(v))), 0),
  MIN: (args) =>
    args.reduce<number>((acc, v, i) => (i === 0 ? toNumber(v) : Math.min(acc, toNumber(v))), 0),
  COUNT: (args) => args.filter((v) => v !== null && v !== '' && v !== undefined).length,
  IF: (args) => {
    if (args.length < 2) throw new Error('IF 需要至少两个参数');
    return toBool(args[0]) ? args[1] : args[2] ?? '';
  },
  CONCAT: (args) => args.map(toString).join(''),
  CONCATENATE: (args) => args.map(toString).join(''),
  UPPER: (args) => toString(args[0]).toUpperCase(),
  LOWER: (args) => toString(args[0]).toLowerCase(),
  LEN: (args) => toString(args[0]).length,
  ROUND: (args) => {
    const n = toNumber(args[0]);
    const digits = args.length > 1 ? toNumber(args[1]) : 0;
    const factor = 10 ** digits;
    return Math.round(n * factor) / factor;
  },
  ABS: (args) => Math.abs(toNumber(args[0])),
  NOW: () => new Date(),
  TODAY: () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  },
  YEAR: (args) => {
    const v = args[0];
    if (v instanceof Date) return v.getFullYear();
    if (isDateLike(v)) return new Date(v as string).getFullYear();
    return 0;
  },
  MONTH: (args) => {
    const v = args[0];
    if (v instanceof Date) return v.getMonth() + 1;
    if (isDateLike(v)) return new Date(v as string).getMonth() + 1;
    return 0;
  },
  DAY: (args) => {
    const v = args[0];
    if (v instanceof Date) return v.getDate();
    if (isDateLike(v)) return new Date(v as string).getDate();
    return 0;
  },
  DAYS: (args) => {
    const a = args[0];
    const b = args[1];
    const da = a instanceof Date ? a : new Date(a as string);
    const db = b instanceof Date ? b : new Date(b as string);
    if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  },
  NOT: (args) => !toBool(args[0]),
  AND: (args) => args.every(toBool),
  OR: (args) => args.some(toBool),
};

function resolveRef(name: string, ctx: FormulaContext): FormulaValue {
  const field = ctx.fields.find((f) => f.name === name || f.id === name);
  if (!field) throw new Error(`未找到字段: ${name}`);
  const value = ctx.current[field.name];
  if (value === undefined || value === null) return null;
  if (field.type === 'date' || field.type === 'datetime') {
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }
  if (field.type === 'number' || field.type === 'rating' || field.type === 'progress') {
    return toNumber(value as FormulaValue);
  }
  if (field.type === 'checkbox') {
    return Boolean(value);
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value as FormulaValue;
}

function evalNode(node: Node, ctx: FormulaContext): FormulaValue {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'str':
      return node.value;
    case 'bool':
      return node.value;
    case 'ref':
      return resolveRef(node.name, ctx);
    case 'unary': {
      const v = evalNode(node.arg, ctx);
      if (node.op === '-') return -toNumber(v);
      if (node.op === '+') return toNumber(v);
      throw new Error(`未知一元运算: ${node.op}`);
    }
    case 'binary': {
      const left = evalNode(node.left, ctx);
      const right = evalNode(node.right, ctx);
      switch (node.op) {
        case '+': {
          if (typeof left === 'string' || typeof right === 'string') {
            return toString(left) + toString(right);
          }
          return toNumber(left) + toNumber(right);
        }
        case '-':
          return toNumber(left) - toNumber(right);
        case '*':
          return toNumber(left) * toNumber(right);
        case '/': {
          const r = toNumber(right);
          if (r === 0) return null;
          return toNumber(left) / r;
        }
        case '%':
          return toNumber(left) % toNumber(right);
        case '&':
          return toString(left) + toString(right);
        case '==':
          return toString(left) === toString(right);
        case '!=':
          return toString(left) !== toString(right);
        case '<':
          return toNumber(left) < toNumber(right);
        case '>':
          return toNumber(left) > toNumber(right);
        case '<=':
          return toNumber(left) <= toNumber(right);
        case '>=':
          return toNumber(left) >= toNumber(right);
        default:
          throw new Error(`未知二元运算: ${node.op}`);
      }
    }
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new Error(`未知函数: ${node.name}`);
      const args = node.args.map((arg) => evalNode(arg, ctx));
      return fn(args, ctx);
    }
    default:
      throw new Error('未知节点');
  }
}

export interface FormulaResult {
  value: FormulaValue;
  error: string | null;
}

export function evalFormula(expression: string, ctx: FormulaContext): FormulaResult {
  if (!expression || !expression.trim()) {
    return { value: null, error: null };
  }
  try {
    const tokens = tokenize(expression);
    if (tokens.length === 0) return { value: null, error: null };
    const ast = new Parser(tokens).parse();
    const value = evalNode(ast, ctx);
    return { value, error: null };
  } catch (err) {
    return { value: null, error: (err as Error).message || '公式错误' };
  }
}

export function formatFormulaValue(value: FormulaValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '#无穷';
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toLocaleDateString();
  }
  return String(value);
}

export const FORMULA_HELP_FUNCTIONS = Object.keys(FUNCTIONS);
