import type { FormatKind } from '@/types/template'
import { DEFAULT_LOCALE, localeMeta, type LocaleCode } from '@/i18n/locales'

/**
 * Value formatting for rendered documents.
 *
 * Every formatter is locale-aware. `Intl` objects are expensive to construct and
 * a table can call these thousands of times per render, so they are cached per
 * locale rather than built per cell.
 */

interface Formatters {
  /** Thousands-separated, decimals only when the value has them. */
  number: Intl.NumberFormat
  /** Money without a symbol — two decimals always. */
  money: Intl.NumberFormat
  integer: Intl.NumberFormat
}

const CACHE = new Map<string, Formatters>()

function formatters(locale: LocaleCode): Formatters {
  const cached = CACHE.get(locale)
  if (cached) return cached

  const tag = localeMeta(locale).intlTag
  const built: Formatters = {
    number: new Intl.NumberFormat(tag, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    money: new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    integer: new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }),
  }
  CACHE.set(locale, built)
  return built
}

const CURRENCY_CACHE = new Map<string, Intl.NumberFormat>()

/**
 * Currency formatting via `Intl`, which places the symbol where the locale
 * expects it — `$1,234.56` for en, `1.234,56 €` for de — rather than always
 * prefixing it.
 */
function currencyFormatter(locale: LocaleCode, currency: string): Intl.NumberFormat | null {
  const key = `${locale}:${currency}`
  const cached = CURRENCY_CACHE.get(key)
  if (cached) return cached
  try {
    const built = new Intl.NumberFormat(localeMeta(locale).intlTag, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    CURRENCY_CACHE.set(key, built)
    return built
  } catch {
    // An unrecognised currency code must not abort a render.
    return null
  }
}

export interface FormatOptions {
  locale?: LocaleCode
  /**
   * ISO code (`LKR`) or a bare symbol. An ISO code goes through `Intl`;
   * anything else is prefixed, so `data.currency: "Rs."` still works.
   */
  currency?: string
}

const ISO_CURRENCY = /^[A-Z]{3}$/

/**
 * Turns a resolved data value into display text.
 *
 * Deliberately forgiving: templates are edited against sample data that may be
 * missing keys or hold the wrong type, and a report should degrade to a sane
 * string rather than throw mid-render.
 */
export function formatValue(
  value: unknown,
  kind: FormatKind = 'text',
  options: FormatOptions = {},
): string {
  if (value === null || value === undefined) return ''

  const locale = options.locale ?? DEFAULT_LOCALE
  const fmt = formatters(locale)

  switch (kind) {
    case 'currency': {
      const n = toNumber(value)
      if (n === null) return String(value)
      const currency = options.currency ?? ''
      if (ISO_CURRENCY.test(currency)) {
        const intl = currencyFormatter(locale, currency)
        if (intl) return intl.format(n)
      }
      const prefix = currency ? `${currency} ` : ''
      return `${prefix}${fmt.money.format(n)}`
    }
    case 'number': {
      const n = toNumber(value)
      return n === null ? String(value) : fmt.number.format(n)
    }
    case 'integer': {
      const n = toNumber(value)
      return n === null ? String(value) : fmt.integer.format(n)
    }
    case 'percent': {
      const n = toNumber(value)
      return n === null ? String(value) : `${fmt.integer.format(n)}%`
    }
    case 'date':
      return formatDate(value, 'medium', locale)
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

export type DatePattern = 'long' | 'medium' | 'short' | 'iso'

/**
 * Month-name overrides where ICU's data is not what a business document wants.
 *
 * `si-LK` returns the traditional Buddhist lunar months for every month and
 * every width — දුරුතු, නවම්, මැදින්, බක්… — which is correct for a calendar but
 * wrong on an invoice, where a Sri Lankan reader expects the Gregorian
 * transliterations. Only the month *name* is substituted: ICU still decides the
 * field order, separators and numerals, so the date keeps its locale shape.
 */
const MONTH_NAMES: Partial<Record<LocaleCode, string[]>> = {
  si: [
    'ජනවාරි',
    'පෙබරවාරි',
    'මාර්තු',
    'අප්‍රේල්',
    'මැයි',
    'ජූනි',
    'ජූලි',
    'අගෝස්තු',
    'සැප්තැම්බර්',
    'ඔක්තෝබර්',
    'නොවැම්බර්',
    'දෙසැම්බර්',
  ],
}

/**
 * Formats with ICU, then swaps the month name where we override it.
 * `formatToParts` is what makes this safe — no pattern parsing, no guessing.
 */
function formatWithMonthOverride(
  date: Date,
  tag: string,
  locale: LocaleCode,
  options: Intl.DateTimeFormatOptions,
): string {
  const override = MONTH_NAMES[locale]
  if (!override) return date.toLocaleDateString(tag, options)

  return new Intl.DateTimeFormat(tag, options)
    .formatToParts(date)
    .map((part) => (part.type === 'month' ? override[date.getMonth()] ?? part.value : part.value))
    .join('')
}

export function formatDate(
  value: unknown,
  pattern: DatePattern,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  const d = toDate(value)
  if (!d) return typeof value === 'string' ? value : ''

  // ISO is deliberately locale-independent — it is a machine format.
  if (pattern === 'iso') return d.toISOString().slice(0, 10)

  const tag = localeMeta(locale).intlTag
  switch (pattern) {
    case 'short':
      // Numeric only — no month name, so no override applies.
      return d.toLocaleDateString(tag, { month: 'numeric', day: 'numeric', year: '2-digit' })
    case 'long':
      return formatWithMonthOverride(d, tag, locale, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    case 'medium':
    default:
      return formatWithMonthOverride(d, tag, locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
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

/**
 * "2 minutes ago", "Yesterday", "Aug 10, 2026".
 *
 * Editor chrome rather than document content, so it stays in the interface
 * language (English) — translating the editor is a separate piece of work.
 */
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
