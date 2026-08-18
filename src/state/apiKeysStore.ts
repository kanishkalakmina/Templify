/**
 * API keys shown on the API page.
 *
 * Deliberately **in-memory only**, and illustrative rather than functional: the
 * server authenticates against a single `TEMPLIFY_API_KEY` from its environment,
 * so a key minted in the browser would authenticate nothing. Registering one
 * would mean the editor could hand out server credentials, and persisting
 * anything credential-shaped to `localStorage` would model a bad practice in a
 * product whose whole premise is keeping customer data inside their perimeter.
 *
 * The API page says as much on screen, so the affordance does not overpromise.
 */

import { create } from 'zustand'
import { SERVER } from '@/data/server'

export interface ApiKey {
  id: string
  label: string
  value: string
  created: string
  lastUsed: string
  /** Full value is shown once, at creation. */
  revealed: boolean
}

function randomKey(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return (
    SERVER.keyPrefix +
    Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  )
}

interface ApiKeysState {
  keys: ApiKey[]
  generate: () => ApiKey
  revoke: (id: string) => void
}

export const useApiKeysStore = create<ApiKeysState>((set, get) => ({
  keys: [
    {
      id: 'seed-key',
      label: 'Production server',
      value: `${SERVER.keyPrefix}8f2c1ba49d7e5306af11`,
      created: 'Aug 1, 2026',
      lastUsed: '2 minutes ago',
      revealed: false,
    },
  ],

  generate: () => {
    const key: ApiKey = {
      id: `key-${Date.now()}`,
      label: `Server key ${get().keys.length + 1}`,
      value: randomKey(),
      created: 'just now',
      lastUsed: 'never',
      revealed: true,
    }
    // Only the newest key stays revealed.
    set((state) => ({
      keys: [key, ...state.keys.map((k) => ({ ...k, revealed: false }))],
    }))
    return key
  },

  revoke: (id) => set((state) => ({ keys: state.keys.filter((k) => k.id !== id) })),
}))
