import { useEditorStore } from '@/state/editorStore'
import { boundsOf, type Rect } from '@/utils/geometry'

const ACTION_CLASS =
  'h-[24px] cursor-pointer rounded-[6px] border-none bg-transparent px-[9px] text-[11px] transition-colors hover:bg-line hover:text-ink'

/**
 * Contextual actions floating above the current selection.
 * Positioned in *scaled* screen coordinates, so it sits outside the page.
 */
export function FloatingToolbar({ scale }: { scale: number }) {
  const draft = useEditorStore((s) => s.draft)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const duplicateSelection = useEditorStore((s) => s.duplicateSelection)
  const deleteSelection = useEditorStore((s) => s.deleteSelection)
  const alignSelection = useEditorStore((s) => s.alignSelection)
  const bringForward = useEditorStore((s) => s.bringForward)
  const sendBackward = useEditorStore((s) => s.sendBackward)
  const group = useEditorStore((s) => s.group)
  const ungroup = useEditorStore((s) => s.ungroup)

  if (!draft || !selectedIds.length) return null

  const rects = draft.elements
    .filter((element) => selectedIds.includes(element.id))
    .map<Rect>((element) => ({
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    }))

  const bounds = boundsOf(rects)
  if (!bounds) return null

  const single = selectedIds.length === 1
  const selectedElement = single
    ? draft.elements.find((element) => element.id === selectedIds[0])
    : undefined
  const isGroup = !!selectedElement?.children?.length

  return (
    <div
      className="absolute z-20 flex gap-[2px] rounded-xl border border-line-strong bg-raised p-1 text-ink-3 shadow-float"
      style={{
        left: Math.round(bounds.x * scale),
        top: Math.max(-34, Math.round(bounds.y * scale) - 38),
      }}
    >
      <button type="button" className={ACTION_CLASS} title="Duplicate — Ctrl D" onClick={duplicateSelection}>
        Duplicate
      </button>
      <button
        type="button"
        className={ACTION_CLASS}
        title="Center horizontally"
        onClick={() => alignSelection('centerX')}
      >
        Center
      </button>
      {single ? (
        <>
          <button
            type="button"
            className={ACTION_CLASS}
            title="Move forward"
            onClick={() => bringForward(selectedIds[0])}
          >
            Forward
          </button>
          <button
            type="button"
            className={ACTION_CLASS}
            title="Move back"
            onClick={() => sendBackward(selectedIds[0])}
          >
            Back
          </button>
        </>
      ) : null}
      {selectedIds.length > 1 ? (
        <button type="button" className={ACTION_CLASS} title="Group selection" onClick={group}>
          Group
        </button>
      ) : null}
      {isGroup ? (
        <button type="button" className={ACTION_CLASS} title="Ungroup" onClick={ungroup}>
          Ungroup
        </button>
      ) : null}
      <button
        type="button"
        className={`${ACTION_CLASS} text-danger hover:text-danger`}
        title="Delete — Del"
        onClick={deleteSelection}
      >
        Delete
      </button>
    </div>
  )
}
