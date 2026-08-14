import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Orientation, PageSize, TemplateCategory } from '@/types/template'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input, Select } from './ui/controls'
import { Segmented } from './ui/toggles'
import { useUiStore } from '@/state/uiStore'
import { useTemplateStore } from '@/state/templateStore'
import { CATEGORIES } from '@/services/templateCatalog'
import { slugify } from '@/utils/id'

const ID_PATTERN = /^[a-z0-9-]+$/

interface FormState {
  name: string
  id: string
  category: TemplateCategory
  description: string
  size: PageSize
  orientation: Orientation
}

const BLANK: FormState = {
  name: 'My Invoice',
  id: 'my-invoice',
  category: 'invoice',
  description: 'Modern invoice layout',
  size: 'A4',
  orientation: 'portrait',
}

export function CreateTemplateDialog() {
  const navigate = useNavigate()
  const dialog = useUiStore((s) => s.createDialog)
  const close = useUiStore((s) => s.closeCreateDialog)
  const toast = useUiStore((s) => s.toast)

  const builtIns = useTemplateStore((s) => s.builtIns)
  const isIdAvailable = useTemplateStore((s) => s.isIdAvailable)
  const create = useTemplateStore((s) => s.create)
  const useTemplate = useTemplateStore((s) => s.useTemplate)

  const [form, setForm] = useState<FormState>(BLANK)
  const [busy, setBusy] = useState(false)

  const source = useMemo(
    () => (dialog?.sourceId ? builtIns.find((t) => t.id === dialog.sourceId) : undefined),
    [dialog?.sourceId, builtIns],
  )

  // Seed the form each time the dialog opens.
  useEffect(() => {
    if (!dialog) return
    if (dialog.mode === 'use' && source) {
      setForm({
        name: source.name,
        id: `${source.id}-copy`,
        category: source.category,
        description: source.description,
        size: source.page.size,
        orientation: source.page.orientation,
      })
    } else {
      setForm(BLANK)
    }
  }, [dialog, source])

  const patch = (next: Partial<FormState>) => setForm((current) => ({ ...current, ...next }))

  const trimmedId = form.id.trim()
  const idError = !trimmedId
    ? 'A template ID is required.'
    : !ID_PATTERN.test(trimmedId)
      ? 'Use lowercase letters, numbers and dashes only.'
      : !isIdAvailable(trimmedId)
        ? 'This template ID is already in use.'
        : ''

  const canSubmit = !idError && !!form.name.trim() && !busy

  async function submit() {
    if (!canSubmit || !dialog) return
    setBusy(true)
    try {
      const created =
        dialog.mode === 'use' && source
          ? await useTemplate(source.id, trimmedId, form.name.trim())
          : await create({
              id: trimmedId,
              name: form.name.trim(),
              category: form.category,
              description: form.description.trim(),
              size: form.size,
              orientation: form.orientation,
            })

      if (!created) return
      close()
      toast({
        title: dialog.mode === 'use' ? 'Template duplicated' : 'Template created',
        description:
          dialog.mode === 'use'
            ? `"${source?.name}" was copied — the built-in stays untouched.`
            : undefined,
      })
      navigate(`/editor/${created.id}`)
    } finally {
      setBusy(false)
    }
  }

  if (!dialog) return null
  const isUse = dialog.mode === 'use'

  return (
    <Modal
      open
      onClose={close}
      width={430}
      title={isUse ? 'Use Template' : 'Create Template'}
      subtitle={
        isUse
          ? 'The built-in template is copied into your workspace — the original stays untouched.'
          : 'Template IDs are what your application sends to the render API.'
      }
      footer={
        <>
          <Button size="md" onClick={close}>
            Cancel
          </Button>
          {!isUse ? (
            <Button
              size="md"
              onClick={() => {
                close()
                navigate('/library')
              }}
            >
              Browse Templates
            </Button>
          ) : null}
          <Button size="md" variant="primary" disabled={!canSubmit} onClick={submit}>
            {isUse ? 'Duplicate & Edit' : 'Create & Edit'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[13px] px-[17px] py-4">
        <Field label="Name">
          <Input
            autoFocus
            value={form.name}
            placeholder="My Invoice"
            onChange={(e) => {
              const name = e.target.value
              // Keep the id in step with the name until the user edits it.
              patch(
                form.id === slugify(form.name) || !form.id
                  ? { name, id: slugify(name) }
                  : { name },
              )
            }}
          />
        </Field>

        <Field label="Template ID" error={idError}>
          <Input
            value={form.id}
            placeholder="my-invoice"
            spellCheck={false}
            className={`font-mono text-accent-link ${idError ? 'border-danger-line' : ''}`}
            onChange={(e) => patch({ id: e.target.value })}
          />
        </Field>

        <Field label="Category">
          <Select
            value={form.category}
            onChange={(e) => patch({ category: e.target.value as TemplateCategory })}
          >
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.plural}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description">
          <Input
            value={form.description}
            placeholder="Modern invoice layout"
            onChange={(e) => patch({ description: e.target.value })}
          />
        </Field>

        <Field label="Page size">
          <Select value={form.size} onChange={(e) => patch({ size: e.target.value as PageSize })}>
            <option value="A4">A4</option>
            <option value="A5">A5</option>
            <option value="LETTER">Letter</option>
          </Select>
        </Field>

        <div>
          <div className="mb-[6px] text-[11px] text-muted">Orientation</div>
          <Segmented
            value={form.orientation}
            onChange={(orientation) => patch({ orientation })}
            options={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
          />
        </div>
      </div>
    </Modal>
  )
}
