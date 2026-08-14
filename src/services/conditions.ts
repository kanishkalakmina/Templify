/**
 * Conditional display.
 *
 * Elements may carry expressions such as `invoice.discount > 0`; the element
 * renders only when every expression passes.
 *
 * Deliberately a hand-written evaluator rather than `eval` / `new Function`:
 * templates are importable artifacts (`.templify`) and must never be able to
 * execute code in the editor — or, later, in the render server. The grammar is
 * kept small on purpose; see architecture R-5.
 */

import type { BindingScope } from './binding'
import { resolvePath } from './binding'
import { toNumber } from '@/utils/format'

export type ConditionOperator =
  | '>'
  | '>='
  | '<'
  | '<='
  | '=='
  | '!='
  | 'contains'
  | 'exists'
  | 'empty'

/** Longest first, so `>=` is matched before `>`. */
const OPERATORS: ConditionOperator[] = ['>=', '<=', '!=', '==', '>', '<', 'contains', 'exists', 'empty']

export interface ParsedCondition {
  path: string
  operator: ConditionOperator | null
  operand?: string
  negated: boolean
}

export function parseCondition(expression: string): ParsedCondition | null {
  let expr = expression.trim()
  if (!expr) return null

  let negated = false
  if (expr.startsWith('!')) {
    negated = true
    expr = expr.slice(1).trim()
  }

  for (const op of OPERATORS) {
    // Word operators need boundaries so `containsX` is not treated as `contains`.
    const isWord = /^[a-z]+$/.test(op)
    const index = isWord ? findWordOperator(expr, op) : expr.indexOf(op)
    if (index <= 0) continue

    const path = expr.slice(0, index).trim()
    const operand = expr.slice(index + op.length).trim()
    if (!path) continue
    if ((op === 'exists' || op === 'empty') && operand) continue
    return { path, operator: op, operand: operand || undefined, negated }
  }

  return { path: expr, operator: null, negated }
}

function findWordOperator(expr: string, op: string): number {
  const re = new RegExp(`\\s${op}(\\s|$)`)
  const m = re.exec(expr)
  return m ? m.index + 1 : -1
}

/** Turns the right-hand side of an expression into a comparable value. */
function parseOperand(raw: string | undefined): unknown {
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  const n = Number(trimmed)
  if (trimmed !== '' && Number.isFinite(n)) return n
  // Bare words are treated as string literals rather than paths: predictable for
  // template authors, and avoids a second layer of ambiguous lookups.
  return trimmed
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as object).length === 0
  return false
}

function truthy(value: unknown): boolean {
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'boolean') return value
  return !isEmpty(value)
}

/** Evaluates a single expression. Unparseable expressions render the element. */
export function evaluateCondition(expression: string, scope: BindingScope): boolean {
  const parsed = parseCondition(expression)
  if (!parsed) return true

  const value = resolvePath(scope, parsed.path)
  const result = applyOperator(parsed, value)
  return parsed.negated ? !result : result
}

function applyOperator(parsed: ParsedCondition, value: unknown): boolean {
  const { operator } = parsed

  if (operator === null) return truthy(value)
  if (operator === 'exists') return value !== undefined && value !== null
  if (operator === 'empty') return isEmpty(value)

  const operand = parseOperand(parsed.operand)

  if (operator === 'contains') {
    if (Array.isArray(value)) return value.some((v) => looseEquals(v, operand))
    if (typeof value === 'string') return value.toLowerCase().includes(String(operand).toLowerCase())
    return false
  }

  if (operator === '==') return looseEquals(value, operand)
  if (operator === '!=') return !looseEquals(value, operand)

  // Ordering comparisons are numeric; fall back to string ordering when either
  // side is not a number, so date strings still compare sensibly.
  const left = toNumber(value)
  const right = toNumber(operand)
  if (left !== null && right !== null) {
    switch (operator) {
      case '>':
        return left > right
      case '>=':
        return left >= right
      case '<':
        return left < right
      case '<=':
        return left <= right
    }
  }

  const ls = value === undefined || value === null ? '' : String(value)
  const rs = operand === undefined || operand === null ? '' : String(operand)
  switch (operator) {
    case '>':
      return ls > rs
    case '>=':
      return ls >= rs
    case '<':
      return ls < rs
    case '<=':
      return ls <= rs
    default:
      return true
  }
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) return false
  const an = toNumber(a)
  const bn = toNumber(b)
  if (an !== null && bn !== null) return an === bn
  return String(a).toLowerCase() === String(b).toLowerCase()
}

/** All conditions must pass. An element with no conditions always renders. */
export function evaluateConditions(conditions: string[] | undefined, scope: BindingScope): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every((c) => evaluateCondition(c, scope))
}

/** Validation for the properties panel — reports why an expression is unusable. */
export function validateCondition(expression: string): { valid: boolean; message?: string } {
  const trimmed = expression.trim()
  if (!trimmed) return { valid: false, message: 'Expression is empty' }
  const parsed = parseCondition(trimmed)
  if (!parsed) return { valid: false, message: 'Could not parse expression' }
  if (!parsed.path) return { valid: false, message: 'Missing a data path on the left' }
  if (
    parsed.operator &&
    parsed.operator !== 'exists' &&
    parsed.operator !== 'empty' &&
    !parsed.operand
  ) {
    return { valid: false, message: `Missing a value to compare with "${parsed.operator}"` }
  }
  return { valid: true }
}
