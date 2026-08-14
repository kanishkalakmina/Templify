/**
 * Server configuration, entirely from environment variables.
 *
 * Defaults are chosen so `docker run -p 8080:8080 -v templify:/data` works with
 * no configuration at all — the same experience as Uptime Kuma or Grafana.
 */

import path from 'node:path'

function int(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  port: int(process.env.PORT, 8080),

  /**
   * Bind address. `0.0.0.0` explicitly, so published container ports behave
   * predictably rather than depending on the host's IPv6 dual-stack settings.
   */
  host: process.env.TEMPLIFY_HOST ?? '0.0.0.0',

  /** Where templates are persisted. Mount a volume here. */
  dataDir: process.env.TEMPLIFY_DATA_DIR ?? '/data',

  /** Built frontend assets served at the root path. Relative to the app root. */
  staticDir: process.env.TEMPLIFY_STATIC_DIR ?? path.join(process.cwd(), 'public'),

  /**
   * When set, every `/api` route except `/api/health` requires
   * `Authorization: Bearer <key>`. Empty means open — appropriate when the
   * container sits inside the customer's own network, which is the deployment
   * this product assumes.
   */
  apiKey: process.env.TEMPLIFY_API_KEY ?? '',

  /** System Chromium. The image installs it; puppeteer-core does not bundle one. */
  chromePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/chromium',

  /** Hard ceiling on a single render, so one bad template cannot wedge the server. */
  renderTimeoutMs: int(process.env.TEMPLIFY_RENDER_TIMEOUT_MS, 30_000),

  /** Rejects oversized payloads before they reach the renderer. */
  maxBodySize: process.env.TEMPLIFY_MAX_BODY ?? '8mb',

  version: process.env.TEMPLIFY_VERSION ?? '1.1.0',
} as const

export type Config = typeof config
