import { PageBody } from '@/app/AppShell'
import { MethodChip } from '@/components/ui/toggles'
import { CodeBlock } from '@/components/CodeBlock'
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

/** Every route the server defines. Kept in step with `server/index.ts`. */
const ENDPOINTS: { method: 'POST' | 'GET' | 'PUT' | 'DELETE'; path: string; desc: string }[] = [
  { method: 'POST', path: '/api/reports/render', desc: 'Render templateId + data' },
  { method: 'GET', path: '/api/health', desc: 'Status, version, PDF availability, locales' },
  { method: 'GET', path: '/api/templates', desc: 'List templates' },
  { method: 'GET', path: '/api/templates/:id', desc: 'Fetch one — accepts id or id:vN' },
  { method: 'POST', path: '/api/templates', desc: 'Create a template (409 if the id is taken)' },
  { method: 'PUT', path: '/api/templates/:id', desc: 'Update — archive with "archived": true' },
]

export function ApiPage() {
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
        <div className="text-[13px] font-semibold">API keys</div>
        <div className="mt-[7px] text-[12.5px] leading-relaxed text-muted">
          Sent as <span className="font-mono text-accent-link">Authorization: Bearer …</span> on
          every <span className="font-mono text-accent-link">/api</span> call except{' '}
          <span className="font-mono text-accent-link">/api/health</span>. The server accepts
          exactly one credential — whatever{' '}
          <span className="font-mono text-accent-link">TEMPLIFY_API_KEY</span> is set to in its
          environment — and requires none at all while that is unset, which is the right default
          for a container on a network you already trust.
        </div>

        <div className="mt-3 text-[12.5px] leading-relaxed text-muted">
          Turning it on takes two settings, not one. The server checks{' '}
          <span className="font-mono text-accent-link">TEMPLIFY_API_KEY</span> at runtime; this
          editor sends <span className="font-mono text-accent-link">VITE_TEMPLIFY_KEY</span>,
          which is compiled in when the frontend is built. Set one without the other and the
          workspace comes up empty, because every catalogue call is being refused.
        </div>

        <pre className="mt-3 overflow-auto rounded-lg border border-line bg-app p-3 font-mono text-[11px] leading-[1.65] text-ink-3">{`TEMPLIFY_API_KEY=<key>    # server, at runtime
VITE_TEMPLIFY_KEY=<key>   # frontend, at build time`}</pre>

        <div className="mt-3 rounded-xl border border-line bg-toolbar px-3 py-[11px] text-[11.5px] leading-relaxed text-faint">
          The editor's copy of the key is compiled into the bundle this same server hands to
          every browser, so anyone who can open the editor can read it. That keeps the editor
          working; it is not a security boundary. Keeping the instance off the public network is
          what protects it.
        </div>

        <div className="mt-3 text-[11.5px] leading-relaxed text-faint">
          Per-consumer keys — minted here, stored as hashes, revoked individually — are not
          available yet. They need something to authenticate the person doing the minting, and
          today the editor itself is unauthenticated, so a mint button would hand server
          credentials to anyone who can load this page.
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
        <div className="text-[13px] font-semibold">Templates cannot be deleted</div>
        <div className="mt-[7px] text-[12.5px] leading-relaxed text-muted">
          A <span className="font-mono text-accent-link">templateId</span> is a contract: your
          applications post it, and documents already issued name it. Removing one would
          silently break every caller still rendering it, so the capability is absent rather
          than guarded —{' '}
          <span className="font-mono text-accent-link">DELETE</span> returns{' '}
          <span className="font-mono text-accent-link">405</span>.
        </div>
        <div className="mt-[7px] text-[12.5px] leading-relaxed text-muted">
          Retire a design by <strong>archiving</strong> it instead — from the Templates screen,
          or by sending{' '}
          <span className="font-mono text-accent-link">{'"archived": true'}</span> on a{' '}
          <span className="font-mono text-accent-link">PUT</span>. It leaves the library and
          stops appearing in pickers, but it still renders, so nothing already integrated
          breaks. Genuine removal is an operator action against the{' '}
          <span className="font-mono text-accent-link">/data</span> volume.
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
