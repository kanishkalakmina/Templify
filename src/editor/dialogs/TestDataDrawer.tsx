import { lazy, Suspense, useEffect, useState } from 'react'
import { Drawer } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useTestDataStore } from '@/state/testDataStore'
import { useUiStore } from '@/state/uiStore'
import { DEFAULT_TEST_DATA_JSON } from '@/data/sampleData'
import type { ReportData } from '@/types/data'

/**
 * CodeMirror is the single largest dependency and is reachable only from this
 * drawer, so it is split out of the main bundle rather than paid for on load.
 */
const JsonEditor = lazy(() =>
  import('@/components/JsonEditor').then((module) => ({ default: module.JsonEditor })),
)

/**
 * The payload a calling application would POST.
 *
 * Applying re-resolves the document immediately — bindings are resolved at
 * render time and never cached into element state, so there is no invalidation
 * step between pressing Apply and seeing the change (architecture AD-3).
 */
export function TestDataDrawer({
  open,
  onClose,
  templateId,
}: {
  open: boolean
  onClose: () => void
  templateId: string
}) {
  const getData = useTestDataStore((s) => s.getData)
  const applyData = useTestDataStore((s) => s.applyData)
  const resetData = useTestDataStore((s) => s.resetData)
  const toast = useUiStore((s) => s.toast)

  const [text, setText] = useState(DEFAULT_TEST_DATA_JSON)

  useEffect(() => {
    if (open) setText(JSON.stringify(getData(templateId), null, 2))
  }, [open, templateId, getData])

  let error = ''
  let parsed: ReportData | null = null
  try {
    const value = JSON.parse(text || '{}')
    if (value && typeof value === 'object' && !Array.isArray(value)) parsed = value as ReportData
    else error = 'The payload must be a JSON object.'
  } catch (cause) {
    error = `Invalid JSON — ${(cause as Error).message}`
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Test Data"
      subtitle="The payload your application would POST. Applying it re-renders the document instantly."
      footer={
        <div className="flex items-center gap-[9px]">
          <div className="flex-1 text-[11px] leading-snug text-danger">{error}</div>
          <Button
            size="md"
            onClick={() => {
              setText(DEFAULT_TEST_DATA_JSON)
              resetData(templateId)
              toast({ title: 'Test data reset' })
            }}
          >
            Reset
          </Button>
          <Button
            size="md"
            variant="primary"
            disabled={!parsed}
            onClick={() => {
              if (!parsed) return
              applyData(templateId, parsed)
              toast({ title: 'Test data applied' })
              onClose()
            }}
          >
            Apply Data
          </Button>
        </div>
      }
    >
      <div className="min-h-0 flex-1 overflow-hidden border-b border-line bg-app">
        <Suspense
          fallback={
            <div className="p-4 font-mono text-[11.5px] text-faint">Loading editor…</div>
          }
        >
          <JsonEditor value={text} onChange={setText} className="h-full" />
        </Suspense>
      </div>
      <div className="flex-none px-4 pt-3 text-[10.5px] leading-relaxed text-faint">
        Sample data only — never customer records. Templates are exported without any payload.
      </div>
    </Drawer>
  )
}
