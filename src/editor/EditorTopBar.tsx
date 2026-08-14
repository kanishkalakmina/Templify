import { Redo2, Settings2, Undo2 } from 'lucide-react'
import type { ReportTemplate } from '@/types/template'
import { Button, IconButton } from '@/components/ui/Button'

export function EditorTopBar({
  template,
  dirty,
  canUndo,
  canRedo,
  onBack,
  onUndo,
  onRedo,
  onOpenTestData,
  onOpenVersions,
  onOpenSettings,
  onExport,
  onPreview,
  onSave,
}: {
  template: ReportTemplate
  dirty: boolean
  canUndo: boolean
  canRedo: boolean
  onBack: () => void
  onUndo: () => void
  onRedo: () => void
  onOpenTestData: () => void
  onOpenVersions: () => void
  onOpenSettings: () => void
  onExport: () => void
  onPreview: () => void
  onSave: () => void
}) {
  return (
    <div className="flex h-12 flex-none items-center gap-[10px] border-b border-line bg-toolbar px-3">
      <Button className="h-[28px] border-line bg-transparent px-[9px] text-muted" onClick={onBack}>
        ← Templates
      </Button>

      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-[12.5px] text-faint">/</span>
        <span className="truncate text-[13px] font-medium">{template.name}</span>
        <span className="font-mono text-[10.5px] text-accent">{template.id}</span>
        <span className="flex-none rounded-[4px] border border-line px-[5px] py-[2px] font-mono text-[10.5px] text-faint">
          {`v${template.version}`}
        </span>
      </div>

      <div className="ml-[14px] flex items-center gap-1">
        <IconButton label="Undo — Ctrl Z" disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={15} strokeWidth={1.6} />
        </IconButton>
        <IconButton label="Redo — Ctrl Shift Z" disabled={!canRedo} onClick={onRedo}>
          <Redo2 size={15} strokeWidth={1.6} />
        </IconButton>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className={`text-[11.5px] ${dirty ? 'text-warn' : 'text-faint'}`}>
          {dirty ? 'Unsaved changes' : 'Saved ✓'}
        </span>
        <Button onClick={onOpenTestData}>Test Data</Button>
        <Button onClick={onOpenVersions}>Versions</Button>
        <Button onClick={onExport}>Export</Button>
        <Button onClick={onPreview}>Preview</Button>
        <IconButton label="Template settings" onClick={onOpenSettings}>
          <Settings2 size={15} strokeWidth={1.6} />
        </IconButton>
        <Button variant="primary" title="Save — Ctrl S" onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  )
}
