/**
 * Schema style -> CSS.
 *
 * Document styling is computed **inline** rather than through Tailwind classes,
 * because the document must render identically somewhere that never loaded this
 * application's stylesheet — a thumbnail, the preview, and eventually headless
 * Chromium in the render server. See architecture NFR-008.
 */

import type { CSSProperties } from 'react'
import type { ElementStyle, Margins } from '@/types/template'
import type { ResolvedNode } from '@/services/resolveDocument'

export const DOC_FONT = "'IBM Plex Sans', system-ui, sans-serif"
export const DOC_SERIF = "'Source Serif 4', Georgia, serif"
export const DOC_MONO = "'IBM Plex Mono', monospace"

function padding(value: Margins | undefined): string | undefined {
  if (!value) return undefined
  const { top, right, bottom, left } = value
  if (!top && !right && !bottom && !left) return undefined
  return `${top}px ${right}px ${bottom}px ${left}px`
}

/** Absolute placement plus box decoration for a resolved node. */
export function boxStyle(node: ResolvedNode): CSSProperties {
  const s = node.style
  const hasBorder = s.borderStyle && s.borderStyle !== 'none' && (s.borderWidth ?? 0) > 0

  return {
    position: 'absolute',
    left: node.box.x,
    top: node.box.y,
    width: node.box.width,
    height: node.box.height,
    boxSizing: 'border-box',
    background: s.background || undefined,
    border: hasBorder ? `${s.borderWidth}px ${s.borderStyle} ${s.borderColor ?? '#E2E8F0'}` : undefined,
    borderRadius: s.borderRadius || undefined,
    padding: padding(s.padding),
    opacity: s.opacity ?? undefined,
  }
}

/** Typography for text-bearing elements. */
export function textStyle(s: ElementStyle): CSSProperties {
  return {
    fontFamily: s.fontFamily || DOC_FONT,
    fontSize: s.fontSize ?? 11,
    fontWeight: s.fontWeight ?? 400,
    fontStyle: s.fontStyle,
    color: s.color || '#334155',
    textAlign: s.textAlign || 'left',
    lineHeight: s.lineHeight ?? 1.5,
    letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined,
    textTransform: s.textTransform,
    textDecoration: s.textDecoration,
    // Templates author multi-line blocks with "\n"; honour them without <br>.
    whiteSpace: 'pre-line',
  }
}

export function justifyFor(align: string | undefined): CSSProperties['justifyContent'] {
  if (align === 'center') return 'center'
  if (align === 'right') return 'flex-end'
  return 'flex-start'
}
