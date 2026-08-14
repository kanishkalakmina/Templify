/**
 * The template catalogue: the user's own templates plus the read-only built-ins.
 *
 * All persistence goes through the `TemplateRepository` port, so this store does
 * not know or care whether templates live in `localStorage` or on the render
 * server.
 */

import { create } from 'zustand'
import type { ReportTemplate, TemplateCategory } from '@/types/template'
import type { TemplateRepository } from '@/services/templateRepository'
import {
  createRepository,
  type RepositoryBinding,
  type ServerInfo,
  type StorageMode,
} from '@/services/repositoryFactory'
import {
  createBlankTemplate,
  duplicateTemplate,
  findTemplate,
  type NewTemplateInput,
} from '@/services/templateCatalog'
import { createVersion, restoreVersion, snapshotOf } from '@/services/versioning'
import { BUILT_IN_TEMPLATES } from '@/templates/builtin'
import { seedTemplates } from '@/templates/seed'
import { toast } from './uiStore'
import { useSettingsStore } from './settingsStore'

/**
 * The repository is resolved once, on first use: a report server if one answers
 * on this origin, browser storage otherwise. Everything below is written against
 * the port, so neither this store nor any screen knows which it got.
 */
let binding: RepositoryBinding | null = null
let bindingPromise: Promise<RepositoryBinding> | null = null

async function bind(): Promise<RepositoryBinding> {
  if (binding) return binding
  if (!bindingPromise) bindingPromise = createRepository(seedTemplates)
  binding = await bindingPromise
  return binding
}

async function repo(): Promise<TemplateRepository> {
  return (await bind()).repository
}

interface TemplateState {
  templates: ReportTemplate[]
  builtIns: ReportTemplate[]
  loaded: boolean

  /** Where templates actually live, decided at boot. */
  mode: StorageMode
  serverUrl: string
  serverInfo: ServerInfo | null

  hydrate: () => Promise<void>

  getById: (id: string) => ReportTemplate | undefined
  /** Resolves a `templateId` the way the render API would, `:vN` included. */
  resolve: (handle: string) => ReportTemplate | undefined
  isIdAvailable: (id: string, exceptId?: string) => boolean

  create: (input: NewTemplateInput) => Promise<ReportTemplate>
  /** Copy-on-use — the only route from a built-in to an editable template. */
  useTemplate: (sourceId: string, id: string, name: string) => Promise<ReportTemplate | undefined>
  duplicate: (id: string, newId: string, newName: string) => Promise<ReportTemplate | undefined>
  importTemplate: (template: ReportTemplate) => Promise<ReportTemplate>

  rename: (id: string, name: string) => Promise<void>
  updateMeta: (
    id: string,
    patch: Partial<Pick<ReportTemplate, 'name' | 'description' | 'category'>>,
  ) => Promise<void>
  remove: (id: string) => Promise<void>
  setArchived: (id: string, archived: boolean) => Promise<void>

  /** Persists a design. `newVersion` appends a version entry (what Save does). */
  saveTemplate: (template: ReportTemplate, options?: { newVersion?: boolean; note?: string }) => Promise<ReportTemplate>
  restoreTemplateVersion: (id: string, version: number) => Promise<ReportTemplate | undefined>
}

function reportWriteFailure(result: { ok: boolean; reason?: string }) {
  if (result.ok) return
  toast({
    title: 'Could not save',
    description:
      result.reason === 'quota'
        ? 'Browser storage is full. Export a template or remove unused ones to free space.'
        : 'Local storage is unavailable in this browser.',
    tone: 'danger',
    duration: 6000,
  })
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  builtIns: BUILT_IN_TEMPLATES,
  loaded: false,
  mode: 'local',
  serverUrl: '',
  serverInfo: null,

  hydrate: async () => {
    const resolved = await bind()
    try {
      const templates = await resolved.repository.list()
      set({
        templates,
        loaded: true,
        mode: resolved.mode,
        serverUrl: resolved.serverUrl,
        serverInfo: resolved.info,
      })
    } catch (error) {
      // A server that answered /api/health but then failed should not leave the
      // app blank — surface it and carry on with an empty catalogue.
      console.error('[templates] Failed to load from server:', error)
      set({ templates: [], loaded: true, mode: resolved.mode, serverUrl: resolved.serverUrl, serverInfo: resolved.info })
      toast({
        title: 'Could not load templates',
        description: 'The report server responded but returned an error.',
        tone: 'danger',
        duration: 6000,
      })
    }
  },

  getById: (id) => get().templates.find((t) => t.id === id),

  resolve: (handle) => findTemplate(handle, { user: get().templates, builtIn: get().builtIns }),

  isIdAvailable: (id, exceptId) => {
    if (id === exceptId) return true
    // Only user templates are checked. Built-in ids are catalogue starting
    // points, not addressable templates — a user copy legitimately takes the
    // same id and shadows it, which is how the preloaded workspace works.
    return !get().templates.some((t) => t.id === id)
  },

  create: async (input) => {
    // New templates inherit the workspace branding defaults from Settings.
    const blank = createBlankTemplate(input)
    const template = { ...blank, branding: { ...useSettingsStore.getState().branding } }
    const result = await (await repo()).save(template)
    reportWriteFailure(result)
    set((state) => ({ templates: [...state.templates, template] }))
    return template
  },

  useTemplate: async (sourceId, id, name) => {
    const source = get().resolve(sourceId)
    if (!source) return undefined
    const copy = duplicateTemplate(source, { id, name })
    const result = await (await repo()).save(copy)
    reportWriteFailure(result)
    set((state) => ({ templates: [...state.templates, copy] }))
    return copy
  },

  duplicate: async (id, newId, newName) => {
    const source = get().getById(id) ?? get().builtIns.find((t) => t.id === id)
    if (!source) return undefined
    const copy = duplicateTemplate(source, { id: newId, name: newName })
    const result = await (await repo()).save(copy)
    reportWriteFailure(result)
    set((state) => ({ templates: [...state.templates, copy] }))
    return copy
  },

  importTemplate: async (template) => {
    const result = await (await repo()).save(template)
    reportWriteFailure(result)
    set((state) => ({ templates: [...state.templates, template] }))
    return template
  },

  rename: async (id, name) => {
    await get().updateMeta(id, { name })
  },

  updateMeta: async (id, patch) => {
    const current = get().getById(id)
    if (!current) return
    const next: ReportTemplate = {
      ...current,
      ...patch,
      category: (patch.category ?? current.category) as TemplateCategory,
      updatedAt: new Date().toISOString(),
    }
    const result = await (await repo()).save(next)
    reportWriteFailure(result)
    set((state) => ({ templates: state.templates.map((t) => (t.id === id ? next : t)) }))
  },

  remove: async (id) => {
    const result = await (await repo()).remove(id)
    reportWriteFailure(result)
    set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }))
  },

  setArchived: async (id, archived) => {
    const current = get().getById(id)
    if (!current) return
    const next = { ...current, archived, updatedAt: new Date().toISOString() }
    const result = await (await repo()).save(next)
    reportWriteFailure(result)
    set((state) => ({ templates: state.templates.map((t) => (t.id === id ? next : t)) }))
  },

  saveTemplate: async (template, options = {}) => {
    const { newVersion = false, note = '' } = options
    const existing = get().getById(template.id)

    // Only cut a version when the design actually changed; otherwise repeated
    // saves would inflate the history with identical snapshots.
    const changed =
      !existing || JSON.stringify(snapshotOf(existing)) !== JSON.stringify(snapshotOf(template))

    const next =
      newVersion && changed
        ? createVersion(template, note)
        : { ...template, updatedAt: new Date().toISOString() }

    const result = await (await repo()).save(next)
    reportWriteFailure(result)

    set((state) => ({
      templates: state.templates.some((t) => t.id === next.id)
        ? state.templates.map((t) => (t.id === next.id ? next : t))
        : [...state.templates, next],
    }))

    return next
  },

  restoreTemplateVersion: async (id, version) => {
    const current = get().getById(id)
    if (!current) return undefined
    const restored = restoreVersion(current, version)
    if (!restored) return undefined
    const result = await (await repo()).save(restored)
    reportWriteFailure(result)
    set((state) => ({ templates: state.templates.map((t) => (t.id === id ? restored : t)) }))
    return restored
  },
}))
