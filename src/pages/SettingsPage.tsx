import { PageBody } from '@/app/AppShell'
import { ColorField, Field, Input } from '@/components/ui/controls'
import { Button } from '@/components/ui/Button'
import { useSettingsStore } from '@/state/settingsStore'
import { useTemplateStore } from '@/state/templateStore'
import { useUiStore } from '@/state/uiStore'
import { storageFootprintBytes } from '@/services/storage'
import { DOCKER_COMMAND, SERVER } from '@/data/server'
import { copyToClipboard } from '@/utils/download'

/** Rough quota for a single origin. Used only to contextualise the reading. */
const QUOTA_BYTES = 5 * 1024 * 1024

export function SettingsPage() {
  const branding = useSettingsStore((s) => s.branding)
  const updateBranding = useSettingsStore((s) => s.updateBranding)
  const templates = useTemplateStore((s) => s.templates)
  const mode = useTemplateStore((s) => s.mode)
  const serverUrl = useTemplateStore((s) => s.serverUrl)
  const serverInfo = useTemplateStore((s) => s.serverInfo)
  const toast = useUiStore((s) => s.toast)
  const connected = mode === 'server'

  const used = storageFootprintBytes()
  const usedKb = Math.max(1, Math.round(used / 1024))
  const pct = Math.min(100, Math.round((used / QUOTA_BYTES) * 100))

  return (
    <PageBody width={940}>
      <div className="text-[22px] font-semibold tracking-[-.4px]">Settings</div>
      <div className="mt-[6px] text-[13px] text-muted">
        Self-hosted rendering server and default template branding.
      </div>

      <div className="mt-6 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        <div className="rounded-2xl border border-line bg-panel p-4">
          <div className="text-[13px] font-semibold">Self hosted</div>
          <div className="mt-[6px] text-[12px] text-muted">Run Templify with Docker.</div>

          <pre className="mt-3 whitespace-pre rounded-lg border border-line bg-app p-[13px] font-mono text-[11px] leading-[1.7] text-ink-3">
            {DOCKER_COMMAND}
          </pre>

          <Button
            size="xs"
            className="mt-2"
            onClick={async () => {
              const ok = await copyToClipboard(DOCKER_COMMAND)
              toast({ title: ok ? 'Command copied' : 'Could not copy', tone: ok ? 'default' : 'danger' })
            }}
          >
            Copy command
          </Button>

          <div className="mt-[14px] flex flex-col gap-[9px]">
            <InfoRow label="Server status">
              {connected ? (
                <span className="font-mono text-[11.5px] font-medium text-ok">● Running</span>
              ) : (
                <span className="font-mono text-[11.5px] font-medium text-faint">● Not connected</span>
              )}
            </InfoRow>
            <InfoRow label="Server URL">
              <span className="font-mono text-[11.5px] text-accent-link">
                {connected ? serverUrl : '—'}
              </span>
            </InfoRow>
            <InfoRow label="Version">
              <span className="font-mono text-[11.5px] text-ink-2">
                {serverInfo?.version ?? '—'}
              </span>
            </InfoRow>
            <InfoRow label="PDF renderer">
              <span
                className={`font-mono text-[11.5px] ${serverInfo?.pdf ? 'text-ok' : 'text-warn'}`}
              >
                {connected ? (serverInfo?.pdf ? 'available' : 'unavailable') : '—'}
              </span>
            </InfoRow>
            <InfoRow label="API auth">
              <span className="font-mono text-[11.5px] text-ink-2">{serverInfo?.auth ?? '—'}</span>
            </InfoRow>
          </div>

          <div className="mt-[14px] border-t border-line pt-[14px] text-[11px] leading-relaxed text-faint">
            {connected
              ? 'Templates are stored on the server and shared by everyone using this instance. Your application can fetch and render them over the API.'
              : 'No report server detected, so templates are stored in this browser only — not shared, and not reachable by your application. Run the container above to change that.'}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-4">
          <div className="text-[13px] font-semibold">Default branding</div>
          <div className="mt-[6px] text-[12px] text-muted">Applied to new templates.</div>

          <div className="mt-[14px] flex flex-col gap-3">
            <ColorField
              label="Primary color"
              value={branding.primaryColor}
              onChange={(primaryColor) => updateBranding({ primaryColor })}
            />
            <ColorField
              label="Secondary color"
              value={branding.secondaryColor}
              onChange={(secondaryColor) => updateBranding({ secondaryColor })}
            />
            <Field label="Default logo binding">
              <Input
                value={branding.defaultLogo ?? ''}
                onChange={(e) => updateBranding({ defaultLogo: e.target.value })}
                className="h-[31px] font-mono text-[11.5px]"
              />
            </Field>
            <Field label="Default footer">
              <Input
                value={branding.defaultFooter ?? ''}
                onChange={(e) => updateBranding({ defaultFooter: e.target.value })}
                className="h-[31px] text-[12px]"
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
        <div className="text-[13px] font-semibold">Workspace storage</div>
        <div className="mt-[6px] text-[12px] leading-relaxed text-muted">
          {connected
            ? 'Templates persist on the server volume. The figure below is this browser’s local cache only.'
            : 'Templates persist in this browser. Uploaded logos are embedded as data URLs and dominate the footprint — export a template to keep a durable copy.'}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-app">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${Math.max(1, pct)}%` }}
            />
          </div>
          <div className="flex-none font-mono text-[11px] text-faint">
            {usedKb} KB · {templates.length} templates
          </div>
        </div>
      </div>
    </PageBody>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  )
}
