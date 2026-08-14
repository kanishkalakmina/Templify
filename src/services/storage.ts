/**
 * Thin, failure-tolerant wrapper over `localStorage`.
 *
 * Storage is a genuine failure surface here, not a formality: logo uploads are
 * inlined as data URLs and the per-origin quota is around 5 MB (architecture
 * R-2). Callers get an explicit result rather than a thrown exception so a
 * failed save can be surfaced to the user instead of losing their work silently.
 */

/**
 * Bump this when the seeded template layouts change in a way existing workspaces
 * should pick up. It discards stored templates, so only do it while the product
 * is pre-release — once real user work exists, migrate instead.
 */
const NAMESPACE = 'templify.v2'

export const StorageKeys = {
  templates: `${NAMESPACE}.templates`,
  testData: `${NAMESPACE}.testdata`,
  ui: `${NAMESPACE}.ui`,
  settings: `${NAMESPACE}.settings`,
} as const

function available(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage
  } catch {
    return false
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  if (!available()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    // Corrupt or unparseable — fall back rather than crash the app on boot.
    return fallback
  }
}

export type WriteResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' | 'unknown' }

export function writeJSON(key: string, value: unknown): WriteResult {
  if (!available()) return { ok: false, reason: 'unavailable' }
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return { ok: true }
  } catch (error) {
    if (isQuotaError(error)) return { ok: false, reason: 'quota' }
    return { ok: false, reason: 'unknown' }
  }
}

export function removeKey(key: string): void {
  if (!available()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22
  )
}

/** Rough footprint of the Templify keys, for the Settings page. */
export function storageFootprintBytes(): number {
  if (!available()) return 0
  let total = 0
  for (const key of Object.values(StorageKeys)) {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) total += raw.length * 2 // UTF-16 code units
    } catch {
      /* ignore */
    }
  }
  return total
}
