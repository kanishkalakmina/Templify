/**
 * Chooses where templates live, at boot.
 *
 * This is the seam the whole self-hosting story hangs on, made concrete: if a
 * report server answers on this origin, templates are shared and API-addressable;
 * otherwise the app falls back to browser storage and still works with no
 * backend at all. Nothing above this function changes either way.
 */

import type { ReportTemplate } from '@/types/template'
import {
  HttpTemplateRepository,
  LocalStorageTemplateRepository,
  type TemplateRepository,
} from './templateRepository'

export type StorageMode = 'server' | 'local'

export interface ServerInfo {
  status: string
  version: string
  templates: number
  /** Whether headless Chromium is available for PDF rendering. */
  pdf: boolean
  auth: 'required' | 'open'
}

export interface RepositoryBinding {
  repository: TemplateRepository
  mode: StorageMode
  serverUrl: string
  info: ServerInfo | null
}

/** Kept short: a missing server should not delay first paint. */
const PROBE_TIMEOUT_MS = 2000

export async function createRepository(
  seed: () => ReportTemplate[],
): Promise<RepositoryBinding> {
  const configured = (import.meta.env.VITE_TEMPLIFY_SERVER ?? '').replace(/\/$/, '')

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    const response = await fetch(`${configured}/api/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timer)

    if (response.ok) {
      const info = (await response.json()) as ServerInfo
      if (info?.status === 'ok') {
        return {
          repository: new HttpTemplateRepository(configured),
          mode: 'server',
          serverUrl: configured || window.location.origin,
          info,
        }
      }
    }
  } catch {
    // No server reachable — the prototype path. Not an error.
  }

  return {
    repository: new LocalStorageTemplateRepository(seed),
    mode: 'local',
    serverUrl: '',
    info: null,
  }
}
