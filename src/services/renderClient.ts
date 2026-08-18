/**
 * Calls the report server's render endpoint from the app itself.
 *
 * The editor draws documents in-browser through `resolveDocument`, which is the
 * right thing for a canvas. This is the other path — asking the *server* for the
 * same document as print-ready markup, exactly as a calling application would.
 * It exists so the product can demonstrate the integration it documents rather
 * than only describing it.
 *
 * HTML rather than PDF, deliberately:
 *
 *   · `iframe.contentWindow.print()` works on markup. Point an iframe at a PDF
 *     and the browser hands it to its built-in viewer, which frequently ignores
 *     a scripted print() — the button silently does nothing.
 *   · It never touches Chromium, so it returns in milliseconds rather than
 *     about a second.
 *   · It is the same markup the PDF is made from, so the paper is identical.
 */

import type { ReportData } from '@/types/data'

export interface RenderedDocument {
  /** Print-ready markup: carries its own `@page` size and embedded fonts. */
  html: string
  /** Paths the template referenced that the payload did not carry. */
  missing: string[]
  /** The locale actually used — an unrecognised request falls back to English. */
  locale: string
}

export async function renderDocumentHtml(
  serverUrl: string,
  templateId: string,
  data: ReportData,
  options: { locale?: string; currency?: string } = {},
): Promise<RenderedDocument> {
  const response = await fetch(`${serverUrl}/api/reports/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId,
      data,
      locale: options.locale,
      options: { format: 'html', currency: options.currency },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Render failed (${response.status}). ${detail.slice(0, 200)}`)
  }

  // Always reported, never fatal: unresolved paths render as blank fields, which
  // is worth surfacing rather than shipping unnoticed.
  const missing = response.headers.get('X-Templify-Missing-Bindings')

  return {
    html: await response.text(),
    missing: missing ? missing.split(',').filter(Boolean) : [],
    locale: response.headers.get('X-Templify-Locale') ?? 'en',
  }
}
