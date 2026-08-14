import { cn } from '@/utils/cn'

const ACTIVE = 'bg-[rgba(91,124,250,.16)] border-[rgba(91,124,250,.4)] text-accent-text'

/** Category filter chip. */
export function Pill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-[27px] cursor-pointer rounded-[7px] border px-[11px] text-[11.5px] transition-colors',
        active ? ACTIVE : 'border-line bg-panel text-muted hover:border-line-hover',
      )}
    >
      {label}
    </button>
  )
}

/** Compact canvas toolbar toggle (Grid / Snap / Margins). */
export function MiniToggle({
  label,
  active,
  onClick,
  title,
}: {
  label: string
  active: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'h-[22px] cursor-pointer rounded-[6px] border px-[8px] text-[10.5px] transition-colors',
        active ? ACTIVE : 'border-line bg-raised text-muted hover:border-line-hover',
      )}
    >
      {label}
    </button>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

/** Equal-width segmented control — alignment, orientation, logo source. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex gap-[5px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'h-[27px] flex-1 cursor-pointer rounded-[7px] border text-[11px] capitalize transition-colors',
            value === option.value
              ? ACTIVE
              : 'border-line bg-toolbar text-muted hover:border-line-hover',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Coloured method chip on the API page. */
export function MethodChip({ method }: { method: 'POST' | 'GET' | 'PUT' | 'DELETE' }) {
  const tone = {
    POST: 'bg-[rgba(91,124,250,.16)] border-[rgba(91,124,250,.35)] text-accent-text',
    GET: 'bg-[rgba(63,214,140,.13)] border-[rgba(63,214,140,.3)] text-[#7EE0AE]',
    PUT: 'bg-[rgba(245,182,66,.13)] border-[rgba(245,182,66,.3)] text-warn',
    DELETE: 'bg-[rgba(231,128,127,.13)] border-[rgba(231,128,127,.3)] text-danger',
  }[method]

  return (
    <span
      className={cn(
        'inline-block min-w-[52px] rounded-[5px] border px-[7px] py-[3px] text-center font-mono text-[9.5px] font-semibold',
        tone,
      )}
    >
      {method}
    </span>
  )
}

/** Uppercase mono section label used across panels. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('font-mono text-[9.5px] font-semibold tracking-[1px] text-faint', className)}>
      {children}
    </div>
  )
}
