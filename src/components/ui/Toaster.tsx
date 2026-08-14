import { useUiStore, type ToastTone } from '@/state/uiStore'

const DOT: Record<ToastTone, string> = {
  default: 'bg-ok',
  success: 'bg-ok',
  info: 'bg-accent',
  warning: 'bg-warn',
  danger: 'bg-danger',
}

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts)
  const dismiss = useUiStore((s) => s.dismissToast)

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismiss(toast.id)}
          className="pointer-events-auto flex max-w-[380px] animate-rfin cursor-pointer items-start gap-[9px] rounded-xl border border-line-strong bg-raised px-[14px] py-[10px] text-left text-[12px] text-ink shadow-toast"
        >
          <span className={`mt-[5px] h-[6px] w-[6px] flex-none rounded-full ${DOT[toast.tone]}`} />
          <span className="min-w-0">
            <span className="block">{toast.title}</span>
            {toast.description ? (
              <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                {toast.description}
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  )
}
