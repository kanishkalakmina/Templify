/**
 * Templify report server.
 *
 * One container serves both the editor UI and the API on a single port, with
 * templates persisted to a mounted volume — the same shape as any other
 * self-hosted tool you would `docker run` and forget about.
 *
 *   docker run -d -p 8080:8080 -v templify:/data templify/report-server
 */

import express, { type NextFunction, type Request, type Response } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config'
import { TemplateStore } from './storage'
import { closeBrowser, htmlToPdf, probeChromium, renderTemplate } from './renderer'
import type { ReportTemplate } from '../src/types/template'
import { parseHandle, templateAtVersion } from '../src/services/versioning'
import { BUILT_IN_TEMPLATES } from '../src/templates/builtin'

const store = new TemplateStore(config.dataDir)
const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: config.maxBodySize }))

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Optional bearer auth. The client here is a server process, not a person, so a
 * shared key is the right mechanism — user-level OAuth would add a login wall to
 * a single-tenant design tool and satisfy no requirement.
 */
function requireKey(req: Request, res: Response, next: NextFunction) {
  if (!config.apiKey) return next()
  const header = req.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (token && token === config.apiKey) return next()
  res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid API key.' })
}

/* -------------------------------------------------------------------------- */
/* Health                                                                      */
/* -------------------------------------------------------------------------- */

app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'ok',
    version: config.version,
    templates: (await store.list()).length,
    pdf: await probeChromium(),
    auth: config.apiKey ? 'required' : 'open',
  })
})

/* -------------------------------------------------------------------------- */
/* Templates                                                                   */
/* -------------------------------------------------------------------------- */

/** Express 5 types route params as `string | string[]`; we only ever want one. */
function param(req: Request, name: string): string {
  const value = (req.params as Record<string, string | string[]>)[name]
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

/** Resolves a plain id or a pinned `id:vN` handle, user templates first. */
async function resolveHandle(handle: string): Promise<ReportTemplate | undefined> {
  const { id, version } = parseHandle(handle)
  const template = (await store.get(id)) ?? BUILT_IN_TEMPLATES.find((t) => t.id === id)
  if (!template) return undefined
  return version === undefined ? template : templateAtVersion(template, version)
}

app.get('/api/templates', requireKey, async (_req, res) => {
  res.json(await store.list())
})

app.get('/api/templates/:id', requireKey, async (req, res) => {
  const id = param(req, 'id')
  const template = await resolveHandle(id)
  if (!template) {
    res.status(404).json({ error: 'not_found', templateId: id })
    return
  }
  res.json(template)
})

app.post('/api/templates', requireKey, async (req, res) => {
  const template = req.body as ReportTemplate
  if (!template?.id) {
    res.status(400).json({ error: 'invalid_template', message: 'A template id is required.' })
    return
  }
  if (await store.get(template.id)) {
    res.status(409).json({ error: 'conflict', message: `Template "${template.id}" already exists.` })
    return
  }
  res.status(201).json(await store.save(template))
})

app.put('/api/templates/:id', requireKey, async (req, res) => {
  const template = req.body as ReportTemplate
  if (!template?.id || template.id !== param(req, 'id')) {
    res.status(400).json({ error: 'invalid_template', message: 'Body id must match the URL id.' })
    return
  }
  res.json(await store.save(template))
})

app.delete('/api/templates/:id', requireKey, async (req, res) => {
  const id = param(req, 'id')
  if (!(await store.remove(id))) {
    res.status(404).json({ error: 'not_found', templateId: id })
    return
  }
  res.status(204).end()
})

/* -------------------------------------------------------------------------- */
/* Render                                                                      */
/* -------------------------------------------------------------------------- */

app.post('/api/reports/render', requireKey, async (req, res) => {
  const { templateId, data, options } = (req.body ?? {}) as {
    templateId?: string
    data?: Record<string, unknown>
    options?: { format?: 'pdf' | 'html'; filename?: string; strict?: boolean }
  }

  if (!templateId) {
    res.status(400).json({ error: 'invalid_request', message: '"templateId" is required.' })
    return
  }

  const template = await resolveHandle(templateId)
  if (!template) {
    res.status(404).json({ error: 'not_found', templateId })
    return
  }

  const { html, doc } = renderTemplate(template, data ?? {})

  // Unresolved bindings are the integrator's most likely failure mode, so they
  // are always reported. `strict` turns them into a hard error rather than a
  // silently blank field.
  if (doc.missingBindings.length) {
    res.setHeader('X-Templify-Missing-Bindings', doc.missingBindings.join(','))
    if (options?.strict) {
      res.status(422).json({
        error: 'missing_bindings',
        message: 'The data payload is missing paths referenced by this template.',
        templateId,
        missing: doc.missingBindings,
      })
      return
    }
  }

  const filename = options?.filename ?? `${parseHandle(templateId).id}`

  if (options?.format === 'html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Disposition', `inline; filename="${filename}.html"`)
    res.send(html)
    return
  }

  try {
    const pdf = await htmlToPdf(html, doc.width, doc.height)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}.pdf"`)
    res.send(Buffer.from(pdf))
  } catch (error) {
    console.error('[render] PDF generation failed:', error)
    res.status(500).json({
      error: 'render_failed',
      message: 'The document could not be converted to PDF.',
      detail: (error as Error).message,
    })
  }
})

/* -------------------------------------------------------------------------- */
/* Static frontend                                                             */
/* -------------------------------------------------------------------------- */

if (fs.existsSync(config.staticDir)) {
  app.use(express.static(config.staticDir, { index: false, maxAge: '1h' }))

  // SPA fallback — client-side routes such as /editor/invoice-modern must serve
  // index.html, but /api/* must never fall through to it.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(config.staticDir, 'index.html'))
  })
} else {
  console.warn(`[server] No static assets at ${config.staticDir} — serving API only.`)
}

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server]', error)
  res.status(500).json({ error: 'internal_error', message: error.message })
})

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                   */
/* -------------------------------------------------------------------------- */

async function start() {
  await store.init()
  const server = app.listen(config.port, config.host, () => {
    console.log(`Templify ${config.version} listening on ${config.host}:${config.port}`)
    console.log(`  data   ${config.dataDir}`)
    console.log(`  static ${fs.existsSync(config.staticDir) ? config.staticDir : '(none)'}`)
    console.log(`  auth   ${config.apiKey ? 'API key required' : 'open'}`)
  })

  const shutdown = async (signal: string) => {
    console.log(`\n[server] ${signal} — shutting down`)
    server.close()
    await closeBrowser()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

void start()
