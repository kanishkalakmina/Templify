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

interface SettingsState {
  branding: TemplateBranding
  hydrate: () => void
  updateBranding: (patch: Partial<TemplateBranding>) => void
  reset: () => void
}

const SEED: TemplateBranding = {
  ...DEFAULT_BRANDING,
  primaryColor: '#2F6FED',
  secondaryColor: '#0F172A',
  defaultLogo: '{{company.logo}}',
  defaultFooter: 'Thank you for your business.',
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  branding: SEED,

  hydrate: () => set({ branding: readJSON<TemplateBranding>(StorageKeys.settings, SEED) }),

  updateBranding: (patch) => {
    const branding = { ...get().branding, ...patch }
    writeJSON(StorageKeys.settings, branding)
    set({ branding })
  },

  reset: () => {
    writeJSON(StorageKeys.settings, SEED)
    set({ branding: SEED })
  },
}))
