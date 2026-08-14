import { useState, type ReactNode } from 'react'

/** Collapsible properties section, matching the panel's mono section labels. */
export function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-[7px] border-none bg-transparent px-[13px] py-[11px] font-mono text-[9.5px] font-semibold tracking-[1px] text-ink transition-colors hover:bg-raised"
      >
        <span className="text-faint">{open ? '−' : '+'}</span>
        {title}
      </button>
      {open ? <div className="px-[13px] pb-[14px]">{children}</div> : null}
    </div>
  )
}

/** Non-collapsible block with the same label treatment. */
export function StaticSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-line px-[13px] pb-[14px] pt-3">
      <div className="mb-2 font-mono text-[9.5px] font-semibold tracking-[1px] text-ink">
        {title}
      </div>
      {children}
    </div>
  )
}
