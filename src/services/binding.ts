/**
 * The data-binding engine.
 *
 * Templates address application data with `{{path}}` tokens. This module turns
 * those tokens into values, and turns a data payload into the variable tree that
 * powers "Insert Variable".
 *
 * No React. Everything here is a pure function so the same code can run inside
 * the render server (see architecture NFR-001).
 */

import type { ReportData, VariableNode } from '@/types/data'
import type { FormatKind, VariableType } from '@/types/template'
import { formatValue } from '@/utils/format'

/* -------------------------------------------------------------------------- */
/* Scope                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The lookup context for a single element render.
 *
 * `root` is the payload the application sent. `item`/`index` are pushed by
 * repeaters and table rows, which is what makes `{{item.name}}` resolve without
 * the template author writing a loop.
 */
export interface BindingScope {
  root: ReportData
  item?: unknown
  index?: number
  total?: number
}

export function rootScope(data: ReportData): BindingScope {
  return { root: data }
}

export function itemScope(parent: BindingScope, item: unknown, index: number, total: number): BindingScope {
  return { root: parent.root, item, index, total }
}

/* -------------------------------------------------------------------------- */
/* Token parsing                                                               */
/* -------------------------------------------------------------------------- */

const TOKEN_RE = /\{\{\s*([^{}]+?)\s*\}\}/g

export interface ParsedToken {
  path: string
  format?: FormatKind
}

const FORMAT_NAMES: FormatKind[] = ['text', 'number', 'integer', 'currency', 'percent', 'date']

/** `invoice.total | currency` -> `{ path: 'invoice.total', format: 'currency' }` */
export function parseToken(inner: string): ParsedToken {
  const [rawPath, rawFormat] = inner.split('|').map((s) => s.trim())
  const format = FORMAT_NAMES.find((f) => f === rawFormat)
  return { path: rawPath, format }
}

/** True when the whole string is exactly one token, e.g. `{{invoice.total}}`. */
export function isSingleToken(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{{') || !trimmed.endsWith('}}')) return false
  // Guard against `{{a}} {{b}}`, which also starts and ends with braces.
  return trimmed.slice(2, -2).indexOf('{{') === -1 && trimmed.slice(2, -2).indexOf('}}') === -1
}

export function hasBinding(text: string | undefined): boolean {
  if (!text) return false
  TOKEN_RE.lastIndex = 0
  return TOKEN_RE.test(text)
}

/** Every distinct path referenced by a string, in order of appearance. */
export function extractBindings(text: string | undefined): string[] {
  if (!text) return []
  const out: string[] = []
  for (const match of text.matchAll(TOKEN_RE)) {
    const { path } = parseToken(match[1])
    if (path && !out.includes(path)) out.push(path)
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Path resolution                                                             */
/* -------------------------------------------------------------------------- */

type PathSegment = string | number

/** `items[0].name` -> `['items', 0, 'name']` */
export function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = []
  for (const part of path.split('.')) {
    if (!part) continue
    // Split a segment such as `items[0]` into its name and any indices.
    const name = part.replace(/\[.*$/, '')
    if (name) segments.push(name)
    for (const m of part.matchAll(/\[(\d*)\]/g)) {
      // `[]` (no index) is a tree-notation marker, not a lookup — skip it.
      if (m[1] !== '') segments.push(Number(m[1]))
    }
  }
  return segments
}

function readSegments(source: unknown, segments: PathSegment[]): unknown {
  let current = source
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined
    if (typeof segment === 'number') {
      if (!Array.isArray(current)) return undefined
      current = current[segment]
    } else {
      if (typeof current !== 'object') return undefined
      current = (current as Record<string, unknown>)[segment]
    }
  }
  return current
}

/**
 * Resolves a dot path against the scope.
 *
 * Row-scoped paths (`item.*`, `index`, `rowNumber`) are checked before the root
 * payload so a repeater row shadows a same-named top-level key.
 */
export function resolvePath(scope: BindingScope, path: string): unknown {
  const trimmed = path.trim()
  if (!trimmed) return undefined

  if (trimmed === 'index' || trimmed === '@index') return scope.index
  if (trimmed === 'rowNumber' || trimmed === '@rowNumber') {
    return scope.index === undefined ? undefined : scope.index + 1
  }
  if (trimmed === 'total' || trimmed === '@total') return scope.total

  const segments = parsePath(trimmed)
  if (!segments.length) return undefined

  if (segments[0] === 'item' || segments[0] === 'this') {
    if (scope.item === undefined) return undefined
    return readSegments(scope.item, segments.slice(1))
  }

  return readSegments(scope.root, segments)
}

/* -------------------------------------------------------------------------- */
/* Interpolation                                                               */
/* -------------------------------------------------------------------------- */

export interface InterpolateOptions {
  /** Currency prefix applied to `currency`-formatted tokens. */
  currency?: string
  /**
   * Rendered in place of a token whose value is missing. The editor shows the
   * token itself so the author can see the binding; print shows nothing.
   */
  onMissing?: 'token' | 'empty'
}

/**
 * Replaces every `{{token}}` in `text` with its formatted value.
 * Literal text passes through untouched.
 */
export function interpolate(
  text: string | undefined,
  scope: BindingScope,
  options: InterpolateOptions = {},
): string {
  if (!text) return ''
  const { currency = '', onMissing = 'empty' } = options

  return text.replace(TOKEN_RE, (whole, inner: string) => {
    const { path, format } = parseToken(inner)
    const value = resolvePath(scope, path)
    if (value === undefined || value === null) return onMissing === 'token' ? whole : ''
    return formatValue(value, format ?? 'text', currency)
  })
}

/**
 * Resolves a binding to its **raw** value rather than display text.
 *
 * Needed wherever a number must stay a number — chart values, progress amounts,
 * condition operands — since `interpolate` would stringify it.
 */
export function resolveValue(binding: string | undefined, scope: BindingScope): unknown {
  if (!binding) return undefined
  const trimmed = binding.trim()
  if (isSingleToken(trimmed)) {
    const { path } = parseToken(trimmed.slice(2, -2))
    return resolvePath(scope, path)
  }
  // Not a bare token: could be a plain path (`items`) or mixed literal text.
  if (!hasBinding(trimmed)) return resolvePath(scope, trimmed)
  return interpolate(trimmed, scope)
}

/** Resolves a binding that must yield an array — table and repeater sources. */
export function resolveArray(source: string | undefined, scope: BindingScope): unknown[] {
  const value = resolveValue(source, scope)
  return Array.isArray(value) ? value : []
}

/* -------------------------------------------------------------------------- */
/* Variable tree                                                               */
/* -------------------------------------------------------------------------- */

function valueType(value: unknown): VariableNode['type'] {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (value instanceof Date) return 'date'
  const t = typeof value
  if (t === 'string') {
    // Surface ISO-ish dates as dates so the picker can suggest date formatting.
    if (/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(value as string)) return 'date'
    return 'string'
  }
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  if (t === 'object') return 'object'
  return 'string'
}

function previewOf(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`
  if (typeof value === 'object') return `${Object.keys(value as object).length} fields`
  const s = String(value)
  return s.length > 32 ? `${s.slice(0, 31)}…` : s
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Builds the tree shown by "Insert Variable" from the applied test data.
 *
 * Arrays become a single `items[]` node whose children are derived from the
 * first element and carry **row-scoped** tokens (`{{item.name}}`), because that
 * is the form that works inside a table or repeater.
 */
export function buildVariableTree(data: ReportData): VariableNode[] {
  const walk = (value: unknown, path: string, key: string, rowScoped: boolean): VariableNode => {
    const type = valueType(value)
    const token = rowScoped ? `{{item.${path}}}` : `{{${path}}}`
    const node: VariableNode = { path, key, type, token, preview: previewOf(value) }

    if (type === 'array') {
      const arr = value as unknown[]
      node.isArrayRoot = true
      node.path = path
      node.token = `{{${path}}}`
      const sample = arr[0]
      if (isPlainObject(sample)) {
        node.children = Object.entries(sample).map(([k, v]) => {
          const child = walk(v, k, k, true)
          // Display the tree path, keep the row-scoped insert token.
          child.path = `${path}[].${k}`
          return child
        })
      }
      return node
    }

    if (isPlainObject(value)) {
      node.children = Object.entries(value).map(([k, v]) =>
        walk(v, rowScoped ? `${path}.${k}` : `${path}.${k}`, k, rowScoped),
      )
    }

    return node
  }

  return Object.entries(data).map(([key, value]) => walk(value, key, key, false))
}

/** Flattens the tree for the picker's search box. */
export function flattenVariables(nodes: VariableNode[]): VariableNode[] {
  const out: VariableNode[] = []
  const visit = (list: VariableNode[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children) visit(n.children)
    }
  }
  visit(nodes)
  return out
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

function writeSegments(node: unknown, segments: string[], value: unknown): unknown {
  if (!segments.length) return value

  const [head, ...rest] = segments
  const isArrayMember = head.endsWith('[]')
  const key = isArrayMember ? head.slice(0, -2) : head
  const base: Record<string, unknown> = isPlainObject(node) ? { ...node } : {}

  if (isArrayMember) {
    // `items[].sku` sets the key on every element, so the column resolves for
    // all rows rather than just the first.
    const list = Array.isArray(base[key]) ? (base[key] as unknown[]) : []
    base[key] = list.map((item) => writeSegments(item, rest, value))
    return base
  }

  base[key] = writeSegments(base[key], rest, value)
  return base
}

/**
 * Immutably sets a value at a dot path, creating intermediate objects.
 * Supports `items[].sku` to write onto every member of an array.
 */
export function setPath(root: ReportData, path: string, value: unknown): ReportData {
  const segments = path
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!segments.length) return root
  return writeSegments(root, segments, value) as ReportData
}

/** True when the path already resolves to something in the payload. */
export function pathExists(data: ReportData, path: string): boolean {
  const normalised = path.replace(/\[\]/g, '[0]')
  return resolvePath(rootScope(data), normalised) !== undefined
}

/** The binding token for a path — array members are row-scoped. */
export function tokenForPath(path: string): string {
  const index = path.indexOf('[]')
  if (index === -1) return `{{${path}}}`
  // `items[].sku` -> `{{item.sku}}`
  return `{{item${path.slice(index + 2)}}}`
}

/** Turns typed input into a JSON value: `1200` -> number, `true` -> boolean. */
export function coerceSampleValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === '') return ''
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  const asNumber = Number(trimmed)
  if (Number.isFinite(asNumber) && /^-?\d*\.?\d+$/.test(trimmed)) return asNumber
  return trimmed
}

/**
 * Type for a declared `TemplateVariable`. A null sample tells us nothing about
 * the intended type, so it collapses to `string` — the safest default for a
 * contract that has to survive whatever the calling application sends.
 */
export function inferVariableType(value: unknown): VariableType {
  const type = valueType(value)
  return type === 'null' ? 'string' : type
}

/** Every array path in the payload — the valid sources for a table or repeater. */
export function arraySources(data: ReportData): string[] {
  const out: string[] = []
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      out.push(path)
      return
    }
    if (isPlainObject(value)) {
      for (const [k, v] of Object.entries(value)) visit(v, path ? `${path}.${k}` : k)
    }
  }
  for (const [k, v] of Object.entries(data)) visit(v, k)
  return out
}
