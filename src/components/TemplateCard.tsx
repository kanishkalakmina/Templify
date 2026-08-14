import { useEffect, useRef, useState } from 'react'
import type { ReportTemplate } from '@/types/template'
import { Button } from './ui/Button'
import { TemplateThumbnail } from './TemplateThumbnail'
import { categoryLabel } from '@/services/templateCatalog'
import { PAGE_SIZE_LABEL } from '@/utils/page'

export interface TemplateMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

export function TemplateCard({
  template,
  onPreview,
  onEdit,
  menuItems,
}: {
  template: ReportTemplate
  onPreview: () => void
  onEdit: () => void
  menuItems: TemplateMenuItem[]
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const landscape = template.page.orientation === 'landscape'

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden rounded-2xl border border-line bg-panel transition-colors hover:border-line-hover"
    >
      <div className="flex h-[158px] items-center justify-center border-b border-line bg-app p-[14px]">
        <TemplateThumbnail
          template={template}
          maxWidth={landscape ? 128 : 92}
          maxHeight={landscape ? 92 : 130}
        />
      </div>

      <div className="px-[13px] pb-[13px] pt-3">
        <div className="flex items-center gap-[6px]">
          <div className="min-w-0 flex-1 truncate text-[13px] font-medium">{template.name}</div>
          {template.archived ? (
            <span className="flex-none rounded-[4px] border border-line px-[5px] py-[2px] font-mono text-[9px] font-medium text-faint">
              ARCHIVED
            </span>
          ) : null}
        </div>

        <div className="mt-1 h-8 overflow-hidden text-[11.5px] leading-[1.35] text-muted">
          {template.description}
        </div>

        <div className="mt-[6px] font-mono text-[10.5px] text-accent">{template.id}</div>
        <div className="mt-[3px] text-[10.5px] text-faint">
          {`${categoryLabel(template.category)} · ${PAGE_SIZE_LABEL[template.page.size]} · v${template.version}`}
        </div>

        <div className="mt-3 flex gap-[6px]">
          <Button className="h-[29px] flex-1" onClick={onPreview}>
            Preview
          </Button>
          <Button variant="soft" className="h-[29px] flex-1" onClick={onEdit}>
            Edit
          </Button>
          <Button
            aria-label="More actions"
            className="h-[29px] w-[29px] flex-none px-0 leading-none text-muted"
            onClick={() => setMenuOpen((open) => !open)}
          >
            ···
          </Button>
        </div>
      </div>

      {menuOpen ? (
        <div className="absolute bottom-[50px] right-3 z-30 w-[170px] rounded-xl border border-line-strong bg-raised p-[5px] shadow-pop">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setMenuOpen(false)
                item.onClick()
              }}
              className={`w-full cursor-pointer rounded-[6px] px-[10px] py-2 text-left text-[12px] transition-colors hover:bg-line ${
                item.danger ? 'text-danger' : 'text-ink-2'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
