/**
 * Test data — the sample payload a template is edited against.
 *
 * Stored per template id so switching templates keeps each one's data. This
 * store is deliberately **not** imported by `exportService`: a template export
 * must never carry a data payload (architecture NFR-012).
 */

import { create } from 'zustand'
import type { ReportData } from '@/types/data'
import { StorageKeys, readJSON, writeJSON } from '@/services/storage'
import { DEFAULT_TEST_DATA } from '@/data/sampleData'

type DataMap = Record<string, ReportData>

interface TestDataState {
  /** Applied payloads, keyed by template id. */
  data: DataMap
  /** Bumped on every apply so memoised renders know to recompute. */
  revision: number

  hydrate: () => void
  /** The applied payload for a template, falling back to the default sample. */
  getData: (templateId: string) => ReportData
  applyData: (templateId: string, data: ReportData) => void
  resetData: (templateId: string) => void
}

function persist(data: DataMap) {
  writeJSON(StorageKeys.testData, data)
}

export const useTestDataStore = create<TestDataState>((set, get) => ({
  data: {},
  revision: 0,

  hydrate: () => {
    const stored = readJSON<DataMap>(StorageKeys.testData, {})
    set({ data: stored, revision: get().revision + 1 })
  },

  getData: (templateId) => get().data[templateId] ?? DEFAULT_TEST_DATA,

  applyData: (templateId, data) => {
    const next = { ...get().data, [templateId]: data }
    persist(next)
    set({ data: next, revision: get().revision + 1 })
  },

  resetData: (templateId) => {
    const next = { ...get().data }
    delete next[templateId]
    persist(next)
    set({ data: next, revision: get().revision + 1 })
  },
}))
