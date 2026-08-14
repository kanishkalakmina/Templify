/**
 * Element factories — the schema-side half of the component library.
 *
 * Given an element type, produce a well-formed `TemplateElement` with sensible
 * defaults. Kept separate from the editor's visual registry (icons, renderers,
 * property sections) so this stays React-free and reusable by the render server
 * and by template seed data.
 *
 * Adding a new element type starts here; see architecture NFR-011.
 */

import type { ElementStyle, ElementType, Margins, TemplateElement } from '@/types/template'
import { uid } from '@/utils/id'

export interface ElementDefaults {
  label: string
  width: number
  height: number
}

/** Default footprint and display name per element type. */
export const ELEMENT_DEFAULTS: Record<ElementType, ElementDefaults> = {
  text: { label: 'Text', width: 220, height: 24 },
  heading: { label: 'Heading', width: 320, height: 40 },
  richText: { label: 'Rich Text', width: 320, height: 96 },
  image: { label: 'Image', width: 180, height: 120 },
  logo: { label: 'Logo', width: 140, height: 48 },
  divider: { label: 'Divider', width: 400, height: 1 },
  spacer: { label: 'Spacer', width: 200, height: 24 },

  table: { label: 'Table', width: 500, height: 180 },
  dataGrid: { label: 'Data Grid', width: 500, height: 180 },
  repeater: { label: 'Repeater', width: 480, height: 96 },
  keyValue: { label: 'Key / Value', width: 260, height: 96 },
  list: { label: 'List', width: 260, height: 96 },

  chart: { label: 'Chart', width: 320, height: 200 },
  kpi: { label: 'KPI Card', width: 180, height: 96 },
  progress: { label: 'Progress Bar', width: 260, height: 32 },
  badge: { label: 'Badge', width: 96, height: 24 },

  qrCode: { label: 'QR Code', width: 96, height: 96 },
  barcode: { label: 'Barcode', width: 200, height: 64 },
  pageNumber: { label: 'Page Number', width: 160, height: 20 },
  date: { label: 'Date', width: 180, height: 20 },
  signature: { label: 'Signature', width: 200, height: 72 },

  container: { label: 'Container', width: 360, height: 180 },
  columns: { label: 'Columns', width: 500, height: 160 },
  section: { label: 'Section', width: 500, height: 200 },
  header: { label: 'Header', width: 500, height: 96 },
  footer: { label: 'Footer', width: 500, height: 64 },
}

const NO_PADDING: Margins = { top: 0, right: 0, bottom: 0, left: 0 }

const BASE_TEXT_STYLE: ElementStyle = {
  fontFamily: 'Inter, Helvetica Neue, Arial, sans-serif',
  fontSize: 11,
  fontWeight: 400,
  color: '#1F2937',
  textAlign: 'left',
  lineHeight: 1.45,
  padding: NO_PADDING,
}

/** The document-side palette used by generated defaults. Not the app chrome. */
const DOC = {
  ink: '#1F2937',
  inkSoft: '#64748B',
  line: '#E2E8F0',
  lineSoft: '#F1F5F9',
  accent: '#2F5BFF',
} as const

export interface CreateElementOptions {
  x?: number
  y?: number
  width?: number
  height?: number
  accent?: string
}

export function createElement(type: ElementType, options: CreateElementOptions = {}): TemplateElement {
  const defaults = ELEMENT_DEFAULTS[type]
  const accent = options.accent ?? DOC.accent

  return {
    id: uid('el'),
    type,
    name: defaults.label,
    x: Math.round(options.x ?? 0),
    y: Math.round(options.y ?? 0),
    width: Math.round(options.width ?? defaults.width),
    height: Math.round(options.height ?? defaults.height),
    style: styleFor(type, accent),
    content: contentFor(type),
    props: propsFor(type, accent),
  }
}

/* -------------------------------------------------------------------------- */
/* Per-type defaults                                                           */
/* -------------------------------------------------------------------------- */

function styleFor(type: ElementType, accent: string): ElementStyle {
  switch (type) {
    case 'heading':
      return { ...BASE_TEXT_STYLE, fontSize: 22, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }
    case 'richText':
      return { ...BASE_TEXT_STYLE, lineHeight: 1.6 }
    case 'divider':
      return { ...BASE_TEXT_STYLE, borderWidth: 1, borderColor: DOC.line, borderStyle: 'solid' }
    case 'badge':
      return {
        ...BASE_TEXT_STYLE,
        fontSize: 9,
        fontWeight: 600,
        color: '#FFFFFF',
        background: accent,
        borderRadius: 999,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        padding: { top: 4, right: 10, bottom: 4, left: 10 },
      }
    case 'kpi':
      return {
        ...BASE_TEXT_STYLE,
        background: DOC.lineSoft,
        borderRadius: 8,
        padding: { top: 12, right: 14, bottom: 12, left: 14 },
      }
    case 'container':
    case 'section':
      return {
        ...BASE_TEXT_STYLE,
        borderWidth: 1,
        borderColor: DOC.line,
        borderStyle: 'solid',
        borderRadius: 6,
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
      }
    case 'header':
    case 'footer':
      return { ...BASE_TEXT_STYLE, color: DOC.inkSoft, fontSize: 9 }
    case 'pageNumber':
    case 'date':
      return { ...BASE_TEXT_STYLE, fontSize: 9, color: DOC.inkSoft }
    case 'signature':
      return { ...BASE_TEXT_STYLE, fontSize: 9, color: DOC.inkSoft, textAlign: 'center' }
    case 'table':
    case 'dataGrid':
      return { ...BASE_TEXT_STYLE, fontSize: 10 }
    default:
      return { ...BASE_TEXT_STYLE }
  }
}

function contentFor(type: ElementType): string | undefined {
  switch (type) {
    case 'text':
      return 'Text'
    case 'heading':
      return 'Heading'
    case 'richText':
      return 'Add descriptive copy here. Bindings such as {{customer.name}} work in rich text too.'
    case 'badge':
      return 'Paid'
    case 'spacer':
    case 'divider':
      return undefined
    default:
      return undefined
  }
}

function propsFor(type: ElementType, accent: string) {
  switch (type) {
    case 'logo':
      return {
        logo: {
          source: 'variable' as const,
          variable: '{{company.logo}}',
          fit: 'contain' as const,
          align: 'left' as const,
          autoHeight: true,
        },
      }

    case 'image':
      return {
        image: {
          source: 'url' as const,
          url: '',
          fit: 'contain' as const,
          alt: 'Image',
        },
      }

    case 'table':
    case 'dataGrid':
      return {
        table: {
          dataSource: 'items',
          columns: [
            { id: uid('col'), header: 'Item', binding: '{{item.name}}', width: 3, align: 'left' as const, format: 'text' as const },
            { id: uid('col'), header: 'Qty', binding: '{{item.quantity}}', width: 1, align: 'center' as const, format: 'integer' as const },
            { id: uid('col'), header: 'Price', binding: '{{item.price}}', width: 1.4, align: 'right' as const, format: 'number' as const },
            { id: uid('col'), header: 'Total', binding: '{{item.total}}', width: 1.4, align: 'right' as const, format: 'number' as const },
          ],
          headerBackground: DOC.lineSoft,
          headerColor: '#0F172A',
          headerFontSize: 9,
          headerFontWeight: 600,
          headerUppercase: true,
          rowHeight: 30,
          fontSize: 10,
          cellPaddingX: 10,
          cellPaddingY: 8,
          zebra: false,
          zebraColor: '#FAFBFC',
          borderMode: 'horizontal' as const,
          borderColor: DOC.line,
          rowColor: DOC.ink,
          emptyText: 'No items',
        },
      }

    case 'repeater':
      return {
        repeater: {
          dataSource: 'items',
          direction: 'vertical' as const,
          gap: 8,
          previewLimit: 6,
        },
      }

    case 'keyValue':
      return {
        keyValue: {
          rows: [
            { id: uid('kv'), label: 'Subtotal', value: '{{invoice.subtotal}}', format: 'number' as const },
            { id: uid('kv'), label: 'Tax', value: '{{invoice.tax}}', format: 'number' as const },
            { id: uid('kv'), label: 'Total', value: '{{invoice.total}}', format: 'number' as const },
          ],
          labelWidth: 55,
          labelColor: DOC.inkSoft,
          valueColor: DOC.ink,
          labelWeight: 400,
          valueWeight: 500,
          rowGap: 8,
          divider: false,
          dividerColor: DOC.line,
          valueAlign: 'right' as const,
        },
      }

    case 'list':
      return {
        list: {
          dataSource: 'items',
          itemBinding: '{{item.name}}',
          marker: 'disc' as const,
          gap: 6,
        },
      }

    case 'chart':
      return {
        chart: {
          kind: 'bar' as const,
          dataSource: 'items',
          labelBinding: '{{item.name}}',
          valueBinding: '{{item.total}}',
          palette: [accent, '#8B95FF', '#A5ADFF', '#C7CCFF'],
          showGrid: true,
          showValues: false,
          showLegend: false,
        },
      }

    case 'kpi':
      return {
        kpi: {
          label: 'Total',
          value: '{{invoice.total}}',
          caption: '',
          format: 'currency' as const,
          accent,
        },
      }

    case 'progress':
      return {
        progress: {
          value: '{{invoice.total}}',
          max: 100,
          color: accent,
          trackColor: DOC.lineSoft,
          showLabel: true,
          thickness: 8,
        },
      }

    case 'badge':
      return { badge: { tone: 'accent' as const, pill: true } }

    case 'qrCode':
    case 'barcode':
      return {
        code: {
          value: '{{invoice.number}}',
          foreground: '#0F172A',
          background: '#FFFFFF',
          showValue: type === 'barcode',
        },
      }

    case 'pageNumber':
      return { pageNumber: { format: 'Page {n} of {total}' } }

    case 'date':
      return {
        date: {
          source: 'now' as const,
          value: '',
          pattern: 'medium' as const,
          prefix: '',
        },
      }

    case 'signature':
      return {
        signature: {
          label: 'Authorised Signature',
          caption: '',
          lineColor: '#94A3B8',
        },
      }

    case 'columns':
      return { columns: { count: 2, gap: 24 } }

    default:
      return undefined
  }
}

/* -------------------------------------------------------------------------- */
/* Tree helpers                                                                */
/* -------------------------------------------------------------------------- */

/** Container-like types accept children. */
export function acceptsChildren(type: ElementType): boolean {
  return (
    type === 'container' ||
    type === 'section' ||
    type === 'columns' ||
    type === 'header' ||
    type === 'footer' ||
    type === 'repeater'
  )
}

/** Deep-copies an element subtree with fresh ids — used by duplicate and paste. */
export function cloneElement(element: TemplateElement, offset = { x: 0, y: 0 }): TemplateElement {
  const copy: TemplateElement = {
    ...element,
    id: uid('el'),
    x: element.x + offset.x,
    y: element.y + offset.y,
    style: { ...element.style },
    props: element.props ? JSON.parse(JSON.stringify(element.props)) : undefined,
    conditions: element.conditions ? [...element.conditions] : undefined,
  }
  if (element.children?.length) {
    copy.children = element.children.map((child) => cloneElement(child))
  }
  return copy
}

/** Depth-first walk over an element tree. */
export function walkElements(
  elements: TemplateElement[],
  visit: (element: TemplateElement, parent: TemplateElement | null) => void,
  parent: TemplateElement | null = null,
): void {
  for (const element of elements) {
    visit(element, parent)
    if (element.children?.length) walkElements(element.children, visit, element)
  }
}

export function findElement(elements: TemplateElement[], id: string): TemplateElement | undefined {
  for (const element of elements) {
    if (element.id === id) return element
    if (element.children?.length) {
      const found = findElement(element.children, id)
      if (found) return found
    }
  }
  return undefined
}

/** Returns a new tree with `id` replaced by `updater`'s result. Immutable. */
export function updateElement(
  elements: TemplateElement[],
  id: string,
  updater: (element: TemplateElement) => TemplateElement,
): TemplateElement[] {
  return elements.map((element) => {
    if (element.id === id) return updater(element)
    if (element.children?.length) {
      return { ...element, children: updateElement(element.children, id, updater) }
    }
    return element
  })
}

/** Returns a new tree without `ids`. Immutable. */
export function removeElements(elements: TemplateElement[], ids: Set<string>): TemplateElement[] {
  return elements
    .filter((element) => !ids.has(element.id))
    .map((element) =>
      element.children?.length
        ? { ...element, children: removeElements(element.children, ids) }
        : element,
    )
}
