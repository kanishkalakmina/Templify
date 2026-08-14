/**
 * First-run seed for the user's template catalogue.
 *
 * The specification asks for ready-made templates that open in the editor (§30).
 * Those must be **user-owned**, not built-ins — a built-in cannot be edited by
 * design — so the seed produces copies, exactly as if the user had chosen
 * "Use Template" for each.
 *
 * Each seeded template carries a plausible version history so Version History
 * and Restore are exercisable from a cold start rather than empty.
 *
 * Passed to `LocalStorageTemplateRepository` as a factory, keeping the
 * repository independent of template content.
 */

import type { ReportTemplate, TemplateVersion } from '@/types/template'
import { BUILT_IN_SPECS, specToTemplate } from './builtin'
import { snapshotOf } from '@/services/versioning'

interface SeedSpec {
  /** Catalogue entry to copy. */
  from: string
  /** Overrides the catalogue name where the workspace uses a different one. */
  name?: string
  description?: string
  /** Current version number; a matching history is synthesised. */
  version: number
  /** Hours before "now" that this template was last touched. */
  updatedHoursAgo: number
  notes?: string[]
}

const SEEDS: SeedSpec[] = [
  {
    from: 'invoice-modern',
    version: 3,
    updatedHoursAgo: 2,
    notes: ['Initial layout', 'Tightened totals block', 'Added QR verification'],
  },
  { from: 'invoice-classic', version: 2, updatedHoursAgo: 26, notes: ['Initial layout', 'Switched to serif display'] },
  { from: 'invoice-minimal', version: 1, updatedHoursAgo: 8 * 24, notes: ['Initial layout'] },
  {
    from: 'invoice-corporate',
    version: 4,
    updatedHoursAgo: 5 * 24,
    notes: ['Initial layout', 'Added header band', 'Reversed logo treatment', 'Rebalanced totals'],
  },
  {
    from: 'quotation-corporate',
    version: 2,
    updatedHoursAgo: 1,
    notes: ['Initial layout', 'Renamed item column to Scope'],
  },
  { from: 'certificate-classic', version: 1, updatedHoursAgo: 27, notes: ['Initial layout'] },
  {
    from: 'payslip-modern',
    name: 'Payslip Modern',
    version: 2,
    updatedHoursAgo: 10 * 24,
    notes: ['Initial layout', 'Added deductions row'],
  },
  {
    from: 'audit-report',
    name: 'Security Audit',
    description: 'Multi-section audit report with KPIs and findings chart.',
    version: 5,
    updatedHoursAgo: 3 * 24,
    notes: ['Initial layout', 'Added KPI row', 'Added findings chart', 'Reworked summary copy', 'Confidential footer'],
  },
]

const HOUR = 3600_000

/**
 * Builds a version history ending at `version`.
 *
 * Every entry stores the same snapshot: the seed has no genuine earlier
 * designs, and fabricating differences would make Restore silently mangle the
 * template. Restoring an older seeded version is therefore a no-op on content
 * while still exercising the real append-only versioning path.
 */
function synthesiseHistory(template: ReportTemplate, spec: SeedSpec, now: number): TemplateVersion[] {
  const snapshot = snapshotOf(template)
  const versions: TemplateVersion[] = []

  for (let v = 1; v <= spec.version; v += 1) {
    // Space earlier versions back from the last-updated time.
    const stepsBack = spec.version - v
    const createdAt = new Date(now - spec.updatedHoursAgo * HOUR - stepsBack * 30 * HOUR).toISOString()
    versions.push({
      version: v,
      createdAt,
      note: spec.notes?.[v - 1] ?? `Version ${v}`,
      snapshot,
    })
  }

  return versions
}

export function seedTemplates(): ReportTemplate[] {
  const now = Date.now()
  const seeded: ReportTemplate[] = []

  for (const spec of SEEDS) {
    const source = BUILT_IN_SPECS.find((s) => s.id === spec.from)
    if (!source) continue

    const base = specToTemplate(source)
    const updatedAt = new Date(now - spec.updatedHoursAgo * HOUR).toISOString()

    const template: ReportTemplate = {
      ...base,
      name: spec.name ?? base.name,
      description: spec.description ?? base.description,
      // Copy-on-use: the seed is a user template, never a built-in.
      builtIn: false,
      version: spec.version,
      createdAt: new Date(now - (spec.updatedHoursAgo + spec.version * 30) * HOUR).toISOString(),
      updatedAt,
      versions: [],
    }

    seeded.push({ ...template, versions: synthesiseHistory(template, spec, now) })
  }

  return seeded
}
