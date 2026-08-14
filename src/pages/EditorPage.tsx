import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { ElementType } from '@/types/template'
import { Button } from '@/components/ui/Button'
import { EditorTopBar } from '@/editor/EditorTopBar'
import { ComponentLibraryPanel } from '@/editor/ComponentLibraryPanel'
import { EditorCanvas } from '@/editor/canvas/EditorCanvas'
import { PropertiesPanel } from '@/editor/panels/PropertiesPanel'
import { TestDataDrawer } from '@/editor/dialogs/TestDataDrawer'
import { VariablePicker } from '@/editor/dialogs/VariablePicker'
import { VersionHistoryDialog } from '@/editor/dialogs/VersionHistoryDialog'
import { TemplateSettingsDialog } from '@/editor/dialogs/TemplateSettingsDialog'
import { useKeyboardShortcuts } from '@/editor/hooks/useKeyboardShortcuts'
import { useEditorStore } from '@/state/editorStore'
import { useTemplateStore } from '@/state/templateStore'
import { useTestDataStore } from '@/state/testDataStore'
import { useUiStore } from '@/state/uiStore'
import { resolveDocument } from '@/services/resolveDocument'
import {
  arraySources,
  coerceSampleValue,
  inferVariableType,
  setPath,
  tokenForPath,
} from '@/services/binding'
import { exportFileName, serializeTemplate } from '@/services/exportService'
import { downloadText } from '@/utils/download'
import { findElement } from '@/services/elementFactory'

type DialogKind = 'testData' | 'variables' | 'versions' | 'settings' | null

/** Below this width the three-pane editor stops being usable (PRD §28). */
const MIN_EDITOR_WIDTH = 880

export function EditorPage() {
  const { templateId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const stored = useTemplateStore((s) => s.getById(templateId))
  const builtIn = useTemplateStore((s) => s.builtIns.find((t) => t.id === templateId))
  const saveTemplate = useTemplateStore((s) => s.saveTemplate)
  const restoreVersion = useTemplateStore((s) => s.restoreTemplateVersion)

  const draft = useEditorStore((s) => s.draft)
  const dirty = useEditorStore((s) => s.dirty)
  const past = useEditorStore((s) => s.past)
  const future = useEditorStore((s) => s.future)
  const open = useEditorStore((s) => s.open)
  const close = useEditorStore((s) => s.close)
  const markSaved = useEditorStore((s) => s.markSaved)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const addElement = useEditorStore((s) => s.addElement)
  const patchElement = useEditorStore((s) => s.patchElement)
  const selectedIds = useEditorStore((s) => s.selectedIds)

  const getData = useTestDataStore((s) => s.getData)
  const applyData = useTestDataStore((s) => s.applyData)
  const revision = useTestDataStore((s) => s.revision)
  const declareVariable = useEditorStore((s) => s.declareVariable)
  const openCreateDialog = useUiStore((s) => s.openCreateDialog)
  const toast = useUiStore((s) => s.toast)

  const [dialog, setDialog] = useState<DialogKind>(
    params.get('panel') === 'versions' ? 'versions' : null,
  )
  const [narrow, setNarrow] = useState(() => window.innerWidth < MIN_EDITOR_WIDTH)

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < MIN_EDITOR_WIDTH)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Load the template into the editor's working draft.
  useEffect(() => {
    if (stored) open(stored)
    return () => close()
    // Re-open only when the identity of the stored template changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored?.id])

  const data = getData(templateId)

  const doc = useMemo(
    () => (draft ? resolveDocument(draft, data, { mode: 'edit' }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, data, revision],
  )

  const sources = useMemo(() => arraySources(data), [data])

  const handleSave = useCallback(async () => {
    const current = useEditorStore.getState().draft
    if (!current) return
    const saved = await saveTemplate(current, { newVersion: true, note: 'Saved from editor' })
    markSaved(saved)
    toast({
      title: 'Template saved',
      description:
        saved.version !== current.version ? `Created v${saved.version}.` : undefined,
    })
  }, [saveTemplate, markSaved, toast])

  useKeyboardShortcuts({ enabled: !!draft && !narrow && !dialog, onSave: handleSave })

  /* ---------------------------------------------------------------- guards */

  // Built-ins are never editable. Route the user through duplication instead.
  useEffect(() => {
    if (!stored && builtIn) {
      openCreateDialog('use', builtIn.id)
      navigate('/library', { replace: true })
    }
  }, [stored, builtIn, openCreateDialog, navigate])

  if (!stored || !draft || !doc) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-app text-center">
        <div className="text-[15px] font-semibold">Template not found</div>
        <div className="text-[12.5px] text-muted">
          <span className="font-mono text-accent-link">{templateId}</span> is not in your templates.
        </div>
        <Button onClick={() => navigate('/templates')}>Back to Templates</Button>
      </div>
    )
  }

  /* ---------------------------------------------------------------- actions */

  function insertVariable(token: string) {
    const current = useEditorStore.getState().draft
    if (!current || selectedIds.length !== 1) return
    const element = findElement(current.elements, selectedIds[0])
    if (!element) return

    const textual =
      element.type === 'text' ||
      element.type === 'heading' ||
      element.type === 'richText' ||
      element.type === 'badge' ||
      element.type === 'header' ||
      element.type === 'footer' ||
      element.type === 'signature'

    if (textual) {
      const content = element.content ?? ''
      const caret = useEditorStore.getState().contentCaret
      // Insert where the caret was; fall back to appending.
      const at = caret !== null && caret >= 0 && caret <= content.length ? caret : content.length
      patchElement(element.id, {
        content: `${content.slice(0, at)}${token}${content.slice(at)}`,
      })
      useEditorStore.getState().setContentCaret(at + token.length)
    } else {
      patchElement(element.id, { dataBinding: token })
    }

    toast({ title: 'Variable inserted' })
  }

  /**
   * Creates a variable that does not exist yet: seeds a sample into the applied
   * test data so it renders immediately, declares the path on the template so it
   * travels with an export, then inserts the token.
   */
  function createVariable(path: string, sample: string) {
    const value = coerceSampleValue(sample)
    applyData(templateId, setPath(data, path, value))

    declareVariable({
      path,
      label: path.split('.').pop() ?? path,
      type: inferVariableType(value),
      sample: value,
    })

    insertVariable(tokenForPath(path))
    toast({ title: 'Variable added', description: `${path} is now available in this template.` })
  }

  function onExport() {
    const current = useEditorStore.getState().draft
    if (!current) return
    downloadText(exportFileName(current), serializeTemplate(current))
    toast({
      title: 'Template exported',
      description: 'Design only — no test data is included.',
    })
  }

  function closeDialog() {
    setDialog(null)
    if (params.get('panel')) {
      params.delete('panel')
      setParams(params, { replace: true })
    }
  }

  function onAddElement(type: ElementType, position?: { x: number; y: number }) {
    addElement(type, position)
    toast({ title: 'Component added' })
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-app">
      <EditorTopBar
        template={draft}
        dirty={dirty}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onBack={() => navigate('/templates')}
        onUndo={undo}
        onRedo={redo}
        onOpenTestData={() => setDialog('testData')}
        onOpenVersions={() => setDialog('versions')}
        onOpenSettings={() => setDialog('settings')}
        onExport={onExport}
        onPreview={() => navigate(`/preview/${draft.id}?from=editor`)}
        onSave={handleSave}
      />

      {narrow ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="max-w-[380px] text-center">
            <div className="text-[15px] font-semibold">Optimized for desktop</div>
            <div className="mt-2 text-[12.5px] leading-relaxed text-muted">
              The Templify editor is built for large screens. Please use a wider viewport for the
              best editing experience.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ComponentLibraryPanel onAdd={(type) => onAddElement(type)} />
          <EditorCanvas
            template={draft}
            doc={doc}
            onDropElement={(type, position) => onAddElement(type, position)}
          />
          <PropertiesPanel
            template={draft}
            arraySources={sources}
            onInsertVariable={() => setDialog('variables')}
          />
        </div>
      )}

      <TestDataDrawer
        open={dialog === 'testData'}
        onClose={closeDialog}
        templateId={draft.id}
      />

      <VariablePicker
        open={dialog === 'variables'}
        onClose={closeDialog}
        data={data}
        declared={draft.variables.map((v) => v.path)}
        onInsert={insertVariable}
        onCreate={createVariable}
      />

      <VersionHistoryDialog
        open={dialog === 'versions'}
        onClose={closeDialog}
        template={stored}
        onCreateVersion={async () => {
          const current = useEditorStore.getState().draft
          if (!current) return
          const saved = await saveTemplate(current, {
            newVersion: true,
            note: `Snapshot at v${current.version + 1}`,
          })
          markSaved(saved)
          toast({ title: 'Version created', description: `Now at v${saved.version}.` })
        }}
        onRestore={async (version) => {
          const restored = await restoreVersion(draft.id, version)
          if (!restored) return
          open(restored)
          closeDialog()
          toast({
            title: 'Template restored',
            description: `v${version} was reapplied as v${restored.version}.`,
          })
        }}
        onPreviewVersion={(version) => navigate(`/preview/${draft.id}:v${version}?from=editor`)}
      />

      <TemplateSettingsDialog
        open={dialog === 'settings'}
        onClose={closeDialog}
        template={draft}
      />
    </div>
  )
}
