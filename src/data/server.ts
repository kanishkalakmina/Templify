/**
 * Self-hosted server presentation values.
 *
 * A UI representation only — the frontend never controls Docker, and has no
 * business holding daemon credentials (PRD §25).
 */

export const SERVER = {
  name: 'Templify',
  image: 'templify/report-server',
  host: 'localhost:8080',
  url: 'http://localhost:8080',
  /** Hostname an application inside the same Docker network would call. */
  internalHost: 'http://templify:8080',
  version: '1.1.0',
  status: 'Running',
  keyPrefix: 'tf_live_',
  envVar: 'TEMPLIFY_KEY',
} as const

export const DOCKER_COMMAND = `docker run -d \\
  -p 8080:8080 \\
  ${SERVER.image}`
