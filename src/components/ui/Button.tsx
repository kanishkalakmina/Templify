import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export type ButtonVariant = 'primary' | 'ghost' | 'soft' | 'danger' | 'bare'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent border border-accent text-white hover:bg-accent-hover hover:border-accent-hover',
  ghost: 'bg-raised border border-line text-ink-2 hover:border-line-hover',
  soft: 'bg-[rgba(91,124,250,.14)] border border-[rgba(91,124,250,.35)] text-accent-text hover:bg-[rgba(91,124,250,.22)]',
  danger: 'bg-raised border border-line text-danger hover:border-danger-line',
  bare: 'bg-transparent border border-transparent text-muted hover:text-ink',
}

const SIZE: Record<ButtonSize, string> = {
  xs: 'h-[26px] px-[10px] text-[11px] rounded-[6px]',
  sm: 'h-[29px] px-[11px] text-[11.5px] rounded-[7px]',
  md: 'h-[31px] px-[13px] text-[12px] rounded-[7px]',
  lg: 'h-[34px] px-[14px] text-[12.5px] rounded-lg',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'sm', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex flex-none cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  )
})

/** Square icon button — used by the editor toolbars. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(
  function IconButton({ label, className, children, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        title={label}
        aria-label={label}
        className={cn(
          'inline-flex h-[28px] w-[28px] flex-none cursor-pointer items-center justify-center rounded-[7px]',
          'border border-line bg-transparent text-ink-2 transition-colors hover:bg-raised',
          'disabled:cursor-not-allowed disabled:text-line-hover disabled:hover:bg-transparent',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)
