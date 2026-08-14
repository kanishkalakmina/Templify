import { useMemo, useState } from 'react'
import { PageBody } from '@/app/AppShell'
import { Select } from '@/components/ui/controls'
import { DocumentPage } from '@/render/DocumentPage'
import { useTemplateStore } from '@/state/templateStore'
import { useTestDataStore } from '@/state/testDataStore'
import { resolveDocument } from '@/services/resolveDocument'
import { DEFAULT_TEST_DATA } from '@/data/sampleData'

const SCALE = 0.4

const DIAGRAM = `Application Data
   │
   ├──────────────┐
   ▼              ▼
invoice-modern  invoice-classic
   ▼              ▼
Modern report   Classic report`

/**
 * "Same Data. Different Design." — the product thesis, demonstrated.
 *
 * One payload stays fixed while the template ID changes. Nothing about the
 * data, and nothing in a calling application, would change between these two
 * renders.
 */
export function ComparePage() {
  const templates = useTemplateStore((s) => s.templates)
  const builtIns = useTemplateStore((s) => s.builtIns)
  const testData = useTestDataStore((s) => s.data)

  const options = useMemo(() => {
    const seen = new Set<string>()
    return [...templates, ...builtIns].filter((t) => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
  }, [templates, builtIns])

  const [templateId, setTemplateId] = useState(
    () => options.find((t) => t.id === 'invoice-modern')?.id ?? options[0]?.id ?? '',
  )

  const template = options.find((t) => t.id === templateId) ?? options[0]

  // One payload, deliberately shared: whichever data the selected template was
  // last edited against, falling back to the canonical sample.
  const data = testData[templateId] ?? DEFAULT_TEST_DATA

  const doc = useMemo(
    () => (template ? resolveDocument(template, data, { mode: 'print' }) : null),
    [template, data],
  )

  const request = `POST /api/reports/render
{
  "templateId": "${templateId}",
  "data": { … same payload … }
}`

  return (
    <PageBody width={1080}>
      <div className="text-[22px] font-semibold tracking-[-.4px]">Same Data. Different Design.</div>
      <div className="mt-[6px] text-[13px] text-muted">
        Your application sends the same payload. Swapping the template ID swaps the document — no
        code change, no deploy.
      </div>

      <div className="mt-6 flex flex-wrap items-start gap-4">
        <div className="min-w-[280px] flex-1 rounded-2xl border border-line bg-panel p-4">
          <div className="font-mono text-[11px] tracking-[.5px] text-faint">REQUEST</div>
          <pre className="mt-[10px] whitespace-pre-wrap font-mono text-[11px] leading-[1.6] text-ink-3">
            {request}
          </pre>

          <div className="mt-[14px] flex items-center gap-[9px]">
            <span className="text-[11.5px] text-muted">Template</span>
            <Select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="h-[31px] flex-1 font-mono text-[11.5px]"
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.id}
                  {option.builtIn ? ' (built-in)' : ''}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-[14px] whitespace-pre border-t border-line pt-[14px] font-mono text-[11px] leading-[1.9] text-faint">
            {DIAGRAM}
          </div>

          <div className="mt-[14px] border-t border-line pt-[14px] text-[11.5px] leading-relaxed text-muted">
            The payload below the fold never changes. Only{' '}
            <span className="font-mono text-accent-link">templateId</span> does.
          </div>
        </div>

        <div className="flex-none rounded-[12px] border border-line bg-sidebar p-5">
          {doc ? (
            <DocumentPage doc={doc} scale={SCALE} shadow="page" />
          ) : (
            <div className="flex h-[449px] w-[318px] items-center justify-center text-[12px] text-faint">
              No templates available
            </div>
          )}
        </div>
      </div>
    </PageBody>
  )
}
