/**
 * File-backed template store.
 *
 * A template is a single aggregate that is always read and written whole, so a
 * relational schema would buy nothing (architecture, Data Architecture). One
 * JSON document under the data volume is the honest fit at this scale, and it
 * makes a customer's templates trivially inspectable and backupable.
 *
 * Writes go through a temp file + rename so a crash mid-write cannot leave a
 * truncated catalogue behind.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ReportTemplate } from '../src/types/template'
import { seedTemplates } from '../src/templates/seed'

export class TemplateStore {
  private readonly file: string
  private cache: ReportTemplate[] | null = null
  /** Serialises writes; concurrent renders and saves share one process. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly dataDir: string) {
    this.file = path.join(dataDir, 'templates.json')
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true })
    try {
      await fs.access(this.file)
    } catch {
      // First run: seed so a fresh container is immediately useful.
      await this.writeAll(seedTemplates())
    }
  }

  async list(): Promise<ReportTemplate[]> {
    if (this.cache) return this.cache
    try {
      const raw = await fs.readFile(this.file, 'utf8')
      const parsed = JSON.parse(raw)
      this.cache = Array.isArray(parsed) ? (parsed as ReportTemplate[]) : []
    } catch {
      this.cache = []
    }
    return this.cache
  }

  async get(id: string): Promise<ReportTemplate | undefined> {
    return (await this.list()).find((t) => t.id === id)
  }

  async save(template: ReportTemplate): Promise<ReportTemplate> {
    return this.mutate(async (all) => {
      const index = all.findIndex((t) => t.id === template.id)
      const next = index === -1 ? [...all, template] : all.map((t, i) => (i === index ? template : t))
      await this.writeAll(next)
      return template
    })
  }

  async replaceAll(templates: ReportTemplate[]): Promise<void> {
    await this.mutate(async () => {
      await this.writeAll(templates)
    })
  }

  async remove(id: string): Promise<boolean> {
    return this.mutate(async (all) => {
      const next = all.filter((t) => t.id !== id)
      if (next.length === all.length) return false
      await this.writeAll(next)
      return true
    })
  }

  /** Runs `fn` with exclusive access to the catalogue. */
  private mutate<T>(fn: (all: ReportTemplate[]) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => fn(await this.list()))
    // Keep the chain alive even if this operation rejects.
    this.queue = run.catch(() => undefined)
    return run
  }

  private async writeAll(templates: ReportTemplate[]): Promise<void> {
    const temp = `${this.file}.tmp`
    await fs.writeFile(temp, JSON.stringify(templates, null, 2), 'utf8')
    await fs.rename(temp, this.file)
    this.cache = templates
  }
}
