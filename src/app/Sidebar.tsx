import { NavLink } from 'react-router-dom'
import {
  Code2,
  LayoutDashboard,
  Library,
  Settings,
  Shuffle,
  LayoutTemplate,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { SERVER } from '@/data/server'

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/library', label: 'Template Library', icon: Library },
  { to: '/demo', label: 'Same Data Demo', icon: Shuffle },
  { to: '/api', label: 'API', icon: Code2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="flex w-[224px] flex-none flex-col border-r border-line bg-sidebar px-3 py-[14px]">
      <div className="flex items-center gap-[9px] px-2 pb-[18px] pt-[6px]">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-gradient-to-br from-accent to-violet text-[13px] font-bold text-white">
          T
        </div>
        <div className="text-[14px] font-semibold tracking-[-.2px]">Templify</div>
      </div>

      <nav className="flex flex-col gap-[2px]">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex w-full items-center gap-[10px] rounded-[7px] border-l-2 px-[9px] py-2 text-[12.5px] transition-colors',
                isActive
                  ? 'border-l-accent bg-[rgba(91,124,250,.14)] text-accent-nav'
                  : 'border-l-transparent text-muted hover:bg-raised hover:text-ink',
              )
            }
          >
            <Icon size={16} strokeWidth={1.6} className="flex-none opacity-90" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2 rounded-xl border border-line bg-panel p-[10px]">
        <div className="flex items-center gap-[7px] text-[11px] font-medium text-muted">
          <span className="h-[6px] w-[6px] rounded-full bg-ok shadow-[0_0_0_3px_rgba(63,214,140,.15)]" />
          Server running
        </div>
        <div className="font-mono text-[10.5px] text-faint">
          {SERVER.host} · v{SERVER.version}
        </div>
      </div>
    </aside>
  )
}
