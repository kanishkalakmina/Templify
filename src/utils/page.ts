import type { Orientation, PageSettings, PageSize } from '@/types/template'

/** Millimetre dimensions of each supported page size, portrait. */
const MM: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  LETTER: { w: 215.9, h: 279.4 },
}

/** CSS pixels per millimetre at 96 dpi. The canvas works in these units. */
export const PX_PER_MM = 96 / 25.4

export const PAGE_SIZE_LABEL: Record<PageSize, string> = {
  A4: 'A4',
  A5: 'A5',
  LETTER: 'Letter',
}

export interface PageDimensions {
  width: number
  height: number
}

export function pageDimensions(size: PageSize, orientation: Orientation): PageDimensions {
  const mm = MM[size] ?? MM.A4
  const w = Math.round(mm.w * PX_PER_MM)
  const h = Math.round(mm.h * PX_PER_MM)
  return orientation === 'landscape' ? { width: h, height: w } : { width: w, height: h }
}

export function pageBox(page: PageSettings): PageDimensions {
  return pageDimensions(page.size, page.orientation)
}

/** The printable area once margins are removed. */
export function contentBox(page: PageSettings) {
  const { width, height } = pageBox(page)
  return {
    x: page.margins.left,
    y: page.margins.top,
    width: width - page.margins.left - page.margins.right,
    height: height - page.margins.top - page.margins.bottom,
  }
}

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const

export function nextZoom(current: number, direction: 1 | -1): number {
  const steps = ZOOM_STEPS as readonly number[]
  if (direction === 1) return steps.find((s) => s > current + 0.001) ?? steps[steps.length - 1]
  const lower = steps.filter((s) => s < current - 0.001)
  return lower.length ? lower[lower.length - 1] : steps[0]
}
