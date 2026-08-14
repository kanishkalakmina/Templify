import { useEffect } from 'react'
import { useEditorStore } from '@/state/editorStore'

/**
 * Editor keyboard shortcuts.
 *
 * Ignores events originating in form controls so typing a binding into a text
 * field never triggers Delete or Duplicate.
 */
export function useKeyboardShortcuts({
  enabled,
  onSave,
}: {
  enabled: boolean
  onSave: () => void
}) {
  useEffect(() => {
    if (!enabled) return

    const handler = (event: KeyboardEvent) => {
      // `target` is not always an element — a keydown with nothing focused
      // reports `document`, which has no tagName. Guard rather than optional-chain
      // the property access, or this throws and swallows the shortcut.
      const target = event.target as HTMLElement | null
      const tag = (target && 'tagName' in target ? target.tagName : '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return
      }

      const store = useEditorStore.getState()
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (mod && key === 'z') {
        event.preventDefault()
        event.shiftKey ? store.redo() : store.undo()
        return
      }
      if (mod && key === 'y') {
        event.preventDefault()
        store.redo()
        return
      }
      if (mod && key === 's') {
        event.preventDefault()
        onSave()
        return
      }
      if (mod && key === 'd') {
        event.preventDefault()
        store.duplicateSelection()
        return
      }
      if (mod && key === 'c') {
        store.copySelection()
        return
      }
      if (mod && key === 'v') {
        store.paste()
        return
      }
      if (mod && key === 'a') {
        event.preventDefault()
        store.selectAll()
        return
      }
      if (mod && key === 'g') {
        event.preventDefault()
        event.shiftKey ? store.ungroup() : store.group()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (store.selectedIds.length) {
          event.preventDefault()
          store.deleteSelection()
        }
        return
      }
      if (event.key === 'Escape') {
        store.clearSelection()
        return
      }

      // Arrow-key nudging: 1px, or 10px with Shift.
      const step = event.shiftKey ? 10 : 1
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const delta = nudge[event.key]
      if (delta && store.selectedIds.length) {
        event.preventDefault()
        store.moveSelection(delta[0], delta[1])
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [enabled, onSave])
}
