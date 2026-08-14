import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

/** Persistent chrome. The editor and preview routes render outside this shell. */
export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-app text-ink">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

/** Standard scroll container and measure for the content pages. */
export function PageBody({
  children,
  width = 1180,
}: {
  children: React.ReactNode
  width?: number
}) {
  return (
    <div className="flex-1 overflow-auto px-11 pb-16 pt-9">
      <div className="mx-auto" style={{ maxWidth: width }}>
        {children}
      </div>
    </div>
  )
}

export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-[14px]">
      <div>
        <div className="text-[22px] font-semibold tracking-[-.4px]">{title}</div>
        {subtitle ? <div className="mt-[6px] text-[13px] text-muted">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex gap-[9px]">{actions}</div> : null}
    </div>
  )
}
