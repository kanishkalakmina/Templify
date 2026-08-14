/**
 * Workspace defaults applied to newly created templates.
 *
 * These are genuine defaults rather than decoration: `templateStore.create`
 * reads them, so changing the primary colour here changes the next blank
 * template's branding.
 */

import { create } from 'zustand'
import type { TemplateBranding } from '@/types/template'
import { StorageKeys, readJSON, writeJSON } from '@/services/storage'
import { DEFAULT_BRANDING } from '@/services/templateCatalog'
import { DEFAULT_LOCALE, isLocaleCode, type LocaleCode } from '@/i18n/locales'

interface SettingsState {
  branding: TemplateBranding
  /**
   * Locale the editor and preview render documents in. A workspace preference
   * rather than a template property: the same template is meant to render in
   * every language, so the language belongs to the person looking at it.
   */
  previewLocale: LocaleCode
  hydrate: () => void
  updateBranding: (patch: Partial<TemplateBranding>) => void
  setPreviewLocale: (locale: LocaleCode) => void
  reset: () => void
}

interface Persisted {
  branding: TemplateBranding
  previewLocale: LocaleCode
}

const SEED: TemplateBranding = {
  ...DEFAULT_BRANDING,
  primaryColor: '#2F6FED',
  secondaryColor: '#0F172A',
  defaultLogo: '{{company.logo}}',
  defaultFooter: 'Thank you for your business.',
}

function persist(state: Persisted) {
  writeJSON(StorageKeys.settings, state)
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  branding: SEED,
  previewLocale: DEFAULT_LOCALE,

  hydrate: () => {
    const stored = readJSON<Partial<Persisted>>(StorageKeys.settings, {})
    set({
      // Tolerates the pre-i18n shape, which stored branding at the top level.
      branding: { ...SEED, ...(stored.branding ?? (stored as unknown as TemplateBranding)) },
      previewLocale: isLocaleCode(stored.previewLocale) ? stored.previewLocale : DEFAULT_LOCALE,
    })
  },

  updateBranding: (patch) => {
    const branding = { ...get().branding, ...patch }
    persist({ branding, previewLocale: get().previewLocale })
    set({ branding })
  },

  setPreviewLocale: (previewLocale) => {
    persist({ branding: get().branding, previewLocale })
    set({ previewLocale })
  },

  reset: () => {
    persist({ branding: SEED, previewLocale: DEFAULT_LOCALE })
    set({ branding: SEED, previewLocale: DEFAULT_LOCALE })
  },
}))
