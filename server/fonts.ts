/**
 * Fonts embedded directly into the rendered document.
 *
 * The renderer deliberately does **not** rely on system fonts. Installing them
 * with apt turned out to be neither portable (`fonts-ibm-plex` is absent from
 * Debian bookworm) nor pinnable, and a font that silently falls back would change
 * every document's metrics without anyone noticing.
 *
 * ## How non-Latin scripts work
 *
 * IBM Plex has no Sinhala or Tamil coverage, so those would render as tofu boxes
 * (▯▯▯) — silently, with no error. Rather than force templates to name a
 * different font per language, the Noto faces are registered **under the same
 * family names** with a `unicode-range` limited to their script. The browser then
 * picks per glyph: Latin characters come from IBM Plex, Sinhala from Noto Sans
 * Sinhala, and a template that says `font-family: 'IBM Plex Sans'` needs no
 * change at all.
 *
 * Only the scripts a document actually needs are embedded, so an English invoice
 * does not carry a megabyte of Sinhala outlines.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { Script } from '../src/i18n/locales'

const require = createRequire(__filename)

/** Latin faces, one per family and weight the built-in templates use. */
const LATIN_FACES: { family: string; pkg: string; weights: number[] }[] = [
  { family: 'IBM Plex Sans', pkg: '@fontsource/ibm-plex-sans', weights: [400, 500, 600, 700] },
  // 600 matters: the logo placeholder and table headers ask for semibold mono,
  // and without it Chromium substitutes DejaVu Sans Mono — a visible font swap.
  { family: 'IBM Plex Mono', pkg: '@fontsource/ibm-plex-mono', weights: [400, 500, 600] },
  { family: 'Source Serif 4', pkg: '@fontsource/source-serif-4', weights: [400, 600, 700] },
]

/** Families that must gain non-Latin coverage. */
const TARGET_FAMILIES = ['IBM Plex Sans', 'IBM Plex Mono', 'Source Serif 4']

interface ScriptFont {
  pkg: string
  /** `@fontsource` subset name, which is also the filename segment. */
  subset: string
  /** CSS `unicode-range` restricting these faces to the script's block. */
  unicodeRange: string
  weights: number[]
}

const SCRIPT_FONTS: Record<Exclude<Script, 'latin'>, ScriptFont> = {
  sinhala: {
    pkg: '@fontsource/noto-sans-sinhala',
    subset: 'sinhala',
    // Sinhala block, plus the generic punctuation Sinhala text uses.
    unicodeRange: 'U+0D80-0DFF, U+200C-200D, U+2010, U+25CC',
    weights: [400, 600, 700],
  },
  tamil: {
    pkg: '@fontsource/noto-sans-tamil',
    subset: 'tamil',
    unicodeRange: 'U+0B80-0BFF, U+200C-200D, U+2010, U+25CC',
    weights: [400, 600, 700],
  },
}

function filesDir(pkg: string): string | null {
  try {
    // Resolve through the package manifest so this works from any cwd.
    const manifest = require.resolve(`${pkg}/package.json`)
    return path.join(path.dirname(manifest), 'files')
  } catch {
    return null
  }
}

/** `@fontsource/ibm-plex-sans` -> `ibm-plex-sans`. */
function slug(pkg: string): string {
  return pkg.split('/')[1]
}

function face(
  family: string,
  weight: number,
  base64: string,
  unicodeRange?: string,
): string {
  const range = unicodeRange ? `unicode-range:${unicodeRange};` : ''
  return (
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
    `font-display:block;${range}` +
    `src:url(data:font/woff2;base64,${base64}) format('woff2');}`
  )
}

function readFont(dir: string, pkg: string, subset: string, weight: number): string | null {
  const file = path.join(dir, `${slug(pkg)}-${subset}-${weight}-normal.woff2`)
  try {
    return fs.readFileSync(file).toString('base64')
  } catch {
    return null
  }
}

const CACHE = new Map<Script, string>()
const warned = new Set<string>()

function warnOnce(message: string) {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(`[fonts] ${message}`)
}

/**
 * `@font-face` CSS covering Latin plus the given script. Built once per script.
 */
export function fontFaceCss(script: Script = 'latin'): string {
  const cached = CACHE.get(script)
  if (cached !== undefined) return cached

  const rules: string[] = []

  // Latin always: digits, brand names and email addresses appear in every
  // document regardless of language.
  for (const spec of LATIN_FACES) {
    const dir = filesDir(spec.pkg)
    if (!dir) {
      warnOnce(`${spec.pkg} not installed — ${spec.family} will fall back`)
      continue
    }
    for (const weight of spec.weights) {
      const base64 = readFont(dir, spec.pkg, 'latin', weight)
      if (base64) rules.push(face(spec.family, weight, base64))
      else warnOnce(`missing ${spec.family} ${weight}`)
    }
  }

  if (script !== 'latin') {
    const spec = SCRIPT_FONTS[script]
    const dir = filesDir(spec.pkg)
    if (!dir) {
      warnOnce(`${spec.pkg} not installed — ${script} text will render as boxes`)
    } else {
      for (const weight of spec.weights) {
        const base64 = readFont(dir, spec.pkg, spec.subset, weight)
        if (!base64) {
          warnOnce(`missing ${script} weight ${weight}`)
          continue
        }
        // Registered under every family name, so whichever font a template
        // names, the script's glyphs resolve.
        for (const family of TARGET_FAMILIES) {
          rules.push(face(family, weight, base64, spec.unicodeRange))
        }
      }
    }
  }

  const css = rules.join('\n')
  CACHE.set(script, css)
  return css
}

/** Diagnostic for `/api/health`: which scripts have embeddable fonts present. */
export function availableScripts(): Script[] {
  const out: Script[] = ['latin']
  for (const [script, spec] of Object.entries(SCRIPT_FONTS)) {
    const dir = filesDir(spec.pkg)
    if (dir && readFont(dir, spec.pkg, spec.subset, spec.weights[0])) {
      out.push(script as Script)
    }
  }
  return out
}
