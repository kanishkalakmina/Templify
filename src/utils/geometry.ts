export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function snap(value: number, grid: number): number {
  return grid > 0 ? Math.round(value / grid) * grid : value
}

/** Axis-aligned bounding box of a set of rects. */
export function boundsOf(rects: Rect[]): Rect | null {
  if (!rects.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.width)
    maxY = Math.max(maxY, r.y + r.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y)
}

/**
 * Applies a resize delta to a rect for the given handle, keeping the opposite
 * edge pinned and preventing inversion.
 */
export function resizeRect(rect: Rect, handle: ResizeHandle, dx: number, dy: number, min = 8): Rect {
  let { x, y, width, height } = rect

  if (handle.includes('w')) {
    const nw = width - dx
    if (nw >= min) {
      x += dx
      width = nw
    } else {
      x += width - min
      width = min
    }
  }
  if (handle.includes('e')) width = Math.max(min, width + dx)

  if (handle.includes('n')) {
    const nh = height - dy
    if (nh >= min) {
      y += dy
      height = nh
    } else {
      y += height - min
      height = min
    }
  }
  if (handle.includes('s')) height = Math.max(min, height + dy)

  return { x, y, width, height }
}

export const CURSOR_FOR_HANDLE: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
}

export interface GuideLine {
  axis: 'x' | 'y'
  position: number
}

const SNAP_TOLERANCE = 5

/**
 * Snaps a moving rect against the edges/centres of its siblings and the page.
 * Returns the adjusted position plus the guides that should be drawn.
 */
export function alignToGuides(
  moving: Rect,
  others: Rect[],
  page: { width: number; height: number },
): { x: number; y: number; guides: GuideLine[] } {
  const guides: GuideLine[] = []

  const xTargets: number[] = [0, page.width / 2, page.width]
  const yTargets: number[] = [0, page.height / 2, page.height]
  for (const o of others) {
    xTargets.push(o.x, o.x + o.width / 2, o.x + o.width)
    yTargets.push(o.y, o.y + o.height / 2, o.y + o.height)
  }

  // Candidate anchor points on the moving rect, in priority order.
  const xAnchors = [moving.x, moving.x + moving.width / 2, moving.x + moving.width]
  const yAnchors = [moving.y, moving.y + moving.height / 2, moving.y + moving.height]

  let dx = 0
  let bestX = SNAP_TOLERANCE + 1
  for (let i = 0; i < xAnchors.length; i += 1) {
    for (const t of xTargets) {
      const d = Math.abs(xAnchors[i] - t)
      if (d < bestX && d <= SNAP_TOLERANCE) {
        bestX = d
        dx = t - xAnchors[i]
        guides[0] = { axis: 'x', position: t }
      }
    }
  }

  let dy = 0
  let bestY = SNAP_TOLERANCE + 1
  for (let i = 0; i < yAnchors.length; i += 1) {
    for (const t of yTargets) {
      const d = Math.abs(yAnchors[i] - t)
      if (d < bestY && d <= SNAP_TOLERANCE) {
        bestY = d
        dy = t - yAnchors[i]
        guides[1] = { axis: 'y', position: t }
      }
    }
  }

  return { x: moving.x + dx, y: moving.y + dy, guides: guides.filter(Boolean) }
}
