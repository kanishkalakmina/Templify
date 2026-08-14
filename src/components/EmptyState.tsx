import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mt-10 rounded-[14px] border border-dashed border-line px-6 py-14 text-center">
      <div className="text-[16px] font-semibold">{title}</div>
      {description ? (
        <div className="mt-2 text-[12.5px] leading-relaxed text-muted">{description}</div>
      ) : null}
      {actions ? <div className="mt-[18px] flex flex-wrap justify-center gap-[9px]">{actions}</div> : null}
    </div>
  )
}
