/**
 * Server-side document rendering.
 *
 * This is the payoff for the architecture's hardest rule. The document is
 * produced by the **same** `resolveDocument` + `ElementRenderer` the editor
 * uses — imported unchanged from `src/` — so a PDF cannot drift from what the
 * designer saw on the canvas. No second renderer exists to disagree.
 *
 * The only server-specific work is wrapping the markup in a print stylesheet
 * and driving headless Chromium.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import puppeteer, { type Browser } from 'puppeteer-core'
import type { ReportTemplate } from '../src/types/template'
import type { ReportData } from '../src/types/data'
import { resolveDocument, type ResolvedDocument } from '../src/services/resolveDocument'
import { DocumentPage } from '../src/render/DocumentPage'
import { config } from './config'
import { fontFaceCss } from './fonts'

/* -------------------------------------------------------------------------- */
/* HTML                                                                        */
/* -------------------------------------------------------------------------- */

/** Fonts are embedded per document — see `fonts.ts` for why. */
const PRINT_CSS = `
  @page { size: %WIDTH%px %HEIGHT%px; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
`

export function documentToHtml(doc: ResolvedDocument): string {
  const markup = renderToStaticMarkup(<DocumentPage doc={doc} scale={1} shadow="none" />)
  const css = PRINT_CSS.replace('%WIDTH%', String(doc.width)).replace('%HEIGHT%', String(doc.height))

  // Only the document's own script is embedded — an English invoice should not
  // carry Sinhala outlines.
  return `<!doctype html>
<html lang="${doc.locale}" dir="${doc.direction}">
<head>
<meta charset="utf-8">
<style>${fontFaceCss(doc.script)}</style>
<style>${css}</style>
</head>
<body>${markup}</body>
</html>`
}

export interface RenderResult {
  html: string
  doc: ResolvedDocument
}

export function renderTemplate(
  template: ReportTemplate,
  data: ReportData,
  options: { locale?: string; currency?: string } = {},
): RenderResult {
  const doc = resolveDocument(template, data, {
    mode: 'print',
    locale: options.locale,
    currency: options.currency,
  })
  return { html: documentToHtml(doc), doc }
}

/* -------------------------------------------------------------------------- */
/* PDF                                                                         */
/* -------------------------------------------------------------------------- */

let browserPromise: Promise<Browser> | null = null

/**
 * One browser for the process, launched lazily and reused. Chromium startup is
 * the dominant cost of a render; paying it per request would make the endpoint
 * needlessly slow.
 */
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: config.chromePath,
        headless: true,
        args: [
          // Required in a container without a user namespace sandbox.
          '--no-sandbox',
          '--disable-setuid-sandbox',
          // /dev/shm is small in Docker; without this Chromium crashes on big pages.
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none',
        ],
      })
      .catch((error) => {
        browserPromise = null
        throw error
      })
  }
  return browserPromise
}

export async function htmlToPdf(html: string, width: number, height: number): Promise<Uint8Array> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    page.setDefaultTimeout(config.renderTimeoutMs)
    await page.setViewport({ width: Math.ceil(width), height: Math.ceil(height) })
    // `load` rather than `networkidle`: the document references no remote
    // resources, and waiting for idle would stall on an offline host.
    await page.setContent(html, { waitUntil: 'load', timeout: config.renderTimeoutMs })
    await page.evaluateHandle('document.fonts.ready')

    return await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      pageRanges: '1',
      timeout: config.renderTimeoutMs,
    })
  } finally {
    await page.close().catch(() => undefined)
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return
  const browser = await browserPromise.catch(() => null)
  browserPromise = null
  await browser?.close().catch(() => undefined)
}

/** Used by the health endpoint to report whether PDF rendering is available. */
export async function probeChromium(): Promise<boolean> {
  try {
    const browser = await getBrowser()
    return browser.connected
  } catch {
    return false
  }
}
