import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { TemplateElement } from '@/types/template'
import { useEditorStore } from '@/state/editorStore'
import {
  alignToGuides,
  resizeRect,
  snap as snapValue,
  CURSOR_FOR_HANDLE,
  RESIZE_HANDLES,
  type GuideLine,
  type Rect,
  type ResizeHandle,
} from '@/utils/geometry'

const ACCENT = '#5B7CFA'
/** Thin elements (dividers) still need a grabbable band. */
const MIN_HIT = 10

/**
 * Selection chrome and canvas gestures, drawn inside the page in **unscaled**
 * document coordinates.
 *
 * Move and resize use direct pointer events rather than a drag-and-drop
 * abstraction: the canvas needs zoom-compensated deltas, snap-to-grid and live
 * alignment guides, which fight a generic DnD layer (architecture D-4).
 *
 * Gestures are wrapped in `beginGesture`/`endGesture`, so a drag that emits
 * hundreds of position updates collapses to a single undo step (NFR-004).
 */
export function SelectionLayer({
  elements,
  scale,
  pageWidth,
  pageHeight,
}: {
  elements: TemplateElement[]
  scale: number
  pageWidth: number
  pageHeight: number
}) {
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const view = useEditorStore((s) => s.view)
  const select = useEditorStore((s) => s.select)
  const beginGesture = useEditorStore((s) => s.beginGesture)
  const endGesture = useEditorStore((s) => s.endGesture)
  const live = useEditorStore((s) => s.live)
  const setEditing = useEditorStore((s) => s.setEditing)

  const [guides, setGuides] = useState<GuideLine[]>([])
  const gesture = useRef<{ active: boolean }>({ active: false })

  const selected = elements.filter((element) => selectedIds.includes(element.id))

  function startMove(element: TemplateElement, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || element.locked) return
    event.stopPropagation()
    event.preventDefault()

    const additive = event.shiftKey
    const ids = additive
      ? selectedIds.includes(element.id)
        ? selectedIds
        : [...selectedIds, element.id]
      : selectedIds.includes(element.id)
        ? selectedIds
        : [element.id]

    select(element.id, additive)
    if (!additive && !selectedIds.includes(element.id)) setEditing(null)

    const origin = new Map(ids.map((id) => {
      const found = elements.find((e) => e.id === id)
      return [id, { x: found?.x ?? 0, y: found?.y ?? 0 }] as const
    }))

    const startX = event.clientX
    const startY = event.clientY
    let started = false

    const move = (native: PointerEvent) => {
      const dx = (native.clientX - startX) / scale
      const dy = (native.clientY - startY) / scale
      if (!started) {
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
        started = true
        gesture.current.active = true
        beginGesture()
      }

      // Snap the primary element, then apply the same delta to the rest so a
      // multi-selection keeps its internal spacing.
      const primary = origin.get(element.id) ?? { x: 0, y: 0 }
      let nextX = view.snapToGrid ? snapValue(primary.x + dx, view.gridSize) : Math.round(primary.x + dx)
      let nextY = view.snapToGrid ? snapValue(primary.y + dy, view.gridSize) : Math.round(primary.y + dy)

      if (view.showGuides && ids.length === 1) {
        const others = elements
          .filter((e) => !ids.includes(e.id))
          .map<Rect>((e) => ({ x: e.x, y: e.y, width: e.width, height: e.height }))
        const aligned = alignToGuides(
          { x: nextX, y: nextY, width: element.width, height: element.height },
          others,
          { width: pageWidth, height: pageHeight },
        )
        nextX = aligned.x
        nextY = aligned.y
        setGuides(aligned.guides)
      }

      const shiftX = nextX - primary.x
      const shiftY = nextY - primary.y

      live((draft) => ({
        ...draft,
        elements: draft.elements.map((candidate) => {
          const start = origin.get(candidate.id)
          if (!start) return candidate
          return { ...candidate, x: Math.round(start.x + shiftX), y: Math.round(start.y + shiftY) }
        }),
      }))
    }

    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      setGuides([])
      if (gesture.current.active) {
        gesture.current.active = false
        endGesture()
      }
    }

    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  function startResize(
    element: TemplateElement,
    handle: ResizeHandle,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()

    const origin: Rect = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    }
    const startX = event.clientX
    const startY = event.clientY
    let started = false

    const move = (native: PointerEvent) => {
      const dx = (native.clientX - startX) / scale
      const dy = (native.clientY - startY) / scale
      if (!started) {
        started = true
        gesture.current.active = true
        beginGesture()
      }

      const next = resizeRect(origin, handle, dx, dy, 8)
      const grid = view.snapToGrid ? view.gridSize : 0
      live((draft) => ({
        ...draft,
        elements: draft.elements.map((candidate) =>
          candidate.id === element.id
            ? {
                ...candidate,
                x: Math.round(snapValue(next.x, grid)),
                y: Math.round(snapValue(next.y, grid)),
                width: Math.max(4, Math.round(snapValue(next.width, grid))),
                height: Math.max(1, Math.round(snapValue(next.height, grid))),
              }
            : candidate,
        ),
      }))
    }

    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      if (gesture.current.active) {
        gesture.current.active = false
        endGesture()
      }
    }

    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  // Handles live inside the scaled page, so counter-scale them to keep a
  // constant on-screen size at any zoom.
  const handleSize = 8 / scale
  const outline = 1.5 / scale

  return (
    <>
      {elements.map((element) => {
        const hitHeight = Math.max(element.height, MIN_HIT)
        const offset = (hitHeight - element.height) / 2
        return (
          <div
            key={`hit-${element.id}`}
            onPointerDown={(event) => startMove(element, event)}
            onDoubleClick={() => {
              if (element.type === 'text' || element.type === 'heading' || element.type === 'richText') {
                setEditing(element.id)
              }
            }}
            style={{
              position: 'absolute',
              left: element.x,
              top: element.y - offset,
              width: element.width,
              height: hitHeight,
              cursor: element.locked ? 'default' : 'move',
            }}
          />
        )
      })}

      {selected.map((element) => (
        <div
          key={`sel-${element.id}`}
          style={{
            position: 'absolute',
            left: element.x,
            top: element.y,
            width: element.width,
            height: element.height,
            outline: `${outline}px solid ${ACCENT}`,
            outlineOffset: 2 / scale,
            pointerEvents: 'none',
          }}
        >
          {selected.length === 1
            ? RESIZE_HANDLES.map((handle) => (
                <div
                  key={handle}
                  onPointerDown={(event) => startResize(element, handle, event)}
                  style={{
                    position: 'absolute',
                    width: handleSize,
                    height: handleSize,
                    background: '#fff',
                    border: `${outline}px solid ${ACCENT}`,
                    borderRadius: 2 / scale,
                    cursor: CURSOR_FOR_HANDLE[handle],
                    pointerEvents: 'auto',
                    ...handlePosition(handle, handleSize),
                  }}
                />
              ))
            : null}
        </div>
      ))}

      {guides.map((guide, index) => (
        <div
          key={`${guide.axis}-${guide.position}-${index}`}
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            background: '#F0A0C0',
            ...(guide.axis === 'x'
              ? { left: guide.position, top: 0, width: 1 / scale, height: '100%' }
              : { top: guide.position, left: 0, height: 1 / scale, width: '100%' }),
          }}
        />
      ))}
    </>
  )
}

function handlePosition(handle: ResizeHandle, size: number) {
  const edge = -size / 2
  const centre = `calc(50% - ${size / 2}px)`
  switch (handle) {
    case 'nw':
      return { left: edge, top: edge }
    case 'n':
      return { left: centre, top: edge }
    case 'ne':
      return { right: edge, top: edge }
    case 'e':
      return { right: edge, top: centre }
    case 'se':
      return { right: edge, bottom: edge }
    case 's':
      return { left: centre, bottom: edge }
    case 'sw':
      return { left: edge, bottom: edge }
    case 'w':
      return { left: edge, top: centre }
  }
}
