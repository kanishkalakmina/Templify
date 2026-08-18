import { useMemo, useState } from 'react'
import { PageBody } from '@/app/AppShell'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/controls'
import { DocumentPage } from '@/render/DocumentPage'
import { LocalePicker } from '@/components/LocalePicker'
import { DocumentPrintDialog } from '@/components/DocumentPrintDialog'
import { useTemplateStore } from '@/state/templateStore'
import { useTestDataStore } from '@/state/testDataStore'
import { useSettingsStore } from '@/state/settingsStore'
import { resolveDocument } from '@/services/resolveDocument'
import { renderDocumentHtml, type RenderedDocument } from '@/services/renderClient'
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
  const locale = useSettingsStore((s) => s.previewLocale)

  const doc = useMemo(
    () => (template ? resolveDocument(template, data, { mode: 'print', locale }) : null),
    [template, data, locale],
  )

  /*
   * The counter-print demo below goes through the API rather than the canvas
   * above, so it needs a report server. Frontend-only mode has no render
   * endpoint to call, and saying so is better than a button that fails.
   */
  const storageMode = useTemplateStore((s) => s.mode)
  const serverUrl = useTemplateStore((s) => s.serverUrl)

  const [printed, setPrinted] = useState<RenderedDocument | null>(null)
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState('')

  async function renderAndPrint() {
    setPrinting(true)
    setPrintError('')
    try {
      setPrinted(await renderDocumentHtml(serverUrl, templateId, data, { locale }))
    } catch (error) {
      setPrintError((error as Error).message)
    } finally {
      setPrinting(false)
    }
  }

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

          <div className="mt-[10px] flex items-center gap-[9px]">
            <span className="text-[11.5px] text-muted">Language</span>
            <LocalePicker className="h-[31px] flex-1 text-[11.5px]" />
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

      {/* ------------------------------------------------- counter print demo */}
      <section className="mt-5 rounded-2xl border border-line bg-panel p-5">
        <div className="text-[15px] font-semibold">Print it at the counter</div>
        <div className="mt-[7px] max-w-[720px] text-[12.5px] leading-relaxed text-muted">
          The document above is drawn by the canvas. This button asks the{' '}
          <span className="font-mono text-accent-link">/api/reports/render</span> endpoint for
          the same document as print-ready markup and shows it the way your application would
          — a popup, sized from the document itself, with the print dialog a click away. It is
          the bill-at-a-till case, running against this server with the payload and template
          selected above.
        </div>

        {storageMode === 'server' ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                size="md"
                variant="primary"
                disabled={printing || !template}
                onClick={renderAndPrint}
              >
                {printing ? 'Rendering…' : 'Render & print'}
              </Button>
              <span className="text-[11.5px] text-faint">
                Returns HTML, not PDF — it prints reliably from an iframe and skips Chromium
                entirely, so it comes back in milliseconds.
              </span>
            </div>

            {printError ? (
              <div className="mt-3 rounded-xl border border-[rgba(227,93,106,.4)] bg-[rgba(227,93,106,.1)] p-3 text-[11.5px] leading-relaxed text-danger">
                {printError}
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-line bg-toolbar p-[13px] text-[11.5px] leading-relaxed text-muted">
            Needs the report server. This browser is in frontend-only mode, so there is no
            render endpoint to call — start the container and reload. The comparison above
            works either way, because the canvas renders in-browser.
          </div>
        )}

        <div className="mt-4 text-[11.5px] leading-relaxed text-faint">
          The code is on the <span className="text-ink-2">Help</span> screen, and{' '}
          <span className="font-mono">examples/pos-counter-print</span> is a runnable till
          screen built on it.
        </div>
      </section>

      <DocumentPrintDialog
        open={Boolean(printed)}
        title={`${templateId} · print preview`}
        html={printed?.html ?? ''}
        missing={printed?.missing ?? []}
        onClose={() => setPrinted(null)}
      />
    </PageBody>
  )
}
