import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/utils/cn'

const FIELD_BASE =
  'w-full bg-toolbar border border-line rounded-[7px] text-ink outline-none transition-colors ' +
  'placeholder:text-faint focus:border-accent/60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(FIELD_BASE, 'h-[31px] px-[10px] text-[12px]', className)}
        {...props}
      />
    )
  },
)

/** Monospace variant — template ids, bindings, expressions. */
export const CodeInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function CodeInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        spellCheck={false}
        autoComplete="off"
        className={cn(FIELD_BASE, 'h-[29px] px-[9px] font-mono text-[11px]', className)}
        {...props}
      />
    )
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(FIELD_BASE, 'h-[31px] cursor-pointer px-[8px] text-[12px]', className)}
        {...props}
      >
        {children}
      </select>
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        spellCheck={false}
        className={cn(
          FIELD_BASE,
          'resize-y px-[9px] py-[8px] font-mono text-[11.5px] leading-[1.6]',
          className,
        )}
        {...props}
      />
    )
  },
)

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-[5px] text-[11px] text-muted">{label}</div>
      {children}
      {error ? <div className="mt-[5px] text-[11px] text-danger">{error}</div> : null}
      {!error && hint ? <div className="mt-[5px] text-[11px] text-faint">{hint}</div> : null}
    </div>
  )
}

/** Small labelled numeric cell used by the editor's Layout / Typography grids. */
export function MiniField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: string
  onCommit: (raw: string) => void
}) {
  return (
    <label className="flex h-[29px] items-center gap-[7px] rounded-[7px] border border-line bg-toolbar px-[9px] focus-within:border-accent/60">
      <span className="w-[16px] flex-none font-mono text-[10px] text-faint">{label}</span>
      <input
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        className="min-w-0 flex-1 border-none bg-transparent text-[11.5px] text-ink outline-none"
      />
    </label>
  )
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <div className="mb-[5px] text-[10.5px] text-faint">{label}</div>
      <div className="flex h-[29px] items-center gap-[7px] rounded-[7px] border border-line bg-toolbar px-[8px] focus-within:border-accent/60">
        <span
          className="h-[14px] w-[14px] flex-none rounded-[4px] border border-line"
          style={{ background: value || 'transparent' }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="min-w-0 flex-1 border-none bg-transparent font-mono text-[11.5px] text-ink outline-none placeholder:text-faint"
        />
      </div>
    </div>
  )
}
