/**
 * Editor session state: the working draft, selection, undo/redo and canvas view.
 *
 * Two decisions shape this module.
 *
 * 1. **The editor mutates a draft copy, never the catalogue.** Save promotes the
 *    draft. That is what makes "unsaved changes" meaningful and keeps undo
 *    scoped to the session (architecture D-6).
 *
 * 2. **History is snapshot-based with explicit gesture boundaries.** A drag
 *    emits hundreds of position updates; `beginGesture` / `endGesture` collapse
 *    them into a single undo step (architecture D-1, NFR-004).
 */

import { create } from 'zustand'
import type {
  ElementStyle,
  ElementType,
  PageSettings,
  ReportTemplate,
  TemplateBranding,
  TemplateElement,
  TemplateSnapshot,
  TemplateVariable,
} from '@/types/template'
import { applySnapshot, clone, snapshotOf } from '@/services/versioning'
import {
  cloneElement,
  createElement,
  findElement,
  removeElements,
  updateElement,
} from '@/services/elementFactory'
import { boundsOf, type Rect } from '@/utils/geometry'
import { pageBox } from '@/utils/page'
import { StorageKeys, readJSON, writeJSON } from '@/services/storage'
import { uid } from '@/utils/id'

const HISTORY_LIMIT = 60

export interface CanvasView {
  zoom: number
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
  showMargins: boolean
  showGuides: boolean
}

const DEFAULT_VIEW: CanvasView = {
  zoom: 0.75,
  showGrid: false,
  snapToGrid: true,
  gridSize: 8,
  showMargins: true,
  showGuides: true,
}

interface EditorState {
  draft: ReportTemplate | null
  dirty: boolean
  lastSavedAt: string | null

  selectedIds: string[]
  /** Element currently in inline text-edit mode. */
  editingId: string | null
  /**
   * Caret offset in the Content field, remembered when focus leaves it.
   * "Insert Variable" needs this: clicking the button blurs the textarea, so
   * without it a token could only ever be appended to the end.
   */
  contentCaret: number | null

  clipboard: TemplateElement[]

  past: TemplateSnapshot[]
  future: TemplateSnapshot[]
  /** Snapshot captured at the start of a drag/resize gesture. */
  gestureSnapshot: TemplateSnapshot | null

  view: CanvasView

  /* -------------------------------------------------- session */
  open: (template: ReportTemplate) => void
  close: () => void
  markSaved: (template: ReportTemplate) => void

  /* -------------------------------------------------- history */
  commit: (mutate: (draft: ReportTemplate) => ReportTemplate) => void
  live: (mutate: (draft: ReportTemplate) => ReportTemplate) => void
  beginGesture: () => void
  endGesture: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  /* -------------------------------------------------- selection */
  select: (id: string | null, additive?: boolean) => void
  selectMany: (ids: string[]) => void
  selectAll: () => void
  clearSelection: () => void
  setEditing: (id: string | null) => void
  setContentCaret: (caret: number | null) => void
  selectedElements: () => TemplateElement[]

  /* -------------------------------------------------- elements */
  addElement: (type: ElementType, position?: { x: number; y: number }) => string | null
  insertElement: (element: TemplateElement) => void
  patchElement: (id: string, patch: Partial<TemplateElement>) => void
  patchStyle: (id: string, patch: Partial<ElementStyle>) => void
  moveSelection: (dx: number, dy: number, live?: boolean) => void
  setElementBox: (id: string, box: Partial<Rect>, live?: boolean) => void
  deleteSelection: () => void
  duplicateSelection: () => void
  copySelection: () => void
  paste: () => void

  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void

  group: () => void
  ungroup: () => void

  alignSelection: (edge: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => void

  /* -------------------------------------------------- template settings */
  updatePage: (patch: Partial<PageSettings>) => void
  updateBranding: (patch: Partial<TemplateBranding>) => void
  /** The template's declared data contract. Travels with an export. */
  declareVariable: (variable: TemplateVariable) => void
  updateMeta: (patch: Partial<Pick<ReportTemplate, 'name' | 'description' | 'category'>>) => void

  /* -------------------------------------------------- view */
  setView: (patch: Partial<CanvasView>) => void
  hydrateView: () => void
}

/* -------------------------------------------------------------------------- */
/* Tree helpers                                                                */
/* -------------------------------------------------------------------------- */

/** Reorders `id` within whichever array contains it. */
function reorder(
  elements: TemplateElement[],
  id: string,
  move: (index: number, length: number) => number,
): TemplateElement[] {
  const index = elements.findIndex((e) => e.id === id)
  if (index !== -1) {
    const next = [...elements]
    const [item] = next.splice(index, 1)
    const target = Math.max(0, Math.min(next.length, move(index, elements.length)))
    next.splice(target, 0, item)
    return next
  }
  return elements.map((element) =>
    element.children?.length ? { ...element, children: reorder(element.children, id, move) } : element,
  )
}

/** Collects elements by id, preserving document order. */
function collect(elements: TemplateElement[], ids: Set<string>): TemplateElement[] {
  const out: TemplateElement[] = []
  const visit = (list: TemplateElement[]) => {
    for (const element of list) {
      if (ids.has(element.id)) out.push(element)
      if (element.children?.length) visit(element.children)
    }
  }
  visit(elements)
  return out
}

function persistView(view: CanvasView) {
  writeJSON(StorageKeys.ui, view)
}

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/* -------------------------------------------------------------------------- */

export const useEditorStore = create<EditorState>((set, get) => ({
  draft: null,
  dirty: false,
  lastSavedAt: null,
  selectedIds: [],
  editingId: null,
  contentCaret: null,
  clipboard: [],
  past: [],
  future: [],
  gestureSnapshot: null,
  view: DEFAULT_VIEW,

  /* -------------------------------------------------- session */

  open: (template) =>
    set({
      draft: clone(template),
      dirty: false,
      lastSavedAt: null,
      selectedIds: [],
      editingId: null,
      past: [],
      future: [],
      gestureSnapshot: null,
    }),

  close: () =>
    set({
      draft: null,
      dirty: false,
      selectedIds: [],
      editingId: null,
      past: [],
      future: [],
      gestureSnapshot: null,
    }),

  markSaved: (template) =>
    set({ draft: clone(template), dirty: false, lastSavedAt: new Date().toISOString() }),

  /* -------------------------------------------------- history */

  commit: (mutate) => {
    const { draft, past } = get()
    if (!draft) return
    const snapshot = snapshotOf(draft)
    const next = mutate(clone(draft))
    set({
      draft: next,
      dirty: true,
      past: [...past, snapshot].slice(-HISTORY_LIMIT),
      future: [],
    })
  },

  live: (mutate) => {
    const { draft } = get()
    if (!draft) return
    set({ draft: mutate(clone(draft)), dirty: true })
  },

  beginGesture: () => {
    const { draft } = get()
    if (!draft) return
    set({ gestureSnapshot: snapshotOf(draft) })
  },

  endGesture: () => {
    const { draft, gestureSnapshot, past } = get()
    if (!draft || !gestureSnapshot) return
    const changed = JSON.stringify(gestureSnapshot) !== JSON.stringify(snapshotOf(draft))
    set({
      gestureSnapshot: null,
      past: changed ? [...past, gestureSnapshot].slice(-HISTORY_LIMIT) : past,
      future: changed ? [] : get().future,
    })
  },

  undo: () => {
    const { draft, past, future } = get()
    if (!draft || !past.length) return
    const previous = past[past.length - 1]
    set({
      draft: applySnapshot(draft, previous),
      past: past.slice(0, -1),
      future: [snapshotOf(draft), ...future].slice(0, HISTORY_LIMIT),
      dirty: true,
    })
  },

  redo: () => {
    const { draft, past, future } = get()
    if (!draft || !future.length) return
    const [next, ...rest] = future
    set({
      draft: applySnapshot(draft, next),
      past: [...past, snapshotOf(draft)].slice(-HISTORY_LIMIT),
      future: rest,
      dirty: true,
    })
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  /* -------------------------------------------------- selection */

  select: (id, additive = false) => {
    // A caret belongs to one element's Content field; drop it on any change of
    // selection so a stale offset never lands a token in the wrong place.
    if (id === null) {
      set({ selectedIds: [], editingId: null, contentCaret: null })
      return
    }
    const { selectedIds } = get()
    if (!additive) {
      if (selectedIds[0] !== id) set({ contentCaret: null })
      set({ selectedIds: [id], editingId: null })
      return
    }
    set({
      selectedIds: selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id],
      editingId: null,
    })
  },

  selectMany: (ids) => set({ selectedIds: ids, editingId: null }),

  selectAll: () => {
    const { draft } = get()
    if (!draft) return
    set({ selectedIds: draft.elements.map((e) => e.id), editingId: null })
  },

  clearSelection: () => set({ selectedIds: [], editingId: null }),

  setEditing: (id) => set({ editingId: id }),

  setContentCaret: (caret) => set({ contentCaret: caret }),

  selectedElements: () => {
    const { draft, selectedIds } = get()
    if (!draft) return []
    return collect(draft.elements, new Set(selectedIds))
  },

  /* -------------------------------------------------- elements */

  addElement: (type, position) => {
    const { draft } = get()
    if (!draft) return null

    const page = pageBox(draft.page)
    const element = createElement(type, {
      x: position?.x ?? draft.page.margins.left,
      y: position?.y ?? draft.page.margins.top,
      accent: draft.branding.primaryColor,
    })

    // Keep newly dropped elements inside the page.
    element.x = Math.max(0, Math.min(element.x, page.width - element.width))
    element.y = Math.max(0, Math.min(element.y, page.height - element.height))

    get().commit((d) => ({ ...d, elements: [...d.elements, element] }))
    set({ selectedIds: [element.id] })
    return element.id
  },

  insertElement: (element) => {
    get().commit((d) => ({ ...d, elements: [...d.elements, element] }))
    set({ selectedIds: [element.id] })
  },

  patchElement: (id, patch) => {
    get().commit((d) => ({
      ...d,
      elements: updateElement(d.elements, id, (element) => ({ ...element, ...patch })),
    }))
  },

  patchStyle: (id, patch) => {
    get().commit((d) => ({
      ...d,
      elements: updateElement(d.elements, id, (element) => ({
        ...element,
        style: { ...element.style, ...patch },
      })),
    }))
  },

  moveSelection: (dx, dy, isLive = false) => {
    const { selectedIds } = get()
    if (!selectedIds.length) return
    const apply = (d: ReportTemplate) => {
      let elements = d.elements
      for (const id of selectedIds) {
        elements = updateElement(elements, id, (element) => ({
          ...element,
          x: Math.round(element.x + dx),
          y: Math.round(element.y + dy),
        }))
      }
      return { ...d, elements }
    }
    isLive ? get().live(apply) : get().commit(apply)
  },

  setElementBox: (id, box, isLive = false) => {
    const apply = (d: ReportTemplate) => ({
      ...d,
      elements: updateElement(d.elements, id, (element) => ({
        ...element,
        x: box.x !== undefined ? Math.round(box.x) : element.x,
        y: box.y !== undefined ? Math.round(box.y) : element.y,
        width: box.width !== undefined ? Math.max(4, Math.round(box.width)) : element.width,
        height: box.height !== undefined ? Math.max(1, Math.round(box.height)) : element.height,
      })),
    })
    isLive ? get().live(apply) : get().commit(apply)
  },

  deleteSelection: () => {
    const { selectedIds } = get()
    if (!selectedIds.length) return
    const ids = new Set(selectedIds)
    get().commit((d) => ({ ...d, elements: removeElements(d.elements, ids) }))
    set({ selectedIds: [], editingId: null })
  },

  duplicateSelection: () => {
    const selected = get().selectedElements()
    if (!selected.length) return
    const copies = selected.map((element) => cloneElement(element, { x: 16, y: 16 }))
    get().commit((d) => ({ ...d, elements: [...d.elements, ...copies] }))
    set({ selectedIds: copies.map((c) => c.id) })
  },

  copySelection: () => {
    const selected = get().selectedElements()
    if (selected.length) set({ clipboard: selected.map((e) => clone(e)) })
  },

  paste: () => {
    const { clipboard } = get()
    if (!clipboard.length) return
    const copies = clipboard.map((element) => cloneElement(element, { x: 24, y: 24 }))
    get().commit((d) => ({ ...d, elements: [...d.elements, ...copies] }))
    set({ selectedIds: copies.map((c) => c.id) })
  },

  bringForward: (id) => get().commit((d) => ({ ...d, elements: reorder(d.elements, id, (i) => i + 1) })),
  sendBackward: (id) => get().commit((d) => ({ ...d, elements: reorder(d.elements, id, (i) => i - 1) })),
  bringToFront: (id) =>
    get().commit((d) => ({ ...d, elements: reorder(d.elements, id, (_i, len) => len) })),
  sendToBack: (id) => get().commit((d) => ({ ...d, elements: reorder(d.elements, id, () => 0) })),

  group: () => {
    const selected = get().selectedElements()
    if (selected.length < 2) return
    const bounds = boundsOf(selected)
    if (!bounds) return

    const container = createElement('container', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    })
    container.name = 'Group'
    container.style = { ...container.style, borderStyle: 'none', padding: { top: 0, right: 0, bottom: 0, left: 0 } }
    // Children are positioned relative to the group box.
    container.children = selected.map((element) => ({
      ...clone(element),
      x: element.x - bounds.x,
      y: element.y - bounds.y,
    }))

    const ids = new Set(selected.map((e) => e.id))
    get().commit((d) => ({ ...d, elements: [...removeElements(d.elements, ids), container] }))
    set({ selectedIds: [container.id] })
  },

  ungroup: () => {
    const { draft, selectedIds } = get()
    if (!draft || selectedIds.length !== 1) return
    const group = findElement(draft.elements, selectedIds[0])
    if (!group || !group.children?.length) return

    const released = group.children.map((child) => ({
      ...clone(child),
      id: uid('el'),
      x: child.x + group.x,
      y: child.y + group.y,
    }))

    get().commit((d) => ({
      ...d,
      elements: [...removeElements(d.elements, new Set([group.id])), ...released],
    }))
    set({ selectedIds: released.map((e) => e.id) })
  },

  alignSelection: (edge) => {
    const selected = get().selectedElements()
    const { draft } = get()
    if (!draft) return

    // A single element aligns to the page's content box; several align to each other.
    const page = pageBox(draft.page)
    const reference: Rect =
      selected.length > 1
        ? (boundsOf(selected) as Rect)
        : {
            x: draft.page.margins.left,
            y: draft.page.margins.top,
            width: page.width - draft.page.margins.left - draft.page.margins.right,
            height: page.height - draft.page.margins.top - draft.page.margins.bottom,
          }
    if (!selected.length) return

    get().commit((d) => {
      let elements = d.elements
      for (const element of selected) {
        const patch: Partial<TemplateElement> = {}
        switch (edge) {
          case 'left':
            patch.x = Math.round(reference.x)
            break
          case 'centerX':
            patch.x = Math.round(reference.x + (reference.width - element.width) / 2)
            break
          case 'right':
            patch.x = Math.round(reference.x + reference.width - element.width)
            break
          case 'top':
            patch.y = Math.round(reference.y)
            break
          case 'centerY':
            patch.y = Math.round(reference.y + (reference.height - element.height) / 2)
            break
          case 'bottom':
            patch.y = Math.round(reference.y + reference.height - element.height)
            break
        }
        elements = updateElement(elements, element.id, (e) => ({ ...e, ...patch }))
      }
      return { ...d, elements }
    })
  },

  /* -------------------------------------------------- template settings */

  updatePage: (patch) => get().commit((d) => ({ ...d, page: { ...d.page, ...patch } })),
  updateBranding: (patch) => get().commit((d) => ({ ...d, branding: { ...d.branding, ...patch } })),

  declareVariable: (variable) =>
    get().commit((d) =>
      d.variables.some((v) => v.path === variable.path)
        ? d
        : { ...d, variables: [...d.variables, variable] },
    ),
  updateMeta: (patch) => get().commit((d) => ({ ...d, ...patch })),

  /* -------------------------------------------------- view */

  setView: (patch) => {
    const view = { ...get().view, ...patch }
    persistView(view)
    set({ view })
  },

  hydrateView: () => set({ view: readJSON<CanvasView>(StorageKeys.ui, DEFAULT_VIEW) }),
}))
