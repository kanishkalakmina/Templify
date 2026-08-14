import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageBody } from '@/app/AppShell'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/toggles'
import { TemplateThumbnail } from '@/components/TemplateThumbnail'
import { useTemplateStore } from '@/state/templateStore'
import { useUiStore } from '@/state/uiStore'
import { LIBRARY_GROUPS } from '@/templates/builtin'
import { CATEGORIES, type CategoryFilter } from '@/services/templateCatalog'
import { PAGE_SIZE_LABEL } from '@/utils/page'

const FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...CATEGORIES.map((c) => ({ value: c.value as CategoryFilter, label: c.plural })),
]

export function TemplateLibraryPage() {
  const navigate = useNavigate()
  const builtIns = useTemplateStore((s) => s.builtIns)
  const openCreate = useUiStore((s) => s.openCreateDialog)
  const [category, setCategory] = useState<CategoryFilter>('all')

  const groups = useMemo(
    () => LIBRARY_GROUPS.filter((group) => category === 'all' || group.category === category),
    [category],
  )

  return (
    <PageBody>
      <div className="text-[22px] font-semibold tracking-[-.4px]">Template Library</div>
      <div className="mt-[6px] text-[13px] text-muted">
        Start from a professional layout — using one copies it into your templates, so built-ins
        stay untouched.
      </div>

      <div className="mt-5 flex flex-wrap gap-[6px]">
        {FILTERS.map((filter) => (
          <Pill
            key={filter.value}
            label={filter.label}
            active={category === filter.value}
            onClick={() => setCategory(filter.value)}
          />
        ))}
      </div>

      {groups.map((group) => (
        <section key={group.name} className="mt-[30px]">
          <div className="flex items-baseline gap-[9px]">
            <div className="text-[14px] font-semibold">{group.name}</div>
            <div className="text-[11px] text-faint">{group.specs.length} templates</div>
          </div>

          <div className="mt-3 grid gap-[14px] [grid-template-columns:repeat(auto-fill,minmax(196px,1fr))]">
            {group.specs.map((spec) => {
              const template = builtIns.find((t) => t.id === spec.id)
              if (!template) return null

              return (
                <div
                  key={spec.id}
                  className="overflow-hidden rounded-2xl border border-line bg-panel transition-colors hover:border-line-hover"
                >
                  <div className="relative flex h-[142px] items-center justify-center border-b border-line bg-app p-[14px]">
                    <TemplateThumbnail template={template} maxWidth={84} maxHeight={119} />
                    <div className="absolute left-2 top-2 rounded-[4px] border border-line-strong bg-[rgba(11,13,16,.72)] px-[6px] py-[3px] font-mono text-[8.5px] font-medium tracking-[.4px] text-muted">
                      BUILT-IN
                    </div>
                  </div>

                  <div className="px-3 pb-3 pt-[11px]">
                    <div className="text-[12.5px] font-medium">{spec.name}</div>
                    <div className="mt-[3px] text-[10.5px] text-faint">
                      {group.name} · {PAGE_SIZE_LABEL[template.page.size]}
                    </div>
                    <div className="mt-[11px] flex gap-[6px]">
                      <Button
                        className="h-[28px] flex-1"
                        onClick={() => navigate(`/preview/${spec.id}?from=library`)}
                      >
                        Preview
                      </Button>
                      <Button
                        variant="soft"
                        className="h-[28px] flex-1"
                        onClick={() => openCreate('use', spec.id)}
                      >
                        Use Template
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </PageBody>
  )
}
