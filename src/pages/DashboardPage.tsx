import { useNavigate } from 'react-router-dom'
import { PageBody } from '@/app/AppShell'
import { Button } from '@/components/ui/Button'
import { useTemplateStore } from '@/state/templateStore'
import { useUiStore } from '@/state/uiStore'
import { sortByUpdated } from '@/services/templateCatalog'
import { greeting, relativeTime } from '@/utils/format'
import { RECENT_ACTIVITY } from '@/data/activity'

export function DashboardPage() {
  const navigate = useNavigate()
  const templates = useTemplateStore((s) => s.templates)
  const openCreate = useUiStore((s) => s.openCreateDialog)

  const active = templates.filter((t) => !t.archived)
  const versionCount = templates.reduce((sum, t) => sum + t.versions.length, 0)
  const recents = sortByUpdated(active).slice(0, 5)

  const stats = [
    { label: 'Templates', value: String(templates.length), note: 'in this workspace' },
    { label: 'Active templates', value: String(active.length), note: 'served by API' },
    { label: 'Reports generated', value: '12,842', note: 'last 30 days' },
    { label: 'Template versions', value: String(versionCount), note: 'pinned + current' },
  ]

  return (
    <PageBody>
      <div className="text-[26px] font-semibold leading-tight tracking-[-.5px]">{greeting()}</div>
      <div className="mt-[7px] text-[13.5px] text-muted">
        Manage your document templates and rendering system.
      </div>

      <div className="mt-7 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-panel px-[18px] py-4">
            <div className="text-[11.5px] text-muted">{stat.label}</div>
            <div className="mt-[9px] text-[24px] font-semibold tracking-[-.6px]">{stat.value}</div>
            <div className="mt-[5px] text-[11px] text-faint">{stat.note}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <div className="rounded-2xl border border-line bg-panel p-[6px] pb-2">
          <div className="flex items-center justify-between px-[14px] pb-[10px] pt-3">
            <div className="text-[13px] font-semibold">Recent templates</div>
            <button
              type="button"
              onClick={() => navigate('/templates')}
              className="cursor-pointer border-none bg-transparent text-[11.5px] text-accent-link hover:text-accent-nav"
            >
              View all
            </button>
          </div>

          {recents.length ? (
            recents.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => navigate(`/editor/${template.id}`)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-[14px] py-[9px] text-left transition-colors hover:bg-raised"
              >
                <span className="h-[34px] w-[26px] flex-none rounded-[2px] bg-white shadow-[0_1px_4px_rgba(0,0,0,.5)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{template.name}</span>
                  <span className="mt-[2px] block font-mono text-[10.5px] text-faint">
                    {template.id} · v{template.version}
                  </span>
                </span>
                <span className="flex-none text-[11px] text-faint">
                  {relativeTime(template.updatedAt)}
                </span>
              </button>
            ))
          ) : (
            <div className="px-[14px] py-8 text-center text-[11.5px] text-faint">
              No templates yet.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-panel p-[14px]">
            <div className="mb-[11px] text-[13px] font-semibold">Quick actions</div>
            <div className="flex flex-col gap-[7px]">
              <Button variant="primary" className="h-8 w-full" onClick={() => openCreate('new')}>
                + New Template
              </Button>
              <Button className="h-8 w-full" onClick={() => navigate('/library')}>
                Browse Template Library
              </Button>
              <Button className="h-8 w-full" onClick={() => navigate('/api')}>
                API Documentation
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-panel p-[14px]">
            <div className="mb-3 text-[13px] font-semibold">Recent activity</div>
            <div className="flex flex-col gap-[13px]">
              {RECENT_ACTIVITY.map((entry) => (
                <div key={entry.text} className="flex gap-[10px]">
                  <span className="mt-[5px] h-[6px] w-[6px] flex-none rounded-full bg-accent" />
                  <span>
                    <span className="block text-[12px]">{entry.text}</span>
                    <span className="mt-[2px] block text-[11px] text-faint">{entry.when}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageBody>
  )
}
