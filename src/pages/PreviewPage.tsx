import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DocumentPage } from '@/render/DocumentPage'
import { LocalePicker } from '@/components/LocalePicker'
import { useTemplateStore } from '@/state/templateStore'
import { useTestDataStore } from '@/state/testDataStore'
import { useUiStore } from '@/state/uiStore'
import { useSettingsStore } from '@/state/settingsStore'
import { resolveDocument } from '@/services/resolveDocument'
import { parseHandle } from '@/services/versioning'

const SCALE = 0.85

/**
 * Preview drops the editor chrome and shows the document as it would render:
 * conditions applied, unresolved bindings blank, no binding affordances.
 */
export function PreviewPage() {
  const { templateId = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const resolve = useTemplateStore((s) => s.resolve)
  const getData = useTestDataStore((s) => s.getData)
  const revision = useTestDataStore((s) => s.revision)
  const toast = useUiStore((s) => s.toast)

  const template = resolve(templateId)
  // A pinned handle (`invoice-modern:v2`) shares the base template's test data.
  const data = getData(parseHandle(templateId).id)
  const locale = useSettingsStore((s) => s.previewLocale)

  const doc = useMemo(
    () => (template ? resolveDocument(template, data, { mode: 'print', locale }) : null),
    // `revision` participates so an Apply in the editor is reflected here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, data, revision, locale],
  )

  const from = params.get('from')
  const backLabel = from === 'editor' ? '← Back to Editor' : '← Back'

  function goBack() {
    if (from === 'editor') navigate(`/editor/${parseHandle(templateId).id}`)
    else if (from === 'library') navigate('/library')
    else navigate('/templates')
  }

  if (!template || !doc) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-app text-center">
        <div className="text-[15px] font-semibold">Template not found</div>
        <div className="text-[12.5px] text-muted">
          <span className="font-mono text-accent-link">{templateId}</span> does not match any
          template.
        </div>
        <Button onClick={() => navigate('/templates')}>Back to Templates</Button>
      </div>
    )
  }

  const notice = 'Rendering is connected in the server implementation.'

  return (
    <div className="flex h-screen min-h-0 flex-col bg-app">
      <div className="flex h-12 flex-none items-center gap-3 border-b border-line bg-toolbar px-[14px]">
        <Button className="h-[28px] border-transparent bg-transparent px-[10px]" onClick={goBack}>
          {backLabel}
        </Button>
        <div className="text-[13px] font-medium">{template.name}</div>
        <div className="font-mono text-[10.5px] text-accent">{template.id}</div>
        <div className="font-mono text-[10.5px] text-faint">{`v${template.version}`}</div>

        <div className="ml-auto flex items-center gap-2">
          <LocalePicker className="h-[29px] w-[128px] text-[11.5px]" />
          <Button
            variant="primary"
            onClick={() =>
              toast({ title: 'PDF rendering is connected in the server implementation.' })
            }
          >
            Download PDF
          </Button>
          <Button
            onClick={() =>
              toast({ title: 'HTML rendering is connected in the server implementation.' })
            }
          >
            Download HTML
          </Button>
        </div>
      </div>

      <div className="flex flex-1 justify-center overflow-auto p-10">
        <DocumentPage doc={doc} scale={SCALE} shadow="lg" />
      </div>

      <div className="flex-none border-t border-line bg-toolbar px-[14px] py-[9px] text-center text-[11px] text-faint">
        {notice} No file is generated here — a fake download would be worse than none.
      </div>
    </div>
  )
}
