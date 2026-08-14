/**
 * The rendering pipeline hub.
 *
 *     (ReportTemplate + ReportData) -> ResolvedDocument
 *
 * A `ResolvedDocument` is a flat-ish, fully-resolved description of what should
 * appear on the page: bindings interpolated, conditions evaluated, repeaters and
 * table rows expanded, boxes computed.
 *
 * Four consumers share this one projection — the editing canvas, the clean
 * preview, the library thumbnails and (later) the server's HTML/PDF output.
 * That is what makes "what you see is what renders" structural rather than a
 * promise maintained by hand. See architecture NFR-002.
 *
 * No React.
 */

import type { ReportData } from '@/types/data'
import type {
  ChartConfig,
  ElementProps,
  FormatKind,
  ElementStyle,
  ElementType,
  KeyValueConfig,
  PageSettings,
  ReportTemplate,
  TableConfig,
  TemplateElement,
  TextAlign,
} from '@/types/template'
import type { BindingScope } from './binding'
import {
  documentLabel,
  hasBinding,
  interpolate,
  isSingleToken,
  itemScope,
  parseToken,
  resolveArray,
  resolvePath,
  resolveValue,
  rootScope,
} from './binding'
import { evaluateConditions } from './conditions'
import { formatValue, toNumber } from '@/utils/format'
import { pageBox } from '@/utils/page'
import { resolveLocale, type LocaleCode, type Script } from '@/i18n/locales'

/* -------------------------------------------------------------------------- */
/* Resolved shapes                                                             */
/* -------------------------------------------------------------------------- */

/**
 * `edit` keeps elements whose conditions fail (dimmed, still selectable) and
 * shows unresolved tokens so the author can see their bindings.
 * `print` drops them and renders empty strings.
 */
export type RenderMode = 'edit' | 'print'

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface ResolvedTableColumn {
  id: string
  header: string
  /** Fraction of the table width, already normalised. */
  widthFraction: number
  align: TextAlign
}

export interface ResolvedTableRow {
  key: string
  index: number
  cells: string[]
}

export interface ResolvedTable {
  config: TableConfig
  columns: ResolvedTableColumn[]
  rows: ResolvedTableRow[]
  isEmpty: boolean
}

export interface ResolvedChartPoint {
  label: string
  value: number
}

export interface ResolvedChart {
  config: ChartConfig
  points: ResolvedChartPoint[]
  max: number
  total: number
}

export interface ResolvedKeyValueRow {
  id: string
  label: string
  value: string
}

export interface ResolvedNode {
  /** Unique per rendered instance — repeated nodes append their iteration. */
  key: string
  elementId: string
  type: ElementType
  box: Box
  style: ElementStyle
  /** Fully resolved display text for text-bearing elements. */
  text: string
  props?: ElementProps
  table?: ResolvedTable
  chart?: ResolvedChart
  keyValue?: ResolvedKeyValueRow[]
  list?: string[]
  /** Raw resolved value where a non-string is needed (progress, KPI). */
  value?: unknown
  /** Resolved image/logo source, whatever the configured source mode. */
  imageSrc?: string
  children?: ResolvedNode[]
  /** True when produced by a repeater iteration. */
  repeated?: boolean
  repeatIndex?: number
  /** Conditions failed. Only ever true in `edit` mode. */
  conditionFailed?: boolean
  /** Back-reference so the canvas can map a hit back to the template. */
  source: TemplateElement
}

export interface ResolvedDocument {
  page: PageSettings
  width: number
  height: number
  mode: RenderMode
  /** Locale the document was rendered in. */
  locale: LocaleCode
  /** Writing system, so a renderer knows which fonts it must supply. */
  script: Script
  direction: 'ltr' | 'rtl'
  nodes: ResolvedNode[]
  /** Paths referenced by the template but absent from the data. */
  missingBindings: string[]
}

export interface ResolveOptions {
  mode?: RenderMode
  /** ISO code or bare symbol for `currency` values. Auto-detected when omitted. */
  currency?: string
  /** Document language. Falls back to English for anything unrecognised. */
  locale?: LocaleCode | string
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

export function resolveDocument(
  template: ReportTemplate,
  data: ReportData,
  options: ResolveOptions = {},
): ResolvedDocument {
  const mode = options.mode ?? 'edit'
  // An explicit locale wins; otherwise the payload may carry one.
  const meta = resolveLocale(options.locale ?? detectLocale(data))
  const currency = options.currency ?? detectCurrency(data) ?? meta.currency
  const scope = rootScope(data)
  const missing = new Set<string>()

  const ctx: ResolveContext = { mode, currency, missing, locale: meta.code }
  const nodes = resolveElements(template.elements, scope, ctx, 0, 0, '')

  const { width, height } = pageBox(template.page)
  return {
    page: template.page,
    width,
    height,
    mode,
    locale: meta.code,
    script: meta.script,
    direction: meta.direction,
    nodes,
    missingBindings: [...missing],
  }
}

interface ResolveContext {
  mode: RenderMode
  currency: string
  missing: Set<string>
  locale: LocaleCode
}

/** Picks up a currency symbol from common payload locations. */
function detectCurrency(data: ReportData): string | undefined {
  const candidates = ['currency', 'invoice.currency', 'company.currency', 'settings.currency']
  const scope = rootScope(data)
  for (const path of candidates) {
    const value = resolvePath(scope, path)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

/**
 * Lets a payload carry its own language, so an application can drive the
 * document locale from the customer record without a separate API field.
 */
function detectLocale(data: ReportData): string | undefined {
  const candidates = ['locale', 'language', 'customer.locale', 'customer.language', 'invoice.locale']
  const scope = rootScope(data)
  for (const path of candidates) {
    const value = resolvePath(scope, path)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

/* -------------------------------------------------------------------------- */
/* Element walking                                                             */
/* -------------------------------------------------------------------------- */

function resolveElements(
  elements: TemplateElement[],
  scope: BindingScope,
  ctx: ResolveContext,
  offsetX: number,
  offsetY: number,
  keyPrefix: string,
): ResolvedNode[] {
  const out: ResolvedNode[] = []

  for (const element of elements) {
    if (element.hidden && ctx.mode === 'print') continue

    const passes = evaluateConditions(element.conditions, scope)
    if (!passes && ctx.mode === 'print') continue

    if (element.type === 'repeater') {
      out.push(...expandRepeater(element, scope, ctx, offsetX, offsetY, keyPrefix))
      continue
    }

    const node = resolveElement(element, scope, ctx, offsetX, offsetY, keyPrefix)
    if (!passes) node.conditionFailed = true
    out.push(node)
  }

  return out
}

function resolveElement(
  element: TemplateElement,
  scope: BindingScope,
  ctx: ResolveContext,
  offsetX: number,
  offsetY: number,
  keyPrefix: string,
): ResolvedNode {
  const box: Box = {
    x: element.x + offsetX,
    y: element.y + offsetY,
    width: element.width,
    height: element.height,
  }

  const node: ResolvedNode = {
    key: keyPrefix ? `${keyPrefix}:${element.id}` : element.id,
    elementId: element.id,
    type: element.type,
    box,
    style: element.style,
    text: resolveText(element, scope, ctx),
    props: element.props,
    source: element,
  }

  switch (element.type) {
    case 'table':
    case 'dataGrid':
      node.table = resolveTable(element, scope, ctx)
      break
    case 'chart':
      node.chart = resolveChart(element, scope, ctx)
      break
    case 'keyValue':
      node.keyValue = resolveKeyValue(element, scope, ctx)
      break
    case 'list':
      node.list = resolveList(element, scope, ctx)
      break
    case 'logo':
    case 'image':
      node.imageSrc = resolveImageSource(element, scope, ctx)
      break
    case 'progress':
    case 'kpi':
      node.value = resolveNumericValue(element, scope, ctx)
      break
    default:
      break
  }

  if (element.children?.length) {
    node.children = resolveElements(element.children, scope, ctx, box.x, box.y, node.key)
  }

  return node
}

/* -------------------------------------------------------------------------- */
/* Repeaters                                                                   */
/* -------------------------------------------------------------------------- */

function expandRepeater(
  element: TemplateElement,
  scope: BindingScope,
  ctx: ResolveContext,
  offsetX: number,
  offsetY: number,
  keyPrefix: string,
): ResolvedNode[] {
  const config = element.props?.repeater
  const children = element.children ?? []
  if (!config || !children.length) return []

  const items = resolveArray(config.dataSource, scope)
  const limit = ctx.mode === 'edit' ? Math.max(1, config.previewLimit) : items.length
  const visible = items.slice(0, limit)

  // An empty source still shows one placeholder iteration while editing, so the
  // row remains visible and selectable.
  if (!visible.length && ctx.mode === 'edit') {
    return resolveElements(children, scope, ctx, element.x + offsetX, element.y + offsetY, `${keyPrefix}${element.id}#0`)
  }

  const stride = repeatStride(element, config.gap, config.direction)
  const out: ResolvedNode[] = []

  visible.forEach((item, index) => {
    const childScope = itemScope(scope, item, index, items.length)
    const dx = config.direction === 'horizontal' ? index * stride : 0
    const dy = config.direction === 'vertical' ? index * stride : 0
    const nodes = resolveElements(
      children,
      childScope,
      ctx,
      element.x + offsetX + dx,
      element.y + offsetY + dy,
      `${keyPrefix}${element.id}#${index}`,
    )
    for (const n of nodes) {
      n.repeated = true
      n.repeatIndex = index
    }
    out.push(...nodes)
  })

  return out
}

/** Distance between iterations: the content extent plus the configured gap. */
function repeatStride(element: TemplateElement, gap: number, direction: 'vertical' | 'horizontal'): number {
  const children = element.children ?? []
  if (!children.length) return gap
  const extent =
    direction === 'horizontal'
      ? Math.max(...children.map((c) => c.x + c.width))
      : Math.max(...children.map((c) => c.y + c.height))
  return extent + gap
}

/* -------------------------------------------------------------------------- */
/* Field resolution                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Resolves a field that may hold a token, mixed text, or plain literal text.
 *
 * The distinction matters: a table cell or key/value row is *content*, so
 * "Bank Transfer" is the text to print — not a path to look up. Treating every
 * non-token string as a path silently blanked any literal an author typed.
 */
function resolveField(
  expression: string | undefined,
  scope: BindingScope,
  format: FormatKind,
  ctx: ResolveContext,
): string {
  if (!expression) return ''
  const trimmed = expression.trim()

  // No bindings at all — literal text, passed through untouched.
  if (!hasBinding(trimmed)) return trimmed

  // Exactly one token: resolve to the raw value so the column/row format can
  // apply to a real number or date rather than to its string form.
  if (isSingleToken(trimmed)) {
    const { path, format: inline } = parseToken(trimmed.slice(2, -2))

    // A translated label is text, not data — it must be resolved here too, or a
    // `{{@t.*}}` used as a *value* (rather than a header) renders blank.
    const label = documentLabel(path, ctx.locale)
    if (label !== null) return label

    trackMissing(trimmed, scope, ctx)
    const value = resolvePath(scope, path)
    if (value === undefined || value === null) return ctx.mode === 'edit' ? trimmed : ''
    return formatValue(value, inline ?? format, { currency: ctx.currency, locale: ctx.locale })
  }

  // Literal text with tokens embedded in it.
  trackMissing(trimmed, scope, ctx)
  return interpolate(trimmed, scope, {
    currency: ctx.currency,
    locale: ctx.locale,
    onMissing: ctx.mode === 'edit' ? 'token' : 'empty',
  })
}

/* -------------------------------------------------------------------------- */
/* Per-type resolution                                                         */
/* -------------------------------------------------------------------------- */

function resolveText(element: TemplateElement, scope: BindingScope, ctx: ResolveContext): string {
  trackMissing(element.content, scope, ctx)

  if (element.dataBinding) {
    trackMissing(element.dataBinding, scope, ctx)
    const value = resolveValue(element.dataBinding, scope)
    if (value !== undefined && value !== null) return formatValue(value, 'text', { currency: ctx.currency, locale: ctx.locale })
    return ctx.mode === 'edit' ? element.dataBinding : ''
  }

  // A KPI carries its value in props, not in `content`, so it needs resolving
  // here or the card renders with a label and nothing under it.
  if (element.type === 'kpi') {
    const kpi = element.props?.kpi
    if (kpi?.value) return resolveField(kpi.value, scope, kpi.format, ctx)
    return ''
  }

  if (element.type === 'pageNumber') {
    const format = element.props?.pageNumber?.format ?? 'Page {n} of {total}'
    // Single-page prototype: pagination is a server-render concern (see R-6).
    return format.replace('{n}', '1').replace('{total}', '1')
  }

  if (element.type === 'date') {
    const config = element.props?.date
    if (config?.source === 'binding' && config.value) {
      const value = resolveValue(config.value, scope)
      return `${config.prefix ?? ''}${formatValue(value, 'date', { currency: ctx.currency, locale: ctx.locale })}`
    }
    return `${config?.prefix ?? ''}${formatValue(new Date().toISOString(), 'date', { currency: ctx.currency, locale: ctx.locale })}`
  }

  return interpolate(element.content, scope, {
    currency: ctx.currency,
    locale: ctx.locale,
    onMissing: ctx.mode === 'edit' ? 'token' : 'empty',
  })
}

function resolveTable(element: TemplateElement, scope: BindingScope, ctx: ResolveContext): ResolvedTable {
  const config = element.props?.table ?? defaultTableConfig()
  const items = resolveArray(config.dataSource, scope)

  const totalWeight = config.columns.reduce((sum, c) => sum + (c.width > 0 ? c.width : 1), 0) || 1
  const columns: ResolvedTableColumn[] = config.columns.map((c) => ({
    id: c.id,
    header: interpolate(c.header, scope, { currency: ctx.currency, locale: ctx.locale }),
    widthFraction: (c.width > 0 ? c.width : 1) / totalWeight,
    align: c.align,
  }))

  const rows: ResolvedTableRow[] = items.map((item, index) => {
    const rowScope = itemScope(scope, item, index, items.length)
    return {
      key: `${element.id}-row-${index}`,
      index,
      cells: config.columns.map((column) =>
        resolveField(column.binding, rowScope, column.format, ctx),
      ),
    }
  })

  return { config, columns, rows, isEmpty: rows.length === 0 }
}

function resolveChart(element: TemplateElement, scope: BindingScope, ctx: ResolveContext): ResolvedChart {
  const config = element.props?.chart ?? defaultChartConfig()
  const items = resolveArray(config.dataSource, scope)

  const points: ResolvedChartPoint[] = items.map((item, index) => {
    const rowScope = itemScope(scope, item, index, items.length)
    const label = interpolate(config.labelBinding, rowScope, { currency: ctx.currency, locale: ctx.locale }) || `#${index + 1}`
    const value = toNumber(resolveValue(config.valueBinding, rowScope)) ?? 0
    return { label, value }
  })

  const max = points.reduce((m, p) => Math.max(m, p.value), 0)
  const total = points.reduce((s, p) => s + p.value, 0)
  return { config, points, max, total }
}

function resolveKeyValue(
  element: TemplateElement,
  scope: BindingScope,
  ctx: ResolveContext,
): ResolvedKeyValueRow[] {
  const config: KeyValueConfig | undefined = element.props?.keyValue
  if (!config) return []
  return config.rows.map((row) => ({
    id: row.id,
    label: interpolate(row.label, scope, { currency: ctx.currency, locale: ctx.locale }),
    value: resolveField(row.value, scope, row.format, ctx),
  }))
}

function resolveList(element: TemplateElement, scope: BindingScope, ctx: ResolveContext): string[] {
  const config = element.props?.list
  if (!config) return []
  const items = resolveArray(config.dataSource, scope)
  return items.map((item, index) => {
    const rowScope = itemScope(scope, item, index, items.length)
    return interpolate(config.itemBinding, rowScope, { currency: ctx.currency, locale: ctx.locale })
  })
}

function resolveImageSource(
  element: TemplateElement,
  scope: BindingScope,
  ctx: ResolveContext,
): string {
  const config = element.type === 'logo' ? element.props?.logo : element.props?.image
  if (!config) return ''
  switch (config.source) {
    case 'upload':
      return config.upload ?? ''
    case 'url':
      return config.url ?? ''
    case 'variable': {
      if (!config.variable) return ''
      trackMissing(config.variable, scope, ctx)
      const value = resolveValue(config.variable, scope)
      return typeof value === 'string' ? value : ''
    }
    default:
      return ''
  }
}

function resolveNumericValue(
  element: TemplateElement,
  scope: BindingScope,
  ctx: ResolveContext,
): number | null {
  const binding =
    element.type === 'progress' ? element.props?.progress?.value : element.props?.kpi?.value
  if (!binding) return null
  trackMissing(binding, scope, ctx)
  return toNumber(resolveValue(binding, scope))
}

/* -------------------------------------------------------------------------- */
/* Diagnostics                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Records bindings that resolve to nothing. The editor surfaces these, and the
 * server will use the same signal to return a precise 422 instead of silently
 * rendering blanks (architecture, Future Considerations #4).
 */
function trackMissing(text: string | undefined, scope: BindingScope, ctx: ResolveContext): void {
  if (!text) return
  for (const match of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const path = match[1].split('|')[0].trim()
    if (!path) continue
    // `@`-prefixed paths are reserved namespaces — translated labels (`@t.*`)
    // and row metadata (`@index`) — not payload paths, so they can never be
    // "missing" and must not pollute the diagnostic an integrator relies on.
    if (path.startsWith('@')) continue
    const value = resolvePath(scope, path)
    if (value === undefined) ctx.missing.add(path)
  }
}

/* -------------------------------------------------------------------------- */
/* Fallbacks                                                                   */
/* -------------------------------------------------------------------------- */

function defaultTableConfig(): TableConfig {
  return {
    dataSource: 'items',
    columns: [],
    headerBackground: '#F1F5F9',
    headerColor: '#0F172A',
    headerFontSize: 9,
    headerFontWeight: 600,
    headerUppercase: true,
    rowHeight: 28,
    fontSize: 10,
    cellPaddingX: 10,
    cellPaddingY: 8,
    zebra: false,
    zebraColor: '#F8FAFC',
    borderMode: 'horizontal',
    borderColor: '#E2E8F0',
    rowColor: '#1F2937',
    emptyText: 'No items',
  }
}

function defaultChartConfig(): ChartConfig {
  return {
    kind: 'bar',
    dataSource: 'items',
    labelBinding: '{{item.name}}',
    valueBinding: '{{item.total}}',
    palette: ['#6E7BFF', '#8B95FF', '#A5ADFF'],
    showGrid: true,
    showValues: false,
    showLegend: false,
  }
}
