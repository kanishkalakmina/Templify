/**
 * Persistence port.
 *
 * Every read and write of a user template goes through `TemplateRepository`.
 * Today it is satisfied by `localStorage`; tomorrow by the self-hosted Docker
 * render server over HTTP. Nothing above this seam changes when that happens —
 * which is the entire point of the interface existing.
 *
 * The API is **asynchronous even though `localStorage` is synchronous**. That is
 * deliberate: a synchronous port would force every call site to be rewritten the
 * day the HTTP adapter arrives, and the promise of a drop-in swap would be
 * false. Paying a trivial cost now keeps it true.
 *
 * No React.
 */

import type { ReportTemplate } from '@/types/template'
import { StorageKeys, readJSON, writeJSON, type WriteResult } from './storage'
import { parseHandle, templateAtVersion } from './versioning'

export interface TemplateRepository {
  /** All user-owned templates, including archived ones. */
  list(): Promise<ReportTemplate[]>
  /** Accepts a plain id or a pinned handle (`invoice-modern:v2`). */
  get(handle: string): Promise<ReportTemplate | undefined>
  save(template: ReportTemplate): Promise<WriteResult>
  saveAll(templates: ReportTemplate[]): Promise<WriteResult>
  remove(id: string): Promise<WriteResult>
  /** True when the id is free — enforces the uniqueness rule on create. */
  isIdAvailable(id: string, exceptId?: string): Promise<boolean>
}

/* -------------------------------------------------------------------------- */
/* localStorage adapter                                                        */
/* -------------------------------------------------------------------------- */

export class LocalStorageTemplateRepository implements TemplateRepository {
  private readonly key = StorageKeys.templates

  /**
   * @param seed Produces the starter catalogue on first run. Injected rather
   *   than imported so this module stays independent of template content.
   */
  constructor(private readonly seed: () => ReportTemplate[] = () => []) {}

  async list(): Promise<ReportTemplate[]> {
    const stored = readJSON<ReportTemplate[] | null>(this.key, null)
    if (stored && Array.isArray(stored)) return stored

    const seeded = this.seed()
    if (seeded.length) writeJSON(this.key, seeded)
    return seeded
  }

  async get(handle: string): Promise<ReportTemplate | undefined> {
    const { id, version } = parseHandle(handle)
    const all = await this.list()
    const template = all.find((t) => t.id === id)
    if (!template) return undefined
    if (version === undefined) return template
    return templateAtVersion(template, version)
  }

  async save(template: ReportTemplate): Promise<WriteResult> {
    const all = await this.list()
    const index = all.findIndex((t) => t.id === template.id)
    const next = index === -1 ? [...all, template] : all.map((t, i) => (i === index ? template : t))
    return writeJSON(this.key, next)
  }

  async saveAll(templates: ReportTemplate[]): Promise<WriteResult> {
    return writeJSON(this.key, templates)
  }

  async remove(id: string): Promise<WriteResult> {
    const all = await this.list()
    return writeJSON(
      this.key,
      all.filter((t) => t.id !== id),
    )
  }

  async isIdAvailable(id: string, exceptId?: string): Promise<boolean> {
    const all = await this.list()
    return !all.some((t) => t.id === id && t.id !== exceptId)
  }
}

/* -------------------------------------------------------------------------- */
/* HTTP adapter — the future Docker render server                              */
/* -------------------------------------------------------------------------- */

/**
 * Sketch of the adapter that replaces the one above once the render server
 * exists. Not wired up: the prototype must run with no backend, and shipping a
 * half-live client would break that guarantee.
 *
 * It is kept here to make the seam concrete — the swap is a constructor
 * argument, not a refactor:
 *
 * ```ts
 * const repository = import.meta.env.VITE_TEMPLIFY_SERVER
 *   ? new HttpTemplateRepository(import.meta.env.VITE_TEMPLIFY_SERVER)
 *   : new LocalStorageTemplateRepository(seedTemplates)
 * ```
 */
export class HttpTemplateRepository implements TemplateRepository {
  constructor(private readonly baseUrl: string) {}

  private url(path = ''): string {
    return `${this.baseUrl.replace(/\/$/, '')}/api/templates${path}`
  }

  async list(): Promise<ReportTemplate[]> {
    const response = await fetch(this.url())
    if (!response.ok) throw new Error(`Failed to list templates: ${response.status}`)
    return (await response.json()) as ReportTemplate[]
  }

  async get(handle: string): Promise<ReportTemplate | undefined> {
    const response = await fetch(this.url(`/${encodeURIComponent(handle)}`))
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`Failed to load template: ${response.status}`)
    return (await response.json()) as ReportTemplate
  }

  async save(template: ReportTemplate): Promise<WriteResult> {
    const response = await fetch(this.url(`/${encodeURIComponent(template.id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    })
    return response.ok ? { ok: true } : { ok: false, reason: 'unknown' }
  }

  async saveAll(templates: ReportTemplate[]): Promise<WriteResult> {
    const results = await Promise.all(templates.map((t) => this.save(t)))
    return results.every((r) => r.ok) ? { ok: true } : { ok: false, reason: 'unknown' }
  }

  async remove(id: string): Promise<WriteResult> {
    const response = await fetch(this.url(`/${encodeURIComponent(id)}`), { method: 'DELETE' })
    return response.ok ? { ok: true } : { ok: false, reason: 'unknown' }
  }

  async isIdAvailable(id: string, exceptId?: string): Promise<boolean> {
    const existing = await this.get(id)
    return !existing || existing.id === exceptId
  }
}
