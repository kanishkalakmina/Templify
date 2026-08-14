/**
 * Supported document locales.
 *
 * This is about the **rendered document**, not the editor chrome: a locale
 * decides how numbers and dates are formatted, which language the built-in
 * labels resolve to, and which font scripts the render server must embed.
 *
 * No React. The render server imports this module unchanged.
 */

export type LocaleCode = 'en' | 'si' | 'ta' | 'fr' | 'de' | 'es' | 'pt'

/** Writing systems we need font coverage for. Drives font embedding. */
export type Script = 'latin' | 'sinhala' | 'tamil'

export interface LocaleMeta {
  code: LocaleCode
  /** English name, for developer-facing lists. */
  label: string
  /** Name in its own language, for the picker. */
  endonym: string
  /** BCP 47 tag handed to `Intl`. */
  intlTag: string
  script: Script
  direction: 'ltr' | 'rtl'
  /** Default currency for `currency`-formatted values in this locale. */
  currency: string
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en', label: 'English', endonym: 'English', intlTag: 'en-US', script: 'latin', direction: 'ltr', currency: 'USD' },
  { code: 'si', label: 'Sinhala', endonym: 'සිංහල', intlTag: 'si-LK', script: 'sinhala', direction: 'ltr', currency: 'LKR' },
  { code: 'ta', label: 'Tamil', endonym: 'தமிழ்', intlTag: 'ta-LK', script: 'tamil', direction: 'ltr', currency: 'LKR' },
  { code: 'fr', label: 'French', endonym: 'Français', intlTag: 'fr-FR', script: 'latin', direction: 'ltr', currency: 'EUR' },
  { code: 'de', label: 'German', endonym: 'Deutsch', intlTag: 'de-DE', script: 'latin', direction: 'ltr', currency: 'EUR' },
  { code: 'es', label: 'Spanish', endonym: 'Español', intlTag: 'es-ES', script: 'latin', direction: 'ltr', currency: 'EUR' },
  { code: 'pt', label: 'Portuguese', endonym: 'Português', intlTag: 'pt-PT', script: 'latin', direction: 'ltr', currency: 'EUR' },
]

export const DEFAULT_LOCALE: LocaleCode = 'en'

const BY_CODE = new Map(LOCALES.map((l) => [l.code, l]))

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && BY_CODE.has(value as LocaleCode)
}

/**
 * Resolves anything a caller might send into a supported locale.
 *
 * Accepts `si`, `si-LK`, `SI` and falls back to English rather than throwing —
 * a render request with an unknown locale should still produce a document.
 */
export function resolveLocale(value: unknown): LocaleMeta {
  if (typeof value === 'string' && value.trim()) {
    const normalised = value.trim().toLowerCase()
    const exact = BY_CODE.get(normalised as LocaleCode)
    if (exact) return exact
    // `si-LK` -> `si`
    const base = normalised.split(/[-_]/)[0]
    const partial = BY_CODE.get(base as LocaleCode)
    if (partial) return partial
  }
  return BY_CODE.get(DEFAULT_LOCALE) as LocaleMeta
}

export function localeMeta(code: LocaleCode): LocaleMeta {
  return BY_CODE.get(code) ?? (BY_CODE.get(DEFAULT_LOCALE) as LocaleMeta)
}
