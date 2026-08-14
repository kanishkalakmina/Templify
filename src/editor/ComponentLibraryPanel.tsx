import { useMemo, useState } from 'react'
import type { ElementType } from '@/types/template'
import { Input } from '@/components/ui/controls'
import { PALETTE, DRAG_TYPE } from './palette'

/**
 * Left panel. Every component can be dragged onto the page or clicked to add.
 *
 * Palette-to-canvas uses the native drag API rather than a pointer-based
 * abstraction: the drop target is discrete, so there is nothing to gain from
 * the extra machinery, and it keeps the interaction independent of the
 * canvas's own pointer handling.
 */
export function ComponentLibraryPanel({ onAdd }: { onAdd: (type: ElementType) => void }) {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return PALETTE
    return PALETTE.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(needle)),
    })).filter((group) => group.items.length)
  }, [query])

  return (
    <div className="flex w-[214px] flex-none flex-col border-r border-line bg-sidebar">
      <div className="flex-none border-b border-raised px-[11px] pb-[9px] pt-[11px]">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search components"
          className="h-[29px] text-[11.5px]"
        />
      </div>

      <div className="flex-1 overflow-auto px-2 pb-5 pt-[6px]">
        {groups.map((group) => (
          <div key={group.name} className="mt-[10px]">
            <div className="px-[6px] py-[5px] font-mono text-[9.5px] font-semibold tracking-[1px] text-faint">
              {group.name}
            </div>
            <div className="grid grid-cols-2 gap-[5px]">
              {group.items.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  title="Drag onto the page or click to add"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_TYPE, type)
                    event.dataTransfer.setData('text/plain', type)
                    event.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => onAdd(type)}
                  className="flex cursor-grab flex-col items-start gap-[5px] rounded-[7px] border border-line bg-panel px-2 pb-[7px] pt-2 text-left text-[11px] text-ink-2 transition-colors hover:border-line-hover hover:bg-raised active:cursor-grabbing"
                >
                  <Icon size={14} strokeWidth={1.6} className="text-accent-link" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {!groups.length ? (
          <div className="px-2 py-8 text-center text-[11.5px] text-faint">
            No components match “{query}”.
          </div>
        ) : null}
      </div>
    </div>
  )
}
