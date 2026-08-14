import { PageBody } from '@/app/AppShell'
import { Button } from '@/components/ui/Button'
import { MethodChip } from '@/components/ui/toggles'
import { CodeBlock } from '@/components/CodeBlock'
import { useApiKeysStore } from '@/state/apiKeysStore'
import { useUiStore } from '@/state/uiStore'
import { copyToClipboard } from '@/utils/download'
import { SERVER } from '@/data/server'

const REQUEST_BODY = `{
  "templateId": "invoice-modern",
  "data": {
    "company": { … },
    "customer": { … },
    "invoice": { … },
    "items": [ … ]
  }
}`

const RESPONSE = `200 OK
Content-Type: application/pdf

<binary document stream>`

const CODE = `const response = await fetch(
  "${SERVER.internalHost}/api/reports/render",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${process.env.${SERVER.envVar}}\`
    },
    body: JSON.stringify({
      templateId: "invoice-modern",
      data: invoiceData
    })
  }
);`

const ENDPOINTS: { method: 'POST' | 'GET' | 'PUT' | 'DELETE'; path: string; desc: string }[] = [
  { method: 'POST', path: '/api/templates', desc: 'Create a template' },
  { method: 'GET', path: '/api/templates', desc: 'List templates' },
  { method: 'GET', path: '/api/templates/:id', desc: 'Fetch one template' },
  { method: 'PUT', path: '/api/templates/:id', desc: 'Update a template' },
  { method: 'DELETE', path: '/api/templates/:id', desc: 'Delete a template' },
  { method: 'POST', path: '/api/reports/render', desc: 'Render templateId + data' },
]

export function ApiPage() {
  const keys = useApiKeysStore((s) => s.keys)
  const generate = useApiKeysStore((s) => s.generate)
  const revoke = useApiKeysStore((s) => s.revoke)
  const toast = useUiStore((s) => s.toast)

  return (
    <PageBody width={940}>
      <div className="text-[22px] font-semibold tracking-[-.4px]">API</div>
      <div className="mt-[6px] text-[13px] text-muted">
        Your application owns the data. Templify owns the document design.
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="flex items-center gap-[10px] border-b border-line px-4 py-[14px]">
          <MethodChip method="POST" />
          <span className="font-mono text-[12.5px] font-medium">/api/reports/render</span>
          <span className="ml-auto text-[11.5px] text-faint">Render a template with data</span>
        </div>
        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <div className="border-r border-line px-4 py-[14px]">
            <div className="font-mono text-[10.5px] tracking-[.5px] text-faint">REQUEST BODY</div>
            <pre className="mt-[9px] whitespace-pre-wrap font-mono text-[11px] leading-[1.65] text-ink-3">
              {REQUEST_BODY}
            </pre>
          </div>
          <div className="px-4 py-[14px]">
            <div className="font-mono text-[10.5px] tracking-[.5px] text-faint">RESPONSE</div>
            <pre className="mt-[9px] whitespace-pre-wrap font-mono text-[11px] leading-[1.65] text-ink-3">
              {RESPONSE}
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <CodeBlock title="fetch · JavaScript" code={CODE} toastTitle="Code copied" />
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-panel p-[6px]">
        {ENDPOINTS.map((endpoint) => (
          <div
            key={`${endpoint.method}-${endpoint.path}`}
            className="flex items-center gap-3 rounded-lg px-3 py-[11px] transition-colors hover:bg-raised"
          >
            <MethodChip method={endpoint.method} />
            <span className="font-mono text-[12px] text-ink-1">{endpoint.path}</span>
            <span className="ml-auto text-[11.5px] text-faint">{endpoint.desc}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">API keys</div>
            <div className="mt-[6px] text-[12px] leading-relaxed text-muted">
              Generated here and sent as{' '}
              <span className="font-mono text-accent-link">Authorization: Bearer …</span> on render
              calls. Keys live on your server — the full value is shown once, at creation.
            </div>
          </div>
          <Button
            size="md"
            variant="primary"
            className="flex-none"
            onClick={() => {
              generate()
              toast({
                title: 'API key generated',
                description: 'Copy it now — it is only shown once.',
              })
            }}
          >
            Generate key
          </Button>
        </div>

        <div className="mt-[14px] flex flex-col gap-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center gap-[11px] rounded-xl border border-line bg-toolbar px-3 py-[11px]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium">{key.label}</span>
                <span
                  className={`mt-[3px] block truncate font-mono text-[11px] ${
                    key.revealed ? 'text-accent-link' : 'text-faint'
                  }`}
                >
                  {key.revealed ? key.value : `${SERVER.keyPrefix}••••••••••••${key.value.slice(-4)}`}
                </span>
                <span className="mt-[3px] block text-[10.5px] text-faint">
                  Created {key.created} ·{' '}
                  {key.revealed ? 'visible once — copy it now' : `last used ${key.lastUsed}`}
                </span>
              </span>
              <Button
                size="xs"
                className="flex-none"
                onClick={async () => {
                  const ok = await copyToClipboard(key.value)
                  toast({ title: ok ? 'API key copied' : 'Could not copy', tone: ok ? 'default' : 'danger' })
                }}
              >
                Copy
              </Button>
              <Button
                size="xs"
                variant="danger"
                className="flex-none"
                onClick={() => {
                  revoke(key.id)
                  toast({ title: 'API key revoked' })
                }}
              >
                Revoke
              </Button>
            </div>
          ))}

          {!keys.length ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-[22px] text-center text-[11.5px] text-faint">
              No API keys yet. Generate one to let your application call the render endpoint.
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
        <div className="text-[13px] font-semibold">Missing data</div>
        <div className="mt-[7px] text-[12.5px] leading-relaxed text-muted">
          A payload that omits a path the template references is the most likely way an
          integration goes wrong quietly. Every render returns{' '}
          <span className="font-mono text-accent-link">X-Templify-Missing-Bindings</span> listing
          them. Send <span className="font-mono text-accent-link">{'"strict": true'}</span> in{' '}
          <span className="font-mono text-accent-link">options</span> to get a{' '}
          <span className="font-mono text-accent-link">422</span> naming the offending paths
          instead of a document with blank fields.
        </div>
        <pre className="mt-3 overflow-auto rounded-lg border border-line bg-app p-3 font-mono text-[11px] leading-[1.65] text-ink-3">{`422 Unprocessable Entity
{
  "error": "missing_bindings",
  "templateId": "invoice-modern",
  "missing": ["customer.vatNumber", "invoice.poNumber"]
}`}</pre>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
        <div className="text-[13px] font-semibold">HTML output</div>
        <div className="mt-[7px] text-[12.5px] leading-relaxed text-muted">
          Send <span className="font-mono text-accent-link">{'"format": "html"'}</span> in{' '}
          <span className="font-mono text-accent-link">options</span> to get the document as HTML
          rather than PDF — the same markup Chromium is given, which makes template problems far
          easier to inspect than a binary.
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
        <div className="text-[13px] font-semibold">Version pinning</div>
        <div className="mt-[7px] text-[12.5px] leading-relaxed text-muted">
          Send <span className="font-mono text-accent-link">invoice-modern</span> to always render
          the current design, or pin it —{' '}
          <span className="font-mono text-accent-link">invoice-modern:v2</span> — so a design change
          can never break a live integration.
        </div>
      </div>
    </PageBody>
  )
}
