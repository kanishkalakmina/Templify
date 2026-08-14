/**
 * Non-Latin document fonts for the **browser**.
 *
 * The render server embeds these per document (see `server/fonts.ts`), but the
 * editor canvas, preview and thumbnails are ordinary DOM — so without this a
 * designer who switched the document language to Sinhala would see tofu boxes on
 * screen while the PDF came out correct. Same mechanism as the server: register
 * Noto under the *same* family names, restricted by `unicode-range`, so the
 * browser resolves per glyph and templates need no font changes.
 *
 * The `unicode-range` also makes this lazy — a browser only downloads the
 * Sinhala file once a Sinhala codepoint is actually on the page, so an
 * English-only workspace pays nothing.
 */

import sinhala400 from '@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-sinhala-400-normal.woff2?url'
import sinhala600 from '@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-sinhala-600-normal.woff2?url'
import sinhala700 from '@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-sinhala-700-normal.woff2?url'
import tamil400 from '@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-400-normal.woff2?url'
import tamil600 from '@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-600-normal.woff2?url'
import tamil700 from '@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-700-normal.woff2?url'

/** Families a template can name. Each gains the non-Latin coverage. */
const FAMILIES = ['IBM Plex Sans', 'IBM Plex Mono', 'Source Serif 4']

const SINHALA_RANGE = 'U+0D80-0DFF, U+200C-200D, U+2010, U+25CC'
const TAMIL_RANGE = 'U+0B80-0BFF, U+200C-200D, U+2010, U+25CC'

const SCRIPTS = [
  { range: SINHALA_RANGE, files: { 400: sinhala400, 600: sinhala600, 700: sinhala700 } },
  { range: TAMIL_RANGE, files: { 400: tamil400, 600: tamil600, 700: tamil700 } },
]

/** Weights the Noto files provide; other weights match to the nearest. */
const STYLE_ID = 'templify-document-fonts'

/** Injects the aliased `@font-face` rules once per document. */
export function installDocumentFonts(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return

  const rules: string[] = []
  for (const script of SCRIPTS) {
    for (const [weight, url] of Object.entries(script.files)) {
      for (const family of FAMILIES) {
        rules.push(
          `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
            `font-display:swap;unicode-range:${script.range};` +
            `src:url(${url}) format('woff2');}`,
        )
      }
    }
  }

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
}
