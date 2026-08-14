/**
 * Template versioning.
 *
 * Versions hold **full immutable snapshots**, not diffs: a version must be
 * reconstructible in isolation — including in a different process, when the
 * render server resolves `invoice-modern:v2`. Templates are kilobytes, so the
 * storage cost is irrelevant next to the correctness guarantee.
 *
 * History is append-only. Restoring an old version does not rewind the list; it
 * appends a new version carrying the old content, so nothing is ever lost.
 *
 * No React.
 */

import type { ReportTemplate, TemplateSnapshot, TemplateVersion } from '@/types/template'

/** Deep clone. `structuredClone` where available, JSON otherwise. */
export function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

/** Extracts the versionable surface — everything that affects output. */
export function snapshotOf(template: ReportTemplate): TemplateSnapshot {
  return clone({
    page: template.page,
    branding: template.branding,
    variables: template.variables,
    elements: template.elements,
  })
}

/** Returns a copy of `template` with `snapshot`'s design applied. */
export function applySnapshot(template: ReportTemplate, snapshot: TemplateSnapshot): ReportTemplate {
  const next = clone(snapshot)
  return {
    ...template,
    page: next.page,
    branding: next.branding,
    variables: next.variables,
    elements: next.elements,
  }
}

/**
 * Appends the template's current design as a new version and advances the
 * version pointer. This is what "Save" does when the design has changed.
 */
export function createVersion(template: ReportTemplate, note = ''): ReportTemplate {
  const version = template.version + 1
  const entry: TemplateVersion = {
    version,
    createdAt: new Date().toISOString(),
    note,
    snapshot: snapshotOf(template),
  }
  return {
    ...template,
    version,
    versions: [...template.versions, entry],
    updatedAt: entry.createdAt,
  }
}

/** The initial v1 entry for a freshly created template. */
export function initialVersion(template: ReportTemplate, note = 'Template created'): TemplateVersion {
  return {
    version: template.version,
    createdAt: template.createdAt,
    note,
    snapshot: snapshotOf(template),
  }
}

export function findVersion(template: ReportTemplate, version: number): TemplateVersion | undefined {
  return template.versions.find((v) => v.version === version)
}

/** The template as it looked at `version`. Used by preview and by pinned handles. */
export function templateAtVersion(
  template: ReportTemplate,
  version: number,
): ReportTemplate | undefined {
  const entry = findVersion(template, version)
  if (!entry) return undefined
  return { ...applySnapshot(template, entry.snapshot), version: entry.version }
}

/**
 * Restores an earlier design by appending it as a new version.
 * History stays append-only, so a restore is itself undoable by restoring again.
 */
export function restoreVersion(template: ReportTemplate, version: number): ReportTemplate | undefined {
  const entry = findVersion(template, version)
  if (!entry) return undefined
  const restored = applySnapshot(template, entry.snapshot)
  return createVersion(restored, `Restored from v${version}`)
}

/** Newest first — the order the version history panel displays. */
export function versionsDescending(template: ReportTemplate): TemplateVersion[] {
  return [...template.versions].sort((a, b) => b.version - a.version)
}

/* -------------------------------------------------------------------------- */
/* Handles                                                                     */
/* -------------------------------------------------------------------------- */

export interface TemplateHandle {
  id: string
  /** Undefined means "latest", which is what most integrations should use. */
  version?: number
}

/**
 * Parses the identifier an application sends as `templateId`.
 *
 *   `invoice-modern`     -> latest
 *   `invoice-modern:v2`  -> pinned to version 2
 *
 * Pinning is what stops a designer's edit from breaking a live integration.
 */
export function parseHandle(handle: string): TemplateHandle {
  const trimmed = handle.trim()
  const match = /^(.*):v(\d+)$/.exec(trimmed)
  if (!match) return { id: trimmed }
  return { id: match[1], version: Number(match[2]) }
}

export function formatHandle(id: string, version?: number): string {
  return version === undefined ? id : `${id}:v${version}`
}
