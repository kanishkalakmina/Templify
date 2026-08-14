import { useMemo } from 'react'
import type { ReportTemplate } from '@/types/template'
import type { ReportData } from '@/types/data'
import { resolveDocument } from '@/services/resolveDocument'
import { DocumentPage } from '@/render/DocumentPage'
import { DEFAULT_TEST_DATA } from '@/data/sampleData'

/**
 * A real, scaled rendering of the template — not a screenshot or an
 * approximation. It runs the same `resolveDocument` → `ElementRenderer`
 * pipeline as the canvas and preview, which is what keeps a card's picture
 * honest when the design changes (architecture NFR-002).
 */
export function TemplateThumbnail({
  template,
  data = DEFAULT_TEST_DATA,
  maxWidth,
  maxHeight,
}: {
  template: ReportTemplate
  data?: ReportData
  maxWidth: number
  maxHeight: number
}) {
  const doc = useMemo(
    () => resolveDocument(template, data, { mode: 'print' }),
    [template, data],
  )

  const scale = Math.min(maxWidth / doc.width, maxHeight / doc.height)

  return (
    <div
      className="overflow-hidden rounded-[2px] shadow-thumb"
      style={{ width: Math.round(doc.width * scale), height: Math.round(doc.height * scale) }}
      aria-hidden
    >
      <DocumentPage doc={doc} scale={scale} shadow="none" />
    </div>
  )
}
