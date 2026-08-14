/**
 * The printable page surface.
 *
 * Wraps a `ResolvedDocument` in a white, correctly-sized page and scales it.
 * The outer element reserves the scaled footprint so surrounding layout is
 * correct, while the inner page keeps unscaled coordinates — which is what lets
 * canvas pointer maths stay in document units.
 */

import type { ReactNode, PointerEvent as ReactPointerEvent, DragEvent as ReactDragEvent } from 'react'
import type { ResolvedDocument } from '@/services/resolveDocument'
import { ElementRenderer } from './ElementRenderer'

export interface DocumentPageProps {
  doc: ResolvedDocument
  scale?: number
  showGrid?: boolean
  showMargins?: boolean
  shadow?: 'none' | 'page' | 'lg'
  /** Overlay drawn inside the page in unscaled coordinates (selection chrome). */
  overlay?: ReactNode
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
  onDragOver?: (event: ReactDragEvent<HTMLDivElement>) => void
  onDrop?: (event: ReactDragEvent<HTMLDivElement>) => void
  pageRef?: React.Ref<HTMLDivElement>
}

const SHADOW = {
  none: undefined,
  page: '0 24px 60px rgba(0,0,0,.55)',
  lg: '0 24px 70px rgba(0,0,0,.6)',
}

export function DocumentPage({
  doc,
  scale = 1,
  showGrid = false,
  showMargins = false,
  shadow = 'page',
  overlay,
  onPointerDown,
  onDragOver,
  onDrop,
  pageRef,
}: DocumentPageProps) {
  const { margins } = doc.page

  return (
    <div
      style={{ width: Math.round(doc.width * scale), height: Math.round(doc.height * scale) }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        ref={pageRef}
        className="doc-surface"
        onPointerDown={onPointerDown}
        style={{
          position: 'relative',
          width: doc.width,
          height: doc.height,
          background: doc.page.background || '#FFFFFF',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          boxShadow: SHADOW[shadow],
          overflow: 'hidden',
        }}
      >
        {doc.nodes.map((node) => (
          <ElementRenderer key={node.key} node={node} mode={doc.mode} />
        ))}

        {showGrid ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              backgroundImage:
                'linear-gradient(to right, rgba(15,23,42,.055) 1px, transparent 1px),' +
                'linear-gradient(to bottom, rgba(15,23,42,.055) 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />
        ) : null}

        {showMargins ? (
          <div
            style={{
              position: 'absolute',
              left: margins.left,
              top: margins.top,
              right: margins.right,
              bottom: margins.bottom,
              border: '1px dashed rgba(91,124,250,.32)',
              pointerEvents: 'none',
            }}
          />
        ) : null}

        {overlay}
      </div>
    </div>
  )
}
