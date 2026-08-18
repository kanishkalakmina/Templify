/**
 * The only file in this example that talks to Templify.
 *
 * Two choices here are worth understanding, because they are what make a
 * counter print work rather than merely compile.
 *
 * 1. `format: 'html'`, not PDF.
 *
 *    Not a debugging aid. Templify's HTML output already carries
 *    `@page { size: <w>px <h>px; margin: 0 }` and `print-color-adjust: exact`,
 *    so the browser's print dialog picks up the real paper size, drops its own
 *    margins and keeps the colours. Two further consequences:
 *
 *      · `iframe.contentWindow.print()` actually works. Point an iframe at a
 *        PDF instead and the browser hands it to its built-in PDF viewer, which
 *        frequently ignores a scripted print() — the button silently does
 *        nothing.
 *      · It never touches Chromium, so it returns in milliseconds instead of
 *        about a second. At a counter with a queue, that is the difference you
 *        feel.
 *
 *    The PDF is Chromium printing this same markup, so the paper is identical.
 *    Ask for `format: 'pdf'` when a *file* has to exist — emailing or saving.
 *
 * 2. No version pin.
 *
 *    `invoice-modern` always renders the current design, so a reprint next
 *    month uses next month's layout. That is deliberate for a shop bill: the
 *    numbers come from the saved bill either way, and only the design drifts.
 *    Send `invoice-modern:v3` instead when a document must be reproducible
 *    exactly — a tax invoice, a payslip, anything an auditor may ask for.
 */

/** Same origin, courtesy of the Vite proxy. See vite.config.js. */
const API = '/api'

/**
 * Renders a bill and returns print-ready markup.
 *
 * Note what is *not* passed: paper size, orientation, margins, fonts. All of
 * that lives with the template on the Templify side, which is why switching a
 * bill from A4 to A5 is an edit in the editor and not a change here.
 */
export async function renderBillHtml(templateId, reportData, { currency = 'LKR' } = {}) {
  const response = await fetch(`${API}/reports/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId,
      data: reportData,
      options: { format: 'html', currency },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Render failed (${response.status}). ${detail.slice(0, 300)}`)
  }

  // Always reported, never fatal: paths the template asked for that the payload
  // did not carry. They render as blank fields, which on a bill is worth
  // surfacing rather than shipping. `options.strict: true` would make it a 422.
  const missing = response.headers.get('X-Templify-Missing-Bindings')

  return {
    html: await response.text(),
    missing: missing ? missing.split(',') : [],
  }
}

/**
 * Templates available on the server.
 *
 * Returns whatever has been saved to Templify's data volume. The 26 built-in
 * layouts resolve by id whether or not they were ever saved, so App.jsx merges
 * a couple of interesting ones in by hand.
 */
export async function listTemplates() {
  const response = await fetch(`${API}/templates`)
  if (!response.ok) throw new Error(`Could not list templates (${response.status})`)

  // The full template documents come back, elements and all. Only the id, name
  // and page are needed for a picker, so the rest is dropped here.
  const templates = await response.json()
  return templates.map((t) => ({ id: t.id, name: t.name, page: t.page }))
}
