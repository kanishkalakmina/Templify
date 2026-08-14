/**
 * Fonts embedded directly into the rendered document.
 *
 * The renderer deliberately does **not** rely on system fonts. Installing them
 * with apt turned out to be neither portable (`fonts-ibm-plex` is absent from
 * Debian bookworm) nor pinnable, and a font that silently falls back to DejaVu
 * would change every document's metrics without anyone noticing.
 *
 * Instead the exact `@fontsource` files — versioned by npm like any other
 * dependency — are inlined as `@font-face` rules with data URIs. Chromium
 * resolves them from the document itself, so rendering needs no network, no
 * fontconfig, and no system packages, and is byte-identical everywhere.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(__filename)

interface FaceSpec {
  family: string
  pkg: string
  /** Weights the built-in templates actually use. */
  weights: number[]
}

const FACES: FaceSpec[] = [
  { family: 'IBM Plex Sans', pkg: '@fontsource/ibm-plex-sans', weights: [400, 500, 600, 700] },
  { family: 'IBM Plex Mono', pkg: '@fontsource/ibm-plex-mono', weights: [400, 500] },
  { family: 'Source Serif 4', pkg: '@fontsource/source-serif-4', weights: [400, 600, 700] },
]

/** `@fontsource/ibm-plex-sans` -> `ibm-plex-sans`. */
function slug(pkg: string): string {
  return pkg.split('/')[1]
}

function filesDir(pkg: string): string | null {
  try {
    // Resolve through the package's own entry so this works from any cwd.
    const manifest = require.resolve(`${pkg}/package.json`)
    return path.join(path.dirname(manifest), 'files')
  } catch {
    return null
  }
}

let cached: string | null = null

/** `@font-face` CSS with every needed face inlined. Built once per process. */
export function fontFaceCss(): string {
  if (cached !== null) return cached

  const rules: string[] = []
  const missing: string[] = []

  for (const face of FACES) {
    const dir = filesDir(face.pkg)
    if (!dir) {
      missing.push(face.pkg)
      continue
    }

    for (const weight of face.weights) {
      const file = path.join(dir, `${slug(face.pkg)}-latin-${weight}-normal.woff2`)
      try {
        const base64 = fs.readFileSync(file).toString('base64')
        rules.push(
          `@font-face{font-family:'${face.family}';font-style:normal;font-weight:${weight};` +
            `font-display:block;src:url(data:font/woff2;base64,${base64}) format('woff2');}`,
        )
      } catch {
        missing.push(`${face.family} ${weight}`)
      }
    }
  }

  if (missing.length) {
    console.warn(`[fonts] Not embedded, will fall back: ${missing.join(', ')}`)
  }

  cached = rules.join('\n')
  return cached
}
