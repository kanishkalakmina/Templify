/**
 * The component library's visual metadata.
 *
 * This is the *presentation* half of the element registry; the schema half
 * (default sizes, styles and props) lives in `services/elementFactory`. Adding
 * an element type means one entry in each — and nothing else in the editor
 * changes (architecture NFR-011, component C-5).
 */

import {
  AlignLeft,
  BadgeCheck,
  Barcode,
  Building2,
  Calendar,
  ChartColumn,
  Columns2,
  FileText,
  Gauge,
  Heading1,
  Image,
  LayoutGrid,
  LayoutPanelLeft,
  List,
  ListTree,
  Minus,
  MoveVertical,
  PanelBottom,
  PanelTop,
  PenLine,
  Percent,
  QrCode,
  Repeat,
  Square,
  Table,
  Type,
  type LucideIcon,
} from 'lucide-react'
import type { ElementType } from '@/types/template'

export interface PaletteItem {
  type: ElementType
  label: string
  icon: LucideIcon
}

export interface PaletteGroup {
  name: string
  items: PaletteItem[]
}

export const PALETTE: PaletteGroup[] = [
  {
    name: 'BASIC',
    items: [
      { type: 'text', label: 'Text', icon: Type },
      { type: 'heading', label: 'Heading', icon: Heading1 },
      { type: 'richText', label: 'Rich Text', icon: AlignLeft },
      { type: 'image', label: 'Image', icon: Image },
      { type: 'logo', label: 'Logo', icon: Building2 },
      { type: 'divider', label: 'Divider', icon: Minus },
      { type: 'spacer', label: 'Spacer', icon: MoveVertical },
    ],
  },
  {
    name: 'DATA',
    items: [
      { type: 'table', label: 'Table', icon: Table },
      { type: 'dataGrid', label: 'Data Grid', icon: LayoutGrid },
      { type: 'repeater', label: 'Repeater', icon: Repeat },
      { type: 'keyValue', label: 'Key / Value', icon: ListTree },
      { type: 'list', label: 'List', icon: List },
    ],
  },
  {
    name: 'VISUAL',
    items: [
      { type: 'chart', label: 'Chart', icon: ChartColumn },
      { type: 'kpi', label: 'KPI Card', icon: Gauge },
      { type: 'progress', label: 'Progress', icon: Percent },
      { type: 'badge', label: 'Badge', icon: BadgeCheck },
    ],
  },
  {
    name: 'UTILITIES',
    items: [
      { type: 'qrCode', label: 'QR Code', icon: QrCode },
      { type: 'barcode', label: 'Barcode', icon: Barcode },
      { type: 'pageNumber', label: 'Page Number', icon: FileText },
      { type: 'date', label: 'Date', icon: Calendar },
      { type: 'signature', label: 'Signature', icon: PenLine },
    ],
  },
  {
    name: 'LAYOUT',
    items: [
      { type: 'container', label: 'Container', icon: Square },
      { type: 'columns', label: 'Columns', icon: Columns2 },
      { type: 'section', label: 'Section', icon: LayoutPanelLeft },
      { type: 'header', label: 'Header', icon: PanelTop },
      { type: 'footer', label: 'Footer', icon: PanelBottom },
    ],
  },
]

const LABELS = new Map<ElementType, string>(
  PALETTE.flatMap((group) => group.items.map((item) => [item.type, item.label] as const)),
)

export function elementLabel(type: ElementType): string {
  return LABELS.get(type) ?? 'Element'
}

/** MIME-ish key for palette drags onto the canvas. */
export const DRAG_TYPE = 'application/x-templify-element'
