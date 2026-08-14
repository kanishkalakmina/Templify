/**
 * Catalogue operations over templates — creation, duplication, lookup, search.
 *
 * Pure functions on the schema. This module enforces the rule that **built-in
 * templates are never mutated**: the only way to work on one is
 * `duplicateTemplate`, which produces a user-owned copy.
 *
 * No React.
 */

import type {
  Orientation,
  PageSize,
  ReportTemplate,
  TemplateCategory,
} from '@/types/template'
import { initialVersion, clone, parseHandle, templateAtVersion } from './versioning'
import { uniqueSlug } from '@/utils/id'

/* -------------------------------------------------------------------------- */
/* Category metadata                                                           */
/* -------------------------------------------------------------------------- */

export const CATEGORIES: { value: TemplateCategory; label: string; plural: string }[] = [
  { value: 'invoice', label: 'Invoice', plural: 'Invoices' },
  { value: 'quotation', label: 'Quotation', plural: 'Quotations' },
  { value: 'receipt', label: 'Receipt', plural: 'Receipts' },
  { value: 'report', label: 'Report', plural: 'Reports' },
  { value: 'certificate', label: 'Certificate', plural: 'Certificates' },
  { value: 'hr', label: 'HR', plural: 'HR' },
  { value: 'other', label: 'Other', plural: 'Other' },
]

export function categoryLabel(category: TemplateCategory): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? 'Other'
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

export const DEFAULT_MARGINS = { top: 48, right: 48, bottom: 48, left: 48 }

export const DEFAULT_BRANDING = {
  primaryColor: '#2F5BFF',
  secondaryColor: '#0F172A',
  defaultLogo: '',
  defaultFooter: '',
  fontFamily: 'Inter, Helvetica Neue, Arial, sans-serif',
}

export interface NewTemplateInput {
  id: string
  name: string
  category: TemplateCategory
  description: string
  size: PageSize
  orientation: Orientation
}

export function createBlankTemplate(input: NewTemplateInput): ReportTemplate {
  const now = new Date().toISOString()
  const template: ReportTemplate = {
    id: input.id,
    name: input.name,
    category: input.category,
    description: input.description,
    version: 1,
    builtIn: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    page: {
      size: input.size,
      orientation: input.orientation,
      margins: { ...DEFAULT_MARGINS },
      background: '#FFFFFF',
    },
    branding: { ...DEFAULT_BRANDING },
    variables: [],
    elements: [],
    versions: [],
  }
  return { ...template, versions: [initialVersion(template)] }
}

/* -------------------------------------------------------------------------- */
/* Duplication                                                                 */
/* -------------------------------------------------------------------------- */

export interface DuplicateInput {
  id: string
  name: string
  description?: string
}

/**
 * Produces a user-owned copy of any template.
 *
 * This is the *only* route from a built-in template to an editable one — hence
 * `builtIn: false` and a reset version history. The copy starts at v1 with its
 * own lineage so the original can never be reached from it.
 */
export function duplicateTemplate(source: ReportTemplate, input: DuplicateInput): ReportTemplate {
  const now = new Date().toISOString()
  const copy: ReportTemplate = {
    ...clone(source),
    id: input.id,
    name: input.name,
    description: input.description ?? source.description,
    version: 1,
    builtIn: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    versions: [],
  }
  const note = source.builtIn
    ? `Created from built-in template "${source.name}"`
    : `Duplicated from "${source.name}"`
  return { ...copy, versions: [initialVersion(copy, note)] }
}

/** Suggests a free id for a copy, e.g. `invoice-modern` -> `invoice-modern-2`. */
export function suggestCopyId(source: ReportTemplate, taken: Iterable<string>): string {
  return uniqueSlug(source.id, taken)
}

/* -------------------------------------------------------------------------- */
/* Lookup                                                                      */
/* -------------------------------------------------------------------------- */

export interface TemplatePools {
  user: ReportTemplate[]
  builtIn: ReportTemplate[]
}

/**
 * Resolves a `templateId` the way the render API would: user templates first,
 * then the built-in catalogue, honouring an optional `:vN` pin.
 */
export function findTemplate(handle: string, pools: TemplatePools): ReportTemplate | undefined {
  const { id, version } = parseHandle(handle)
  const template = pools.user.find((t) => t.id === id) ?? pools.builtIn.find((t) => t.id === id)
  if (!template) return undefined
  if (version === undefined) return template
  return templateAtVersion(template, version)
}

/* -------------------------------------------------------------------------- */
/* Search and filtering                                                        */
/* -------------------------------------------------------------------------- */

export type CategoryFilter = TemplateCategory | 'all'

export function filterTemplates(
  templates: ReportTemplate[],
  options: { query?: string; category?: CategoryFilter; includeArchived?: boolean } = {},
): ReportTemplate[] {
  const { query = '', category = 'all', includeArchived = false } = options
  const needle = query.trim().toLowerCase()

  return templates.filter((t) => {
    if (!includeArchived && t.archived) return false
    if (category !== 'all' && t.category !== category) return false
    if (!needle) return true
    return (
      t.name.toLowerCase().includes(needle) ||
      t.id.toLowerCase().includes(needle) ||
      t.description.toLowerCase().includes(needle) ||
      categoryLabel(t.category).toLowerCase().includes(needle)
    )
  })
}

export function sortByUpdated(templates: ReportTemplate[]): ReportTemplate[] {
  return [...templates].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}
