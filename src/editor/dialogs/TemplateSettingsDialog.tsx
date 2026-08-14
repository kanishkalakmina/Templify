import type { Orientation, PageSize, ReportTemplate, TemplateCategory } from '@/types/template'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ColorField, Field, Input, MiniField, Select } from '@/components/ui/controls'
import { Segmented } from '@/components/ui/toggles'
import { useEditorStore } from '@/state/editorStore'
import { CATEGORIES } from '@/services/templateCatalog'
import { DOC_FONT, DOC_SERIF, DOC_MONO } from '@/render/styles'

export function TemplateSettingsDialog({
  open,
  onClose,
  template,
}: {
  open: boolean
  onClose: () => void
  template: ReportTemplate
}) {
  const updateMeta = useEditorStore((s) => s.updateMeta)
  const updatePage = useEditorStore((s) => s.updatePage)
  const updateBranding = useEditorStore((s) => s.updateBranding)

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={460}
      title="Template settings"
      subtitle="Page setup and branding defaults for this template."
      footer={
        <Button size="md" variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-[13px] px-[17px] py-4">
        <Field label="Template name">
          <Input value={template.name} onChange={(e) => updateMeta({ name: e.target.value })} />
        </Field>

        <Field
          label="Template ID"
          hint="Changing this breaks applications already sending the old ID."
        >
          <Input
            value={template.id}
            readOnly
            className="cursor-not-allowed font-mono text-accent-link opacity-70"
          />
        </Field>

        <Field label="Category">
          <Select
            value={template.category}
            onChange={(e) => updateMeta({ category: e.target.value as TemplateCategory })}
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
            value={template.description}
            onChange={(e) => updateMeta({ description: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Page size">
            <Select
              value={template.page.size}
              onChange={(e) => updatePage({ size: e.target.value as PageSize })}
            >
              <option value="A4">A4</option>
              <option value="A5">A5</option>
              <option value="LETTER">Letter</option>
            </Select>
          </Field>
          <div>
            <div className="mb-[5px] text-[11px] text-muted">Orientation</div>
            <Segmented<Orientation>
              value={template.page.orientation}
              onChange={(orientation) => updatePage({ orientation })}
              options={[
                { value: 'portrait', label: 'Portrait' },
                { value: 'landscape', label: 'Landscape' },
              ]}
            />
          </div>
        </div>

        <div>
          <div className="mb-[5px] text-[11px] text-muted">Margins</div>
          <div className="grid grid-cols-4 gap-[9px]">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <MiniField
                key={side}
                label={side.charAt(0).toUpperCase()}
                value={String(template.page.margins[side])}
                onCommit={(raw) => {
                  const value = Number(raw)
                  if (Number.isFinite(value)) {
                    updatePage({ margins: { ...template.page.margins, [side]: Math.round(value) } })
                  }
                }}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-line pt-[13px]">
          <div className="mb-[11px] font-mono text-[9.5px] font-semibold tracking-[1px] text-ink">
            BRANDING
          </div>
          <div className="flex flex-col gap-3">
            <ColorField
              label="Primary color"
              value={template.branding.primaryColor}
              onChange={(primaryColor) => updateBranding({ primaryColor })}
            />
            <ColorField
              label="Secondary color"
              value={template.branding.secondaryColor}
              onChange={(secondaryColor) => updateBranding({ secondaryColor })}
            />
            <Field label="Default font">
              <Select
                value={template.branding.fontFamily}
                onChange={(e) => updateBranding({ fontFamily: e.target.value })}
              >
                <option value={DOC_FONT}>IBM Plex Sans</option>
                <option value={DOC_SERIF}>Source Serif 4</option>
                <option value={DOC_MONO}>IBM Plex Mono</option>
              </Select>
            </Field>
            <Field label="Default logo binding">
              <Input
                value={template.branding.defaultLogo ?? ''}
                onChange={(e) => updateBranding({ defaultLogo: e.target.value })}
                className="font-mono text-[11.5px]"
              />
            </Field>
            <Field label="Default footer">
              <Input
                value={template.branding.defaultFooter ?? ''}
                onChange={(e) => updateBranding({ defaultFooter: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-2 text-[10.5px] leading-relaxed text-faint">
            Branding seeds new elements. Existing elements keep the colours they were given.
          </div>
        </div>
      </div>
    </Modal>
  )
}
