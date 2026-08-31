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

/**
 * A report-server call that failed, carrying the status code.
 *
 * The status is the point: a 401 is a misconfiguration the user can fix and must
 * be told about, while a 500 is not. Throwing a bare `Error` lost that
 * distinction and left the editor showing an empty catalogue either way (#11).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(`${message}: ${status}`)
    this.name = 'ApiError'
  }

  get unauthorized(): boolean {
    return this.status === 401
  }
}

export interface TemplateRepository {
  /** All user-owned templates, including archived ones. */
  list(): Promise<ReportTemplate[]>
  /** Accepts a plain id or a pinned handle (`invoice-modern:v2`). */
  get(handle: string): Promise<ReportTemplate | undefined>
  save(template: ReportTemplate): Promise<WriteResult>
  saveAll(templates: ReportTemplate[]): Promise<WriteResult>
  /*
   * There is deliberately no `remove`. A `templateId` is a contract —
   * applications POST it, and documents already issued name it — so retiring a
   * design is `save` with `archived: true`, which keeps it renderable for
   * callers that still reference the id. See the DELETE handler in
   * `server/index.ts`.
   */
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
  /**
   * `apiKey` is sent as `Authorization: Bearer …` on every call. Without it, a
   * server started with `TEMPLIFY_API_KEY` rejects the catalogue with 401 and
   * the editor comes up empty — which reads as data loss (#11).
   */
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey = '',
  ) {}

  private url(path = ''): string {
    return `${this.baseUrl.replace(/\/$/, '')}/api/templates${path}`
  }

  /** Auth header when a key is configured, nothing when it is not. */
  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return this.apiKey ? { ...extra, Authorization: `Bearer ${this.apiKey}` } : extra
  }

  async list(): Promise<ReportTemplate[]> {
    const response = await fetch(this.url(), { headers: this.headers() })
    if (!response.ok) throw new ApiError('Failed to list templates', response.status)
    return (await response.json()) as ReportTemplate[]
  }

  async get(handle: string): Promise<ReportTemplate | undefined> {
    const response = await fetch(this.url(`/${encodeURIComponent(handle)}`), {
      headers: this.headers(),
    })
    if (response.status === 404) return undefined
    if (!response.ok) throw new ApiError('Failed to load template', response.status)
    return (await response.json()) as ReportTemplate
  }

  async save(template: ReportTemplate): Promise<WriteResult> {
    const response = await fetch(this.url(`/${encodeURIComponent(template.id)}`), {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(template),
    })
    if (response.ok) return { ok: true }
    return { ok: false, reason: response.status === 401 ? 'unauthorized' : 'unknown' }
  }

  async saveAll(templates: ReportTemplate[]): Promise<WriteResult> {
    const results = await Promise.all(templates.map((t) => this.save(t)))
    return results.every((r) => r.ok) ? { ok: true } : { ok: false, reason: 'unknown' }
  }

  async isIdAvailable(id: string, exceptId?: string): Promise<boolean> {
    const existing = await this.get(id)
    return !existing || existing.id === exceptId
  }
}
