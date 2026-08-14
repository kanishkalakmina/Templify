/**
 * Transient UI state: toasts and global dialog visibility.
 *
 * Nothing here is persisted — it exists only for the lifetime of the tab.
 */

import { create } from 'zustand'
import { uid } from '@/utils/id'

export type ToastTone = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface Toast {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

export interface ToastInput {
  title: string
  description?: string
  tone?: ToastTone
  /** Milliseconds before auto-dismiss. 0 keeps it until dismissed. */
  duration?: number
}

interface UiState {
  toasts: Toast[]
  toast: (input: ToastInput) => string
  dismissToast: (id: string) => void

  /**
   * The Create/Use Template dialog, which can be opened from the dashboard,
   * the templates page, the library and the empty state — so its state lives
   * here rather than being duplicated in four screens.
   */
  createDialog: { mode: 'new' | 'use'; sourceId?: string } | null
  openCreateDialog: (mode: 'new' | 'use', sourceId?: string) => void
  closeCreateDialog: () => void
}

const DEFAULT_DURATION = 3600

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],

  toast: ({ title, description, tone = 'default', duration = DEFAULT_DURATION }) => {
    const id = uid('toast')
    set((state) => ({ toasts: [...state.toasts, { id, title, description, tone }] }))
    if (duration > 0) {
      setTimeout(() => get().dismissToast(id), duration)
    }
    return id
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  createDialog: null,
  openCreateDialog: (mode, sourceId) => set({ createDialog: { mode, sourceId } }),
  closeCreateDialog: () => set({ createDialog: null }),
}))

/**
 * Imperative helper for non-React callers (services, keyboard handlers).
 * Same store, no hook required.
 */
export const toast = (input: ToastInput) => useUiStore.getState().toast(input)
