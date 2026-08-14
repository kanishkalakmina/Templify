/**
 * Built-in document layouts.
 *
 * Four architectures cover the whole catalogue — `doc` (invoice / quotation /
 * receipt / delivery note / purchase order), `report`, `certificate` and
 * `payslip`. Each is a pure function producing `TemplateElement[]`, driven by a
 * small option bag, so twenty-six catalogue entries are twenty-six *option
 * sets* rather than twenty-six hand-built layouts.
 *
 * These are **data, not components** — which is what lets a built-in be
 * duplicated, versioned, exported and server-rendered like any user template.
 *
 * Geometry and styling follow the approved UI mock.
 * No React.
 */

import type {
  ElementStyle,
  KeyValueRow,
  TableColumn,
  TemplateElement,
} from '@/types/template'

const SANS = "'IBM Plex Sans', system-ui, sans-serif"
const SERIF = "'Source Serif 4', Georgia, serif"

const INK = '#334155'
const HEADING = '#0F172A'
const LABEL = '#94A3B8'
const RULE = '#E2E8F0'
const ROW_RULE = '#EDF0F5'
const HEAD_FILL = '#F4F6FB'
const ZEBRA = '#FAFBFD'

export interface LayoutOptions {
  accent?: string
  /** Reversed branding on a solid header band. */
  band?: boolean
  /** Serif display face for headings. */
  serif?: boolean
  /** No accent fills — monochrome, ruled tables. */
  plain?: boolean
  /** Oversized document title. */
  big?: boolean
  /** Include a QR block. */
  qr?: boolean
  center?: boolean
  title?: string
  itemLabel?: string
  footer?: string
}

/* -------------------------------------------------------------------------- */
/* Builders                                                                    */
/* -------------------------------------------------------------------------- */

function text(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  content: string,
  style: ElementStyle = {},
): TemplateElement {
  return {
    id,
    type: 'text',
    name: id,
    x,
    y,
    width,
    height,
    content,
    style: { fontFamily: SANS, fontSize: 11, color: INK, lineHeight: 1.5, ...style },
  }
}

function heading(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  content: string,
  style: ElementStyle = {},
): TemplateElement {
  return { ...text(id, x, y, width, height, content, style), type: 'heading' }
}

function divider(id: string, x: number, y: number, width: number, color = RULE): TemplateElement {
  return {
    id,
    type: 'divider',
    name: 'Divider',
    x,
    y,
    width,
    height: 1,
    style: { borderColor: color },
  }
}

function band(id: string, width: number, height: number, fill: string): TemplateElement {
  return {
    id,
    type: 'container',
    name: 'Header band',
    x: 0,
    y: 0,
    width,
    height,
    style: { background: fill, borderStyle: 'none' },
  }
}

function frame(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  style: ElementStyle,
): TemplateElement {
  return { id, type: 'container', name: 'Frame', x, y, width, height, style }
}

function logo(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  align: 'left' | 'center' | 'right',
  onDark: boolean,
): TemplateElement {
  return {
    id,
    type: 'logo',
    name: 'Logo',
    x,
    y,
    width,
    height,
    // `color` doubles as the placeholder tint for logos on dark bands.
    style: { color: onDark ? '#FFFFFF' : undefined },
    props: {
      logo: {
        source: 'variable',
        variable: '{{company.logo}}',
        fit: 'contain',
        align,
        autoHeight: false,
      },
    },
  }
}

function keyValue(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rows: KeyValueRow[],
  options: { gap?: number; accent?: string; divideLast?: boolean; fontSize?: number } = {},
): TemplateElement {
  return {
    id,
    type: 'keyValue',
    name: id,
    x,
    y,
    width,
    height,
    style: { fontFamily: SANS, fontSize: options.fontSize ?? 10.5, color: INK },
    props: {
      keyValue: {
        rows,
        labelWidth: 50,
        labelColor: LABEL,
        valueColor: INK,
        labelWeight: 400,
        valueWeight: 500,
        rowGap: options.gap ?? 6,
        divider: options.divideLast ?? false,
        dividerColor: RULE,
        valueAlign: 'right',
        accentColor: options.accent,
      },
    },
  }
}

function row(id: string, label: string, value: string, strong = false): KeyValueRow {
  return { id, label, value, format: 'number', strong }
}

/** Literal (non-numeric) key/value row — payment method, account number. */
function textRow(id: string, label: string, value: string): KeyValueRow {
  return { id, label, value, format: 'text' }
}

function table(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  columns: TableColumn[],
  options: { accent: string; plain?: boolean },
): TemplateElement {
  return {
    id,
    type: 'table',
    name: 'Items table',
    x,
    y,
    width,
    height,
    style: { fontFamily: SANS, fontSize: 10.5 },
    props: {
      table: {
        dataSource: 'items',
        columns,
        headerBackground: options.plain ? 'transparent' : HEAD_FILL,
        headerColor: options.plain ? HEADING : options.accent,
        headerFontSize: 9,
        headerFontWeight: 600,
        headerUppercase: true,
        rowHeight: 30,
        fontSize: 10.5,
        cellPaddingX: 9,
        cellPaddingY: 9,
        zebra: !options.plain,
        zebraColor: ZEBRA,
        borderMode: 'horizontal',
        borderColor: ROW_RULE,
        rowColor: INK,
        emptyText: 'No items',
      },
    },
  }
}

function column(
  id: string,
  header: string,
  binding: string,
  width: number,
  align: TableColumn['align'],
  format: TableColumn['format'] = 'text',
): TableColumn {
  return { id, header, binding, width, align, format }
}

function qrCode(id: string, x: number, y: number, size: number): TemplateElement {
  return {
    id,
    type: 'qrCode',
    name: 'QR Code',
    x,
    y,
    width: size,
    height: size,
    style: {},
    props: {
      code: { value: '{{invoice.number}}', foreground: HEADING, background: '#FFFFFF', showValue: false },
    },
  }
}

function signature(
  id: string,
  x: number,
  y: number,
  width: number,
  content: string,
  fontFamily: string,
): TemplateElement {
  return {
    id,
    type: 'signature',
    name: 'Signature',
    x,
    y,
    width,
    height: 60,
    content,
    style: { fontFamily, fontSize: 10, color: '#64748B' },
    props: { signature: { label: content, caption: '', lineColor: HEADING } },
  }
}

/* -------------------------------------------------------------------------- */
/* doc — invoice, quotation, receipt, delivery note, purchase order            */
/* -------------------------------------------------------------------------- */

export function docLayout(options: LayoutOptions = {}): TemplateElement[] {
  const accent = options.accent ?? '#2F6FED'
  const display = options.serif ? SERIF : SANS
  const dark = !!options.band
  const headColor = dark ? '#FFFFFF' : HEADING
  const subColor = dark ? 'rgba(255,255,255,.72)' : '#64748B'

  const elements: TemplateElement[] = []

  if (dark) elements.push(band('band', 794, 150, accent))

  elements.push(logo('logo', 48, 42, 146, 46, options.center ? 'center' : 'left', dark))

  elements.push(
    text('company', 48, 98, 300, 20, '{{company.name}}', {
      fontFamily: display,
      fontSize: 15,
      fontWeight: 600,
      color: headColor,
    }),
    text('companyMeta', 48, 120, 300, 44, '{{company.address}}\n{{company.email}} · {{company.phone}}', {
      fontSize: 10,
      color: subColor,
      lineHeight: 1.65,
    }),
    heading('docTitle', 446, 44, 300, 44, options.title ?? 'INVOICE', {
      fontFamily: display,
      fontSize: options.big ? 36 : 29,
      fontWeight: 700,
      textAlign: 'right',
      color: dark ? '#FFFFFF' : accent,
      letterSpacing: options.big ? 3 : 1.8,
    }),
    text('docNo', 446, dark ? 96 : 94, 300, 18, '{{invoice.number}}', {
      fontSize: 11.5,
      fontWeight: 600,
      textAlign: 'right',
      color: headColor,
    }),
    text('docDate', 446, dark ? 116 : 114, 300, 16, 'Issued {{invoice.date | date}}', {
      fontSize: 10,
      textAlign: 'right',
      color: subColor,
    }),
  )

  const top = dark ? 182 : 190

  elements.push(
    divider('rule1', 48, top, 698),
    text('billLbl', 48, top + 22, 240, 14, 'BILL TO', {
      fontSize: 8.5,
      fontWeight: 600,
      letterSpacing: 1.6,
      color: LABEL,
    }),
    text('bill', 48, top + 40, 262, 64, '{{customer.name}}\n{{customer.email}}\n{{customer.address}}', {
      fontSize: 11,
      lineHeight: 1.7,
    }),
    text('payLbl', 446, top + 22, 300, 14, 'PAYMENT', {
      fontSize: 8.5,
      fontWeight: 600,
      letterSpacing: 1.6,
      color: LABEL,
      textAlign: 'right',
    }),
    keyValue('pay', 446, top + 40, 300, 64, [
      { id: 'pay-due', label: 'Due', value: '{{invoice.dueDate}}', format: 'date' as const },
      textRow('pay-method', 'Method', 'Bank Transfer'),
      textRow('pay-account', 'Account', '**** **** 4021'),
    ]),
  )

  const tableY = top + 140

  elements.push(
    table(
      'items',
      48,
      tableY,
      698,
      150,
      [
        column('c-item', options.itemLabel ?? 'Item', '{{item.name}}', 0.5, 'left'),
        column('c-qty', 'Qty', '{{item.quantity}}', 0.12, 'right', 'integer'),
        column('c-price', 'Price', '{{item.price}}', 0.19, 'right', 'number'),
        column('c-total', 'Amount', '{{item.total}}', 0.19, 'right', 'number'),
      ],
      { accent, plain: options.plain },
    ),
    keyValue(
      'totals',
      446,
      tableY + 186,
      300,
      104,
      [
        row('t-sub', 'Subtotal', '{{invoice.subtotal}}'),
        row('t-disc', 'Discount', '{{invoice.discount}}'),
        row('t-tax', 'Tax', '{{invoice.tax}}'),
        row('t-total', 'Total', '{{invoice.total}}', true),
      ],
      { gap: 8, accent, divideLast: true },
    ),
  )

  if (options.qr) elements.push(qrCode('qr', 48, tableY + 188, 78))

  elements.push(
    text(
      'footer',
      48,
      1034,
      698,
      30,
      options.footer ?? 'Thank you for your business. Payment is due within 15 days.',
      { fontSize: 9.5, textAlign: 'center', color: LABEL },
    ),
  )

  return elements
}

/* -------------------------------------------------------------------------- */
/* report — business, financial, sales, monthly, audit, employee               */
/* -------------------------------------------------------------------------- */

export function reportLayout(options: LayoutOptions = {}): TemplateElement[] {
  const accent = options.accent ?? '#2F6FED'
  const display = options.serif ? SERIF : SANS

  const kpis = ['Revenue', 'Expenses', 'Net'].map((label, index) => ({
    id: `kpi${index}`,
    type: 'kpi' as const,
    name: `${label} KPI`,
    x: 48 + index * 236,
    y: 222,
    width: 216,
    height: 78,
    style: { fontFamily: SANS, background: '#F7F9FC' },
    props: {
      kpi: {
        label,
        value: index === 2 ? '{{invoice.total}}' : '{{invoice.subtotal}}',
        caption: '',
        format: 'number' as const,
        accent,
      },
    },
  }))

  return [
    logo('logo', 48, 44, 130, 40, 'left', false),
    heading('title', 48, 110, 560, 44, options.title ?? 'Business Report', {
      fontFamily: display,
      fontSize: 30,
      fontWeight: 700,
      color: HEADING,
      letterSpacing: -0.4,
    }),
    text('sub', 48, 158, 560, 20, 'Prepared for {{customer.name}} · {{invoice.date | date}}', {
      fontSize: 11,
      color: '#64748B',
    }),
    divider('rule', 48, 196, 698),
    ...kpis,
    text('s1', 48, 326, 698, 20, 'Summary', { fontSize: 13, fontWeight: 600, color: HEADING }),
    text(
      's1b',
      48,
      350,
      698,
      54,
      'This period is compared against the preceding cycle. Figures are supplied by the calling application and bound to this template at render time.',
      { fontSize: 10.5, lineHeight: 1.7, color: '#475569' },
    ),
    {
      id: 'chart',
      type: 'chart',
      name: 'Chart',
      x: 48,
      y: 420,
      width: 698,
      height: 150,
      style: {},
      props: {
        chart: {
          kind: 'bar',
          dataSource: 'items',
          labelBinding: '{{item.name}}',
          valueBinding: '{{item.total}}',
          palette: [accent],
          showGrid: false,
          showValues: false,
          showLegend: false,
          staticSeries: [42, 66, 54, 88, 71, 96, 80, 62],
        },
      },
    },
    text('s2', 48, 596, 698, 20, 'Line items', { fontSize: 13, fontWeight: 600, color: HEADING }),
    table(
      'items',
      48,
      622,
      698,
      150,
      [
        column('c-desc', 'Description', '{{item.name}}', 0.56, 'left'),
        column('c-qty', 'Qty', '{{item.quantity}}', 0.14, 'right', 'integer'),
        column('c-value', 'Value', '{{item.total}}', 0.3, 'right', 'number'),
      ],
      { accent },
    ),
    text('footer', 48, 1034, 698, 30, '{{company.name}} · Confidential', {
      fontSize: 9.5,
      textAlign: 'center',
      color: LABEL,
    }),
  ]
}

/* -------------------------------------------------------------------------- */
/* certificate                                                                 */
/* -------------------------------------------------------------------------- */

export function certificateLayout(options: LayoutOptions = {}): TemplateElement[] {
  const accent = options.accent ?? '#8B5CF6'

  const centred: ElementStyle = { fontFamily: SERIF, fontSize: 12, color: INK, textAlign: 'center' }

  return [
    frame('frame', 34, 34, 726, 1055, {
      borderWidth: 2,
      borderStyle: 'solid',
      borderColor: accent,
      borderRadius: 3,
    }),
    frame('frame2', 46, 46, 702, 1031, {
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: RULE,
    }),
    logo('logo', 322, 110, 150, 44, 'center', false),
    text('kicker', 97, 200, 600, 20, '{{company.name}}', {
      ...centred,
      fontSize: 11,
      letterSpacing: 3,
      fontWeight: 600,
      color: LABEL,
    }),
    heading('title', 97, 250, 600, 60, options.title ?? 'CERTIFICATE OF COMPLETION', {
      ...centred,
      fontSize: 34,
      fontWeight: 700,
      color: HEADING,
      letterSpacing: 1.5,
      lineHeight: 1.25,
    }),
    divider('rule', 317, 340, 160, accent),
    text('pre', 97, 372, 600, 20, 'This certifies that', {
      ...centred,
      fontSize: 11.5,
      color: '#64748B',
    }),
    heading('name', 97, 404, 600, 46, '{{customer.name}}', {
      ...centred,
      fontSize: 30,
      fontWeight: 700,
      color: accent,
    }),
    text(
      'body',
      137,
      470,
      520,
      70,
      'has successfully completed the programme of study and met all requirements set out by the awarding body.',
      { ...centred, fontSize: 11.5, lineHeight: 1.85, color: '#475569' },
    ),
    qrCode('qr', 357, 790, 80),
    signature('sig1', 120, 900, 220, 'Authorised Signature', SERIF),
    signature('sig2', 454, 900, 220, 'Issued {{invoice.date | date}}', SERIF),
  ]
}

/* -------------------------------------------------------------------------- */
/* payslip                                                                     */
/* -------------------------------------------------------------------------- */

export function payslipLayout(options: LayoutOptions = {}): TemplateElement[] {
  const accent = options.accent ?? '#0F766E'

  return [
    band('band', 794, 112, accent),
    logo('logo', 48, 32, 130, 44, 'left', true),
    heading('title', 446, 36, 300, 30, 'PAYSLIP', {
      fontSize: 24,
      fontWeight: 700,
      textAlign: 'right',
      color: '#FFFFFF',
      letterSpacing: 2,
    }),
    text('period', 446, 70, 300, 18, 'Period ending {{invoice.date | date}}', {
      fontSize: 10,
      textAlign: 'right',
      color: 'rgba(255,255,255,.75)',
    }),
    text('empLbl', 48, 146, 300, 14, 'EMPLOYEE', {
      fontSize: 8.5,
      fontWeight: 600,
      letterSpacing: 1.6,
      color: LABEL,
    }),
    text('emp', 48, 164, 300, 60, '{{customer.name}}\n{{customer.email}}', {
      fontSize: 11,
      lineHeight: 1.7,
    }),
    keyValue('meta', 446, 164, 300, 60, [
      textRow('m-id', 'Employee ID', '{{invoice.number}}'),
      textRow('m-dept', 'Department', 'Engineering'),
      { id: 'm-date', label: 'Pay date', value: '{{invoice.dueDate}}', format: 'date' as const },
    ]),
    table(
      'items',
      48,
      262,
      698,
      150,
      [
        column('c-earn', 'Earnings', '{{item.name}}', 0.6, 'left'),
        column('c-units', 'Units', '{{item.quantity}}', 0.16, 'right', 'integer'),
        column('c-amount', 'Amount', '{{item.total}}', 0.24, 'right', 'number'),
      ],
      { accent },
    ),
    keyValue(
      'totals',
      446,
      456,
      300,
      104,
      [
        row('p-gross', 'Gross', '{{invoice.subtotal}}'),
        row('p-ded', 'Deductions', '{{invoice.discount}}'),
        row('p-tax', 'Tax', '{{invoice.tax}}'),
        row('p-net', 'Net pay', '{{invoice.total}}', true),
      ],
      { gap: 8, accent, divideLast: true },
    ),
    text(
      'note',
      48,
      1034,
      698,
      30,
      'This payslip is computer generated and does not require a signature.',
      { fontSize: 9.5, textAlign: 'center', color: LABEL },
    ),
  ]
}

/* -------------------------------------------------------------------------- */

export type LayoutArchitecture = 'doc' | 'report' | 'certificate' | 'payslip' | 'blank'

export function buildLayout(
  architecture: LayoutArchitecture,
  options: LayoutOptions = {},
): TemplateElement[] {
  switch (architecture) {
    case 'report':
      return reportLayout(options)
    case 'certificate':
      return certificateLayout(options)
    case 'payslip':
      return payslipLayout(options)
    case 'blank':
      return []
    case 'doc':
    default:
      return docLayout(options)
  }
}
