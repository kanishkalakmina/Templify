/**
 * Templify template schema.
 *
 * This module is deliberately free of React (and of any DOM concern). It is the
 * contract shared by the editor, the renderer, the import/export service and —
 * eventually — the Docker render server. Anything that can be persisted to a
 * `.templify` file lives here.
 */

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export type PageSize = 'A4' | 'A5' | 'LETTER'
export type Orientation = 'portrait' | 'landscape'

export interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface PageSettings {
  size: PageSize
  orientation: Orientation
  margins: Margins
  /** Document background. The canvas is a printable page, so this defaults to white. */
  background: string
}

/* -------------------------------------------------------------------------- */
/* Elements                                                                    */
/* -------------------------------------------------------------------------- */

export type ElementType =
  // Basic
  | 'text'
  | 'heading'
  | 'richText'
  | 'image'
  | 'logo'
  | 'divider'
  | 'spacer'
  // Data
  | 'table'
  | 'dataGrid'
  | 'repeater'
  | 'keyValue'
  | 'list'
  // Visual
  | 'chart'
  | 'kpi'
  | 'progress'
  | 'badge'
  // Utilities
  | 'qrCode'
  | 'barcode'
  | 'pageNumber'
  | 'date'
  | 'signature'
  // Layout
  | 'container'
  | 'columns'
  | 'section'
  | 'header'
  | 'footer'

export type TextAlign = 'left' | 'center' | 'right' | 'justify'
export type VerticalAlign = 'top' | 'middle' | 'bottom'

export interface ElementStyle {
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  fontStyle?: 'normal' | 'italic'
  textAlign?: TextAlign
  verticalAlign?: VerticalAlign
  lineHeight?: number
  letterSpacing?: number
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  textDecoration?: 'none' | 'underline'
  color?: string
  background?: string
  borderWidth?: number
  borderColor?: string
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none'
  borderRadius?: number
  opacity?: number
  padding?: Margins
}

/** How a bound value is turned into display text. */
export type FormatKind = 'text' | 'number' | 'integer' | 'currency' | 'percent' | 'date'

export interface TableColumn {
  id: string
  header: string
  /** Usually a repeater-scoped binding such as `{{item.name}}`. */
  binding: string
  /** Relative flex weight, not pixels — keeps columns fluid when the table resizes. */
  width: number
  align: TextAlign
  format: FormatKind
}

export type TableBorderMode = 'none' | 'horizontal' | 'all' | 'outline'

export interface TableConfig {
  /** Path to an array in the report data, e.g. `items`. */
  dataSource: string
  columns: TableColumn[]
  headerBackground: string
  headerColor: string
  headerFontSize: number
  headerFontWeight: number
  headerUppercase: boolean
  rowHeight: number
  fontSize: number
  cellPaddingX: number
  cellPaddingY: number
  zebra: boolean
  zebraColor: string
  borderMode: TableBorderMode
  borderColor: string
  rowColor: string
  /** Rendered when the bound array is empty. */
  emptyText: string
}

export type LogoSource = 'upload' | 'url' | 'variable'

export interface LogoConfig {
  source: LogoSource
  /** Data URL produced by the upload control. */
  upload?: string
  url?: string
  /** e.g. `{{company.logo}}` */
  variable?: string
  fit: 'contain' | 'cover'
  align: 'left' | 'center' | 'right'
  /** When true the height follows the intrinsic aspect ratio of the source. */
  autoHeight: boolean
}

export interface ImageConfig {
  source: 'upload' | 'url' | 'variable'
  upload?: string
  url?: string
  variable?: string
  fit: 'contain' | 'cover' | 'fill'
  alt: string
}

export interface KeyValueRow {
  id: string
  label: string
  value: string
  format: FormatKind
  /** Emphasised summary row (a totals line): larger, bolder, rule above. */
  strong?: boolean
}

export interface KeyValueConfig {
  rows: KeyValueRow[]
  /** Percentage of the element width given to the label column. */
  labelWidth: number
  labelColor: string
  valueColor: string
  labelWeight: number
  valueWeight: number
  rowGap: number
  divider: boolean
  dividerColor: string
  valueAlign: TextAlign
  /** Colour used by `strong` rows — the totals line picks up the brand accent. */
  accentColor?: string
}

export interface ListConfig {
  dataSource: string
  itemBinding: string
  marker: 'disc' | 'decimal' | 'dash' | 'none'
  gap: number
}

export type ChartKind = 'bar' | 'line' | 'donut'

export interface ChartConfig {
  kind: ChartKind
  dataSource: string
  labelBinding: string
  valueBinding: string
  palette: string[]
  showGrid: boolean
  showValues: boolean
  showLegend: boolean
  /**
   * Decorative fallback series, drawn when `dataSource` resolves to nothing.
   * Report templates ship with an illustrative chart before real data is bound.
   */
  staticSeries?: number[]
}

export interface KpiConfig {
  label: string
  value: string
  caption: string
  format: FormatKind
  accent: string
}

export interface ProgressConfig {
  value: string
  max: number
  color: string
  trackColor: string
  showLabel: boolean
  thickness: number
}

export interface BadgeConfig {
  tone: 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
  pill: boolean
}

/** Shared by the `qrCode` and `barcode` element types. */
export interface CodeConfig {
  value: string
  foreground: string
  background: string
  /** Barcode only. */
  showValue: boolean
}

export interface PageNumberConfig {
  /** Supports the `{n}` and `{total}` placeholders. */
  format: string
}

export interface DateConfig {
  /** `now` uses render time; `binding` reads `value` from the data. */
  source: 'now' | 'binding'
  value: string
  pattern: 'long' | 'medium' | 'short' | 'iso'
  prefix: string
}

export interface SignatureConfig {
  label: string
  caption: string
  lineColor: string
  image?: string
}

/** Decorative page band / rule drawn behind other elements. */
export interface FrameConfig {
  fill?: string
}

export interface RepeaterConfig {
  dataSource: string
  direction: 'vertical' | 'horizontal'
  gap: number
  /** Cap used by the editor preview so a 500-row array does not lock the canvas. */
  previewLimit: number
}

export interface ColumnsConfig {
  count: number
  gap: number
}

/**
 * Element-specific configuration. Kept as a bag of optional, individually typed
 * slots rather than a discriminated union: elements can change type in the
 * editor without losing the settings of their previous type, and property
 * panels can read their own slot without narrowing or casting.
 */
export interface ElementProps {
  table?: TableConfig
  logo?: LogoConfig
  image?: ImageConfig
  keyValue?: KeyValueConfig
  list?: ListConfig
  chart?: ChartConfig
  kpi?: KpiConfig
  progress?: ProgressConfig
  badge?: BadgeConfig
  code?: CodeConfig
  pageNumber?: PageNumberConfig
  date?: DateConfig
  signature?: SignatureConfig
  repeater?: RepeaterConfig
  columns?: ColumnsConfig
}

export interface TemplateElement {
  id: string
  type: ElementType
  /** Layer name shown in the editor. Falls back to the type label. */
  name?: string
  x: number
  y: number
  width: number
  height: number
  locked?: boolean
  hidden?: boolean
  style: ElementStyle
  /** Text content; may embed `{{path}}` bindings. */
  content?: string
  /** Single-value binding used by elements that render one datum. */
  dataBinding?: string
  /** All expressions must pass for the element to render. */
  conditions?: string[]
  children?: TemplateElement[]
  props?: ElementProps
}

/* -------------------------------------------------------------------------- */
/* Template                                                                    */
/* -------------------------------------------------------------------------- */

export type TemplateCategory =
  | 'invoice'
  | 'quotation'
  | 'receipt'
  | 'report'
  | 'certificate'
  | 'hr'
  | 'other'

export type VariableType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'

export interface TemplateVariable {
  /** Dot path into the report data, e.g. `customer.name` or `items[].price`. */
  path: string
  label: string
  type: VariableType
  sample?: unknown
}

export interface TemplateBranding {
  primaryColor: string
  secondaryColor: string
  defaultLogo?: string
  defaultFooter?: string
  fontFamily: string
}

/** The versionable part of a template — everything that affects the output. */
export interface TemplateSnapshot {
  page: PageSettings
  branding: TemplateBranding
  variables: TemplateVariable[]
  elements: TemplateElement[]
}

export interface TemplateVersion {
  version: number
  createdAt: string
  note: string
  snapshot: TemplateSnapshot
}

export interface ReportTemplate extends TemplateSnapshot {
  /** The public handle applications send as `templateId`. Unique, slug-cased. */
  id: string
  name: string
  category: TemplateCategory
  description: string
  version: number
  /** Built-in templates are read-only; using one duplicates it. */
  builtIn: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
  versions: TemplateVersion[]
}

/** Shape written to a `.templify` file. Never contains customer data. */
export interface TemplateExportFile {
  format: 'templify.template'
  formatVersion: 1
  exportedAt: string
  template: Omit<ReportTemplate, 'versions' | 'builtIn' | 'archived'>
}
