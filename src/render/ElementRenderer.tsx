/**
 * The one place a resolved element becomes DOM.
 *
 * Canvas, preview and thumbnails all render through this component; they differ
 * only in scale, render mode and the chrome drawn around them. Three separate
 * renderers would drift, and preview fidelity would decay silently — so there
 * is exactly one. See architecture NFR-002, component C-10.
 *
 * This component knows nothing about selection or editing. That chrome is
 * overlaid by the canvas.
 */

import type { CSSProperties } from 'react'
import type { RenderMode, ResolvedNode } from '@/services/resolveDocument'
import { boxStyle, justifyFor, textStyle } from './styles'

export function ElementRenderer({ node, mode }: { node: ResolvedNode; mode: RenderMode }) {
  return (
    <div
      style={{
        ...boxStyle(node),
        // Conditions that fail are kept in the editor so the element stays
        // selectable, but dimmed so it reads as "not rendering".
        opacity: node.conditionFailed ? 0.32 : boxStyle(node).opacity,
      }}
    >
      <Body node={node} mode={mode} />
      {node.children?.map((child) => (
        <ElementRenderer key={child.key} node={child} mode={mode} />
      ))}
    </div>
  )
}

function Body({ node, mode }: { node: ResolvedNode; mode: RenderMode }) {
  switch (node.type) {
    case 'text':
    case 'heading':
    case 'richText':
    case 'pageNumber':
    case 'date':
    case 'header':
    case 'footer':
    case 'badge':
      return <div style={textStyle(node.style)}>{node.text}</div>

    case 'divider':
      return <Divider node={node} />

    case 'spacer':
      return mode === 'edit' ? (
        <div style={{ width: '100%', height: '100%', border: '1px dashed #CBD5E1', borderRadius: 3 }} />
      ) : null

    case 'container':
    case 'section':
    case 'columns':
      return null // Decoration comes from the wrapper's border/background.

    case 'logo':
    case 'image':
      return <ImageBox node={node} />

    case 'keyValue':
      return <KeyValue node={node} />

    case 'list':
      return <ListBlock node={node} />

    case 'table':
    case 'dataGrid':
      return <Table node={node} mode={mode} />

    case 'chart':
      return <Chart node={node} />

    case 'kpi':
      return <Kpi node={node} />

    case 'progress':
      return <Progress node={node} />

    case 'qrCode':
      return <QrCode node={node} />

    case 'barcode':
      return <Barcode node={node} />

    case 'signature':
      return <Signature node={node} />

    default:
      return null
  }
}

/* -------------------------------------------------------------------------- */

function Divider({ node }: { node: ResolvedNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: Math.max(1, node.box.height),
        background: node.style.borderColor || node.style.color || '#E2E8F0',
      }}
    />
  )
}

function ImageBox({ node }: { node: ResolvedNode }) {
  const config = node.type === 'logo' ? node.props?.logo : node.props?.image
  const align = (config && 'align' in config ? config.align : 'left') ?? 'left'
  const fit = config?.fit ?? 'contain'
  const src = node.imageSrc

  const base: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: justifyFor(align),
  }

  if (src) {
    return (
      <div
        style={{
          ...base,
          backgroundImage: `url('${src}')`,
          backgroundSize: fit === 'cover' ? 'cover' : 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'} center`,
        }}
      />
    )
  }

  // No source bound yet: a labelled placeholder, tinted for dark header bands.
  const onDark = isDarkBacked(node)
  return (
    <div
      style={{
        ...base,
        justifyContent: 'center',
        border: `1px dashed ${onDark ? 'rgba(255,255,255,.45)' : '#CBD5E1'}`,
        borderRadius: 4,
        font: "600 8.5px 'IBM Plex Mono', monospace",
        letterSpacing: 1.2,
        color: onDark ? 'rgba(255,255,255,.8)' : '#94A3B8',
      }}
    >
      {node.type === 'logo' ? 'COMPANY LOGO' : 'IMAGE'}
    </div>
  )
}

/** Logos sitting on a coloured header band need light-on-dark treatment. */
function isDarkBacked(node: ResolvedNode): boolean {
  return node.style.color === '#FFFFFF' || node.style.color === '#fff'
}

function KeyValue({ node }: { node: ResolvedNode }) {
  const config = node.props?.keyValue
  const rows = node.keyValue ?? []
  if (!config) return null

  const accent = config.accentColor ?? config.valueColor
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: config.rowGap }}>
      {rows.map((row, index) => {
        const strong = config.rows[index]?.strong ?? false
        return (
          <div
            key={row.id}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              ...(strong && config.divider
                ? { paddingTop: 8, marginTop: 2, borderTop: `1px solid ${config.dividerColor}` }
                : null),
            }}
          >
            <span
              style={{
                fontFamily: node.style.fontFamily,
                fontSize: (node.style.fontSize ?? 10.5) - (strong ? 0 : 0.5),
                fontWeight: strong ? 600 : config.labelWeight,
                letterSpacing: strong ? '.4px' : undefined,
                color: strong ? accent : config.labelColor,
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                fontFamily: node.style.fontFamily,
                fontSize: (node.style.fontSize ?? 10.5) + (strong ? 2.5 : 0),
                fontWeight: strong ? 700 : config.valueWeight,
                color: strong ? accent : config.valueColor,
                textAlign: config.valueAlign,
              }}
            >
              {row.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ListBlock({ node }: { node: ResolvedNode }) {
  const config = node.props?.list
  const items = node.list ?? []
  if (!config) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: config.gap }}>
      {items.map((item, index) => (
        <div key={index} style={{ display: 'flex', gap: 8, ...textStyle(node.style) }}>
          {config.marker !== 'none' ? (
            <span style={{ flex: 'none', opacity: 0.6 }}>
              {config.marker === 'decimal' ? `${index + 1}.` : config.marker === 'dash' ? '—' : '•'}
            </span>
          ) : null}
          <span style={{ minWidth: 0 }}>{item}</span>
        </div>
      ))}
    </div>
  )
}

function Table({ node, mode }: { node: ResolvedNode; mode: RenderMode }) {
  const table = node.table
  if (!table) return null
  const { config, columns, rows } = table
  const filled = config.headerBackground && config.headerBackground !== 'transparent'

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          background: config.headerBackground,
          borderBottom: `1px solid ${filled ? 'transparent' : '#0F172A'}`,
          borderRadius: filled ? 4 : 0,
        }}
      >
        {columns.map((column) => (
          <div
            key={column.id}
            style={{
              width: `${column.widthFraction * 100}%`,
              padding: `${config.cellPaddingY}px ${config.cellPaddingX - 1}px`,
              fontFamily: node.style.fontFamily,
              fontSize: config.headerFontSize,
              fontWeight: config.headerFontWeight,
              letterSpacing: '.7px',
              textTransform: config.headerUppercase ? 'uppercase' : undefined,
              color: config.headerColor,
              textAlign: column.align,
            }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {rows.map((row) => (
        <div
          key={row.key}
          style={{
            display: 'flex',
            borderBottom:
              config.borderMode === 'none' ? undefined : `1px solid ${config.borderColor}`,
            background: config.zebra && row.index % 2 === 1 ? config.zebraColor : undefined,
          }}
        >
          {row.cells.map((cell, index) => (
            <div
              key={columns[index]?.id ?? index}
              style={{
                width: `${(columns[index]?.widthFraction ?? 1 / row.cells.length) * 100}%`,
                padding: `${config.cellPaddingY}px ${config.cellPaddingX - 1}px`,
                fontFamily: node.style.fontFamily,
                fontSize: config.fontSize,
                color: config.rowColor,
                textAlign: columns[index]?.align ?? 'left',
              }}
            >
              {cell}
            </div>
          ))}
        </div>
      ))}

      {table.isEmpty ? (
        <div
          style={{
            padding: `${config.cellPaddingY + 6}px 0`,
            fontFamily: node.style.fontFamily,
            fontSize: config.fontSize,
            color: '#94A3B8',
            textAlign: 'center',
          }}
        >
          {config.emptyText}
        </div>
      ) : null}

      {/* Editor-only affordance: makes the array binding visible on the page. */}
      {mode === 'edit' && config.dataSource ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -19,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            font: "600 8px/1 'IBM Plex Mono', monospace",
            letterSpacing: '.5px',
            color: '#5B7CFA',
            background: 'rgba(91,124,250,.11)',
            border: '1px solid rgba(91,124,250,.3)',
            padding: '3px 6px',
            borderRadius: 3,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          repeat · {config.dataSource}[]
        </div>
      ) : null}
    </div>
  )
}

function Chart({ node }: { node: ResolvedNode }) {
  const chart = node.chart
  const config = node.props?.chart
  if (!chart || !config) return null

  // Fall back to the decorative series so report templates read correctly
  // before real data is bound.
  const values = chart.points.length
    ? chart.points.map((p) => p.value)
    : (config.staticSeries ?? [40, 70, 55, 85])
  const max = Math.max(...values, 1)
  const accent = config.palette[0] ?? '#2F6FED'
  const gap = Math.max(2, Math.round(node.box.width / values.length / 6))

  if (config.kind === 'donut') {
    const total = values.reduce((s, v) => s + v, 0) || 1
    let offset = 0
    const size = Math.min(node.box.width, node.box.height)
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}>
        <svg width={size} height={size} viewBox="0 0 42 42">
          {values.map((value, index) => {
            const share = (value / total) * 100
            const circle = (
              <circle
                key={index}
                cx="21"
                cy="21"
                r="15.9"
                fill="transparent"
                stroke={config.palette[index % config.palette.length] ?? accent}
                strokeWidth="6"
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={25 - offset}
              />
            )
            offset += share
            return circle
          })}
        </svg>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', gap }}>
      {values.map((value, index) => {
        const pct = (value / max) * 100
        return (
          <div
            key={index}
            style={{
              flex: 1,
              // Capped so a series of two or three points reads as a chart
              // rather than as full-width slabs.
              maxWidth: 56,
              height: `${Math.max(2, pct)}%`,
              background: accent,
              opacity: 0.35 + pct / 200,
              borderRadius: '2px 2px 0 0',
            }}
          />
        )
      })}
    </div>
  )
}

function Kpi({ node }: { node: ResolvedNode }) {
  const config = node.props?.kpi
  if (!config) return null
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 6,
        padding: '12px 14px',
        background: node.style.background || '#F7F9FC',
        borderRadius: 7,
      }}
    >
      <div
        style={{
          fontFamily: node.style.fontFamily,
          fontSize: 8.5,
          fontWeight: 600,
          letterSpacing: '1.3px',
          textTransform: 'uppercase',
          color: '#94A3B8',
        }}
      >
        {config.label}
      </div>
      <div
        style={{
          fontFamily: node.style.fontFamily,
          fontSize: 21,
          fontWeight: 700,
          color: config.accent,
        }}
      >
        {node.text}
      </div>
    </div>
  )
}

function Progress({ node }: { node: ResolvedNode }) {
  const config = node.props?.progress
  if (!config) return null
  const value = typeof node.value === 'number' ? node.value : 0
  const pct = Math.max(0, Math.min(100, (value / (config.max || 100)) * 100))

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div
        style={{
          width: '100%',
          height: config.thickness,
          background: config.trackColor,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: config.color }} />
      </div>
      {config.showLabel ? (
        <div style={{ ...textStyle(node.style), fontSize: 9 }}>{Math.round(pct)}%</div>
      ) : null}
    </div>
  )
}

/**
 * A deterministic visual stand-in for a QR code — finder squares plus a pattern
 * derived from the encoded value, so it changes when the data changes.
 *
 * It is NOT a real encoding and will not scan. Producing something that looks
 * scannable but is not would be worse than an obvious placeholder; real
 * encoding is a render-server concern (architecture R-3).
 */
function QrCode({ node }: { node: ResolvedNode }) {
  const value = node.props?.code?.value ?? ''
  const foreground = node.props?.code?.foreground ?? '#0F172A'
  const background = node.props?.code?.background ?? '#FFFFFF'

  let seed = 0
  for (let i = 0; i < value.length; i += 1) seed = (seed * 31 + value.charCodeAt(i)) % 9973

  const cells: boolean[] = []
  for (let i = 0; i < 81; i += 1) {
    const r = Math.floor(i / 9)
    const c = i % 9
    const corner = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3)
    if (corner) {
      const onEdge = r === 0 || r === 2 || c === 0 || c === 2 || r === 8 || c === 8
      cells.push(onEdge ? true : r === 1 && c === 1)
    } else {
      cells.push((r * 7 + c * 5 + ((r * c) % 3) + seed) % 3 !== 0)
    }
  }

  return (
    <div
      title="Preview pattern — real encoding happens server-side"
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(9,1fr)',
        gridTemplateRows: 'repeat(9,1fr)',
        gap: 1,
        padding: 4,
        background,
        border: '1px solid #E2E8F0',
        borderRadius: 3,
      }}
    >
      {cells.map((on, index) => (
        <div key={index} style={{ background: on ? foreground : 'transparent', borderRadius: 0.5 }} />
      ))}
    </div>
  )
}

/** Same honesty caveat as the QR renderer: a visual stand-in, not an encoding. */
function Barcode({ node }: { node: ResolvedNode }) {
  const value = node.props?.code?.value ?? ''
  const foreground = node.props?.code?.foreground ?? '#0F172A'
  const showValue = node.props?.code?.showValue ?? true

  const bars: number[] = []
  let seed = 7
  for (let i = 0; i < value.length; i += 1) seed = (seed * 33 + value.charCodeAt(i)) % 1021
  for (let i = 0; i < 36; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648
    bars.push(1 + ((seed >> 8) % 3))
  }

  return (
    <div
      title="Preview pattern — real encoding happens server-side"
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', gap: 1 }}>
        {bars.map((weight, index) => (
          <div
            key={index}
            style={{ flex: weight, background: index % 2 === 0 ? foreground : 'transparent' }}
          />
        ))}
      </div>
      {showValue ? (
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 8,
            letterSpacing: '1px',
            textAlign: 'center',
            color: foreground,
          }}
        >
          {node.text || value}
        </div>
      ) : null}
    </div>
  )
}

function Signature({ node }: { node: ResolvedNode }) {
  const config = node.props?.signature
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        gap: 6,
      }}
    >
      <div style={{ height: 1, background: config?.lineColor ?? '#0F172A', opacity: 0.5 }} />
      <div style={textStyle(node.style)}>{node.text || config?.label}</div>
    </div>
  )
}
