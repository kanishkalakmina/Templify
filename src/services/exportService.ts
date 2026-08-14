/**
 * Template import / export — the `.templify` file format.
 *
 * **Safety invariant:** an export contains the *design* only. This module does
 * not import `testDataStore` and has no reference to any report payload, so
 * customer data cannot leak into an exported file — the guarantee is structural
 * rather than a rule someone has to remember (architecture NFR-012).
 *
 * Pure functions; the browser download itself lives in `utils/download`.
 * No React.
 */

import type { ReportTemplate, TemplateExportFile } from '@/types/template'
import { clone, initialVersion } from './versioning'
import { uniqueSlug } from '@/utils/id'
import { DEFAULT_BRANDING, DEFAULT_MARGINS } from './templateCatalog'

export const TEMPLATE_FILE_EXTENSION = '.templify'
export const TEMPLATE_FILE_FORMAT = 'templify.template'

/* -------------------------------------------------------------------------- */
/* Export                                                                      */
/* -------------------------------------------------------------------------- */

export function toExportFile(template: ReportTemplate): TemplateExportFile {
  // Destructured out rather than deleted, so adding a field to ReportTemplate
  // forces a decision here instead of silently exporting it.
  const { versions, builtIn, archived, ...design } = template
  return {
    format: TEMPLATE_FILE_FORMAT,
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    template: clone(design),
  }
}

export function serializeTemplate(template: ReportTemplate): string {
  return JSON.stringify(toExportFile(template), null, 2)
}

export function exportFileName(template: ReportTemplate): string {
  return `${template.id}${TEMPLATE_FILE_EXTENSION}`
}

/* -------------------------------------------------------------------------- */
/* Import                                                                      */
/* -------------------------------------------------------------------------- */

export type ImportResult =
  | { ok: true; template: ReportTemplate; renamed: boolean }
  | { ok: false; error: string }

/**
 * Parses and validates a `.templify` file, then re-keys it into the user's
 * catalogue. An imported file is untrusted input: everything is shape-checked
 * and defaulted rather than trusted, and the id is reassigned on collision so
 * an import can never overwrite an existing template.
 */
export function parseTemplateFile(raw: string, takenIds: Iterable<string>): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }

  if (!isRecord(parsed)) return { ok: false, error: 'Unexpected file contents.' }
  if (parsed.format !== TEMPLATE_FILE_FORMAT) {
    return { ok: false, error: `Not a Templify template file (missing "${TEMPLATE_FILE_FORMAT}" marker).` }
  }
  if (!isRecord(parsed.template)) {
    return { ok: false, error: 'The file does not contain a template.' }
  }

  const source = parsed.template
  const name = typeof source.name === 'string' && source.name.trim() ? source.name : 'Imported Template'
  const requestedId = typeof source.id === 'string' && source.id.trim() ? source.id : name
  const id = uniqueSlug(requestedId, takenIds)
  const now = new Date().toISOString()

  const template: ReportTemplate = {
    id,
    name,
    category: isCategory(source.category) ? source.category : 'other',
    description: typeof source.description === 'string' ? source.description : '',
    version: 1,
    builtIn: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    page: normalisePage(source.page),
    branding: { ...DEFAULT_BRANDING, ...(isRecord(source.branding) ? source.branding : {}) },
    variables: Array.isArray(source.variables) ? (source.variables as ReportTemplate['variables']) : [],
    elements: Array.isArray(source.elements) ? (source.elements as ReportTemplate['elements']) : [],
    versions: [],
  }

  if (!template.elements.length && !Array.isArray(source.elements)) {
    return { ok: false, error: 'The template has no elements array.' }
  }

  return {
    ok: true,
    template: { ...template, versions: [initialVersion(template, 'Imported template')] },
    renamed: id !== requestedId,
  }
}

/* -------------------------------------------------------------------------- */
/* Normalisation                                                               */
/* -------------------------------------------------------------------------- */

function normalisePage(value: unknown): ReportTemplate['page'] {
  const fallback = {
    size: 'A4' as const,
    orientation: 'portrait' as const,
    margins: { ...DEFAULT_MARGINS },
    background: '#FFFFFF',
  }
  if (!isRecord(value)) return fallback

  const size = value.size === 'A5' || value.size === 'LETTER' || value.size === 'A4' ? value.size : 'A4'
  const orientation = value.orientation === 'landscape' ? 'landscape' : 'portrait'
  const margins = isRecord(value.margins)
    ? {
        top: numberOr(value.margins.top, DEFAULT_MARGINS.top),
        right: numberOr(value.margins.right, DEFAULT_MARGINS.right),
        bottom: numberOr(value.margins.bottom, DEFAULT_MARGINS.bottom),
        left: numberOr(value.margins.left, DEFAULT_MARGINS.left),
      }
    : { ...DEFAULT_MARGINS }

  return {
    size,
    orientation,
    margins,
    background: typeof value.background === 'string' ? value.background : '#FFFFFF',
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCategory(value: unknown): value is ReportTemplate['category'] {
  return (
    typeof value === 'string' &&
    ['invoice', 'quotation', 'receipt', 'report', 'certificate', 'hr', 'other'].includes(value)
  )
}
