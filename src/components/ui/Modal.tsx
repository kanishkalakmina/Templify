import { useEffect, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

function useEscape(onClose: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
}

/** Centred dialog. Dark, per the "dialogs are dark" rule. */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  headerAside,
  footer,
  width = 430,
  children,
  bodyClassName,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  headerAside?: ReactNode
  footer?: ReactNode
  width?: number
  children: ReactNode
  bodyClassName?: string
}) {
  useEscape(onClose)
  if (!open) return null

  return (
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(5,7,10,.62)] p-10"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width }}
        className="flex max-h-[80vh] animate-rfin flex-col overflow-hidden rounded-3xl border border-line-strong bg-panel shadow-modal"
      >
        <div className="flex flex-none items-center gap-3 border-b border-line px-[17px] py-[15px]">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold">{title}</div>
            {subtitle ? <div className="mt-[5px] text-[11.5px] text-muted">{subtitle}</div> : null}
          </div>
          {headerAside ? <div className="ml-auto flex-none">{headerAside}</div> : null}
        </div>

        <div className={cn('min-h-0 flex-1 overflow-auto', bodyClassName)}>{children}</div>

        {footer ? (
          <div className="flex flex-none justify-end gap-2 border-t border-line px-[17px] py-[13px]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Right-hand drawer — used by the Test Data panel. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  width = 460,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  footer?: ReactNode
  width?: number
  children: ReactNode
}) {
  useEscape(onClose)
  if (!open) return null

  return (
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-[60] flex justify-end bg-[rgba(5,7,10,.62)]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width }}
        className="flex h-full animate-rfin flex-col border-l border-line bg-panel"
      >
        <div className="flex-none border-b border-line px-4 py-[15px]">
          <div className="text-[13.5px] font-semibold">{title}</div>
          {subtitle ? <div className="mt-[5px] text-[11.5px] text-muted">{subtitle}</div> : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {footer ? <div className="flex-none px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}
