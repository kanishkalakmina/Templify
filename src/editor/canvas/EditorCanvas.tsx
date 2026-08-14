import { useRef, type DragEvent } from 'react'
import type { ElementType, ReportTemplate } from '@/types/template'
import type { ResolvedDocument } from '@/services/resolveDocument'
import { DocumentPage } from '@/render/DocumentPage'
import { MiniToggle } from '@/components/ui/toggles'
import { Select } from '@/components/ui/controls'
import { useEditorStore } from '@/state/editorStore'
import { SelectionLayer } from './SelectionLayer'
import { FloatingToolbar } from './FloatingToolbar'
import { DRAG_TYPE } from '../palette'
import { LocalePicker } from '@/components/LocalePicker'
import { PAGE_SIZE_LABEL, ZOOM_STEPS, nextZoom, pageBox } from '@/utils/page'

export function EditorCanvas({
  template,
  doc,
  onDropElement,
}: {
  template: ReportTemplate
  doc: ResolvedDocument
  onDropElement: (type: ElementType, position: { x: number; y: number }) => void
}) {
  const view = useEditorStore((s) => s.view)
  const setView = useEditorStore((s) => s.setView)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  const pageRef = useRef<HTMLDivElement>(null)
  const { width: pageWidth, height: pageHeight } = pageBox(template.page)

  function fitZoom() {
    // Panels take 214 + 286; leave a comfortable gutter around the page.
    const available = window.innerWidth - 500 - 80
    const candidates = ZOOM_STEPS.filter((step) => step * pageWidth <= available)
    setView({ zoom: candidates.length ? candidates[candidates.length - 1] : 0.25 })
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const type = (event.dataTransfer.getData(DRAG_TYPE) ||
      event.dataTransfer.getData('text/plain')) as ElementType
    if (!type) return

    const rect = pageRef.current?.getBoundingClientRect()
    if (!rect) return
    onDropElement(type, {
      x: Math.max(0, Math.round((event.clientX - rect.left) / view.zoom)),
      y: Math.max(0, Math.round((event.clientY - rect.top) / view.zoom)),
    })
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-app">
      <div className="flex h-[34px] flex-none items-center gap-2 border-b border-line bg-toolbar px-3">
        <MiniToggle
          label="Grid"
          active={view.showGrid}
          onClick={() => setView({ showGrid: !view.showGrid })}
        />
        <MiniToggle
          label={`Snap ${view.gridSize}px`}
          active={view.snapToGrid}
          onClick={() => setView({ snapToGrid: !view.snapToGrid })}
        />
        <MiniToggle
          label="Margins"
          active={view.showMargins}
          onClick={() => setView({ showMargins: !view.showMargins })}
        />
        <MiniToggle
          label="Guides"
          active={view.showGuides}
          onClick={() => setView({ showGuides: !view.showGuides })}
        />

        <div className="ml-auto flex items-center gap-[6px]">
          <LocalePicker className="h-[24px] w-[104px] bg-raised px-1 text-[11px]" />
          <span className="font-mono text-[10.5px] text-faint">
            {PAGE_SIZE_LABEL[template.page.size]} · {template.page.orientation}
          </span>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setView({ zoom: nextZoom(view.zoom, -1) })}
            className="h-[24px] w-[24px] cursor-pointer rounded-[6px] border border-line bg-raised leading-none text-ink-2 hover:border-line-hover"
          >
            −
          </button>
          <Select
            value={String(view.zoom)}
            onChange={(e) => setView({ zoom: Number(e.target.value) })}
            className="h-[24px] w-[76px] bg-raised px-1 font-mono text-[11px]"
          >
            {ZOOM_STEPS.map((step) => (
              <option key={step} value={step}>
                {Math.round(step * 100)}%
              </option>
            ))}
          </Select>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setView({ zoom: nextZoom(view.zoom, 1) })}
            className="h-[24px] w-[24px] cursor-pointer rounded-[6px] border border-line bg-raised leading-none text-ink-2 hover:border-line-hover"
          >
            +
          </button>
          <button
            type="button"
            onClick={fitZoom}
            className="h-[24px] cursor-pointer rounded-[6px] border border-line bg-raised px-[9px] text-[11px] text-ink-2 hover:border-line-hover"
          >
            Fit
          </button>
        </div>
      </div>

      <div
        onPointerDown={clearSelection}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={handleDrop}
        className="flex flex-1 justify-center overflow-auto px-[34px] pb-16 pt-[34px]"
      >
        <div className="relative flex-none">
          <DocumentPage
            doc={doc}
            scale={view.zoom}
            showGrid={view.showGrid}
            showMargins={view.showMargins}
            shadow="page"
            pageRef={pageRef}
            overlay={
              <SelectionLayer
                elements={template.elements}
                scale={view.zoom}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
              />
            }
          />
          <FloatingToolbar scale={view.zoom} />
        </div>
      </div>
    </div>
  )
}
