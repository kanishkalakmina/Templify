import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageBody, PageHeading } from '@/app/AppShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/controls'
import { Pill } from '@/components/ui/toggles'
import { TemplateCard, type TemplateMenuItem } from '@/components/TemplateCard'
import { EmptyState } from '@/components/EmptyState'
import { useTemplateStore } from '@/state/templateStore'
import { useUiStore } from '@/state/uiStore'
import {
  CATEGORIES,
  filterTemplates,
  sortByUpdated,
  type CategoryFilter,
} from '@/services/templateCatalog'
import { parseTemplateFile } from '@/services/exportService'
import { readFileAsText } from '@/utils/download'
import { uniqueSlug } from '@/utils/id'

const FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...CATEGORIES.map((c) => ({ value: c.value as CategoryFilter, label: c.plural })),
]

export function TemplatesPage() {
  const navigate = useNavigate()
  const templates = useTemplateStore((s) => s.templates)
  const setArchived = useTemplateStore((s) => s.setArchived)
  const duplicate = useTemplateStore((s) => s.duplicate)
  const updateMeta = useTemplateStore((s) => s.updateMeta)
  const importTemplate = useTemplateStore((s) => s.importTemplate)
  const openCreate = useUiStore((s) => s.openCreateDialog)
  const toast = useUiStore((s) => s.toast)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const fileInput = useRef<HTMLInputElement>(null)

  const visible = useMemo(
    () => sortByUpdated(filterTemplates(templates, { query, category, includeArchived: true })),
    [templates, query, category],
  )

  function menuFor(templateId: string): TemplateMenuItem[] {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return []

    return [
      {
        label: 'Duplicate',
        onClick: async () => {
          const id = uniqueSlug(`${template.id}-copy`, templates.map((t) => t.id))
          await duplicate(template.id, id, `${template.name} Copy`)
          toast({ title: 'Template duplicated' })
        },
      },
      {
        label: 'Rename',
        onClick: async () => {
          const name = window.prompt('Template name', template.name)
          if (!name?.trim()) return
          await updateMeta(template.id, { name: name.trim() })
          toast({ title: 'Template renamed' })
        },
      },
      {
        label: 'Version history',
        onClick: () => navigate(`/editor/${template.id}?panel=versions`),
      },
      {
        label: template.archived ? 'Unarchive' : 'Archive',
        onClick: async () => {
          await setArchived(template.id, !template.archived)
          toast({ title: template.archived ? 'Template unarchived' : 'Template archived' })
        },
      },
      /*
       * No Delete. A templateId is a contract — applications POST it and issued
       * documents name it — so Archive is the way to retire a design: it leaves
       * the library but stays renderable, and nothing already integrated breaks.
       */
    ]
  }

  async function onImport(file: File) {
    const raw = await readFileAsText(file)
    const result = parseTemplateFile(raw, templates.map((t) => t.id))
    if (!result.ok) {
      toast({ title: 'Import failed', description: result.error, tone: 'danger', duration: 6000 })
      return
    }
    await importTemplate(result.template)
    toast({
      title: 'Template imported',
      description: result.renamed
        ? `The template ID was already taken, so it was imported as "${result.template.id}".`
        : undefined,
    })
  }

  return (
    <PageBody>
      <PageHeading
        title="Templates"
        subtitle="Manage reusable report templates."
        actions={
          <>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates..."
              className="h-[34px] w-[220px] text-[12.5px]"
            />
            <Button size="lg" onClick={() => fileInput.current?.click()}>
              Import
            </Button>
            <Button size="lg" variant="primary" onClick={() => openCreate('new')}>
              + New Template
            </Button>
          </>
        }
      />

      <input
        ref={fileInput}
        type="file"
        accept=".templify,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void onImport(file)
        }}
      />

      <div className="mt-[22px] flex flex-wrap gap-[6px]">
        {FILTERS.map((filter) => (
          <Pill
            key={filter.value}
            label={filter.label}
            active={category === filter.value}
            onClick={() => setCategory(filter.value)}
          />
        ))}
      </div>

      {visible.length ? (
        <div className="mt-5 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(228px,1fr))]">
          {visible.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => navigate(`/preview/${template.id}?from=templates`)}
              onEdit={() => navigate(`/editor/${template.id}`)}
              menuItems={menuFor(template.id)}
            />
          ))}
        </div>
      ) : templates.length ? (
        <EmptyState
          title="No matching templates"
          description="Try a different search term or category."
          actions={
            <Button
              onClick={() => {
                setQuery('')
                setCategory('all')
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <EmptyState
          title="No templates yet"
          description={
            <>
              Create your first report template
              <br />
              or start from a professional template.
            </>
          }
          actions={
            <>
              <Button variant="primary" size="lg" onClick={() => navigate('/library')}>
                Browse Template Library
              </Button>
              <Button size="lg" onClick={() => openCreate('new')}>
                Start Blank
              </Button>
            </>
          }
        />
      )}
    </PageBody>
  )
}
