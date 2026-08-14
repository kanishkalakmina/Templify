import type { FormatKind } from '@/types/template'

/**
 * Thousands-separated, with decimals only when the value actually has them:
 * 50000 -> "50,000" and 1234.5 -> "1,234.5". Document layouts read better
 * without trailing ".00" on whole amounts.
 */
const NUMBER = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
/** Currency keeps two decimals — money with a symbol should not lose cents. */
const MONEY = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const INTEGER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/**
 * Turns a resolved data value into display text.
 *
 * Deliberately forgiving: templates are edited against sample data that may be
 * missing keys or hold the wrong type, and a report should degrade to a sane
 * string rather than throw mid-render.
 */
export function formatValue(value: unknown, kind: FormatKind = 'text', currency = ''): string {
  if (value === null || value === undefined) return ''

  switch (kind) {
    case 'currency': {
      const n = toNumber(value)
      if (n === null) return String(value)
      const prefix = currency ? `${currency} ` : ''
      return `${prefix}${MONEY.format(n)}`
    }
    case 'number': {
      const n = toNumber(value)
      return n === null ? String(value) : NUMBER.format(n)
    }
    case 'integer': {
      const n = toNumber(value)
      return n === null ? String(value) : INTEGER.format(n)
    }
    case 'percent': {
      const n = toNumber(value)
      return n === null ? String(value) : `${INTEGER.format(n)}%`
    }
    case 'date':
      return formatDate(value, 'medium')
    case 'text':
    default:
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
  }
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = Number(value.replace(/[, ]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function formatDate(value: unknown, pattern: 'long' | 'medium' | 'short' | 'iso'): string {
  const d = toDate(value)
  if (!d) return typeof value === 'string' ? value : ''
  switch (pattern) {
    case 'iso':
      return d.toISOString().slice(0, 10)
    case 'short':
      return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
    case 'long':
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    case 'medium':
    default:
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** "2 minutes ago", "Yesterday", "Aug 10, 2026". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.round(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.round(hr / 24)
  if (day === 1) return 'Yesterday'
  if (day < 7) return `${day} days ago`
  return formatDate(iso, 'medium')
}

export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}
