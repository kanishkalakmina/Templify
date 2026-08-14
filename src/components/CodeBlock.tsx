import { Button } from './ui/Button'
import { copyToClipboard } from '@/utils/download'
import { useUiStore } from '@/state/uiStore'

export function CodeBlock({
  title,
  code,
  copyLabel = 'Copy',
  toastTitle = 'Copied',
}: {
  title: string
  code: string
  copyLabel?: string
  toastTitle?: string
}) {
  const toast = useUiStore((s) => s.toast)

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-toolbar">
      <div className="flex items-center border-b border-line px-[14px] py-[10px]">
        <div className="font-mono text-[11.5px] text-muted">{title}</div>
        <Button
          size="xs"
          className="ml-auto"
          onClick={async () => {
            const ok = await copyToClipboard(code)
            toast({
              title: ok ? toastTitle : 'Could not copy',
              tone: ok ? 'default' : 'danger',
            })
          }}
        >
          {copyLabel}
        </Button>
      </div>
      <pre className="overflow-auto p-4 font-mono text-[11.5px] leading-[1.75] text-ink-3">
        {code}
      </pre>
    </div>
  )
}
